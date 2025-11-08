import React, { Suspense, lazy } from 'react'
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom'
import { Provider } from 'react-redux'
import { store } from './store/store'
import MainLayout from './components/layout/MainLayout'
import './App.css'

// Lazy load components for code splitting
const ChatInterface = lazy(() => import('./components/chat/ChatInterface'))
const GraphicsEditor = lazy(() => import('./components/tools/GraphicsEditor'))
const WebDesigner = lazy(() => import('./components/tools/WebDesigner'))
const IDE = lazy(() => import('./components/tools/IDE'))
const CAD = lazy(() => import('./components/tools/CAD'))
const VideoEditor = lazy(() => import('./components/tools/VideoEditor'))

// Loading component
const LoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
)

// Error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Application error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <h1 className="text-2xl font-bold text-red-600 mb-4">
            Something went wrong
          </h1>
          <p className="text-gray-600 mb-4">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Reload Page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <Provider store={store}>
        <Router>
          <div className="App min-h-screen bg-gray-50">
            <Suspense fallback={<LoadingSpinner />}>
              <Routes>
                <Route path="/" element={<MainLayout />}>
                  <Route index element={<Navigate to="/chat" replace />} />
                  <Route
                    path="chat"
                    element={
                      <Suspense fallback={<LoadingSpinner />}>
                        <ChatInterface />
                      </Suspense>
                    }
                  />
                  <Route
                    path="graphics"
                    element={
                      <Suspense fallback={<LoadingSpinner />}>
                        <GraphicsEditor />
                      </Suspense>
                    }
                  />
                  <Route
                    path="web-designer"
                    element={
                      <Suspense fallback={<LoadingSpinner />}>
                        <WebDesigner />
                      </Suspense>
                    }
                  />
                  <Route
                    path="ide"
                    element={
                      <Suspense fallback={<LoadingSpinner />}>
                        <IDE />
                      </Suspense>
                    }
                  />
                  <Route
                    path="cad"
                    element={
                      <Suspense fallback={<LoadingSpinner />}>
                        <CAD />
                      </Suspense>
                    }
                  />
                  <Route
                    path="video"
                    element={
                      <Suspense fallback={<LoadingSpinner />}>
                        <VideoEditor />
                      </Suspense>
                    }
                  />
                </Route>
              </Routes>
            </Suspense>
          </div>
        </Router>
      </Provider>
    </ErrorBoundary>
  )
}

export default App
