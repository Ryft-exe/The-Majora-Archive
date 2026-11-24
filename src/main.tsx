import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import TaelCursor from './TaelCursor'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <TaelCursor />
  </StrictMode>,
)
