import uuid
import datetime
from datetime import timedelta
from functools import wraps
from flask import Flask, request, jsonify, send_from_directory
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from flask_cors import CORS
import psycopg2
import psycopg2.extras
import os

# Initialize Flask app
app = Flask(__name__)
# Enable CORS for all domains to allow the React frontend to connect
CORS(app)

# --- PostgreSQL Configuration ---
# You need to replace these with your actual PostgreSQL database credentials
app.config['POSTGRES_HOST'] = 'localhost'
app.config['POSTGRES_USER'] = 'vincent'
app.config['POSTGRES_PASSWORD'] = 'yourpassword' # Make sure to use your actual password
app.config['POSTGRES_DB'] = 'late_show_db'

# --- File Upload Configuration ---
# Set the directory for storing uploaded images
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
# Define allowed image extensions
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

def allowed_file(filename):
    """Checks if a file has an allowed extension."""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# --- Database Connection Helper ---
def get_db_connection():
    """
    Establishes a connection to the PostgreSQL database.
    """
    try:
        conn = psycopg2.connect(
            host=app.config['POSTGRES_HOST'],
            user=app.config['POSTGRES_USER'],
            password=app.config['POSTGRES_PASSWORD'],
            dbname=app.config['POSTGRES_DB']
        )
        return conn
    except psycopg2.OperationalError as e:
        print(f"Error connecting to PostgreSQL: {e}")
        return None

# --- AUTHENTICATION DECORATOR ---
# This decorator protects routes, ensuring only authenticated users can access them.
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        # Get the token from the request headers
        token = None
        if 'Authorization' in request.headers:
            token = request.headers['Authorization'].split(" ")[1] # "Bearer <token>"

        print(f"Token received in request: {token}")

        if not token:
            print("Token is missing from Authorization header.")
            return jsonify({'message': 'Token is missing!'}), 401

        conn = get_db_connection()
        if conn is None:
            print("Database connection failed during token validation.")
            return jsonify({'message': 'Database connection error.'}), 500

        try:
            cur = conn.cursor()
            # Check for the token in the database
            cur.execute("SELECT user_id, created_at FROM api_tokens WHERE token = %s", (token,))
            result = cur.fetchone()
            cur.close()

            if not result:
                print(f"Token '{token}' not found in database.")
                return jsonify({'message': 'Token is invalid or expired!'}), 401

            user_id, created_at = result
            # Ensure both datetimes are timezone-aware or naive for a reliable comparison
            now = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0)
            created_at_aware = created_at.astimezone(datetime.timezone.utc).replace(microsecond=0)
            
            if now - created_at_aware > timedelta(hours=24):
                print(f"Token '{token}' is expired. Created at: {created_at_aware}, now: {now}")
                return jsonify({'message': 'Token is invalid or expired!'}), 401
            
            print(f"Token '{token}' is valid for user ID: {user_id}")
            # Pass the user_id to the decorated function
            return f(user_id, *args, **kwargs)
        except Exception as e:
            print(f"Error validating token: {e}")
            return jsonify({'message': 'An error occurred during token validation.'}), 500
        finally:
            if conn:
                conn.close()

    return decorated

