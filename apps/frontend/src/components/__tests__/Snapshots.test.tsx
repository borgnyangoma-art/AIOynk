import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'

import PreviewToggle from '../preview/PreviewToggle'
import ResponsiveImage from '../common/ResponsiveImage'

describe('UI Snapshots', () => {
  it('renders preview toggle in desktop mode', () => {
    const { asFragment } = render(
      <PreviewToggle isPreviewOpen={false} onToggle={() => {}} isMobile={false} />,
    )

    expect(asFragment()).toMatchInlineSnapshot(`
      <DocumentFragment>
        <button
          class="fixed z-50 flex items-center bottom-6 right-6 gap-2 rounded-full px-4 py-3 shadow-lg transition-all bg-white text-gray-700 hover:bg-gray-100 border border-gray-300"
          title="Show Preview"
        >
          <svg
            aria-hidden="true"
            class="lucide lucide-eye"
            fill="none"
            height="20"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            viewBox="0 0 24 24"
            width="20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"
            />
            <circle
              cx="12"
              cy="12"
              r="3"
            />
          </svg>
          <span
            class="text-sm font-medium"
          >
            Show Preview
          </span>
        </button>
      </DocumentFragment>
    `)
  })

  it('renders preview toggle in mobile mode when preview is open', () => {
    const { asFragment } = render(
      <PreviewToggle isPreviewOpen onToggle={() => {}} isMobile />,
    )

    expect(asFragment()).toMatchInlineSnapshot(`
      <DocumentFragment>
        <button
          class="fixed z-50 flex items-center bottom-4 right-4 w-12 h-12 rounded-full shadow-lg transition-all bg-blue-600 text-white hover:bg-blue-700"
          title="Hide Preview"
        >
          <svg
            aria-hidden="true"
            class="lucide lucide-eye-off"
            fill="none"
            height="20"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            viewBox="0 0 24 24"
            width="20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"
            />
            <path
              d="M14.084 14.158a3 3 0 0 1-4.242-4.242"
            />
            <path
              d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"
            />
            <path
              d="m2 2 20 20"
            />
          </svg>
        </button>
      </DocumentFragment>
    `)
  })

  it('renders responsive image fallbacks consistently', () => {
    const { asFragment } = render(
      <ResponsiveImage
        alt="Placeholder"
        fallbackSrc="data:image/svg+xml;utf8,<svg />"
        sources={[
          { srcSet: 'image@1x.png 1x', media: '(max-width: 600px)', type: 'image/png' },
          { srcSet: 'image@2x.png 2x', media: '(min-width: 601px)', type: 'image/png' },
        ]}
        width={320}
        height={180}
      />,
    )

    expect(asFragment()).toMatchInlineSnapshot(`
      <DocumentFragment>
        <picture
          class=""
        >
          <source
            media="(max-width: 600px)"
            srcset="image@1x.png 1x"
            type="image/png"
          />
          <source
            media="(min-width: 601px)"
            srcset="image@2x.png 2x"
            type="image/png"
          />
          <img
            alt="Placeholder"
            class="h-full w-full object-cover"
            decoding="async"
            height="180"
            loading="lazy"
            src="data:image/svg+xml;utf8,<svg />"
            width="320"
          />
        </picture>
      </DocumentFragment>
    `)
  })
})
