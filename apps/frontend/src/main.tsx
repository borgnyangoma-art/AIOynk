import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// Performance monitoring
if (typeof window !== 'undefined') {
  // Measure LCP (Largest Contentful Paint)
  const observer = new PerformanceObserver((list) => {
    const entries = list.getEntries()
    const lastEntry = entries[entries.length - 1]
    console.log('LCP:', lastEntry.startTime)
  })
  observer.observe({ entryTypes: ['largest-contentful-paint'] })

  // Measure FID (First Input Delay)
  const fidObserver = new PerformanceObserver((list) => {
    const entries = list.getEntries()
    entries.forEach((entry) => {
      console.log('FID:', entry.processingStart - entry.startTime)
    })
  })
  fidObserver.observe({ entryTypes: ['first-input'] })

  // Measure CLS (Cumulative Layout Shift)
  let clsValue = 0
  const clsObserver = new PerformanceObserver((list) => {
    const entries = list.getEntries()
    entries.forEach((entry) => {
      if (!entry.hadRecentInput) {
        clsValue += entry.value
        console.log('CLS:', clsValue)
      }
    })
  })
  clsObserver.observe({ entryTypes: ['layout-shift'] })

  // Register service worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration.scope)
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error)
        })
    })
  }

  // Preload critical resources
  const preloadLink = document.createElement('link')
  preloadLink.rel = 'modulepreload'
  preloadLink.href = '/src/components/chat/ChatInterface.tsx'
  document.head.appendChild(preloadLink)
}

// Create root and render app
const container = document.getElementById('root')
if (!container) {
  throw new Error('Root element not found')
}

const root = createRoot(container)
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// Enable React Fast Refresh in development
if (import.meta.hot) {
  import.meta.hot.accept()
}
