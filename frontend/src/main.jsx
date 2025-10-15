import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'react-diff-view/style/index.css'
import App from './App.jsx'
import i18n from './i18n'; // Import i18n configuration
import { I18nextProvider } from 'react-i18next';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <App />
    </I18nextProvider>
  </StrictMode>,
)