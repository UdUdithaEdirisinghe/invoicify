import Store from './store.js';
import Router from './router.js';
import PdfGenerator from './pdf-generator.js';

class App {
    constructor() {
        this.state = {
            currentDoc: this.getEmptyDoc(),
            settings: Store.getSettings()
        };
        this.applyTheme(this.state.settings.themeColor);
        this.router = new Router(null, (hash) => this.handleRouteChange(hash));
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadCustomers();
        this.renderDashboard();
    }

    applyTheme(color) {
        if(color) {
            document.documentElement.style.setProperty('--primary', color);
        }
    }

    getEmptyDoc() {
        return {
            id: Store.generateId(),
            type: 'invoice',
            pageSize: 'a4',
            number: 'INV-' + Date.now().toString().slice(-4),
            date: new Date().toISOString().split('T')[0],
            dueDate: '',
            customer: { name: '', email: '', phone: '', address: '' },
            items: [],
            totals: { subtotal: 0, tax: 0, discount: 0, shipping: 0, grandTotal: 0 },
            notes: ''
        };
    }

    handleRouteChange(hash) {
        if (hash === 'dashboard') this.renderDashboard();
        if (hash === 'documents') this.renderDocList();
        if (hash === 'customers') this.renderCustomers();
        if (hash === 'settings') this.renderSettings();
        if (hash === 'editor') {
            if(!this.isEditing) {
                this.state.currentDoc = this.getEmptyDoc();
                this.populateEditor();
            }
            this.isEditing = false;
        }
    }

    setupEventListeners() {
        ['doc-type', 'doc-size', 'doc-number', 'doc-date', 'doc-due-date', 'doc-notes', 'cust-name', 'cust-email', 'cust-phone', 'cust-address', 'discount-val', 'discount-type', 'shipping-val']
            .forEach(id => {
                const el = document.getElementById(id);
                if(el) el.addEventListener('input', (e) => this.updateDocState(e));
            });

        document.getElementById('btn-add-row').addEventListener('click', () => {
            this.state.currentDoc.items.push({ name: '', qty: 1, price: 0, tax: 0, total: 0 });
            this.renderLineItems();
            this.calculateTotals();
        });

        document.getElementById('btn-save').addEventListener('click', () => {
            Store.saveDocument(this.state.currentDoc);
            alert('Draft Saved!');
            this.renderDashboard();
        });

        document.getElementById('btn-generate-pdf').addEventListener('click', () => {
            const fullDoc = { ...this.state.currentDoc, business: this.state.settings };
            PdfGenerator.generate(fullDoc);
        });

        document.getElementById('btn-save-settings').addEventListener('click', async () => {
            const settings = {
                name: document.getElementById('biz-name').value,
                address: document.getElementById('biz-address').value,
                email: document.getElementById('biz-email').value,
                phone: document.getElementById('biz-phone').value,
                bankName: document.getElementById('bank-name').value,
                branch: document.getElementById('bank-branch').value,
                accountNo: document.getElementById('bank-acc').value,
                themeColor: document.getElementById('biz-color').value,
                currency: document.getElementById('biz-currency').value,
                showBankDetails: document.getElementById('show-bank-details').checked,
                logoUrl: this.state.settings.logoUrl
            };

            const fileInput = document.getElementById('biz-logo');
            if (fileInput.files.length > 0) {
                settings.logoUrl = await this.readFileAsBase64(fileInput.files[0]);
            }

            Store.saveSettings(settings);
            this.state.settings = settings;
            this.applyTheme(settings.themeColor);
            document.getElementById('logo-preview').src = settings.logoUrl || '';
            alert('Settings Saved');
            this.renderPreview(); 
        });

        document.getElementById('btn-clear-logo').addEventListener('click', () => {
            this.state.settings.logoUrl = '';
            document.getElementById('logo-preview').src = '';
            document.getElementById('biz-logo').value = '';
        });
    }

    readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    populateEditor() {
        const doc = this.state.currentDoc;
        document.getElementById('doc-type').value = doc.type;
        document.getElementById('doc-size').value = doc.pageSize || 'a4';
        document.getElementById('doc-number').value = doc.number;
        document.getElementById('doc-date').value = doc.date;
        document.getElementById('doc-due-date').value = doc.dueDate || '';
        document.getElementById('doc-notes').value = doc.notes || '';
        document.getElementById('cust-name').value = doc.customer.name;
        document.getElementById('cust-email').value = doc.customer.email;
        document.getElementById('cust-phone').value = doc.customer.phone || '';
        document.getElementById('cust-address').value = doc.customer.address;
        this.renderLineItems();
        this.calculateTotals();
    }

