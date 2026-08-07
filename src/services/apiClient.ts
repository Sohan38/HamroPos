/**
 * @file services/apiClient.ts
 * @description Reusable, production-grade HTTP/API client with unified error handling and request interception.
 *
 * Backend error envelope (success = false):
 *   { success: false, data: null, errors: [{ code: string, message: string }], meta: { ... } }
 */

export interface RequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, string>;
  signal?: AbortSignal;
}

/** Shape of a single backend error object. */
export interface BackendError {
  code: string;
  message: string;
}

export class ApiError extends Error {
  /** HTTP status code (0 = network failure, no HTTP response). */
  status: number;
  /** First error code from the backend errors[] array, or a client-side code. */
  errorCode: string;
  /** All backend errors[] if present. */
  errors: BackendError[];
  data?: any;

  constructor(
    message: string,
    status: number,
    errorCode: string = 'SERVER_ERROR',
    errors: BackendError[] = [],
    data?: any
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errorCode = errorCode;
    this.errors = errors;
    this.data = data;
  }
}

class ApiClient {
  private _baseUrl: string;

  constructor() {
    this._baseUrl = import.meta.env.VITE_LICENSE_SERVER_URL || 'https://hamroposbackend.onrender.com/api/v1';
  }

  /**
   * Updates base URL if needed dynamically (e.g., from settings screen).
   */
  setBaseUrl(url: string) {
    this._baseUrl = url;
  }

  getBaseUrl(): string {
    return this._baseUrl;
  }

  private async request<T>(
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    body?: any,
    options?: RequestOptions
  ): Promise<T> {
    // 1. Build Query Parameters
    let url = `${this._baseUrl}${path}`;
    if (options?.params) {
      const searchParams = new URLSearchParams(options.params);
      url += `?${searchParams.toString()}`;
    }

    // 2. Prepare Headers
    const headers = new Headers({
      'Content-Type': 'application/json',
      ...options?.headers,
    });

    // 3. Perform Fetch
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: options?.signal,
      });

      // 4. Handle Response Error States
      if (!response.ok) {
        let errorData: any = {};
        try {
          errorData = await response.json();
        } catch {
          // Response body was not JSON
        }

        // Parse backend errors[] envelope: { errors: [{ code, message }] }
        const backendErrors: BackendError[] = Array.isArray(errorData.errors) ? errorData.errors : [];
        const firstError = backendErrors[0];
        const errorCode = firstError?.code || errorData.errorCode || 'SERVER_ERROR';
        const errorMessage = firstError?.message || errorData.error || `HTTP error ${response.status}`;

        throw new ApiError(errorMessage, response.status, errorCode, backendErrors, errorData);
      }

      // 5. Parse Successful JSON Response
      const resData = (await response.json()) as any;

      // Backend may return HTTP 200 but with success: false and errors[]
      if (resData && resData.success === false) {
        const backendErrors: BackendError[] = Array.isArray(resData.errors) ? resData.errors : [];
        const firstError = backendErrors[0];
        const errorCode = firstError?.code || resData.errorCode || 'SERVER_ERROR';
        const errorMessage = firstError?.message || resData.error || 'Request failed.';
        throw new ApiError(errorMessage, response.status, errorCode, backendErrors, resData);
      }

      return resData as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      // Map native fetch exceptions (e.g., TypeError: Failed to fetch / offline)
      throw new ApiError(
        'Network error or server unreachable. Please check your internet connection.',
        0,
        'NETWORK_ERROR',
        []
      );
    }
  }

  async get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, 'GET', undefined, options);
  }

  async post<T>(path: string, body?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, 'POST', body, options);
  }

  async put<T>(path: string, body?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, 'PUT', body, options);
  }

  async patch<T>(path: string, body?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, 'PATCH', body, options);
  }

  async delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, 'DELETE', undefined, options);
  }
}

export const apiClient = new ApiClient();
