import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Assets folder se apni image import karein (apne file name ke hisaab se check kar lein)
import newLogo from './Assets/newLogo.png'

// Dynamic favicon set karne ka code
const link = document.querySelector("link[rel*='icon']") || document.createElement('link')
link.type = 'image/png'
link.rel = 'icon'
link.href = newLogo
document.getElementsByTagName('head')[0].appendChild(link)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)