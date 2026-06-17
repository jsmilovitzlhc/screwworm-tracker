import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './layouts/layouts.css'
import DenseLayout from './layouts/DenseLayout.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DenseLayout />
  </StrictMode>,
)
