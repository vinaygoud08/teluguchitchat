import React, { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import './index.css'
import App from './App.jsx'
import { SettingsProvider } from './context/SettingsContext';

axios.defaults.baseURL = import.meta.env.VITE_BACKEND_URL || '';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ChitChat UI Error Boundary caught an error:", error, errorInfo);
  }

  handleReload = () => {
    try {
      localStorage.removeItem('user');
      localStorage.removeItem('appSettings_notifications');
    } catch(e) {}
    window.location.reload(true);
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          width: '100vw',
          height: '100vh',
          background: 'linear-gradient(135deg, #1a1440 0%, #0d0d12 100%)',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          textAlign: 'center',
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif"
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '36px 28px',
            borderRadius: '24px',
            maxWidth: '460px',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>💬</div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 10px 0' }}>Chit Chat Telugu</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.92rem', lineHeight: '1.5', margin: '0 0 20px 0' }}>
              The application encountered a temporary display issue. Tap below to refresh and load the latest version.
            </p>
            <button
              onClick={this.handleReload}
              style={{
                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '16px',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: 'pointer',
                boxShadow: '0 8px 20px rgba(99,102,241,0.4)'
              }}
            >
              🔄 Refresh & Load App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Ensure DOM container exists
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <SettingsProvider>
          <App />
        </SettingsProvider>
      </ErrorBoundary>
    </StrictMode>
  );
} else {
  console.error("Root element #root not found in document");
}