    renderLineItems() {
        const tbody = document.getElementById('line-items-body');
        tbody.innerHTML = '';
        this.state.currentDoc.items.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><input type="text" value="${item.name}" data-idx="${index}" data-field="name"></td>
                <td><input type="number" value="${item.qty}" data-idx="${index}" data-field="qty"></td>
                <td><input type="number" value="${item.price}" data-idx="${index}" data-field="price"></td>
                <td><input type="number" value="${item.tax}" data-idx="${index}" data-field="tax"></td>
                <td><span class="text-danger" data-idx="${index}">&times;</span></td>
            `;
            tbody.appendChild(tr);
        });
        tbody.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', (e) => {
                const idx = e.target.dataset.idx;
                const field = e.target.dataset.field;
                this.state.currentDoc.items[idx][field] = e.target.value;
                this.calculateTotals();
            });
        });
        tbody.querySelectorAll('.text-danger').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = e.target.dataset.idx;
                this.state.currentDoc.items.splice(idx, 1);
                this.renderLineItems();
                this.calculateTotals();
            });
        });
    }

    calculateTotals() {
        const doc = this.state.currentDoc;
        let subtotal = 0;
        let taxTotal = 0;
        doc.items.forEach(item => {
            const qty = parseFloat(item.qty) || 0;
            const price = parseFloat(item.price) || 0;
            const tax = parseFloat(item.tax) || 0;
            const lineTotal = qty * price;
            const lineTax = lineTotal * (tax / 100);
            item.total = lineTotal + lineTax;
            subtotal += lineTotal;
            taxTotal += lineTax;
        });
        const discVal = parseFloat(document.getElementById('discount-val').value) || 0;
        const discType = document.getElementById('discount-type').value;
        const discount = discType === 'percent' ? subtotal * (discVal / 100) : discVal;
        const shipping = parseFloat(document.getElementById('shipping-val').value) || 0;
        doc.totals = { subtotal, tax: taxTotal, discount, shipping, grandTotal: subtotal + taxTotal - discount + shipping };
        this.renderPreview();
    }

    updateDocState(e) {
        const id = e.target.id;
        const val = e.target.value;
        const doc = this.state.currentDoc;
        if (id === 'doc-type') doc.type = val;
        if (id === 'doc-size') doc.pageSize = val;
        if (id === 'doc-number') doc.number = val;
        if (id === 'doc-date') doc.date = val;
        if (id === 'doc-due-date') doc.dueDate = val;
        if (id === 'doc-notes') doc.notes = val;
        if (id === 'cust-name') doc.customer.name = val;
        if (id === 'cust-email') doc.customer.email = val;
        if (id === 'cust-phone') doc.customer.phone = val;
        if (id === 'cust-address') doc.customer.address = val;
        if (id === 'discount-val' || id === 'discount-type') this.calculateTotals();
        this.renderPreview();
    }

    renderPreview() {
        const doc = this.state.currentDoc;
        const settings = this.state.settings;
        const currency = settings.currency || 'LKR';
        const container = document.getElementById('preview-container');
        const themeColor = settings.themeColor || '#2563eb';
        container.style.setProperty('--primary', themeColor);

        const contactInfo = [settings.email, settings.phone].filter(Boolean).join(' | ');
        const balanceLabel = (doc.type === 'quotation' || doc.type === 'estimate') ? 'Estimated Total' : 'Balance Due';
        const docTypeLabel = doc.type.charAt(0).toUpperCase() + doc.type.slice(1);

        // Calculate approximate content height (matching PDF logic)
        const pageHeight = 842; // A4 height in px (at 72dpi equivalent)
        const margin = 40;
        const bottomReserved = 80; // Space for footer
        const availableHeight = pageHeight - margin * 2 - bottomReserved;
        
        // Approximate heights
        const headerHeight = 120;
        const tableHeaderHeight = 40;
        const tableRowHeight = doc.items.reduce((h, item) => {
            return h + (item.description ? 50 : 35); // Row with description is taller
        }, 0);
        const totalsHeight = 100;
        const notesHeight = doc.notes && doc.notes.trim() ? (Math.ceil(doc.notes.length / 100) * 20 + 40) : 0;
        const bankHeight = settings.showBankDetails ? 100 : 0;
        
        const totalContentHeight = headerHeight + tableHeaderHeight + tableRowHeight + totalsHeight + notesHeight + bankHeight;
        const needsSecondPage = totalContentHeight > availableHeight;
        
        // Determine page count
        const pageCount = needsSecondPage ? 2 : 1;
        
        // Generate header content (reusable for page 2)
        const headerHtml = `
            <div class="prev-header">
                <div class="prev-logo-area">
                    ${settings.logoUrl ? `<img src="${settings.logoUrl}" style="max-height: 50px; max-width: 100px; object-fit: contain; display: block; margin-bottom: 10px;">` : `<h2 style="color: ${themeColor}; font-size: 20px; font-weight: bold; margin-bottom: 10px;">${settings.name}</h2>`}
                    ${settings.logoUrl ? `<div style="font-weight: bold; font-size: 10px; margin-bottom: 3px; color: #000;">${settings.name}</div>` : ''}
                    <div style="font-size: 9px; line-height: 1.5; color: #333; max-width: 200px;">
                        ${settings.address.replace(/\n/g, '<br>')}
                        ${contactInfo ? `<br>${contactInfo}` : ''}
                    </div>
                </div>
                <div class="prev-header-right">
                    <div class="prev-title" style="font-size: 28px; font-weight: normal; margin-bottom: 5px;">${doc.type.toUpperCase()}</div>
                    <div class="prev-inv-num" style="font-size: 8px; font-weight: bold; margin-bottom: 8px;">${docTypeLabel}# ${doc.number}</div>
                    <div style="margin-top: 8px;">
                        <div style="font-size: 9px; color: #323232; font-weight: normal; margin-bottom: 5px;">${balanceLabel}</div>
                        <div style="font-size: 14px; font-weight: bold; color: #000;">${currency} ${doc.totals.grandTotal.toFixed(2)}</div>
                    </div>
                </div>
            </div>

            <div class="prev-info-row" style="margin-top: 50px; margin-bottom: 20px;">
                <div class="prev-bill-to">
                    <div style="font-size: 10px; color: #000; margin-bottom: 5px;">Bill To</div>
                    <div style="font-weight: bold; font-size: 11px; color: #000; margin-bottom: 5px;">${doc.customer.name || 'Client Name'}</div>
                    <div style="font-size: 10px; color: #333; line-height: 1.5;">${doc.customer.address ? doc.customer.address.replace(/\n/g, '<br>') : ''}</div>
                    ${doc.customer.phone ? `<div style="font-size: 10px; color: #333; margin-top: 3px;">Phone: ${doc.customer.phone}</div>` : ''}
                    ${doc.customer.email ? `<div style="font-size: 10px; color: #333; margin-top: 2px;">Email: ${doc.customer.email}</div>` : ''}
                </div>
                <div class="prev-dates">
                    <div style="display: flex; justify-content: flex-end; gap: 15px; margin-bottom: 3px; font-size: 10px;">
                        <span style="min-width: 100px; text-align: right; color: #000;">Invoice Date :</span>
                        <span style="min-width: 100px; text-align: right; color: #000;">${doc.date}</span>
                    </div>
                    ${doc.dueDate ? `<div style="display: flex; justify-content: flex-end; gap: 15px; margin-bottom: 3px; font-size: 10px;">
                        <span style="min-width: 100px; text-align: right; color: #000;">Due Date :</span>
                        <span style="min-width: 100px; text-align: right; color: #000;">${doc.dueDate}</span>
                    </div>` : ''}
                </div>
            </div>
        `;

        const itemsHtml = doc.items.map((i, idx) => `
            <tr><td style="text-align: left;">${idx + 1}</td><td style="text-align: left;">${i.name || ''}${i.description ? '<br><small style="color:#666;">' + i.description + '</small>' : ''}</td><td style="text-align: right;">${i.qty}</td><td style="text-align: right;">${Number(i.price).toFixed(2)}</td><td style="text-align: right;">${Number(i.total).toFixed(2)}</td></tr>
        `).join('');

        const totalsRowsHtml = `
            <tr>
                <td colspan="4" style="text-align: right; padding: 6px 10px 6px 0; font-size: 12px; color: #000; font-weight: normal; border-bottom: 1px solid #ddd;">Sub Total</td>
                <td style="text-align: right; padding: 6px 10px; font-size: 12px; color: #000; font-weight: 500; border-bottom: 1px solid #ddd;">${doc.totals.subtotal.toFixed(2)}</td>
            </tr>
            ${doc.totals.tax > 0 ? `<tr>
                <td colspan="4" style="text-align: right; padding: 6px 10px 6px 0; font-size: 12px; color: #000; font-weight: normal; border-bottom: 1px solid #ddd;">Tax</td>
                <td style="text-align: right; padding: 6px 10px; font-size: 12px; color: #000; font-weight: 500; border-bottom: 1px solid #ddd;">${doc.totals.tax.toFixed(2)}</td>
            </tr>` : ''}
            ${doc.totals.discount > 0 ? `<tr>
                <td colspan="4" style="text-align: right; padding: 6px 10px 6px 0; font-size: 12px; color: #000; font-weight: normal; border-bottom: 1px solid #ddd;">Discount</td>
                <td style="text-align: right; padding: 6px 10px; font-size: 12px; color: #000; font-weight: 500; border-bottom: 1px solid #ddd;">-${doc.totals.discount.toFixed(2)}</td>
            </tr>` : ''}
            ${doc.totals.shipping > 0 ? `<tr>
                <td colspan="4" style="text-align: right; padding: 6px 10px 6px 0; font-size: 12px; color: #000; font-weight: normal; border-bottom: 1px solid #ddd;">Shipping</td>
                <td style="text-align: right; padding: 6px 10px; font-size: 12px; color: #000; font-weight: 500; border-bottom: 1px solid #ddd;">${doc.totals.shipping.toFixed(2)}</td>
            </tr>` : ''}
            <tr>
                <td colspan="4" style="text-align: right; padding: 8px 10px 8px 0; font-size: 12px; color: #000; font-weight: bold; border-top: 2px solid #333; border-bottom: 1px solid #ddd;">Total</td>
                <td style="text-align: right; padding: 8px 10px; font-size: 12px; color: #000; font-weight: bold; border-top: 2px solid #333; border-bottom: 1px solid #ddd;">${currency}${doc.totals.grandTotal.toFixed(2)}</td>
            </tr>
            <tr>
                <td colspan="4" style="text-align: right; padding: 10px 10px 10px 0; font-size: 13px; color: #000; font-weight: bold; background: #e8e8e8; border-bottom: none;">Balance Due</td>
                <td style="text-align: right; padding: 10px 10px; font-size: 13px; color: #000; font-weight: bold; background: #e8e8e8; border-bottom: none;">${currency}${doc.totals.grandTotal.toFixed(2)}</td>
            </tr>
        `;

        const notesHtml = doc.notes && doc.notes.trim() ? `
            <div style="margin-bottom: 20px; margin-top: 20px;">
                <div style="font-weight: bold; font-size: 11px; color: #000; margin-bottom: 6px;">Notes</div>
                <div style="font-size: 10px; line-height: 1.6; color: #000;">${doc.notes.replace(/\n/g, '<br>')}</div>
            </div>
        ` : '';

        const bankHtml = settings.showBankDetails ? `
            <div style="margin-top: 20px; margin-bottom: 20px;">
                <div style="font-weight: bold; font-size: 11px; color: #000; margin-bottom: 6px;">Bank details are as follows,</div>
                <div style="font-size: 10px; line-height: 1.6; color: #000;">
                    <div><span style="color: #555; display: inline-block; width: 110px;">Bank Name :</span> ${settings.bankName || 'Sampath Bank'}</div>
                    <div><span style="color: #555; display: inline-block; width: 110px;">Branch :</span> ${settings.branch || 'Kottawa'}</div>
                    <div><span style="color: #555; display: inline-block; width: 110px;">Account Name :</span> ${settings.name}</div>
                    <div><span style="color: #555; display: inline-block; width: 110px;">Account Number :</span> ${settings.accountNo || '0052 1001 0639'}</div>
                </div>
            </div>
        ` : '';

        // Build pages
        if (pageCount === 1) {
            container.innerHTML = `
                <div class="paper">
                    ${headerHtml}
                    <table class="prev-table" style="margin-bottom: 20px;">
                        <thead><tr><th width="30">#</th><th>Item & Description</th><th width="50" class="text-right">Qty</th><th width="80" class="text-right">Rate</th><th width="80" class="text-right">Amount</th></tr></thead>
                        <tbody>
                            ${itemsHtml}
                            ${totalsRowsHtml}
                        </tbody>
                    </table>
                    ${notesHtml}
                    ${bankHtml}
                    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ccc; text-align: center; font-size: 8px; color: #666;">
                        ${contactInfo} | Page 1 of 1
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="paper" style="margin-bottom: 20px;">
                    ${headerHtml}
                    <table class="prev-table">
                        <thead><tr><th width="30">#</th><th>Item & Description</th><th width="50" class="text-right">Qty</th><th width="80" class="text-right">Rate</th><th width="80" class="text-right">Amount</th></tr></thead>
                        <tbody>${itemsHtml}</tbody>
                    </table>
                    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ccc; text-align: center; font-size: 8px; color: #666;">
                        ${contactInfo} | Page 1 of 2
                    </div>
                </div>
                <div class="paper">
                    <table class="prev-table" style="margin-bottom: 20px;">
                        <tbody>
                            ${totalsRowsHtml}
                        </tbody>
                    </table>
                    ${notesHtml}
                    ${bankHtml}
                    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ccc; text-align: center; font-size: 8px; color: #666;">
                        ${contactInfo} | Page 2 of 2
                    </div>
                </div>
            `;
        }
    }

    renderDashboard() {
        const docs = Store.getDocuments();
        const settings = Store.getSettings();
        const currency = settings.currency || 'LKR';
        const totalRev = docs.reduce((acc, d) => acc + (d.totals?.grandTotal || 0), 0);
        document.getElementById('dash-total-docs').textContent = docs.length;
        document.getElementById('dash-revenue').textContent = `${currency} ` + totalRev.toFixed(2);
        document.querySelector('#dash-table tbody').innerHTML = docs.slice(-5).reverse().map(d => `<tr><td>${d.number}</td><td style="text-transform:capitalize">${d.type}</td><td>${d.customer.name}</td><td>${d.date}</td><td>${currency} ${d.totals.grandTotal.toFixed(2)}</td></tr>`).join('');
    }

    renderDocList() {
        const docs = Store.getDocuments();
        const settings = Store.getSettings();
        const currency = settings.currency || 'LKR';
        document.querySelector('#docs-table tbody').innerHTML = docs.map((d) => `<tr><td>${d.number}</td><td>${d.type}</td><td>${d.customer.name}</td><td>${d.date}</td><td>${currency} ${d.totals.grandTotal.toFixed(2)}</td><td><button class="btn btn-sm btn-secondary" onclick="window.editDoc('${d.id}')">Edit</button></td></tr>`).join('');
        window.editDoc = (id) => {
            const doc = docs.find(d => d.id === id);
            if(doc) {
                this.state.currentDoc = JSON.parse(JSON.stringify(doc)); 
                this.isEditing = true;
                this.router.navigate('editor');
                this.populateEditor();
            }
        };
    }

    renderCustomers() {
        const customers = Store.getCustomers();
        document.querySelector('#customers-table tbody').innerHTML = customers.map(c => `<tr><td>${c.name}</td><td>${c.email}</td></tr>`).join('');
        document.getElementById('customer-list').innerHTML = customers.map(c => `<option value="${c.name}">`).join('');
    }

    renderSettings() {
        const s = this.state.settings;
        document.getElementById('biz-name').value = s.name;
        document.getElementById('biz-address').value = s.address;
        document.getElementById('biz-email').value = s.email || '';
        document.getElementById('biz-phone').value = s.phone || '';
        document.getElementById('bank-name').value = s.bankName || '';
        document.getElementById('bank-branch').value = s.branch || '';
        document.getElementById('bank-acc').value = s.accountNo || '';
        document.getElementById('biz-color').value = s.themeColor || '#2563eb';
        document.getElementById('biz-currency').value = s.currency || 'LKR';
        document.getElementById('show-bank-details').checked = s.showBankDetails !== false;
        if(s.logoUrl) document.getElementById('logo-preview').src = s.logoUrl;
    }
    loadCustomers() { this.renderCustomers(); }
}

const app = new App();