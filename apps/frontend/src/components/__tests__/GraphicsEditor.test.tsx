import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import GraphicsEditor from '../tools/GraphicsEditor'

vi.mock('../../hooks/useResponsive', () => ({
  useResponsive: () => ({ isMobile: false }),
}))

const fabricMocks = vi.hoisted(() => {
  const canvasAdd = vi.fn()
  const toDataURL = vi.fn(() => 'data:image/png;base64,test')
  const toJSON = vi.fn(() => ({ objects: [] }))
  const undo = vi.fn()
  const redo = vi.fn()
  const mockCanvas = {
    add: canvasAdd,
    dispose: vi.fn(),
    toDataURL,
    toJSON,
    undo,
    redo,
  }
  return {
    canvasAdd,
    mockCanvas,
    module: {
      fabric: {
        Canvas: vi.fn().mockImplementation(() => mockCanvas),
        Rect: vi.fn(),
        Circle: vi.fn(),
        Text: vi.fn(),
        Image: {
          fromURL: vi.fn((url, cb) => cb?.({ set: vi.fn() } as any)),
        },
      },
    },
  }
})

vi.mock('fabric', () => fabricMocks.module)

const mockDownload = () => {
  const anchor = document.createElement('a')
  const clickSpy = vi.spyOn(anchor, 'click').mockImplementation(() => {})
  const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(anchor)
  global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock')
  global.URL.revokeObjectURL = vi.fn()
  return { anchor, clickSpy, createElementSpy }
}

describe('GraphicsEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders toolbar and canvas', () => {
    render(<GraphicsEditor />)

    expect(screen.getByTestId('graphics-toolbar')).toBeInTheDocument()
    expect(screen.getByTestId('graphics-canvas')).toBeInTheDocument()
  })

  it('adds rectangle when rectangle tool is clicked', () => {
    render(<GraphicsEditor />)

    const rectangleButton = screen.getByTestId('tool-rectangle')
    fireEvent.click(rectangleButton)

    expect(fabricMocks.canvasAdd).toHaveBeenCalled()
  })

  it('exports canvas as PNG', () => {
    render(<GraphicsEditor />)

    const { anchor, clickSpy } = mockDownload()

    fireEvent.click(screen.getByTestId('export-png'))

    expect(anchor.download).toBe('design.png')
    expect(clickSpy).toHaveBeenCalled()
  })
})
