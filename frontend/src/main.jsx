import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Polyfill for Safari < 16.4 (used by Vite HMR client and some extensions)
if (!window.requestIdleCallback) {
  window.requestIdleCallback = (cb) =>
    setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 50 }), 1)
  window.cancelIdleCallback = (id) => clearTimeout(id)
}

// Intercept requestIdleCallback errors thrown by browser extensions
// before React 19's global error handler catches them and crashes
window.addEventListener('error', (event) => {
  if (event.message?.includes('requestIdleCallback')) {
    event.stopImmediatePropagation()
    event.preventDefault()
  }
}, true)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
