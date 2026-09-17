// HTML escape helper: use global esc() from /assets/escape.js or fallback
const esc = typeof window !== 'undefined' && window.esc ? window.esc : s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

// public/app.js - Embun Laundry Single Page App
const App = window.App = {
  user: null,
  currentPage: 'dashboard',

  async init() {
    this.initTheme();
    if (typeof document !== 'undefined' && !document.getElementById('mainContent')) {
      return;
    }
    this.initRipple();
    this.initMobileSidebar();
    this.setupContentObserver();
    this.checkAuth();
    this.bindEvents();
  },

  initTheme() {
    let theme = 'light';
    try {
      const saved = localStorage.getItem('theme');
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      theme = saved || (prefersDark ? 'dark' : 'light');
    } catch (e) {}
    this.applyTheme(theme);

    // Cross-tab theme sync
    window.addEventListener('storage', (e) => {
      if (e.key === 'theme' && e.newValue) {
        this.applyTheme(e.newValue);
      }
    });
  },

  applyTheme(theme) {
    const isDark = theme === 'dark';
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
    this.updateThemeIcons(isDark);
  },

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem('theme', next);
    } catch (e) {}
    this.applyTheme(next);
  },

  updateThemeIcons(isDark) {
    const icons = document.querySelectorAll('#themeIcon, .theme-icon');
    icons.forEach(el => {
      el.textContent = isDark ? '☀️' : '🌙';
    });
  },

  // D6: Micro-interaction ripple feedback on buttons
  initRipple() {
    if (this._rippleInitialized) return;
    this._rippleInitialized = true;
    if (typeof document === 'undefined') return;
    document.addEventListener('pointerdown', e => {
      const btn = e.target && e.target.closest && e.target.closest('.btn, .btn-primary, .tabbtn, .tab');
      if (!btn || btn.disabled || (btn.classList && btn.classList.contains('disabled'))) return;
      const rect = btn.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;
      btn.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
      setTimeout(() => { if (ripple.parentNode) ripple.remove(); }, 650);
    }, { passive: true });
  },

  // D7: Responsive Mobile Drawer Navigation
  initMobileSidebar() {
    if (this._sidebarInitialized) return;
    this._sidebarInitialized = true;
    if (typeof document === 'undefined') return;

    document.addEventListener('click', (e) => {
      const toggle = e.target.closest('#sidebarToggleBtn, .sidebar-toggle-btn');
      if (toggle) {
        e.preventDefault();
        this.toggleMobileSidebar();
        return;
      }

      const closeBtn = e.target.closest('#sidebarCloseBtn, .sidebar-close-btn');
      if (closeBtn) {
        e.preventDefault();
        this.closeMobileSidebar();
        return;
      }

      const overlay = e.target.closest('#sidebarOverlay, .sidebar-overlay');
      if (overlay) {
        e.preventDefault();
        this.closeMobileSidebar();
        return;
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeMobileSidebar();
        // close any open modal (order/invoice/proof/promo/voucher)
        document.querySelectorAll('[id$="Modal"], [id$="Wrap"]').forEach(el => {
          if (el.style && el.style.display !== 'none') el.style.display = 'none';
        });
      }
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => {
        if (window.innerWidth > 1024) {
          this.closeMobileSidebar();
        }
      }, { passive: true });
    }
  },

  openMobileSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('#sidebarOverlay, .sidebar-overlay');
    if (sidebar) sidebar.classList.add('open');
    if (overlay) overlay.classList.add('open');
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.add('sidebar-locked');
    }
  },

  closeMobileSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('#sidebarOverlay, .sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.remove('sidebar-locked');
    }
  },

  toggleMobileSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar && sidebar.classList.contains('open')) {
      this.closeMobileSidebar();
    } else {
      this.openMobileSidebar();
    }
  },

  // D8: Entrance Animation & IntersectionObserver for Dashboard Cards/Sections
  setupContentObserver() {
    if (this._mutationObsInitialized || typeof window === 'undefined' || typeof document === 'undefined') return;
    this._mutationObsInitialized = true;
    const c = document.getElementById('mainContent');
    if (!c || !('MutationObserver' in window)) return;

    let debounceTimer;
    const mo = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.initScrollReveal(c);
      }, 40);
    });
    mo.observe(c, { childList: true, subtree: false });
  },

  animateKpis(rootEl) {
    const root = rootEl || (typeof document !== 'undefined' ? document.getElementById('mainContent') : null);
    if (!root || typeof window === 'undefined') return;
    const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    root.querySelectorAll('.kpi-value').forEach(el => {
      const target = Number(el.getAttribute('data-count') || 0);
      if (!isFinite(target)) return;
      const cur = el.getAttribute('data-currency') === '1';
      const suffix = el.querySelector('span') ? ' <span style="font-size:14px;font-weight:600;color:var(--muted)">order</span>' : '';
      const fmt = v => cur ? 'Rp ' + Math.round(v).toLocaleString('id-ID') : Math.round(v).toLocaleString('id-ID') + suffix;
      if (prefersReduced) { el.innerHTML = fmt(target); return; }
      const dur = 700;
      const start = performance.now();
      const step = now => {
        const p = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.innerHTML = fmt(target * eased);
        if (p < 1) requestAnimationFrame(step);
        else el.innerHTML = fmt(target);
      };
      requestAnimationFrame(step);
    });
  },

  initScrollReveal(rootEl = (typeof document !== 'undefined' ? document.getElementById('mainContent') : null)) {
    if (!rootEl || typeof window === 'undefined' || typeof document === 'undefined') return;
    const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const items = rootEl.querySelectorAll('.kpi, .card, .panel, .kcol, .bento-cell');

    if (!('IntersectionObserver' in window) || prefersReduced) {
      items.forEach(el => el.classList.add('show'));
      return;
    }

    if (this._scrollObserver) {
      this._scrollObserver.disconnect();
    }

    this._scrollObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('show');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -20px 0px' });

    items.forEach((el, idx) => {
      if (!el.classList.contains('reveal')) {
        el.classList.add('reveal');
        el.style.setProperty('--delay', `${(idx % 4) * 60}ms`);
      }
      this._scrollObserver.observe(el);
    });
  },

  // D3: Skeleton Loading & D4: Empty State Helpers
  renderSkeletonTable({ columns = 5, rows = 5, hasActions = true } = {}) {
    const headerCols = Array.from({ length: columns }).map((_, i) =>
      `<th style="padding: 12px 10px;"><div class="skeleton skeleton-text" style="width: ${i === 0 ? '40px' : (i === columns - 1 ? '60px' : '70%')}; margin: 0;"></div></th>`
    ).join('');

    const bodyRows = Array.from({ length: rows }).map(() => `
      <tr style="border-bottom: 1px solid var(--line);">
        ${Array.from({ length: columns }).map((_, i) => {
          if (hasActions && i === columns - 1) {
            return `<td style="padding: 12px 10px; text-align: right;"><div class="skeleton skeleton-btn" style="width: 70px; height: 28px;"></div></td>`;
          }
          const widths = ['50px', '85%', '65%', '45%', '75%', '55%'];
          const w = widths[i % widths.length];
          return `<td style="padding: 12px 10px;"><div class="skeleton skeleton-text" style="width: ${w}; margin: 0;"></div></td>`;
        }).join('')}
      </tr>
    `).join('');

    return `
      <div class="skeleton-table-wrap" aria-busy="true" aria-label="Memuat data tabel...">
        <table class="skeleton-table">
          <thead>
            <tr style="border-bottom: 2px solid var(--line);">
              ${headerCols}
            </tr>
          </thead>
          <tbody>
            ${bodyRows}
          </tbody>
        </table>
      </div>
    `;
  },

  renderSkeletonCards(count = 4) {
    return `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px;" aria-busy="true" aria-label="Memuat ringkasan...">
        ${Array.from({ length: count }).map(() => `
          <div class="skeleton-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <div class="skeleton skeleton-text" style="width: 45%; height: 12px; margin: 0;"></div>
              <div class="skeleton" style="width: 28px; height: 28px; border-radius: 8px;"></div>
            </div>
            <div class="skeleton skeleton-title" style="width: 60%; height: 26px; margin-bottom: 8px;"></div>
            <div class="skeleton skeleton-text" style="width: 75%; height: 11px; margin: 0;"></div>
          </div>
        `).join('')}
      </div>
    `;
  },

  renderEmptyState({ icon = '📦', title = 'Belum Ada Data', subtitle = 'Data yang Anda cari saat ini belum tersedia atau belum dibuat.', actionHtml = '' } = {}) {
    return `
      <div class="empty-state" role="status">
        <div class="empty-state-icon">${esc(icon)}</div>
        <div class="empty-state-title">${esc(title)}</div>
        <div class="empty-state-subtitle">${esc(subtitle)}</div>
        ${actionHtml}
      </div>
    `;
  },

  // Rentang tanggal cepat untuk filter pesanan (audit #17).
  // Pakai tanggal LOKAL (bukan toISOString = UTC) — B12: zona operasional
  // Asia/Jakarta, toISOString menggeser tanggal 7 jam di WIB.
  _presetStart(key) {
    const d = new Date();
    const iso = x => `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;
    if (key === 'today') return iso(d);
    if (key === '7d') { const x = new Date(d); x.setDate(x.getDate() - 6); return iso(x); }
    if (key === 'month') return iso(new Date(d.getFullYear(), d.getMonth(), 1));
    return '';
  },

  // Undo toast: tampilkan aksi + tombol "Batal" selama 5 detik.
  // onUndo dipanggil jika user menekan sebelum habis.
  undoToast(msg, onUndo) {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      container.setAttribute('role', 'status');
      container.setAttribute('aria-live', 'polite');
      document.body.appendChild(container);
    }
    const el = document.createElement('div');
    el.className = 'toast-item toast-info';
    let left = 5;
    el.innerHTML = `<span>ℹ️</span><span>${esc(msg)}</span><button type="button"
      style="margin-left:auto;border:1px solid var(--line);background:var(--bg);color:var(--text);
      padding:4px 12px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer">Batal (<span class="_undoLeft">${left}</span>)</button>`;
    container.appendChild(el);
    setTimeout(() => el.classList.add('show'), 10);
    const tick = setInterval(() => {
      left -= 1;
      const n = el.querySelector('._undoLeft');
      if (n) n.textContent = Math.max(0, left);
      if (left <= 0) clearInterval(tick);
    }, 1000);
    const done = () => { clearInterval(tick); el.classList.remove('show'); setTimeout(() => el.remove(), 350); };
    el.querySelector('button').onclick = () => { done(); try { onUndo(); } catch (e) {} };
    setTimeout(done, 5200);
  },

  toast(msg, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      container.setAttribute('role', 'status');
      container.setAttribute('aria-live', 'polite');
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    const icon = type === 'success' ? '✅' : (type === 'error' ? '❌' : (type === 'warning' ? '⚠️' : 'ℹ️'));
    toast.innerHTML = `<span>${icon}</span><span>${esc(msg)}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 350);
    }, 3200);
  },

  confirm(msg, opts = {}) {
    const { okLabel = 'Hapus', okClass = '' } = opts;
    return new Promise(resolve => {
      // remove any existing confirm dialog
      const old = document.getElementById('_appConfirm');
      if (old) old.remove();
      const el = document.createElement('div');
      el.id = '_appConfirm';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      el.setAttribute('aria-label', msg);
      el.style.cssText = 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.55);backdrop-filter:blur(2px)';
      const okBg = okClass === 'danger' ? 'var(--red)' : okClass === 'primary' ? 'var(--blue)' : 'var(--red)';
      el.innerHTML = `<div style="background:var(--card);border-radius:14px;padding:28px 28px 22px;max-width:360px;width:90%;box-shadow:var(--shadow-card);border:1px solid var(--line);">
        <p style="margin:0 0 20px;font-size:15px;font-weight:600;color:var(--text);line-height:1.5">${esc(msg)}</p>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button id="_confirmNo" style="padding:8px 18px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--text);font-size:13px;font-weight:600;cursor:pointer">Batal</button>
          <button id="_confirmYes" style="padding:8px 18px;border-radius:8px;border:none;background:${okBg};color:#fff;font-size:13px;font-weight:600;cursor:pointer">${esc(okLabel)}</button>
        </div>
      </div>`;
      document.body.appendChild(el);
      const cleanup = ok => { el.remove(); resolve(ok); };
      // haptic feedback on mobile for confirm dialogs (delete/pay/copy actions)
      if (navigator.vibrate) navigator.vibrate(10);
      el.querySelector('#_confirmYes').onclick = () => { if (navigator.vibrate) navigator.vibrate(10); cleanup(true); };
      el.querySelector('#_confirmNo').onclick  = () => cleanup(false);
      el.addEventListener('click', e => { if (e.target === el) cleanup(false); });
    });
  },

  // C5: Invoice PDF & Cetak Struk Kasir
  _currentInvoiceOrder: null,
  _invoiceMode: 'thermal',

  async openInvoice(orderIdOrCode) {
    let order = (this._orders || []).find(o => String(o.id) === String(orderIdOrCode) || o.order_code === orderIdOrCode)
      || (this._recentOrders || []).find(o => String(o.id) === String(orderIdOrCode) || o.order_code === orderIdOrCode);

    if (!order) {
      try {
        const res = await fetch(`/api/orders?q=${encodeURIComponent(orderIdOrCode)}`);
        const data = await res.json();
        if (data.ok && data.orders && data.orders.length > 0) {
          order = data.orders.find(o => String(o.id) === String(orderIdOrCode) || o.order_code === orderIdOrCode) || data.orders[0];
        }
      } catch (err) {}
    }

    if (!order) {
      this.toast('Pesanan tidak ditemukan untuk invoice', 'error');
      return;
    }

    this._currentInvoiceOrder = order;
    this.renderInvoiceModal(order, this._invoiceMode);
  },

  switchInvoiceMode(mode) {
    this._invoiceMode = mode;
    if (this._currentInvoiceOrder) {
      this.renderInvoiceModal(this._currentInvoiceOrder, mode);
    }
  },

  renderInvoiceModal(o, mode = 'thermal') {
    let modal = document.getElementById('invoiceModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'invoiceModal';
      modal.className = 'invoice-modal';
      document.body.appendChild(modal);
    }

    const total = Number(o.total_amount) || 0;
    const paid = Number(o.paid_amount) || 0;
    const remaining = Math.max(0, total - paid);
    const isPaid = (o.payment_status === 'lunas') || (paid >= total && total > 0);
    const weight = Number(o.weight_kg) || 0;
    const unitPrice = weight > 0 ? Math.round(total / weight) : total;
    const dateStr = o.created_at || new Date().toISOString().slice(0, 19).replace('T', ' ');

    const qrSvg = (typeof QRCode !== 'undefined' && QRCode.svg)
      ? QRCode.svg(String(o.order_code || o.id || ''), { level: 'M', scale: 4, border: 2 })
      : `<svg width="64" height="64" viewBox="0 0 64 64" style="display:block;margin:0 auto;"><rect width="64" height="64" fill="#fff"/><path d="M4 4h20v20H4V4zm4 4v12h12V8H8zm32-4h20v20H40V4zm4 4v12h12V8H44zM4 40h20v20H4V40zm4 4v12h12V44H8zm20-32h4v8h-4zm8 0h4v4h-4zm-8 12h4v8h-4zm8 4h8v4h-8zm-8 8h4v4h-4zm16-8h4v8h-4zm-4 12h4v4h-4zm-8 4h8v4h-8zm16-4h4v8h-4zm4 4h4v8h-4zm-20 8h4v4h-4zm8 0h8v4h-8zm-8 8h12v4H28zm16-4h4v8h-4zm8-4h4v4h-4zm-4 8h8v4h-8z" fill="#0f172a"/></svg>`;

    modal.innerHTML = `
      <div class="invoice-paper ${mode === 'a4' ? 'a4-mode' : 'thermal-mode'}" style="padding: 24px; position: relative; margin: 20px auto;">
        <div class="invoice-actions no-print" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid var(--line); padding-bottom: 14px;">
          <div style="display: flex; gap: 6px;">
            <button type="button" class="btn btn-sm" onclick="App.switchInvoiceMode('thermal')" 
              style="padding: 6px 12px; font-size: 12px; font-weight: 600; border-radius: 6px; ${mode === 'thermal' ? 'background: var(--blue); color: #fff;' : 'background: var(--bg); color: var(--muted); border: 1px solid var(--line);'}">
              🧾 Struk Kasir (80mm)
            </button>
            <button type="button" class="btn btn-sm" onclick="App.switchInvoiceMode('a4')" 
              style="padding: 6px 12px; font-size: 12px; font-weight: 600; border-radius: 6px; ${mode === 'a4' ? 'background: var(--blue); color: #fff;' : 'background: var(--bg); color: var(--muted); border: 1px solid var(--line);'}">
              📄 Invoice Formal (A4)
            </button>
          </div>

          <div style="display: flex; gap: 8px;">
            <button type="button" class="btn btn-sm btn-primary" onclick="window.print()" style="padding: 6px 14px; font-size: 12px; font-weight: 600;">
              🖨️ Cetak / Simpan PDF
            </button>
            <button type="button" class="btn btn-sm" aria-label="Tutup invoice" onclick="document.getElementById('invoiceModal').style.display='none'" style="padding: 6px 10px; font-size: 12px; cursor: pointer;">
              ✕
            </button>
          </div>
        </div>

        <div id="printableInvoice">
          <div class="invoice-header-brand">
            <div style="font-size: 20px; font-weight: 900; letter-spacing: 0.5px; color: #0f172a;">EMBUN LAUNDRY</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Layanan Cuci Bersih, Cepat & Terpercaya</div>
            <div style="font-size: 11px; color: #64748b;">Jl. Babarsari No. 7, Sleman, Yogyakarta · WA: 0812-3456-7890</div>
          </div>

          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 12px;">
            <div>
              <div style="color: #64748b;">Nomor Nota:</div>
              <div style="font-weight: 800; font-size: 14px; color: #0f172a;">${esc(o.order_code || '-')}</div>
              <div style="color: #64748b; margin-top: 4px;">Tanggal: ${esc(dateStr)}</div>
            </div>
            <div style="text-align: right;">
              <div style="color: #64748b;">Pelanggan:</div>
              <div style="font-weight: 700; color: #0f172a;">${esc(o.customer_name || 'Pelanggan')}</div>
              ${o.customer_phone ? `<div style="color: #64748b;">${esc(o.customer_phone)}</div>` : ''}
            </div>
          </div>

          <table class="invoice-table">
            <thead>
              <tr>
                <th style="text-align: left;">Item / Layanan</th>
                <th style="text-align: center;">Berat/Qty</th>
                <th style="text-align: right;">Tarif</th>
                <th style="text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="font-weight: 600; color: #1e293b;">${esc(o.service_name || 'Layanan Laundry')}</td>
                <td style="text-align: center;">${weight} kg</td>
                <td style="text-align: right;">Rp ${unitPrice.toLocaleString('id-ID')}</td>
                <td style="text-align: right; font-weight: 700;">Rp ${total.toLocaleString('id-ID')}</td>
              </tr>
            </tbody>
          </table>

          <div style="border-top: 1px dashed var(--line); padding-top: 10px; margin-top: 8px;">
            <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; margin-bottom: 6px;">
              <span>TOTAL TAGIHAN:</span>
              <span style="font-size: 15px; color: var(--text);">Rp ${total.toLocaleString('id-ID')}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--green); margin-bottom: 4px;">
              <span>Jumlah Terbayar:</span>
              <span>Rp ${paid.toLocaleString('id-ID')}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: ${remaining > 0 ? 'var(--amber)' : 'var(--muted)'}; font-weight: 600; margin-bottom: 8px;">
              <span>Sisa Tagihan:</span>
              <span>Rp ${remaining.toLocaleString('id-ID')}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: ${isPaid ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)'}; border-radius: 6px; font-size: 12px; font-weight: 800; color: ${isPaid ? 'var(--green)' : 'var(--amber)'};">
              <span>STATUS PEMBAYARAN:</span>
              <span>${isPaid ? '✓ LUNAS' : '⏳ BELUM LUNAS'}</span>
            </div>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 16px; padding-top: 12px; border-top: 1px dashed var(--line);">
            <div style="flex: 1; font-size: 10px; color: #64748b; line-height: 1.4; padding-right: 12px;">
              <strong>Ketentuan:</strong><br>
              1. Pengambilan cucian wajib membawa struk / nota resmi ini.<br>
              2. Kelunturan atau kerusakan bawaan harap diinfokan saat check-in.<br>
              3. Terima kasih telah mempercayakan cucian Anda di Embun Laundry!
            </div>
            <div style="text-align: center;">
              ${qrSvg}
              <div style="font-size: 9px; color: #94a3b8; margin-top: 2px;">Scan Lacak Order</div>
            </div>
          </div>
        </div>
      </div>
    `;

    modal.style.display = 'grid';
  },

  // C4: Pratinjau Bukti Pembayaran (Transfer Bank / E-Wallet)
  async viewPaymentProof(orderCode) {
    try {
      const res = await fetch(`/api/pay?order_code=${encodeURIComponent(orderCode)}`);
      const data = await res.json();
      if (!data.ok) {
        this.toast(data.msg || 'Gagal memuat data pembayaran', 'error');
        return;
      }
      const payments = data.payments || [];
      let modal = document.getElementById('proofModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'proofModal';
        modal.className = 'invoice-modal';
        document.body.appendChild(modal);
      }
      const proofs = payments.filter(p => p.proof_image);
      modal.innerHTML = `
        <div class="card" style="border-radius:var(--radius-md);padding:24px;max-width:480px;width:100%;margin:20px auto;position:relative;box-shadow:var(--shadow-card);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:1px solid var(--line);padding-bottom:12px;">
            <div>
              <h4 style="margin:0;font-size:16px;font-weight:800;color:var(--text);">Bukti Pembayaran</h4>
              <div style="font-size:12px;color:var(--muted);font-weight:600;">Nota: ${esc(orderCode)}</div>
            </div>
            <button type="button" aria-label="Tutup bukti pembayaran" onclick="document.getElementById('proofModal').style.display='none'" style="border:none;background:var(--bg);color:var(--text);border-radius:6px;padding:6px 10px;cursor:pointer;font-weight:700;">✕</button>
          </div>
          ${proofs.length === 0 ? `
            <div style="text-align:center;padding:30px 10px;color:var(--muted);font-size:13px;">
              <div style="font-size:36px;margin-bottom:8px;">🧾</div>
              <div style="font-weight:700;color:var(--text);margin-bottom:4px;">Tidak Ada Lampiran Foto Bukti</div>
              <span style="font-size:12px;color:var(--muted);">Pembayaran langsung di kasir (tunai / QRIS) tanpa lampiran struk transfer.</span>
            </div>
          ` : proofs.map(p => `
            <div style="margin-bottom:16px;padding:12px;background:var(--bg);border:1px solid var(--line);border-radius:8px;">
              <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:8px;">
                <span style="font-weight:700;color:var(--text);">Rp ${Number(p.amount).toLocaleString('id-ID')} (${esc(p.method)})</span>
                <span style="color:var(--muted);">${esc(p.created_at || '')}</span>
              </div>
              <a href="${p.proof_image}" target="_blank" title="Buka gambar penuh" style="display:block;">
                <img src="${p.proof_image}" alt="Bukti Transfer" style="width:100%;max-height:360px;object-fit:contain;border-radius:6px;background:var(--card);border:1px solid var(--line);cursor:zoom-in;">
              </a>
              <div style="font-size:11px;color:var(--muted);margin-top:6px;text-align:right;">Klik gambar untuk memperbesar</div>
            </div>
          `).join('')}
        </div>
      `;
      modal.style.display = 'grid';
    } catch (e) {
      this.toast('Koneksi gagal', 'error');
    }
  },

  async checkAuth() {
    try {
      const res = await fetch('/api/me');
      const data = await res.json();
      if (data.ok && data.user) {
        this.user = data.user;
        this.renderApp();
      } else {
        // Show login page
        this.renderLogin();
      }
    } catch (e) {
      this.renderLogin();
    }
  },

  bindEvents() {
    window.addEventListener('popstate', () => {
      this.route();
    });
    document.addEventListener('click', (e) => {
      const toggle = e.target.closest('#themeToggleBtn, .theme-toggle-btn');
      if (toggle) {
        e.preventDefault();
        this.toggleTheme();
      }
    });
  },

  navigate(path) {
    window.history.pushState({}, '', path);
    this.route();
  },

  route() {
    const hash = window.location.pathname;
    if (hash === '/pesanan' || hash === '/pesanan.html') this.renderPesanan();
    else if (hash === '/pelanggan' || hash === '/pelanggan.html') this.renderPelanggan();
    else if (hash === '/layanan' || hash === '/layanan.html') this.renderLayanan();
    else if (hash === '/delivery' || hash === '/delivery.html') this.renderDelivery();
    else if (hash === '/laporan' || hash === '/laporan.html') this.renderLaporan();
    else if (hash === '/promo' || hash === '/promo.html') this.renderPromo();
    else if (hash === '/profile' || hash === '/profile.html') this.renderProfile();
    else this.renderDashboard();
  },

  renderLogin() {
    document.body.innerHTML = `
      <div class="auth-wrap" style="min-height: 100vh; display: grid; place-items: center; background: var(--bg); padding: 20px;">
        <div class="card" style="width: 100%; max-width: 400px; background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-lg); padding: 28px; color: var(--text);">
          <div style="text-align: center; margin-bottom: 24px;">
            <img src="/img/Logo.png" alt="Logo" style="width: 56px; height: 56px; border-radius: 12px; margin-bottom: 12px;">
            <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: var(--text);">Masuk Embun Laundry</h2>
            <p style="margin: 4px 0 0; color: var(--muted); font-size: 13px;">Kelola laundry dengan cepat & mudah</p>
          </div>
          <form id="loginForm">
            <div style="margin-bottom: 16px;">
              <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: var(--muted);">Email / Username / No. HP</label>
              <input type="text" id="loginId" required placeholder="misal: admin atau user@gmail.com" 
                style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--line); background: var(--card); color: var(--text); box-sizing: border-box;">
            </div>
            <div style="margin-bottom: 20px;">
              <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: var(--muted);">Kata Sandi</label>
              <input type="password" id="loginPass" required placeholder="••••••••" 
                style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--line); background: var(--card); color: var(--text); box-sizing: border-box;">
            </div>
            <div id="loginErr" style="display: none; color: var(--red); font-size: 13px; margin-bottom: 14px;"></div>
            <button type="submit" class="btn btn-primary" style="width: 100%; padding: 12px; border-radius: 8px; font-weight: 700; cursor: pointer;">
              Masuk Sekarang
            </button>
          </form>
          <div style="margin-top: 20px; text-align: center; font-size: 13px; color: var(--muted);">
            Belum punya akun? <a href="#" id="toRegBtn" style="color: var(--blue); text-decoration: none; font-weight: 600;">Daftar Pelanggan</a>
          </div>
        </div>
      </div>
    `;

    document.addEventListener('submit', async (e) => {
      if (e.target.id === 'loginForm') {
        e.preventDefault();
        const errEl = document.getElementById('loginErr');
        errEl.style.display = 'none';

        const identity = document.getElementById('loginId').value.trim();
        const password = document.getElementById('loginPass').value;

        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity, password })
          });
          const data = await res.json();
          if (data.ok) {
            this.user = data.user;
            this.renderApp();
          } else {
            errEl.textContent = data.msg || 'Login gagal';
            errEl.style.display = 'block';
          }
        } catch (err) {
          errEl.textContent = 'Terjadi kesalahan jaringan';
          errEl.style.display = 'block';
        }
      }
      
      if (e.target.id === 'regForm') {
        e.preventDefault();
        const errEl = document.getElementById('regErr');
        errEl.style.display = 'none';

        const full_name = document.getElementById('regName').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const phone = document.getElementById('regPhone').value.trim();
        const password = document.getElementById('regPass').value;
        const confirm = document.getElementById('regPass2').value;

        try {
          const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ full_name, email, phone, password, confirm, agree: true })
          });
          const data = await res.json();
          if (data.ok) {
            this.user = data.user;
            this.renderApp();
          } else {
            errEl.textContent = data.msg || 'Pendaftaran gagal';
            errEl.style.display = 'block';
          }
        } catch (err) {
          errEl.textContent = 'Terjadi kesalahan server';
          errEl.style.display = 'block';
        }
      }
    });

    document.addEventListener('click', (e) => {
      if (e.target.id === 'toRegBtn') {
        e.preventDefault();
        this.renderRegister();
      }
      if (e.target.id === 'toLogBtn') {
        e.preventDefault();
        this.renderLogin();
      }
    });
  },

  renderRegister() {
    document.body.innerHTML = `
      <div class="auth-wrap" style="min-height: 100vh; display: grid; place-items: center; background: var(--bg); padding: 20px;">
        <div class="card" style="width: 100%; max-width: 440px; background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-lg); padding: 28px; color: var(--text);">
          <div style="text-align: center; margin-bottom: 24px;">
            <img src="/img/Logo.png" alt="Logo" style="width: 56px; height: 56px; border-radius: 12px; margin-bottom: 12px;">
            <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: var(--text);">Buat Akun Pelanggan</h2>
            <p style="margin: 4px 0 0; color: var(--muted); font-size: 13px;">Daftar untuk mulai order & dapatkan promo</p>
          </div>
          <form id="regForm">
            <div style="margin-bottom: 14px;">
              <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: var(--muted);">Nama Lengkap</label>
              <input type="text" id="regName" required placeholder="Nama Anda" 
                style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--line); background: var(--card); color: var(--text); box-sizing: border-box;">
            </div>
            <div style="margin-bottom: 14px;">
              <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: var(--muted);">Email</label>
              <input type="email" id="regEmail" required placeholder="nama@email.com" 
                style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--line); background: var(--card); color: var(--text); box-sizing: border-box;">
            </div>
            <div style="margin-bottom: 14px;">
              <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: var(--muted);">No. Handphone / WhatsApp</label>
              <input type="tel" id="regPhone" placeholder="08xxxxxxxxxx" 
                style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--line); background: var(--card); color: var(--text); box-sizing: border-box;">
            </div>
            <div style="margin-bottom: 14px;">
              <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: var(--muted);">Kata Sandi</label>
              <input type="password" id="regPass" required placeholder="Minimal 6 karakter" 
                style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--line); background: var(--card); color: var(--text); box-sizing: border-box;">
            </div>
            <div style="margin-bottom: 16px;">
              <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: var(--muted);">Konfirmasi Kata Sandi</label>
              <input type="password" id="regPass2" required placeholder="Ulangi kata sandi" 
                style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--line); background: var(--card); color: var(--text); box-sizing: border-box;">
            </div>
            <div id="regErr" style="display: none; color: var(--red); font-size: 13px; margin-bottom: 14px;"></div>
            <button type="submit" class="btn btn-primary" style="width: 100%; padding: 12px; border-radius: 8px; font-weight: 700; cursor: pointer;">
              Daftar Sekarang
            </button>
          </form>
          <div style="margin-top: 20px; text-align: center; font-size: 13px; color: var(--muted);">
            Sudah punya akun? <a href="#" id="toLogBtn" style="color: var(--blue); text-decoration: none; font-weight: 600;">Masuk di sini</a>
          </div>
        </div>
      </div>
    `;

    // Event listeners are bound once in document.addEventListener
  },

  renderApp() {
    const isStaff = ['Admin', 'Owner', 'Staff'].includes(this.user.role || this.user.user_role);
    const userInitials = (this.user.user_name || this.user.name || 'User').slice(0, 2).toUpperCase();

    document.body.innerHTML = `
      <div id="sidebarOverlay" class="sidebar-overlay" aria-hidden="true"></div>
      <div class="wrap">
        <aside class="sidebar">
          <div class="brand" style="display: flex; align-items: center; gap: 10px; padding: 4px 6px 16px; margin-bottom: 8px; border-bottom: 1px solid var(--line);">
            <img src="/img/Logo.png" alt="Embun Laundry" class="logo-img" width="34" height="34" />
            <div style="flex: 1; min-width: 0;">
              <div class="brand-text" style="font-size: 15px; font-weight: 800; color: var(--text); line-height: 1.2;">Embun Laundry</div>
              <div style="font-size: 11px; color: var(--muted); font-weight: 500;">Cloud POS & Management</div>
            </div>
            <button id="sidebarCloseBtn" class="btn btn-icon sidebar-close-btn" type="button" aria-label="Tutup menu" title="Tutup">
              <span>✕</span>
            </button>
          </div>

          <nav class="nav">
            <div class="nav-section-title">Menu Utama</div>
            <a href="#" class="nav-link ${this.currentPage === 'dashboard' ? 'active' : ''}" data-page="dashboard">
              <span>🏠</span> <span>Dashboard</span>
            </a>
            <a href="#" class="nav-link ${this.currentPage === 'pesanan' ? 'active' : ''}" data-page="pesanan">
              <span>🧺</span> <span>${isStaff ? 'Pesanan' : 'Riwayat Pesanan'}</span>
            </a>

            <div class="nav-section-title">Operasional</div>
            ${isStaff ? `
              <a href="#" class="nav-link ${this.currentPage === 'pelanggan' ? 'active' : ''}" data-page="pelanggan">
                <span>👥</span> <span>Pelanggan</span>
              </a>
            ` : ''}
            <a href="#" class="nav-link ${this.currentPage === 'layanan' ? 'active' : ''}" data-page="layanan">
              <span>💲</span> <span>Layanan & Tarif</span>
            </a>
            <a href="#" class="nav-link ${this.currentPage === 'delivery' ? 'active' : ''}" data-page="delivery">
              <span>🚚</span> <span>Pickup & Delivery</span>
            </a>

            <div class="nav-section-title">Bisnis & Promo</div>
            <a href="#" class="nav-link ${this.currentPage === 'promo' ? 'active' : ''}" data-page="promo">
              <span>🏷️</span> <span>Promo & Voucher</span>
            </a>
            ${isStaff ? `
              <a href="#" class="nav-link ${this.currentPage === 'laporan' ? 'active' : ''}" data-page="laporan">
                <span>📑</span> <span>Laporan Keuangan</span>
              </a>
            ` : ''}
          </nav>

          <div class="side-bottom">
            <div style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; background: var(--bg); border: 1px solid var(--line); margin-bottom: 6px;">
              <div class="user-avatar-sm" style="background: linear-gradient(135deg, var(--blue), #06b6d4); color: #fff;">
                ${userInitials}
              </div>
              <div style="flex: 1; min-width: 0; overflow: hidden;">
                <div style="font-size: 13px; font-weight: 700; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  ${esc(this.user.user_name || this.user.name || 'User')}
                </div>
                <div style="font-size: 11px; color: var(--muted); display: flex; align-items: center; gap: 4px;">
                  <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--green);"></span>
                  ${esc(this.user.role || this.user.user_role || 'Customer')}
                </div>
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
              <a href="#" class="btn nav-link" data-page="profile" style="padding: 6px 10px; font-size: 12px; justify-content: center; border: 1px solid var(--line); border-radius: 8px;"><span>👤 Profil</span></a>
              <button id="logoutBtn" class="btn" style="padding: 6px 10px; font-size: 12px; border: 1px solid var(--line); border-radius: 8px; background: transparent; color: var(--red); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 4px;">
                <span>🚪 Keluar</span>
              </button>
            </div>
          </div>
        </aside>

        <section class="main">
          <div class="topbar">
            <div class="topbar-inner" style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <button id="sidebarToggleBtn" class="btn btn-icon sidebar-toggle-btn" type="button" aria-label="Buka navigasi menu" title="Menu Navigasi">
                  <span>☰</span>
                </button>
                <div>
                  <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted);">
                    <span>Embun</span> <span>/</span> <span style="color: var(--blue); font-weight: 600;">SaaS v2.5</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <div class="h1" id="pageTitle" style="font-size: 19px; font-weight: 800; margin: 0; letter-spacing: -0.01em;">Dashboard</div>
                    <div class="badge status-selesai" id="roleBadge" style="font-size: 11px; padding: 2px 8px;">● ${esc(this.user.role || this.user.user_role)}</div>
                  </div>
                </div>
              </div>
              <div style="margin-left: auto; display: flex; align-items: center; gap: 10px;">
                ${isStaff ? `
                  <button type="button" class="btn btn-primary" onclick="App.renderPesanan()" style="padding: 7px 14px; font-size: 12px; display: inline-flex; align-items: center; gap: 6px;">
                    <span>+</span> <span>Pesanan Baru</span>
                  </button>
                ` : ''}
                <button id="themeToggleBtn" class="theme-toggle-btn" type="button" aria-label="Toggle dark mode" title="Ubah Tema (Gelap / Terang)">
                  <span class="theme-icon" id="themeIcon">${document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙'}</span>
                </button>
                <div style="display: flex; align-items: center; gap: 8px; padding-left: 6px; border-left: 1px solid var(--line);">
                  <div class="user-avatar-sm" style="width: 28px; height: 28px; font-size: 11px;">
                    ${userInitials}
                  </div>
                  <span id="userName" style="font-size: 13px; font-weight: 700; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${esc(this.user.user_name || this.user.name || 'User')}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div class="content" id="mainContent">
            <!-- Dynamic Page Content Loaded Here -->
          </div>
        </section>
      </div>
    `;

    // Global Click Delegation
    document.addEventListener('click', async (e) => {
      // Sidebar Navigation
      const navLink = e.target.closest('.nav-link');
      if (navLink) {
        e.preventDefault();
        const page = navLink.getAttribute('data-page');
        if (page) {
          this.currentPage = page;
          const path = '/' + page;
          if (window.location.pathname !== path) {
            window.history.pushState({ page }, '', path);
          }
          document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
          navLink.classList.add('active');
          if (typeof window !== 'undefined' && window.innerWidth <= 1024) {
            this.closeMobileSidebar();
          }
          this.renderPage(page);
        }
      }

      // Logout
      const logoutBtn = e.target.closest('#logoutBtn');
      if (logoutBtn) {
        e.preventDefault();
        await fetch('/api/auth/logout', { method: 'POST' });
        this.user = null;
        this.renderLogin();
      }
      
      // Dashboard - New Order
      if (e.target.id === 'dashNewOrdBtn') {
        this.renderPesanan();
      }
      
      // Open New Order Modal
      if (e.target.id === 'btnFilterOrders') {
        const start = document.getElementById('filterStart')?.value || '';
        const end = document.getElementById('filterEnd')?.value || '';
        const status = document.getElementById('filterStatus')?.value || '';
        const q = document.getElementById('ordSearch')?.value || '';
        this.renderPesanan({ start, end, status, q });
      }
      if (e.target.id === 'btnResetFilterOrders') {
        this.renderPesanan({});
      }
      const presetPill = e.target.closest('.preset-pill');
      if (presetPill) {
        const key = presetPill.getAttribute('data-preset');
        this.renderPesanan({
          start: this._presetStart(key),
          end: document.getElementById('filterEnd')?.value || this._presetStart('today'),
          status: document.getElementById('filterStatus')?.value || '',
          q: document.getElementById('ordSearch')?.value || ''
        });
      }
      if (e.target.id === 'openNewOrderModal') {
        const modal = document.getElementById('orderModal');
        if (modal) modal.style.display = 'grid';
      }
      
      // Close Modal Buttons
      if (e.target.id === 'closeOrderModalBtn') {
        const modal = document.getElementById('orderModal');
        if (modal) modal.style.display = 'none';
      }
      if (e.target.id === 'openNewServiceModal') {
        this.openServiceModal();
      }
      if (e.target.id === 'closeServiceModalBtn') {
        const modal = document.getElementById('serviceModal');
        if (modal) modal.style.display = 'none';
      }
      if (e.target.id === 'openNewDeliveryModal') {
        this.openDeliveryModal();
      }
      if (e.target.id === 'closeDeliveryModalBtn') {
        const modal = document.getElementById('deliveryModal');
        if (modal) modal.style.display = 'none';
      }
      // Backdrop click dismiss
      if (e.target.classList && (e.target.classList.contains('modal-backdrop') || e.target.id === 'orderModal' || e.target.id === 'serviceModal' || e.target.id === 'deliveryModal')) {
        e.target.style.display = 'none';
      }
      
      // Delete Order
      const btnDel = e.target.closest('.btn-del');
      if (btnDel) {
        if (!await this.confirm('Hapus pesanan ini?')) return;
        const id = Number(btnDel.getAttribute('data-id'));
        // snapshot SEBELUM delete supaya bisa di-undo (relasi payments/
        // pickup_delivery/voucher_claims tetap konsisten — id & kode asli)
        const snap = (this._orders || []).find(o => Number(o.id) === id);
        const r = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete_order', id })
        });
        const data = await r.json().catch(() => ({}));
        if (!data.ok) { this.toast(data.msg || 'Gagal menghapus', 'error'); return; }
        this.renderPesanan();
        this.undoToast('Pesanan dihapus', async () => {
          if (!snap) { this.toast('Tidak dapat memulihkan', 'error'); return; }
          const rr = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'restore_order',
              id: snap.id, order_code: snap.order_code,
              user_id: snap.user_id || 0,
              customer_name: snap.customer_name, customer_phone: snap.customer_phone || '',
              customer_address: snap.customer_address || '',
              service_id: snap.service_id, weight_kg: snap.weight_kg,
              price_per_kg: snap.price_per_kg, discount: snap.discount || 0,
              total_amount: snap.total_amount, status: snap.status,
              created_at: snap.created_at, finished_at: snap.finished_at || ''
            })
          });
          const dd = await rr.json().catch(() => ({}));
          if (dd.ok) { this.toast('Pesanan dipulihkan', 'success'); }
          else { this.toast(dd.msg || 'Gagal memulihkan', 'error'); }
          this.renderPesanan();
        });
      }

    });

    // Global Submit Delegation
    document.addEventListener('submit', async (e) => {
      if (e.target.id === 'newOrderForm') {
        e.preventDefault();
        const isStaff = ['Admin', 'Owner', 'Staff'].includes(this.user.role || this.user.user_role);
        const payload = {
          action: 'create_order',
          customer_name: isStaff ? document.getElementById('ordCustName').value.trim() : this.user.user_name,
          customer_phone: document.getElementById('ordPhone').value.trim(),
          customer_address: document.getElementById('ordAddress').value.trim(),
          service_id: document.getElementById('ordService').value,
          weight_kg: document.getElementById('ordWeight').value,
          voucher_code: document.getElementById('ordVoucher').value.trim()
        };

        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.ok) {
          const modal = document.getElementById('orderModal');
          if (modal) modal.style.display = 'none';
          this.renderPesanan();
        } else {
          this.toast(data.msg || 'Gagal membuat pesanan', 'error');
        }
      }
      
      if (e.target.id === 'profileForm') {
        e.preventDefault();
        const full_name = document.getElementById('profName').value.trim();
        const phone = document.getElementById('profPhone').value.trim();
        const r = await fetch('/api/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update_profile', full_name, phone })
        });
        const resData = await r.json();
        if (resData.ok) {
          this.user.user_name = full_name;
          this.user.name = full_name;
          this.toast('Profil diperbarui', 'success');
          this.renderApp();
        } else {
          this.toast(resData.msg || 'Gagal update profil', 'error');
        }
      }
      
      if (e.target.id === 'passForm') {
        e.preventDefault();
        const old_password = document.getElementById('oldPass').value;
        const new_password = document.getElementById('newPass').value;
        const repeat_password = document.getElementById('repPass').value;
        const r = await fetch('/api/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'change_password', old_password, new_password, repeat_password })
        });
        const resData = await r.json();
        if (resData.ok) {
          this.toast('Sandi berhasil diganti', 'success');
          document.getElementById('passForm').reset();
        } else {
          this.toast(resData.msg || 'Gagal ganti sandi', 'error');
        }
      }

      if (e.target.id === 'promoForm') {
        e.preventDefault();
        const idVal = document.getElementById('promoId').value.trim();
        const codeVal = document.getElementById('promoCode').value.trim().toUpperCase();
        const nameVal = document.getElementById('promoName').value.trim();
        const typeVal = document.getElementById('promoType').value;
        const valVal = parseInt(document.getElementById('promoValue').value) || 0;
        const minSpendVal = parseInt(document.getElementById('promoMinSpend').value) || 0;
        const maxDiscVal = parseInt(document.getElementById('promoMaxDiscount').value) || 0;
        const expInput = document.getElementById('promoExpiresAt').value;
        const isActiveVal = document.getElementById('promoIsActive').checked ? 1 : 0;

        let expiresAt = null;
        if (expInput) {
          expiresAt = expInput.replace('T', ' ') + (expInput.length === 16 ? ':00' : '');
        }

        const payload = {
          action: idVal ? 'update_promo' : 'create_promo',
          code: codeVal,
          name: nameVal,
          type: typeVal,
          value: valVal,
          min_spend: minSpendVal,
          max_discount: maxDiscVal,
          expires_at: expiresAt,
          is_active: isActiveVal
        };
        if (idVal) payload.id = parseInt(idVal);

        const res = await fetch('/api/promos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.ok) {
          const modal = document.getElementById('promoModal');
          if (modal) modal.style.display = 'none';
          this.renderPromo();
        } else {
          this.toast(data.msg || 'Gagal menyimpan promo', 'error');
        }
      }

      if (e.target.id === 'grantVoucherForm') {
        e.preventDefault();
        const promoId = parseInt(document.getElementById('grantPromoId').value);
        const grantType = document.getElementById('grantType').value;
        const userIdInput = document.getElementById('grantUserId').value.trim();

        let payload = {};
        if (grantType === 'single') {
          payload = {
            action: 'create_voucher',
            promo_id: promoId,
            user_id: parseInt(userIdInput)
          };
        } else {
          const ids = userIdInput.split(',').map(s => parseInt(s.trim())).filter(n => !Number.isNaN(n) && n > 0);
          if (ids.length === 0) {
            this.toast('Masukkan minimal satu User ID valid', 'warning');
            return;
          }
          payload = {
            action: 'bulk_claim',
            promo_id: promoId,
            user_ids: ids
          };
        }

        const res = await fetch('/api/vouchers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.ok) {
          const modal = document.getElementById('grantVoucherModal');
          if (modal) modal.style.display = 'none';
          this.toast(grantType === 'single' ? 'Voucher berhasil diterbitkan!' : `Berhasil menerbitkan ${data.created || 0} voucher!`, 'success');
          this.renderPromo();
        } else {
          this.toast(data.msg || 'Gagal menerbitkan voucher', 'error');
        }
      }

      // Service Form Submit
      if (e.target.id === 'serviceForm') {
        e.preventDefault();
        const id = this._editServiceId;
        const code = document.getElementById('svcCode').value.trim();
        const name = document.getElementById('svcName').value.trim();
        const category = document.getElementById('svcCategory').value.trim();
        const unit = document.getElementById('svcUnit').value;
        const price = parseInt(document.getElementById('svcPrice').value) || 0;
        const est_hours = parseInt(document.getElementById('svcHours').value) || 24;
        const badge = document.getElementById('svcBadge')?.value.trim() || null;
        const description = document.getElementById('svcDesc')?.value.trim() || '';
        const is_active = document.getElementById('svcActive').checked ? 1 : 0;

        const payload = {
          action: id ? 'update_service' : 'create_service',
          ...(id ? { id: Number(id) } : {}),
          code, name, category, unit, price, est_hours, badge, description, is_active
        };

        const res = await fetch('/api/services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.ok) {
          const modal = document.getElementById('serviceModal');
          if (modal) modal.style.display = 'none';
          this.toast(id ? 'Layanan berhasil diubah' : 'Layanan baru berhasil ditambahkan', 'success');
          this.renderLayanan();
        } else {
          this.toast(data.msg || 'Gagal menyimpan layanan', 'error');
        }
      }

      // Delivery Form Submit
      if (e.target.id === 'deliveryForm') {
        e.preventDefault();
        const isStaff = ['Admin', 'Owner', 'Staff'].includes(this.user.role || this.user.user_role);
        const type = document.getElementById('dlvType').value;
        const customer_name = isStaff ? document.getElementById('dlvCustName').value.trim() : (this.user.user_name || this.user.name || '');
        const phone = document.getElementById('dlvPhone').value.trim();
        const address = document.getElementById('dlvAddress').value.trim();
        const order_code = document.getElementById('dlvOrderCode')?.value.trim() || null;
        const schedule_date = document.getElementById('dlvDate').value;
        const start_time = document.getElementById('dlvStartTime').value ? document.getElementById('dlvStartTime').value + ':00' : '09:00:00';
        const notes = document.getElementById('dlvNotes')?.value.trim() || null;
        const courierSelect = document.getElementById('dlvCourier');
        const courier_id = (isStaff && courierSelect && courierSelect.value) ? parseInt(courierSelect.value) : undefined;

        const payload = {
          action: 'create_task',
          type,
          customer_name,
          phone,
          address,
          order_code: order_code || undefined,
          schedule_date,
          start_time,
          notes: notes || undefined,
          courier_id
        };

        const res = await fetch('/api/delivery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.ok) {
          const modal = document.getElementById('deliveryModal');
          if (modal) modal.style.display = 'none';
          this.toast(`Tugas ${type === 'pickup' ? 'Penjemputan' : 'Pengantaran'} berhasil dijadwalkan!`, 'success');
          this.renderDelivery();
        } else {
          this.toast(data.msg || 'Gagal menjadwalkan tugas', 'error');
        }
      }
    });

    // Global Change Delegation
    document.addEventListener('change', async (e) => {
      // Order status dropdown change
      const statusSelect = e.target.closest('.status-select');
      if (statusSelect) {
        const id = Number(statusSelect.getAttribute('data-id'));
        const newStatus = statusSelect.value;
        try {
          const res = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update_status', id, status: newStatus })
          });
          const data = await res.json();
          if (data.ok) {
            this.toast(`Status pesanan #${id} diubah ke ${newStatus.toUpperCase()}`, 'success');
          } else {
            this.toast(data.msg || 'Gagal mengubah status', 'error');
            this.renderPesanan();
          }
        } catch (err) {
          this.toast('Gagal menghubungi server', 'error');
        }
      }

      // Delivery task status dropdown change
      const taskStatusSelect = e.target.closest('.task-status-select');
      if (taskStatusSelect) {
        const id = Number(taskStatusSelect.getAttribute('data-id'));
        const newStatus = taskStatusSelect.value;
        try {
          const res = await fetch('/api/delivery', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update_status', id, status: newStatus })
          });
          const data = await res.json();
          if (data.ok) {
            this.toast(`Status tugas kurir #${id} diubah ke ${newStatus.toUpperCase()}`, 'success');
          } else {
            this.toast(data.msg || 'Gagal memperbarui status kurir', 'error');
            this.renderDelivery();
          }
        } catch (err) {
          this.toast('Gagal menghubungi server', 'error');
        }
      }

      // Assign courier change
      const courierSelect = e.target.closest('.task-courier-select');
      if (courierSelect) {
        const id = Number(courierSelect.getAttribute('data-id'));
        const courierId = courierSelect.value ? Number(courierSelect.value) : null;
        if (courierId) {
          this.assignCourier(id, courierId);
        }
      }
    });

    this.renderPage(this.currentPage);
  },

  renderError(msg) {
    const c = document.getElementById('mainContent');
    if (!c) return;
    c.innerHTML = `<div class="err">
      <div class="err-title">⚠ Terjadi Kesalahan</div>
      <div class="err-detail">${esc(msg || 'Gagal memuat halaman.')}</div>
      <button class="btn btn-outline" onclick="App.renderPage(App.currentPage)">Coba Lagi</button>
    </div>`;
  },

  renderPage(page) {
    try {
      this.currentPage = page;
      // keep nav highlight in sync (also covers browser back/forward)
      document.querySelectorAll('.nav-link').forEach(l => {
        const on = l.getAttribute('data-page') === page;
        l.classList.toggle('active', on);
      });
      if (page === 'pesanan') this.renderPesanan();
      else if (page === 'pelanggan') this.renderPelanggan();
      else if (page === 'layanan') this.renderLayanan();
      else if (page === 'delivery') this.renderDelivery();
      else if (page === 'promo') this.renderPromo();
      else if (page === 'laporan') this.renderLaporan();
      else if (page === 'profile') this.renderProfile();
      else this.renderDashboard();
      this.initScrollReveal();
      this.animateKpis();
    } catch (e) {
      this.renderError(e && e.message ? e.message : String(e));
    }
  },

  // PAGE RENDERERS
  async renderDashboard() {
    document.getElementById('pageTitle').textContent = 'Dashboard';
    const c = document.getElementById('mainContent');
    const isStaff = ['Admin', 'Owner', 'Staff'].includes(this.user.role || this.user.user_role);
    c.innerHTML = `
      ${this.renderSkeletonCards(isStaff ? 4 : 3)}
      ${this.renderSkeletonTable({ columns: 7, rows: 5, hasActions: true })}
    `;

    try {
      const res = await fetch('/api/dashboard');
      const data = await res.json();
      if (!data.ok) return c.innerHTML = '<div class="err">Gagal memuat dashboard</div>';

      const s = data.stats;

      c.innerHTML = `
        <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 24px;">
          <div class="stat-card stat-blue">
            <div class="stat-card-header">
              <span class="stat-label">Total Omset</span>
              <div class="stat-icon icon-blue">💰</div>
            </div>
            <div class="stat-value" data-kpi="${Number(s.total_revenue) || 0}">Rp ${Number(s.total_revenue).toLocaleString('id-ID')}</div>
            <div class="stat-sub"><span style="color:var(--green)">●</span> Total pendapatan riil</div>
          </div>
          <div class="stat-card stat-blue">
            <div class="stat-card-header">
              <span class="stat-label">Pesanan Aktif</span>
              <div class="stat-icon icon-blue">🧺</div>
            </div>
            <div class="stat-value" data-kpi="${s.active_orders || 0}">${esc(s.active_orders || 0)}</div>
            <div class="stat-sub">Dalam antrean & pencucian</div>
          </div>
          <div class="stat-card stat-green">
            <div class="stat-card-header">
              <span class="stat-label">Selesai Hari Ini</span>
              <div class="stat-icon icon-green">✨</div>
            </div>
            <div class="stat-value" data-kpi="${s.finished_today || 0}">${esc(s.finished_today || 0)}</div>
            <div class="stat-sub">Siap diambil / diantar</div>
          </div>
          ${isStaff ? `
            <div class="stat-card stat-amber">
              <div class="stat-card-header">
                <span class="stat-label">Total Pelanggan</span>
                <div class="stat-icon icon-amber">👥</div>
              </div>
              <div class="stat-value" data-kpi="${s.total_customers || 0}">${esc(s.total_customers || 0)}</div>
              <div class="stat-sub">Pelanggan terdaftar aktif</div>
            </div>
          ` : ''}
        </div>

        <div class="card glass-panel" style="padding: 16px 20px; border-radius: var(--radius-md); margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 38px; height: 38px; border-radius: 10px; background: var(--blue-soft); color: var(--blue); display: grid; place-items: center; font-size: 18px;">⚡</div>
            <div>
              <div style="font-weight: 700; font-size: 14px; color: var(--text);">Pintasan Operasional Cepat</div>
              <div style="font-size: 12px; color: var(--muted);">Akses navigasi praktis untuk aktivitas laundry Anda</div>
            </div>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="btn btn-primary" onclick="App.renderPesanan()" style="padding: 8px 16px; font-size: 13px;">+ Buat Pesanan Baru</button>
            <button class="btn" onclick="App.renderDelivery()" style="padding: 8px 16px; font-size: 13px; border: 1px solid var(--line); background: var(--card); color: var(--text);">🚚 Pickup & Delivery</button>
            ${isStaff ? `<button class="btn" onclick="App.renderLayanan()" style="padding: 8px 16px; font-size: 13px; border: 1px solid var(--line); background: var(--card); color: var(--text);">💲 Layanan & Tarif</button>` : ''}
            ${isStaff ? `<button class="btn" onclick="App.renderLaporan()" style="padding: 8px 16px; font-size: 13px; border: 1px solid var(--line); background: var(--card); color: var(--text);">📊 Laporan Keuangan</button>` : ''}
          </div>
        </div>

        <div class="card glass-panel" style="padding: 24px; border-radius: var(--radius-md);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px;">
            <div>
              <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: var(--text);">Pesanan Terbaru</h3>
              <div style="font-size: 12px; color: var(--muted); margin-top: 2px;">Daftar transaksi masuk terkini</div>
            </div>
            <button class="btn btn-primary" id="dashNewOrdBtn" style="padding: 8px 16px; font-size: 13px;">+ Buat Pesanan</button>
          </div>
          <div style="overflow-x: auto;">
            <table class="table" style="width: 100%; table-layout: fixed; border-collapse: collapse; text-align: left; font-size: 13px;">
              <colgroup>
                <col style="width: 140px;">
                <col style="width: 230px;">
                <col style="width: 160px;">
                <col style="width: 85px;">
                <col style="width: 130px;">
                <col style="width: 110px;">
                <col style="width: 110px;">
              </colgroup>
              <thead>
                <tr style="border-bottom: 2px solid var(--line); color: var(--muted);">
                  <th style="padding: 10px 12px;">Kode</th>
                  <th style="padding: 10px 12px;">Pelanggan</th>
                  <th style="padding: 10px 12px;">Layanan</th>
                  <th style="padding: 10px 12px;">Berat</th>
                  <th style="padding: 10px 12px;">Total</th>
                  <th style="padding: 10px 12px;">Status</th>
                  <th style="padding: 10px 12px; text-align: right;">Aksi</th>
                </tr>
              </thead>
              <tbody>
                ${(() => {
                  this._recentOrders = data.recent_orders || [];
                  if (this._recentOrders.length === 0) {
                    return `
                      <tr>
                        <td colspan="7" style="padding: 0; border: none;">
                          ${this.renderEmptyState({
                            icon: '🧺',
                            title: 'Belum Ada Pesanan',
                            subtitle: 'Belum ada transaksi pesanan laundry yang tercatat baru-baru ini.',
                            actionHtml: '<button class="btn btn-primary" onclick="App.renderPesanan()">+ Buat Pesanan Sekarang</button>'
                          })}
                        </td>
                      </tr>
                    `;
                  }
                  return this._recentOrders.map(o => `
                  <tr style="border-bottom: 1px solid var(--line);">
                    <td style="padding: 10px 12px; font-weight: 700; color: var(--blue); font-family: monospace;" title="${esc(o.order_code)}">${esc(o.order_code)}</td>
                    <td style="padding: 10px 12px;">
                      <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                        <div class="user-avatar-sm" style="width: 26px; height: 26px; font-size: 10px; flex-shrink: 0;">
                          ${(o.customer_name || 'C').slice(0, 2).toUpperCase()}
                        </div>
                        <span style="font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${esc(o.customer_name)}">
                          ${esc(o.customer_name)}
                        </span>
                      </div>
                    </td>
                    <td style="padding: 10px 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${esc(o.service_name)}">${esc(o.service_name)}</td>
                    <td style="padding: 10px 12px;">${esc(o.weight_kg)} kg</td>
                    <td style="padding: 10px 12px; font-weight: 700;">Rp ${Number(o.total_amount).toLocaleString('id-ID')}</td>
                    <td style="padding: 10px 12px;"><span class="badge status-${esc(o.status)}"><span class="badge-dot"></span> ${esc(o.status)}</span></td>
                    <td style="padding: 10px 12px; text-align: right; white-space: nowrap;">
                      <button type="button" class="btn btn-sm btn-open-invoice" onclick="App.openInvoice('${esc(o.id)}')" style="padding: 4px 8px; font-size: 12px; background: var(--card); border: 1px solid var(--line); color: var(--text); border-radius: 6px; cursor: pointer;">🧾 Invoice</button>
                    </td>
                  </tr>
                `).join('');
                })()}
              </tbody>
            </table>
          </div>
        </div>
      `;

      document.getElementById('dashNewOrdBtn').onclick = () => {
        this.renderPesanan();
      };
    } catch (e) {
      c.innerHTML = '<div class="err">Kesalahan koneksi dashboard</div>';
    }
  },

  async renderPesanan(params = {}) {
    const isStaff = ['Admin', 'Owner', 'Staff'].includes(this.user.role || this.user.user_role);
    document.getElementById('pageTitle').textContent = isStaff ? 'Manajemen Pesanan' : 'Riwayat Pesanan';
    const c = document.getElementById('mainContent');
    c.innerHTML = `
      <div style="display: flex; gap: 10px; margin-bottom: 20px; align-items: center; opacity: 0.6; pointer-events: none;">
        <div class="skeleton" style="width: 140px; height: 36px;"></div>
        <div class="skeleton" style="width: 140px; height: 36px;"></div>
        <div class="skeleton" style="width: 120px; height: 36px;"></div>
        <div class="skeleton" style="flex: 1; height: 36px;"></div>
      </div>
      ${this.renderSkeletonTable({ columns: 7, rows: 6, hasActions: true })}
    `;

    const start = params.start || '';
    const end = params.end || '';
    const q = params.q || '';
    const status = params.status || '';

    try {
      const sp = new URLSearchParams();
      if (start && end) {
        sp.set('start', start);
        sp.set('end', end);
      }
      if (q) sp.set('q', q);
      if (status) sp.set('status', status);

      const qs = sp.toString() ? `?${sp.toString()}` : '';

      const [ordRes, svcRes] = await Promise.all([
        fetch(`/api/orders${qs}`),
        fetch('/api/services')
      ]);
      const ordData = await ordRes.json();
      const svcData = await svcRes.json();

      const orders = ordData.orders || [];
      this._orders = orders;
      const services = svcData.services || [];

      c.innerHTML = `
        <div class="filter-bar glass-panel">
          <div class="presets" role="group" aria-label="Rentang tanggal cepat" style="display:flex;gap:6px;flex-wrap:wrap">
            ${[['Hari Ini','today'],['7 Hari','7d'],['Bulan Ini','month']].map(([lbl,key]) =>
              `<button class="btn preset-pill" data-preset="${key}" style="padding:8px 14px;font-size:13px;border-radius:8px;border:1px solid var(--line);background:${(start||'')+'' === this._presetStart(key) ? 'var(--blue)' : 'transparent'};color:${(start||'')+'' === this._presetStart(key) ? '#fff' : 'var(--text)'}">${lbl}</button>`
            ).join('')}
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <input type="date" id="filterStart" class="input-control" value="${esc(start)}">
            <span style="color: var(--muted); font-size: 13px;">s/d</span>
            <input type="date" id="filterEnd" class="input-control" value="${esc(end)}">
          </div>
          
          <select id="filterStatus" class="input-control">
            <option value="">Semua Status</option>
            <option value="baru" ${status === 'baru' ? 'selected' : ''}>Baru</option>
            <option value="proses" ${status === 'proses' ? 'selected' : ''}>Proses</option>
            <option value="selesai" ${status === 'selesai' ? 'selected' : ''}>Selesai</option>
            <option value="batal" ${status === 'batal' ? 'selected' : ''}>Batal</option>
          </select>

          <input type="text" id="ordSearch" class="input-control" value="${esc(q)}" placeholder="Cari kode atau nama pelanggan..." style="flex: 1; min-width: 180px;">
          
          <button class="btn" id="btnFilterOrders" style="padding: 8px 16px; font-size: 13px; background: var(--blue-soft); color: var(--blue); border: 1px solid var(--blue-border);">🔍 Filter</button>
          ${(start || end || q || status) ? `<button class="btn" id="btnResetFilterOrders" style="padding: 8px 16px; font-size: 13px; background: transparent; border: 1px solid var(--line); color: var(--muted);">Reset</button>` : ''}
          
          <button class="btn btn-primary" id="openNewOrderModal" style="${!isStaff ? 'display: none;' : ''}">+ Pesanan Baru</button>
        </div>

        <div class="card glass-panel" style="padding: 24px; border-radius: var(--radius-md); overflow-x: auto;">
          <table class="table" style="width: 100%; table-layout: fixed; border-collapse: collapse; text-align: left; font-size: 13px;">
            <colgroup>
              <col style="width: 140px;">
              <col style="width: 220px;">
              <col style="width: 160px;">
              <col style="width: 85px;">
              <col style="width: 130px;">
              <col style="width: 120px;">
              <col style="width: 220px;">
            </colgroup>
            <thead>
              <tr style="border-bottom: 2px solid var(--line); color: var(--muted);">
                <th style="padding: 12px 10px;">Kode</th>
                <th style="padding: 12px 10px;">Pelanggan</th>
                <th style="padding: 12px 10px;">Layanan</th>
                <th style="padding: 12px 10px;">Berat</th>
                <th style="padding: 12px 10px;">Total</th>
                <th style="padding: 12px 10px;">Status</th>
                <th style="padding: 12px 10px; text-align: right;">Aksi</th>
              </tr>
            </thead>
            <tbody id="ordersTableBody">
              ${orders.length === 0 ? `
                <tr>
                  <td colspan="7" style="padding: 0; border: none;">
                    ${this.renderEmptyState({
                      icon: '🧺',
                      title: 'Tidak Ada Pesanan Ditemukan',
                      subtitle: (start || end || q || status)
                        ? 'Tidak ada pesanan yang sesuai dengan filter pencarian Anda. Coba atur ulang filter.'
                        : 'Belum ada data pesanan laundry saat ini.',
                      actionHtml: (start || end || q || status)
                        ? '<button class="btn btn-sm" onclick="App.renderPesanan()">Reset Filter</button>'
                        : (isStaff ? '<button class="btn btn-primary" onclick="document.getElementById(\'openNewOrderModal\')?.click()">+ Buat Pesanan Baru</button>' : '')
                    })}
                  </td>
                </tr>
              ` : orders.map(o => `
                <tr style="border-bottom: 1px solid var(--line); transition: background 0.15s ease;">
                  <td style="padding: 12px 10px; font-weight: 700; color: var(--blue); font-family: monospace;" title="${esc(o.order_code)}">${esc(o.order_code)}</td>
                  <td style="padding: 12px 10px;">
                    <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                      <div class="user-avatar-sm" style="width: 26px; height: 26px; font-size: 10px; flex-shrink: 0;">
                        ${(o.customer_name || 'C').slice(0, 2).toUpperCase()}
                      </div>
                      <span style="font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${esc(o.customer_name)}">
                        ${esc(o.customer_name)}
                      </span>
                    </div>
                  </td>
                  <td style="padding: 12px 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${esc(o.service_name)}">${esc(o.service_name)}</td>
                  <td style="padding: 12px 10px; font-weight: 500;">${esc(o.weight_kg)} kg</td>
                  <td style="padding: 12px 10px; font-weight: 700; color: var(--text);">Rp ${Number(o.total_amount).toLocaleString('id-ID')}</td>
                  <td style="padding: 12px 10px;">
                    ${isStaff ? `
                      <select class="status-select input-control" data-id="${esc(o.id)}" style="padding: 4px 8px; font-size: 12px; font-weight: 600;">
                        <option value="baru" ${o.status === 'baru' ? 'selected' : ''}>Baru</option>
                        <option value="proses" ${o.status === 'proses' ? 'selected' : ''}>Proses</option>
                        <option value="selesai" ${o.status === 'selesai' ? 'selected' : ''}>Selesai</option>
                        <option value="batal" ${o.status === 'batal' ? 'selected' : ''}>Batal</option>
                      </select>
                    ` : `<span class="badge status-${esc(o.status)}"><span class="badge-dot"></span> ${esc(o.status)}</span>`}
                  </td>
                  <td style="padding: 12px 10px; text-align: right; white-space: nowrap;">
                    <div class="action-btn-group">
                      <button type="button" class="action-btn btn-open-invoice" onclick="App.openInvoice('${esc(o.id)}')">🧾 Invoice</button>
                      <button type="button" class="action-btn btn-view-proof" onclick="App.viewPaymentProof('${esc(o.order_code)}')">🖼️ Bukti</button>
                      <a href="/pay.html?code=${encodeURIComponent(o.order_code || '')}" class="action-btn action-btn-primary">💳 Bayar</a>
                      ${(isStaff || o.status === 'baru') ? `
                        <button class="action-btn action-btn-danger btn-del" data-id="${esc(o.id)}">🗑️ Hapus</button>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Order Modal -->
        <div id="orderModal" class="modal-backdrop" style="display: none;">
          <div class="modal-dialog">
            <div class="modal-header">
              <h3 class="modal-title">🧺 Buat Pesanan Laundry</h3>
              <button type="button" class="modal-close" id="closeOrderModalBtn" aria-label="Tutup">✕</button>
            </div>
            <form id="newOrderForm">
              ${isStaff ? `
                <div style="margin-bottom: 14px;">
                  <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: var(--text);">Nama Pelanggan <span style="color:var(--red)">*</span></label>
                  <input type="text" id="ordCustName" class="input-control" required style="width: 100%;" placeholder="Nama lengkap pelanggan">
                </div>
              ` : ''}
              <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: var(--text);">No. HP / WhatsApp</label>
                <input type="text" id="ordPhone" class="input-control" style="width: 100%;" placeholder="0812xxxxxxxx">
              </div>
              <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: var(--text);">Alamat Pengiriman</label>
                <input type="text" id="ordAddress" class="input-control" style="width: 100%;" placeholder="Alamat penjemputan/antar">
              </div>
              <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: var(--text);">Pilih Layanan Laundry <span style="color:var(--red)">*</span></label>
                <select id="ordService" class="input-control" required style="width: 100%;">
                  ${services.map(s => `<option value="${esc(s.id)}" data-price="${esc(s.price)}">${esc(s.name)} (Rp ${Number(s.price).toLocaleString('id-ID')}/${esc(s.unit || 'kg')})</option>`).join('')}
                </select>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
                <div>
                  <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: var(--text);">Berat / Kuantitas <span style="color:var(--red)">*</span></label>
                  <input type="number" id="ordWeight" class="input-control" min="1" value="1" required style="width: 100%;">
                </div>
                <div>
                  <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: var(--text);">Kode Voucher Diskon</label>
                  <input type="text" id="ordVoucher" class="input-control" placeholder="misal: PROMO10" style="width: 100%;">
                </div>
              </div>
              <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; border-top: 1px solid var(--line); padding-top: 16px;">
                <button type="button" class="btn" onclick="document.getElementById('orderModal').style.display='none'" style="padding: 8px 18px;">Batal</button>
                <button type="submit" class="btn btn-primary" style="padding: 8px 22px;">Simpan Pesanan</button>
              </div>
            </form>
          </div>
        </div>
      `;

      // Status change handler and delete handler removed since they are handled by global delegation

      // Modal open/close handled by global click delegation
      // Form submit handled by global submit delegation

    } catch (e) {
      c.innerHTML = '<div class="err">Kesalahan koneksi pesanan</div>';
    }
  },

  async renderPelanggan() {
    document.getElementById('pageTitle').textContent = 'Data Pelanggan';
    const c = document.getElementById('mainContent');
    c.innerHTML = this.renderSkeletonTable({ columns: 7, rows: 6, hasActions: false });

    try {
      const res = await fetch('/api/customers');
      const data = await res.json();
      const customers = data.customers || [];

      c.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
          <div>
            <h3 style="margin: 0; font-size: 18px; font-weight: 700; color: var(--text);">Direktori Pelanggan</h3>
            <div style="font-size: 13px; color: var(--muted); margin-top: 2px;">Tercatat ${customers.length} pelanggan terdaftar aktif</div>
          </div>
          <div style="display: flex; gap: 10px; align-items: center; flex: 1; max-width: 380px;">
            <input type="text" id="custSearchInput" class="input-control" placeholder="🔍 Cari nama, kode, atau no. HP..." style="width: 100%; padding: 8px 14px; font-size: 13px;">
          </div>
        </div>

        <div class="card glass-panel" style="padding: 24px; border-radius: var(--radius-md); overflow-x: auto;">
          <table class="table" id="customersTable" style="width: 100%; table-layout: fixed; border-collapse: collapse; text-align: left; font-size: 13px;">
            <colgroup>
              <col style="width: 130px;">
              <col style="width: 230px;">
              <col style="width: 180px;">
              <col style="width: 200px;">
              <col style="width: 110px;">
              <col style="width: 85px;">
              <col style="width: 130px;">
            </colgroup>
            <thead>
              <tr style="border-bottom: 2px solid var(--line); color: var(--muted);">
                <th style="padding: 12px 10px;">Kode</th>
                <th style="padding: 12px 10px;">Nama</th>
                <th style="padding: 12px 10px;">Kontak</th>
                <th style="padding: 12px 10px;">Alamat</th>
                <th style="padding: 12px 10px;">Status Tag</th>
                <th style="padding: 12px 10px;">Pesanan</th>
                <th style="padding: 12px 10px;">Total Belanja</th>
              </tr>
            </thead>
            <tbody id="customersTableBody">
              ${customers.length === 0 ? `
                <tr>
                  <td colspan="7" style="padding: 0; border: none;">
                    ${this.renderEmptyState({
                      icon: '👥',
                      title: 'Belum Ada Pelanggan',
                      subtitle: 'Belum ada data pelanggan yang terdaftar pada sistem saat ini.'
                    })}
                  </td>
                </tr>
              ` : customers.map(cust => {
                const tag = cust.computed_tag || cust.tag || 'Baru';
                const tagClass = tag === 'VIP' ? 'status-proses' : (tag === 'Reguler' ? 'status-baru' : 'status-selesai');
                const rawPhone = String(cust.phone || '').trim();
                const waPhone = rawPhone.replace(/[^0-9]/g, '');
                const cleanWa = waPhone.startsWith('0') ? '62' + waPhone.slice(1) : waPhone;

                return `
                  <tr class="cust-row" data-search="${esc(String(cust.code || '') + ' ' + String(cust.full_name || '') + ' ' + rawPhone).toLowerCase()}" style="border-bottom: 1px solid var(--line); transition: background 0.15s ease;">
                    <td style="padding: 12px 10px; font-weight: 700; color: var(--blue); font-family: monospace;" title="${esc(cust.code)}">${esc(cust.code)}</td>
                    <td style="padding: 12px 10px;">
                      <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                        <div class="user-avatar-sm" style="width: 28px; height: 28px; font-size: 11px; flex-shrink: 0;">
                          ${(cust.full_name || 'C').slice(0, 2).toUpperCase()}
                        </div>
                        <span style="font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${esc(cust.full_name)}">
                          ${esc(cust.full_name)}
                        </span>
                      </div>
                    </td>
                    <td style="padding: 12px 10px;">
                      <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px;" title="${esc(rawPhone || '-')}">${esc(rawPhone || '-')}</span>
                        ${waPhone.length >= 8 ? `
                          <a href="https://wa.me/${cleanWa}" target="_blank" rel="noopener noreferrer" class="btn-wa" title="Hubungi via WhatsApp">
                            <span>💬</span> <span>WA</span>
                          </a>
                        ` : ''}
                      </div>
                    </td>
                    <td style="padding: 12px 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${esc(cust.address || '-')}">${esc(cust.address || '-')}</td>
                    <td style="padding: 12px 10px;"><span class="badge ${tagClass}"><span class="badge-dot"></span> ${esc(tag)}</span></td>
                    <td style="padding: 12px 10px; font-weight: 600;">${esc(cust.orders_count || 0)}x</td>
                    <td style="padding: 12px 10px; font-weight: 700; color: var(--text);">Rp ${Number(cust.total_spent || 0).toLocaleString('id-ID')}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;

      // Live client-side instant search for customer directory
      const searchInput = document.getElementById('custSearchInput');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          const val = e.target.value.toLowerCase().trim();
          const rows = document.querySelectorAll('.cust-row');
          rows.forEach(row => {
            const rowText = row.getAttribute('data-search') || '';
            row.style.display = rowText.includes(val) ? '' : 'none';
          });
        });
      }
    } catch (e) {
      c.innerHTML = '<div class="err">Kesalahan memuat pelanggan</div>';
    }
  },

  async renderLayanan() {
    document.getElementById('pageTitle').textContent = 'Daftar Layanan & Tarif';
    const c = document.getElementById('mainContent');
    c.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px;" aria-busy="true" aria-label="Memuat layanan...">
        ${Array.from({ length: 4 }).map(() => `
          <div class="skeleton-card">
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
              <div class="skeleton skeleton-title" style="width: 50%; height: 18px; margin: 0;"></div>
              <div class="skeleton skeleton-badge" style="width: 55px; height: 20px;"></div>
            </div>
            <div class="skeleton skeleton-title" style="width: 70%; height: 24px; margin-bottom: 8px;"></div>
            <div class="skeleton skeleton-text" style="width: 40%; height: 12px; margin-bottom: 16px;"></div>
            <div class="skeleton skeleton-btn" style="width: 100%; height: 34px;"></div>
          </div>
        `).join('')}
      </div>
    `;

    try {
      const res = await fetch('/api/services');
      const data = await res.json();
      const services = data.services || [];
      this._services = services;
      const isStaff = ['Admin', 'Owner', 'Staff'].includes(this.user?.role || this.user?.user_role);

      if (services.length === 0) {
        c.innerHTML = this.renderEmptyState({
          icon: '💲',
          title: 'Belum Ada Layanan',
          subtitle: 'Daftar paket layanan laundry belum dikonfigurasi.',
          actionHtml: isStaff ? '<button class="btn btn-primary" onclick="App.openServiceModal()">+ Tambah Layanan Sekarang</button>' : ''
        });
        return;
      }

      c.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; flex-wrap: wrap; gap: 12px;">
          <div>
            <h3 style="margin: 0; font-size: 18px; font-weight: 700; color: var(--text);">Katalog Layanan & Tarif</h3>
            <div style="font-size: 13px; color: var(--muted); margin-top: 2px;">Tersedia ${services.length} pilihan paket laundry berkualitas</div>
          </div>
          <div style="display: flex; gap: 10px; align-items: center;">
            <input type="text" id="svcSearchInput" class="input-control" placeholder="🔍 Cari layanan..." style="width: 200px; padding: 7px 12px; font-size: 12px;">
            ${isStaff ? `
              <button class="btn btn-primary" id="openNewServiceModal" style="padding: 8px 16px; font-size: 13px; font-weight: 600;">+ Tambah Layanan Baru</button>
            ` : ''}
          </div>
        </div>

        <div class="category-tabs" id="svcCategoryTabs">
          <button class="cat-tab active" data-cat="all">Semua Layanan</button>
          <button class="cat-tab" data-cat="kiloan">🧺 Kiloan</button>
          <button class="cat-tab" data-cat="satuan">👔 Satuan</button>
          <button class="cat-tab" data-cat="express">⚡ Express</button>
          <button class="cat-tab" data-cat="bed cover">🛏️ Bed Cover</button>
        </div>

        <div class="service-grid" id="serviceGrid">
          ${services.map(s => {
            const nameLower = (s.name || '').toLowerCase();
            const icon = nameLower.includes('setrika') ? '👔'
              : (nameLower.includes('dry') ? '🧥'
              : (nameLower.includes('bed') || nameLower.includes('selimut') ? '🛏️'
              : (nameLower.includes('express') || nameLower.includes('kilat') ? '⚡' : '🧺')));

            return `
            <div class="service-card glass-panel svc-item" data-cat="${esc((s.category || 'Reguler').toLowerCase())}" data-name="${esc(nameLower)}">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 18px;">${icon}</span>
                    <span class="badge" style="background: var(--blue-soft); color: var(--blue); border: 1px solid var(--blue-border); font-family: monospace; font-size: 11px;">${esc(s.code || 'SVC')}</span>
                  </div>
                  <span class="badge ${s.is_active ? 'status-selesai' : 'status-batal'}"><span class="badge-dot"></span> ${s.is_active ? 'Aktif' : 'Nonaktif'}</span>
                </div>
                <h4 style="margin: 0 0 4px; font-size: 16px; font-weight: 700; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${esc(s.name)}">${esc(s.name)}</h4>
                <div style="display: inline-block; font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.04em;">${esc(s.category || 'Reguler')}</div>
                <div class="service-price-tag">
                  Rp ${Number(s.price).toLocaleString('id-ID')} <span class="service-unit">/ ${esc(s.unit || 'kg')}</span>
                </div>
                <p style="font-size: 13px; color: var(--muted); margin: 0 0 14px; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${esc(s.description || 'Proses pengerjaan rapi, bersih dan higienis.')}</p>
                <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); margin-bottom: 16px;">
                  <span>⏱️ Estimasi: <strong>${esc(s.duration_hours || 24)} Jam</strong></span>
                  ${s.badge ? `<span style="background: var(--amber-soft); color: var(--amber); border: 1px solid var(--amber-border); padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600;">${esc(s.badge)}</span>` : ''}
                </div>
              </div>
              <div>
                ${isStaff ? `
                  <div class="action-btn-group" style="width: 100%; display: grid; grid-template-columns: 1fr 1fr auto; gap: 6px;">
                    <button class="action-btn" onclick="App.openServiceModal(${s.id})" style="justify-content: center;">✏️ Edit</button>
                    <button class="action-btn" onclick="App.toggleServiceActive(${s.id}, ${s.is_active ? 0 : 1})" style="justify-content: center;">${s.is_active ? 'Nonaktif' : 'Aktifkan'}</button>
                    <button class="action-btn action-btn-danger" onclick="App.deleteService(${s.id})" title="Hapus Layanan">🗑️</button>
                  </div>
                ` : `
                  <button class="btn btn-primary" style="width: 100%; padding: 9px; font-size: 13px;" onclick="App.renderPesanan()">Pesan Layanan Ini</button>
                `}
              </div>
            </div>
            `;
          }).join('')}
        </div>

        <!-- Service Modal -->
        <div id="serviceModal" class="modal-backdrop" style="display: none;">
          <div class="modal-dialog">
            <div class="modal-header">
              <h3 class="modal-title" id="serviceModalTitle">💲 Tambah Layanan Laundry</h3>
              <button type="button" class="modal-close" id="closeServiceModalBtn" aria-label="Tutup">✕</button>
            </div>
            <form id="serviceForm">
              <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 12px; margin-bottom: 14px;">
                <div>
                  <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: var(--text);">Kode Layanan <span style="color:var(--red)">*</span></label>
                  <input type="text" id="svcCode" class="input-control" required style="width: 100%;" placeholder="SVC-01">
                </div>
                <div>
                  <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: var(--text);">Nama Layanan <span style="color:var(--red)">*</span></label>
                  <input type="text" id="svcName" class="input-control" required style="width: 100%;" placeholder="Contoh: Cuci Komplit Kilat">
                </div>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
                <div>
                  <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: var(--text);">Kategori</label>
                  <input type="text" id="svcCategory" class="input-control" style="width: 100%;" placeholder="Reguler / Express / Bed Cover">
                </div>
                <div>
                  <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: var(--text);">Satuan</label>
                  <select id="svcUnit" class="input-control" style="width: 100%;">
                    <option value="kg">kg (Kilogram)</option>
                    <option value="pcs">pcs (Satuan Buah)</option>
                    <option value="item">item (Barang)</option>
                    <option value="meter">meter (Panjang)</option>
                    <option value="set">set (Per Set)</option>
                  </select>
                </div>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
                <div>
                  <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: var(--text);">Tarif Harga (Rp) <span style="color:var(--red)">*</span></label>
                  <input type="number" id="svcPrice" class="input-control" required min="0" style="width: 100%;" placeholder="10000">
                </div>
                <div>
                  <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: var(--text);">Durasi (Jam) <span style="color:var(--red)">*</span></label>
                  <input type="number" id="svcHours" class="input-control" required min="1" style="width: 100%;" placeholder="24">
                </div>
              </div>
              <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: var(--text);">Badge Label Promo / Unggulan</label>
                <input type="text" id="svcBadge" class="input-control" style="width: 100%;" placeholder="Contoh: Populer / Hemat / Kilat">
              </div>
              <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: var(--text);">Deskripsi Layanan</label>
                <textarea id="svcDesc" class="input-control" rows="2" style="width: 100%; resize: vertical;" placeholder="Detail cakupan pengerjaan cuci, setrika, pewangi..."></textarea>
              </div>
              <div style="margin-bottom: 16px;">
                <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; cursor: pointer; color: var(--text);">
                  <input type="checkbox" id="svcActive" checked> Status Layanan Aktif
                </label>
              </div>
              <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--line); padding-top: 16px;">
                <button type="button" class="btn" onclick="document.getElementById('serviceModal').style.display='none'" style="padding: 8px 18px;">Batal</button>
                <button type="submit" class="btn btn-primary" style="padding: 8px 22px;">Simpan Layanan</button>
              </div>
            </form>
          </div>
        </div>
      `;

      // Live category tab & search filtering for services
      const filterServices = () => {
        const activeTab = document.querySelector('#svcCategoryTabs .cat-tab.active')?.getAttribute('data-cat') || 'all';
        const searchVal = document.getElementById('svcSearchInput')?.value.toLowerCase().trim() || '';
        const items = document.querySelectorAll('.svc-item');
        items.forEach(item => {
          const itemCat = item.getAttribute('data-cat') || '';
          const itemName = item.getAttribute('data-name') || '';
          const matchesCat = activeTab === 'all' || itemCat.includes(activeTab);
          const matchesSearch = !searchVal || itemName.includes(searchVal);
          item.style.display = (matchesCat && matchesSearch) ? 'flex' : 'none';
        });
      };

      document.querySelectorAll('#svcCategoryTabs .cat-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
          document.querySelectorAll('#svcCategoryTabs .cat-tab').forEach(t => t.classList.remove('active'));
          e.currentTarget.classList.add('active');
          filterServices();
        });
      });

      const svcSearchInput = document.getElementById('svcSearchInput');
      if (svcSearchInput) {
        svcSearchInput.addEventListener('input', filterServices);
      }
    } catch (e) {
      c.innerHTML = '<div class="err">Kesalahan memuat layanan</div>';
    }
  },

  async renderDelivery() {
    document.getElementById('pageTitle').textContent = 'Pickup & Antar Jemput';
    const c = document.getElementById('mainContent');
    c.innerHTML = this.renderSkeletonTable({ columns: 7, rows: 5, hasActions: false });
    const isStaff = ['Admin', 'Owner', 'Staff'].includes(this.user?.role || this.user?.user_role);

    try {
      const res = await fetch('/api/delivery');
      const data = await res.json();
      const tasks = data.tasks || [];
      const couriers = data.couriers || [];
      this._deliveryTasks = tasks;
      this._couriers = couriers;

      c.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
          <div>
            <h3 style="margin: 0; font-size: 18px; font-weight: 700; color: var(--text);">Logistik & Antar Jemput Laundry</h3>
            <div style="font-size: 13px; color: var(--muted); margin-top: 2px;">Kelola jadwal penjemputan cucian kotor dan pengantaran laundry bersih</div>
          </div>
          <button class="btn btn-primary" id="openNewDeliveryModal" style="padding: 9px 18px; font-size: 13px; font-weight: 600;">+ Jadwalkan Pickup / Antar</button>
        </div>

        <div class="card glass-panel" style="padding: 24px; border-radius: var(--radius-md); overflow-x: auto;">
          <table class="table" style="width: 100%; table-layout: fixed; border-collapse: collapse; text-align: left; font-size: 13px;">
            <colgroup>
              <col style="width: 130px;">
              <col style="width: 115px;">
              <col style="width: 200px;">
              <col style="width: 200px;">
              <col style="width: 170px;">
              <col style="width: 120px;">
              <col style="width: 140px;">
              <col style="width: 130px;">
            </colgroup>
            <thead>
              <tr style="border-bottom: 2px solid var(--line); color: var(--muted);">
                <th style="padding: 12px 10px;">Kode Tugas</th>
                <th style="padding: 12px 10px;">Tipe</th>
                <th style="padding: 12px 10px;">Pelanggan</th>
                <th style="padding: 12px 10px;">Alamat</th>
                <th style="padding: 12px 10px;">Kurir</th>
                <th style="padding: 12px 10px;">Jadwal</th>
                <th style="padding: 12px 10px;">Status</th>
                <th style="padding: 12px 10px; text-align: right;">Aksi Cepat</th>
              </tr>
            </thead>
            <tbody>
              ${tasks.length === 0 ? `
                <tr>
                  <td colspan="8" style="padding: 0; border: none;">
                    ${this.renderEmptyState({
                      icon: '🚚',
                      title: 'Belum Ada Tugas Kurir',
                      subtitle: 'Tidak ada jadwal penjemputan atau pengantaran laundry saat ini.',
                      actionHtml: '<button class="btn btn-primary" onclick="App.openDeliveryModal()">+ Buat Jadwal Sekarang</button>'
                    })}
                  </td>
                </tr>
              ` : tasks.map(t => {
                const rawPhone = String(t.phone || '').trim();
                const waPhone = rawPhone.replace(/[^0-9]/g, '');
                const cleanWa = waPhone.startsWith('0') ? '62' + waPhone.slice(1) : waPhone;
                const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.address || '')}`;

                return `
                <tr style="border-bottom: 1px solid var(--line); transition: background 0.15s ease;">
                  <td style="padding: 12px 10px; font-weight: 700; color: var(--blue); font-family: monospace;" title="${esc(t.task_code)}">${esc(t.task_code)}</td>
                  <td style="padding: 12px 10px;">
                    <span class="badge ${t.type === 'pickup' ? 'status-baru' : 'status-selesai'}"><span class="badge-dot"></span> ${t.type === 'pickup' ? 'PICKUP' : 'DELIVERY'}</span>
                  </td>
                  <td style="padding: 12px 10px;">
                    <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                      <div class="user-avatar-sm" style="width: 26px; height: 26px; font-size: 10px; flex-shrink: 0;">
                        ${(t.customer_name || 'C').slice(0, 2).toUpperCase()}
                      </div>
                      <div style="min-width: 0; overflow: hidden;">
                        <div style="font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${esc(t.customer_name)}">${esc(t.customer_name)}</div>
                        <div style="font-size: 11px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${esc(t.phone || '-')}</div>
                      </div>
                    </div>
                  </td>
                  <td style="padding: 12px 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${esc(t.address || '-')}">${esc(t.address || '-')}</td>
                  <td style="padding: 12px 10px;">
                    ${isStaff && couriers.length > 0 ? `
                      <select class="task-courier-select input-control" data-id="${esc(t.id)}" style="padding: 4px 8px; font-size: 12px;">
                        <option value="">-- Belum Ditugaskan --</option>
                        ${couriers.map(c => `<option value="${esc(c.id)}" ${t.courier_id == c.id ? 'selected' : ''}>${esc(c.full_name)}</option>`).join('')}
                      </select>
                    ` : `<span>${esc(t.courier_name || 'Belum ditugaskan')}</span>`}
                  </td>
                  <td style="padding: 12px 10px;">
                    <div style="font-weight: 600;">${esc(t.schedule_date)}</div>
                    <div style="font-size: 11px; color: var(--muted);">${esc(String(t.start_time || '').slice(0, 5))} WIB</div>
                  </td>
                  <td style="padding: 12px 10px;">
                    ${isStaff ? `
                      <select class="task-status-select input-control" data-id="${esc(t.id)}" style="padding: 4px 8px; font-size: 12px; font-weight: 600;">
                        <option value="scheduled" ${t.status === 'scheduled' ? 'selected' : ''}>Dijadwalkan</option>
                        <option value="assigned" ${t.status === 'assigned' ? 'selected' : ''}>Kurir Ditugaskan</option>
                        <option value="onroute" ${t.status === 'onroute' ? 'selected' : ''}>Dalam Perjalanan</option>
                        <option value="completed" ${t.status === 'completed' ? 'selected' : ''}>Selesai</option>
                        <option value="cancelled" ${t.status === 'cancelled' ? 'selected' : ''}>Dibatalkan</option>
                      </select>
                    ` : `<span class="badge status-${esc(t.status)}"><span class="badge-dot"></span> ${esc(t.status)}</span>`}
                  </td>
                  <td style="padding: 12px 10px; text-align: right; white-space: nowrap;">
                    <div style="display: inline-flex; gap: 4px; align-items: center;">
                      ${waPhone.length >= 8 ? `
                        <a href="https://wa.me/${cleanWa}" target="_blank" rel="noopener noreferrer" class="btn-wa" title="Chat Pelanggan di WhatsApp">💬 WA</a>
                      ` : ''}
                      ${t.address ? `
                        <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="btn-map" title="Buka Rute di Google Maps">🗺️ Peta</a>
                      ` : ''}
                    </div>
                  </td>
                </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <!-- Delivery Modal -->
        <div id="deliveryModal" class="modal-backdrop" style="display: none;">
          <div class="modal-dialog">
            <div class="modal-header">
              <h3 class="modal-title">🚚 Jadwalkan Penjemputan / Pengantaran</h3>
              <button type="button" class="modal-close" id="closeDeliveryModalBtn" aria-label="Tutup">✕</button>
            </div>
            <form id="deliveryForm">
              <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: var(--text);">Tipe Tugas <span style="color:var(--red)">*</span></label>
                <select id="dlvType" class="input-control" required style="width: 100%;">
                  <option value="pickup">🧺 Penjemputan Cucian Kotor (Pickup)</option>
                  <option value="delivery">🚚 Pengantaran Laundry Selesai (Delivery)</option>
                </select>
              </div>
              ${isStaff ? `
                <div style="margin-bottom: 14px;">
                  <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: var(--text);">Nama Pelanggan <span style="color:var(--red)">*</span></label>
                  <input type="text" id="dlvCustName" class="input-control" required style="width: 100%;" placeholder="Nama pelanggan">
                </div>
              ` : ''}
              <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: var(--text);">No. HP / WhatsApp <span style="color:var(--red)">*</span></label>
                <input type="text" id="dlvPhone" class="input-control" required style="width: 100%;" placeholder="0812xxxxxxxx" value="${esc(this.user?.phone || '')}">
              </div>
              <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: var(--text);">Alamat Lengkap <span style="color:var(--red)">*</span></label>
                <textarea id="dlvAddress" class="input-control" required rows="2" style="width: 100%; resize: vertical;" placeholder="Alamat jalan, nomor rumah, RT/RW atau patokan">${esc(this.user?.address || '')}</textarea>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
                <div>
                  <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: var(--text);">Tanggal Jadwal <span style="color:var(--red)">*</span></label>
                  <input type="date" id="dlvDate" class="input-control" required style="width: 100%;">
                </div>
                <div>
                  <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: var(--text);">Jam Mulai</label>
                  <input type="time" id="dlvStartTime" class="input-control" value="09:00" style="width: 100%;">
                </div>
              </div>
              ${isStaff && couriers.length > 0 ? `
                <div style="margin-bottom: 14px;">
                  <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: var(--text);">Tugaskan Kurir</label>
                  <select id="dlvCourier" class="input-control" style="width: 100%;">
                    <option value="">-- Tetapkan Nanti --</option>
                    ${couriers.map(c => `<option value="${esc(c.id)}">${esc(c.full_name)} (${esc(c.phone || '-')})</option>`).join('')}
                  </select>
                </div>
              ` : ''}
              <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: var(--text);">Catatan Tambahan</label>
                <input type="text" id="dlvNotes" class="input-control" style="width: 100%;" placeholder="misal: Titip satpam, hubungi sebelum datang">
              </div>
              <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--line); padding-top: 16px;">
                <button type="button" class="btn" onclick="document.getElementById('deliveryModal').style.display='none'" style="padding: 8px 18px;">Batal</button>
                <button type="submit" class="btn btn-primary" style="padding: 8px 22px;">Jadwalkan Tugas</button>
              </div>
            </form>
          </div>
        </div>
      `;
    } catch (e) {
      c.innerHTML = '<div class="err">Kesalahan memuat tugas kurir</div>';
    }
  },

  async renderPromo() {
    document.getElementById('pageTitle').textContent = 'Promo & Voucher Diskon';
    const c = document.getElementById('mainContent');
    c.innerHTML = `
      <div style="display: flex; gap: 8px; margin-bottom: 20px;">
        <div class="skeleton skeleton-btn" style="width: 120px; height: 36px;"></div>
        <div class="skeleton skeleton-btn" style="width: 140px; height: 36px;"></div>
      </div>
      ${this.renderSkeletonTable({ columns: 8, rows: 4, hasActions: true })}
    `;
    const isStaff = ['Admin', 'Owner', 'Staff'].includes(this.user?.role || this.user?.user_role);

    try {
      const [pRes, vRes] = await Promise.all([
        fetch('/api/promos'),
        fetch('/api/vouchers')
      ]);
      const pData = await pRes.json();
      const vData = await vRes.json();
      const promos = pData.promos || [];
      const vouchers = vData.vouchers || [];
      this._promos = promos;
      this._editPromoId = null;

      if (isStaff) {
        c.innerHTML = `
          <div id="promoFormWrap" style="display:none;background:var(--bg);border:1px solid var(--line);border-radius:var(--radius-md);padding:20px;margin-bottom:20px;" role="region" aria-label="Form promo">
            <h4 id="promoFormTitle" style="margin:0 0 16px;font-size:16px;font-weight:700;color:var(--text);">Tambah Promo</h4>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div>
                <label for="pfCode" style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;color:var(--text);">Kode</label>
                <input id="pfCode" type="text" maxlength="32" placeholder="misal: LEBARAN10" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--line);background:var(--card);color:var(--text);box-sizing:border-box;">
              </div>
              <div>
                <label for="pfName" style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;color:var(--text);">Nama Promo <span aria-hidden="true" style="color:var(--red);">*</span></label>
                <input id="pfName" type="text" maxlength="120" placeholder="Nama promo" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--line);background:var(--card);color:var(--text);box-sizing:border-box;" required>
              </div>
              <div>
                <label for="pfType" style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;color:var(--text);">Tipe</label>
                <select id="pfType" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--line);background:var(--card);color:var(--text);box-sizing:border-box;">
                  <option value="percent">Persen (%)</option>
                  <option value="nominal">Nominal (Rp)</option>
                </select>
              </div>
              <div>
                <label for="pfValue" style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;color:var(--text);">Nilai</label>
                <input id="pfValue" type="number" min="0" value="0" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--line);background:var(--card);color:var(--text);box-sizing:border-box;" aria-label="Nilai promo">
              </div>
              <div>
                <label for="pfMinSpend" style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;color:var(--text);">Min. Belanja (Rp)</label>
                <input id="pfMinSpend" type="number" min="0" value="0" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--line);background:var(--card);color:var(--text);box-sizing:border-box;">
              </div>
              <div>
                <label for="pfMaxDiscount" style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;color:var(--text);">Maks. Diskon (Rp)</label>
                <input id="pfMaxDiscount" type="number" min="0" value="0" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--line);background:var(--card);color:var(--text);box-sizing:border-box;">
              </div>
              <div>
                <label for="pfExpires" style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;color:var(--text);">Kedaluwarsa (opsional)</label>
                <input id="pfExpires" type="datetime-local" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--line);background:var(--card);color:var(--text);box-sizing:border-box;">
              </div>
              <div style="display:flex;align-items:flex-end;">
                <label style="font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;color:var(--text);">
                  <input id="pfActive" type="checkbox" checked> Aktif
                </label>
              </div>
            </div>
            <div style="margin-top:16px;display:flex;gap:8px;">
              <button class="btn btn-primary" onclick="App.savePromo()" style="padding:8px 20px;">Simpan</button>
              <button class="btn" onclick="document.getElementById('promoFormWrap').style.display='none'" style="padding:8px 20px;">Batal</button>
            </div>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
            <div>
              <h3 style="margin:0;color:var(--text);font-size:18px;font-weight:800;">Daftar Promo &amp; Diskon</h3>
              <div style="font-size:12px;color:var(--muted);margin-top:2px;">Kelola kode promo potongan harga dan kupon diskon pelanggan</div>
            </div>
            <div style="display:flex;gap:10px;align-items:center;">
              <input type="text" id="promoSearchInput" placeholder="🔍 Cari kode atau nama promo..." style="padding:8px 14px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--text);font-size:13px;width:220px;" oninput="
                const q = this.value.toLowerCase();
                document.querySelectorAll('#promoTableBody tr').forEach(r => {
                  const t = r.textContent.toLowerCase();
                  r.style.display = t.includes(q) ? '' : 'none';
                });
              ">
              <button class="btn btn-primary" onclick="App.openPromoForm()" style="padding:8px 16px;font-weight:700;">+ Tambah Promo</button>
            </div>
          </div>
          <div class="card" style="padding:0;border-radius:var(--radius-md);overflow-x:auto;margin-bottom:28px;">
            <table class="table" style="width:100%;min-width:840px;table-layout:fixed;border-collapse:collapse;text-align:left;font-size:13px;">
              <colgroup>
                <col style="width:140px;">
                <col style="width:230px;">
                <col style="width:90px;">
                <col style="width:110px;">
                <col style="width:110px;">
                <col style="width:110px;">
                <col style="width:95px;">
                <col style="width:140px;">
              </colgroup>
              <thead>
                <tr style="border-bottom:2px solid var(--line);color:var(--muted);background:var(--bg-subtle);">
                  <th style="padding:12px 14px;">Kode</th>
                  <th style="padding:12px 14px;">Nama</th>
                  <th style="padding:12px 14px;">Tipe</th>
                  <th style="padding:12px 14px;">Nilai</th>
                  <th style="padding:12px 14px;">Min. Belanja</th>
                  <th style="padding:12px 14px;">Kedaluwarsa</th>
                  <th style="padding:12px 14px;">Status</th>
                  <th style="padding:12px 14px;text-align:right;">Aksi</th>
                </tr>
              </thead>
              <tbody id="promoTableBody">
                ${promos.length === 0
                  ? '<tr><td colspan="8" style="padding:28px;text-align:center;color:var(--muted);">Belum ada promo terdaftar. Klik "+ Tambah Promo" di atas.</td></tr>'
                  : promos.map(p => `
                  <tr style="border-bottom:1px solid var(--line);transition:background 0.15s ease;">
                    <td style="padding:10px 14px;">
                      <span class="ticket-code-pill" style="cursor:pointer;max-width:125px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="Klik untuk salin: ${esc(p.code)}" onclick="navigator.clipboard.writeText('${esc(p.code)}'); App.toast('Kode ${esc(p.code)} disalin!','success');">
                        🏷️ ${esc(p.code)}
                      </span>
                    </td>
                    <td style="padding:10px 14px;">
                      <div style="font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:215px;" title="${esc(p.name)}">
                        ${esc(p.name)}
                      </div>
                      <div style="font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:215px;">
                        ${p.type === 'percent' ? `Diskon ${esc(p.value)}%` : `Potongan Rp ${Number(p.value).toLocaleString('id-ID')}`}
                      </div>
                    </td>
                    <td style="padding:10px 14px;">
                      <span class="badge" style="font-size:11px;background:var(--bg-subtle);">${p.type === 'percent' ? 'Persen' : 'Nominal'}</span>
                    </td>
                    <td style="padding:10px 14px;font-weight:800;color:var(--green);">
                      ${p.type === 'percent' ? esc(p.value) + '%' : 'Rp ' + Number(p.value).toLocaleString('id-ID')}
                    </td>
                    <td style="padding:10px 14px;color:var(--muted);font-variant-numeric:tabular-nums;">
                      Rp ${Number(p.min_spend || 0).toLocaleString('id-ID')}
                    </td>
                    <td style="padding:10px 14px;font-size:12px;color:var(--muted);">
                      ${p.expires_at ? esc(String(p.expires_at).slice(0, 10)) : '—'}
                    </td>
                    <td style="padding:10px 14px;">
                      <span class="badge ${p.is_active ? 'status-selesai' : 'status-batal'}">
                        ${p.is_active ? '● Aktif' : '○ Nonaktif'}
                      </span>
                    </td>
                    <td style="padding:10px 14px;text-align:right;">
                      <div class="action-btn-group" style="justify-content:flex-end;">
                        <button class="action-btn" onclick="App.openPromoForm(${p.id})" aria-label="Edit promo ${esc(p.code)}" title="Edit Promo">✏️</button>
                        <button class="action-btn" onclick="App.togglePromo(${p.id},${p.is_active ? 0 : 1})" aria-label="${p.is_active ? 'Nonaktifkan' : 'Aktifkan'} promo ${esc(p.code)}" title="${p.is_active ? 'Nonaktifkan' : 'Aktifkan'}">
                          ${p.is_active ? '⏸️' : '▶️'}
                        </button>
                        <button class="action-btn action-btn-danger" onclick="App.deletePromo(${p.id})" aria-label="Hapus promo ${esc(p.code)}" title="Hapus Promo">🗑️</button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- Form Grant Voucher (Staff Only) -->
          <div id="grantVoucherWrap" style="display:none;background:var(--bg);border:1px solid var(--line);border-radius:var(--radius-md);padding:20px;margin-bottom:20px;" role="region" aria-label="Form terbitkan voucher">
            <h4 style="margin:0 0 16px;font-size:16px;font-weight:700;color:var(--text);">🎁 Terbitkan Voucher ke Pelanggan</h4>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div>
                <label for="gvPromoId" style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;color:var(--text);">Pilih Promo</label>
                <select id="gvPromoId" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--line);background:var(--card);color:var(--text);box-sizing:border-box;">
                  ${promos.filter(p => p.is_active).map(p => `<option value="${p.id}">${esc(p.code)} — ${esc(p.name)} (${p.type === 'percent' ? esc(p.value) + '%' : 'Rp ' + Number(p.value).toLocaleString('id-ID')})</option>`).join('')}
                </select>
              </div>
              <div>
                <label for="gvType" style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;color:var(--text);">Metode</label>
                <select id="gvType" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--line);background:var(--card);color:var(--text);box-sizing:border-box;">
                  <option value="single">Satu Pelanggan</option>
                  <option value="bulk">Massal (Banyak ID)</option>
                </select>
              </div>
              <div style="grid-column: 1 / -1;">
                <label for="gvUserId" style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;color:var(--text);">User ID Pelanggan</label>
                <input id="gvUserId" type="text" placeholder="Contoh: 12 atau untuk massal: 1, 2, 3" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--line);background:var(--card);color:var(--text);box-sizing:border-box;">
                <div style="font-size:11px;color:var(--muted);margin-top:4px;">Masukkan ID numerik akun pelanggan terdaftar.</div>
              </div>
            </div>
            <div style="margin-top:16px;display:flex;gap:8px;">
              <button class="btn btn-primary" onclick="App.grantVoucher()" style="padding:8px 20px;">Terbitkan</button>
              <button class="btn" onclick="document.getElementById('grantVoucherWrap').style.display='none'" style="padding:8px 20px;">Batal</button>
            </div>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
            <div>
              <h3 style="margin:0;color:var(--text);font-size:18px;font-weight:800;">Semua Voucher Pengguna</h3>
              <div style="font-size:12px;color:var(--muted);margin-top:2px;">Daftar voucher individual yang diklaim atau diterbitkan khusus untuk pelanggan</div>
            </div>
            <button class="btn btn-primary" onclick="App.openGrantVoucherForm()">🎁 Terbitkan Voucher</button>
          </div>
          <div class="card" style="padding:0;border-radius:var(--radius-md);overflow-x:auto;">
            <table class="table" style="width:100%;min-width:800px;table-layout:fixed;border-collapse:collapse;text-align:left;font-size:13px;">
              <colgroup>
                <col style="width:150px;">
                <col style="width:200px;">
                <col style="width:110px;">
                <col style="width:180px;">
                <col style="width:110px;">
                <col style="width:90px;">
              </colgroup>
              <thead>
                <tr style="border-bottom:2px solid var(--line);color:var(--muted);background:var(--bg-subtle);">
                  <th style="padding:12px 14px;">Kode Voucher</th>
                  <th style="padding:12px 14px;">Nama Promo</th>
                  <th style="padding:12px 14px;">Nilai</th>
                  <th style="padding:12px 14px;">Penerima / User</th>
                  <th style="padding:12px 14px;">Status</th>
                  <th style="padding:12px 14px;text-align:right;">Aksi</th>
                </tr>
              </thead>
              <tbody>
                ${vouchers.length === 0
                  ? '<tr><td colspan="6" style="padding:28px;text-align:center;color:var(--muted);">Belum ada voucher yang diterbitkan.</td></tr>'
                  : vouchers.map(v => `
                  <tr style="border-bottom:1px solid var(--line);transition:background 0.15s ease;">
                    <td style="padding:10px 14px;">
                      <span class="ticket-code-pill" style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(v.code)}">
                        🎁 ${esc(v.code)}
                      </span>
                    </td>
                    <td style="padding:10px 14px;">
                      <div style="font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:190px;" title="${esc(v.promo_name || v.name)}">
                        ${esc(v.promo_name || v.name)}
                      </div>
                    </td>
                    <td style="padding:10px 14px;font-weight:800;color:var(--green);">
                      ${v.type === 'percent' ? esc(v.value) + '%' : 'Rp ' + Number(v.value).toLocaleString('id-ID')}
                    </td>
                    <td style="padding:10px 14px;">
                      <div style="font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:170px;" title="${esc(v.user_name || 'User #' + v.user_id)}">
                        ${esc(v.user_name || 'User #' + v.user_id)}
                      </div>
                      <div style="font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:170px;">
                        ${esc(v.user_email || 'ID: ' + v.user_id)}
                      </div>
                    </td>
                    <td style="padding:10px 14px;">
                      <span class="badge ${v.used_at ? 'status-batal' : 'status-selesai'}">
                        ${v.used_at ? 'Sudah Dipakai' : 'Siap Pakai'}
                      </span>
                    </td>
                    <td style="padding:10px 14px;text-align:right;">
                      <button class="action-btn action-btn-danger" onclick="App.deleteVoucher(${v.id})" aria-label="Cabut voucher ${esc(v.code)}">Cabut</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      } else {
        c.innerHTML = `
          <div style="margin-bottom:24px;">
            <h3 style="margin:0 0 4px;color:var(--text);font-size:20px;font-weight:800;">🏷️ Kupon &amp; Promo Spesial</h3>
            <div style="font-size:13px;color:var(--muted);">Gunakan kode promo saat melakukan pemesanan untuk mendapatkan potongan harga spesial!</div>
          </div>

          <div class="ticket-grid">
            ${promos.filter(p => p.is_active).length === 0
              ? '<div class="card" style="grid-column:1/-1;padding:32px;text-align:center;color:var(--muted);">Saat ini belum ada promo yang sedang aktif. Nantikan promo menarik berikutnya!</div>'
              : promos.filter(p => p.is_active).map(p => `
                <div class="ticket-card">
                  <div class="ticket-left">
                    <div class="ticket-discount-val">${p.type === 'percent' ? esc(p.value) + '%' : (p.value >= 1000 ? Math.round(p.value/1000) + 'k' : p.value)}</div>
                    <div class="ticket-discount-type">POTONGAN</div>
                  </div>
                  <div class="ticket-right">
                    <div>
                      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                        <span class="ticket-code-pill">🏷️ ${esc(p.code || 'PROMO')}</span>
                        <span style="font-size:11px;color:var(--muted);font-weight:600;">${p.expires_at ? 's/d ' + esc(String(p.expires_at).slice(0, 10)) : 'Aktif'}</span>
                      </div>
                      <h4 style="margin:6px 0 4px;font-size:15px;font-weight:800;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(p.name)}">${esc(p.name)}</h4>
                      <div style="font-size:12px;color:var(--muted);margin-bottom:12px;">
                        <div>Min. belanja: Rp ${Number(p.min_spend || 0).toLocaleString('id-ID')}</div>
                        ${p.max_discount > 0 ? `<div>Maks. diskon: Rp ${Number(p.max_discount).toLocaleString('id-ID')}</div>` : ''}
                      </div>
                    </div>
                    <button class="btn btn-copy" style="width:100%;padding:8px;font-size:12px;border:1px dashed var(--blue);background:var(--blue-soft);color:var(--blue);border-radius:6px;cursor:pointer;font-weight:700;transition:all 0.2s;" onclick="navigator.clipboard.writeText('${esc(p.code)}'); this.textContent='✓ Kode Tersalin!'; setTimeout(() => this.textContent='📋 Salin Kode Promo', 2000);">📋 Salin Kode Promo</button>
                  </div>
                </div>
              `).join('')}
          </div>

          <div style="margin-bottom:16px;">
            <h3 style="margin:0 0 4px;color:var(--text);font-size:18px;font-weight:800;">🎁 Voucher Saya</h3>
            <div style="font-size:13px;color:var(--muted);">Koleksi voucher diskon pribadi Anda yang siap digunakan</div>
          </div>
          <div class="card" style="padding:0;border-radius:var(--radius-md);overflow-x:auto;">
            <table class="table" style="width:100%;min-width:680px;table-layout:fixed;border-collapse:collapse;text-align:left;font-size:13px;">
              <colgroup>
                <col style="width:160px;">
                <col style="width:240px;">
                <col style="width:130px;">
                <col style="width:120px;">
                <col style="width:90px;">
              </colgroup>
              <thead>
                <tr style="border-bottom:2px solid var(--line);color:var(--muted);background:var(--bg-subtle);">
                  <th style="padding:12px 14px;">Kode Voucher</th>
                  <th style="padding:12px 14px;">Nama Promo</th>
                  <th style="padding:12px 14px;">Nilai</th>
                  <th style="padding:12px 14px;">Status</th>
                  <th style="padding:12px 14px;text-align:right;">Aksi</th>
                </tr>
              </thead>
              <tbody>
                ${vouchers.length === 0
                  ? '<tr><td colspan="5" style="padding:28px;text-align:center;color:var(--muted);">Belum ada voucher di akun Anda.</td></tr>'
                  : vouchers.map(v => `
                  <tr style="border-bottom:1px solid var(--line);transition:background 0.15s ease;">
                    <td style="padding:10px 14px;">
                      <span class="ticket-code-pill" style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(v.code)}">
                        🎁 ${esc(v.code)}
                      </span>
                    </td>
                    <td style="padding:10px 14px;">
                      <div style="font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px;" title="${esc(v.name)}">
                        ${esc(v.name)}
                      </div>
                    </td>
                    <td style="padding:10px 14px;font-weight:800;color:var(--green);">
                      ${v.type === 'percent' ? esc(v.value) + '%' : 'Rp ' + Number(v.value).toLocaleString('id-ID')}
                    </td>
                    <td style="padding:10px 14px;">
                      <span class="badge ${v.used_at ? 'status-batal' : 'status-selesai'}">
                        ${v.used_at ? 'Sudah Dipakai' : 'Siap Pakai'}
                      </span>
                    </td>
                    <td style="padding:10px 14px;text-align:right;">
                      ${!v.used_at ? `
                        <button class="action-btn" onclick="navigator.clipboard.writeText('${esc(v.code)}'); this.textContent='✓ Salin'; setTimeout(() => this.textContent='Salin', 2000);">Salin</button>
                      ` : '<span style="color:var(--muted);font-size:12px;">—</span>'}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }
    } catch (e) {
      c.innerHTML = '<div class="err">Kesalahan memuat promo</div>';
    }
  },

  // Service Management Methods
  openServiceModal(id = null) {
    this._editServiceId = id;
    const modal = document.getElementById('serviceModal');
    if (!modal) return;
    const isEdit = !!id;
    document.getElementById('serviceModalTitle').textContent = isEdit ? '✏️ Edit Layanan & Tarif' : '💲 Tambah Layanan Laundry Baru';
    if (isEdit && this._services) {
      const s = this._services.find(item => item.id === id);
      if (s) {
        document.getElementById('svcCode').value = s.code || '';
        document.getElementById('svcName').value = s.name || '';
        document.getElementById('svcCategory').value = s.category || 'Reguler';
        document.getElementById('svcUnit').value = s.unit || 'kg';
        document.getElementById('svcPrice').value = s.price || 0;
        document.getElementById('svcHours').value = s.duration_hours || 24;
        document.getElementById('svcBadge').value = s.badge || '';
        document.getElementById('svcDesc').value = s.description || '';
        document.getElementById('svcActive').checked = !!s.is_active;
      }
    } else {
      document.getElementById('serviceForm').reset();
      document.getElementById('svcCode').value = 'SVC-' + Math.floor(100 + Math.random() * 900);
      document.getElementById('svcCategory').value = 'Reguler';
      document.getElementById('svcUnit').value = 'kg';
      document.getElementById('svcPrice').value = '10000';
      document.getElementById('svcHours').value = '24';
      document.getElementById('svcActive').checked = true;
    }
    modal.style.display = 'grid';
  },

  async toggleServiceActive(id, newActive) {
    try {
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_active', id: Number(id), is_active: newActive ? 1 : 0 })
      });
      const data = await res.json();
      if (data.ok) {
        this.toast(`Status layanan #${id} diperbarui`, 'success');
        this.renderLayanan();
      } else {
        this.toast(data.msg || 'Gagal mengubah status layanan', 'error');
      }
    } catch (e) {
      this.toast('Gagal menghubungi server', 'error');
    }
  },

  async deleteService(id) {
    if (!await this.confirm('Apakah Anda yakin ingin menghapus layanan ini?')) return;
    try {
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_service', id: Number(id) })
      });
      const data = await res.json();
      if (data.ok) {
        this.toast('Layanan berhasil dihapus', 'success');
        this.renderLayanan();
      } else {
        this.toast(data.msg || 'Gagal menghapus layanan', 'error');
      }
    } catch (e) {
      this.toast('Gagal menghubungi server', 'error');
    }
  },

  // Delivery Logistics Methods
  openDeliveryModal() {
    const modal = document.getElementById('deliveryModal');
    if (!modal) return;
    document.getElementById('deliveryForm').reset();
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('dlvDate');
    if (dateInput) dateInput.value = today;
    const timeInput = document.getElementById('dlvStartTime');
    if (timeInput) timeInput.value = '09:00';
    modal.style.display = 'grid';
  },

  async assignCourier(taskId, courierId) {
    if (!courierId) return;
    try {
      const res = await fetch('/api/delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'assign_courier', id: Number(taskId), courier_id: Number(courierId) })
      });
      const data = await res.json();
      if (data.ok) {
        this.toast('Kurir berhasil ditugaskan', 'success');
        this.renderDelivery();
      } else {
        this.toast(data.msg || 'Gagal menugaskan kurir', 'error');
      }
    } catch (e) {
      this.toast('Gagal menghubungi server', 'error');
    }
  },

  openPromoForm(id) {
    this._editPromoId = id || null;
    const wrap = document.getElementById('promoFormWrap');
    if (!wrap) return;
    document.getElementById('promoFormTitle').textContent = id ? 'Edit Promo' : 'Tambah Promo';
    document.getElementById('pfCode').value = '';
    document.getElementById('pfName').value = '';
    document.getElementById('pfType').value = 'percent';
    document.getElementById('pfValue').value = '0';
    document.getElementById('pfMinSpend').value = '0';
    document.getElementById('pfMaxDiscount').value = '0';
    document.getElementById('pfExpires').value = '';
    document.getElementById('pfActive').checked = true;

    if (id) {
      const p = (this._promos || []).find(x => x.id === id);
      if (p) {
        document.getElementById('pfCode').value = p.code || '';
        document.getElementById('pfName').value = p.name || '';
        document.getElementById('pfType').value = p.type || 'percent';
        document.getElementById('pfValue').value = p.value ?? 0;
        document.getElementById('pfMinSpend').value = p.min_spend ?? 0;
        document.getElementById('pfMaxDiscount').value = p.max_discount ?? 0;
        document.getElementById('pfExpires').value = p.expires_at ? String(p.expires_at).slice(0, 16) : '';
        document.getElementById('pfActive').checked = !!p.is_active;
      }
    }
    wrap.style.display = 'block';
    wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  async savePromo() {
    const id = this._editPromoId;
    const expiresRaw = document.getElementById('pfExpires').value;
    const payload = {
      action: id ? 'update_promo' : 'create_promo',
      ...(id ? { id } : {}),
      code: document.getElementById('pfCode').value.trim(),
      name: document.getElementById('pfName').value.trim(),
      type: document.getElementById('pfType').value,
      value: Number(document.getElementById('pfValue').value) || 0,
      min_spend: Number(document.getElementById('pfMinSpend').value) || 0,
      max_discount: Number(document.getElementById('pfMaxDiscount').value) || 0,
      expires_at: expiresRaw ? expiresRaw.replace('T', ' ') + ':00' : null,
      is_active: document.getElementById('pfActive').checked ? 1 : 0
    };
    try {
      const res = await fetch('/api/promos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.ok) this.renderPromo();
      else this.toast(data.msg || 'Gagal menyimpan promo', 'error');
    } catch (e) {
      this.toast('Koneksi gagal', 'error');
    }
  },

  async togglePromo(id, newVal) {
    try {
      const res = await fetch('/api/promos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_active', id, is_active: newVal })
      });
      const data = await res.json();
      if (data.ok) this.renderPromo();
      else this.toast(data.msg || 'Gagal mengubah status', 'error');
    } catch (e) {
      this.toast('Koneksi gagal', 'error');
    }
  },

  async deletePromo(id) {
    if (!await this.confirm('Hapus promo ini? Voucher yang sudah diklaim tidak akan terhapus.')) return;
    try {
      const res = await fetch('/api/promos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_promo', id })
      });
      const data = await res.json();
      if (data.ok) this.renderPromo();
      else this.toast(data.msg || 'Gagal menghapus', 'error');
    } catch (e) {
      this.toast('Koneksi gagal', 'error');
    }
  },

  async claimVoucher(promoId) {
    try {
      const res = await fetch('/api/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'claim', promo_id: promoId })
      });
      const data = await res.json();
      if (data.ok) {
        this.toast('Voucher berhasil diklaim!', 'success');
        this.renderPromo();
      } else {
        this.toast(data.msg || 'Gagal klaim', 'error');
      }
    } catch (e) {
      this.toast('Koneksi gagal', 'error');
    }
  },

  openGrantVoucherForm() {
    const wrap = document.getElementById('grantVoucherWrap');
    if (!wrap) return;
    document.getElementById('gvUserId').value = '';
    wrap.style.display = 'block';
    wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  async grantVoucher() {
    const promoId = Number(document.getElementById('gvPromoId').value);
    const type = document.getElementById('gvType').value;
    const rawUser = document.getElementById('gvUserId').value.trim();

    if (!promoId || !rawUser) {
      this.toast('Pilih promo dan masukkan User ID', 'warning');
      return;
    }

    try {
      let payload;
      if (type === 'single') {
        const uid = Number(rawUser);
        if (!uid || isNaN(uid)) {
          this.toast('User ID harus berupa angka bulat valid', 'warning');
          return;
        }
        payload = { action: 'create_voucher', promo_id: promoId, user_id: uid };
      } else {
        const ids = rawUser.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n) && n > 0);
        if (ids.length === 0) {
          this.toast('Masukkan minimal satu User ID valid', 'warning');
          return;
        }
        payload = { action: 'bulk_claim', promo_id: promoId, user_ids: ids };
      }

      const res = await fetch('/api/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.ok) {
        document.getElementById('grantVoucherWrap').style.display = 'none';
        this.toast(type === 'single' ? 'Voucher berhasil diterbitkan!' : `Berhasil menerbitkan ${data.created || 0} voucher!`, 'success');
        this.renderPromo();
      } else {
        this.toast(data.msg || 'Gagal menerbitkan voucher', 'error');
      }
    } catch (e) {
      this.toast('Koneksi gagal', 'error');
    }
  },

  async deleteVoucher(id) {
    if (!await this.confirm('Cabut voucher ini dari pelanggan?', { okLabel: 'Cabut', okClass: 'primary' })) return;
    try {
      const res = await fetch('/api/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_voucher', id: Number(id) })
      });
      const data = await res.json();
      if (data.ok) {
        this.renderPromo();
      } else {
        this.toast(data.msg || 'Gagal mencabut voucher', 'error');
      }
    } catch (e) {
      this.toast('Koneksi gagal', 'error');
    }
  },

  // C8: Laporan Keuangan & Kinerja dengan Visualisasi Chart Interaktif
  _reportFilter: { group: 'bulan', start: '', end: '' },

  setReportPreset(preset) {
    const today = new Date();
    const pad = n => String(n).padStart(2, '0');
    const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    let start = '';
    let end = fmt(today);

    if (preset === 'today') {
      start = end;
    } else if (preset === 'month') {
      start = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`;
    } else if (preset === '30days') {
      const past = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);
      start = fmt(past);
    } else if (preset === 'year') {
      start = `${today.getFullYear()}-01-01`;
    } else if (preset === 'all') {
      start = '';
      end = '';
    }

    const sEl = document.getElementById('reportStart');
    const eEl = document.getElementById('reportEnd');
    if (sEl) sEl.value = start;
    if (eEl) eEl.value = end;

    this.applyReportFilter();
  },

  async applyReportFilter() {
    const groupEl = document.getElementById('reportGroup');
    const startEl = document.getElementById('reportStart');
    const endEl = document.getElementById('reportEnd');

    const group = groupEl ? groupEl.value : (this._reportFilter?.group || 'bulan');
    const start = startEl ? startEl.value : (this._reportFilter?.start || '');
    const end = endEl ? endEl.value : (this._reportFilter?.end || '');

    this._reportFilter = { group, start, end };
    await this.renderLaporan();
  },

  buildSvgChart(chartRows) {
    if (!Array.isArray(chartRows) || chartRows.length === 0) {
      return `
        <div style="text-align: center; padding: 48px 16px; color: var(--muted);">
          <div style="font-size: 36px; margin-bottom: 8px;">📊</div>
          <div style="font-weight: 700; font-size: 15px; color: var(--text);">Tidak ada data grafik transaksi</div>
          <div style="font-size: 13px; color: var(--muted); margin-top: 4px;">Coba ubah rentang tanggal atau pengelompokan periode di atas.</div>
        </div>
      `;
    }

    const maxVal = Math.max(...chartRows.map(d => (Number(d.paid) || 0) + (Number(d.unpaid) || 0)), 10000);
    const niceMax = Math.ceil(maxVal * 1.15);

    const svgWidth = 760;
    const svgHeight = 280;
    const padL = 85;
    const padR = 25;
    const padT = 25;
    const padB = 45;
    const plotW = svgWidth - padL - padR;
    const plotH = svgHeight - padT - padB;

    const n = chartRows.length;
    const colW = plotW / n;
    const barW = Math.max(12, Math.min(48, colW * (n === 1 ? 0.35 : 0.65)));

    const gridLines = [];
    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
      const val = Math.round((niceMax / ticks) * i);
      const y = padT + plotH - (val / niceMax) * plotH;
      let label = val >= 1000000 ? `${(val / 1000000).toFixed(1)}jt` : (val >= 1000 ? `${Math.round(val / 1000)}rb` : String(val));
      gridLines.push(`
        <line x1="${padL}" y1="${y}" x2="${padL + plotW}" y2="${y}" stroke="var(--line)" stroke-width="1" stroke-dasharray="${i === 0 ? '0' : '4'}"/>
        <text x="${padL - 12}" y="${y + 4}" text-anchor="end" font-size="11" fill="var(--muted)" font-family="system-ui, sans-serif" font-weight="500">Rp ${label}</text>
      `);
    }

    const bars = [];
    chartRows.forEach((d, i) => {
      const paid = Number(d.paid) || 0;
      const unpaid = Number(d.unpaid) || 0;
      const total = paid + unpaid;

      const paidH = (paid / niceMax) * plotH;
      const unpaidH = (unpaid / niceMax) * plotH;

      const cx = padL + (i + 0.5) * colW;
      const bx = cx - barW / 2;
      const byPaid = padT + plotH - paidH;
      const byUnpaid = byPaid - unpaidH;

      const periodLabel = String(d.g || '');
      const shortLabel = periodLabel.length > 10 ? periodLabel.slice(-5) : periodLabel;

      bars.push(`
        <g class="chart-col" data-period="${esc(periodLabel)}" data-paid="${paid}" data-unpaid="${unpaid}" data-total="${total}" style="cursor: pointer;">
          <rect x="${cx - barW / 2 - 4}" y="${padT}" width="${barW + 8}" height="${plotH}" fill="transparent" rx="6" class="col-hover-track" style="transition: fill 0.2s;" />
          ${paid > 0 ? `<rect x="${bx}" y="${byPaid}" width="${barW}" height="${paidH}" fill="var(--blue)" rx="4" class="bar-paid" style="transition: opacity 0.2s;"/>` : ''}
          ${unpaid > 0 ? `<rect x="${bx}" y="${byUnpaid}" width="${barW}" height="${unpaidH}" fill="var(--amber)" rx="4" class="bar-unpaid" style="transition: opacity 0.2s;"/>` : ''}
          <text x="${cx}" y="${padT + plotH + 22}" text-anchor="middle" font-size="11" fill="var(--muted)" font-weight="600">${esc(shortLabel)}</text>
          <rect x="${padL + i * colW}" y="${padT}" width="${colW}" height="${plotH + 30}" fill="transparent" class="bar-hover-hit"/>
        </g>
      `);
    });

    return `
      <div style="position: relative; width: 100%; overflow-x: auto;">
        <svg viewBox="0 0 ${svgWidth} ${svgHeight}" style="width: 100%; min-width: 620px; height: 280px; display: block;" preserveAspectRatio="xMidYMid meet" id="reportSvgChart">
          ${gridLines.join('')}
          ${bars.join('')}
        </svg>
        <div id="chartTooltip" style="position: absolute; display: none; pointer-events: none; z-index: 20; background: var(--color-bg-inverse, #0f172a); color: var(--color-text-on-inverse, #ffffff); padding: 10px 14px; border-radius: 8px; font-size: 12px; box-shadow: var(--shadow-card); transform: translate(-50%, -100%); margin-top: -8px; border: 1px solid rgba(255,255,255,0.1);"></div>
      </div>
    `;
  },

  async renderLaporan() {
    document.getElementById('pageTitle').textContent = 'Laporan Keuangan & Kinerja';
    const c = document.getElementById('mainContent');
    c.innerHTML = `
      <div style="display: flex; gap: 8px; margin-bottom: 20px; opacity: 0.6; pointer-events: none;">
        <div class="skeleton" style="width: 130px; height: 36px;"></div>
        <div class="skeleton" style="width: 130px; height: 36px;"></div>
        <div class="skeleton" style="width: 130px; height: 36px;"></div>
      </div>
      ${this.renderSkeletonCards(4)}
      <div class="skeleton-card" style="height: 260px; margin-bottom: 24px; display: grid; place-items: center;" aria-busy="true">
        <div class="skeleton skeleton-title" style="width: 35%; height: 20px;"></div>
      </div>
      ${this.renderSkeletonTable({ columns: 4, rows: 5, hasActions: false })}
    `;

    const filter = this._reportFilter || { group: 'bulan', start: '', end: '' };
    const params = new URLSearchParams();
    if (filter.group) params.set('group', filter.group);
    if (filter.start) params.set('start', filter.start);
    if (filter.end) params.set('end', filter.end);

    const queryStr = params.toString() ? `?${params.toString()}` : '';

    try {
      const res = await fetch(`/api/reports${queryStr}`);
      if (res.status === 403) {
        c.innerHTML = '<div class="err" style="padding: 24px;">Akses ditolak: Laporan hanya tersedia untuk peran Admin, Owner, dan Staff.</div>';
        return;
      }
      const data = await res.json();
      if (!data.ok) {
        c.innerHTML = `<div class="err" style="padding: 24px;">Gagal memuat laporan: ${esc(data.msg || 'Terjadi kesalahan')}</div>`;
        return;
      }

      const kpi = data.kpi || {};
      const chartRows = data.chart || [];
      const daily = data.daily || [];

      const totalPaid = chartRows.reduce((acc, row) => acc + (Number(row.paid) || 0), 0);
      const totalUnpaid = chartRows.reduce((acc, row) => acc + (Number(row.unpaid) || 0), 0);

      c.innerHTML = `
        <!-- FILTER & CONTROLS -->
        <div class="card" style="padding: 18px 22px; border-radius: var(--radius-md); margin-bottom: 24px;">
          <div style="display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-end; justify-content: space-between;">
            <div style="display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end;">
              <div>
                <label style="display: block; font-size: 12px; font-weight: 700; color: var(--muted); margin-bottom: 5px;">Kelompokkan</label>
                <select id="reportGroup" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--line); font-size: 13px; font-weight: 600; background: var(--card); color: var(--text);">
                  <option value="bulan" ${filter.group === 'bulan' ? 'selected' : ''}>Bulanan</option>
                  <option value="minggu" ${filter.group === 'minggu' ? 'selected' : ''}>Mingguan</option>
                  <option value="hari" ${filter.group === 'hari' ? 'selected' : ''}>Harian</option>
                </select>
              </div>

              <div>
                <label style="display: block; font-size: 12px; font-weight: 700; color: var(--muted); margin-bottom: 5px;">Dari Tanggal</label>
                <input type="date" id="reportStart" value="${esc(filter.start || '')}" style="padding: 7px 10px; border-radius: 8px; border: 1px solid var(--line); font-size: 13px; background: var(--card); color: var(--text);">
              </div>

              <div>
                <label style="display: block; font-size: 12px; font-weight: 700; color: var(--muted); margin-bottom: 5px;">Sampai Tanggal</label>
                <input type="date" id="reportEnd" value="${esc(filter.end || '')}" style="padding: 7px 10px; border-radius: 8px; border: 1px solid var(--line); font-size: 13px; background: var(--card); color: var(--text);">
              </div>

              <button type="button" class="btn btn-primary" onclick="App.applyReportFilter()" style="padding: 8px 18px; font-size: 13px; font-weight: 700;">
                🔍 Terapkan Filter
              </button>
            </div>

            <div style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center;">
              <button type="button" class="cat-tab" onclick="App.setReportPreset('month')" style="padding: 6px 14px; font-size: 12px;">Bulan Ini</button>
              <button type="button" class="cat-tab" onclick="App.setReportPreset('30days')" style="padding: 6px 14px; font-size: 12px;">30 Hari</button>
              <button type="button" class="cat-tab" onclick="App.setReportPreset('year')" style="padding: 6px 14px; font-size: 12px;">Tahun Ini</button>
              <button type="button" class="cat-tab" onclick="App.setReportPreset('all')" style="padding: 6px 14px; font-size: 12px;">Semua</button>
              <button type="button" class="btn btn-sm" onclick="window.print()" style="padding: 6px 14px; font-size: 12px; background: var(--color-bg-inverse, #0f172a); color: var(--color-text-on-inverse, #ffffff); border-radius: 99px; font-weight: 600;">🖨️ Cetak</button>
            </div>
          </div>
        </div>

        <!-- EXECUTIVE KPI CARDS -->
        <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px;">
          <div class="card" style="padding: 20px 22px; border-radius: var(--radius-md); position: relative; overflow: hidden;">
            <div style="font-size: 12px; color: var(--muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px;">Total Omset</div>
            <div class="kpi-value" data-count="${Number(kpi.rev || 0)}" data-currency="1" data-lang="id" style="font-size: 26px; font-weight: 800; color: var(--text); margin-top: 6px; font-variant-numeric: tabular-nums;">Rp ${Number(kpi.rev || 0).toLocaleString('id-ID')}</div>
            <div style="font-size: 12px; color: var(--muted); margin-top: 4px;">Seluruh pendapatan kotor periode</div>
          </div>
          <div class="card" style="padding: 20px 22px; border-radius: var(--radius-md); border-left: 4px solid var(--blue); position: relative; overflow: hidden;">
            <div style="font-size: 12px; color: var(--blue); font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px;">Kas Terbayar</div>
            <div class="kpi-value" data-count="${Number(totalPaid || kpi.rev || 0)}" data-currency="1" data-lang="id" style="font-size: 26px; font-weight: 800; color: var(--blue); margin-top: 6px; font-variant-numeric: tabular-nums;">Rp ${Number(totalPaid || kpi.rev || 0).toLocaleString('id-ID')}</div>
            <div style="font-size: 12px; color: var(--muted); margin-top: 4px;">Pembayaran lunas diterima</div>
          </div>
          <div class="card" style="padding: 20px 22px; border-radius: var(--radius-md); border-left: 4px solid var(--amber); position: relative; overflow: hidden;">
            <div style="font-size: 12px; color: var(--amber); font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px;">Piutang / Belum Lunas</div>
            <div class="kpi-value" data-count="${Number(totalUnpaid)}" data-currency="1" data-lang="id" style="font-size: 26px; font-weight: 800; color: var(--amber); margin-top: 6px; font-variant-numeric: tabular-nums;">Rp ${Number(totalUnpaid).toLocaleString('id-ID')}</div>
            <div style="font-size: 12px; color: var(--muted); margin-top: 4px;">Sisa tagihan pelanggan</div>
          </div>
          <div class="card" style="padding: 20px 22px; border-radius: var(--radius-md); border-left: 4px solid var(--green); position: relative; overflow: hidden;">
            <div style="font-size: 12px; color: var(--green); font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px;">Total Order &amp; Bobot</div>
            <div class="kpi-value" data-count="${Number(kpi.ord || 0)}" style="font-size: 26px; font-weight: 800; color: var(--text); margin-top: 6px; font-variant-numeric: tabular-nums;">${Number(kpi.ord || 0)} <span style="font-size: 14px; font-weight: 600; color: var(--muted);">order</span></div>
            <div style="font-size: 12px; color: var(--green); font-weight: 600; margin-top: 4px;">Rata-rata: ${kpi.avg_wt || 0} kg/order</div>
          </div>
        </div>

        <!-- INTERACTIVE CHART -->
        <div class="card" style="padding: 22px 24px; border-radius: var(--radius-md); margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; flex-wrap: wrap; gap: 12px;">
            <div>
              <h4 style="margin: 0; font-size: 17px; font-weight: 800; color: var(--text);">Grafik Perkembangan Pendapatan</h4>
              <div style="font-size: 12px; color: var(--muted); margin-top: 2px;">Visualisasi perbandingan omset terbayar vs piutang berdasarkan periode terpilih</div>
            </div>
            <div style="display: flex; align-items: center; gap: 16px; font-size: 12px; font-weight: 600;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="width: 12px; height: 12px; background: var(--blue); border-radius: 3px; display: inline-block;"></span>
                <span style="color: var(--text);">Terbayar Lunas</span>
              </div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="width: 12px; height: 12px; background: var(--amber); border-radius: 3px; display: inline-block;"></span>
                <span style="color: var(--text);">Piutang Belum Lunas</span>
              </div>
            </div>
          </div>

          <div id="chartContainer">
            ${this.buildSvgChart(chartRows)}
          </div>
        </div>

        <!-- DAILY BREAKDOWN TABLE -->
        <div class="card" style="padding: 0; border-radius: var(--radius-md); overflow-x: auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 18px 22px; border-bottom: 1px solid var(--line);">
            <div>
              <h4 style="margin: 0; font-size: 16px; font-weight: 800; color: var(--text);">Rincian Harian Transaksi</h4>
              <div style="font-size: 12px; color: var(--muted); margin-top: 2px;">Daftar rekapan pesanan per hari dalam rentang periode</div>
            </div>
            <div style="font-size: 12px; font-weight: 700; color: var(--blue); background: var(--blue-soft); padding: 4px 12px; border-radius: 99px;">
              ${daily.length} Hari Aktif
            </div>
          </div>

          <table class="table" style="width: 100%; min-width: 680px; table-layout: fixed; border-collapse: collapse; text-align: left; font-size: 13px;">
            <colgroup>
              <col style="width: 170px;">
              <col style="width: 140px;">
              <col style="width: 140px;">
              <col style="width: 230px;">
            </colgroup>
            <thead>
              <tr style="border-bottom: 2px solid var(--line); color: var(--muted); background: var(--bg-subtle);">
                <th style="padding: 12px 16px;">Tanggal</th>
                <th style="padding: 12px 16px;">Jumlah Order</th>
                <th style="padding: 12px 16px;">Total Berat</th>
                <th style="padding: 12px 16px;">Total Pendapatan</th>
              </tr>
            </thead>
            <tbody>
              ${daily.length === 0 ? `
                <tr>
                  <td colspan="4" style="padding: 28px; text-align: center; color: var(--muted);">Tidak ada data transaksi harian pada rentang filter ini.</td>
                </tr>
              ` : daily.map(d => `
                <tr style="border-bottom: 1px solid var(--line); transition: background 0.15s ease;">
                  <td style="padding: 12px 16px; font-weight: 700; color: var(--text);">📅 ${esc(d.d)}</td>
                  <td style="padding: 12px 16px; color: var(--blue); font-weight: 700;">${esc(d.orders)} order</td>
                  <td style="padding: 12px 16px; color: var(--green); font-weight: 700;">${esc(d.weight)} kg</td>
                  <td style="padding: 12px 16px; font-weight: 800; color: var(--text); font-variant-numeric: tabular-nums;">Rp ${Number(d.revenue).toLocaleString('id-ID')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      // Animate KPIs explicitly after setting c.innerHTML to guarantee numbers count up
      this.animateKpis(c);

      // Attach Chart Tooltip Event Listeners
      const svg = document.getElementById('reportSvgChart');
      const tooltip = document.getElementById('chartTooltip');
      if (svg && tooltip) {
        svg.querySelectorAll('.chart-col').forEach(col => {
          col.addEventListener('mouseenter', () => {
            const period = col.getAttribute('data-period');
            const paid = Number(col.getAttribute('data-paid')) || 0;
            const unpaid = Number(col.getAttribute('data-unpaid')) || 0;
            const total = Number(col.getAttribute('data-total')) || 0;

            tooltip.innerHTML = `
              <div style="font-weight: 800; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 5px; margin-bottom: 6px; font-size: 13px;">Periode: ${esc(period)}</div>
              <div style="color: #60a5fa; display: flex; justify-content: space-between; gap: 12px;"><span>Terbayar:</span> <strong>Rp ${paid.toLocaleString('id-ID')}</strong></div>
              <div style="color: #fbbf24; display: flex; justify-content: space-between; gap: 12px; margin-top: 2px;"><span>Piutang:</span> <strong>Rp ${unpaid.toLocaleString('id-ID')}</strong></div>
              <div style="font-weight: 800; margin-top: 6px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 5px; display: flex; justify-content: space-between; gap: 12px;"><span>Total:</span> <strong>Rp ${total.toLocaleString('id-ID')}</strong></div>
            `;
            tooltip.style.display = 'block';
          });

          col.addEventListener('mousemove', (e) => {
            const containerRect = svg.parentElement.getBoundingClientRect();
            const left = e.clientX - containerRect.left;
            const top = e.clientY - containerRect.top;
            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${top}px`;
          });

          col.addEventListener('mouseleave', () => {
            tooltip.style.display = 'none';
          });
        });
      }
    } catch (e) {
      c.innerHTML = '<div class="err" style="padding: 24px;">Kesalahan saat memuat data laporan keuangan.</div>';
    }
  },

  async renderProfile() {
    document.getElementById('pageTitle').textContent = 'Profil Saya';
    const c = document.getElementById('mainContent');
    c.innerHTML = `
      <div style="max-width: 900px; margin: 0 auto; display: grid; gap: 20px;" aria-busy="true" aria-label="Memuat profil...">
        <div class="skeleton-card" style="height: 120px; border-radius: var(--radius-md);"></div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <div class="skeleton-card" style="height: 320px; border-radius: var(--radius-md);"></div>
          <div class="skeleton-card" style="height: 320px; border-radius: var(--radius-md);"></div>
        </div>
      </div>
    `;

    try {
      const res = await fetch('/api/profile');
      const data = await res.json();
      const u = data.user || this.user || {};

      const fullName = u.full_name || u.name || 'Pengguna';
      const role = u.role || u.user_role || 'Customer';
      const initials = fullName.charAt(0).toUpperCase();
      const email = u.email || '';
      const phone = u.phone || '';
      const userId = u.id || u.user_id || 1;

      c.innerHTML = `
        <div style="max-width: 960px; margin: 0 auto;">
          <!-- PROFILE HERO BANNER -->
          <div class="profile-hero-card">
            <div style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap;">
              <div class="profile-avatar-xl">${esc(initials)}</div>
              <div>
                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                  <h2 style="margin: 0; font-size: 22px; font-weight: 800; color: var(--text);">${esc(fullName)}</h2>
                  <span class="badge" style="background: var(--blue-soft); color: var(--blue); border: 1px solid var(--blue-border); font-size: 12px; font-weight: 700; padding: 3px 10px;">
                    🛡️ ${esc(role)} Terverifikasi
                  </span>
                </div>
                <div style="display: flex; align-items: center; gap: 14px; margin-top: 6px; font-size: 13px; color: var(--muted); flex-wrap: wrap;">
                  <span>✉️ ${esc(email)}</span>
                  <span>🆔 ID Akun: #${esc(String(userId))}</span>
                  <span>⚡ Hak Akses: Penuh</span>
                </div>
              </div>
            </div>

            <div class="profile-stats-ribbon">
              <div class="profile-stat-box">
                <div class="profile-stat-num">Aktif</div>
                <div class="profile-stat-lbl">Status Akun</div>
              </div>
              <div class="profile-stat-box">
                <div class="profile-stat-num" style="color: var(--blue);">${esc(role)}</div>
                <div class="profile-stat-lbl">Tingkat Peran</div>
              </div>
              <div class="profile-stat-box">
                <div class="profile-stat-num" style="color: var(--green);">Terlindungi 🔒</div>
                <div class="profile-stat-lbl">Keamanan</div>
              </div>
            </div>
          </div>

          <!-- 2-COLUMN BENTO GRID -->
          <div class="profile-grid-layout">
            <!-- LEFT COLUMN: PERSONAL INFO -->
            <div class="card" style="padding: 26px 28px; border-radius: var(--radius-md);">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                <span style="font-size: 20px;">👤</span>
                <h3 style="margin: 0; font-size: 17px; font-weight: 800; color: var(--text);">Informasi Pribadi</h3>
              </div>
              <p style="margin: 0 0 20px; font-size: 13px; color: var(--muted);">Perbarui identitas profil dan kontak komunikasi Anda.</p>

              <form id="profileForm">
                <div style="margin-bottom: 16px;">
                  <label for="profName" style="display: block; font-size: 13px; font-weight: 700; margin-bottom: 6px; color: var(--text);">Nama Lengkap</label>
                  <input type="text" id="profName" class="input-control" value="${esc(fullName)}" required style="width: 100%; box-sizing: border-box; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--line); background: var(--card); color: var(--text); font-size: 14px;">
                </div>

                <div style="margin-bottom: 16px;">
                  <label style="display: block; font-size: 13px; font-weight: 700; margin-bottom: 6px; color: var(--text);">Email Akun (Terkunci)</label>
                  <div style="position: relative; display: flex; align-items: center;">
                    <input type="email" class="input-control" value="${esc(email)}" disabled style="width: 100%; box-sizing: border-box; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--line); background: var(--bg-subtle); color: var(--muted); font-size: 14px; cursor: not-allowed;">
                    <span style="position: absolute; right: 12px; font-size: 12px; color: var(--muted);">🔒 Permanen</span>
                  </div>
                </div>

                <div style="margin-bottom: 22px;">
                  <label for="profPhone" style="display: block; font-size: 13px; font-weight: 700; margin-bottom: 6px; color: var(--text);">No. WhatsApp / Handphone</label>
                  <input type="text" id="profPhone" class="input-control" value="${esc(phone)}" placeholder="Contoh: 081234567890" style="width: 100%; box-sizing: border-box; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--line); background: var(--card); color: var(--text); font-size: 14px;">
                  <div style="font-size: 11px; color: var(--muted); margin-top: 4px;">Digunakan untuk notifikasi status pesanan &amp; struk WhatsApp.</div>
                </div>

                <button type="submit" class="btn btn-primary" style="padding: 10px 24px; font-size: 13px; font-weight: 700; border-radius: 8px;">
                  💾 Simpan Perubahan Profil
                </button>
              </form>
            </div>

            <!-- RIGHT COLUMN: SECURITY & PASSWORD -->
            <div class="card" style="padding: 26px 28px; border-radius: var(--radius-md);">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                <span style="font-size: 20px;">🔐</span>
                <h3 style="margin: 0; font-size: 17px; font-weight: 800; color: var(--text);">Keamanan &amp; Kata Sandi</h3>
              </div>
              <p style="margin: 0 0 20px; font-size: 13px; color: var(--muted);">Ubah kata sandi secara berkala untuk menjaga keamanan akun Anda.</p>

              <form id="passForm">
                <div style="margin-bottom: 16px;">
                  <label for="oldPass" style="display: block; font-size: 13px; font-weight: 700; margin-bottom: 6px; color: var(--text);">Kata Sandi Lama</label>
                  <div class="pass-input-wrap">
                    <input type="password" id="oldPass" class="input-control" required placeholder="Masukkan kata sandi saat ini" style="box-sizing: border-box; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--line); background: var(--card); color: var(--text); font-size: 14px;">
                    <button type="button" class="pass-toggle-btn" onclick="const i=document.getElementById('oldPass'); const isP=i.type==='password'; i.type=isP?'text':'password'; this.textContent=isP?'🙈':'👁️';" title="Lihat kata sandi">👁️</button>
                  </div>
                </div>

                <div style="margin-bottom: 16px;">
                  <label for="newPass" style="display: block; font-size: 13px; font-weight: 700; margin-bottom: 6px; color: var(--text);">Kata Sandi Baru</label>
                  <div class="pass-input-wrap">
                    <input type="password" id="newPass" class="input-control" required placeholder="Minimal 6 karakter" style="box-sizing: border-box; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--line); background: var(--card); color: var(--text); font-size: 14px;">
                    <button type="button" class="pass-toggle-btn" onclick="const i=document.getElementById('newPass'); const isP=i.type==='password'; i.type=isP?'text':'password'; this.textContent=isP?'🙈':'👁️';" title="Lihat kata sandi">👁️</button>
                  </div>
                </div>

                <div style="margin-bottom: 18px;">
                  <label for="repPass" style="display: block; font-size: 13px; font-weight: 700; margin-bottom: 6px; color: var(--text);">Konfirmasi Kata Sandi Baru</label>
                  <div class="pass-input-wrap">
                    <input type="password" id="repPass" class="input-control" required placeholder="Ulangi kata sandi baru" style="box-sizing: border-box; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--line); background: var(--card); color: var(--text); font-size: 14px;">
                    <button type="button" class="pass-toggle-btn" onclick="const i=document.getElementById('repPass'); const isP=i.type==='password'; i.type=isP?'text':'password'; this.textContent=isP?'🙈':'👁️';" title="Lihat kata sandi">👁️</button>
                  </div>
                </div>

                <div style="background: var(--bg-subtle); border-radius: 8px; padding: 10px 14px; margin-bottom: 20px; font-size: 12px; color: var(--muted); border: 1px solid var(--line);">
                  <div style="font-weight: 700; margin-bottom: 4px; color: var(--text);">Ketentuan Keamanan:</div>
                  <div>&bull; Panjang minimal 6 karakter</div>
                  <div>&bull; Disarankan kombinasi huruf kapital, angka, &amp; simbol</div>
                </div>

                <button type="submit" class="btn btn-primary" style="padding: 10px 24px; font-size: 13px; font-weight: 700; border-radius: 8px;">
                  🔑 Perbarui Kata Sandi
                </button>
              </form>
            </div>
          </div>
        </div>
      `;
    } catch (e) {
      c.innerHTML = '<div class="err">Kesalahan memuat profil</div>';
    }
  }
};

// Attach app.js to window unconditionally
if (typeof window !== 'undefined') window.App = App;
window.onload = () => App.init();

// Global error boundary — catch uncaught JS errors & unhandled promise rejections
window.addEventListener('error', (e) => {
  if (typeof App !== 'undefined' && App.renderError) {
    App.renderError(e.message || 'JavaScript error tidak diketahui.');
  }
});
window.addEventListener('unhandledrejection', (e) => {
  const msg = (e.reason && e.reason.message) ? e.reason.message : String(e.reason || 'Promise rejected.');
  if (typeof App !== 'undefined' && App.renderError) {
    App.renderError(msg);
  }
});
