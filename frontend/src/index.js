import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Create a root instance for concurrent mode
const root = ReactDOM.createRoot(document.getElementById('root'));

// Render the App component into the root
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

