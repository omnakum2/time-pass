import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { connect } from './net/socket';

// Invariant: a browser refresh/close must NEVER send `leaveRoom` — the socket simply
// closes and the server treats it as a temporary disconnect (grace window + reconnect).
// `leaveRoom` is sent only from explicit user actions (Header/Winner "Leave" buttons).
connect();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
