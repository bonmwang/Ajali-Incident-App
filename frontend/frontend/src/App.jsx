import React, { useState, useEffect, useCallback } from "react"; // Added useCallback

// Main App Component
const App = () => {
  // State for user authentication: stores the token and user data
  const [auth, setAuth] = useState(null);
  const [page, setPage] = useState("login"); // 'login', 'register', 'home', 'add-incident', 'all-incidents'
  const [incidents, setIncidents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const API_BASE_URL = "http://localhost:5000";

  // Function to fetch all incidents - Wrapped in useCallback for useEffect dependency
  const fetchIncidents = useCallback(async () => {
    if (!auth || !auth.token) {
      // Ensure auth.token exists before fetching
      setIsLoading(false);
      // If not authenticated, clear incidents to prevent stale data
      setIncidents([]);
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/incidents`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${auth.token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch incidents.");
      }

      const data = await response.json();
      setIncidents(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [auth, API_BASE_URL, setIncidents, setIsLoading, setError]); // Dependency on auth, API_BASE_URL, setIncidents, setIsLoading, setError

  useEffect(() => {
    // Fetch incidents when authenticated and on 'home' or 'all-incidents' page
    // Added fetchIncidents to the dependency array to resolve the ESLint warning
    if (auth && (page === "all-incidents" || page === "home")) {
      fetchIncidents();
    }
  }, [auth, page, fetchIncidents]);

  // Function to handle logout
  const handleLogout = async () => {
    if (!auth) return;
    try {
      await fetch(`${API_BASE_URL}/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.token}`,
          "Content-Type": "application/json",
        },
      });
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      // Clear all auth state regardless of whether the API call succeeded
      setAuth(null);
      setPage("login");
      setIncidents([]);
      setError("");
    }
  };

  // Function to render the main pages based on the 'page' state
  const renderPage = () => {
    switch (page) {
      case "register":
        return <Register setPage={setPage} />;
      case "home":
        return (
          <Home incidents={incidents} isLoading={isLoading} error={error} />
        );
      case "add-incident":
        return (
          <AddIncidentPage
            auth={auth}
            fetchIncidents={fetchIncidents}
            setPage={setPage}
          />
        );
      case "all-incidents":
        return (
          <ViewIncidentsPage
            incidents={incidents}
            isLoading={isLoading}
            error={error}
            auth={auth}
            fetchIncidents={fetchIncidents}
            setIncidents={setIncidents} // Pass setIncidents down to ViewIncidentsPage
            setIsLoading={setIsLoading} // Pass setIsLoading down
            setError={setError} // Pass setError down
          />
        );
      case "login":
      default:
        return <Login setAuth={setAuth} setPage={setPage} />;
    }
  };

  return (
    // The main container now uses h-screen and flex-col to occupy the whole page
    <div className="h-screen bg-slate-900 flex flex-col items-center justify-center font-sans">
      {/* The inner container now has no max-width to expand to the full screen */}
      <div className="w-full h-full bg-slate-800 text-slate-200 p-6 sm:p-10 md:p-14 rounded-none shadow-none space-y-12 border-none transition-all duration-300">
        <header className="text-center">
          {/* Increased font size and boldness for the main title */}
          <h1 className="text-8xl font-extrabold text-white tracking-tight leading-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-sky-500">
              Ajali Report App
            </span>
          </h1>
          {/* Increased font size for the welcome username */}
          {auth && (
            <p className="text-3xl text-slate-400 mt-3 font-medium">
              Welcome,{" "}
              <span className="font-semibold text-teal-400">
                {auth.username}
              </span>
              !
            </p>
          )}
        </header>

        {/* Navigation tabs appear only when the user is logged in */}
        {auth && (
          <nav className="flex justify-center space-x-4 border-b border-slate-700 pb-4">
            <button
              onClick={() => setPage("home")}
              className={`px-6 py-2 rounded-full font-bold transition-all duration-300 ${
                page === "home"
                  ? "bg-sky-500 text-white shadow-lg"
                  : "text-slate-400 hover:text-white hover:bg-slate-700"
              }`}
            >
              Home
            </button>
            <button
              onClick={() => setPage("add-incident")}
              className={`px-6 py-2 rounded-full font-bold transition-all duration-300 ${
                page === "add-incident"
                  ? "bg-sky-500 text-white shadow-lg"
                  : "text-slate-400 hover:text-white hover:bg-slate-700"
              }`}
            >
              Add Incident
            </button>
            <button
              onClick={() => setPage("all-incidents")}
              className={`px-6 py-2 rounded-full font-bold transition-all duration-300 ${
                page === "all-incidents"
                  ? "bg-sky-500 text-white shadow-lg"
                  : "text-slate-400 hover:text-white hover:bg-slate-700"
              }`}
            >
              All Incidents
            </button>
            <button
              onClick={handleLogout}
              className="px-6 py-2 rounded-full font-bold transition-all duration-300 bg-rose-500 text-white hover:bg-rose-600"
            >
              Logout
            </button>
          </nav>
        )}

        {renderPage()}
      </div>
    </div>
  );
};

// --- Updated Home Component to display all incidents ---
const Home = ({ incidents, isLoading, error }) => {
  return (
    <div className="space-y-8 text-center">
      <h2 className="text-4xl font-bold text-center text-slate-100">
        About Ajali Report App
      </h2>
      <p className="text-lg text-slate-400 leading-relaxed">
        Ajali is a Swahili word for "accident" or "incident." This application
        is a platform designed to help users report and track various incidents
        by providing a title, description, location coordinates (latitude and
        longitude), and an optional image.
      </p>
      <p className="text-lg text-slate-400 leading-relaxed mb-8">
        With this app, you can easily log incidents and view a centralized list
        of all reported events. It aims to create a community-driven database
        for public awareness and record-keeping. Whether it's a road accident, a
        maintenance issue, or any other notable event, Ajali Report App makes it
        simple to report and share the details.
      </p>

      <h2 className="text-4xl font-extrabold text-white text-center mt-10">
        Recent Incidents
      </h2>
      {isLoading ? (
        <p className="text-center text-slate-400">Loading incidents...</p>
      ) : error ? (
        <p className="text-rose-400 text-center">Error: {error}</p>
      ) : (
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {incidents.length > 0 ? (
            incidents.map((incident) => (
              <div
                key={incident.incident_id}
                className="bg-slate-700 p-6 rounded-2xl shadow-xl hover:shadow-2xl hover:shadow-sky-500/20 transition-all duration-300 border border-slate-600"
              >
                <h3 className="font-extrabold text-xl text-sky-400">
                  {incident.title}
                </h3>
                <p className="text-sm text-slate-400 mt-2">
                  {incident.description}
                </p>
                <div className="flex items-center text-xs text-slate-500 mt-4 space-x-4">
                  <span>
                    <span className="font-semibold text-slate-300">Lat:</span>{" "}
                    {incident.lat}
                  </span>
                  <span>
                    <span className="font-semibold text-slate-300">Long:</span>{" "}
                    {incident.long}
                  </span>
                  {/* Display created_at timestamp */}
                  {incident.created_at && (
                    <span className="ml-auto text-slate-400 text-xs">
                      {new Date(incident.created_at).toLocaleString()}
                    </span>
                  )}
                </div>
                {incident.image_url && (
                  <img
                    src={`http://localhost:5000${incident.image_url}`}
                    alt={incident.title}
                    className="mt-4 w-full h-40 object-cover rounded-xl shadow-lg border border-slate-600"
                  />
                )}
              </div>
            ))
          ) : (
            <p className="text-center text-slate-400 col-span-full">
              No incidents have been reported yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// Login Component
const Login = ({ setAuth, setPage }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const API_BASE_URL = "http://localhost:5000";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || "Login failed.");
      }

      const data = await response.json();
      setAuth({
        token: data.token,
        user_id: data.user_id,
        username: data.username,
      });
      setPage("all-incidents");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // Adjusted styling for the Login component to be a contained box
    <div className="flex items-center justify-center w-full h-full">
      <div className="w-full max-w-md bg-slate-800 text-slate-200 p-8 rounded-2xl shadow-xl space-y-8 border border-slate-700">
        <h2 className="text-4xl font-bold text-center text-slate-100">
          Login to Your Account
        </h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            required
            className="w-full p-4 bg-slate-700 text-white border-2 border-slate-600 rounded-xl shadow-lg focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500 transition-all duration-300"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            className="w-full p-4 bg-slate-700 text-white border-2 border-slate-600 rounded-xl shadow-lg focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500 transition-all duration-300"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="w-full p-4 bg-sky-600 text-white font-extrabold rounded-xl shadow-lg hover:bg-sky-700 transition-all duration-300 disabled:bg-slate-600 disabled:cursor-not-allowed transform hover:scale-105"
          >
            {isLoading ? "Logging In..." : "Login"}
          </button>
        </form>
        {error && <p className="text-rose-400 text-center">{error}</p>}
        <p className="text-center text-slate-400">
          Don't have an account?{" "}
          <button
            onClick={() => setPage("register")}
            className="text-teal-400 font-bold hover:underline transition-colors duration-300"
          >
            Register here
          </button>
        </p>
      </div>
    </div>
  );
};

