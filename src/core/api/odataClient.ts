import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { ODataErrorResponse } from '../types/odata.types';

// Read configuration from environment or fallback
const ODATA_BASE_URL = import.meta.env.VITE_ODATA_BASE_URL || '/sap/opu/odata4/sap/zptw_mamagement_srv/srvd_a2x/sap/zptw_services/0001/';
const SAP_CLIENT = import.meta.env.VITE_SAP_CLIENT || '200';

class SapODataClient {
  private instance: AxiosInstance;
  private csrfToken: string | null = null;
  private isFetchingToken: Promise<string | null> | null = null;

  constructor() {
    this.instance = axios.create({
      baseURL: ODATA_BASE_URL,
      timeout: 30000,
      withCredentials: true, // Send SAP session cookies
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'sap-client': SAP_CLIENT
      }
    });

    this.setupInterceptors();
  }

  /**
   * Set basic auth credentials for SAP Gateway
   */
  public setCredentials(username?: string, password?: string): void {
    if (username && password) {
      const encoded = btoa(`${username}:${password}`);
      this.instance.defaults.headers.common['Authorization'] = `Basic ${encoded}`;
    } else {
      delete this.instance.defaults.headers.common['Authorization'];
    }
  }

  private setupInterceptors(): void {
    // Request Interceptor: Attach cached CSRF token to modifying methods
    this.instance.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        const method = config.method?.toUpperCase();
        const isModifying = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method || '');

        if (isModifying) {
          if (!this.csrfToken) {
            this.csrfToken = await this.fetchCsrfToken();
          }
          if (this.csrfToken) {
            config.headers.set('X-CSRF-Token', this.csrfToken);
          }
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response Interceptor: Capture token and handle 403 CSRF expiration
    this.instance.interceptors.response.use(
      (response: AxiosResponse) => {
        const token = response.headers['x-csrf-token'];
        if (token && token.toLowerCase() !== 'required') {
          this.csrfToken = token;
        }
        return response;
      },
      async (error) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        // Handle expired CSRF token (SAP returns 403 with x-csrf-token: Required)
        const isCsrfRequired = error.response?.status === 403 && 
          error.response?.headers?.['x-csrf-token']?.toLowerCase() === 'required';

        if (isCsrfRequired && !originalRequest._retry) {
          originalRequest._retry = true;
          this.csrfToken = null; // Invalidate cached token
          const freshToken = await this.fetchCsrfToken();
          if (freshToken) {
            originalRequest.headers.set('X-CSRF-Token', freshToken);
            return this.instance(originalRequest);
          }
        }

        return Promise.reject(this.parseSapError(error));
      }
    );
  }

  /**
   * Fetches a fresh CSRF token from SAP Gateway
   */
  public async fetchCsrfToken(): Promise<string | null> {
    if (this.isFetchingToken) {
      return this.isFetchingToken;
    }

    this.isFetchingToken = (async () => {
      try {
        const response = await this.instance.head('', {
          headers: {
            'X-CSRF-Token': 'Fetch'
          }
        });
        const token = response.headers['x-csrf-token'] || null;
        this.csrfToken = token;
        return token;
      } catch (err) {
        // Fallback: try GET if HEAD is not supported by ICF node
        try {
          const getRes = await this.instance.get('', {
            headers: { 'X-CSRF-Token': 'Fetch' },
            params: { $top: 1 }
          });
          const token = getRes.headers['x-csrf-token'] || null;
          this.csrfToken = token;
          return token;
        } catch {
          console.warn('[SapODataClient] Could not fetch CSRF token (running offline/mock mode?)');
          return null;
        }
      } finally {
        this.isFetchingToken = null;
      }
    })();

    return this.isFetchingToken;
  }

  /**
   * Parses SAP OData V4 error responses into readable Error objects
   */
  private parseSapError(error: any): Error {
    if (error.response?.data) {
      const data = error.response.data as ODataErrorResponse;
      const message = data.error?.message;
      const details = data.error?.details || data.error?.innererror?.errordetails;

      if (details && details.length > 0) {
        const detailMessages = details.map(d => d.message).join(' | ');
        return new Error(`SAP Error: ${message || ''} (${detailMessages})`);
      }

      if (message) {
        return new Error(`SAP Error: ${message}`);
      }
    }
    return error;
  }

  /**
   * Helper for OData V4 query building with $expand, $filter, etc.
   */
  public get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.get<T>(url, config);
  }

  public post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.post<T>(url, data, config);
  }

  public patch<T = any>(url: string, data?: any, etag?: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    const headers: Record<string, any> = { ...config?.headers };
    if (etag) {
      headers['If-Match'] = etag;
    }
    return this.instance.patch<T>(url, data, { ...config, headers });
  }

  public delete<T = any>(url: string, etag?: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    const headers: Record<string, any> = { ...config?.headers };
    if (etag) {
      headers['If-Match'] = etag;
    }
    return this.instance.delete<T>(url, { ...config, headers });
  }
}

export const odataClient = new SapODataClient();
export default odataClient;
