// public/app.js - Embun Laundry Single Page App
const App = {
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

    document.getElementById('loginForm').onsubmit = async (e) => {
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
    };

    document.getElementById('toRegBtn').onclick = (e) => {
      e.preventDefault();
      this.renderRegister();
    };
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

    document.getElementById('regForm').onsubmit = async (e) => {
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
    };

    document.getElementById('toLogBtn').onclick = (e) => {
      e.preventDefault();
      this.renderLogin();
    };
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
              <span>🧺</span> <span>Pesanan</span>
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
            <div class="topbar-inner">
              <div class="h1" id="pageTitle">Dashboard</div>
              <div class="badge" style="margin-left: 8px;">${this.user.role || this.user.user_role}</div>
              <div style="margin-left: auto; display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 14px; font-weight: 600;">Hai, ${this.user.user_name || this.user.name || 'User'}</span>
              </div>
            </div>
          </div>
          <div class="content" id="mainContent">
            <!-- Dynamic Page Content Loaded Here -->
          </div>
        </section>
      </div>
    `;

    // Sidebar navigation handler
    document.querySelectorAll('.nav-link').forEach(link => {
      link.onclick = (e) => {
        e.preventDefault();
        const page = link.getAttribute('data-page');
        if (page) {
          this.currentPage = page;
          document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
          link.classList.add('active');
          this.renderPage(page);
        }
      };
    });

    document.getElementById('logoutBtn').onclick = async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
      this.user = null;
      this.renderLogin();
    };

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
            <div style="font-size: 24px; font-weight: 800; color: #2563eb; margin-top: 4px;">${s.active_orders}</div>
          </div>
          <div class="card" style="padding: 18px; border-radius: 12px; background: #fff; border: 1px solid #e2e8f0;">
            <div style="font-size: 13px; color: #64748b; font-weight: 600;">Selesai Hari Ini</div>
            <div style="font-size: 24px; font-weight: 800; color: #16a34a; margin-top: 4px;">${s.finished_today}</div>
          </div>
          ${isStaff ? `
            <div class="card" style="padding: 18px; border-radius: 12px; background: #fff; border: 1px solid #e2e8f0;">
              <div style="font-size: 13px; color: #64748b; font-weight: 600;">Total Pelanggan</div>
              <div style="font-size: 24px; font-weight: 800; color: #d97706; margin-top: 4px;">${s.total_customers}</div>
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
                    <td style="padding: 10px; font-weight: 600;">${o.order_code}</td>
                    <td style="padding: 10px;">${o.customer_name}</td>
                    <td style="padding: 10px;">${o.service_name}</td>
                    <td style="padding: 10px;">${o.weight_kg} kg</td>
                    <td style="padding: 10px; font-weight: 700;">Rp ${Number(o.total_amount).toLocaleString('id-ID')}</td>
                    <td style="padding: 10px;"><span class="badge status-${o.status}">${o.status}</span></td>
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

  async renderPesanan() {
    document.getElementById('pageTitle').textContent = 'Manajemen Pesanan';
    const c = document.getElementById('mainContent');
    c.innerHTML = '<div style="padding: 20px;">Memuat data pesanan...</div>';

    try {
      const [ordRes, svcRes] = await Promise.all([
        fetch('/api/orders'),
        fetch('/api/services')
      ]);
      const ordData = await ordRes.json();
      const svcData = await svcRes.json();

      const orders = ordData.orders || [];
      const services = svcData.services || [];
      const isStaff = ['Admin', 'Owner', 'Staff'].includes(this.user.role || this.user.user_role);

      c.innerHTML = `
        <div style="display: flex; gap: 12px; margin-bottom: 20px; align-items: center; flex-wrap: wrap;">
          <input type="text" id="ordSearch" placeholder="Cari kode/pelanggan/layanan..." 
            style="padding: 8px 12px; border-radius: 8px; border: 1px solid #cbd5e1; flex: 1; min-width: 200px;">
          <button class="btn btn-primary" id="openNewOrderModal">+ Pesanan Baru</button>
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
                  <td style="padding: 10px; font-weight: 600;">${o.order_code}</td>
                  <td style="padding: 10px;">${o.customer_name}</td>
                  <td style="padding: 10px;">${o.service_name}</td>
                  <td style="padding: 10px;">${o.weight_kg} kg</td>
                  <td style="padding: 10px; font-weight: 700;">Rp ${Number(o.total_amount).toLocaleString('id-ID')}</td>
                  <td style="padding: 10px;">
                    ${isStaff ? `
                      <select class="status-select" data-id="${o.id}" style="padding: 4px 8px; border-radius: 6px; border: 1px solid #cbd5e1;">
                        <option value="baru" ${o.status === 'baru' ? 'selected' : ''}>Baru</option>
                        <option value="proses" ${o.status === 'proses' ? 'selected' : ''}>Proses</option>
                        <option value="selesai" ${o.status === 'selesai' ? 'selected' : ''}>Selesai</option>
                        <option value="batal" ${o.status === 'batal' ? 'selected' : ''}>Batal</option>
                      </select>
                    ` : `<span class="badge status-${o.status}">${o.status}</span>`}
                  </td>
                  <td style="padding: 10px; text-align: right;">
                    <a href="/pay.html?code=${o.order_code}" class="btn" style="padding: 4px 8px; font-size: 12px; margin-right: 4px;">Bayar</a>
                    ${(isStaff || o.status === 'baru') ? `
                      <button class="btn btn-del" data-id="${o.id}" style="padding: 4px 8px; font-size: 12px; color: #ef4444; border: 1px solid #ef4444; background: transparent; border-radius: 6px; cursor: pointer;">Hapus</button>
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
                  ${services.map(s => `<option value="${s.id}" data-price="${s.price}">${s.name} (Rp ${Number(s.price).toLocaleString('id-ID')}/${s.unit || 'kg'})</option>`).join('')}
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

      // Status change handler
      document.querySelectorAll('.status-select').forEach(sel => {
        sel.onchange = async () => {
          const id = sel.getAttribute('data-id');
          await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'move_status', id, status: sel.value })
          });
        };
      });

      // Delete handler
      document.querySelectorAll('.btn-del').forEach(btn => {
        btn.onclick = async () => {
          if (!confirm('Hapus pesanan ini?')) return;
          const id = btn.getAttribute('data-id');
          await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete_order', id })
          });
          this.renderPesanan();
        };
      });

      // Modal open/close
      const modal = document.getElementById('orderModal');
      document.getElementById('openNewOrderModal').onclick = () => modal.style.display = 'grid';
      document.getElementById('closeOrderModalBtn').onclick = () => modal.style.display = 'none';

      // Form submit
      document.getElementById('newOrderForm').onsubmit = async (e) => {
        e.preventDefault();
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
          modal.style.display = 'none';
          this.renderPesanan();
        } else {
          alert(data.msg || 'Gagal membuat pesanan');
        }
      };

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
                  <td style="padding: 10px; font-weight: 600;">${cust.code}</td>
                  <td style="padding: 10px;">${cust.full_name}</td>
                  <td style="padding: 10px;">${cust.phone || '-'}</td>
                  <td style="padding: 10px;">${cust.address || '-'}</td>
                  <td style="padding: 10px;"><span class="badge">${cust.computed_tag || cust.tag}</span></td>
                  <td style="padding: 10px;">${cust.orders_count || 0}</td>
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
                <h4 style="margin: 0 0 8px; font-size: 16px;">${s.name}</h4>
                <span class="badge ${s.is_active ? 'status-selesai' : 'status-batal'}">${s.is_active ? 'Aktif' : 'Nonaktif'}</span>
              </div>
              <div style="font-size: 20px; font-weight: 800; color: #2563eb; margin-bottom: 8px;">
                Rp ${Number(s.price).toLocaleString('id-ID')} <span style="font-size: 13px; color: #64748b; font-weight: 500;">/ ${s.unit || 'kg'}</span>
              </div>
              <p style="font-size: 13px; color: #64748b; margin: 0 0 12px;">Durasi estimasi: ${s.duration_hours || 24} Jam</p>
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
                  <td style="padding: 10px; font-weight: 600;">${t.task_code}</td>
                  <td style="padding: 10px;"><span class="badge">${t.type.toUpperCase()}</span></td>
                  <td style="padding: 10px;">${t.customer_name}</td>
                  <td style="padding: 10px;">${t.address || '-'}</td>
                  <td style="padding: 10px;">${t.courier_name || 'Belum ditugaskan'}</td>
                  <td style="padding: 10px;">${t.schedule_date}</td>
                  <td style="padding: 10px;"><span class="badge status-${t.status}">${t.status}</span></td>
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

    try {
      const [pRes, vRes] = await Promise.all([
        fetch('/api/promos'),
        fetch('/api/vouchers')
      ]);
      const pData = await pRes.json();
      const vData = await vRes.json();

      const promos = pData.promos || [];
      const vouchers = vData.vouchers || [];

      c.innerHTML = `
        <h3 style="margin: 0 0 16px;">Voucher Tersedia</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 28px;">
          ${promos.map(p => `
            <div class="card" style="padding: 20px; border-radius: 12px; background: #fff; border: 1px solid #e2e8f0;">
              <span class="badge" style="background: #eff6ff; color: #2563eb; font-weight: 700;">${p.code || 'PROMO'}</span>
              <h4 style="margin: 8px 0 4px; font-size: 16px;">${p.name}</h4>
              <div style="font-size: 18px; font-weight: 800; color: #059669; margin-bottom: 8px;">
                ${p.type === 'percent' ? `Diskon ${p.value}%` : `Potongan Rp ${Number(p.value).toLocaleString('id-ID')}`}
              </div>
              <p style="font-size: 12px; color: #64748b; margin: 0 0 12px;">Min. belanja: Rp ${Number(p.min_spend || 0).toLocaleString('id-ID')}</p>
              <button class="btn btn-primary" style="width: 100%; padding: 8px; font-size: 13px;" onclick="App.claimVoucher(${p.id})">Klaim Voucher</button>
            </div>
          `).join('')}
        </div>

        <h3 style="margin: 0 0 16px;">Voucher Saya</h3>
        <div class="card" style="padding: 20px; border-radius: 12px; background: #fff; border: 1px solid #e2e8f0; overflow-x: auto;">
          <table class="table" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
            <thead>
              <tr style="border-bottom: 2px solid #e2e8f0; color: #64748b;">
                <th style="padding: 10px;">Kode Klaim</th>
                <th style="padding: 10px;">Nama Promo</th>
                <th style="padding: 10px;">Nilai</th>
                <th style="padding: 10px;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${vouchers.map(v => `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 10px; font-weight: 700; color: #2563eb;">${v.code}</td>
                  <td style="padding: 10px;">${v.name}</td>
                  <td style="padding: 10px;">${v.type === 'percent' ? v.value + '%' : 'Rp ' + Number(v.value).toLocaleString('id-ID')}</td>
                  <td style="padding: 10px;">
                    <span class="badge ${v.used_at ? 'status-batal' : 'status-selesai'}">${v.used_at ? 'Sudah Dipakai' : 'Siap Pakai'}</span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (e) {
      c.innerHTML = '<div class="err">Kesalahan memuat promo</div>';
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

  async renderLaporan() {
    document.getElementById('pageTitle').textContent = 'Laporan Keuangan & Kinerja';
    const c = document.getElementById('mainContent');
    c.innerHTML = '<div style="padding: 20px;">Memuat laporan...</div>';

    try {
      const res = await fetch('/api/reports');
      const data = await res.json();
      const kpi = data.kpi || {};
      const daily = data.daily || [];

      c.innerHTML = `
        <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px;">
          <div class="card" style="padding: 18px; border-radius: 12px; background: #fff; border: 1px solid #e2e8f0;">
            <div style="font-size: 13px; color: #64748b; font-weight: 600;">Total Omset Periode</div>
            <div style="font-size: 24px; font-weight: 800; color: #0f172a; margin-top: 4px;">Rp ${Number(kpi.rev || 0).toLocaleString('id-ID')}</div>
          </div>
          <div class="card" style="padding: 18px; border-radius: 12px; background: #fff; border: 1px solid #e2e8f0;">
            <div style="font-size: 13px; color: #64748b; font-weight: 600;">Total Transaksi</div>
            <div style="font-size: 24px; font-weight: 800; color: #2563eb; margin-top: 4px;">${kpi.ord || 0}</div>
          </div>
          <div class="card" style="padding: 18px; border-radius: 12px; background: #fff; border: 1px solid #e2e8f0;">
            <div style="font-size: 13px; color: #64748b; font-weight: 600;">Rata-rata Bobot / Order</div>
            <div style="font-size: 24px; font-weight: 800; color: #16a34a; margin-top: 4px;">${kpi.avg_wt || 0} kg</div>
          </div>
        </div>

        <div class="card" style="padding: 20px; border-radius: 12px; background: #fff; border: 1px solid #e2e8f0; overflow-x: auto;">
          <h4 style="margin: 0 0 16px;">Rincian Harian</h4>
          <table class="table" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
            <thead>
              <tr style="border-bottom: 2px solid #e2e8f0; color: #64748b;">
                <th style="padding: 10px;">Tanggal</th>
                <th style="padding: 10px;">Jumlah Order</th>
                <th style="padding: 10px;">Total Berat</th>
                <th style="padding: 10px;">Pendapatan</th>
              </tr>
            </thead>
            <tbody>
              ${daily.map(d => `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 10px; font-weight: 600;">${d.d}</td>
                  <td style="padding: 10px;">${d.orders}</td>
                  <td style="padding: 10px;">${d.weight} kg</td>
                  <td style="padding: 10px; font-weight: 700;">Rp ${Number(d.revenue).toLocaleString('id-ID')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (e) {
      c.innerHTML = '<div class="err">Kesalahan memuat laporan</div>';
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
                <input type="text" id="profName" value="${u.full_name || u.name || ''}" required 
                  style="width: 100%; padding: 8px 12px; border-radius: 6px; border: 1px solid #cbd5e1; box-sizing: border-box;">
              </div>
              <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">Email</label>
                <input type="email" value="${u.email || ''}" disabled 
                  style="width: 100%; padding: 8px 12px; border-radius: 6px; border: 1px solid #cbd5e1; background: #f8fafc; box-sizing: border-box;">
              </div>
              <div style="margin-bottom: 18px;">
                <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">No. HP</label>
                <input type="text" id="profPhone" value="${u.phone || ''}" 
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

      document.getElementById('profileForm').onsubmit = async (e) => {
        e.preventDefault();
        const full_name = document.getElementById('profName').value.trim();
        const phone = document.getElementById('profPhone').value.trim();
        const r = await fetch('/api/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update_profile', full_name, phone })
        });
        const resData = await r.json();
        if (resData.ok) alert('Profil diperbarui');
        else alert(resData.msg || 'Gagal update profil');
      };

      document.getElementById('passForm').onsubmit = async (e) => {
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
      };

    } catch (e) {
      c.innerHTML = '<div class="err">Kesalahan memuat profil</div>';
    }
  }
};

window.onload = () => App.init();
