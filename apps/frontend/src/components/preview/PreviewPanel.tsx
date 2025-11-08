import React, { useState, useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import { Eye, X, Maximize2, Minimize2, RotateCcw, Download } from 'lucide-react'

interface PreviewPanelProps {
  isOpen: boolean
  onClose: () => void
  isMobile?: boolean
}

const PreviewPanel: React.FC<PreviewPanelProps> = ({
  isOpen,
  onClose,
  isMobile = false,
}) => {
  const { currentTool, contexts } = useSelector(
    (state: RootState) => state.tool
  )
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (autoRefresh && isOpen && currentTool) {
      intervalRef.current = setInterval(() => {
        // Trigger re-render to get latest data
        forceUpdate()
      }, 2000)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [autoRefresh, isOpen, currentTool])

  const [, forceUpdate] = useState(0)

  const refreshPreview = () => {
    forceUpdate((prev) => prev + 1)
  }

  const renderPreview = () => {
    if (!currentTool) {
      return (
        <div className="flex items-center justify-center h-full text-gray-400">
          <div className="text-center">
            <Eye size={48} className="mx-auto mb-4 opacity-50" />
            <p>Select a tool to see preview</p>
          </div>
        </div>
      )
    }

    const context = contexts[currentTool.id as keyof typeof contexts]

    switch (currentTool.id) {
      case 'graphics':
        return (
          <div className="h-full flex items-center justify-center bg-gray-900">
            <div className="text-center text-white">
              <div className="w-64 h-48 bg-white rounded-lg mb-4 flex items-center justify-center">
                <span className="text-gray-400">Graphics Preview</span>
              </div>
              <p className="text-sm">
                Canvas: {context?.canvasData ? 'Active' : 'Empty'}
              </p>
            </div>
          </div>
        )

      case 'web':
        return (
          <div className="h-full">
            <div className="border-b border-gray-300 p-2 bg-gray-100 flex gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
            </div>
            <div className="h-full overflow-auto bg-white p-8">
              {context?.html || context?.css ? (
                <div>
                  {context.html && (
                    <div dangerouslySetInnerHTML={{ __html: context.html }} />
                  )}
                  {context.css && <style>{context.css}</style>}
                </div>
              ) : (
                <div className="text-center text-gray-400 py-16">
                  <p>No web design yet</p>
                  <p className="text-sm mt-2">
                    Create something to see preview
                  </p>
                </div>
              )}
            </div>
          </div>
        )

      case 'ide':
        return (
          <div className="h-full flex flex-col">
            <div className="bg-gray-900 text-gray-300 p-4 font-mono text-sm flex-1 overflow-auto">
              <div className="text-green-400 mb-2">
                &gt; Running JavaScript...
              </div>
              <div className="text-white">Hello, World!</div>
              <div className="text-green-400 mt-2">
                &gt; Program executed successfully
              </div>
              <div className="text-gray-500 mt-4">Exit code: 0</div>
            </div>
            <div className="border-t border-gray-300 bg-gray-100 p-2 text-sm">
              <span className="text-gray-600">Output: </span>
              <span className="text-gray-800">
                {context?.output || 'No output yet'}
              </span>
            </div>
          </div>
        )

      case 'cad':
        return (
          <div className="h-full flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-400">
            <div className="text-center">
              <div className="w-64 h-48 bg-gray-600 rounded-lg mb-4 flex items-center justify-center">
                <span className="text-white text-6xl">🎲</span>
              </div>
              <p className="text-sm font-medium">
                {context?.currentPrimitive || 'No model selected'}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {context?.width &&
                  context?.height &&
                  `Size: ${context.width}x${context.height}`}
              </p>
            </div>
          </div>
        )

      case 'video':
        return (
          <div className="h-full flex flex-col">
            <div className="flex-1 bg-black flex items-center justify-center">
              <div className="text-center text-white">
                <div className="w-96 h-56 bg-gray-800 rounded-lg mb-4 flex items-center justify-center">
                  <span className="text-6xl">🎬</span>
                </div>
                <p className="text-sm">Video Preview</p>
                <p className="text-xs text-gray-400 mt-2">
                  {context?.clips?.length || 0} clips on timeline
                </p>
              </div>
            </div>
            <div className="border-t border-gray-300 bg-gray-100 p-2">
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>Timeline: 60s</span>
                <span>{context?.currentTime || 0}s</span>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  if (!isOpen) return null

  return (
    <div
      className={`fixed bg-white shadow-2xl z-50 transition-all ${
        isFullscreen || isMobile
          ? 'inset-0'
          : 'bottom-4 right-4 w-96 h-96 rounded-lg overflow-hidden'
      }`}
    >
      <div className="flex items-center justify-between p-2 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <Eye size={16} className="text-gray-600" />
          <span className="text-sm font-medium">
            {currentTool ? `${currentTool.name} Preview` : 'Preview'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`p-1 rounded ${
              autoRefresh ? 'text-blue-600' : 'text-gray-400'
            }`}
            title={autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          >
            <RotateCcw size={16} />
          </button>
          <button
            onClick={refreshPreview}
            className="p-1 rounded text-gray-600 hover:bg-gray-200"
            title="Refresh"
          >
            <RotateCcw size={16} />
          </button>
          {!isMobile && (
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1 rounded text-gray-600 hover:bg-gray-200"
              title={isFullscreen ? 'Minimize' : 'Maximize'}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded text-gray-600 hover:bg-gray-200"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="h-[calc(100%-40px)]">{renderPreview()}</div>
    </div>
  )
}

export default PreviewPanel
