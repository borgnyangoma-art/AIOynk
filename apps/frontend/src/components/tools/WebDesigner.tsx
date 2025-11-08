import React, { useEffect, useRef, useState } from 'react'
import grapesjs from 'grapesjs'
import 'grapesjs/dist/css/grapes.min.css'
import {
  Code,
  Eye,
  Monitor,
  Tablet,
  Smartphone,
  Download,
  Undo,
  Redo,
} from 'lucide-react'

const WebDesigner: React.FC = () => {
  const editorRef = useRef<HTMLDivElement>(null)
  const grapesjsRef = useRef<any>(null)
  const [activeView, setActiveView] = useState<'visual' | 'code' | 'split'>(
    'visual'
  )
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>(
    'desktop'
  )
  const [htmlCode, setHtmlCode] = useState('')
  const [cssCode, setCssCode] = useState('')

  const viewportSizes = {
    desktop: { width: '100%', icon: Monitor },
    tablet: { width: '768px', icon: Tablet },
    mobile: { width: '375px', icon: Smartphone },
  }

  useEffect(() => {
    if (!editorRef.current) return

    const editor = grapesjs.init({
      container: editorRef.current,
      fromElement: false,
      height: '100vh',
      width: 'auto',
      storageManager: false,
      assetManager: {
        upload: false,
        uploadName: 'files',
        assets: [],
      },
      blockManager: {
        blocks: [
          {
            id: 'section',
            label: 'Section',
            category: 'Layout',
            content:
              '<section class="section-block"><h2>This is a simple section</h2><p>Write your content here</p></section><style>.section-block { padding: 40px; text-align: center; }</style>',
          },
          {
            id: 'text',
            label: 'Text',
            category: 'Basic',
            content: '<h1>Heading</h1>',
          },
          {
            id: 'image',
            label: 'Image',
            category: 'Basic',
            content:
              '<img src="https://via.placeholder.com/300x200" alt="Placeholder"/>',
          },
          {
            id: 'link',
            label: 'Link',
            category: 'Basic',
            content: '<a href="#">Click here</a>',
          },
          {
            id: 'list',
            label: 'List',
            category: 'Basic',
            content:
              '<ul><li>List item 1</li><li>List item 2</li><li>List item 3</li></ul>',
          },
          {
            id: 'button',
            label: 'Button',
            category: 'Basic',
            content:
              '<button class="btn">Click me</button><style>.btn { padding: 10px 20px; background: #007bff; color: white; border: none; cursor: pointer; border-radius: 5px; } .btn:hover { background: #0056b3; }</style>',
          },
          {
            id: 'grid',
            label: 'Grid',
            category: 'Layout',
            content:
              '<div class="grid-container" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;"><div>Column 1</div><div>Column 2</div></div>',
          },
          {
            id: 'navbar',
            label: 'Navbar',
            category: 'Layout',
            content:
              '<nav class="navbar" style="padding: 20px; background: #333; color: white;"><div style="max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between;"><div>Logo</div><ul style="display: flex; list-style: none; gap: 20px; margin: 0;"><li><a href="#" style="color: white; text-decoration: none;">Home</a></li><li><a href="#" style="color: white; text-decoration: none;">About</a></li><li><a href="#" style="color: white; text-decoration: none;">Contact</a></li></ul></div></nav>',
          },
          {
            id: 'form',
            label: 'Form',
            category: 'Forms',
            content:
              '<form class="form" style="padding: 20px;"><div style="margin-bottom: 15px;"><label>Name:</label><input type="text" style="width: 100%; padding: 8px;"/></div><div style="margin-bottom: 15px;"><label>Email:</label><input type="email" style="width: 100%; padding: 8px;"/></div><button type="submit" style="padding: 10px 20px;">Submit</button></form>',
          },
        ],
      },
      styleManager: [
        {
          name: 'General',
          open: false,
          buildProps: [
            'float',
            'display',
            'position',
            'top',
            'right',
            'left',
            'overflow',
          ],
        },
        {
          name: 'Dimension',
          open: false,
          buildProps: [
            'width',
            'height',
            'max-width',
            'min-height',
            'margin',
            'padding',
          ],
        },
        {
          name: 'Typography',
          open: false,
          buildProps: [
            'font-family',
            'font-size',
            'font-weight',
            'letter-spacing',
            'color',
            'line-height',
            'text-align',
          ],
        },
        {
          name: 'Decorations',
          open: false,
          buildProps: [
            'opacity',
            'border-radius',
            'border',
            'box-shadow',
            'background',
          ],
        },
        {
          name: 'Extra',
          open: false,
          buildProps: ['transition', 'perspective', 'transform'],
        },
      ],
      deviceManager: {
        devices: [
          {
            name: 'Desktop',
            width: '',
          },
          {
            name: 'Tablet',
            width: '768px',
            widthMedia: '992px',
          },
          {
            name: 'Mobile portrait',
            width: '320px',
            widthMedia: '575px',
          },
        ],
      },
    })

    grapesjsRef.current = editor

    editor.on('change', () => {
      const html = editor.getHtml()
      const css = editor.getCss()
      setHtmlCode(html)
      setCssCode(css)
    })

    return () => {
      if (grapesjsRef.current) {
        grapesjsRef.current.destroy()
        grapesjsRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!grapesjsRef.current) return

    if (viewport === 'desktop') {
      grapesjsRef.current.DeviceManager.setDevice('Desktop')
    } else if (viewport === 'tablet') {
      grapesjsRef.current.DeviceManager.setDevice('Tablet')
    } else {
      grapesjsRef.current.DeviceManager.setDevice('Mobile portrait')
    }
  }, [viewport])

  const exportCode = () => {
    if (!grapesjsRef.current) return

    const html = grapesjsRef.current.getHtml()
    const css = grapesjsRef.current.getCss()

    const fullCode = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Exported Page</title>
  <style>${css}</style>
</head>
<body>
  ${html}
</body>
</html>`

    const blob = new Blob([fullCode], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.download = 'website.html'
    link.href = url
    link.click()
    URL.revokeObjectURL(url)
  }

  const exportCSS = () => {
    if (!grapesjsRef.current) return

    const css = grapesjsRef.current.getCss()
    const blob = new Blob([css], { type: 'text/css' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.download = 'styles.css'
    link.href = url
    link.click()
    URL.revokeObjectURL(url)
  }

  const clearCanvas = () => {
    if (!grapesjsRef.current) return
    grapesjsRef.current.DomComponents.clear()
  }

  return (
    <div className="flex h-full flex-col bg-gray-50">
      <div className="flex items-center gap-4 border-b border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveView('visual')}
            className={`flex items-center gap-2 rounded px-4 py-2 ${
              activeView === 'visual'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            <Eye size={18} />
            Visual
          </button>
          <button
            onClick={() => setActiveView('split')}
            className={`flex items-center gap-2 rounded px-4 py-2 ${
              activeView === 'split'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            <Split size={18} />
            Split
          </button>
          <button
            onClick={() => setActiveView('code')}
            className={`flex items-center gap-2 rounded px-4 py-2 ${
              activeView === 'code'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            <Code size={18} />
            Code
          </button>
        </div>

        {activeView === 'visual' && (
          <div className="flex items-center gap-2 border-l border-gray-200 pl-4">
            <button
              onClick={() => setViewport('desktop')}
              className={`rounded p-2 ${
                viewport === 'desktop'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
              title="Desktop"
            >
              <Monitor size={18} />
            </button>
            <button
              onClick={() => setViewport('tablet')}
              className={`rounded p-2 ${
                viewport === 'tablet'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
              title="Tablet"
            >
              <Tablet size={18} />
            </button>
            <button
              onClick={() => setViewport('mobile')}
              className={`rounded p-2 ${
                viewport === 'mobile'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
              title="Mobile"
            >
              <Smartphone size={18} />
            </button>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {activeView === 'visual' && (
            <>
              <button
                onClick={clearCanvas}
                className="flex items-center gap-2 rounded bg-gray-200 px-4 py-2 hover:bg-gray-300"
              >
                <Undo size={18} />
                Clear
              </button>
              <button
                onClick={exportCode}
                className="flex items-center gap-2 rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
              >
                <Download size={18} />
                Export HTML
              </button>
              <button
                onClick={exportCSS}
                className="flex items-center gap-2 rounded bg-purple-600 px-4 py-2 text-white hover:bg-purple-700"
              >
                <Download size={18} />
                Export CSS
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {activeView === 'visual' ? (
          <div className="w-full">
            <div ref={editorRef} style={{ height: '100%' }} />
          </div>
        ) : (
          <div className="flex w-full">
            <div className="flex-1 border-r border-gray-200 bg-white">
              <div className="border-b border-gray-200 p-2 text-sm font-medium text-gray-700">
                HTML
              </div>
              <textarea
                value={htmlCode}
                onChange={(e) => setHtmlCode(e.target.value)}
                className="h-full w-full resize-none p-4 font-mono text-sm focus:outline-none"
                spellCheck={false}
                style={{ minHeight: '600px' }}
              />
            </div>
            <div className="flex-1 bg-white">
              <div className="border-b border-gray-200 p-2 text-sm font-medium text-gray-700">
                CSS
              </div>
              <textarea
                value={cssCode}
                onChange={(e) => setCssCode(e.target.value)}
                className="h-full w-full resize-none p-4 font-mono text-sm focus:outline-none"
                spellCheck={false}
                style={{ minHeight: '600px' }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default WebDesigner
