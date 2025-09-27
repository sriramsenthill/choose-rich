import { API_CONFIG } from "./config";

// HTTP client with retry logic and error handling
class ApiClient {
  private baseUrl: string;
  private timeout: number;

  constructor(
    baseUrl: string = API_CONFIG.BASE_URL,
    timeout: number = API_CONFIG.TIMEOUT
  ) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          ...this.getDefaultHeaders(),
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Handle wrapped response format from Rust API
      if (data.status === "Ok" && data.result) {
        return data.result as T;
      }

      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error("Request timeout");
        }
        throw error;
      }

      throw new Error("Unknown error occurred");
    }
  }

  private async retryRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    attempt: number = 1
  ): Promise<T> {
    try {
      return await this.makeRequest<T>(endpoint, options);
    } catch (error) {
      if (attempt < API_CONFIG.RETRY.ATTEMPTS) {
        await new Promise((resolve) =>
          setTimeout(resolve, API_CONFIG.RETRY.DELAY * attempt)
        );
        return this.retryRequest<T>(endpoint, options, attempt + 1);
      }
      throw error;
    }
  }

  async get<T>(endpoint: string, headers?: Record<string, string>): Promise<T> {
    return this.retryRequest<T>(endpoint, {
      method: "GET",
      headers: headers
        ? { ...this.getDefaultHeaders(), ...headers }
        : this.getDefaultHeaders(),
    });
  }

  async post<T>(
    endpoint: string,
    data?: unknown,
    headers?: Record<string, string>
  ): Promise<T> {
    return this.retryRequest<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
      headers: headers
        ? { ...this.getDefaultHeaders(), ...headers }
        : this.getDefaultHeaders(),
    });
  }

  async put<T>(
    endpoint: string,
    data?: unknown,
    headers?: Record<string, string>
  ): Promise<T> {
    return this.retryRequest<T>(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
      headers: headers
        ? { ...this.getDefaultHeaders(), ...headers }
        : this.getDefaultHeaders(),
    });
  }

  async delete<T>(
    endpoint: string,
    headers?: Record<string, string>
  ): Promise<T> {
    return this.retryRequest<T>(endpoint, {
      method: "DELETE",
      headers: headers
        ? { ...this.getDefaultHeaders(), ...headers }
        : this.getDefaultHeaders(),
    });
  }

  private getDefaultHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
    };
  }
}

// Create singleton instance
export const apiClient = new ApiClient();

// Export the class for testing
export { ApiClient };
