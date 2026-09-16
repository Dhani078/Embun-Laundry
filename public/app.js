// public/app.js - Embun Laundry Single Page App
const App = window.App = {
  user: null,
  currentPage: 'dashboard',

  async init() {
    this.checkAuth();
    this.bindEvents();
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
      <div class="auth-wrap" style="min-height: 100vh; display: grid; place-items: center; background: #0f172a; padding: 20px;">
        <div class="card" style="width: 100%; max-width: 400px; background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 28px; color: #fff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <img src="/img/Logo.png" alt="Logo" style="width: 56px; height: 56px; border-radius: 12px; margin-bottom: 12px;">
            <h2 style="margin: 0; font-size: 20px; font-weight: 700;">Masuk Embun Laundry</h2>
            <p style="margin: 4px 0 0; color: #94a3b8; font-size: 13px;">Kelola laundry dengan cepat & mudah</p>
          </div>
          <form id="loginForm">
            <div style="margin-bottom: 16px;">
              <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: #cbd5e1;">Email / Username / No. HP</label>
              <input type="text" id="loginId" required placeholder="misal: admin atau user@gmail.com" 
                style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #fff; box-sizing: border-box;">
            </div>
            <div style="margin-bottom: 20px;">
              <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: #cbd5e1;">Kata Sandi</label>
              <input type="password" id="loginPass" required placeholder="••••••••" 
                style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #fff; box-sizing: border-box;">
            </div>
            <div id="loginErr" style="display: none; color: #f87171; font-size: 13px; margin-bottom: 14px;"></div>
            <button type="submit" class="btn btn-primary" style="width: 100%; padding: 12px; background: #2563eb; color: #fff; border: none; border-radius: 8px; font-weight: 700; cursor: pointer;">
              Masuk Sekarang
            </button>
          </form>
          <div style="margin-top: 20px; text-align: center; font-size: 13px; color: #94a3b8;">
            Belum punya akun? <a href="#" id="toRegBtn" style="color: #38bdf8; text-decoration: none; font-weight: 600;">Daftar Pelanggan</a>
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
      <div class="auth-wrap" style="min-height: 100vh; display: grid; place-items: center; background: #0f172a; padding: 20px;">
        <div class="card" style="width: 100%; max-width: 440px; background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 28px; color: #fff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <img src="/img/Logo.png" alt="Logo" style="width: 56px; height: 56px; border-radius: 12px; margin-bottom: 12px;">
            <h2 style="margin: 0; font-size: 20px; font-weight: 700;">Buat Akun Pelanggan</h2>
            <p style="margin: 4px 0 0; color: #94a3b8; font-size: 13px;">Daftar untuk mulai order & dapatkan promo</p>
          </div>
          <form id="regForm">
            <div style="margin-bottom: 14px;">
              <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: #cbd5e1;">Nama Lengkap</label>
              <input type="text" id="regName" required placeholder="Nama Anda" 
                style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #fff; box-sizing: border-box;">
            </div>
            <div style="margin-bottom: 14px;">
              <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: #cbd5e1;">Email</label>
              <input type="email" id="regEmail" required placeholder="nama@email.com" 
                style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #fff; box-sizing: border-box;">
            </div>
            <div style="margin-bottom: 14px;">
              <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: #cbd5e1;">No. Handphone / WhatsApp</label>
              <input type="tel" id="regPhone" placeholder="08xxxxxxxxxx" 
                style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #fff; box-sizing: border-box;">
            </div>
            <div style="margin-bottom: 14px;">
              <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: #cbd5e1;">Kata Sandi</label>
              <input type="password" id="regPass" required placeholder="Minimal 6 karakter" 
                style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #fff; box-sizing: border-box;">
            </div>
            <div style="margin-bottom: 16px;">
              <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: #cbd5e1;">Konfirmasi Kata Sandi</label>
              <input type="password" id="regPass2" required placeholder="Ulangi kata sandi" 
                style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #fff; box-sizing: border-box;">
            </div>
            <div id="regErr" style="display: none; color: #f87171; font-size: 13px; margin-bottom: 14px;"></div>
            <button type="submit" class="btn btn-primary" style="width: 100%; padding: 12px; background: #2563eb; color: #fff; border: none; border-radius: 8px; font-weight: 700; cursor: pointer;">
              Daftar Sekarang
            </button>
          </form>
          <div style="margin-top: 20px; text-align: center; font-size: 13px; color: #94a3b8;">
            Sudah punya akun? <a href="#" id="toLogBtn" style="color: #38bdf8; text-decoration: none; font-weight: 600;">Masuk di sini</a>
          </div>
        </div>
      </div>
    `;

    // Event listeners are bound once in document.addEventListener
  },

  renderApp() {
    const isStaff = ['Admin', 'Owner', 'Staff'].includes(this.user.role || this.user.user_role);

    document.body.innerHTML = `
      <div class="wrap">
        <aside class="sidebar">
          <div class="brand">
            <img src="/img/Logo.png" alt="Embun Laundry" class="logo-img" width="36" height="36" />
            <div class="brand-text">Embun Laundry</div>
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
              <div style="display: flex; align-items: center;">
                <div class="h1" id="pageTitle" style="font-size: 20px; font-weight: 700; margin: 0;">Dashboard</div>
                <div class="badge" style="margin-left: 8px;">${esc(this.user.role || this.user.user_role)}</div>
              </div>
              <div style="margin-left: auto; display: flex; align-items: center; gap: 12px;">
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
        if (!confirm('Hapus pesanan ini?')) return;
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
        if (!confirm('Hapus promo ini?')) return;
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
          alert(d.msg || 'Gagal menghapus promo');
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
          alert(d.msg || 'Gagal mengubah status promo');
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
        if (!confirm('Hapus/cabut voucher ini?')) return;
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
          alert(d.msg || 'Gagal mencabut voucher');
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
          alert(data.msg || 'Gagal membuat pesanan');
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
          alert('Profil diperbarui');
          this.renderApp();
        } else {
          alert(resData.msg || 'Gagal update profil');
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
          alert('Sandi berhasil diganti');
          document.getElementById('passForm').reset();
        } else {
          alert(resData.msg || 'Gagal ganti sandi');
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
          alert(data.msg || 'Gagal menyimpan promo');
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
            alert('Masukkan minimal satu User ID valid');
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
          alert(grantType === 'single' ? 'Voucher berhasil diterbitkan!' : `Berhasil menerbitkan ${data.created || 0} voucher!`);
          this.renderPromo();
        } else {
          alert(data.msg || 'Gagal menerbitkan voucher');
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
  },

  // PAGE RENDERERS
  async renderDashboard() {
    document.getElementById('pageTitle').textContent = 'Dashboard';
    const c = document.getElementById('mainContent');
    c.innerHTML = '<div style="padding: 20px;">Memuat data dashboard...</div>';

    try {
      const res = await fetch('/api/dashboard');
      const data = await res.json();
      if (!data.ok) return c.innerHTML = '<div class="err">Gagal memuat dashboard</div>';

      const s = data.stats;
      const isStaff = ['Admin', 'Owner', 'Staff'].includes(this.user.role || this.user.user_role);

      c.innerHTML = `
        <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px;">
          <div class="card" style="padding: 18px; border-radius: 12px; background: #fff; border: 1px solid #e2e8f0;">
            <div style="font-size: 13px; color: #64748b; font-weight: 600;">Total Omset</div>
            <div style="font-size: 24px; font-weight: 800; color: #0f172a; margin-top: 4px;">Rp ${Number(s.total_revenue).toLocaleString('id-ID')}</div>
          </div>
          <div class="card" style="padding: 18px; border-radius: 12px; background: #fff; border: 1px solid #e2e8f0;">
            <div style="font-size: 13px; color: #64748b; font-weight: 600;">Pesanan Aktif</div>
            <div style="font-size: 24px; font-weight: 800; color: #2563eb; margin-top: 4px;">${esc(s.active_orders || 0)}</div>
          </div>
          <div class="card" style="padding: 18px; border-radius: 12px; background: #fff; border: 1px solid #e2e8f0;">
            <div style="font-size: 13px; color: #64748b; font-weight: 600;">Selesai Hari Ini</div>
            <div style="font-size: 24px; font-weight: 800; color: #16a34a; margin-top: 4px;">${esc(s.finished_today || 0)}</div>
          </div>
          ${isStaff ? `
            <div class="card" style="padding: 18px; border-radius: 12px; background: #fff; border: 1px solid #e2e8f0;">
              <div style="font-size: 13px; color: #64748b; font-weight: 600;">Total Pelanggan</div>
              <div style="font-size: 24px; font-weight: 800; color: #d97706; margin-top: 4px;">${esc(s.total_customers || 0)}</div>
            </div>
          ` : ''}
        </div>

        <div class="card" style="padding: 20px; border-radius: 12px; background: #fff; border: 1px solid #e2e8f0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 700;">Pesanan Terbaru</h3>
            <button class="btn btn-primary" id="dashNewOrdBtn" style="padding: 8px 14px; font-size: 13px;">+ Buat Pesanan</button>
          </div>
          <div style="overflow-x: auto;">
            <table class="table" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
              <thead>
                <tr style="border-bottom: 2px solid #e2e8f0; color: #64748b;">
                  <th style="padding: 10px;">Kode</th>
                  <th style="padding: 10px;">Pelanggan</th>
                  <th style="padding: 10px;">Layanan</th>
                  <th style="padding: 10px;">Berat</th>
                  <th style="padding: 10px;">Total</th>
                  <th style="padding: 10px;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${(data.recent_orders || []).map(o => `
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px; font-weight: 600;">${esc(o.order_code)}</td>
                    <td style="padding: 10px;">${esc(o.customer_name)}</td>
                    <td style="padding: 10px;">${esc(o.service_name)}</td>
                    <td style="padding: 10px;">${esc(o.weight_kg)} kg</td>
                    <td style="padding: 10px; font-weight: 700;">Rp ${Number(o.total_amount).toLocaleString('id-ID')}</td>
                    <td style="padding: 10px;"><span class="badge status-${esc(o.status)}">${esc(o.status)}</span></td>
                  </tr>
                `).join('')}
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
    c.innerHTML = '<div style="padding: 20px;">Memuat data pesanan...</div>';

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
      const services = svcData.services || [];
      const isStaff = ['Admin', 'Owner', 'Staff'].includes(this.user.role || this.user.user_role);

      c.innerHTML = `
        <div style="display: flex; gap: 10px; margin-bottom: 20px; align-items: center; flex-wrap: wrap;">
          <input type="date" id="filterStart" value="${esc(start)}" style="padding: 8px 10px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 13px;">
          <span style="color: #64748b; font-size: 13px;">s/d</span>
          <input type="date" id="filterEnd" value="${esc(end)}" style="padding: 8px 10px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 13px;">
          
          <select id="filterStatus" style="padding: 8px 10px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 13px;">
            <option value="">Semua Status</option>
            <option value="baru" ${status === 'baru' ? 'selected' : ''}>Baru</option>
            <option value="proses" ${status === 'proses' ? 'selected' : ''}>Proses</option>
            <option value="selesai" ${status === 'selesai' ? 'selected' : ''}>Selesai</option>
            <option value="batal" ${status === 'batal' ? 'selected' : ''}>Batal</option>
          </select>

          <input type="text" id="ordSearch" value="${esc(q)}" placeholder="Cari kode/pelanggan..." 
            style="padding: 8px 12px; border-radius: 8px; border: 1px solid #cbd5e1; flex: 1; min-width: 150px;">
          
          <button class="btn" id="btnFilterOrders" style="padding: 8px 16px; font-size: 13px; background: #e2e8f0;">Filter</button>
          ${(start || end || q || status) ? `<button class="btn" id="btnResetFilterOrders" style="padding: 8px 16px; font-size: 13px; background: transparent; border: 1px solid #cbd5e1;">Reset</button>` : ''}
          
          <button class="btn btn-primary" id="openNewOrderModal" style="${!isStaff ? 'display: none;' : ''}">+ Pesanan Baru</button>
        </div>

        <div class="card" style="padding: 20px; border-radius: 12px; background: #fff; border: 1px solid #e2e8f0; overflow-x: auto;">
          <table class="table" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
            <thead>
              <tr style="border-bottom: 2px solid #e2e8f0; color: #64748b;">
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
              ${orders.map(o => `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 10px; font-weight: 600;">${esc(o.order_code)}</td>
                  <td style="padding: 10px;">${esc(o.customer_name)}</td>
                  <td style="padding: 10px;">${esc(o.service_name)}</td>
                  <td style="padding: 10px;">${esc(o.weight_kg)} kg</td>
                  <td style="padding: 10px; font-weight: 700;">Rp ${Number(o.total_amount).toLocaleString('id-ID')}</td>
                  <td style="padding: 10px;">
                    ${isStaff ? `
                      <select class="status-select" data-id="${esc(o.id)}" style="padding: 4px 8px; border-radius: 6px; border: 1px solid #cbd5e1;">
                        <option value="baru" ${o.status === 'baru' ? 'selected' : ''}>Baru</option>
                        <option value="proses" ${o.status === 'proses' ? 'selected' : ''}>Proses</option>
                        <option value="selesai" ${o.status === 'selesai' ? 'selected' : ''}>Selesai</option>
                        <option value="batal" ${o.status === 'batal' ? 'selected' : ''}>Batal</option>
                      </select>
                    ` : `<span class="badge status-${esc(o.status)}">${esc(o.status)}</span>`}
                  </td>
                  <td style="padding: 10px; text-align: right;">
                    <a href="/pay.html?code=${encodeURIComponent(o.order_code || '')}" class="btn" style="padding: 4px 8px; font-size: 12px; margin-right: 4px;">Bayar</a>
                    ${(isStaff || o.status === 'baru') ? `
                      <button class="btn btn-del" data-id="${esc(o.id)}" style="padding: 4px 8px; font-size: 12px; color: #ef4444; border: 1px solid #ef4444; background: transparent; border-radius: 6px; cursor: pointer;">Hapus</button>
                    ` : ''}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Order Modal -->
        <div id="orderModal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); place-items: center; z-index: 999; padding: 20px;">
          <div class="card" style="width: 100%; max-width: 500px; background: #fff; border-radius: 12px; padding: 24px;">
            <h3 style="margin-top: 0;">Buat Pesanan Laundry</h3>
            <form id="newOrderForm">
              ${isStaff ? `
                <div style="margin-bottom: 12px;">
                  <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">Nama Pelanggan</label>
                  <input type="text" id="ordCustName" required style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1; box-sizing: border-box;">
                </div>
              ` : ''}
              <div style="margin-bottom: 12px;">
                <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">No. HP / WA</label>
                <input type="text" id="ordPhone" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1; box-sizing: border-box;">
              </div>
              <div style="margin-bottom: 12px;">
                <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">Alamat</label>
                <input type="text" id="ordAddress" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1; box-sizing: border-box;">
              </div>
              <div style="margin-bottom: 12px;">
                <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">Pilih Layanan</label>
                <select id="ordService" required style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1; box-sizing: border-box;">
                  ${services.map(s => `<option value="${esc(s.id)}" data-price="${esc(s.price)}">${esc(s.name)} (Rp ${Number(s.price).toLocaleString('id-ID')}/${esc(s.unit || 'kg')})</option>`).join('')}
                </select>
              </div>
              <div style="margin-bottom: 12px;">
                <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">Berat (kg)</label>
                <input type="number" id="ordWeight" min="1" value="1" required style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1; box-sizing: border-box;">
              </div>
              <div style="margin-bottom: 16px;">
                <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">Kode Voucher / Diskon (opsional)</label>
                <input type="text" id="ordVoucher" placeholder="misal: PROMO10" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1; box-sizing: border-box;">
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
    c.innerHTML = '<div style="padding: 20px;">Memuat data pelanggan...</div>';

    try {
      const res = await fetch('/api/customers');
      const data = await res.json();
      const customers = data.customers || [];

      c.innerHTML = `
        <div class="card" style="padding: 20px; border-radius: 12px; background: #fff; border: 1px solid #e2e8f0; overflow-x: auto;">
          <table class="table" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
            <thead>
              <tr style="border-bottom: 2px solid #e2e8f0; color: #64748b;">
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
              ${customers.map(cust => `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 10px; font-weight: 600;">${esc(cust.code)}</td>
                  <td style="padding: 10px;">${esc(cust.full_name)}</td>
                  <td style="padding: 10px;">${esc(cust.phone || '-')}</td>
                  <td style="padding: 10px;">${esc(cust.address || '-')}</td>
                  <td style="padding: 10px;"><span class="badge">${esc(cust.computed_tag || cust.tag)}</span></td>
                  <td style="padding: 10px;">${esc(cust.orders_count || 0)}</td>
                  <td style="padding: 10px; font-weight: 700;">Rp ${Number(cust.total_spent || 0).toLocaleString('id-ID')}</td>
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
    c.innerHTML = '<div style="padding: 20px;">Memuat layanan...</div>';

    try {
      const res = await fetch('/api/services');
      const data = await res.json();
      const services = data.services || [];

      c.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px;">
          ${services.map(s => `
            <div class="card" style="padding: 20px; border-radius: 12px; background: #fff; border: 1px solid #e2e8f0;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <h4 style="margin: 0 0 8px; font-size: 16px;">${esc(s.name)}</h4>
                <span class="badge ${s.is_active ? 'status-selesai' : 'status-batal'}">${s.is_active ? 'Aktif' : 'Nonaktif'}</span>
              </div>
              <div style="font-size: 20px; font-weight: 800; color: #2563eb; margin-bottom: 8px;">
                Rp ${Number(s.price).toLocaleString('id-ID')} <span style="font-size: 13px; color: #64748b; font-weight: 500;">/ ${esc(s.unit || 'kg')}</span>
              </div>
              <p style="font-size: 13px; color: #64748b; margin: 0 0 12px;">Durasi estimasi: ${esc(s.duration_hours || 24)} Jam</p>
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
    c.innerHTML = '<div style="padding: 20px;">Memuat tugas delivery...</div>';

    try {
      const res = await fetch('/api/delivery');
      const data = await res.json();
      const tasks = data.tasks || [];

      c.innerHTML = `
        <div class="card" style="padding: 20px; border-radius: 12px; background: #fff; border: 1px solid #e2e8f0; overflow-x: auto;">
          <table class="table" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
            <thead>
              <tr style="border-bottom: 2px solid #e2e8f0; color: #64748b;">
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
              ${tasks.map(t => `
                <tr style="border-bottom: 1px solid #f1f5f9;">
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
    c.innerHTML = '<div style="padding: 20px;">Memuat promo...</div>';
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
          <div id="promoFormWrap" style="display:none;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:20px;" role="region" aria-label="Form promo">
            <h4 id="promoFormTitle" style="margin:0 0 16px;font-size:16px;font-weight:700;">Tambah Promo</h4>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div>
                <label for="pfCode" style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;">Kode</label>
                <input id="pfCode" type="text" maxlength="32" placeholder="misal: LEBARAN10" style="width:100%;padding:8px;border-radius:6px;border:1px solid #cbd5e1;box-sizing:border-box;">
              </div>
              <div>
                <label for="pfName" style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;">Nama Promo <span aria-hidden="true" style="color:#ef4444">*</span></label>
                <input id="pfName" type="text" maxlength="120" placeholder="Nama promo" style="width:100%;padding:8px;border-radius:6px;border:1px solid #cbd5e1;box-sizing:border-box;" required>
              </div>
              <div>
                <label for="pfType" style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;">Tipe</label>
                <select id="pfType" style="width:100%;padding:8px;border-radius:6px;border:1px solid #cbd5e1;box-sizing:border-box;">
                  <option value="percent">Persen (%)</option>
                  <option value="nominal">Nominal (Rp)</option>
                </select>
              </div>
              <div>
                <label for="pfValue" style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;">Nilai</label>
                <input id="pfValue" type="number" min="0" value="0" style="width:100%;padding:8px;border-radius:6px;border:1px solid #cbd5e1;box-sizing:border-box;" aria-label="Nilai promo">
              </div>
              <div>
                <label for="pfMinSpend" style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;">Min. Belanja (Rp)</label>
                <input id="pfMinSpend" type="number" min="0" value="0" style="width:100%;padding:8px;border-radius:6px;border:1px solid #cbd5e1;box-sizing:border-box;">
              </div>
              <div>
                <label for="pfMaxDiscount" style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;">Maks. Diskon (Rp)</label>
                <input id="pfMaxDiscount" type="number" min="0" value="0" style="width:100%;padding:8px;border-radius:6px;border:1px solid #cbd5e1;box-sizing:border-box;">
              </div>
              <div>
                <label for="pfExpires" style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;">Kedaluwarsa (opsional)</label>
                <input id="pfExpires" type="datetime-local" style="width:100%;padding:8px;border-radius:6px;border:1px solid #cbd5e1;box-sizing:border-box;">
              </div>
              <div style="display:flex;align-items:flex-end;">
                <label style="font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;">
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
            <h3 style="margin:0;">Daftar Promo</h3>
            <button class="btn btn-primary" onclick="App.openPromoForm()" style="padding:8px 16px;">+ Tambah Promo</button>
          </div>
          <div class="card" style="padding:20px;border-radius:12px;background:#fff;border:1px solid #e2e8f0;overflow-x:auto;margin-bottom:24px;">
            <table class="table" style="width:100%;border-collapse:collapse;text-align:left;font-size:14px;">
              <thead>
                <tr style="border-bottom:2px solid #e2e8f0;color:#64748b;">
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
                  ? '<tr><td colspan="8" style="padding:20px;text-align:center;color:#94a3b8;">Belum ada promo</td></tr>'
                  : promos.map(p => `
                  <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:10px;font-weight:700;color:#2563eb;">${esc(p.code)}</td>
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
                        <button class="btn" style="padding:4px 10px;font-size:12px;background:#fef2f2;color:#dc2626;" onclick="App.deletePromo(${p.id})" aria-label="Hapus promo ${esc(p.code)}">Hapus</button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- Form Grant Voucher (Staff Only) -->
          <div id="grantVoucherWrap" style="display:none;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:20px;" role="region" aria-label="Form terbitkan voucher">
            <h4 style="margin:0 0 16px;font-size:16px;font-weight:700;">🎁 Terbitkan Voucher ke Pelanggan</h4>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div>
                <label for="gvPromoId" style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;">Pilih Promo</label>
                <select id="gvPromoId" style="width:100%;padding:8px;border-radius:6px;border:1px solid #cbd5e1;box-sizing:border-box;">
                  ${promos.filter(p => p.is_active).map(p => `<option value="${p.id}">${esc(p.code)} — ${esc(p.name)} (${p.type === 'percent' ? esc(p.value) + '%' : 'Rp ' + Number(p.value).toLocaleString('id-ID')})</option>`).join('')}
                </select>
              </div>
              <div>
                <label for="gvType" style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;">Metode</label>
                <select id="gvType" style="width:100%;padding:8px;border-radius:6px;border:1px solid #cbd5e1;box-sizing:border-box;">
                  <option value="single">Satu Pelanggan</option>
                  <option value="bulk">Massal (Banyak ID)</option>
                </select>
              </div>
              <div style="grid-column: 1 / -1;">
                <label for="gvUserId" style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;">User ID Pelanggan</label>
                <input id="gvUserId" type="text" placeholder="Contoh: 12 atau untuk massal: 1, 2, 3" style="width:100%;padding:8px;border-radius:6px;border:1px solid #cbd5e1;box-sizing:border-box;">
                <div style="font-size:11px;color:#64748b;margin-top:4px;">Masukkan ID numerik akun pelanggan terdaftar.</div>
              </div>
            </div>
            <div style="margin-top:16px;display:flex;gap:8px;">
              <button class="btn btn-primary" onclick="App.grantVoucher()" style="padding:8px 20px;">Terbitkan</button>
              <button class="btn" onclick="document.getElementById('grantVoucherWrap').style.display='none'" style="padding:8px 20px;">Batal</button>
            </div>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <h3 style="margin:0;">Semua Voucher Pengguna</h3>
            <button class="btn" style="background:#059669;color:#fff;border:none;padding:8px 16px;font-weight:600;border-radius:6px;cursor:pointer;" onclick="App.openGrantVoucherForm()">🎁 Terbitkan Voucher</button>
          </div>
          <div class="card" style="padding:20px;border-radius:12px;background:#fff;border:1px solid #e2e8f0;overflow-x:auto;">
            <table class="table" style="width:100%;border-collapse:collapse;text-align:left;font-size:14px;">
              <thead>
                <tr style="border-bottom:2px solid #e2e8f0;color:#64748b;">
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
                  ? '<tr><td colspan="6" style="padding:20px;text-align:center;color:#94a3b8;">Belum ada voucher diterbitkan</td></tr>'
                  : vouchers.map(v => `
                  <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:10px;font-weight:700;color:#2563eb;font-family:monospace;">${esc(v.code)}</td>
                    <td style="padding:10px;">${esc(v.promo_name || v.name)}</td>
                    <td style="padding:10px;font-weight:600;color:#059669;">${v.type === 'percent' ? esc(v.value) + '%' : 'Rp ' + Number(v.value).toLocaleString('id-ID')}</td>
                    <td style="padding:10px;">
                      <div style="font-weight:600;">${esc(v.user_name || 'User #' + v.user_id)}</div>
                      <div style="font-size:11px;color:#64748b;">${esc(v.user_email || 'ID: ' + v.user_id)}</div>
                    </td>
                    <td style="padding:10px;"><span class="badge ${v.used_at ? 'status-batal' : 'status-selesai'}">${v.used_at ? 'Sudah Dipakai' : 'Siap Pakai'}</span></td>
                    <td style="padding:10px;text-align:right;">
                      <button class="btn" style="padding:4px 10px;font-size:12px;background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;border-radius:4px;cursor:pointer;" onclick="App.deleteVoucher(${v.id})" aria-label="Cabut voucher ${esc(v.code)}">Cabut</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      } else {
        c.innerHTML = `
          <h3 style="margin:0 0 16px;">Voucher Tersedia</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-bottom:28px;">
            ${promos.filter(p => p.is_active).length === 0
              ? '<div style="color:#94a3b8;padding:20px;">Belum ada promo aktif saat ini.</div>'
              : promos.filter(p => p.is_active).map(p => `
                <div class="card" style="padding:20px;border-radius:12px;background:#fff;border:1px solid #e2e8f0;display:flex;flex-direction:column;justify-content:space-between;">
                  <div>
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                      <span class="badge" style="background:#eff6ff;color:#2563eb;font-weight:700;font-family:monospace;">${esc(p.code || 'PROMO')}</span>
                      <span style="font-size:11px;color:#64748b;">${p.expires_at ? 'Hingga ' + esc(String(p.expires_at).slice(0, 10)) : 'Aktif'}</span>
                    </div>
                    <h4 style="margin:0 0 6px;font-size:16px;">${esc(p.name)}</h4>
                    <div style="font-size:18px;font-weight:800;color:#059669;margin-bottom:8px;">
                      ${p.type === 'percent' ? 'Diskon ' + esc(p.value) + '%' : 'Potongan Rp ' + Number(p.value).toLocaleString('id-ID')}
                    </div>
                    <div style="font-size:12px;color:#64748b;margin:0 0 12px;">
                      <div>Min. belanja: Rp ${Number(p.min_spend || 0).toLocaleString('id-ID')}</div>
                      ${p.max_discount > 0 ? `<div>Maks. diskon: Rp ${Number(p.max_discount).toLocaleString('id-ID')}</div>` : ''}
                    </div>
                  </div>
                  <button class="btn btn-copy" style="width:100%;padding:8px;font-size:13px;border:1px dashed #2563eb;background:#eff6ff;color:#2563eb;border-radius:6px;cursor:pointer;" onclick="navigator.clipboard.writeText('${esc(p.code)}'); this.textContent='✓ Tersalin!'; setTimeout(() => this.textContent='📋 Salin Kode Promo', 2000);">📋 Salin Kode Promo</button>
                </div>
              `).join('')}
          </div>

          <h3 style="margin:0 0 16px;">Voucher Saya</h3>
          <div class="card" style="padding:20px;border-radius:12px;background:#fff;border:1px solid #e2e8f0;overflow-x:auto;">
            <table class="table" style="width:100%;border-collapse:collapse;text-align:left;font-size:14px;">
              <thead>
                <tr style="border-bottom:2px solid #e2e8f0;color:#64748b;">
                  <th style="padding:10px;">Kode Voucher</th>
                  <th style="padding:10px;">Nama Promo</th>
                  <th style="padding:10px;">Nilai</th>
                  <th style="padding:10px;">Status</th>
                  <th style="padding:10px;text-align:right;">Aksi</th>
                </tr>
              </thead>
              <tbody>
                ${vouchers.length === 0
                  ? '<tr><td colspan="5" style="padding:20px;text-align:center;color:#94a3b8;">Belum ada voucher</td></tr>'
                  : vouchers.map(v => `
                  <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:10px;font-weight:700;color:#2563eb;font-family:monospace;">${esc(v.code)}</td>
                    <td style="padding:10px;">${esc(v.name)}</td>
                    <td style="padding:10px;font-weight:600;color:#059669;">${v.type === 'percent' ? esc(v.value) + '%' : 'Rp ' + Number(v.value).toLocaleString('id-ID')}</td>
                    <td style="padding:10px;">
                      <span class="badge ${v.used_at ? 'status-batal' : 'status-selesai'}">${v.used_at ? 'Sudah Dipakai' : 'Siap Pakai'}</span>
                    </td>
                    <td style="padding:10px;text-align:right;">
                      ${!v.used_at ? `
                        <button class="btn" style="padding:4px 8px;font-size:12px;background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;border-radius:4px;cursor:pointer;" onclick="navigator.clipboard.writeText('${esc(v.code)}'); this.textContent='✓ Salin'; setTimeout(() => this.textContent='Salin', 2000);">Salin</button>
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
      else alert(data.msg || 'Gagal menyimpan promo');
    } catch (e) {
      alert('Koneksi gagal');
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
      else alert(data.msg || 'Gagal mengubah status');
    } catch (e) {
      alert('Koneksi gagal');
    }
  },

  async deletePromo(id) {
    if (!confirm('Hapus promo ini? Voucher yang sudah diklaim tidak akan terhapus.')) return;
    try {
      const res = await fetch('/api/promos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_promo', id })
      });
      const data = await res.json();
      if (data.ok) this.renderPromo();
      else alert(data.msg || 'Gagal menghapus');
    } catch (e) {
      alert('Koneksi gagal');
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
        alert('Voucher berhasil diklaim!');
        this.renderPromo();
      } else {
        alert(data.msg || 'Gagal klaim');
      }
    } catch (e) {
      alert('Koneksi gagal');
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
      alert('Pilih promo dan masukkan User ID');
      return;
    }

    try {
      let payload;
      if (type === 'single') {
        const uid = Number(rawUser);
        if (!uid || isNaN(uid)) {
          alert('User ID harus berupa angka bulat valid');
          return;
        }
        payload = { action: 'create_voucher', promo_id: promoId, user_id: uid };
      } else {
        const ids = rawUser.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n) && n > 0);
        if (ids.length === 0) {
          alert('Masukkan minimal satu User ID valid');
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
        alert(type === 'single' ? 'Voucher berhasil diterbitkan!' : `Berhasil menerbitkan ${data.created || 0} voucher!`);
        this.renderPromo();
      } else {
        alert(data.msg || 'Gagal menerbitkan voucher');
      }
    } catch (e) {
      alert('Koneksi gagal');
    }
  },

  async deleteVoucher(id) {
    if (!confirm('Cabut voucher ini dari pelanggan?')) return;
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
        alert(data.msg || 'Gagal mencabut voucher');
      }
    } catch (e) {
      alert('Koneksi gagal');
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
        <div style="text-align: center; padding: 48px 16px; color: #64748b;">
          <div style="font-size: 36px; margin-bottom: 8px;">📊</div>
          <div style="font-weight: 700; font-size: 15px; color: #334155;">Tidak ada data grafik transaksi</div>
          <div style="font-size: 13px; color: #94a3b8; margin-top: 4px;">Coba ubah rentang tanggal atau pengelompokan periode di atas.</div>
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
        <line x1="${padL}" y1="${y}" x2="${padL + plotW}" y2="${y}" stroke="#f1f5f9" stroke-width="1" stroke-dasharray="${i === 0 ? '0' : '4'}"/>
        <text x="${padL - 10}" y="${y + 4}" text-anchor="end" font-size="10" fill="#94a3b8" font-family="system-ui, sans-serif">Rp ${label}</text>
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
          ${paid > 0 ? `<rect x="${bx}" y="${byPaid}" width="${barW}" height="${paidH}" fill="#2563eb" rx="2" class="bar-paid" style="transition: opacity 0.2s;"/>` : ''}
          ${unpaid > 0 ? `<rect x="${bx}" y="${byUnpaid}" width="${barW}" height="${unpaidH}" fill="#f59e0b" rx="2" class="bar-unpaid" style="transition: opacity 0.2s;"/>` : ''}
          <text x="${cx}" y="${padT + plotH + 20}" text-anchor="middle" font-size="11" fill="#64748b" font-weight="500">${esc(shortLabel)}</text>
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
        <div id="chartTooltip" style="position: absolute; display: none; pointer-events: none; z-index: 20; background: #0f172a; color: #fff; padding: 8px 12px; border-radius: 8px; font-size: 12px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3); transform: translate(-50%, -100%); margin-top: -8px;"></div>
      </div>
    `;
  },

  async renderLaporan() {
    document.getElementById('pageTitle').textContent = 'Laporan Keuangan & Kinerja';
    const c = document.getElementById('mainContent');
    c.innerHTML = '<div style="padding: 20px; color: #64748b;">Memuat laporan keuangan & kinerja...</div>';

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
        <div class="card" style="padding: 16px 20px; border-radius: 12px; background: #fff; border: 1px solid #e2e8f0; margin-bottom: 20px;">
          <div style="display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-end; justify-content: space-between;">
            <div style="display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end;">
              <div>
                <label style="display: block; font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 4px;">Kelompokkan</label>
                <select id="reportGroup" style="padding: 8px 12px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 13px; font-weight: 500; background: #fff;">
                  <option value="bulan" ${filter.group === 'bulan' ? 'selected' : ''}>Bulanan</option>
                  <option value="minggu" ${filter.group === 'minggu' ? 'selected' : ''}>Mingguan</option>
                  <option value="hari" ${filter.group === 'hari' ? 'selected' : ''}>Harian</option>
                </select>
              </div>

              <div>
                <label style="display: block; font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 4px;">Dari Tanggal</label>
                <input type="date" id="reportStart" value="${esc(filter.start || '')}" style="padding: 7px 10px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 13px;">
              </div>

              <div>
                <label style="display: block; font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 4px;">Sampai Tanggal</label>
                <input type="date" id="reportEnd" value="${esc(filter.end || '')}" style="padding: 7px 10px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 13px;">
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
              <button type="button" class="btn btn-sm" onclick="window.print()" style="padding: 5px 10px; font-size: 12px; background: #0f172a; color: #fff;">🖨️ Cetak</button>
            </div>
          </div>
        </div>

        <!-- EXECUTIVE KPI CARDS -->
        <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 24px;">
          <div class="card" style="padding: 16px 18px; border-radius: 12px; background: #fff; border: 1px solid #e2e8f0;">
            <div style="font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Total Omset</div>
            <div style="font-size: 22px; font-weight: 800; color: #0f172a; margin-top: 4px;">Rp ${Number(kpi.rev || 0).toLocaleString('id-ID')}</div>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Seluruh pendapatan kotor</div>
          </div>
          <div class="card" style="padding: 16px 18px; border-radius: 12px; background: #fff; border: 1px solid #e2e8f0; border-left: 4px solid #2563eb;">
            <div style="font-size: 12px; color: #2563eb; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Kas Terbayar</div>
            <div style="font-size: 22px; font-weight: 800; color: #2563eb; margin-top: 4px;">Rp ${Number(totalPaid || kpi.rev || 0).toLocaleString('id-ID')}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Pembayaran lunas diterima</div>
          </div>
          <div class="card" style="padding: 16px 18px; border-radius: 12px; background: #fff; border: 1px solid #e2e8f0; border-left: 4px solid #f59e0b;">
            <div style="font-size: 12px; color: #d97706; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Piutang / Belum Lunas</div>
            <div style="font-size: 22px; font-weight: 800; color: #d97706; margin-top: 4px;">Rp ${Number(totalUnpaid).toLocaleString('id-ID')}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Sisa tagihan pelanggan</div>
          </div>
          <div class="card" style="padding: 16px 18px; border-radius: 12px; background: #fff; border: 1px solid #e2e8f0;">
            <div style="font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Total Order & Bobot</div>
            <div style="font-size: 22px; font-weight: 800; color: #0f172a; margin-top: 4px;">${kpi.ord || 0} <span style="font-size: 14px; font-weight: 600; color: #64748b;">order</span></div>
            <div style="font-size: 11px; color: #16a34a; font-weight: 600; margin-top: 2px;">Rata-rata: ${kpi.avg_wt || 0} kg/order</div>
          </div>
        </div>

        <!-- INTERACTIVE CHART -->
        <div class="card" style="padding: 20px; border-radius: 12px; background: #fff; border: 1px solid #e2e8f0; margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div>
              <h4 style="margin: 0; font-size: 16px; font-weight: 700; color: #0f172a;">Grafik Perkembangan Pendapatan</h4>
              <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Visualisasi omset terbayar vs piutang berdasarkan periode terpilih</div>
            </div>
            <div style="display: flex; align-items: center; gap: 14px; font-size: 12px; font-weight: 600;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="width: 12px; height: 12px; background: #2563eb; border-radius: 2px; display: inline-block;"></span>
                <span>Terbayar</span>
              </div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="width: 12px; height: 12px; background: #f59e0b; border-radius: 2px; display: inline-block;"></span>
                <span>Piutang</span>
              </div>
            </div>
          </div>

          <div id="chartContainer">
            ${this.buildSvgChart(chartRows)}
          </div>
        </div>

        <!-- DAILY BREAKDOWN TABLE -->
        <div class="card" style="padding: 20px; border-radius: 12px; background: #fff; border: 1px solid #e2e8f0; overflow-x: auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div>
              <h4 style="margin: 0; font-size: 16px; font-weight: 700; color: #0f172a;">Rincian Harian Transaksi</h4>
              <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Daftar rekapan pesanan per hari dalam rentang periode</div>
            </div>
            <div style="font-size: 13px; color: #64748b; font-weight: 600;">
              Total: ${daily.length} hari
            </div>
          </div>

          <table class="table" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
            <thead>
              <tr style="border-bottom: 2px solid #e2e8f0; color: #64748b; font-size: 13px;">
                <th style="padding: 10px 12px;">Tanggal</th>
                <th style="padding: 10px 12px;">Jumlah Order</th>
                <th style="padding: 10px 12px;">Total Berat</th>
                <th style="padding: 10px 12px;">Total Pendapatan</th>
              </tr>
            </thead>
            <tbody>
              ${daily.length === 0 ? `
                <tr>
                  <td colspan="4" style="padding: 24px; text-align: center; color: #94a3b8;">Tidak ada data harian pada rentang ini.</td>
                </tr>
              ` : daily.map(d => `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 10px 12px; font-weight: 600; color: #334155;">${esc(d.d)}</td>
                  <td style="padding: 10px 12px; color: #2563eb; font-weight: 600;">${esc(d.orders)} order</td>
                  <td style="padding: 10px 12px; color: #16a34a; font-weight: 600;">${esc(d.weight)} kg</td>
                  <td style="padding: 10px 12px; font-weight: 700; color: #0f172a;">Rp ${Number(d.revenue).toLocaleString('id-ID')}</td>
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
    c.innerHTML = '<div style="padding: 20px;">Memuat profil...</div>';

    try {
      const res = await fetch('/api/profile');
      const data = await res.json();
      const u = data.user || this.user;

      c.innerHTML = `
        <div style="max-width: 600px; margin: 0 auto; display: grid; gap: 20px;">
          <div class="card" style="padding: 24px; border-radius: 12px; background: #fff; border: 1px solid #e2e8f0;">
            <h3 style="margin-top: 0; font-size: 16px;">Informasi Pribadi</h3>
            <form id="profileForm">
              <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">Nama Lengkap</label>
                <input type="text" id="profName" value="${esc(u.full_name || u.name || '')}" required 
                  style="width: 100%; padding: 8px 12px; border-radius: 6px; border: 1px solid #cbd5e1; box-sizing: border-box;">
              </div>
              <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">Email</label>
                <input type="email" value="${esc(u.email || '')}" disabled  
                  style="width: 100%; padding: 8px 12px; border-radius: 6px; border: 1px solid #cbd5e1; background: #f8fafc; box-sizing: border-box;">
              </div>
              <div style="margin-bottom: 18px;">
                <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">No. HP</label>
                <input type="text" id="profPhone" value="${esc(u.phone || '')}" 
                  style="width: 100%; padding: 8px 12px; border-radius: 6px; border: 1px solid #cbd5e1; box-sizing: border-box;">
              </div>
              <button type="submit" class="btn btn-primary">Simpan Profil</button>
            </form>
          </div>

          <div class="card" style="padding: 24px; border-radius: 12px; background: #fff; border: 1px solid #e2e8f0;">
            <h3 style="margin-top: 0; font-size: 16px;">Ganti Sandi</h3>
            <form id="passForm">
              <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">Sandi Lama</label>
                <input type="password" id="oldPass" required 
                  style="width: 100%; padding: 8px 12px; border-radius: 6px; border: 1px solid #cbd5e1; box-sizing: border-box;">
              </div>
              <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">Sandi Baru</label>
                <input type="password" id="newPass" required 
                  style="width: 100%; padding: 8px 12px; border-radius: 6px; border: 1px solid #cbd5e1; box-sizing: border-box;">
              </div>
              <div style="margin-bottom: 18px;">
                <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">Konfirmasi Sandi Baru</label>
                <input type="password" id="repPass" required 
                  style="width: 100%; padding: 8px 12px; border-radius: 6px; border: 1px solid #cbd5e1; box-sizing: border-box;">
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