# --- DATABASE SETUP ---
def setup_database():
    """
    Creates the necessary tables if they don't already exist.
    """
    conn = get_db_connection()
    if conn is None:
        print("Could not connect to database for setup.")
        return

    try:
        cur = conn.cursor()
        # Create users table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                user_id VARCHAR(255) PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL
            )
        """)
        # Create a new table to store persistent API tokens
        cur.execute("""
            CREATE TABLE IF NOT EXISTS api_tokens (
                token VARCHAR(255) PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL UNIQUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            )
        """)
        # Create incidents table with 'image_url' and ensure 'created_at' is TIMESTAMP WITH TIME ZONE
        cur.execute("""
            CREATE TABLE IF NOT EXISTS incidents (
                incident_id VARCHAR(255) PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                lat VARCHAR(255) NOT NULL,
                long VARCHAR(255) NOT NULL,
                image_url VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            )
        """)
        conn.commit()
        cur.close()
        print("Database tables checked/created successfully.")
    except Exception as e:
        print(f"Error setting up database: {e}")
        conn.rollback()
    finally:
        if conn:
            conn.close()

# This will run once when the app starts
with app.app_context():
    setup_database()


# --- AUTHENTICATION ROUTES ---

# User Registration
@app.route('/register', methods=['POST'])
def register():
    """
    Registers a new user.
    Expects JSON data with 'username' and 'password'.
    """
    conn = get_db_connection()
    if conn is None:
        return jsonify({'message': 'Database connection error.'}), 500

    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            return jsonify({'message': 'Username and password are required.'}), 400

        cur = conn.cursor()
        
        # Check if user already exists
        cur.execute("SELECT user_id FROM users WHERE username = %s", (username,))
        user = cur.fetchone()
        if user:
            cur.close()
            return jsonify({'message': 'User already exists.'}), 409

        # Create a new user entry
        user_id = str(uuid.uuid4())
        hashed_password = generate_password_hash(password, method='scrypt')
        cur.execute("INSERT INTO users (user_id, username, password_hash) VALUES (%s, %s, %s)",
                    (user_id, username, hashed_password))
        conn.commit()
        cur.close()
        return jsonify({'message': 'User created successfully.', 'user_id': user_id}), 201

    except Exception as e:
        print(f"Error during registration: {e}")
        conn.rollback()
        return jsonify({'message': 'An error occurred during registration.'}), 500
    finally:
        if conn:
            conn.close()

# User Login
@app.route('/login', methods=['POST'])
def login():
    """
    Logs in a user and returns an authentication token.
    Expects JSON data with 'username' and 'password'.
    """
    conn = get_db_connection()
    if conn is None: # Corrected from `conn === None`
        return jsonify({'message': 'Database connection error.'}), 500
        
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            return jsonify({'message': 'Username and password are required.'}), 400

        cur = conn.cursor()
        cur.execute("SELECT user_id, password_hash FROM users WHERE username = %s", (username,))
        user_data = cur.fetchone()
        
        if not user_data or not check_password_hash(user_data[1], password):
            cur.close()
            return jsonify({'message': 'Invalid username or password.'}), 401
        
        user_id = user_data[0]
        
        # Delete any old tokens for this user before creating a new one
        cur.execute("DELETE FROM api_tokens WHERE user_id = %s", (user_id,))
        
        # Generate a new token and store it in the database
        token = str(uuid.uuid4())
        cur.execute("INSERT INTO api_tokens (token, user_id) VALUES (%s, %s)", (token, user_id))
        conn.commit()
        cur.close()
        
        return jsonify({'message': 'Login successful.', 'token': token, 'user_id': user_id, 'username': username}), 200

    except Exception as e:
        print(f"Error during login: {e}")
        return jsonify({'message': 'An error occurred during login.'}), 500
    finally:
        if conn:
            conn.close()

# User Logout
@app.route('/logout', methods=['POST'])
@token_required
def logout(user_id):
    """
    Logs out the authenticated user by deleting their token.
    """
    conn = get_db_connection()
    if conn is None:
        return jsonify({'message': 'Database connection error.'}), 500
        
    try:
        token = request.headers['Authorization'].split(" ")[1]
        cur = conn.cursor()
        cur.execute("DELETE FROM api_tokens WHERE user_id = %s AND token = %s", (user_id, token))
        conn.commit()
        cur.close()

        return jsonify({'message': 'Logout successful.'}), 200
    except Exception as e:
        print(f"Error during logout: {e}")
        return jsonify({'message': 'An error occurred during logout.'}), 500
    finally:
        if conn:
            conn.close()


# --- INCIDENT ROUTES ---

# Create an incident
@app.route('/incidents', methods=['POST'])
@token_required
def create_incident(user_id):
    """
    Creates a new incident report for the authenticated user.
    Now handles multipart/form-data with an image file and optional created_at timestamp.
    """
    conn = get_db_connection()
    if conn is None:
        return jsonify({'message': 'Database connection error.'}), 500
        
    try:
        # Access form data from request.form
        title = request.form.get('title')
        description = request.form.get('description')
        lat = request.form.get('lat')
        long = request.form.get('long')
        # Get created_at from frontend. It will be an ISO 8601 string.
        created_at_str = request.form.get('created_at') 

        if not all([title, description, lat, long]):
            return jsonify({'message': 'All required fields (title, description, lat, long) are missing.'}), 400

        image_url = None
        if 'image' in request.files:
            file = request.files['image']
            if file and allowed_file(file.filename):
                # Secure the filename to prevent malicious file uploads
                filename = secure_filename(file.filename)
                # Create a unique filename to prevent overwriting existing files
                unique_filename = str(uuid.uuid4()) + "_" + filename
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
                file.save(filepath)
                image_url = f"/uploads/{unique_filename}"
            else:
                return jsonify({'message': 'Invalid file type.'}), 400

        incident_id = str(uuid.uuid4())
        cur = conn.cursor()

        # Use the provided created_at timestamp, otherwise let the database default
        if created_at_str:
            try:
                # Parse the ISO 8601 string into a datetime object
                # Python's datetime.fromisoformat handles 'Z' for UTC
                # It expects 'Z' to be replaced with '+00:00' for direct parsing
                created_at_dt = datetime.datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
            except ValueError:
                # Fallback if the format is not strictly ISO 8601
                print(f"Warning: Could not parse created_at_str '{created_at_str}'. Using default timestamp.")
                created_at_dt = None
        else:
            created_at_dt = None # Let database use default CURRENT_TIMESTAMP

        if created_at_dt:
            cur.execute("""
                INSERT INTO incidents (incident_id, user_id, title, description, lat, long, image_url, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (incident_id, user_id, title, description, lat, long, image_url, created_at_dt))
        else:
            cur.execute("""
                INSERT INTO incidents (incident_id, user_id, title, description, lat, long, image_url)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (incident_id, user_id, title, description, lat, long, image_url))


        conn.commit()
        cur.close()

        # Fetch the created incident to return it in the response
        cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cur.execute("SELECT * FROM incidents WHERE incident_id = %s", (incident_id,))
        incident = dict(cur.fetchone())
        cur.close()

        # Ensure created_at is formatted as a string for JSON response
        if 'created_at' in incident and incident['created_at']:
            incident['created_at'] = incident['created_at'].isoformat()

        return jsonify({'message': 'Incident created successfully.', 'incident': incident}), 201

    except Exception as e:
        print(f"Error creating incident: {e}")
        conn.rollback()
        return jsonify({'message': 'An error occurred while creating the incident.'}), 500
    finally:
        if conn:
            conn.close()

# Get all incidents
@app.route('/incidents', methods=['GET'])
@token_required
def get_all_incidents(user_id):
    """
    Retrieves all incident reports.
    """
    conn = get_db_connection()
    if conn is None:
        return jsonify({'message': 'Database connection error.'}), 500

    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        # Order by created_at in descending order to show most recent first
        cur.execute("SELECT * FROM incidents ORDER BY created_at DESC")
        incidents = []
        for row in cur.fetchall():
            incident_dict = dict(row)
            # Convert datetime objects to ISO format strings for JSON serialization
            if 'created_at' in incident_dict and incident_dict['created_at']:
                incident_dict['created_at'] = incident_dict['created_at'].isoformat()
            incidents.append(incident_dict)
        cur.close()
        return jsonify(incidents), 200
    except Exception as e:
        print(f"Error fetching all incidents: {e}")
        return jsonify({'message': 'An error occurred while fetching incidents.'}), 500
    finally:
        if conn:
            conn.close()

# Get a single incident
@app.route('/incidents/<incident_id>', methods=['GET'])
@token_required
def get_incident(user_id, incident_id):
    """
    Retrieves a single incident report by its ID.
    """
    conn = get_db_connection()
    if conn is None:
        return jsonify({'message': 'Database connection error.'}), 500
        
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cur.execute("SELECT * FROM incidents WHERE incident_id = %s", (incident_id,))
        incident = cur.fetchone()
        cur.close()
        
        if not incident:
            return jsonify({'message': 'Incident not found.'}), 404
        
        incident_dict = dict(incident)
        if 'created_at' in incident_dict and incident_dict['created_at']:
            incident_dict['created_at'] = incident_dict['created_at'].isoformat()
        
        return jsonify(incident_dict), 200
    except Exception as e:
        print(f"Error fetching incident: {e}")
        return jsonify({'message': 'An error occurred while fetching the incident.'}), 500
    finally:
        if conn:
            conn.close()

# Update an incident
@app.route('/incidents/<incident_id>', methods=['PUT'])
@token_required
def update_incident(user_id, incident_id):
    """
    Updates an existing incident report.
    Only the user who created the incident can update it.
    Now handles multipart/form-data with an optional image file.
    """
    conn = get_db_connection()
    if conn is None:
        return jsonify({'message': 'Database connection error.'}), 500
        
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cur.execute("SELECT user_id FROM incidents WHERE incident_id = %s", (incident_id,))
        incident = cur.fetchone()
        
        if not incident:
            cur.close()
            return jsonify({'message': 'Incident not found.'}), 404
            
        # Check if the user is the owner of the incident
        if incident['user_id'] != user_id:
            cur.close()
            return jsonify({'message': 'You do not have permission to update this incident.'}), 403

        # Access form data from request.form
        title = request.form.get('title')
        description = request.form.get('description')
        lat = request.form.get('lat')
        long = request.form.get('long')
        # created_at_str from frontend for update is not typically handled this way
        # as created_at is usually set once. If you need to update it,
        # you'd add similar parsing logic as in create_incident.

        image_url = None
        if 'image' in request.files:
            file = request.files['image']
            if file and allowed_file(file.filename):
                filename = secure_filename(file.filename)
                unique_filename = str(uuid.uuid4()) + "_" + filename
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
                file.save(filepath)
                image_url = f"/uploads/{unique_filename}"

        # Build the update query dynamically
        update_fields = []
        update_values = []
        if title is not None:
            update_fields.append("title = %s")
            update_values.append(title)
        if description is not None:
            update_fields.append("description = %s")
            update_values.append(description)
        if lat is not None:
            update_fields.append("lat = %s")
            update_values.append(lat)
        if long is not None:
            update_fields.append("long = %s")
            update_values.append(long)
        if image_url is not None:
            update_fields.append("image_url = %s")
            update_values.append(image_url)
        
        if not update_fields:
            return jsonify({'message': 'No fields provided for update.'}), 400

        query = f"UPDATE incidents SET {', '.join(update_fields)} WHERE incident_id=%s"
        update_values.append(incident_id)

        cur.execute(query, tuple(update_values))
        conn.commit()
        cur.close()

        cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cur.execute("SELECT * FROM incidents WHERE incident_id = %s", (incident_id,))
        updated_incident = cur.fetchone()
        cur.close()

        # Ensure created_at is formatted as a string for JSON response
        if 'created_at' in updated_incident and updated_incident['created_at']:
            updated_incident['created_at'] = updated_incident['created_at'].isoformat()

        return jsonify({'message': 'Incident updated successfully.', 'incident': dict(updated_incident)}), 200
    except Exception as e:
        print(f"Error updating incident: {e}")
        conn.rollback()
        return jsonify({'message': 'An error occurred while updating the incident.'}), 500
    finally:
        if conn:
            conn.close()

# Delete an incident
@app.route('/incidents/<incident_id>', methods=['DELETE'])
@token_required
def delete_incident(user_id, incident_id):
    """
    Deletes an existing incident report.
    Now, any authenticated user can delete any incident.
    """
    conn = get_db_connection()
    if conn is None:
        return jsonify({'message': 'Database connection error.'}), 500
        
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cur.execute("SELECT incident_id FROM incidents WHERE incident_id = %s", (incident_id,))
        incident = cur.fetchone()

        if not incident:
            cur.close()
            return jsonify({'message': 'Incident not found.'}), 404

        # REMOVED: Ownership check. Any authenticated user can now delete.
        # The following lines were removed to allow any authenticated user to delete:
        # if incident['user_id'] != user_id:
        #     cur.close()
        #     return jsonify({'message': 'You do not have permission to delete this incident.'}), 403
        
        cur.execute("DELETE FROM incidents WHERE incident_id = %s", (incident_id,))
        conn.commit()
        cur.close()

        return jsonify({'message': 'Incident deleted successfully.'}), 200
    except Exception as e:
        print(f"Error deleting incident: {e}")
        conn.rollback()
        return jsonify({'message': 'An error occurred while deleting the incident.'}), 500
    finally:
        if conn:
            conn.close()

# --- NEW STATIC FILE ROUTE ---
@app.route('/uploads/<filename>')
def uploaded_file(filename):
    """
    Serves uploaded images from the UPLOAD_FOLDER.
    """
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# Run the app if this file is executed directly
if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=True, port=5000)