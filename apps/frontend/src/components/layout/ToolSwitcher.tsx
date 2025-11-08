import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { RootState } from '../../store'
import { updateToolContext } from '../../store/slices/toolSlice'
import { Tool } from '../../types'

interface ToolSwitcherProps {
  isMobile?: boolean
}

const ToolSwitcher: React.FC<ToolSwitcherProps> = ({ isMobile = false }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useDispatch()
  const { tools, contexts } = useSelector((state: RootState) => state.tool)
  const [hoveredTool, setHoveredTool] = useState<string | null>(null)

  const getCurrentRouteToolId = () => {
    const path = location.pathname
    if (path === '/chat') return null
    if (path === '/graphics') return 'graphics'
    if (path === '/web-designer') return 'web'
    if (path === '/ide') return 'ide'
    if (path === '/cad') return 'cad'
    if (path === '/video') return 'video'
    return null
  }

  const currentToolId = getCurrentRouteToolId()

  const getRouteForTool = (tool: Tool) => {
    switch (tool.id) {
      case 'graphics':
        return '/graphics'
      case 'web':
        return '/web-designer'
      case 'ide':
        return '/ide'
      case 'cad':
        return '/cad'
      case 'video':
        return '/video'
      default:
        return '/chat'
    }
  }

  const handleToolSwitch = (tool: Tool) => {
    if (currentToolId && currentToolId !== tool.id) {
      const contextData = getCurrentToolContext(currentToolId)
      if (contextData) {
        dispatch(
          updateToolContext({
            toolId: currentToolId,
            context: contextData,
          })
        )
      }
    }

    navigate(getRouteForTool(tool))
  }

  const getCurrentToolContext = (toolId: string) => {
    switch (toolId) {
      case 'graphics':
        return {
          canvasData: localStorage.getItem('graphics-canvas'),
          timestamp: Date.now(),
        }
      case 'web':
        return {
          html: localStorage.getItem('web-designer-html'),
          css: localStorage.getItem('web-designer-css'),
          timestamp: Date.now(),
        }
      case 'ide':
        return {
          files: JSON.parse(localStorage.getItem('ide-files') || '[]'),
          activeFileId: localStorage.getItem('ide-active-file'),
          timestamp: Date.now(),
        }
      case 'cad':
        return {
          currentPrimitive: localStorage.getItem('cad-primitive'),
          settings: JSON.parse(localStorage.getItem('cad-settings') || '{}'),
          timestamp: Date.now(),
        }
      case 'video':
        return {
          clips: JSON.parse(localStorage.getItem('video-clips') || '[]'),
          currentTime: localStorage.getItem('video-time'),
          timestamp: Date.now(),
        }
      default:
        return null
    }
  }

  const hasContext = (toolId: string) => {
    return !!contexts[toolId as keyof typeof contexts]
  }

  const getContextInfo = (toolId: string) => {
    const context = contexts[toolId as keyof typeof contexts]
    if (!context) return null

    if (toolId === 'graphics') {
      return { type: 'canvas', count: '1 project' }
    } else if (toolId === 'web') {
      return { type: 'design', count: '1 design' }
    } else if (toolId === 'ide') {
      return {
        type: 'files',
        count: `${(context as any)?.files?.length || 0} files`,
      }
    } else if (toolId === 'cad') {
      return { type: 'model', count: '1 model' }
    } else if (toolId === 'video') {
      return {
        type: 'timeline',
        count: `${(context as any)?.clips?.length || 0} clips`,
      }
    }
    return null
  }

  return (
    <div
      className={`${isMobile ? 'p-2' : 'p-4'} border-b border-gray-200 bg-white`}
    >
      <div
        className={`flex ${isMobile ? 'gap-1' : 'gap-2'} overflow-x-auto scrollbar-hide`}
      >
        {tools.map((tool) => {
          const hasUnsavedContext = hasContext(tool.id)
          const contextInfo = getContextInfo(tool.id)
          const isHovered = hoveredTool === tool.id
          const route = getRouteForTool(tool)

          return (
            <div key={tool.id} className="relative flex-shrink-0">
              <button
                onClick={() => handleToolSwitch(tool)}
                onMouseEnter={() => !isMobile && setHoveredTool(tool.id)}
                onMouseLeave={() => !isMobile && setHoveredTool(null)}
                className={`flex items-center ${
                  isMobile ? 'gap-1' : 'gap-2'
                } rounded-lg ${isMobile ? 'px-2 py-2' : 'px-4 py-2'} transition-all ${
                  currentToolId === tool.id
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span className={`${isMobile ? 'text-lg' : 'text-xl'}`}>
                  {tool.icon}
                </span>
                <span
                  className={`font-medium whitespace-nowrap ${
                    isMobile ? 'text-sm' : 'text-base'
                  } ${isMobile ? 'hidden sm:inline' : ''}`}
                >
                  {tool.name}
                </span>
                {hasUnsavedContext && currentToolId !== tool.id && (
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                )}
              </button>

              {!isMobile && isHovered && contextInfo && (
                <div className="absolute top-full left-0 mt-2 p-3 bg-gray-900 text-white rounded-lg shadow-xl z-50 min-w-[200px]">
                  <div className="text-sm font-medium mb-1">{tool.name}</div>
                  <div className="text-xs text-gray-300">
                    {contextInfo.count} • {contextInfo.type}
                  </div>
                  {currentToolId === tool.id && (
                    <div className="text-xs text-green-400 mt-1">Active</div>
                  )}
                  {hasUnsavedContext && currentToolId !== tool.id && (
                    <div className="text-xs text-orange-400 mt-1">
                      Saved state
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ToolSwitcher
