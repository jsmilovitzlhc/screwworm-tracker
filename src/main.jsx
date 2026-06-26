import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './layouts/layouts.css'
import DenseLayout from './layouts/DenseLayout.jsx'
import WidgetLayout from './layouts/WidgetLayout.jsx'

function Router() {
  if (window.location.pathname === '/widget') return <WidgetLayout />;
  return <DenseLayout />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Router />
  </StrictMode>,
)
