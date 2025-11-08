import React, { useState } from 'react';
import { Monitor, Tablet, Smartphone, RotateCcw } from 'lucide-react';

interface ResponsivePreviewProps {
  html?: string;
  css?: string;
}

const ResponsivePreview: React.FC<ResponsivePreviewProps> = ({ html, css }) => {
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

  const viewports = {
    desktop: {
      label: 'Desktop',
      width: '100%',
      height: '600px',
      icon: Monitor,
      breakpoint: 'min-width: 1024px'
    },
    tablet: {
      label: 'Tablet',
      width: '768px',
      height: '1024px',
      icon: Tablet,
      breakpoint: 'max-width: 1023px and min-width: 768px'
    },
    mobile: {
      label: 'Mobile',
      width: '375px',
      height: '667px',
      icon: Smartphone,
      breakpoint: 'max-width: 767px'
    }
  };

  const currentViewport = viewports[viewport];
  const Icon = currentViewport.icon;

  const getDimensions = () => {
    if (orientation === 'landscape') {
      return {
        width: currentViewport.height,
        height: currentViewport.width,
      };
    }
    return {
      width: currentViewport.width,
      height: currentViewport.height,
    };
  };

  const dimensions = getDimensions();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={20} className="text-gray-600" />
          <span className="font-medium text-gray-700">Responsive Preview</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOrientation(orientation === 'portrait' ? 'landscape' : 'portrait')}
            className="flex items-center gap-1 px-3 py-1 text-sm rounded bg-gray-100 hover:bg-gray-200"
            title="Rotate"
          >
            <RotateCcw size={16} />
            {orientation === 'portrait' ? 'Landscape' : 'Portrait'}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
        {Object.entries(viewports).map(([key, value]) => {
          const ViewportIcon = value.icon;
          return (
            <button
              key={key}
              onClick={() => setViewport(key as any)}
              className={`flex items-center gap-2 px-3 py-2 rounded transition-colors ${
                viewport === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <ViewportIcon size={18} />
              <span className="text-sm">{value.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex justify-center">
        <div
          className="transition-all duration-300 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden"
          style={{
            width: dimensions.width,
            height: dimensions.height,
            maxWidth: '100%',
            maxHeight: '600px'
          }}
        >
          <div className="h-full overflow-auto">
            {html || css ? (
              <div
                className="min-h-full"
                style={{
                  minHeight: orientation === 'landscape' ? dimensions.width : dimensions.height
                }}
              >
                {html && <div dangerouslySetInnerHTML={{ __html: html }} />}
                {css && <style>{css}</style>}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <Monitor size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No content to preview</p>
                  <p className="text-sm mt-2">Start designing to see the preview</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500 bg-gray-50 px-4 py-2 rounded">
        <span>{currentViewport.label} View</span>
        <span>{dimensions.width} × {dimensions.height}</span>
      </div>
    </div>
  );
};

export default ResponsivePreview;
