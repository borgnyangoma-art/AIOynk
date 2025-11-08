import React, { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import ToolSwitcher from './ToolSwitcher'
import PreviewPanel from '../preview/PreviewPanel'
import PreviewToggle from '../preview/PreviewToggle'

const MainLayout: React.FC = () => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

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
    </div>
  )
}

export default MainLayout
