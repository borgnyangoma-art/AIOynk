export interface AccessibilityIssue {
  id: string
  message: string
  severity: 'warning' | 'error'
  selector?: string
}

const colorRegex = /#([0-9a-f]{3,6})/gi

export const checkAccessibility = (html: string, css: string): AccessibilityIssue[] => {
  const issues: AccessibilityIssue[] = []

  if (!html.toLowerCase().includes('<button') && !html.toLowerCase().includes('role="button"')) {
    issues.push({
      id: 'missing-interaction',
      message: 'No interactive elements detected. Consider adding buttons or links for navigation.',
      severity: 'warning',
    })
  }

  if (!html.toLowerCase().includes('alt=')) {
    issues.push({
      id: 'missing-alt',
      message: 'Images or media elements should include descriptive alt text.',
      severity: 'warning',
    })
  }

  const matches = css.match(colorRegex) || []
  if (matches.length > 0) {
    const uniqueColors = new Set(matches)
    if (uniqueColors.size < 2) {
      issues.push({
        id: 'low-contrast-risk',
        message: 'Only one color detected in CSS—verify contrast meets WCAG 2.1 AA.',
        severity: 'warning',
      })
    }
  }

  if (!html.toLowerCase().includes('<nav')) {
    issues.push({
      id: 'missing-navigation',
      message: 'Add a semantic <nav> region with skip links or landmarks for better accessibility.',
      severity: 'warning',
    })
  }

  return issues
}
