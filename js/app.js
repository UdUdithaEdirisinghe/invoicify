import Store from './store.js';
import Router from './router.js';
import PdfGenerator from './pdf-generator.js';
import ApiClient from './api-client.js';

class App {
    constructor() {
        this.state = {
            currentDoc: this.getEmptyDoc(),
            settings: Store.getSettings(),
            products: []
        };
        this.applyTheme(this.state.settings.themeColor);
        this.router = new Router(null, (hash) => this.handleRouteChange(hash));
        this.init();
    }

    init() {
        this.loadSettings();
        this.setupEventListeners();
        this.loadCustomers();
        this.loadProducts();
    }
    
    async loadSettings() {
        try {
            this.state.settings = await Store.getSettingsAsync();
            this.applyTheme(this.state.settings.themeColor);
        } catch (err) {
            console.warn('Failed to load settings:', err);
            this.state.settings = Store.getSettings();
        }
    }

    async loadProducts() {
        try {
            if (ApiClient.isAuthenticated()) {
                const data = await ApiClient.getProducts();
                // Accept { data: [...] }, { products: [...] }, or raw array
                const arr = (data && (data.data || data.products)) || (Array.isArray(data) ? data : []);
                this.state.products = arr || [];
            } else {
                // Fallback to local inventory when offline/not authenticated
                this.state.products = Store.getProducts();
                // Toggle error/empty banners based on products loaded
                const errorBanner = document.getElementById('product-error');
                const emptyState = document.getElementById('product-empty');
                if (errorBanner) errorBanner.style.display = 'none';
                if (emptyState) emptyState.style.display = this.state.products.length ? 'none' : 'block';
            }
        } catch (err) {
            console.warn('Failed to load products:', err);
            this.state.products = Store.getProducts();
        }
        // Ensure editor updates and doesn't render blank
        try { this.renderLineItems(); this.renderPreview(); } catch (_) { /* noop */ }
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
            items: [ { name: '', qty: 1, price: 0, tax: 0, total: 0, productId: null } ],
            totals: { subtotal: 0, tax: 0, discount: 0, shipping: 0, grandTotal: 0 },
            notes: ''
        };
    }

    handleRouteChange(hash) {
        if (hash === 'documents') this.renderDocList();
        if (hash === 'customers') this.renderCustomers();
        if (hash === 'settings') this.renderSettings();
        if (hash === 'editor') {
            // Reload settings to get latest changes
            this.loadSettings();
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
            this.state.currentDoc.items.push({ name: '', qty: 1, price: 0, tax: 0, total: 0, productId: null });
            this.renderLineItems();
            this.calculateTotals();
        });

        document.getElementById('btn-save').addEventListener('click', async () => {
            const res = await Store.saveDocumentAsync(this.state.currentDoc);
            this.showToast(res.remote ? 'Saved to cloud!' : 'Draft Saved locally!', 'success');
            if (res.remote) {
                window.location.href = '/dashboard.html';
            } else {
                this.router.navigate('documents');
                this.renderDocList();
            }
        });

        document.getElementById('btn-generate-pdf').addEventListener('click', async () => {
            // Deduct inventory before generating PDF
            let inventoryUpdated = false;
            try {
                // Build consolidated deductions, matching by productId or exact name
                const buildConsolidated = () => {
                    const map = new Map();
                    for (const item of this.state.currentDoc.items) {
                        let pid = item.productId;
                        if (!pid && item.name) {
                            const match = this.state.products.find(p => (p.name || '').toLowerCase() === item.name.toLowerCase());
                            if (match) {
                                pid = match.id;
                                item.productId = match.id; // link for future consistency
                                if ((!item.price || Number(item.price) === 0) && match.unit_price) {
                                    item.price = parseFloat(match.unit_price);
                                }
                            }
                        }
                        if (pid) {
                            const qty = parseInt(item.qty) || 0;
                            const prev = map.get(pid) || 0;
                            map.set(pid, prev + qty);
                        }
                    }
                    return map;
                };

                const consolidated = buildConsolidated();

                if (ApiClient.isAuthenticated()) {
                    // Deduct stock remotely by updating product quantity
                    for (const [productId, totalQty] of consolidated.entries()) {
                        const prod = this.state.products.find(p => String(p.id) === String(productId));
                        const currentQty = prod ? (parseInt(prod.current_quantity) || 0) : 0;
                        const newQty = Math.max(0, currentQty - totalQty);
                        await ApiClient.updateProduct(productId, { current_quantity: newQty });
                    }
                    // Refresh remote inventory
                    const data = await ApiClient.getProducts();
                    const arr = (data && (data.data || data.products)) || (Array.isArray(data) ? data : []);
                    this.state.products = arr || [];
                    inventoryUpdated = true;
                } else {
                    // Local-only deduction
                    this.state.products = (this.state.products || []).map(p => {
                        const deduct = consolidated.get(String(p.id)) || consolidated.get(p.id) || 0;
                        if (deduct > 0) {
                            const newQty = Math.max(0, (parseInt(p.current_quantity) || 0) - deduct);
                            return { ...p, current_quantity: newQty };
                        }
                        return p;
                    });
                    Store.saveProducts(this.state.products);
                    inventoryUpdated = true;
                }
            } catch (err) {
                console.error('Inventory deduction failed:', err);
                this.showToast('Failed to update inventory: ' + (err.message || 'Unknown error'), 'warning');
            }
            
            // Reload settings from server before generating PDF
            try {
                this.state.settings = await Store.getSettingsAsync();
            } catch (err) {
                console.error('Failed to reload settings:', err);
            }
            
            const fullDoc = { ...this.state.currentDoc, business: this.state.settings };
            PdfGenerator.generate(fullDoc);
            this.showToast(inventoryUpdated ? 'PDF generated and inventory updated!' : 'PDF generated successfully!', 'success');
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

            const result = await Store.saveSettingsAsync(settings);
            this.state.settings = settings;
            this.applyTheme(settings.themeColor);
            document.getElementById('logo-preview').src = settings.logoUrl || '';
            this.showToast(result.remote ? 'Settings saved to cloud!' : 'Settings saved locally', 'success');
            this.renderPreview(); 
        });

        document.getElementById('btn-clear-logo').addEventListener('click', () => {
            this.state.settings.logoUrl = '';
            document.getElementById('logo-preview').src = '';
            document.getElementById('biz-logo').value = '';
        });

        // Modal Preview wiring
        const previewBtn = document.getElementById('btn-preview');
        const previewModal = document.getElementById('preview-modal');
        const previewClose = document.getElementById('preview-close');
        const previewCloseFooter = document.getElementById('preview-close-footer');
        const dlFromPreview = document.getElementById('btn-generate-pdf-from-preview');
        if (previewBtn && previewModal) {
            previewBtn.addEventListener('click', () => {
                this.renderPreview('preview-modal-body');
                previewModal.classList.add('active');
            });
        }
        const closePreview = () => { if (previewModal) previewModal.classList.remove('active'); };
        if (previewClose) previewClose.addEventListener('click', closePreview);
        if (previewCloseFooter) previewCloseFooter.addEventListener('click', closePreview);
        if (dlFromPreview) dlFromPreview.addEventListener('click', () => {
            const btn = document.getElementById('btn-generate-pdf');
            if (btn) btn.click();
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
        
        // Check for duplicates
        const duplicateProducts = new Set();
        const productCounts = {};
        this.state.currentDoc.items.forEach(item => {
            if (item.productId) {
                productCounts[item.productId] = (productCounts[item.productId] || 0) + 1;
                if (productCounts[item.productId] > 1) {
                    duplicateProducts.add(item.productId);
                }
            }
        });
        
        const LOW_STOCK_THRESHOLD = 5;
        this.state.currentDoc.items.forEach((item, index) => {
            const tr = document.createElement('tr');
            const product = item.productId ? this.state.products.find(p => String(p.id) === String(item.productId)) : null;
            const qtyAvail = product ? (parseInt(product.current_quantity) || 0) : '';
            const stockState = typeof qtyAvail === 'number' ? (qtyAvail <= 0 ? 'out' : (qtyAvail <= LOW_STOCK_THRESHOLD ? 'low' : 'ok')) : null;
            const isDuplicate = item.productId && duplicateProducts.has(item.productId);
            const badgeHtml = stockState ? (
                stockState === 'out'
                    ? `<span class="badge badge-out inline-badge"><i class="ph ph-warning"></i> Out of stock</span>`
                    : stockState === 'low'
                        ? `<span class="badge badge-low inline-badge"><i class="ph ph-warning"></i> Low stock (${qtyAvail})</span>`
                        : `<span class="stock-badge inline-badge">Available: ${qtyAvail}</span>`
            ) : '';

            tr.innerHTML = `
                <td>
                    <div class="item-cell">
                        <div class="line-item-input-wrap">
                            <input type="text" value="${item.name}" data-idx="${index}" data-field="name" placeholder="Type product name..." class="line-item-input ${isDuplicate ? 'duplicate-warning' : ''}" autocomplete="off">
                        </div>
                        ${badgeHtml}
                    </div>
                    <div class="product-suggestions" id="suggestions-${index}"></div>
                    ${isDuplicate ? `<small class="duplicate-badge">⚠️ Duplicate item - consider merging</small>` : ''}
                </td>
                <td><input type="number" value="${item.qty}" data-idx="${index}" data-field="qty" min="1" class="line-item-input"></td>
                <td><input type="number" value="${item.price}" data-idx="${index}" data-field="price" step="0.01" min="0" class="line-item-input"></td>
                <td><input type="number" value="${item.tax}" data-idx="${index}" data-field="tax" step="0.01" min="0" class="line-item-input"></td>
                <td><button class="btn-delete-line" data-idx="${index}" title="Remove"><i class="ph ph-trash"></i></button></td>
            `;
            tbody.appendChild(tr);
        });

        // Product name auto-fill with live suggestions
        tbody.querySelectorAll('input[data-field="name"]').forEach(input => {
            const idx = input.dataset.idx;
            const suggestionsDiv = document.getElementById(`suggestions-${idx}`);
            
            // Show suggestions on input and keep state in sync
            input.addEventListener('input', (e) => {
                const raw = e.target.value || '';
                // Persist typed name so re-render doesn't clear it
                this.state.currentDoc.items[idx].name = raw;
                // If user edits name away from selected product, clear productId link
                const selectedProd = this.state.products.find(p => p.id === this.state.currentDoc.items[idx].productId);
                if (selectedProd && selectedProd.name !== raw) {
                    delete this.state.currentDoc.items[idx].productId;
                }

                const query = raw.toLowerCase();
                if (!query) {
                    suggestionsDiv.innerHTML = '';
                    suggestionsDiv.style.display = 'none';
                    return;
                }
                
                const matches = this.state.products.filter(p => 
                    (p.name || '').toLowerCase().includes(query)
                ).slice(0, 5);
                
                if (matches.length > 0) {
                    suggestionsDiv.innerHTML = matches.map(p => {
                        const price = Number(p.unit_price).toFixed(2);
                        const qty = parseInt(p.current_quantity) || 0;
                        const status = qty <= 0 ? 'out' : (qty <= LOW_STOCK_THRESHOLD ? 'low' : 'ok');
                        const statusEl = status === 'out' 
                            ? `<span class="badge badge-out"><i class="ph ph-warning"></i> Out</span>`
                            : status === 'low' 
                                ? `<span class="badge badge-low"><i class="ph ph-warning"></i> Low</span>`
                                : '';
                        return `<div class="suggestion-item" data-product-id="${p.id}" data-product-name="${p.name}" data-product-price="${p.unit_price}">
                            <strong>${p.name}</strong>
                            <span class="suggestion-stock">Stock: ${qty}</span>
                            ${statusEl}
                            <span class="suggestion-price">LKR ${price}</span>
                        </div>`;
                    }).join('');
                    suggestionsDiv.style.display = 'block';
                } else {
                    suggestionsDiv.innerHTML = '';
                    suggestionsDiv.style.display = 'none';
                }
            });
            
            // Select suggestion
            input.addEventListener('click', (e) => {
                if (this.state.products.length > 0 && !e.target.value) {
                    const matches = this.state.products.slice(0, 5);
                    suggestionsDiv.innerHTML = matches.map(p => {
                        const price = Number(p.unit_price).toFixed(2);
                        const qty = parseInt(p.current_quantity) || 0;
                        const status = qty <= 0 ? 'out' : (qty <= LOW_STOCK_THRESHOLD ? 'low' : 'ok');
                        const statusEl = status === 'out' 
                            ? `<span class="badge badge-out"><i class="ph ph-warning"></i> Out</span>`
                            : status === 'low' 
                                ? `<span class="badge badge-low"><i class="ph ph-warning"></i> Low</span>`
                                : '';
                        return `<div class="suggestion-item" data-product-id="${p.id}" data-product-name="${p.name}" data-product-price="${p.unit_price}">
                            <strong>${p.name}</strong>
                            <span class="suggestion-stock">Stock: ${qty}</span>
                            ${statusEl}
                            <span class="suggestion-price">LKR ${price}</span>
                        </div>`;
                    }).join('');
                    suggestionsDiv.style.display = 'block';
                }
            });
            
            // Handle suggestion selection before input blur
            suggestionsDiv.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const item = e.target.closest('.suggestion-item');
                if (!item) return;
                
                const productId = item.dataset.productId;
                const productName = item.dataset.productName;
                const productPrice = item.dataset.productPrice;
                
                // Check for duplicates
                const existingIndex = this.state.currentDoc.items.findIndex((i, index) => 
                    index !== parseInt(idx) && i.productId === productId
                );
                
                if (existingIndex !== -1) {
                    const confirmMerge = confirm(`This product is already added in line ${existingIndex + 1}. Do you want to merge quantities?`);
                    if (confirmMerge) {
                        this.state.currentDoc.items[existingIndex].qty = 
                            (parseInt(this.state.currentDoc.items[existingIndex].qty) || 0) + 
                            (parseInt(this.state.currentDoc.items[idx].qty) || 1);
                        this.state.currentDoc.items.splice(idx, 1);
                        this.renderLineItems();
                        this.calculateTotals();
                        return;
                    }
                }
                
                // Update state
                this.state.currentDoc.items[idx].productId = productId;
                this.state.currentDoc.items[idx].name = productName;
                this.state.currentDoc.items[idx].price = parseFloat(productPrice) || 0;
                
                // Update UI
                input.value = productName;
                suggestionsDiv.innerHTML = '';
                suggestionsDiv.style.display = 'none';
                
                // Update price input directly in DOM before re-render
                const priceInput = tbody.querySelector(`input[data-idx="${idx}"][data-field="price"]`);
                if (priceInput) {
                    priceInput.value = productPrice;
                }
                
                // Re-render to show stock badge and recalculate
                this.renderLineItems();
                this.calculateTotals();
            });
            
            // Hide suggestions on blur (with delay for click to register)
            input.addEventListener('blur', () => {
                setTimeout(() => {
                    suggestionsDiv.style.display = 'none';
                }, 200);
            });
        });

        tbody.querySelectorAll('input[data-field="qty"], input[data-field="price"], input[data-field="tax"]').forEach(input => {
            input.addEventListener('input', (e) => {
                const idx = e.target.dataset.idx;
                const field = e.target.dataset.field;
                this.state.currentDoc.items[idx][field] = e.target.value;
                this.calculateTotals();
            });
        });

        tbody.querySelectorAll('.btn-delete-line').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = e.currentTarget.dataset.idx;
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
        if (id === 'discount-val' || id === 'discount-type' || id === 'shipping-val') this.calculateTotals();
        this.renderPreview();
    }

    renderPreview(targetId) {
        const doc = this.state.currentDoc;
        const settings = this.state.settings;
        const currency = settings.currency || 'LKR';
        const container = document.getElementById(targetId || 'preview-container');
        if (!container) return;
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
            <div class="prev-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 50px;">
                <div class="prev-logo-area" style="flex: 1;">
                    ${settings.logoUrl ? `<img src="${settings.logoUrl}" style="max-height: 50px; max-width: 100px; object-fit: contain; display: block; margin-bottom: 10px;">` : `<h2 style="color: ${themeColor}; font-size: 20px; font-weight: bold; margin: 0 0 10px 0;">${settings.name}</h2>`}
                    ${settings.logoUrl ? `<div style="font-weight: bold; font-size: 10px; margin-bottom: 3px; color: #000;">${settings.name}</div>` : ''}
                    <div style="font-size: 9px; line-height: 1.5; color: #333; max-width: 200px;">
                        ${settings.address.replace(/\n/g, '<br>')}
                        ${contactInfo ? `<br>${contactInfo}` : ''}
                    </div>
                </div>
                <div class="prev-header-right" style="text-align: right;">
                    <div style="font-size: 28px; font-weight: normal; margin: 0 0 5px 0; letter-spacing: 1px;">${doc.type.toUpperCase()}</div>
                    <div style="font-size: 8px; font-weight: bold; margin-bottom: 10px;">${docTypeLabel}# ${doc.number}</div>
                    <div style="margin-top: 10px;">
                        <div style="font-size: 9px; color: #323232; margin-bottom: 5px;">${balanceLabel}</div>
                        <div style="font-size: 14px; font-weight: bold; color: #000;">${currency} ${doc.totals.grandTotal.toFixed(2)}</div>
                    </div>
                </div>
            </div>

            <div class="prev-info-row" style="display: flex; justify-content: space-between; margin-bottom: 30px;">
                <div class="prev-bill-to" style="flex: 1;">
                    <div style="font-size: 10px; color: #000; margin-bottom: 6px;">Bill To</div>
                    <div style="font-weight: bold; font-size: 11px; color: #000; margin-bottom: 6px;">${doc.customer.name || 'Client Name'}</div>
                    ${doc.customer.address ? `<div style="font-size: 10px; color: #333; line-height: 1.5;">${doc.customer.address.replace(/\n/g, '<br>')}</div>` : ''}
                    ${doc.customer.phone || doc.customer.email ? `<div style="font-size: 10px; color: #333; margin-top: 5px;">${[doc.customer.phone, doc.customer.email].filter(Boolean).join(' | ')}</div>` : ''}
                </div>
                <div class="prev-dates" style="text-align: right; min-width: 200px;">
                    <div style="margin-bottom: 5px;">
                        <div style="font-size: 10px; color: #000;">Invoice Date :</div>
                        <div style="font-size: 10px; color: #000; margin-top: 2px;">${doc.date}</div>
                    </div>
                    ${doc.dueDate ? `<div style="margin-top: 10px;">
                        <div style="font-size: 10px; color: #000;">Due Date :</div>
                        <div style="font-size: 10px; color: #000; margin-top: 2px;">${doc.dueDate}</div>
                    </div>` : ''}
                </div>
            </div>
        `;

        const itemsHtml = doc.items.map((i, idx) => `
            <tr>
                <td class="text-center">${idx + 1}</td>
                <td class="text-left">${i.name || ''}${i.description ? '<br><small style="color:#666;">' + i.description + '</small>' : ''}</td>
                <td class="text-center">${i.qty}</td>
                <td class="text-right">${Number(i.price).toFixed(2)}</td>
                <td class="text-right">${Number(i.total).toFixed(2)}</td>
            </tr>
        `).join('');

        const totalsRowsHtml = `
            <tr>
                <td colspan="4" class="text-right">Sub Total</td>
                <td class="text-right">${doc.totals.subtotal.toFixed(2)}</td>
            </tr>
            ${doc.totals.tax > 0 ? `<tr>
                <td colspan="4" class="text-right">Tax</td>
                <td class="text-right">${doc.totals.tax.toFixed(2)}</td>
            </tr>` : ''}
            ${doc.totals.discount > 0 ? `<tr>
                <td colspan="4" class="text-right">Discount</td>
                <td class="text-right">-${doc.totals.discount.toFixed(2)}</td>
            </tr>` : ''}
            ${doc.totals.shipping > 0 ? `<tr>
                <td colspan="4" class="text-right">Shipping</td>
                <td class="text-right">${doc.totals.shipping.toFixed(2)}</td>
            </tr>` : ''}
            <tr class="totals-top">
                <td colspan="4" class="text-right"><strong>Total</strong></td>
                <td class="text-right"><strong>${currency}${doc.totals.grandTotal.toFixed(2)}</strong></td>
            </tr>
            <tr class="balance-due">
                <td colspan="4" class="text-right"><strong>Balance Due</strong></td>
                <td class="text-right"><strong>${currency}${doc.totals.grandTotal.toFixed(2)}</strong></td>
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
                    <table class="prev-table" style="margin-bottom: 6mm;">
                        <thead><tr><th>#</th><th>Item & Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
                        <tbody>
                            ${itemsHtml}
                            ${totalsRowsHtml}
                        </tbody>
                    </table>
                    ${notesHtml}
                    ${bankHtml}
                    <div style="margin-top: 10mm; padding-top: 5mm; border-top: 0.3px solid #ccc; text-align: center; font-size: 8px; color: #666;">
                        ${contactInfo} | Page 1 of 1
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="paper" style="margin-bottom: 20px;">
                    ${headerHtml}
                    <table class="prev-table">
                        <thead><tr><th>#</th><th>Item & Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
                        <tbody>${itemsHtml}</tbody>
                    </table>
                    <div style="margin-top: 10mm; padding-top: 5mm; border-top: 0.3px solid #ccc; text-align: center; font-size: 8px; color: #666;">
                        ${contactInfo} | Page 1 of 2
                    </div>
                </div>
                <div class="paper">
                    <table class="prev-table" style="margin-bottom: 6mm;">
                        <tbody>
                            ${totalsRowsHtml}
                        </tbody>
                    </table>
                    ${notesHtml}
                    ${bankHtml}
                    <div style="margin-top: 10mm; padding-top: 5mm; border-top: 0.3px solid #ccc; text-align: center; font-size: 8px; color: #666;">
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

    async renderDocList() {
        const docs = await Store.getDocumentsAsync();
        const settings = Store.getSettings();
        const currency = settings.currency || 'LKR';
        const tbody = document.querySelector('#docs-table tbody');
        if (!tbody) return;
        if (!docs || docs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 12px; color:#666;">No documents yet. Click + New to create one.</td></tr>`;
        } else {
            tbody.innerHTML = docs.map((d) => `<tr><td>${d.number}</td><td>${d.type}</td><td>${d.customer.name}</td><td>${d.date}</td><td>${currency} ${d.totals.grandTotal.toFixed(2)}</td><td><button class="btn btn-sm btn-secondary" onclick="window.editDoc('${d.id}')">Edit</button></td></tr>`).join('');
        }
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
        try {
            const customers = Store.getCustomers();
            const tbody = document.querySelector('#customers-table tbody');
            const datalist = document.getElementById('customer-list');
            if (tbody) {
                if (!customers || customers.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; padding:20px; color:#666;">No customers yet</td></tr>';
                } else {
                    tbody.innerHTML = customers.map(c => `<tr><td>${c.name}</td><td>${c.email}</td></tr>`).join('');
                }
            }
            if (datalist) {
                datalist.innerHTML = customers.map(c => `<option value="${c.name}">`).join('');
            }
        } catch (err) {
            console.error('Failed to load customers:', err);
        }
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
    async loadCustomers() { 
        try {
            this.renderCustomers(); 
        } catch (err) {
            console.warn('Failed to load customers:', err);
        }
    }

    // Toast notification helper
    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.textContent = message;
            toast.className = `toast toast-${type} show`;
            setTimeout(() => toast.classList.remove('show'), 3000);
        }
    }
}

const app = new App();