// Registration Component
const Register = ({ setPage }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const API_BASE_URL = "http://localhost:5000";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${API_BASE_URL}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Registration failed.");
      }

      setMessage(data.message + " You can now log in.");
      setUsername("");
      setPassword("");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // Adjusted styling for the Register component to be a contained box
    <div className="flex items-center justify-center w-full h-full">
      <div className="w-full max-w-md bg-slate-800 text-slate-200 p-8 rounded-2xl shadow-xl space-y-8 border border-slate-700">
        <h2 className="text-4xl font-bold text-center text-slate-100">
          Create an Account
        </h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            required
            className="w-full p-4 bg-slate-700 text-white border-2 border-slate-600 rounded-xl shadow-lg focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500 transition-all duration-300"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            className="w-full p-4 bg-slate-700 text-white border-2 border-slate-600 rounded-xl shadow-lg focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500 transition-all duration-300"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="w-full p-4 bg-teal-500 text-white font-extrabold rounded-xl shadow-lg hover:bg-teal-600 transition-all duration-300 disabled:bg-slate-600 disabled:cursor-not-allowed transform hover:scale-105"
          >
            {isLoading ? "Registering..." : "Register"}
          </button>
        </form>
        {message && <p className="text-teal-400 text-center">{message}</p>}
        {error && <p className="text-rose-400 text-center">{error}</p>}
        <p className="text-center text-slate-400">
          Already have an account?{" "}
          <button
            onClick={() => setPage("login")}
            className="text-sky-400 font-bold hover:underline transition-colors duration-300"
          >
            Login here
          </button>
        </p>
      </div>
    </div>
  );
};

