import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './layouts/layouts.css'
import App from './App.jsx'
import DenseLayout from './layouts/DenseLayout.jsx'
import NewsLayout from './layouts/NewsLayout.jsx'
import CompactLayout from './layouts/CompactLayout.jsx'
import WidgetLayout from './layouts/WidgetLayout.jsx'

function Router() {
  const path = window.location.pathname;
  if (path === '/v/dense') return <DenseLayout />;
  if (path === '/v/news') return <NewsLayout />;
  if (path === '/v/compact') return <CompactLayout />;
  if (path === '/widget') return <WidgetLayout />;
  return <App />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Router />
  </StrictMode>,
)
