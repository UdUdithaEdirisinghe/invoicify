import Api from './api-client.js';

const DB_KEYS = { DOCUMENTS: 'invoicify_docs', SETTINGS: 'invoicify_settings', CUSTOMERS: 'invoicify_customers', INVENTORY: 'invoicify_inventory' };

export default class Store {
    static getSettings() {
        const data = localStorage.getItem(DB_KEYS.SETTINGS);
        const defaults = { 
            name: 'My Business', address: '123 Tech Street', email: 'email@business.com', phone: '', 
            bankName: 'Local Bank', branch: 'Main City', accountNo: '000-000-000',
            logoUrl: '', themeColor: '#2563eb', pageSize: 'a4', currency: 'LKR', showBankDetails: true
        };
        return data ? { ...defaults, ...JSON.parse(data) } : defaults;
    }
    
    static async getSettingsAsync() {
        if (Api.isAuthenticated()) {
            try {
                const settings = await Api.getSettings();
                // Map API response to local format
                const localSettings = {
                    name: settings.businessName || '',
                    address: settings.address || '',
                    email: settings.email || '',
                    phone: settings.phone || '',
                    currency: settings.currency || 'LKR',
                    themeColor: settings.themeColor || '#2563eb',
                    logoUrl: settings.logo || '', // API uses 'logo', local uses 'logoUrl'
                    bankName: settings.bankName || '',
                    branch: settings.bankBranch || '',
                    accountNo: settings.bankAccount || '', // API uses 'bankAccount', local uses 'accountNo'
                    showBankDetails: settings.showBankDetails || false
                };
                // Cache locally
                localStorage.setItem(DB_KEYS.SETTINGS, JSON.stringify(localSettings));
                return localSettings;
            } catch (error) {
                console.error('Failed to load settings from server:', error);
                return this.getSettings(); // Fallback to local
            }
        }
        return this.getSettings();
    }
    
    static saveSettings(settings) { 
        localStorage.setItem(DB_KEYS.SETTINGS, JSON.stringify(settings)); 
    }
    
    static async saveSettingsAsync(settings) {
        // Save locally first
        this.saveSettings(settings);
        
        if (Api.isAuthenticated()) {
            try {
                // Map to API format
                await Api.saveSettings({
                    businessName: settings.name || '',
                    address: settings.address || '',
                    email: settings.email || '',
                    phone: settings.phone || '',
                    currency: settings.currency || 'LKR',
                    themeColor: settings.themeColor || '#2563eb',
                    logo: settings.logoUrl || '', // Local uses 'logoUrl', API uses 'logo'
                    bankName: settings.bankName || '',
                    bankBranch: settings.branch || '',
                    bankAccount: settings.accountNo || '', // Local uses 'accountNo', API uses 'bankAccount'
                    showBankDetails: settings.showBankDetails !== undefined ? settings.showBankDetails : false
                });
                return { success: true, remote: true };
            } catch (error) {
                console.error('Failed to save settings to server:', error);
                return { success: true, remote: false };
            }
        }
        return { success: true, remote: false };
    }
    static getDocuments() { const data = localStorage.getItem(DB_KEYS.DOCUMENTS); return data ? JSON.parse(data) : []; }
    static async getDocumentsAsync() {
        if (Api.isAuthenticated()) {
            const resp = await Api.getInvoices();
            const docs = (resp.invoices || []).map(i => ({ id: `remote-${i.id}`, ...i.data }));
            return docs;
        }
        return this.getDocuments();
    }
    static saveDocument(doc) {
        const docs = this.getDocuments();
        const index = docs.findIndex(d => d.id === doc.id);
        if (index >= 0) docs[index] = doc; else docs.push(doc);
        localStorage.setItem(DB_KEYS.DOCUMENTS, JSON.stringify(docs));
        this.saveCustomer({ name: doc.customer.name, email: doc.customer.email });
    }
    static async saveDocumentAsync(doc) {
        if (Api.isAuthenticated()) {
            await Api.createInvoice(doc);
            this.saveCustomer({ name: doc.customer.name, email: doc.customer.email });
            return { remote: true };
        }
        this.saveDocument(doc);
        return { remote: false };
    }
    static getCustomers() { const data = localStorage.getItem(DB_KEYS.CUSTOMERS); return data ? JSON.parse(data) : []; }
    static saveCustomer(customer) {
        if(!customer.name) return;
        const customers = this.getCustomers();
        if (!customers.find(c => c.name.toLowerCase() === customer.name.toLowerCase())) {
            customers.push(customer);
            localStorage.setItem(DB_KEYS.CUSTOMERS, JSON.stringify(customers));
        }
    }
    static generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2); }

    // --- Inventory (Local-only fallback) ---
    static getProducts() {
        const data = localStorage.getItem(DB_KEYS.INVENTORY);
        return data ? JSON.parse(data) : [];
    }
    static saveProducts(products) {
        localStorage.setItem(DB_KEYS.INVENTORY, JSON.stringify(products || []));
    }
}