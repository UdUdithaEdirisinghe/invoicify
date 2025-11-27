const DB_KEYS = { DOCUMENTS: 'invoicify_docs', SETTINGS: 'invoicify_settings', CUSTOMERS: 'invoicify_customers' };

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
    static saveSettings(settings) { localStorage.setItem(DB_KEYS.SETTINGS, JSON.stringify(settings)); }
    static getDocuments() { const data = localStorage.getItem(DB_KEYS.DOCUMENTS); return data ? JSON.parse(data) : []; }
    static saveDocument(doc) {
        const docs = this.getDocuments();
        const index = docs.findIndex(d => d.id === doc.id);
        if (index >= 0) docs[index] = doc; else docs.push(doc);
        localStorage.setItem(DB_KEYS.DOCUMENTS, JSON.stringify(docs));
        this.saveCustomer({ name: doc.customer.name, email: doc.customer.email });
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
}