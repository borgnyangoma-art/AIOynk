class ApiService {
  private baseUrl: string
  private authToken: string | null = null

  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl
  }

  setAuthToken(token: string | null) {
    this.authToken = token
  }

  private buildHeaders(extra?: HeadersInit): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...extra,
    }

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`
    }

    return headers
  }

  async get<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      method: 'GET',
      headers: this.buildHeaders(options.headers),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error || response.statusText)
    }

    return response.json()
  }

  async post<T>(path: string, body: any, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      method: 'POST',
      headers: this.buildHeaders(options.headers),
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error || response.statusText)
    }

    return response.json()
  }
}

const apiService = new ApiService()
export default apiService
