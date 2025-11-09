import React, { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import ToolSwitcher from './ToolSwitcher'
import PreviewPanel from '../preview/PreviewPanel'
import PreviewToggle from '../preview/PreviewToggle'
import PerformanceDashboard from '../PerformanceDashboard'

const MainLayout: React.FC = () => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isPerformanceOpen, setIsPerformanceOpen] = useState(false)

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkIsMobile()
    window.addEventListener('resize', checkIsMobile)

    return () => {
      window.removeEventListener('resize', checkIsMobile)
    }
  }, [])

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <ToolSwitcher isMobile={isMobile} />
      <div className="flex items-center justify-end border-b border-gray-200 bg-white px-4 py-2">
        <button
          className="rounded border border-blue-200 px-3 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-50"
          onClick={() => setIsPerformanceOpen(true)}
        >
          Performance & Cache
        </button>
      </div>
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </div>
      <PreviewPanel
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        isMobile={isMobile}
      />
      <PreviewToggle
        isPreviewOpen={isPreviewOpen}
        onToggle={() => setIsPreviewOpen(!isPreviewOpen)}
        isMobile={isMobile}
      />
      <PerformanceDashboard
        isVisible={isPerformanceOpen}
        onClose={() => setIsPerformanceOpen(false)}
      />
    </div>
  )
}

export default MainLayout
