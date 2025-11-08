import React, { useEffect, useRef, useState } from 'react'
import { fabric } from 'fabric'
import { useResponsive } from '../../hooks/useResponsive'
import {
  Palette,
  Square,
  Circle,
  Type,
  Image,
  Download,
  Undo,
  Redo,
} from 'lucide-react'

const GraphicsEditor: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [canvas, setCanvas] = useState<fabric.Canvas | null>(null)
  const [selectedTool, setSelectedTool] = useState<string>('select')
  const [showToolbar, setShowToolbar] = useState(true)
  const { isMobile } = useResponsive()

  useEffect(() => {
    if (canvasRef.current) {
      const fabricCanvas = new fabric.Canvas(canvasRef.current, {
        width: isMobile ? 300 : 800,
        height: isMobile ? 300 : 600,
        backgroundColor: 'white',
      })

      setCanvas(fabricCanvas)

      return () => {
        fabricCanvas.dispose()
      }
    }
  }, [isMobile])

  const addRectangle = () => {
    if (!canvas) return

    const rect = new fabric.Rect({
      left: 100,
      top: 100,
      fill: 'red',
      width: 200,
      height: 100,
    })
    canvas.add(rect)
  }

  const addCircle = () => {
    if (!canvas) return

    const circle = new fabric.Circle({
      left: 100,
      top: 100,
      radius: 50,
      fill: 'blue',
    })
    canvas.add(circle)
  }

  const addText = () => {
    if (!canvas) return

    const text = new fabric.Text('Hello World', {
      left: 100,
      top: 100,
      fontFamily: 'Arial',
      fontSize: 40,
      fill: 'black',
    })
    canvas.add(text)
  }

  const addImage = () => {
    if (!canvas) return

    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement
      const file = target.files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (event) => {
          const imgUrl = event.target?.result as string
          fabric.Image.fromURL(imgUrl, (img) => {
            img.set({
              left: 100,
              top: 100,
              scaleX: 0.5,
              scaleY: 0.5,
            })
            canvas.add(img)
          })
        }
        reader.readAsDataURL(file)
      }
    }
    input.click()
  }

  const exportAsPNG = () => {
    if (!canvas) return
    const dataURL = canvas.toDataURL({
      format: 'png',
      quality: 1,
    })

    const link = document.createElement('a')
    link.download = 'design.png'
    link.href = dataURL
    link.click()
  }

  const exportAsJSON = () => {
    if (!canvas) return
    const json = JSON.stringify(canvas.toJSON())
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.download = 'design.json'
    link.href = url
    link.click()
  }

  const tools = [
    { id: 'select', icon: '↖', name: 'Select' },
    { id: 'rectangle', icon: '□', name: 'Rectangle' },
    { id: 'circle', icon: '○', name: 'Circle' },
    { id: 'text', icon: 'T', name: 'Text' },
    { id: 'image', icon: '🖼', name: 'Image' },
  ]

  return (
    <div className="h-full flex flex-col">
      <div
        className={`${isMobile ? 'p-2' : 'p-4'} border-b border-gray-200 bg-white flex items-center justify-between`}
      >
        <div className="flex items-center gap-2">
          <Palette className="text-blue-600" size={isMobile ? 20 : 24} />
          <h1 className={`font-bold ${isMobile ? 'text-lg' : 'text-2xl'}`}>
            {isMobile ? 'Graphics' : 'Graphics Editor'}
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => canvas?.undo?.()}
            className="p-2 rounded hover:bg-gray-100"
            title="Undo"
          >
            <Undo size={isMobile ? 16 : 20} />
          </button>
          <button
            onClick={() => canvas?.redo?.()}
            className="p-2 rounded hover:bg-gray-100"
            title="Redo"
          >
            <Redo size={isMobile ? 16 : 20} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div
          className={`${
            isMobile ? 'w-12' : 'w-16'
          } bg-gray-100 border-r border-gray-200 flex flex-col items-center py-4 gap-4`}
        >
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => {
                setSelectedTool(tool.id)
                switch (tool.id) {
                  case 'rectangle':
                    addRectangle()
                    break
                  case 'circle':
                    addCircle()
                    break
                  case 'text':
                    addText()
                    break
                  case 'image':
                    addImage()
                    break
                }
              }}
              className={`p-2 rounded-lg transition-all ${
                selectedTool === tool.id
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-gray-200'
              } ${isMobile ? 'text-2xl' : 'text-3xl'}`}
              title={tool.name}
            >
              {tool.icon}
            </button>
          ))}
        </div>

        <div className="flex-1 flex items-center justify-center bg-gray-50 overflow-auto">
          <div className="bg-white p-4 rounded-lg shadow-lg">
            <canvas ref={canvasRef} />
          </div>
        </div>

        {!isMobile && (
          <div className="w-64 bg-white border-l border-gray-200 p-4">
            <h3 className="font-semibold mb-4">Properties</h3>
            <div className="space-y-4">
              <button
                onClick={exportAsPNG}
                className="w-full flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Download size={16} />
                Export as PNG
              </button>
              <button
                onClick={exportAsJSON}
                className="w-full flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                <Download size={16} />
                Export as JSON
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default GraphicsEditor
