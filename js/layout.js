// Shared layout injection for consistent sidebar across pages
import { setupLogout } from './auth.js';

function buildSidebar() {
  const items = [
    { href: '/dashboard.html', icon: 'house', label: 'Dashboard' },
    { section: 'Sales', items: [ { href: '/index.html', icon: 'file-text', label: 'Invoices' } ] },
    { section: 'Customers', items: [ { href: '/customers.html', icon: 'users', label: 'Customers' } ] },
    { section: 'Purchases', items: [ { href: '/suppliers.html', icon: 'truck', label: 'Suppliers' }, { href: '/purchase-orders.html', icon: 'shopping-cart', label: 'Purchase Orders' } ] },
    { section: 'Inventory', items: [ { href: '/inventory.html', icon: 'package', label: 'Products' } ] },
    { section: 'Accounting', items: [ { href: '/expenses.html', icon: 'receipt', label: 'Expenses' } ] },
    { section: 'Reports', items: [ { href: '/reports.html', icon: 'chart-line', label: 'Reports' } ] },
    { section: 'System', items: [ { href: '/settings.html', icon: 'gear', label: 'Settings' } ] }
  ];

  const path = window.location.pathname;
  let html = '<div class="sidebar-header"><h1>Invoicify</h1><p class="sidebar-subtitle">ERP System</p></div><nav class="sidebar-nav">';

  // First flat dashboard item
  html += `<a href="/dashboard.html" class="nav-item${path.endsWith('/dashboard.html') ? ' active' : ''}"><i class="ph ph-house"></i><span>Dashboard</span></a>`;

  for (const block of items.filter(b => b.section)) {
    html += `<div class="nav-section"><div class="nav-section-title">${block.section}</div>`;
    for (const link of block.items) {
      const active = path.endsWith(link.href) ? ' active' : '';
      html += `<a href="${link.href}" class="nav-item${active}"><i class="ph ph-${link.icon}"></i><span>${link.label}</span></a>`;
    }
    html += '</div>';
  }
  html += '</nav><div class="sidebar-footer"><button class="btn btn-secondary btn-block logout-btn"><i class="ph ph-sign-out"></i><span>Logout</span></button></div>';
  return html;
}

function ensureSidebar() {
  const existing = document.querySelector('.sidebar');
  if (existing) {
    existing.innerHTML = buildSidebar();
  } else {
    const aside = document.createElement('aside');
    aside.className = 'sidebar';
    aside.innerHTML = buildSidebar();
    const container = document.querySelector('.app-container');
    if (container) container.prepend(aside);
  }
  // Wire logout
  setupLogout();
}

// Run after DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ensureSidebar);
} else {
  ensureSidebar();
}
