import React, { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

interface PreviewToggleProps {
  onToggle: () => void
  isPreviewOpen: boolean
  isMobile?: boolean
}

const PreviewToggle: React.FC<PreviewToggleProps> = ({
  onToggle,
  isPreviewOpen,
  isMobile = false,
}) => {
  return (
    <button
      onClick={onToggle}
      className={`fixed z-50 flex items-center ${
        isMobile
          ? 'bottom-4 right-4 w-12 h-12 rounded-full'
          : 'bottom-6 right-6 gap-2 rounded-full px-4 py-3'
      } shadow-lg transition-all ${
        isPreviewOpen
          ? 'bg-blue-600 text-white hover:bg-blue-700'
          : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
      }`}
      title={isPreviewOpen ? 'Hide Preview' : 'Show Preview'}
    >
      {isPreviewOpen ? (
        <EyeOff size={isMobile ? 20 : 20} />
      ) : (
        <Eye size={isMobile ? 20 : 20} />
      )}
      {!isMobile && (
        <span className="text-sm font-medium">
          {isPreviewOpen ? 'Hide Preview' : 'Show Preview'}
        </span>
      )}
    </button>
  )
}

export default PreviewToggle
