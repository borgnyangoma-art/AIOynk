// API call wrapper with automatic performance monitoring

import { performanceMonitor } from './performanceMonitoring';

export interface APIRequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  withCredentials?: boolean;
  skipPerformanceTracking?: boolean;
}

export interface APIResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  duration: number;
}

class APIClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  constructor(baseURL: string = '') {
    this.baseURL = baseURL;
  }

  // Set base URL
  setBaseURL(url: string): void {
    this.baseURL = url;
  }

  // Set default headers
  setDefaultHeader(key: string, value: string): void {
    this.defaultHeaders[key] = value;
  }

  // Make HTTP request
  async request<T = any>(
    endpoint: string,
    config: APIRequestConfig = {}
  ): Promise<APIResponse<T>> {
    const {
      method = 'GET',
      headers = {},
      body,
      timeout = 30000,
      retries = 0,
      retryDelay = 1000,
      withCredentials = false,
      skipPerformanceTracking = false,
    } = config;

    // Start performance monitoring
    const callId = skipPerformanceTracking
      ? ''
      : performanceMonitor.startAPICall(endpoint, method);

    // Combine headers
    const requestHeaders = {
      ...this.defaultHeaders,
      ...headers,
    };

    // Prepare request
    const url = this.baseURL ? `${this.baseURL}${endpoint}` : endpoint;
    const requestInit: RequestInit = {
      method,
      headers: requestHeaders,
      credentials: withCredentials ? 'include' : 'same-origin',
    };

    if (body && method !== 'GET') {
      requestInit.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    // Implement retry logic
    let lastError: any;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          ...requestInit,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        const duration = Date.now(); // Rough duration

        // Parse response
        let data: T;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          data = (await response.text()) as unknown as T;
        }

        // End performance monitoring
        if (!skipPerformanceTracking) {
          performanceMonitor.endAPICall(callId, endpoint, method, response.status);
        }

        // Check for HTTP errors
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return {
          data,
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          duration,
        };
      } catch (error) {
        lastError = error;

        // Don't retry on certain errors
        if (error instanceof Error) {
          if (error.name === 'AbortError' || error.message.includes('401') || error.message.includes('403')) {
            break;
          }
        }

        // Wait before retry (except on last attempt)
        if (attempt < retries) {
          await this.delay(retryDelay * Math.pow(2, attempt));
        }
      }
    }

    // End performance monitoring with error
    if (!skipPerformanceTracking) {
      performanceMonitor.endAPICall(callId, endpoint, method, 0);
    }

    throw lastError;
  }

  // GET request
  async get<T = any>(endpoint: string, config: APIRequestConfig = {}): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'GET' });
  }

  // POST request
  async post<T = any>(endpoint: string, data?: any, config: APIRequestConfig = {}): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'POST', body: data });
  }

  // PUT request
  async put<T = any>(endpoint: string, data?: any, config: APIRequestConfig = {}): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'PUT', body: data });
  }

  // DELETE request
  async delete<T = any>(endpoint: string, config: APIRequestConfig = {}): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'DELETE' });
  }

  // PATCH request
  async patch<T = any>(endpoint: string, data?: any, config: APIRequestConfig = {}): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'PATCH', body: data });
  }

  // Upload file
  async upload<T = any>(
    endpoint: string,
    file: File,
    onProgress?: (progress: number) => void,
    config: APIRequestConfig = {}
  ): Promise<APIResponse<T>> {
    const formData = new FormData();
    formData.append('file', file);

    const requestHeaders = { ...config.headers };
    delete requestHeaders['Content-Type']; // Let browser set it for FormData

    return this.request<T>(endpoint, {
      ...config,
      method: 'POST',
      headers: requestHeaders,
      body: formData,
      skipPerformanceTracking: true, // Will track manually
    });
  }

  // Download file
  async download(endpoint: string, config: APIRequestConfig = {}): Promise<Blob> {
    const response = await this.request<Blob>(endpoint, {
      ...config,
      method: 'GET',
      skipPerformanceTracking: true,
    });

    return new Blob([response.data], { type: 'application/octet-stream' });
  }

  // Batch requests
  async batch<T = any>(requests: { endpoint: string; config: APIRequestConfig }[]): Promise<APIResponse<T>[]> {
    return Promise.all(
      requests.map(({ endpoint, config }) => this.request<T>(endpoint, config))
    );
  }

  // Cancel request
  cancelRequest(endpoint: string): void {
    // This is a placeholder - in a real implementation, you'd track and cancel AbortControllers
    console.log(`Cancelling request to: ${endpoint}`);
  }

  // Delay helper
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Create default instance
const apiClient = new APIClient();

// Add request interceptor
apiClient.setDefaultHeader('X-Requested-With', 'XMLHttpRequest');

// Add response interceptor
if (typeof window !== 'undefined') {
  // Handle authentication errors
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && event.reason.message && event.reason.message.includes('401')) {
      // Redirect to login or refresh token
      console.warn('Authentication error - please login again');
    }
  });
}

export { apiClient, APIClient };
export default APIClient;
