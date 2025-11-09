const encodeSvg = (svg: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(svg.replace(/\s+/g, ' '))}`

const baseSvg = (width: number, height: number) => `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#dbeafe;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#bfdbfe;stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#grad)" rx="12" />
    <text x="50%" y="50%" font-size="${Math.round(width * 0.08)}" text-anchor="middle" fill="#1e3a8a" font-family="Inter, system-ui">Preview</text>
  </svg>
`

export const PREVIEW_PLACEHOLDER_1X = encodeSvg(baseSvg(400, 240))
export const PREVIEW_PLACEHOLDER_2X = encodeSvg(baseSvg(800, 480))
