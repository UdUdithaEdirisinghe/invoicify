// API Client with JWT authentication
class ApiClient {
  constructor() {
    // Use relative paths for Vercel deployment
    this.baseURL = window.location.origin;
  }

  // Generic fetch alias used across pages
  async fetch(endpoint, options = {}) {
    // Ensure JSON body is stringified
    const opts = { ...options };
    if (opts.body && typeof opts.body !== 'string') {
      opts.body = JSON.stringify(opts.body);
    }
    return this.request(endpoint, opts);
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
  async register(username, email, password, businessDetails = {}) {
    const data = await this.request('/api/auth?action=register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password, ...businessDetails })
    });
    
    if (data.token) {
      this.setToken(data.token);
    }
    
    return data;
  }

  async login(email, password) {
    const data = await this.request('/api/auth?action=login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    
    if (data.token) {
      this.setToken(data.token);
    }
    
    return data;
  }

  async verifyToken() {
    try {
      return await this.request('/api/auth?action=me', {
        method: 'POST'
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
    return await this.request('/api/invoices', {
      method: 'POST',
      body: JSON.stringify(invoiceData)
    });
  }

  async getInvoices(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return await this.request(`/api/invoices${queryString ? '?' + queryString : ''}`, {
      method: 'GET'
    });
  }

  async getInvoice(id) {
    return await this.request(`/api/invoices?id=${id}`, {
        async updateInvoice(id, invoiceData) {
          return await this.request(`/api/invoices?id=${id}`, {
            method: 'PUT',
            body: JSON.stringify(invoiceData)
          });
        }

      method: 'GET'
    });
  }

  async deleteInvoice(id) {
    return await this.request(`/api/invoices?id=${id}`, {
      method: 'DELETE'
    });
  }

  // Settings endpoints
  async getSettings() {
    return await this.request('/api/settings', {
      method: 'GET'
    });
  }

  async saveSettings(settings) {
    return await this.request('/api/settings', {
      method: 'POST',
      body: JSON.stringify(settings)
    });
  }

  // Customer endpoints
  async getCustomers(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return await this.request(`/api/customers${queryString ? '?' + queryString : ''}`, {
      method: 'GET'
    });
  }

  async getCustomer(id) {
    return await this.request(`/api/customers?id=${id}`, {
      method: 'GET'
    });
  }

  async createCustomer(customerData) {
    return await this.request('/api/customers', {
      method: 'POST',
      body: JSON.stringify(customerData)
    });
  }

  async updateCustomer(id, customerData) {
    return await this.request(`/api/customers?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify(customerData)
    });
  }

  async deleteCustomer(id, hard = false) {
    return await this.request(`/api/customers?id=${id}${hard ? '&hard=true' : ''}`, {
      method: 'DELETE'
    });
  }

  // Supplier endpoints
  async getSuppliers(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return await this.request(`/api/suppliers${queryString ? '?' + queryString : ''}`, {
      method: 'GET'
    });
  }

  async getSupplier(id) {
    return await this.request(`/api/suppliers?id=${id}`, {
      method: 'GET'
    });
  }

  async createSupplier(supplierData) {
    return await this.request('/api/suppliers', {
      method: 'POST',
      body: JSON.stringify(supplierData)
    });
  }

  async updateSupplier(id, supplierData) {
    return await this.request(`/api/suppliers?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify(supplierData)
    });
  }

  async deleteSupplier(id, hard = false) {
    return await this.request(`/api/suppliers?id=${id}${hard ? '&hard=true' : ''}`, {
      method: 'DELETE'
    });
  }

  // Purchase Order endpoints
  async getPurchaseOrders(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return await this.request(`/api/purchase-orders${queryString ? '?' + queryString : ''}`, {
      method: 'GET'
    });
  }

  async getPurchaseOrder(id) {
    return await this.request(`/api/purchase-orders?id=${id}`, {
      method: 'GET'
    });
  }

  async createPurchaseOrder(poData) {
    return await this.request('/api/purchase-orders', {
      method: 'POST',
      body: JSON.stringify(poData)
    });
  }

  async updatePurchaseOrder(id, poData) {
    return await this.request(`/api/purchase-orders?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify(poData)
    });
  }

  async deletePurchaseOrder(id) {
    return await this.request(`/api/purchase-orders?id=${id}`, {
      method: 'DELETE'
    });
  }

  // Expense endpoints
  async getExpenses(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return await this.request(`/api/expenses${queryString ? '?' + queryString : ''}`, {
      method: 'GET'
    });
  }

  async getExpense(id) {
    return await this.request(`/api/expenses?id=${id}`, {
      method: 'GET'
    });
  }

  async createExpense(expenseData) {
    return await this.request('/api/expenses', {
      method: 'POST',
      body: JSON.stringify(expenseData)
    });
  }

  async updateExpense(id, expenseData) {
    return await this.request(`/api/expenses?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify(expenseData)
    });
  }

  async deleteExpense(id) {
    return await this.request(`/api/expenses?id=${id}`, {
      method: 'DELETE'
    });
  }

  // Expense Category endpoints
  async getExpenseCategories() {
    return await this.request('/api/expenses?categories=true', {
      method: 'GET'
    });
  }

  async createExpenseCategory(categoryData) {
    return await this.request('/api/expenses?categories=true', {
      method: 'POST',
      body: JSON.stringify(categoryData)
    });
  }

  async deleteExpenseCategory(id) {
    return await this.request(`/api/expenses?categories=true&id=${id}`, {
      method: 'DELETE'
    });
  }

  // Product/Inventory endpoints
  async getProducts(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return await this.request(`/api/products${queryString ? '?' + queryString : ''}`, {
      method: 'GET'
    });
  }

  async getProduct(id) {
    return await this.request(`/api/products?id=${id}`, {
      method: 'GET'
    });
  }

  async createProduct(productData) {
    return await this.request('/api/products', {
      method: 'POST',
      body: JSON.stringify(productData)
    });
  }

  async updateProduct(id, productData) {
    return await this.request(`/api/products?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify(productData)
    });
  }

  async deleteProduct(id) {
    return await this.request(`/api/products?id=${id}`, {
      method: 'DELETE'
    });
  }

  async getProductCategories() {
    return await this.request('/api/products?categories=true', {
      method: 'GET'
    });
  }

  async createProductCategory(categoryData) {
    return await this.request('/api/products?categories=true', {
      method: 'POST',
      body: JSON.stringify(categoryData)
    });
  }

  async deleteProductCategory(id) {
    return await this.request(`/api/products?categories=true&id=${id}`, {
      method: 'DELETE'
    });
  }

  // Payment endpoints (kept for future use)
  async getPayments(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return await this.request(`/api/payments${queryString ? '?' + queryString : ''}`, {
      method: 'GET'
    });
  }

  async createPayment(paymentData) {
    return await this.request('/api/payments', {
      method: 'POST',
      body: JSON.stringify(paymentData)
    });
  }

  async deletePayment(id) {
    return await this.request(`/api/payments?id=${id}`, {
      method: 'DELETE'
    });
  }

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.getToken();
  }
}

export default new ApiClient();