// --- New AddIncidentPage Component ---
const AddIncidentPage = ({ auth, fetchIncidents, setPage }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [lat, setLat] = useState("");
  const [long, setLong] = useState("");
  const [placeName, setPlaceName] = useState("");
  const [incidentDate, setIncidentDate] = useState(""); // New state for incident date
  const [incidentTime, setIncidentTime] = useState(""); // New state for incident time
  const [image, setImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const API_BASE_URL = "http://localhost:5000";

  const handleFileChange = (e) => {
    setImage(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);
    formData.append("lat", lat);
    formData.append("long", long);
    if (image) {
      formData.append("image", image);
    }

    // Combine date and time into a single timestamp string (ISO 8601 format)
    if (incidentDate && incidentTime) {
      const dateTimeString = `${incidentDate}T${incidentTime}:00Z`; // Assuming UTC for simplicity
      formData.append("created_at", dateTimeString);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/incidents`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || "Failed to create incident.");
      }

      await fetchIncidents(); // Refresh the list of incidents
      setPage("all-incidents"); // Navigate to the incidents page
      setTitle("");
      setDescription("");
      setLat("");
      setLong("");
      setPlaceName("");
      setIncidentDate(""); // Clear date input
      setIncidentTime(""); // Clear time input
      setImage(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocationLookup = async () => {
    if (!placeName) {
      setError("Please enter a place name to search.");
      return;
    }
    setIsLoading(true);
    setError("");
    // Placeholder for a real geocoding API call
    // In a real application, you would use an API like Google Maps Geocoding API
    // or OpenStreetMap Nominatim.
    console.log(`Searching for coordinates for: ${placeName}`);
    try {
      // Simulate an API call with a short delay
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // Hardcoded example data
      const locations = {
        "eiffel tower, paris": { lat: "48.8584", long: "2.2945" },
        "new york city": { lat: "40.7128", long: "-74.0060" },
        "tokyo, japan": { lat: "35.6895", long: "139.6917" },
      };
      const searchResult = locations[placeName.toLowerCase()];
      if (searchResult) {
        setLat(searchResult.lat);
        setLong(searchResult.long);
      } else {
        setError("Location not found. Please try a different place name.");
      }
    } catch (err) {
      setError("An error occurred during location lookup.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-slate-700 p-8 rounded-2xl shadow-inner-lg space-y-6 border border-slate-600">
      <h3 className="text-2xl font-bold text-white text-center">
        Report a New Incident
      </h3>
      <div className="space-y-4">
        <h4 className="text-xl font-bold text-sky-400">Location Lookup</h4>
        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
          <input
            type="text"
            value={placeName}
            onChange={(e) => setPlaceName(e.target.value)}
            placeholder="Search for a place name"
            className="w-full p-4 bg-slate-800 text-white border-2 border-slate-700 rounded-xl shadow-md focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500 transition-all duration-300"
          />
          <button
            type="button"
            onClick={handleLocationLookup}
            disabled={isLoading}
            className="px-6 py-4 bg-sky-500 text-white font-bold rounded-xl shadow-lg hover:bg-sky-600 transition-all duration-300 disabled:bg-slate-600 disabled:cursor-not-allowed transform hover:scale-105"
          >
            {isLoading ? "Searching..." : "Find Location"}
          </button>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          required
          className="w-full p-4 bg-slate-800 text-white border-2 border-slate-700 rounded-xl shadow-md focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500 transition-all duration-300"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          required
          className="w-full p-4 bg-slate-800 text-white border-2 border-slate-700 rounded-xl shadow-md focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500 transition-all duration-300"
          rows="3"
        />
        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
          <input
            type="text"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="Latitude"
            required
            className="w-full sm:w-1/2 p-4 bg-slate-800 text-white border-2 border-slate-700 rounded-xl shadow-md focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500 transition-all duration-300"
          />
          <input
            type="text"
            value={long}
            onChange={(e) => setLong(e.target.value)}
            placeholder="Longitude"
            required
            className="w-full sm:w-1/2 p-4 bg-slate-800 text-white border-2 border-slate-700 rounded-xl shadow-md focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500 transition-all duration-300"
          />
        </div>
        {/* New Date and Time inputs */}
        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
          <label className="block text-slate-400 font-semibold w-full sm:w-1/2">
            Date of Incident:
            <input
              type="date"
              value={incidentDate}
              onChange={(e) => setIncidentDate(e.target.value)}
              required
              className="w-full p-4 bg-slate-800 text-white border-2 border-slate-700 rounded-xl shadow-md focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500 transition-all duration-300 mt-1"
            />
          </label>
          <label className="block text-slate-400 font-semibold w-full sm:w-1/2">
            Time of Incident:
            <input
              type="time"
              value={incidentTime}
              onChange={(e) => setIncidentTime(e.target.value)}
              required
              className="w-full p-4 bg-slate-800 text-white border-2 border-slate-700 rounded-xl shadow-md focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500 transition-all duration-300 mt-1"
            />
          </label>
        </div>
        <label className="block text-slate-400 font-semibold">
          Upload an image:
          <input
            type="file"
            onChange={handleFileChange}
            accept="image/*"
            className="w-full p-3 mt-1 text-white border-2 border-slate-700 rounded-xl file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-sky-500 file:text-white hover:file:bg-sky-600 transition-colors duration-300"
          />
        </label>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full p-4 bg-teal-500 text-white font-extrabold rounded-xl shadow-lg hover:bg-teal-600 transition-all duration-300 disabled:bg-slate-600 disabled:cursor-not-allowed transform hover:scale-105"
        >
          {isLoading ? "Submitting..." : "Submit Incident"}
        </button>
      </form>
      {error && <p className="text-rose-400 text-center">{error}</p>}
    </div>
  );
};

// --- Renamed and Refactored Incidents Component to ViewIncidentsPage ---
const ViewIncidentsPage = ({
  incidents,
  isLoading,
  error,
  auth,
  fetchIncidents,
  setIncidents,
  setIsLoading,
  setError,
}) => {
  // Added setIsLoading and setError props
  const [editingIncident, setEditingIncident] = useState(null); // State for the incident being edited
  const [incidentToDelete, setIncidentToDelete] = useState(null); // State for the incident to be deleted
  const API_BASE_URL = "http://localhost:5000"; // Re-added API_BASE_URL for the DELETE call

  // Modified deleteIncident to perform a hard delete on the backend
  const deleteIncident = async (incident_id) => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/incidents/${incident_id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${auth.token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || "Failed to delete incident.");
      }

      // After successful deletion from backend, re-fetch all incidents to update UI
      await fetchIncidents();
      setIncidentToDelete(null); // Close the confirmation modal
    } catch (err) {
      setError(err.message);
      console.error("Error deleting incident:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const ConfirmDeleteModal = ({ incident, onConfirm, onCancel }) => {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
        <div className="bg-slate-800 p-8 rounded-xl shadow-lg border border-slate-700 w-96 text-center space-y-6">
          <p className="text-xl font-semibold text-white">
            Are you sure you want to delete this incident?
          </p>
          <p className="text-md text-slate-400">
            This action cannot be undone.
          </p>
          <div className="flex justify-center space-x-4">
            <button
              onClick={() => onConfirm(incident.incident_id)}
              className="px-6 py-2 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 transition-all duration-300 transform hover:scale-105"
            >
              Delete
            </button>
            <button
              onClick={onCancel}
              className="px-6 py-2 bg-slate-600 text-white font-bold rounded-lg hover:bg-slate-700 transition-all duration-300 transform hover:scale-105"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  // No longer filtering by is_deleted as we are performing hard deletes
  // and the Home tab will show all incidents fetched from the backend.
  const displayIncidents = incidents;

  return (
    <div className="space-y-10">
      <h2 className="text-4xl font-extrabold text-white text-center">
        All Incidents
      </h2>

      {editingIncident && (
        <EditIncidentForm
          auth={auth}
          incident={editingIncident}
          fetchIncidents={fetchIncidents}
          setEditingIncident={setEditingIncident}
        />
      )}
      {incidentToDelete && (
        <ConfirmDeleteModal
          incident={incidentToDelete}
          onConfirm={deleteIncident}
          onCancel={() => setIncidentToDelete(null)}
        />
      )}

      {isLoading ? (
        <p className="text-center text-slate-400">Loading incidents...</p>
      ) : error ? (
        <p className="text-rose-400 text-center">Error: {error}</p>
      ) : (
        <>
          <IncidentMap incidents={displayIncidents} />{" "}
          {/* Pass all incidents to map */}
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {displayIncidents.length > 0 ? (
              displayIncidents.map((incident) => (
                <div
                  key={incident.incident_id}
                  className="bg-slate-700 p-6 rounded-2xl shadow-xl hover:shadow-2xl hover:shadow-sky-500/20 transition-all duration-300 border border-slate-600"
                >
                  <h3 className="font-extrabold text-xl text-sky-400">
                    {incident.title}
                  </h3>
                  <p className="text-sm text-slate-400 mt-2">
                    {incident.description}
                  </p>
                  <div className="flex items-center text-xs text-slate-500 mt-4 space-x-4">
                    <span>
                      <span className="font-semibold text-slate-300">Lat:</span>{" "}
                      {incident.lat}
                    </span>
                    <span>
                      <span className="font-semibold text-slate-300">
                        Long:
                      </span>{" "}
                      {incident.long}
                    </span>
                    {/* Display created_at timestamp */}
                    {incident.created_at && (
                      <span className="ml-auto text-slate-400 text-xs">
                        {new Date(incident.created_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                  {incident.image_url && (
                    <img
                      src={`http://localhost:5000${incident.image_url}`}
                      alt={incident.title}
                      className="mt-4 w-full h-40 object-cover rounded-xl shadow-lg border border-slate-600"
                    />
                  )}
                  {/* Buttons for editing and deleting - now always visible if authenticated */}
                  {auth && ( // Ensure user is authenticated to see these buttons
                    <div className="flex space-x-2 mt-4">
                      <button
                        onClick={() => setEditingIncident(incident)}
                        className="w-full p-2 bg-yellow-500 text-slate-900 font-bold rounded-lg shadow-md hover:bg-yellow-600 transition-colors duration-300 transform hover:scale-105"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setIncidentToDelete(incident)}
                        className="w-full p-2 bg-rose-500 text-white font-bold rounded-lg shadow-md hover:bg-rose-600 transition-colors duration-300 transform hover:scale-105"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-center text-slate-400 col-span-full">
                No active incidents found.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// EditIncidentForm Component (remains the same)
const EditIncidentForm = ({
  auth,
  incident,
  fetchIncidents,
  setEditingIncident,
}) => {
  const [title, setTitle] = useState(incident.title);
  const [description, setDescription] = useState(incident.description);
  const [lat, setLat] = useState(incident.lat);
  const [long, setLong] = useState(incident.long);
  const [image, setImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const API_BASE_URL = "http://localhost:5000";

  const handleFileChange = (e) => {
    setImage(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);
    formData.append("lat", lat);
    formData.append("long", long);
    if (image) {
      formData.append("image", image);
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/incidents/${incident.incident_id}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${auth.token}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || "Failed to update incident.");
      }

      await fetchIncidents(); // Refresh the list of incidents
      setEditingIncident(null); // Close the form
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-slate-700 p-8 rounded-2xl shadow-inner-lg space-y-6 border border-slate-600">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-2xl font-bold text-white">Edit Incident</h3>
        <button
          onClick={() => setEditingIncident(null)}
          className="text-rose-400 hover:text-rose-500 font-bold transition-colors duration-300"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-7 w-7"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          required
          className="w-full p-4 bg-slate-800 text-white border-2 border-slate-700 rounded-xl shadow-md focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500 transition-all duration-300"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          required
          className="w-full p-4 bg-slate-800 text-white border-2 border-slate-700 rounded-xl shadow-md focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500 transition-all duration-300"
          rows="3"
        />
        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
          <input
            type="text"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="Latitude"
            required
            className="w-full sm:w-1/2 p-4 bg-slate-800 text-white border-2 border-slate-700 rounded-xl shadow-md focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500 transition-all duration-300"
          />
          <input
            type="text"
            value={long}
            onChange={(e) => setLong(e.target.value)}
            placeholder="Longitude"
            required
            className="w-full sm:w-1/2 p-4 bg-slate-800 text-white border-2 border-slate-700 rounded-xl shadow-md focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500 transition-all duration-300"
          />
        </div>
        <label className="block text-slate-400 font-semibold">
          Update image (optional):
          <input
            type="file"
            onChange={handleFileChange}
            accept="image/*"
            className="w-full p-3 mt-1 text-white border-2 border-slate-700 rounded-xl file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-sky-500 file:text-white hover:file:bg-sky-600 transition-colors duration-300"
          />
        </label>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full p-4 bg-yellow-500 text-slate-900 font-extrabold rounded-xl shadow-lg hover:bg-yellow-600 transition-all duration-300 disabled:bg-slate-600 disabled:cursor-not-allowed transform hover:scale-105"
        >
          {isLoading ? "Updating..." : "Update Incident"}
        </button>
      </form>
      {error && <p className="text-rose-400 text-center">{error}</p>}
    </div>
  );
};

// IncidentMap Component (remains the same)
const IncidentMap = ({ incidents }) => {
  return (
    <div className="bg-slate-700 p-8 rounded-2xl shadow-xl border border-slate-600 space-y-6">
      <h3 className="text-3xl font-bold text-white text-center">
        Incident Locations
      </h3>
      {incidents.length > 0 ? (
        <div className="space-y-4">
          {incidents.map((incident) => (
            <div
              key={incident.incident_id}
              className="p-4 bg-slate-800 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300"
            >
              <p className="text-lg font-semibold text-sky-400">
                {incident.title}
              </p>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${incident.lat},${incident.long}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-teal-400 hover:underline transition-colors duration-300"
              >
                View on Google Maps
              </a>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-slate-400">
          No incident locations to display.
        </p>
      )}
    </div>
  );
};

export default App;
