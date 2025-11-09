import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  exportAsJSON,
  exportAsText,
  exportAsImage,
  exportMultipleAsZip,
} from '../export.service'

vi.mock('jszip', () => {
  class MockZip {
    private files: Record<string, string | Blob> = {}

    folder() {
      return this
    }

    file(name: string, content: string | Blob) {
      this.files[name] = content
      return this
    }

    async generateAsync() {
      return new Blob(['mock-zip'])
    }
  }
  return { default: MockZip }
})

describe('export.service', () => {
  let anchor: HTMLAnchorElement
  let createElementSpy: ReturnType<typeof vi.spyOn>
  let clickSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    anchor = document.createElement('a')
    clickSpy = vi.spyOn(anchor, 'click').mockImplementation(() => {})
    createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(anchor)
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock')
    global.URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    clickSpy.mockRestore()
    createElementSpy.mockRestore()
  })

  it('exports data as JSON', () => {
    exportAsJSON({ foo: 'bar' }, 'export')

    expect(createElementSpy).toHaveBeenCalledWith('a')
    expect(anchor.download).toBe('export.json')
    expect(clickSpy).toHaveBeenCalled()
  })

  it('exports data as text', () => {
    exportAsText('content', 'note.txt')

    expect(anchor.download).toBe('note.txt')
    expect(clickSpy).toHaveBeenCalled()
  })

  it('exports image data URLs', () => {
    exportAsImage('data:image/png;base64,abc', 'canvas', 'png')

    expect(anchor.download).toBe('canvas.png')
    expect(clickSpy).toHaveBeenCalled()
  })

  it('exports multiple files as zip', async () => {
    await exportMultipleAsZip(
      [
        { name: 'a.txt', content: 'hello', type: 'text/plain' },
        { name: 'b.txt', content: 'world', type: 'text/plain' },
      ],
      'archive',
    )

    expect(anchor.download).toBe('archive.zip')
    expect(clickSpy).toHaveBeenCalled()
  })
})
