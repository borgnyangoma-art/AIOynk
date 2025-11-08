export const validateEmail = (value: string) => {
  if (!value) {
    return { isValid: false, error: 'Email is required' }
  }
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!pattern.test(value)) {
    return { isValid: false, error: 'Invalid email address' }
  }
  return { isValid: true }
}

export const validatePassword = (value: string) => {
  if (!value) {
    return { isValid: false, error: 'Password is required' }
  }

  const rules: Array<[RegExp, string]> = [
    [/.{8,}/, 'Password must be at least 8 characters'],
    [/[A-Z]/, 'Password must contain an uppercase letter'],
    [/[a-z]/, 'Password must contain a lowercase letter'],
    [/\d/, 'Password must contain a number'],
    [/[^A-Za-z0-9]/, 'Password must contain a special character'],
  ]

  for (const [regex, error] of rules) {
    if (!regex.test(value)) {
      return { isValid: false, error }
    }
  }

  return { isValid: true }
}

export const validateRequired = (value: string, field: string) => {
  if (!value || !value.trim()) {
    return { isValid: false, error: `${field} is required` }
  }
  return { isValid: true }
}

export const validateMinLength = (value: string, min: number, field: string) => {
  if (value.length < min) {
    return { isValid: false, error: `${field} must be at least ${min} characters` }
  }
  return { isValid: true }
}

export const validateMaxLength = (value: string, max: number, field: string) => {
  if (value.length > max) {
    return { isValid: false, error: `${field} must be at most ${max} characters` }
  }
  return { isValid: true }
}
