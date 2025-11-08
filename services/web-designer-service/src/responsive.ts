export interface ResponsiveBreakpoint {
  label: 'mobile' | 'tablet' | 'desktop'
  minWidth: number
}

export const breakpoints: ResponsiveBreakpoint[] = [
  { label: 'mobile', minWidth: 0 },
  { label: 'tablet', minWidth: 768 },
  { label: 'desktop', minWidth: 1024 },
]

export const wrapWithResponsivePreview = (html: string, css: string) => {
  return breakpoints.map((breakpoint) => ({
    label: breakpoint.label,
    html: `<!DOCTYPE html><html><head><style>${css}</style></head><body>${html}</body></html>`,
    viewport: breakpoint.minWidth,
  }))
}
