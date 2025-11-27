// API Client with JWT authentication
class ApiClient {
  constructor() {
    // Use relative paths for Vercel deployment
    this.baseURL = window.location.origin;
  }

  getToken() {
    return localStorage.getItem('auth_token');
  }

  setToken(token) {
    localStorage.setItem('auth_token', token);
  }

  removeToken() {
    localStorage.removeItem('auth_token');
  }

  getAuthHeaders() {
    const token = this.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    const config = {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...options.headers
      }
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Request failed');
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Auth endpoints
  async register(username, password) {
    const data = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    
    if (data.token) {
      this.setToken(data.token);
    }
    
    return data;
  }

  async login(username, password) {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    
    if (data.token) {
      this.setToken(data.token);
    }
    
    return data;
  }

  async verifyToken() {
    try {
      return await this.request('/api/auth/verify', {
        method: 'GET'
      });
    } catch (error) {
      this.removeToken();
      throw error;
    }
  }

  logout() {
    this.removeToken();
    window.location.href = '/login.html';
  }

  // Invoice endpoints
  async createInvoice(invoiceData) {
    return await this.request('/api/invoices/create', {
      method: 'POST',
      body: JSON.stringify({ invoiceData })
    });
  }

  async getInvoices() {
    return await this.request('/api/invoices/list', {
      method: 'GET'
    });
  }

  async getInvoice(id) {
    return await this.request(`/api/invoices/get?id=${id}`, {
      method: 'GET'
    });
  }

  async deleteInvoice(id) {
    return await this.request(`/api/invoices/delete?id=${id}`, {
      method: 'DELETE'
    });
  }

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.getToken();
  }
}

export default new ApiClient();
