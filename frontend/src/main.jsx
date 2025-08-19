import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Set a CSS variable for viewport height to mitigate iOS Safari 100vh issues
function setViewportHeightVar() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}

setViewportHeightVar();
window.addEventListener('resize', setViewportHeightVar, { passive: true });
window.addEventListener('orientationchange', setViewportHeightVar, { passive: true });

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)