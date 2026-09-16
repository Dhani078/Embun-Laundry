// HTML escape helper
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

// public/app.js - Embun Laundry Single Page App
const App = window.App = {
  user: null,
  currentPage: 'dashboard',

  async init() {
    this.initTheme();
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

  toast(msg, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
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

  confirm(msg) {
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
      el.innerHTML = `<div style="background:var(--card);border-radius:14px;padding:28px 28px 22px;max-width:360px;width:90%;box-shadow:var(--shadow-card);border:1px solid var(--line);">
        <p style="margin:0 0 20px;font-size:15px;font-weight:600;color:var(--text);line-height:1.5">${esc(msg)}</p>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button id="_confirmNo" style="padding:8px 18px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--text);font-size:13px;font-weight:600;cursor:pointer">Batal</button>
          <button id="_confirmYes" style="padding:8px 18px;border-radius:8px;border:none;background:var(--red);color:#fff;font-size:13px;font-weight:600;cursor:pointer">Hapus</button>
        </div>
      </div>`;
      document.body.appendChild(el);
      const cleanup = ok => { el.remove(); resolve(ok); };
      el.querySelector('#_confirmYes').onclick = () => cleanup(true);
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

    const qrSvg = `
      <svg width="64" height="64" viewBox="0 0 64 64" style="display:block;margin:0 auto;">
        <rect width="64" height="64" fill="#fff"/>
        <path d="M4 4h20v20H4V4zm4 4v12h12V8H8zm32-4h20v20H40V4zm4 4v12h12V8H44zM4 40h20v20H4V40zm4 4v12h12V44H8zm20-32h4v8h-4zm8 0h4v4h-4zm-8 12h4v8h-4zm8 4h8v4h-8zm-8 8h4v4h-4zm16-8h4v8h-4zm-4 12h4v4h-4zm-8 4h8v4h-8zm16-4h4v8h-4zm4 4h4v8h-4zm-20 8h4v4h-4zm8 0h8v4h-8zm-8 8h12v4H28zm16-4h4v8h-4zm8-4h4v4h-4zm-4 8h8v4h-8z" fill="#0f172a"/>
      </svg>
    `;

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
            <button type="button" class="btn btn-sm" onclick="document.getElementById('invoiceModal').style.display='none'" style="padding: 6px 10px; font-size: 12px; cursor: pointer;">
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
            <button type="button" onclick="document.getElementById('proofModal').style.display='none'" style="border:none;background:var(--bg);color:var(--text);border-radius:6px;padding:6px 10px;cursor:pointer;font-weight:700;">✕</button>
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

    document.body.innerHTML = `
      <div id="sidebarOverlay" class="sidebar-overlay" aria-hidden="true"></div>
      <div class="wrap">
        <aside class="sidebar">
          <div class="brand">
            <img src="/img/Logo.png" alt="Embun Laundry" class="logo-img" width="36" height="36" />
            <div class="brand-text">Embun Laundry</div>
            <button id="sidebarCloseBtn" class="btn btn-icon sidebar-close-btn" type="button" aria-label="Tutup menu" title="Tutup">
              <span>✕</span>
            </button>
          </div>
          <nav class="nav">
            <a href="#" class="nav-link ${this.currentPage === 'dashboard' ? 'active' : ''}" data-page="dashboard">
              <span>🏠</span> <span>Dashboard</span>
            </a>
            <a href="#" class="nav-link ${this.currentPage === 'pesanan' ? 'active' : ''}" data-page="pesanan">
              <span>🧺</span> <span>${isStaff ? 'Pesanan' : 'Riwayat Pesanan'}</span>
            </a>
            ${isStaff ? `
              <a href="#" class="nav-link ${this.currentPage === 'pelanggan' ? 'active' : ''}" data-page="pelanggan">
                <span>👥</span> <span>Pelanggan</span>
              </a>
            ` : ''}
            <a href="#" class="nav-link ${this.currentPage === 'layanan' ? 'active' : ''}" data-page="layanan">
              <span>💲</span> <span>Layanan & Harga</span>
            </a>
            <a href="#" class="nav-link ${this.currentPage === 'delivery' ? 'active' : ''}" data-page="delivery">
              <span>🚚</span> <span>Pickup & Delivery</span>
            </a>
            <a href="#" class="nav-link ${this.currentPage === 'promo' ? 'active' : ''}" data-page="promo">
              <span>🏷️</span> <span>Promo</span>
            </a>
            ${isStaff ? `
              <a href="#" class="nav-link ${this.currentPage === 'laporan' ? 'active' : ''}" data-page="laporan">
                <span>📑</span> <span>Laporan</span>
              </a>
            ` : ''}
          </nav>
          <div class="side-bottom">
            <a href="#" class="btn nav-link" data-page="profile"><span>👤</span> <span>Profil</span></a>
            <button id="logoutBtn" class="btn" style="width: 100%; text-align: left; background: transparent; border: none; color: inherit; cursor: pointer;">
              <span>🚪</span> <span>Keluar</span>
            </button>
          </div>
        </aside>

        <section class="main">
          <div class="topbar">
            <div class="topbar-inner" style="display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <button id="sidebarToggleBtn" class="btn btn-icon sidebar-toggle-btn" type="button" aria-label="Buka navigasi menu" title="Menu Navigasi">
                  <span>☰</span>
                </button>
                <div class="h1" id="pageTitle" style="font-size: 20px; font-weight: 700; margin: 0;">Dashboard</div>
                <div class="badge" style="margin-left: 8px;">${esc(this.user.role || this.user.user_role)}</div>
              </div>
              <div style="margin-left: auto; display: flex; align-items: center; gap: 12px;">
                <button id="themeToggleBtn" class="theme-toggle-btn" type="button" aria-label="Toggle dark mode" title="Ubah Tema (Gelap / Terang)">
                  <span class="theme-icon" id="themeIcon">${document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙'}</span>
                </button>
                <span style="font-size: 14px; font-weight: 600;">Hai, ${esc(this.user.user_name || this.user.name || 'User')}</span>
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
      if (e.target.id === 'openNewOrderModal') {
        const modal = document.getElementById('orderModal');
        if (modal) modal.style.display = 'grid';
      }
      
      // Close New Order Modal
      if (e.target.id === 'closeOrderModalBtn') {
        const modal = document.getElementById('orderModal');
        if (modal) modal.style.display = 'none';
      }
      
      // Delete Order
      const btnDel = e.target.closest('.btn-del');
      if (btnDel) {
        if (!await this.confirm('Hapus pesanan ini?')) return;
        const id = btnDel.getAttribute('data-id');
        await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete_order', id })
        });
        this.renderPesanan();
      }

      // C7: Promo & Voucher Interactions
      if (e.target.id === 'openNewPromoModal') {
        const form = document.getElementById('promoForm');
        if (form) form.reset();
        const idEl = document.getElementById('promoId');
        if (idEl) idEl.value = '';
        const titleEl = document.getElementById('promoModalTitle');
        if (titleEl) titleEl.textContent = 'Tambah Promo Baru';
        const modal = document.getElementById('promoModal');
        if (modal) modal.style.display = 'grid';
      }

      if (e.target.id === 'closePromoModalBtn') {
        const modal = document.getElementById('promoModal');
        if (modal) modal.style.display = 'none';
      }

      const btnEditPromo = e.target.closest('.btn-edit-promo');
      if (btnEditPromo) {
        try {
          const p = JSON.parse(btnEditPromo.getAttribute('data-promo') || '{}');
          document.getElementById('promoId').value = p.id || '';
          document.getElementById('promoCode').value = p.code || '';
          document.getElementById('promoName').value = p.name || '';
          document.getElementById('promoType').value = p.type || 'percent';
          document.getElementById('promoValue').value = p.value || 0;
          document.getElementById('promoMinSpend').value = p.min_spend || 0;
          document.getElementById('promoMaxDiscount').value = p.max_discount || 0;
          let expVal = '';
          if (p.expires_at) {
            expVal = p.expires_at.slice(0, 16);
          }
          document.getElementById('promoExpiresAt').value = expVal;
          document.getElementById('promoIsActive').checked = p.is_active == 1;
          document.getElementById('promoModalTitle').textContent = 'Edit Promo: ' + (p.code || '');
          const modal = document.getElementById('promoModal');
          if (modal) modal.style.display = 'grid';
        } catch (err) {}
      }

      const btnDelPromo = e.target.closest('.btn-del-promo');
      if (btnDelPromo) {
        if (!await this.confirm('Hapus promo ini?')) return;
        const id = btnDelPromo.getAttribute('data-id');
        const res = await fetch('/api/promos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete_promo', id: parseInt(id) })
        });
        const d = await res.json();
        if (d.ok) {
          this.renderPromo();
        } else {
          this.toast(d.msg || 'Gagal menghapus promo', 'error');
        }
      }

      const btnTogglePromo = e.target.closest('.btn-toggle-promo');
      if (btnTogglePromo) {
        const id = parseInt(btnTogglePromo.getAttribute('data-id'));
        const curActive = parseInt(btnTogglePromo.getAttribute('data-active'));
        const newActive = curActive === 1 ? 0 : 1;
        const res = await fetch('/api/promos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'toggle_promo', id, is_active: newActive })
        });
        const d = await res.json();
        if (d.ok) {
          this.renderPromo();
        } else {
          this.toast(d.msg || 'Gagal mengubah status promo', 'error');
        }
      }

      if (e.target.id === 'openGrantVoucherModal') {
        const modal = document.getElementById('grantVoucherModal');
        if (modal) modal.style.display = 'grid';
      }

      if (e.target.id === 'closeGrantVoucherModalBtn') {
        const modal = document.getElementById('grantVoucherModal');
        if (modal) modal.style.display = 'none';
      }

      const btnDelVoucher = e.target.closest('.btn-del-voucher');
      if (btnDelVoucher) {
        if (!await this.confirm('Hapus/cabut voucher ini?')) return;
        const id = parseInt(btnDelVoucher.getAttribute('data-id'));
        const res = await fetch('/api/vouchers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete_voucher', id })
        });
        const d = await res.json();
        if (d.ok) {
          this.renderPromo();
        } else {
          this.toast(d.msg || 'Gagal mencabut voucher', 'error');
        }
      }

      if (e.target.id === 'tabBtnPromos') {
        document.getElementById('promoPanel')?.style.setProperty('display', 'block');
        document.getElementById('voucherPanel')?.style.setProperty('display', 'none');
        document.getElementById('tabBtnPromos')?.style.setProperty('border-bottom', '2px solid #2563eb');
        document.getElementById('tabBtnPromos')?.style.setProperty('color', '#2563eb');
        document.getElementById('tabBtnVouchers')?.style.setProperty('border-bottom', 'none');
        document.getElementById('tabBtnVouchers')?.style.setProperty('color', '#64748b');
      }

      if (e.target.id === 'tabBtnVouchers') {
        document.getElementById('promoPanel')?.style.setProperty('display', 'none');
        document.getElementById('voucherPanel')?.style.setProperty('display', 'block');
        document.getElementById('tabBtnVouchers')?.style.setProperty('border-bottom', '2px solid #2563eb');
        document.getElementById('tabBtnVouchers')?.style.setProperty('color', '#2563eb');
        document.getElementById('tabBtnPromos')?.style.setProperty('border-bottom', 'none');
        document.getElementById('tabBtnPromos')?.style.setProperty('color', '#64748b');
      }

      if (e.target.id === 'btnSearchPromo') {
        const q = document.getElementById('promoSearchInput')?.value.trim() || '';
        this.renderPromo({ q });
      }

      const btnCopyCode = e.target.closest('.btn-copy-code');
      if (btnCopyCode) {
        const code = btnCopyCode.getAttribute('data-code');
        if (navigator.clipboard) {
          navigator.clipboard.writeText(code).then(() => {
            const originalText = btnCopyCode.textContent;
            btnCopyCode.textContent = '✓ Tersalin!';
            setTimeout(() => { btnCopyCode.textContent = originalText; }, 2000);
          });
        }
      }
    });

    // Global Change Delegation
    document.addEventListener('change', async (e) => {
      if (e.target.classList.contains('status-select')) {
        const id = e.target.getAttribute('data-id');
        await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'move_status', id, status: e.target.value })
        });
      }
    });
    
    // Global Keyup Delegation
    document.addEventListener('keyup', (e) => {
      if (e.target.id === 'ordSearch' && e.key === 'Enter') {
        document.getElementById('btnFilterOrders')?.click();
      }
      if (e.target.id === 'promoSearchInput' && e.key === 'Enter') {
        document.getElementById('btnSearchPromo')?.click();
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
    });

    this.renderPage(this.currentPage);
  },

  renderPage(page) {
    if (page === 'pesanan') this.renderPesanan();
    else if (page === 'pelanggan') this.renderPelanggan();
    else if (page === 'layanan') this.renderLayanan();
    else if (page === 'delivery') this.renderDelivery();
    else if (page === 'promo') this.renderPromo();
    else if (page === 'laporan') this.renderLaporan();
    else if (page === 'profile') this.renderProfile();
    else this.renderDashboard();
    this.initScrollReveal();
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
        <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px;">
          <div class="card" style="padding: 18px; border-radius: var(--radius-md);">
            <div style="font-size: 13px; color: var(--muted); font-weight: 600;">Total Omset</div>
            <div style="font-size: 24px; font-weight: 800; color: var(--text); margin-top: 4px;">Rp ${Number(s.total_revenue).toLocaleString('id-ID')}</div>
          </div>
          <div class="card" style="padding: 18px; border-radius: var(--radius-md);">
            <div style="font-size: 13px; color: var(--muted); font-weight: 600;">Pesanan Aktif</div>
            <div style="font-size: 24px; font-weight: 800; color: var(--blue); margin-top: 4px;">${esc(s.active_orders || 0)}</div>
          </div>
          <div class="card" style="padding: 18px; border-radius: var(--radius-md);">
            <div style="font-size: 13px; color: var(--muted); font-weight: 600;">Selesai Hari Ini</div>
            <div style="font-size: 24px; font-weight: 800; color: var(--green); margin-top: 4px;">${esc(s.finished_today || 0)}</div>
          </div>
          ${isStaff ? `
            <div class="card" style="padding: 18px; border-radius: var(--radius-md);">
              <div style="font-size: 13px; color: var(--muted); font-weight: 600;">Total Pelanggan</div>
              <div style="font-size: 24px; font-weight: 800; color: var(--amber); margin-top: 4px;">${esc(s.total_customers || 0)}</div>
            </div>
          ` : ''}
        </div>

        <div class="card" style="padding: 20px; border-radius: var(--radius-md);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: var(--text);">Pesanan Terbaru</h3>
            <button class="btn btn-primary" id="dashNewOrdBtn" style="padding: 8px 14px; font-size: 13px;">+ Buat Pesanan</button>
          </div>
          <div style="overflow-x: auto;">
            <table class="table" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
              <thead>
                <tr style="border-bottom: 2px solid var(--line); color: var(--muted);">
                  <th style="padding: 10px;">Kode</th>
                  <th style="padding: 10px;">Pelanggan</th>
                  <th style="padding: 10px;">Layanan</th>
                  <th style="padding: 10px;">Berat</th>
                  <th style="padding: 10px;">Total</th>
                  <th style="padding: 10px;">Status</th>
                  <th style="padding: 10px; text-align: right;">Aksi</th>
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
                    <td style="padding: 10px; font-weight: 600;">${esc(o.order_code)}</td>
                    <td style="padding: 10px;">${esc(o.customer_name)}</td>
                    <td style="padding: 10px;">${esc(o.service_name)}</td>
                    <td style="padding: 10px;">${esc(o.weight_kg)} kg</td>
                    <td style="padding: 10px; font-weight: 700;">Rp ${Number(o.total_amount).toLocaleString('id-ID')}</td>
                    <td style="padding: 10px;"><span class="badge status-${esc(o.status)}">${esc(o.status)}</span></td>
                    <td style="padding: 10px; text-align: right; white-space: nowrap;">
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
        <div style="display: flex; gap: 10px; margin-bottom: 20px; align-items: center; flex-wrap: wrap;">
          <input type="date" id="filterStart" value="${esc(start)}" style="padding: 8px 10px; border-radius: 8px; border: 1px solid var(--line); background: var(--card); color: var(--text); font-size: 13px;">
          <span style="color: var(--muted); font-size: 13px;">s/d</span>
          <input type="date" id="filterEnd" value="${esc(end)}" style="padding: 8px 10px; border-radius: 8px; border: 1px solid var(--line); background: var(--card); color: var(--text); font-size: 13px;">
          
          <select id="filterStatus" style="padding: 8px 10px; border-radius: 8px; border: 1px solid var(--line); background: var(--card); color: var(--text); font-size: 13px;">
            <option value="">Semua Status</option>
            <option value="baru" ${status === 'baru' ? 'selected' : ''}>Baru</option>
            <option value="proses" ${status === 'proses' ? 'selected' : ''}>Proses</option>
            <option value="selesai" ${status === 'selesai' ? 'selected' : ''}>Selesai</option>
            <option value="batal" ${status === 'batal' ? 'selected' : ''}>Batal</option>
          </select>

          <input type="text" id="ordSearch" value="${esc(q)}" placeholder="Cari kode/pelanggan..." 
            style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--line); background: var(--card); color: var(--text); flex: 1; min-width: 150px;">
          
          <button class="btn" id="btnFilterOrders" style="padding: 8px 16px; font-size: 13px; background: var(--line); color: var(--text);">Filter</button>
          ${(start || end || q || status) ? `<button class="btn" id="btnResetFilterOrders" style="padding: 8px 16px; font-size: 13px; background: transparent; border: 1px solid var(--line); color: var(--muted);">Reset</button>` : ''}
          
          <button class="btn btn-primary" id="openNewOrderModal" style="${!isStaff ? 'display: none;' : ''}">+ Pesanan Baru</button>
        </div>

        <div class="card" style="padding: 20px; border-radius: var(--radius-md); overflow-x: auto;">
          <table class="table" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
            <thead>
              <tr style="border-bottom: 2px solid var(--line); color: var(--muted);">
                <th style="padding: 10px;">Kode</th>
                <th style="padding: 10px;">Pelanggan</th>
                <th style="padding: 10px;">Layanan</th>
                <th style="padding: 10px;">Berat</th>
                <th style="padding: 10px;">Total</th>
                <th style="padding: 10px;">Status</th>
                <th style="padding: 10px; text-align: right;">Aksi</th>
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
                <tr style="border-bottom: 1px solid var(--line);">
                  <td style="padding: 10px; font-weight: 600;">${esc(o.order_code)}</td>
                  <td style="padding: 10px;">${esc(o.customer_name)}</td>
                  <td style="padding: 10px;">${esc(o.service_name)}</td>
                  <td style="padding: 10px;">${esc(o.weight_kg)} kg</td>
                  <td style="padding: 10px; font-weight: 700;">Rp ${Number(o.total_amount).toLocaleString('id-ID')}</td>
                  <td style="padding: 10px;">
                    ${isStaff ? `
                      <select class="status-select" data-id="${esc(o.id)}" style="padding: 4px 8px; border-radius: 6px; border: 1px solid var(--line); background: var(--card); color: var(--text);">
                        <option value="baru" ${o.status === 'baru' ? 'selected' : ''}>Baru</option>
                        <option value="proses" ${o.status === 'proses' ? 'selected' : ''}>Proses</option>
                        <option value="selesai" ${o.status === 'selesai' ? 'selected' : ''}>Selesai</option>
                        <option value="batal" ${o.status === 'batal' ? 'selected' : ''}>Batal</option>
                      </select>
                    ` : `<span class="badge status-${esc(o.status)}">${esc(o.status)}</span>`}
                  </td>
                  <td style="padding: 10px; text-align: right; white-space: nowrap;">
                    <button type="button" class="btn btn-sm btn-open-invoice" onclick="App.openInvoice('${esc(o.id)}')" style="padding: 4px 8px; font-size: 12px; margin-right: 4px; background: var(--card); border: 1px solid var(--line); color: var(--text); border-radius: 6px; cursor: pointer;">🧾 Invoice</button>
                    <button type="button" class="btn btn-sm btn-view-proof" onclick="App.viewPaymentProof('${esc(o.order_code)}')" style="padding: 4px 8px; font-size: 12px; margin-right: 4px; background: var(--card); border: 1px solid var(--line); color: var(--text); border-radius: 6px; cursor: pointer;">🖼️ Bukti</button>
                    <a href="/pay.html?code=${encodeURIComponent(o.order_code || '')}" class="btn" style="padding: 4px 8px; font-size: 12px; margin-right: 4px; background: var(--card); border: 1px solid var(--line); color: var(--text);">Bayar</a>
                    ${(isStaff || o.status === 'baru') ? `
                      <button class="btn btn-del" data-id="${esc(o.id)}" style="padding: 4px 8px; font-size: 12px; color: var(--red); border: 1px solid var(--red); background: transparent; border-radius: 6px; cursor: pointer;">Hapus</button>
                    ` : ''}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Order Modal -->
        <div id="orderModal" style="display: none; position: fixed; inset: 0; background: var(--color-bg-overlay, rgba(0,0,0,0.5)); place-items: center; z-index: 999; padding: 20px;">
          <div class="card" style="width: 100%; max-width: 500px; background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-lg); padding: 24px; color: var(--text);">
            <h3 style="margin-top: 0; color: var(--text);">Buat Pesanan Laundry</h3>
            <form id="newOrderForm">
              ${isStaff ? `
                <div style="margin-bottom: 12px;">
                  <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: var(--text);">Nama Pelanggan</label>
                  <input type="text" id="ordCustName" required style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--line); background: var(--card); color: var(--text); box-sizing: border-box;">
                </div>
              ` : ''}
              <div style="margin-bottom: 12px;">
                <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: var(--text);">No. HP / WA</label>
                <input type="text" id="ordPhone" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--line); background: var(--card); color: var(--text); box-sizing: border-box;">
              </div>
              <div style="margin-bottom: 12px;">
                <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: var(--text);">Alamat</label>
                <input type="text" id="ordAddress" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--line); background: var(--card); color: var(--text); box-sizing: border-box;">
              </div>
              <div style="margin-bottom: 12px;">
                <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: var(--text);">Pilih Layanan</label>
                <select id="ordService" required style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--line); background: var(--card); color: var(--text); box-sizing: border-box;">
                  ${services.map(s => `<option value="${esc(s.id)}" data-price="${esc(s.price)}">${esc(s.name)} (Rp ${Number(s.price).toLocaleString('id-ID')}/${esc(s.unit || 'kg')})</option>`).join('')}
                </select>
              </div>
              <div style="margin-bottom: 12px;">
                <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: var(--text);">Berat (kg)</label>
                <input type="number" id="ordWeight" min="1" value="1" required style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--line); background: var(--card); color: var(--text); box-sizing: border-box;">
              </div>
              <div style="margin-bottom: 16px;">
                <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: var(--text);">Kode Voucher / Diskon (opsional)</label>
                <input type="text" id="ordVoucher" placeholder="misal: PROMO10" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--line); background: var(--card); color: var(--text); box-sizing: border-box;">
              </div>
              <div style="display: flex; justify-content: flex-end; gap: 8px;">
                <button type="button" class="btn" id="closeOrderModalBtn">Batal</button>
                <button type="submit" class="btn btn-primary">Simpan Pesanan</button>
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
        <div class="card" style="padding: 20px; border-radius: var(--radius-md); overflow-x: auto;">
          <table class="table" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
            <thead>
              <tr style="border-bottom: 2px solid var(--line); color: var(--muted);">
                <th style="padding: 10px;">Kode</th>
                <th style="padding: 10px;">Nama</th>
                <th style="padding: 10px;">No. HP</th>
                <th style="padding: 10px;">Alamat</th>
                <th style="padding: 10px;">Tag</th>
                <th style="padding: 10px;">Pesanan</th>
                <th style="padding: 10px;">Total Belanja</th>
              </tr>
            </thead>
            <tbody>
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
              ` : customers.map(cust => `
                <tr style="border-bottom: 1px solid var(--line);">
                  <td style="padding: 10px; font-weight: 600;">${esc(cust.code)}</td>
                  <td style="padding: 10px;">${esc(cust.full_name)}</td>
                  <td style="padding: 10px;">${esc(cust.phone || '-')}</td>
                  <td style="padding: 10px;">${esc(cust.address || '-')}</td>
                  <td style="padding: 10px;"><span class="badge">${esc(cust.computed_tag || cust.tag)}</span></td>
                  <td style="padding: 10px;">${esc(cust.orders_count || 0)}</td>
                  <td style="padding: 10px; font-weight: 700; color: var(--text);">Rp ${Number(cust.total_spent || 0).toLocaleString('id-ID')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
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

      if (services.length === 0) {
        c.innerHTML = this.renderEmptyState({
          icon: '💲',
          title: 'Belum Ada Layanan',
          subtitle: 'Daftar paket layanan laundry belum dikonfigurasi.'
        });
        return;
      }

      c.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px;">
          ${services.map(s => `
            <div class="card" style="padding: 20px; border-radius: var(--radius-md);">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <h4 style="margin: 0 0 8px; font-size: 16px; color: var(--text);">${esc(s.name)}</h4>
                <span class="badge ${s.is_active ? 'status-selesai' : 'status-batal'}">${s.is_active ? 'Aktif' : 'Nonaktif'}</span>
              </div>
              <div style="font-size: 20px; font-weight: 800; color: var(--blue); margin-bottom: 8px;">
                Rp ${Number(s.price).toLocaleString('id-ID')} <span style="font-size: 13px; color: var(--muted); font-weight: 500;">/ ${esc(s.unit || 'kg')}</span>
              </div>
              <p style="font-size: 13px; color: var(--muted); margin: 0 0 12px;">Durasi estimasi: ${esc(s.duration_hours || 24)} Jam</p>
              <button class="btn btn-primary" style="width: 100%; padding: 8px; font-size: 13px;" onclick="App.renderPesanan()">Pesan Sekarang</button>
            </div>
          `).join('')}
        </div>
      `;
    } catch (e) {
      c.innerHTML = '<div class="err">Kesalahan memuat layanan</div>';
    }
  },

  async renderDelivery() {
    document.getElementById('pageTitle').textContent = 'Pickup & Antar Jemput';
    const c = document.getElementById('mainContent');
    c.innerHTML = this.renderSkeletonTable({ columns: 7, rows: 5, hasActions: false });

    try {
      const res = await fetch('/api/delivery');
      const data = await res.json();
      const tasks = data.tasks || [];

      c.innerHTML = `
        <div class="card" style="padding: 20px; border-radius: var(--radius-md); overflow-x: auto;">
          <table class="table" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
            <thead>
              <tr style="border-bottom: 2px solid var(--line); color: var(--muted);">
                <th style="padding: 10px;">Kode Tugas</th>
                <th style="padding: 10px;">Tipe</th>
                <th style="padding: 10px;">Pelanggan</th>
                <th style="padding: 10px;">Alamat</th>
                <th style="padding: 10px;">Kurir</th>
                <th style="padding: 10px;">Jadwal</th>
                <th style="padding: 10px;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${tasks.length === 0 ? `
                <tr>
                  <td colspan="7" style="padding: 0; border: none;">
                    ${this.renderEmptyState({
                      icon: '🚚',
                      title: 'Belum Ada Tugas Kurir',
                      subtitle: 'Tidak ada jadwal penjemputan atau pengantaran laundry saat ini.'
                    })}
                  </td>
                </tr>
              ` : tasks.map(t => `
                <tr style="border-bottom: 1px solid var(--line);">
                  <td style="padding: 10px; font-weight: 600;">${esc(t.task_code)}</td>
                  <td style="padding: 10px;"><span class="badge">${esc(String(t.type || '').toUpperCase())}</span></td>
                  <td style="padding: 10px;">${esc(t.customer_name)}</td>
                  <td style="padding: 10px;">${esc(t.address || '-')}</td>
                  <td style="padding: 10px;">${esc(t.courier_name || 'Belum ditugaskan')}</td>
                  <td style="padding: 10px;">${esc(t.schedule_date)}</td>
                  <td style="padding: 10px;"><span class="badge status-${esc(t.status)}">${esc(t.status)}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
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

          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <h3 style="margin:0;color:var(--text);">Daftar Promo</h3>
            <button class="btn btn-primary" onclick="App.openPromoForm()" style="padding:8px 16px;">+ Tambah Promo</button>
          </div>
          <div class="card" style="padding:20px;border-radius:var(--radius-md);overflow-x:auto;margin-bottom:24px;">
            <table class="table" style="width:100%;border-collapse:collapse;text-align:left;font-size:14px;">
              <thead>
                <tr style="border-bottom:2px solid var(--line);color:var(--muted);">
                  <th style="padding:10px;">Kode</th>
                  <th style="padding:10px;">Nama</th>
                  <th style="padding:10px;">Tipe</th>
                  <th style="padding:10px;">Nilai</th>
                  <th style="padding:10px;">Min. Belanja</th>
                  <th style="padding:10px;">Kedaluwarsa</th>
                  <th style="padding:10px;">Status</th>
                  <th style="padding:10px;">Aksi</th>
                </tr>
              </thead>
              <tbody>
                ${promos.length === 0
                  ? '<tr><td colspan="8" style="padding:20px;text-align:center;color:var(--muted);">Belum ada promo</td></tr>'
                  : promos.map(p => `
                  <tr style="border-bottom:1px solid var(--line);">
                    <td style="padding:10px;font-weight:700;color:var(--blue);">${esc(p.code)}</td>
                    <td style="padding:10px;">${esc(p.name)}</td>
                    <td style="padding:10px;">${p.type === 'percent' ? 'Persen' : 'Nominal'}</td>
                    <td style="padding:10px;">${p.type === 'percent' ? esc(p.value) + '%' : 'Rp ' + Number(p.value).toLocaleString('id-ID')}</td>
                    <td style="padding:10px;">Rp ${Number(p.min_spend || 0).toLocaleString('id-ID')}</td>
                    <td style="padding:10px;">${p.expires_at ? esc(String(p.expires_at).slice(0, 10)) : '—'}</td>
                    <td style="padding:10px;"><span class="badge ${p.is_active ? 'status-selesai' : 'status-batal'}">${p.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
                    <td style="padding:10px;">
                      <div style="display:flex;gap:6px;flex-wrap:wrap;">
                        <button class="btn" style="padding:4px 10px;font-size:12px;" onclick="App.openPromoForm(${p.id})" aria-label="Edit promo ${esc(p.code)}">Edit</button>
                        <button class="btn" style="padding:4px 10px;font-size:12px;" onclick="App.togglePromo(${p.id},${p.is_active ? 0 : 1})" aria-label="${p.is_active ? 'Nonaktifkan' : 'Aktifkan'} promo ${esc(p.code)}">${p.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button>
                        <button class="btn" style="padding:4px 10px;font-size:12px;background:var(--red-soft);color:var(--red);" onclick="App.deletePromo(${p.id})" aria-label="Hapus promo ${esc(p.code)}">Hapus</button>
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

          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <h3 style="margin:0;color:var(--text);">Semua Voucher Pengguna</h3>
            <button class="btn btn-primary" onclick="App.openGrantVoucherForm()">🎁 Terbitkan Voucher</button>
          </div>
          <div class="card" style="padding:20px;border-radius:var(--radius-md);overflow-x:auto;">
            <table class="table" style="width:100%;border-collapse:collapse;text-align:left;font-size:14px;">
              <thead>
                <tr style="border-bottom:2px solid var(--line);color:var(--muted);">
                  <th style="padding:10px;">Kode Voucher</th>
                  <th style="padding:10px;">Nama Promo</th>
                  <th style="padding:10px;">Nilai</th>
                  <th style="padding:10px;">Penerima / User</th>
                  <th style="padding:10px;">Status</th>
                  <th style="padding:10px;text-align:right;">Aksi</th>
                </tr>
              </thead>
              <tbody>
                ${vouchers.length === 0
                  ? '<tr><td colspan="6" style="padding:20px;text-align:center;color:var(--muted);">Belum ada voucher diterbitkan</td></tr>'
                  : vouchers.map(v => `
                  <tr style="border-bottom:1px solid var(--line);">
                    <td style="padding:10px;font-weight:700;color:var(--blue);font-family:monospace;">${esc(v.code)}</td>
                    <td style="padding:10px;">${esc(v.promo_name || v.name)}</td>
                    <td style="padding:10px;font-weight:600;color:var(--green);">${v.type === 'percent' ? esc(v.value) + '%' : 'Rp ' + Number(v.value).toLocaleString('id-ID')}</td>
                    <td style="padding:10px;">
                      <div style="font-weight:600;">${esc(v.user_name || 'User #' + v.user_id)}</div>
                      <div style="font-size:11px;color:var(--muted);">${esc(v.user_email || 'ID: ' + v.user_id)}</div>
                    </td>
                    <td style="padding:10px;"><span class="badge ${v.used_at ? 'status-batal' : 'status-selesai'}">${v.used_at ? 'Sudah Dipakai' : 'Siap Pakai'}</span></td>
                    <td style="padding:10px;text-align:right;">
                      <button class="btn" style="padding:4px 10px;font-size:12px;background:var(--red-soft);color:var(--red);border:1px solid var(--red-border);border-radius:4px;cursor:pointer;" onclick="App.deleteVoucher(${v.id})" aria-label="Cabut voucher ${esc(v.code)}">Cabut</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      } else {
        c.innerHTML = `
          <h3 style="margin:0 0 16px;color:var(--text);">Voucher Tersedia</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-bottom:28px;">
            ${promos.filter(p => p.is_active).length === 0
              ? '<div style="color:var(--muted);padding:20px;">Belum ada promo aktif saat ini.</div>'
              : promos.filter(p => p.is_active).map(p => `
                <div class="card" style="padding:20px;border-radius:var(--radius-md);display:flex;flex-direction:column;justify-content:space-between;">
                  <div>
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                      <span class="badge" style="background:var(--blue-soft);color:var(--blue);font-weight:700;font-family:monospace;">${esc(p.code || 'PROMO')}</span>
                      <span style="font-size:11px;color:var(--muted);">${p.expires_at ? 'Hingga ' + esc(String(p.expires_at).slice(0, 10)) : 'Aktif'}</span>
                    </div>
                    <h4 style="margin:0 0 6px;font-size:16px;color:var(--text);">${esc(p.name)}</h4>
                    <div style="font-size:18px;font-weight:800;color:var(--green);margin-bottom:8px;">
                      ${p.type === 'percent' ? 'Diskon ' + esc(p.value) + '%' : 'Potongan Rp ' + Number(p.value).toLocaleString('id-ID')}
                    </div>
                    <div style="font-size:12px;color:var(--muted);margin:0 0 12px;">
                      <div>Min. belanja: Rp ${Number(p.min_spend || 0).toLocaleString('id-ID')}</div>
                      ${p.max_discount > 0 ? `<div>Maks. diskon: Rp ${Number(p.max_discount).toLocaleString('id-ID')}</div>` : ''}
                    </div>
                  </div>
                  <button class="btn btn-copy" style="width:100%;padding:8px;font-size:13px;border:1px dashed var(--blue);background:var(--blue-soft);color:var(--blue);border-radius:6px;cursor:pointer;" onclick="navigator.clipboard.writeText('${esc(p.code)}'); this.textContent='✓ Tersalin!'; setTimeout(() => this.textContent='📋 Salin Kode Promo', 2000);">📋 Salin Kode Promo</button>
                </div>
              `).join('')}
          </div>

          <h3 style="margin:0 0 16px;color:var(--text);">Voucher Saya</h3>
          <div class="card" style="padding:20px;border-radius:var(--radius-md);overflow-x:auto;">
            <table class="table" style="width:100%;border-collapse:collapse;text-align:left;font-size:14px;">
              <thead>
                <tr style="border-bottom:2px solid var(--line);color:var(--muted);">
                  <th style="padding:10px;">Kode Voucher</th>
                  <th style="padding:10px;">Nama Promo</th>
                  <th style="padding:10px;">Nilai</th>
                  <th style="padding:10px;">Status</th>
                  <th style="padding:10px;text-align:right;">Aksi</th>
                </tr>
              </thead>
              <tbody>
                ${vouchers.length === 0
                  ? '<tr><td colspan="5" style="padding:20px;text-align:center;color:var(--muted);">Belum ada voucher</td></tr>'
                  : vouchers.map(v => `
                  <tr style="border-bottom:1px solid var(--line);">
                    <td style="padding:10px;font-weight:700;color:var(--blue);font-family:monospace;">${esc(v.code)}</td>
                    <td style="padding:10px;">${esc(v.name)}</td>
                    <td style="padding:10px;font-weight:600;color:var(--green);">${v.type === 'percent' ? esc(v.value) + '%' : 'Rp ' + Number(v.value).toLocaleString('id-ID')}</td>
                    <td style="padding:10px;">
                      <span class="badge ${v.used_at ? 'status-batal' : 'status-selesai'}">${v.used_at ? 'Sudah Dipakai' : 'Siap Pakai'}</span>
                    </td>
                    <td style="padding:10px;text-align:right;">
                      ${!v.used_at ? `
                        <button class="btn" style="padding:4px 8px;font-size:12px;background:var(--blue-soft);color:var(--blue);border:1px solid var(--blue-border);border-radius:4px;cursor:pointer;" onclick="navigator.clipboard.writeText('${esc(v.code)}'); this.textContent='✓ Salin'; setTimeout(() => this.textContent='Salin', 2000);">Salin</button>
                      ` : '-'}
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
    if (!await this.confirm('Cabut voucher ini dari pelanggan?')) return;
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
    const padL = 75;
    const padR = 25;
    const padT = 25;
    const padB = 45;
    const plotW = svgWidth - padL - padR;
    const plotH = svgHeight - padT - padB;

    const n = chartRows.length;
    const colW = plotW / n;
    const barW = Math.max(8, Math.min(44, colW * 0.65));

    const gridLines = [];
    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
      const val = Math.round((niceMax / ticks) * i);
      const y = padT + plotH - (val / niceMax) * plotH;
      let label = val >= 1000000 ? `${(val / 1000000).toFixed(1)}jt` : (val >= 1000 ? `${Math.round(val / 1000)}rb` : String(val));
      gridLines.push(`
        <line x1="${padL}" y1="${y}" x2="${padL + plotW}" y2="${y}" stroke="var(--line)" stroke-width="1" stroke-dasharray="${i === 0 ? '0' : '4'}"/>
        <text x="${padL - 10}" y="${y + 4}" text-anchor="end" font-size="10" fill="var(--muted)" font-family="system-ui, sans-serif">Rp ${label}</text>
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
          ${paid > 0 ? `<rect x="${bx}" y="${byPaid}" width="${barW}" height="${paidH}" fill="var(--blue)" rx="2" class="bar-paid" style="transition: opacity 0.2s;"/>` : ''}
          ${unpaid > 0 ? `<rect x="${bx}" y="${byUnpaid}" width="${barW}" height="${unpaidH}" fill="var(--amber)" rx="2" class="bar-unpaid" style="transition: opacity 0.2s;"/>` : ''}
          <text x="${cx}" y="${padT + plotH + 20}" text-anchor="middle" font-size="11" fill="var(--muted)" font-weight="500">${esc(shortLabel)}</text>
          <rect x="${padL + i * colW}" y="${padT}" width="${colW}" height="${plotH + 30}" fill="transparent" class="bar-hover-hit"/>
        </g>
      `);
    });

    return `
      <div style="position: relative; width: 100%; overflow-x: auto;">
        <svg viewBox="0 0 ${svgWidth} ${svgHeight}" style="width: 100%; min-width: 600px; height: 280px; display: block;" preserveAspectRatio="xMidYMid meet" id="reportSvgChart">
          ${gridLines.join('')}
          ${bars.join('')}
        </svg>
        <div id="chartTooltip" style="position: absolute; display: none; pointer-events: none; z-index: 20; background: var(--color-bg-inverse, #0f172a); color: var(--color-text-on-inverse, #ffffff); padding: 8px 12px; border-radius: 8px; font-size: 12px; box-shadow: var(--shadow-card); transform: translate(-50%, -100%); margin-top: -8px;"></div>
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
        <div class="card" style="padding: 16px 20px; border-radius: var(--radius-md); margin-bottom: 20px;">
          <div style="display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-end; justify-content: space-between;">
            <div style="display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end;">
              <div>
                <label style="display: block; font-size: 12px; font-weight: 700; color: var(--muted); margin-bottom: 4px;">Kelompokkan</label>
                <select id="reportGroup" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--line); font-size: 13px; font-weight: 500; background: var(--card); color: var(--text);">
                  <option value="bulan" ${filter.group === 'bulan' ? 'selected' : ''}>Bulanan</option>
                  <option value="minggu" ${filter.group === 'minggu' ? 'selected' : ''}>Mingguan</option>
                  <option value="hari" ${filter.group === 'hari' ? 'selected' : ''}>Harian</option>
                </select>
              </div>

              <div>
                <label style="display: block; font-size: 12px; font-weight: 700; color: var(--muted); margin-bottom: 4px;">Dari Tanggal</label>
                <input type="date" id="reportStart" value="${esc(filter.start || '')}" style="padding: 7px 10px; border-radius: 8px; border: 1px solid var(--line); font-size: 13px; background: var(--card); color: var(--text);">
              </div>

              <div>
                <label style="display: block; font-size: 12px; font-weight: 700; color: var(--muted); margin-bottom: 4px;">Sampai Tanggal</label>
                <input type="date" id="reportEnd" value="${esc(filter.end || '')}" style="padding: 7px 10px; border-radius: 8px; border: 1px solid var(--line); font-size: 13px; background: var(--card); color: var(--text);">
              </div>

              <button type="button" class="btn btn-primary" onclick="App.applyReportFilter()" style="padding: 8px 16px; font-size: 13px; font-weight: 600;">
                🔍 Terapkan Filter
              </button>
            </div>

            <div style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center;">
              <button type="button" class="btn btn-sm" onclick="App.setReportPreset('month')" style="padding: 5px 10px; font-size: 12px;">Bulan Ini</button>
              <button type="button" class="btn btn-sm" onclick="App.setReportPreset('30days')" style="padding: 5px 10px; font-size: 12px;">30 Hari</button>
              <button type="button" class="btn btn-sm" onclick="App.setReportPreset('year')" style="padding: 5px 10px; font-size: 12px;">Tahun Ini</button>
              <button type="button" class="btn btn-sm" onclick="App.setReportPreset('all')" style="padding: 5px 10px; font-size: 12px;">Semua</button>
              <button type="button" class="btn btn-sm" onclick="window.print()" style="padding: 5px 10px; font-size: 12px; background: var(--color-bg-inverse, #0f172a); color: var(--color-text-on-inverse, #ffffff);">🖨️ Cetak</button>
            </div>
          </div>
        </div>

        <!-- EXECUTIVE KPI CARDS -->
        <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 24px;">
          <div class="card" style="padding: 16px 18px; border-radius: var(--radius-md);">
            <div style="font-size: 12px; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Total Omset</div>
            <div style="font-size: 22px; font-weight: 800; color: var(--text); margin-top: 4px;">Rp ${Number(kpi.rev || 0).toLocaleString('id-ID')}</div>
            <div style="font-size: 11px; color: var(--muted); margin-top: 2px;">Seluruh pendapatan kotor</div>
          </div>
          <div class="card" style="padding: 16px 18px; border-radius: var(--radius-md); border-left: 4px solid var(--blue);">
            <div style="font-size: 12px; color: var(--blue); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Kas Terbayar</div>
            <div style="font-size: 22px; font-weight: 800; color: var(--blue); margin-top: 4px;">Rp ${Number(totalPaid || kpi.rev || 0).toLocaleString('id-ID')}</div>
            <div style="font-size: 11px; color: var(--muted); margin-top: 2px;">Pembayaran lunas diterima</div>
          </div>
          <div class="card" style="padding: 16px 18px; border-radius: var(--radius-md); border-left: 4px solid var(--amber);">
            <div style="font-size: 12px; color: var(--amber); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Piutang / Belum Lunas</div>
            <div style="font-size: 22px; font-weight: 800; color: var(--amber); margin-top: 4px;">Rp ${Number(totalUnpaid).toLocaleString('id-ID')}</div>
            <div style="font-size: 11px; color: var(--muted); margin-top: 2px;">Sisa tagihan pelanggan</div>
          </div>
          <div class="card" style="padding: 16px 18px; border-radius: var(--radius-md);">
            <div style="font-size: 12px; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Total Order & Bobot</div>
            <div style="font-size: 22px; font-weight: 800; color: var(--text); margin-top: 4px;">${kpi.ord || 0} <span style="font-size: 14px; font-weight: 600; color: var(--muted);">order</span></div>
            <div style="font-size: 11px; color: var(--green); font-weight: 600; margin-top: 2px;">Rata-rata: ${kpi.avg_wt || 0} kg/order</div>
          </div>
        </div>

        <!-- INTERACTIVE CHART -->
        <div class="card" style="padding: 20px; border-radius: var(--radius-md); margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div>
              <h4 style="margin: 0; font-size: 16px; font-weight: 700; color: var(--text);">Grafik Perkembangan Pendapatan</h4>
              <div style="font-size: 12px; color: var(--muted); margin-top: 2px;">Visualisasi omset terbayar vs piutang berdasarkan periode terpilih</div>
            </div>
            <div style="display: flex; align-items: center; gap: 14px; font-size: 12px; font-weight: 600;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="width: 12px; height: 12px; background: var(--blue); border-radius: 2px; display: inline-block;"></span>
                <span style="color: var(--text);">Terbayar</span>
              </div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="width: 12px; height: 12px; background: var(--amber); border-radius: 2px; display: inline-block;"></span>
                <span style="color: var(--text);">Piutang</span>
              </div>
            </div>
          </div>

          <div id="chartContainer">
            ${this.buildSvgChart(chartRows)}
          </div>
        </div>

        <!-- DAILY BREAKDOWN TABLE -->
        <div class="card" style="padding: 20px; border-radius: var(--radius-md); overflow-x: auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div>
              <h4 style="margin: 0; font-size: 16px; font-weight: 700; color: var(--text);">Rincian Harian Transaksi</h4>
              <div style="font-size: 12px; color: var(--muted); margin-top: 2px;">Daftar rekapan pesanan per hari dalam rentang periode</div>
            </div>
            <div style="font-size: 13px; color: var(--muted); font-weight: 600;">
              Total: ${daily.length} hari
            </div>
          </div>

          <table class="table" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
            <thead>
              <tr style="border-bottom: 2px solid var(--line); color: var(--muted); font-size: 13px;">
                <th style="padding: 10px 12px;">Tanggal</th>
                <th style="padding: 10px 12px;">Jumlah Order</th>
                <th style="padding: 10px 12px;">Total Berat</th>
                <th style="padding: 10px 12px;">Total Pendapatan</th>
              </tr>
            </thead>
            <tbody>
              ${daily.length === 0 ? `
                <tr>
                  <td colspan="4" style="padding: 24px; text-align: center; color: var(--muted);">Tidak ada data harian pada rentang ini.</td>
                </tr>
              ` : daily.map(d => `
                <tr style="border-bottom: 1px solid var(--line);">
                  <td style="padding: 10px 12px; font-weight: 600; color: var(--text);">${esc(d.d)}</td>
                  <td style="padding: 10px 12px; color: var(--blue); font-weight: 600;">${esc(d.orders)} order</td>
                  <td style="padding: 10px 12px; color: var(--green); font-weight: 600;">${esc(d.weight)} kg</td>
                  <td style="padding: 10px 12px; font-weight: 700; color: var(--text);">Rp ${Number(d.revenue).toLocaleString('id-ID')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

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
              <div style="font-weight: 700; border-bottom: 1px solid #334155; padding-bottom: 4px; margin-bottom: 4px;">Periode: ${esc(period)}</div>
              <div style="color: #60a5fa;">Terbayar: Rp ${paid.toLocaleString('id-ID')}</div>
              <div style="color: #fbbf24;">Piutang: Rp ${unpaid.toLocaleString('id-ID')}</div>
              <div style="font-weight: 700; margin-top: 4px; border-top: 1px solid #334155; padding-top: 4px;">Total: Rp ${total.toLocaleString('id-ID')}</div>
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
      <div style="max-width: 600px; margin: 0 auto; display: grid; gap: 20px;" aria-busy="true" aria-label="Memuat profil...">
        <div class="skeleton-card">
          <div class="skeleton skeleton-title" style="width: 40%; height: 20px; margin-bottom: 20px;"></div>
          <div class="skeleton skeleton-text" style="width: 30%; height: 12px; margin-bottom: 6px;"></div>
          <div class="skeleton skeleton-btn" style="width: 100%; height: 38px; margin-bottom: 16px;"></div>
          <div class="skeleton skeleton-text" style="width: 25%; height: 12px; margin-bottom: 6px;"></div>
          <div class="skeleton skeleton-btn" style="width: 100%; height: 38px; margin-bottom: 16px;"></div>
          <div class="skeleton skeleton-text" style="width: 20%; height: 12px; margin-bottom: 6px;"></div>
          <div class="skeleton skeleton-btn" style="width: 100%; height: 38px; margin-bottom: 20px;"></div>
          <div class="skeleton skeleton-btn" style="width: 120px; height: 38px;"></div>
        </div>
      </div>
    `;

    try {
      const res = await fetch('/api/profile');
      const data = await res.json();
      const u = data.user || this.user;

      c.innerHTML = `
        <div style="max-width: 600px; margin: 0 auto; display: grid; gap: 20px;">
          <div class="card" style="padding: 24px; border-radius: var(--radius-md);">
            <h3 style="margin-top: 0; font-size: 16px; color: var(--text);">Informasi Pribadi</h3>
            <form id="profileForm">
              <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: var(--text);">Nama Lengkap</label>
                <input type="text" id="profName" value="${esc(u.full_name || u.name || '')}" required 
                  style="width: 100%; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--line); background: var(--card); color: var(--text); box-sizing: border-box;">
              </div>
              <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: var(--text);">Email</label>
                <input type="email" value="${esc(u.email || '')}" disabled  
                  style="width: 100%; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--line); background: var(--bg); color: var(--muted); box-sizing: border-box;">
              </div>
              <div style="margin-bottom: 18px;">
                <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: var(--text);">No. HP</label>
                <input type="text" id="profPhone" value="${esc(u.phone || '')}" 
                  style="width: 100%; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--line); background: var(--card); color: var(--text); box-sizing: border-box;">
              </div>
              <button type="submit" class="btn btn-primary">Simpan Profil</button>
            </form>
          </div>

          <div class="card" style="padding: 24px; border-radius: var(--radius-md);">
            <h3 style="margin-top: 0; font-size: 16px; color: var(--text);">Ganti Sandi</h3>
            <form id="passForm">
              <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: var(--text);">Sandi Lama</label>
                <input type="password" id="oldPass" required 
                  style="width: 100%; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--line); background: var(--card); color: var(--text); box-sizing: border-box;">
              </div>
              <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: var(--text);">Sandi Baru</label>
                <input type="password" id="newPass" required 
                  style="width: 100%; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--line); background: var(--card); color: var(--text); box-sizing: border-box;">
              </div>
              <div style="margin-bottom: 18px;">
                <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: var(--text);">Konfirmasi Sandi Baru</label>
                <input type="password" id="repPass" required 
                  style="width: 100%; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--line); background: var(--card); color: var(--text); box-sizing: border-box;">
              </div>
              <button type="submit" class="btn btn-primary">Ganti Sandi</button>
            </form>
          </div>
        </div>
      `;

      // Update profile and pass forms handled by global submit delegation

    } catch (e) {
      c.innerHTML = '<div class="err">Kesalahan memuat profil</div>';
    }
  }
};

// Attach app.js to window unconditionally
if (typeof window !== 'undefined') window.App = App;
window.onload = () => App.init();
