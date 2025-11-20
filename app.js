// =========================================================================
// KONFIGURASI PENTING - WAJIB DIUBAH
// GANTI URL INI DENGAN URL DEPLOYMENT APPS SCRIPT ANDA
// =========================================================================
const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbzqItCd_Wbep_pQP5Carx-J6_Pu3YiiLa1DxHET2yvVWBzGCw-qYq1Flox-rqfHZ8pBEw/exec'; // GANTI INI
// =========================================================================

// --- KONFIGURASI FRONTEND TAMBAHAN ---
// Poin 2: GANTI DENGAN URL LOGO PSSI YANG ANDA INGINKAN
const PSSI_LOGO_URL = 'https://upload.wikimedia.org/wikipedia/id/thumb/7/75/Logo_PSSI_2023.svg/100px-Logo_PSSI_2023.svg.png'; 
// Poin 3: Batas waktu sesi pengguna (30 * 60 * 1000 ms = 30 menit)
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; 

let currentUser = null;
const appContainer = document.getElementById('app-container');
let contentDiv;
let currentPage = 'home';
let globalValidPemain = []; 
let globalValidOfficial = []; 
let sessionTimer; // Untuk interval pemeriksaan sesi (Poin 3)

// --- CORE UTILITIES ---

function showLoading() {
    document.getElementById('loading-overlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loading-overlay').style.display = 'none';
}

function showToast(message, isSuccess = true) {
    const toast = document.getElementById('liveToast');
    const toastBody = document.getElementById('toast-body');
    
    toast.className = `toast align-items-center text-white border-0 ${isSuccess ? 'bg-success' : 'bg-danger'}`;
    toastBody.textContent = message;
    
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
}

function showConfirmationModal(message, callback) {
    const modal = document.getElementById('confirmationModal');
    document.getElementById('confirmationMessage').textContent = message;
    const confirmButton = document.getElementById('confirmActionButton');
    
    // Clear previous event listener
    const newConfirmButton = confirmButton.cloneNode(true);
    confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);
    
    newConfirmButton.onclick = () => {
        const bsModal = bootstrap.Modal.getInstance(modal);
        if (bsModal) bsModal.hide();
        callback();
    };

    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}

function showModalForm(title, bodyHtml, submitHandler, size = 'lg') {
    const modal = document.getElementById('genericModal');
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    
    const form = document.getElementById('genericForm');
    
    // Set ukuran modal (Poin 1: Lebih responsif)
    const dialog = modal.querySelector('.modal-dialog');
    dialog.className = `modal-dialog modal-dialog-centered modal-dialog-scrollable modal-${size}`;

    // Clear previous event listener
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    
    newForm.onsubmit = async (e) => {
        e.preventDefault();
        await submitHandler(e);
        const bsModal = bootstrap.Modal.getInstance(modal);
        if (bsModal) bsModal.hide();
    };

    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}

/** Fungsi universal untuk memanggil Apps Script */
async function callAppsScript(action, params = {}) {
    showLoading();
    const url = new URL(GAS_API_URL);
    url.searchParams.set('action', action);
    url.searchParams.set('user', JSON.stringify(currentUser));

    for (const key in params) {
        url.searchParams.set(key, params[key]);
    }

    try {
        const response = await fetch(url, { method: 'POST' });
        const text = await response.text();
        const result = JSON.parse(text);
        
        if (!result.success && result.message === "Akses ditolak. Mohon login.") {
            showToast("Sesi habis. Mohon login kembali.", false);
            handleLogout();
        } else if (!result.success) {
            showToast(result.message || "Terjadi kesalahan.", false);
        }
        
        return result;
    } catch (error) {
        console.error('Apps Script call error:', error);
        showToast('Kesalahan koneksi ke server.', false);
        return { success: false, message: 'Kesalahan koneksi.' };
    } finally {
        hideLoading();
    }
}

/** Helper untuk formulir CRUD generic */
async function handleGenericFormSubmit(e, apiAction, extraDataKeys = [], successCallback = null) {
    const form = e.target;
    const formData = new FormData(form);
    const data = { action: form.dataset.action };
    
    formData.forEach((value, key) => {
        data[key] = value;
    });

    extraDataKeys.forEach(key => {
        const input = document.getElementById(key);
        if (input) data[key] = input.value;
    });
    
    const result = await callAppsScript(apiAction, { data: JSON.stringify(data) });
    
    if (result && result.success) {
        showToast(result.message || 'Data berhasil disimpan!');
        if (successCallback) successCallback();
    }
}


// --- SESSION DAN LAYOUT (Poin 1, 2, 3) ---

/** Poin 3: Pemeriksaan Batas Waktu Sesi 30 Menit */
function checkSessionTimeout() {
    const loginTime = sessionStorage.getItem('loginTime');
    if (!loginTime) return false;

    const now = new Date().getTime();
    const elapsed = now - parseInt(loginTime);

    if (elapsed > SESSION_TIMEOUT_MS) {
        lockApp();
        return true;
    }
    return false;
}

/** Poin 3: Tampilkan Layar Kunci */
function lockApp() {
    if (sessionTimer) clearInterval(sessionTimer);
    
    // Hapus data sesi untuk mencegah akses langsung
    sessionStorage.removeItem('loginTime');
    sessionStorage.removeItem('currentUser');
    currentUser = null;

    // Tampilkan overlay pengunci dengan instruksi refresh/login kembali
    appContainer.innerHTML = `
        <div id="lock-screen" class="d-flex flex-column justify-content-center align-items-center bg-light" style="height: 100vh; text-align: center; padding: 20px;">
            <i class="fas fa-clock fa-5x text-warning mb-4"></i>
            <h2 class="text-danger">Waktu Akses Habis (30 Menit)</h2>
            <p class="mb-4">Untuk memberi giliran kepada pengguna lain, sesi Anda telah diakhiri.</p>
            <p class="mb-4">Harap **Refresh Halaman** atau **Login Kembali** untuk melanjutkan.</p>
            <button class="btn btn-primary" onclick="window.location.reload();">Refresh Halaman</button>
            <button class="btn btn-outline-danger mt-2" onclick="handleLogout()">Logout & Login Kembali</button>
        </div>
    `;
}

/** Poin 1 & 2: Render Navbar dan Sidebar/Bottom Nav */
function renderMainLayout() {
    if (sessionTimer) clearInterval(sessionTimer);
    if (checkSessionTimeout()) return; // Langsung kunci jika sudah timeout (Poin 3)

    // Mulai timer pemeriksaan sesi setiap 1 menit (efisien)
    sessionTimer = setInterval(checkSessionTimeout, 60000); 

    const userRole = currentUser.type_users;
    const isMobile = window.innerWidth < 768; // Deteksi perangkat seluler

    const html = `
        <nav class="navbar navbar-expand-lg navbar-dark bg-dark fixed-top">
            <div class="container-fluid">
                <a class="navbar-brand d-flex align-items-center" href="#" onclick="navigate('home')">
                    <img src="${PSSI_LOGO_URL}" alt="Logo PSSI" style="height: 30px; margin-right: 10px;">
                    <span class="d-none d-sm-inline">SIPAKEM Admin</span>
                </a>
                
                <div class="d-flex align-items-center">
                    <span class="navbar-user-info d-none d-md-inline-block">
                        <i class="fas fa-user-circle"></i> ${currentUser.username} (${userRole})
                    </span>
                    <button class="btn btn-outline-light" onclick="handleLogout()">
                        <i class="fas fa-sign-out-alt"></i> <span class="d-none d-md-inline">Logout</span>
                    </button>
                </div>
            </div>
        </nav>

        <div class="d-flex" id="wrapper">
            ${renderNavigation(userRole, isMobile)}
            
            <div id="content-wrapper" class="content">
                <div id="main-content" class="container-fluid pt-3">
                    </div>
            </div>
        </div>
        
        ${isMobile ? renderBottomNavigation(userRole) : ''}
    `;
    
    appContainer.innerHTML = html;
    contentDiv = document.getElementById('main-content');
    navigate(currentPage);
}

/** Poin 1: Fungsi untuk merender Sidebar (Desktop) atau Bottom Nav (Mobile) */
function renderNavigation(userRole, isMobile) {
    const menuItems = [
        { id: 'home', icon: 'fas fa-tachometer-alt', text: 'Dashboard', roles: ['ADMIN_PUSAT', 'ADMIN_KLUB'] },
        { id: 'profil_klub', icon: 'fas fa-shield-alt', text: 'Profil Klub', roles: ['ADMIN_KLUB'] },
        { id: 'data_pemain', icon: 'fas fa-running', text: 'Data Pemain', roles: ['ADMIN_PUSAT', 'ADMIN_KLUB'] },
        { id: 'data_official', icon: 'fas fa-users', text: 'Data Official', roles: ['ADMIN_PUSAT', 'ADMIN_KLUB'] },
        { id: 'kompetisi', icon: 'fas fa-trophy', text: 'Prakompetisi', roles: ['ADMIN_KLUB'] },
        { id: 'master_kompetisi', icon: 'fas fa-list-alt', text: 'Master Kompetisi', roles: ['ADMIN_PUSAT'] },
        { id: 'setting', icon: 'fas fa-cog', text: 'Pengaturan', roles: ['ADMIN_PUSAT'] },
    ];
    
    // Navigasi Samping (Desktop)
    let sidebarHtml = `
        <div class="sidebar d-none d-md-block" id="sidebar-wrapper">
            <div class="list-group list-group-flush pt-4">
                ${menuItems.filter(item => item.roles.includes(userRole)).map(item => `
                    <a href="#" class="list-group-item list-group-item-action list-group-item-dark ${currentPage === item.id ? 'active' : ''}" onclick="navigate('${item.id}')">
                        <i class="${item.icon} fa-fw me-2"></i> ${item.text}
                    </a>
                `).join('')}
            </div>
        </div>
    `;
    
    // Bottom Navigation hanya untuk perangkat seluler
    return sidebarHtml;
}

function renderBottomNavigation(userRole) {
    const menuItems = [
        { id: 'home', icon: 'fas fa-tachometer-alt', text: 'Dash', roles: ['ADMIN_PUSAT', 'ADMIN_KLUB'] },
        { id: 'data_pemain', icon: 'fas fa-running', text: 'Pemain', roles: ['ADMIN_PUSAT', 'ADMIN_KLUB'] },
        { id: 'data_official', icon: 'fas fa-users', text: 'Official', roles: ['ADMIN_PUSAT', 'ADMIN_KLUB'] },
    ];
    
    // Tambahkan item spesifik berdasarkan role
    if (userRole === 'ADMIN_KLUB') {
        menuItems.splice(1, 0, { id: 'profil_klub', icon: 'fas fa-shield-alt', text: 'Profil', roles: ['ADMIN_KLUB'] });
        menuItems.push({ id: 'kompetisi', icon: 'fas fa-trophy', text: 'Kompetisi', roles: ['ADMIN_KLUB'] });
    } else if (userRole === 'ADMIN_PUSAT') {
        menuItems.push({ id: 'master_kompetisi', icon: 'fas fa-list-alt', text: 'Master', roles: ['ADMIN_PUSAT'] });
    }
    
    // Batasi maksimum 5 item untuk bottom nav
    const mobileNavItems = menuItems.filter(item => item.roles.includes(userRole)).slice(0, 5);
    
    return `
        <div class="bottom-nav d-md-none">
            ${mobileNavItems.map(item => `
                <a href="#" class="bottom-nav-link ${currentPage === item.id ? 'active' : ''}" onclick="navigate('${item.id}')">
                    <i class="${item.icon}"></i>
                    <span>${item.text}</span>
                </a>
            `).join('')}
        </div>
    `;
}

function navigate(page) {
    if (checkSessionTimeout()) return; // Cek timeout sebelum navigasi (Poin 3)
    
    currentPage = page;
    const sidebar = document.getElementById('sidebar-wrapper');
    if (sidebar) {
        // Update active class for sidebar
        sidebar.querySelectorAll('.list-group-item').forEach(el => el.classList.remove('active'));
        const activeLink = sidebar.querySelector(`[onclick="navigate('${page}')"]`);
        if (activeLink) activeLink.classList.add('active');
    }
    
    const bottomNav = document.querySelector('.bottom-nav');
     if (bottomNav) {
        // Update active class for bottom nav
        bottomNav.querySelectorAll('.bottom-nav-link').forEach(el => el.classList.remove('active'));
        const activeLink = bottomNav.querySelector(`[onclick="navigate('${page}')"]`);
        if (activeLink) activeLink.classList.add('active');
    }

    // Panggil fungsi render halaman yang sesuai
    switch(page) {
        case 'home': loadDashboard(); break;
        case 'profil_klub': loadProfilKlub(); break;
        case 'data_pemain': loadDataPemain(); break;
        case 'data_official': loadDataOfficial(); break;
        case 'kompetisi': loadKompetisiPage(); break;
        case 'master_kompetisi': loadMasterKompetisi(); break;
        case 'setting': loadSettingPage(); break;
        default: loadDashboard();
    }
}

// --- FUNGSI LOGIN & LOGOUT ---

function renderLoginPage(message = '') {
    // Hapus timer jika ada
    if (sessionTimer) clearInterval(sessionTimer); 
    
    appContainer.className = 'login-page-container';
    appContainer.innerHTML = `
        <div id="login-form">
            <div class="text-center mb-4">
                <img src="${PSSI_LOGO_URL}" alt="Logo PSSI" style="height: 60px;">
                <h4 class="mt-2">SIPAKEM</h4>
                <p class="text-muted small">Sistem Informasi PSSI Kepululauan Mentawai</p>
            </div>
            <h5 class="card-title text-center mb-4">Login Admin</h5>
            ${message ? `<div class="alert alert-danger small">${message}</div>` : ''}
            <form id="loginForm" onsubmit="handleLogin(event)">
                <div class="mb-3">
                    <label for="username" class="form-label">Username</label>
                    <input type="text" class="form-control" id="username" name="username" required>
                </div>
                <div class="mb-3">
                    <label for="password" class="form-label">Password</label>
                    <input type="password" class="form-control" id="password" name="password" required>
                </div>
                <button type="submit" class="btn btn-primary w-100">Login</button>
            </form>
        </div>
    `;
}

async function handleLogin(e) {
    e.preventDefault();
    const form = document.getElementById('loginForm');
    const formData = new FormData(form);
    
    const result = await callAppsScript('CHECK_AUTH', {
        username: formData.get('username'),
        password: formData.get('password')
    });

    if (result && result.success) {
        currentUser = result.user;
        // Poin 3: Simpan waktu login ke sessionStorage
        sessionStorage.setItem('loginTime', new Date().getTime().toString());
        sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
        appContainer.className = '';
        renderMainLayout();
        showToast(`Selamat datang, ${currentUser.username}!`);
    } else {
        renderLoginPage(result.message || 'Login gagal. Cek username dan password Anda.');
    }
}

function handleLogout() {
    currentUser = null;
    sessionStorage.clear();
    if (sessionTimer) clearInterval(sessionTimer); // Hentikan timer (Poin 3)
    renderLoginPage('Anda telah berhasil logout.');
}

// --- FUNGSI LOAD HALAMAN ---

// Poin 1: Sesuaikan Halaman Dashboard untuk Mobile
async function loadDashboard() {
    contentDiv.innerHTML = `
        <h2 class="mb-4 d-flex justify-content-between align-items-center">
            Dashboard
            <span class="badge bg-primary fs-6">${currentUser.type_users.replace('_', ' ')}</span>
        </h2>
        
        <div class="row row-cols-1 row-cols-md-2 row-cols-lg-4 g-3 mb-4" id="dashboard-stats">
            </div>
        
        <div class="card mb-4 shadow-sm">
            <div class="card-header bg-primary text-white">Informasi Klub Anda</div>
            <div class="card-body" id="klub-info-dashboard">
                <p class="text-center text-muted">Memuat...</p>
            </div>
        </div>

        <div class="card shadow-sm">
            <div class="card-header bg-info text-white">Banner dan Pengumuman</div>
            <div class="card-body" id="banner-area">
                 <div class="text-center text-muted">Memuat...</div>
            </div>
        </div>
    `;

    loadDashboardStats();
    loadKlubInfoDashboard();
    loadBannerArea();
}

async function loadDashboardStats() {
    // Dummy stats for demonstration, replace with actual data calls if needed
    const statsDiv = document.getElementById('dashboard-stats');
    
    const stats = [
        { title: "Total Klub", value: "25", icon: "fas fa-shield-alt", color: "bg-success" },
        { title: "Pemain Terdaftar", value: "450", icon: "fas fa-running", color: "bg-primary" },
        { title: "Official Terdaftar", value: "100", icon: "fas fa-users", color: "bg-warning" },
        { title: "Kompetisi Aktif", value: "3", icon: "fas fa-trophy", color: "bg-danger" },
    ];

    statsDiv.innerHTML = stats.map(stat => `
        <div class="col">
            <div class="card h-100 ${stat.color} text-white shadow-sm">
                <div class="card-body d-flex flex-column">
                    <div class="d-flex justify-content-between align-items-center">
                        <h5 class="card-title mb-0">${stat.title}</h5>
                        <i class="${stat.icon} fa-2x opacity-50"></i>
                    </div>
                    <h2 class="mt-auto mb-0">${stat.value}</h2>
                </div>
            </div>
        </div>
    `).join('');
}

async function loadKlubInfoDashboard() {
    const infoDiv = document.getElementById('klub-info-dashboard');
    if (currentUser.type_users === 'ADMIN_KLUB') {
        const result = await callAppsScript('GET_PROFIL_KLUB');
        if (result && result.success) {
            const profil = result.data;
            infoDiv.innerHTML = `
                <dl class="row small">
                    <dt class="col-sm-4">ID Klub:</dt><dd class="col-sm-8">${profil.id_klub || '-'}</dd>
                    <dt class="col-sm-4">Nama Klub:</dt><dd class="col-sm-8">${profil.nama_klub || '-'}</dd>
                    <dt class="col-sm-4">Nama Manajer:</dt><dd class="col-sm-8">${profil.nama_manajer || '-'}</dd>
                    <dt class="col-sm-4">Alamat Sekretariat:</dt><dd class="col-sm-8">${profil.alamat_sekretariat || '-'}</dd>
                    <dt class="col-sm-4">Logo Klub:</dt><dd class="col-sm-8">${profil.url_logo ? `<img src="${profil.url_logo}" style="height: 50px;">` : '-'}</dd>
                </dl>
            `;
        } else {
             infoDiv.innerHTML = `<div class="alert alert-warning small">Profil klub belum terdaftar. Harap lengkapi di halaman "Profil Klub".</div>`;
        }
    } else {
        infoDiv.innerHTML = `<p>Anda login sebagai **ADMIN PUSAT**. Gunakan menu lain untuk melihat data klub.</p>`;
    }
}

async function loadBannerArea() {
    const bannerDiv = document.getElementById('banner-area');
    const result = await callAppsScript('GET_BANNERS');
    
    if (result && result.success && result.data) {
        const data = result.data;
        // Ambil 3 banner yang mungkin terisi
        const banners = [data.url_banner1, data.url_banner2, data.url_banner3].filter(url => url && url.trim() !== '');

        if (banners.length > 0) {
            bannerDiv.innerHTML = `
                <div id="bannerCarousel" class="carousel slide" data-bs-ride="carousel">
                    <div class="carousel-inner">
                        ${banners.map((url, index) => `
                            <div class="carousel-item ${index === 0 ? 'active' : ''}">
                                <img src="${url}" class="d-block w-100 rounded" alt="Banner ${index + 1}" style="max-height: 250px; object-fit: cover;">
                            </div>
                        `).join('')}
                    </div>
                    ${banners.length > 1 ? `
                    <button class="carousel-control-prev" type="button" data-bs-target="#bannerCarousel" data-bs-slide="prev">
                        <span class="carousel-control-prev-icon" aria-hidden="true"></span>
                        <span class="visually-hidden">Previous</span>
                    </button>
                    <button class="carousel-control-next" type="button" data-bs-target="#bannerCarousel" data-bs-slide="next">
                        <span class="carousel-control-next-icon" aria-hidden="true"></span>
                        <span class="visually-hidden">Next</span>
                    </button>
                    ` : ''}
                </div>
            `;
            new bootstrap.Carousel(document.getElementById('bannerCarousel'), {
                interval: 5000,
                ride: 'carousel'
            });
        } else {
            bannerDiv.innerHTML = `<p class="text-center text-muted small">Belum ada banner yang diatur oleh Admin Pusat.</p>`;
        }
    } else {
        bannerDiv.innerHTML = `<p class="text-center text-danger small">Gagal memuat data banner.</p>`;
    }
}

// --- FUNGSI PROFIL KLUB ---

async function loadProfilKlub() {
    contentDiv.innerHTML = `
        <h2 class="mb-4">Profil Klub</h2>
        <div class="card shadow-sm">
            <div class="card-header bg-info text-white">Data Klub Anda</div>
            <div class="card-body" id="profil-klub-content">
                <p class="text-center text-muted">Memuat...</p>
            </div>
        </div>
    `;

    const content = document.getElementById('profil-klub-content');
    const result = await callAppsScript('GET_PROFIL_KLUB');

    if (result && result.success) {
        const profil = Array.isArray(result.data) ? {} : result.data; // Pastikan bukan array kosong
        
        // Poin 1: Form Profil Klub yang Responsif
        content.innerHTML = `
            <form id="profilKlubForm" data-action="${profil.id_klub ? 'UPDATE' : 'CREATE'}" onsubmit="handleProfilKlubFormSubmit(event)">
                <input type="hidden" name="id_klub" value="${currentUser.id_klub}">
                
                <div class="row g-3">
                    <div class="col-md-6">
                        <label for="nama_klub" class="form-label">Nama Klub <span class="text-danger">*</span></label>
                        <input type="text" class="form-control" id="nama_klub" name="nama_klub" value="${profil.nama_klub || ''}" required>
                    </div>
                    <div class="col-md-6">
                        <label for="nama_manajer" class="form-label">Nama Manajer <span class="text-danger">*</span></label>
                        <input type="text" class="form-control" id="nama_manajer" name="nama_manajer" value="${profil.nama_manajer || ''}" required>
                    </div>
                    <div class="col-12">
                        <label for="alamat_sekretariat" class="form-label">Alamat Sekretariat</label>
                        <textarea class="form-control" id="alamat_sekretariat" name="alamat_sekretariat">${profil.alamat_sekretariat || ''}</textarea>
                    </div>
                    <div class="col-md-6">
                        <label for="email" class="form-label">Email Klub</label>
                        <input type="email" class="form-control" id="email" name="email" value="${profil.email || ''}">
                    </div>
                    <div class="col-md-6">
                        <label for="telepon" class="form-label">Telepon Klub</label>
                        <input type="text" class="form-control" id="telepon" name="telepon" value="${profil.telepon || ''}">
                    </div>
                    <div class="col-md-6">
                        <label for="logo_klub" class="form-label">Logo Klub (JPG/PNG)</label>
                        <input type="file" class="form-control" id="logo_klub_file" accept=".jpg,.jpeg,.png">
                        <input type="hidden" id="url_logo" name="url_logo" value="${profil.url_logo || ''}">
                        <small class="text-muted">Max 500KB. Abaikan jika tidak diubah.</small>
                    </div>
                    <div class="col-md-6 text-center d-flex justify-content-center align-items-center">
                        ${profil.url_logo ? `<img id="current_logo" src="${profil.url_logo}" alt="Logo Klub" style="max-height: 100px; max-width: 100%; border: 1px solid #ccc; padding: 5px;">` : '<p class="text-muted">Belum ada logo terupload</p>'}
                    </div>
                    <div class="col-12 mt-4">
                        <button type="submit" class="btn btn-primary w-100"><i class="fas fa-save me-2"></i> Simpan Profil</button>
                    </div>
                </div>
            </form>
        `;
    } else {
        content.innerHTML = `<div class="alert alert-danger">${result.message || 'Gagal memuat profil klub.'}</div>`;
    }
}

async function handleProfilKlubFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const data = { action: form.dataset.action };
    
    // Ambil data non-file
    new FormData(form).forEach((value, key) => {
        data[key] = value;
    });

    const fileInput = document.getElementById('logo_klub_file');
    const file = fileInput.files[0];

    // Cek dan Upload File jika ada
    if (file) {
        if (file.size > 500 * 1024) { // Max 500 KB
             return showToast("Ukuran file logo terlalu besar (Max 500KB).", false);
        }
        
        const base64Data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        const uploadResult = await callAppsScript('UPLOAD_IMAGE', { base64Data: base64Data });
        if (uploadResult && uploadResult.success) {
            data.url_logo = uploadResult.url; // Update URL logo baru
        } else {
            return showToast(uploadResult.message || 'Gagal mengupload logo.', false);
        }
    }

    // Panggil API CRUD
    const result = await callAppsScript('CRUD_PROFIL_KLUB', { data: JSON.stringify(data) });
    
    if (result && result.success) {
        showToast(result.message || 'Profil berhasil disimpan!');
        loadProfilKlub(); // Reload halaman
    }
}

// --- FUNGSI DATA PEMAIN ---

async function loadDataPemain() {
    contentDiv.innerHTML = `
        <h2 class="mb-4">Data Pemain</h2>
        <div class="d-flex justify-content-end mb-3">
            <button class="btn btn-success btn-sm" onclick="showPemainForm()"><i class="fas fa-plus me-1"></i> Tambah Pemain</button>
        </div>
        <div class="table-responsive">
            <table id="pemainTable" class="table table-striped table-bordered w-100 table-sm small">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>ID Pemain</th>
                        <th>Klub</th>
                        <th>Nama</th>
                        <th>Posisi</th>
                        <th>No. Punggung</th>
                        <th>Tgl. Lahir</th>
                        <th>Aksi</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        </div>
    `;

    const result = await callAppsScript('GET_PEMAIN');
    if (result && result.success) {
        const table = $('#pemainTable').DataTable({
            data: result.data,
            columns: [
                { data: null, render: (data, type, row, meta) => meta.row + 1 },
                { data: 'id_pemain' },
                { data: 'id_klub' },
                { data: 'nama_pemain' },
                { data: 'posisi' },
                { data: 'no_punggung' },
                { data: 'tanggal_lahir' },
                { 
                    data: null, 
                    render: (data, type, row) => `
                        <button class="btn btn-sm btn-info me-1" onclick="showPemainForm(${JSON.stringify(row).replace(/"/g, '&quot;')})"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-danger" onclick="confirmDeletePemain('${row.id_pemain}')"><i class="fas fa-trash"></i></button>
                    `,
                    orderable: false
                }
            ],
            // Poin 1: Sesuaikan DataTable untuk Mobile
            responsive: true,
            columnDefs: [
                { responsivePriority: 1, targets: 0 },
                { responsivePriority: 2, targets: 3 },
                { responsivePriority: 3, targets: -1 }
            ],
            destroy: true
        });
    }
}

function showPemainForm(data = {}) {
    const isNew = !data.id_pemain;
    const required = isNew ? 'required' : '';
    const dateValue = data.tanggal_lahir ? new Date(data.tanggal_lahir).toISOString().split('T')[0] : '';

    const formHtml = `
        <form id="genericForm" data-action="${isNew ? 'CREATE' : 'UPDATE'}" class="row g-3">
            <input type="hidden" name="id_pemain" value="${data.id_pemain || ''}">

            <div class="col-md-6">
                <label for="id_pemain_display" class="form-label">ID Pemain (16 Digit Angka) <span class="text-danger">*</span></label>
                <input type="number" class="form-control" id="id_pemain_display" name="id_pemain" value="${data.id_pemain || ''}" ${isNew ? required : 'disabled'} maxlength="16" minlength="16">
            </div>

            <div class="col-md-6">
                <label for="nama_pemain" class="form-label">Nama Pemain <span class="text-danger">*</span></label>
                <input type="text" class="form-control" id="nama_pemain" name="nama_pemain" value="${data.nama_pemain || ''}" required>
            </div>

            <div class="col-md-6">
                <label for="tanggal_lahir" class="form-label">Tanggal Lahir <span class="text-danger">*</span></label>
                <input type="date" class="form-control" id="tanggal_lahir" name="tanggal_lahir" value="${dateValue}" required>
            </div>

            <div class="col-md-6">
                <label for="posisi" class="form-label">Posisi <span class="text-danger">*</span></label>
                <select class="form-select" id="posisi" name="posisi" required>
                    <option value="">Pilih Posisi</option>
                    ${['GK', 'CB', 'LB', 'RB', 'CM', 'DM', 'AM', 'LW', 'RW', 'ST'].map(p => `<option value="${p}" ${data.posisi === p ? 'selected' : ''}>${p}</option>`).join('')}
                </select>
            </div>
            
            <div class="col-md-6">
                <label for="no_punggung" class="form-label">No. Punggung <span class="text-danger">*</span></label>
                <input type="number" class="form-control" id="no_punggung" name="no_punggung" value="${data.no_punggung || ''}" required min="1" max="99">
            </div>

            <div class="col-md-6">
                <label for="url_foto_pemain" class="form-label">Foto Pemain (Opsional)</label>
                <input type="text" class="form-control" id="url_foto_pemain" name="url_foto_pemain" value="${data.url_foto_pemain || ''}">
            </div>
        </form>
    `;

    showModalForm(`${isNew ? 'Tambah' : 'Edit'} Data Pemain`, formHtml, handlePemainFormSubmit, 'lg');
}

async function handlePemainFormSubmit(e) {
    await handleGenericFormSubmit(e, 'CRUD_PEMAIN', [], loadDataPemain);
}

function confirmDeletePemain(id_pemain) {
    showConfirmationModal(`Apakah Anda yakin ingin menghapus Pemain ID ${id_pemain}?`, async () => {
        const data = { action: 'DELETE', id_pemain: id_pemain };
        const result = await callAppsScript('CRUD_PEMAIN', { data: JSON.stringify(data) });
        
        if (result && result.success) {
            showToast(result.message || 'Data Pemain berhasil dihapus.');
            loadDataPemain();
        }
    });
}

// --- FUNGSI DATA OFFICIAL (Mirip Pemain) ---

async function loadDataOfficial() {
    contentDiv.innerHTML = `
        <h2 class="mb-4">Data Official</h2>
        <div class="d-flex justify-content-end mb-3">
            <button class="btn btn-success btn-sm" onclick="showOfficialForm()"><i class="fas fa-plus me-1"></i> Tambah Official</button>
        </div>
        <div class="table-responsive">
            <table id="officialTable" class="table table-striped table-bordered w-100 table-sm small">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>ID Official</th>
                        <th>Klub</th>
                        <th>Nama</th>
                        <th>Jabatan</th>
                        <th>Tgl. Lahir</th>
                        <th>Aksi</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        </div>
    `;

    const result = await callAppsScript('GET_OFFICIAL');
    if (result && result.success) {
        const table = $('#officialTable').DataTable({
            data: result.data,
            columns: [
                { data: null, render: (data, type, row, meta) => meta.row + 1 },
                { data: 'id_official' },
                { data: 'id_klub' },
                { data: 'nama_official' },
                { data: 'jabatan' },
                { data: 'tanggal_lahir' },
                { 
                    data: null, 
                    render: (data, type, row) => `
                        <button class="btn btn-sm btn-info me-1" onclick="showOfficialForm(${JSON.stringify(row).replace(/"/g, '&quot;')})"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-danger" onclick="confirmDeleteOfficial('${row.id_official}')"><i class="fas fa-trash"></i></button>
                    `,
                    orderable: false
                }
            ],
            // Poin 1: Sesuaikan DataTable untuk Mobile
            responsive: true,
            columnDefs: [
                { responsivePriority: 1, targets: 0 },
                { responsivePriority: 2, targets: 3 },
                { responsivePriority: 3, targets: -1 }
            ],
            destroy: true
        });
    }
}

function showOfficialForm(data = {}) {
    const isNew = !data.id_official;
    const required = isNew ? 'required' : '';
    const dateValue = data.tanggal_lahir ? new Date(data.tanggal_lahir).toISOString().split('T')[0] : '';
    const jabatanOptions = ['Pelatih Kepala', 'Asisten Pelatih', 'Manager', 'Dokter', 'Fisioterapi', 'Kitman', 'Lainnya'];

    const formHtml = `
        <form id="genericForm" data-action="${isNew ? 'CREATE' : 'UPDATE'}" class="row g-3">
            <input type="hidden" name="id_official" value="${data.id_official || ''}">

            <div class="col-md-6">
                <label for="id_official_display" class="form-label">ID Official (16 Digit Angka) <span class="text-danger">*</span></label>
                <input type="number" class="form-control" id="id_official_display" name="id_official" value="${data.id_official || ''}" ${isNew ? required : 'disabled'} maxlength="16" minlength="16">
            </div>

            <div class="col-md-6">
                <label for="nama_official" class="form-label">Nama Official <span class="text-danger">*</span></label>
                <input type="text" class="form-control" id="nama_official" name="nama_official" value="${data.nama_official || ''}" required>
            </div>

            <div class="col-md-6">
                <label for="tanggal_lahir" class="form-label">Tanggal Lahir <span class="text-danger">*</span></label>
                <input type="date" class="form-control" id="tanggal_lahir" name="tanggal_lahir" value="${dateValue}" required>
            </div>

            <div class="col-md-6">
                <label for="jabatan" class="form-label">Jabatan <span class="text-danger">*</span></label>
                <select class="form-select" id="jabatan" name="jabatan" required>
                    <option value="">Pilih Jabatan</option>
                    ${jabatanOptions.map(j => `<option value="${j}" ${data.jabatan === j ? 'selected' : ''}>${j}</option>`).join('')}
                </select>
            </div>

            <div class="col-12">
                <label for="url_foto_official" class="form-label">Foto Official (Opsional)</label>
                <input type="text" class="form-control" id="url_foto_official" name="url_foto_official" value="${data.url_foto_official || ''}">
            </div>
        </form>
    `;

    showModalForm(`${isNew ? 'Tambah' : 'Edit'} Data Official`, formHtml, handleOfficialFormSubmit, 'lg');
}

async function handleOfficialFormSubmit(e) {
    await handleGenericFormSubmit(e, 'CRUD_OFFICIAL', [], loadDataOfficial);
}

function confirmDeleteOfficial(id_official) {
    showConfirmationModal(`Apakah Anda yakin ingin menghapus Official ID ${id_official}?`, async () => {
        const data = { action: 'DELETE', id_official: id_official };
        const result = await callAppsScript('CRUD_OFFICIAL', { data: JSON.stringify(data) });
        
        if (result && result.success) {
            showToast(result.message || 'Data Official berhasil dihapus.');
            loadDataOfficial();
        }
    });
}

// --- FUNGSI MASTER KOMPETISI (ADMIN PUSAT) ---

async function loadMasterKompetisi() {
    if (currentUser.type_users !== 'ADMIN_PUSAT') return loadDashboard();
    
    contentDiv.innerHTML = `
        <h2 class="mb-4">Master Data Kompetisi</h2>
        <div class="d-flex justify-content-end mb-3">
            <button class="btn btn-success btn-sm" onclick="showKompetisiForm()"><i class="fas fa-plus me-1"></i> Tambah Kompetisi</button>
        </div>
        <div class="table-responsive">
            <table id="kompetisiTable" class="table table-striped table-bordered w-100 table-sm small">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>ID Kompetisi</th>
                        <th>Nama Kompetisi</th>
                        <th>Umur Maksimal (U)</th>
                        <th>Status</th>
                        <th>Aksi</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        </div>
    `;

    const result = await callAppsScript('GET_LIST_KOMPETISI');
    if (result && result.success) {
        const table = $('#kompetisiTable').DataTable({
            data: result.data,
            columns: [
                { data: null, render: (data, type, row, meta) => meta.row + 1 },
                { data: 'id_kompetisi' },
                { data: 'nama_kompetisi' },
                { data: 'umur_maksimal', render: (data) => `U-${data}` },
                { data: 'status', render: (data) => `<span class="badge ${data === 'Aktif' ? 'bg-success' : 'bg-secondary'}">${data}</span>` },
                { 
                    data: null, 
                    render: (data, type, row) => `
                        <button class="btn btn-sm btn-info me-1" onclick="showKompetisiForm(${JSON.stringify(row).replace(/"/g, '&quot;')})"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-danger" onclick="confirmDeleteKompetisi('${row.id_kompetisi}')"><i class="fas fa-trash"></i></button>
                    `,
                    orderable: false
                }
            ],
            // Poin 1: Sesuaikan DataTable untuk Mobile
            responsive: true,
            columnDefs: [
                { responsivePriority: 1, targets: 0 },
                { responsivePriority: 2, targets: 2 },
                { responsivePriority: 3, targets: -1 }
            ],
            destroy: true
        });
    }
}

function showKompetisiForm(data = {}) {
    const isNew = !data.id_kompetisi;
    
    const formHtml = `
        <form id="genericForm" data-action="${isNew ? 'CREATE' : 'UPDATE'}" class="row g-3">
            <input type="hidden" name="id_kompetisi" value="${data.id_kompetisi || ''}">

            <div class="col-md-6">
                <label for="nama_kompetisi" class="form-label">Nama Kompetisi <span class="text-danger">*</span></label>
                <input type="text" class="form-control" id="nama_kompetisi" name="nama_kompetisi" value="${data.nama_kompetisi || ''}" required>
            </div>
            <div class="col-md-6">
                <label for="umur_maksimal" class="form-label">Umur Maksimal (U) <span class="text-danger">*</span></label>
                <input type="number" class="form-control" id="umur_maksimal" name="umur_maksimal" value="${data.umur_maksimal || ''}" required min="10" max="25">
            </div>
            <div class="col-md-6">
                <label for="status" class="form-label">Status Kompetisi</label>
                <select class="form-select" id="status" name="status" required>
                    <option value="Aktif" ${data.status === 'Aktif' ? 'selected' : ''}>Aktif</option>
                    <option value="Tidak Aktif" ${data.status === 'Tidak Aktif' ? 'selected' : ''}>Tidak Aktif</option>
                </select>
            </div>
        </form>
    `;

    showModalForm(`${isNew ? 'Tambah' : 'Edit'} Kompetisi`, formHtml, handleKompetisiFormSubmit, 'md');
}

async function handleKompetisiFormSubmit(e) {
    await handleGenericFormSubmit(e, 'CRUD_LIST_KOMPETISI', [], loadMasterKompetisi);
}

function confirmDeleteKompetisi(id_kompetisi) {
    showConfirmationModal(`Apakah Anda yakin ingin menghapus Kompetisi ID ${id_kompetisi}?`, async () => {
        const data = { action: 'DELETE', id_kompetisi: id_kompetisi };
        const result = await callAppsScript('CRUD_LIST_KOMPETISI', { data: JSON.stringify(data) });
        
        if (result && result.success) {
            showToast(result.message || 'Data Kompetisi berhasil dihapus.');
            loadMasterKompetisi();
        }
    });
}

// --- FUNGSI PRAKOMPETISI KLUB (ADMIN KLUB) ---

async function loadKompetisiPage() {
    if (currentUser.type_users !== 'ADMIN_KLUB') return loadDashboard();
    
    contentDiv.innerHTML = `
        <h2 class="mb-4">Prakompetisi Klub</h2>
        <div class="card shadow-sm mb-4">
            <div class="card-body">
                <label for="selectKompetisi" class="form-label">Pilih Kompetisi:</label>
                <select class="form-select" id="selectKompetisi" onchange="loadKompetisiDetails(this.value)">
                    <option value="">-- Pilih Kompetisi Aktif --</option>
                </select>
            </div>
        </div>

        <div id="kompetisi-details" class="mt-4">
            <p class="text-center text-muted">Pilih kompetisi untuk melihat detail dan melakukan pendaftaran.</p>
        </div>
    `;

    const select = document.getElementById('selectKompetisi');
    const result = await callAppsScript('GET_LIST_KOMPETISI');

    if (result && result.success) {
        const activeKompetisi = result.data.filter(k => k.status === 'Aktif');
        activeKompetisi.forEach(k => {
            select.innerHTML += `<option value="${k.id_kompetisi}" data-name="${k.nama_kompetisi}" data-umur="${k.umur_maksimal}">${k.nama_kompetisi} (U-${k.umur_maksimal})</option>`;
        });
    }
}

async function loadKompetisiDetails(idKompetisi) {
    const detailsDiv = document.getElementById('kompetisi-details');
    if (!idKompetisi) {
        detailsDiv.innerHTML = `<p class="text-center text-muted">Pilih kompetisi untuk melihat detail dan melakukan pendaftaran.</p>`;
        return;
    }
    
    const select = document.getElementById('selectKompetisi');
    const namaKompetisi = select.options[select.selectedIndex].getAttribute('data-name');
    const umurMaksimal = select.options[select.selectedIndex].getAttribute('data-umur');
    
    detailsDiv.innerHTML = `
        <h3>${namaKompetisi} (U-${umurMaksimal})</h3>
        <p class="text-muted small">ID Kompetisi: ${idKompetisi}</p>
        
        <div class="row g-3">
            <div class="col-lg-6">
                <div class="card shadow-sm h-100">
                    <div class="card-header bg-success text-white">
                        <i class="fas fa-users me-2"></i> Pendaftaran Pemain
                    </div>
                    <div class="card-body" id="pemain-prakompetisi-area">
                        <p class="text-center text-muted">Memuat data pemain...</p>
                    </div>
                </div>
            </div>
            <div class="col-lg-6">
                <div class="card shadow-sm h-100">
                    <div class="card-header bg-info text-white">
                        <i class="fas fa-id-card me-2"></i> Pendaftaran Official
                    </div>
                    <div class="card-body" id="official-prakompetisi-area">
                        <p class="text-center text-muted">Memuat data official...</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    loadPemainPrakompetisi(idKompetisi, umurMaksimal);
    loadOfficialPrakompetisi(idKompetisi);
}

async function loadPemainPrakompetisi(idKompetisi, umurMaksimal) {
    const area = document.getElementById('pemain-prakompetisi-area');
    
    const [resultAll, resultRegistered] = await Promise.all([
        callAppsScript('GET_FILTERED_PEMAIN', { id_kompetisi: idKompetisi }),
        callAppsScript('GET_REGISTERED_PEMAIN', { id_kompetisi: idKompetisi })
    ]);

    if (!resultAll.success || !resultRegistered.success) {
        area.innerHTML = `<div class="alert alert-danger">Gagal memuat data: ${resultAll.message || resultRegistered.message}</div>`;
        return;
    }
    
    globalValidPemain = resultAll.data.filter(p => p.id_klub === currentUser.id_klub);
    const registeredPemainIds = resultRegistered.data.map(p => p.id_pemain);

    if (globalValidPemain.length === 0) {
        area.innerHTML = `<div class="alert alert-warning small">Tidak ada data pemain klub Anda yang memenuhi batas usia U-${umurMaksimal} atau belum mendaftarkan pemain.</div>`;
        return;
    }

    area.innerHTML = `
        <form id="pemainPrakompetisiForm" onsubmit="handlePemainPrakompetisiSubmit(event, '${idKompetisi}')">
            <p class="small text-muted">Pilih maksimal 25 pemain yang memenuhi batas usia U-${umurMaksimal} klub Anda.</p>
            <div style="max-height: 350px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; border-radius: 5px;" class="mb-3">
                ${globalValidPemain.map(p => `
                    <div class="form-check small">
                        <input class="form-check-input" type="checkbox" value="${p.id_pemain}" id="pemain_${p.id_pemain}" 
                            data-nama="${p.nama_pemain}" data-posisi="${p.posisi}" data-nopung="${p.no_punggung}"
                            ${registeredPemainIds.includes(p.id_pemain) ? 'checked' : ''}>
                        <label class="form-check-label" for="pemain_${p.id_pemain}">
                            (${p.no_punggung}) **${p.nama_pemain}** - ${p.posisi} (ID: ${p.id_pemain})
                        </label>
                    </div>
                `).join('')}
            </div>
            <p class="text-danger small" id="pemain-count-warning"></p>
            <button type="submit" class="btn btn-primary w-100"><i class="fas fa-save me-2"></i> Simpan Pilihan Pemain</button>
        </form>
    `;
    
    document.getElementById('pemainPrakompetisiForm').addEventListener('change', checkPemainCount);
    checkPemainCount();
}

function checkPemainCount() {
    const form = document.getElementById('pemainPrakompetisiForm');
    const checked = form.querySelectorAll('input[type="checkbox"]:checked').length;
    const warningDiv = document.getElementById('pemain-count-warning');
    const submitBtn = form.querySelector('button[type="submit"]');

    if (checked > 25) {
        warningDiv.textContent = `Peringatan: Maksimal 25 pemain dipilih. Anda memilih ${checked}.`;
        submitBtn.disabled = true;
    } else {
        warningDiv.textContent = `Dipilih: ${checked} dari maks. 25 pemain.`;
        submitBtn.disabled = false;
    }
}

async function handlePemainPrakompetisiSubmit(e, idKompetisi) {
    e.preventDefault();
    const form = e.target;
    const checkedBoxes = form.querySelectorAll('input[type="checkbox"]:checked');
    
    if (checkedBoxes.length > 25) {
        return showToast("Pendaftaran pemain melebihi batas maksimal (25).", false);
    }
    
    const entries = Array.from(checkedBoxes).map(box => {
        const id_pemain = box.value;
        const pemain = globalValidPemain.find(p => p.id_pemain === id_pemain);
        return {
            id_pemain: id_pemain,
            nama_pemain: pemain.nama_pemain,
            posisi: pemain.posisi,
            no_punggung: pemain.no_punggung
        };
    });

    const result = await callAppsScript('SAVE_PEMAIN_PRAKOMPETISI', {
        id_kompetisi: idKompetisi,
        entries: JSON.stringify(entries)
    });

    if (result && result.success) {
        showToast(result.message);
    }
}

async function loadOfficialPrakompetisi(idKompetisi) {
    const area = document.getElementById('official-prakompetisi-area');
    
    const [resultAll, resultRegistered] = await Promise.all([
        callAppsScript('GET_OFFICIAL'),
        callAppsScript('GET_REGISTERED_OFFICIAL', { id_kompetisi: idKompetisi })
    ]);

    if (!resultAll.success || !resultRegistered.success) {
        area.innerHTML = `<div class="alert alert-danger">Gagal memuat data: ${resultAll.message || resultRegistered.message}</div>`;
        return;
    }
    
    globalValidOfficial = resultAll.data.filter(o => o.id_klub === currentUser.id_klub);
    const registeredOfficialIds = resultRegistered.data.map(o => o.id_official);

    if (globalValidOfficial.length === 0) {
        area.innerHTML = `<div class="alert alert-warning small">Belum mendaftarkan official. Harap daftarkan di menu "Data Official".</div>`;
        return;
    }

    area.innerHTML = `
        <form id="officialPrakompetisiForm" onsubmit="handleOfficialPrakompetisiSubmit(event, '${idKompetisi}')">
            <p class="small text-muted">Pilih maksimal 10 official klub Anda.</p>
            <div style="max-height: 350px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; border-radius: 5px;" class="mb-3">
                ${globalValidOfficial.map(o => `
                    <div class="form-check small">
                        <input class="form-check-input" type="checkbox" value="${o.id_official}" id="official_${o.id_official}" 
                            data-nama="${o.nama_official}" data-jabatan="${o.jabatan}"
                            ${registeredOfficialIds.includes(o.id_official) ? 'checked' : ''}>
                        <label class="form-check-label" for="official_${o.id_official}">
                            **${o.nama_official}** - ${o.jabatan} (ID: ${o.id_official})
                        </label>
                    </div>
                `).join('')}
            </div>
            <p class="text-danger small" id="official-count-warning"></p>
            <button type="submit" class="btn btn-primary w-100"><i class="fas fa-save me-2"></i> Simpan Pilihan Official</button>
        </form>
    `;

    document.getElementById('officialPrakompetisiForm').addEventListener('change', checkOfficialCount);
    checkOfficialCount();
}

function checkOfficialCount() {
    const form = document.getElementById('officialPrakompetisiForm');
    const checked = form.querySelectorAll('input[type="checkbox"]:checked').length;
    const warningDiv = document.getElementById('official-count-warning');
    const submitBtn = form.querySelector('button[type="submit"]');

    if (checked > 10) {
        warningDiv.textContent = `Peringatan: Maksimal 10 official dipilih. Anda memilih ${checked}.`;
        submitBtn.disabled = true;
    } else {
        warningDiv.textContent = `Dipilih: ${checked} dari maks. 10 official.`;
        submitBtn.disabled = false;
    }
}

async function handleOfficialPrakompetisiSubmit(e, idKompetisi) {
    e.preventDefault();
    const form = e.target;
    const checkedBoxes = form.querySelectorAll('input[type="checkbox"]:checked');
    
    if (checkedBoxes.length > 10) {
        return showToast("Pendaftaran official melebihi batas maksimal (10).", false);
    }
    
    const entries = Array.from(checkedBoxes).map(box => {
        const id_official = box.value;
        const official = globalValidOfficial.find(o => o.id_official === id_official);
        return {
            id_official: id_official,
            nama_official: official.nama_official,
            jabatan: official.jabatan
        };
    });

    const result = await callAppsScript('SAVE_OFFICIAL_PRAKOMPETISI', {
        id_kompetisi: idKompetisi,
        entries: JSON.stringify(entries)
    });

    if (result && result.success) {
        showToast(result.message);
    }
}

// --- FUNGSI PENGATURAN (ADMIN PUSAT) ---

async function loadSettingPage() {
    if (currentUser.type_users !== 'ADMIN_PUSAT') return loadDashboard();
    
    contentDiv.innerHTML = `
        <h2 class="mb-4">Pengaturan Sistem (Admin Pusat)</h2>
        
        <ul class="nav nav-tabs mb-3" id="settingTabs" role="tablist">
            <li class="nav-item" role="presentation">
                <button class="nav-link active" id="banner-tab" data-bs-toggle="tab" data-bs-target="#banner-pane" type="button" role="tab" aria-controls="banner-pane" aria-selected="true">Banner</button>
            </li>
            <li class="nav-item" role="presentation">
                <button class="nav-link" id="userlist-tab" data-bs-toggle="tab" data-bs-target="#userlist-pane" type="button" role="tab" aria-controls="userlist-pane" aria-selected="false">Manajemen Pengguna</button>
            </li>
        </ul>
        
        <div class="tab-content" id="settingTabsContent">
            <div class="tab-pane fade show active" id="banner-pane" role="tabpanel" aria-labelledby="banner-tab">
                <div class="card shadow-sm">
                    <div class="card-body" id="banner-setting-area">Memuat...</div>
                </div>
            </div>
            <div class="tab-pane fade" id="userlist-pane" role="tabpanel" aria-labelledby="userlist-tab">
                <div class="card shadow-sm">
                    <div class="card-body" id="userlist-setting-area">Memuat...</div>
                </div>
            </div>
        </div>
    `;

    loadBannerSetting();
    loadUserlistSetting();
}

async function loadBannerSetting() {
    const area = document.getElementById('banner-setting-area');
    const result = await callAppsScript('GET_BANNERS');
    
    if (result && result.success) {
        const data = result.data;
        area.innerHTML = `
            <h5 class="card-title">Atur URL Banner (Maks. 3)</h5>
            <p class="card-text small text-muted">Masukkan URL gambar banner (misalnya dari ImgBB atau Google Drive).</p>
            <form id="bannerForm" onsubmit="handleBannerFormSubmit(event)" class="row g-3">
                <div class="col-12">
                    <label for="url_banner1" class="form-label">URL Banner 1</label>
                    <input type="url" class="form-control" id="url_banner1" name="url_banner1" value="${data.url_banner1 || ''}">
                </div>
                <div class="col-12">
                    <label for="url_banner2" class="form-label">URL Banner 2</label>
                    <input type="url" class="form-control" id="url_banner2" name="url_banner2" value="${data.url_banner2 || ''}">
                </div>
                <div class="col-12">
                    <label for="url_banner3" class="form-label">URL Banner 3</label>
                    <input type="url" class="form-control" id="url_banner3" name="url_banner3" value="${data.url_banner3 || ''}">
                </div>
                <div class="col-12 mt-4">
                    <button type="submit" class="btn btn-primary"><i class="fas fa-save me-2"></i> Simpan Banner</button>
                </div>
            </form>
        `;
    } else {
        area.innerHTML = `<div class="alert alert-danger">Gagal memuat pengaturan banner.</div>`;
    }
}

async function handleBannerFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const data = {};
    
    formData.forEach((value, key) => {
        data[key] = value;
    });
    
    const result = await callAppsScript('CRUD_BANNER', { data: JSON.stringify(data) });
    
    if (result && result.success) {
        showToast(result.message || 'Pengaturan Banner berhasil disimpan!');
        loadBannerSetting(); // Reload pengaturan banner
    }
}

async function loadUserlistSetting() {
    const area = document.getElementById('userlist-setting-area');
    
    area.innerHTML = `
        <h5 class="card-title mb-3">Manajemen Akun Pengguna</h5>
        <div class="d-flex justify-content-end mb-3">
            <button class="btn btn-success btn-sm" onclick="showUserlistForm()"><i class="fas fa-plus me-1"></i> Tambah Pengguna</button>
        </div>
        <div class="table-responsive">
            <table id="userlistTable" class="table table-striped table-bordered w-100 table-sm small">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Username</th>
                        <th>Tipe Pengguna</th>
                        <th>ID Klub</th>
                        <th>Aksi</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        </div>
    `;

    const result = await callAppsScript('GET_USERLIST');
    if (result && result.success) {
        const table = $('#userlistTable').DataTable({
            data: result.data,
            columns: [
                { data: null, render: (data, type, row, meta) => meta.row + 1 },
                { data: 'username' },
                { data: 'type_users' },
                { data: 'id_klub' },
                { 
                    data: null, 
                    render: (data, type, row) => `
                        <button class="btn btn-sm btn-info me-1" onclick="showUserlistForm(${JSON.stringify(row).replace(/"/g, '&quot;')})"><i class="fas fa-edit"></i></button>
                        ${row.username !== currentUser.username ? `<button class="btn btn-sm btn-danger" onclick="confirmDeleteUserlist('${row.username}')"><i class="fas fa-trash"></i></button>` : ''}
                    `,
                    orderable: false
                }
            ],
            // Poin 1: Sesuaikan DataTable untuk Mobile
            responsive: true,
            columnDefs: [
                { responsivePriority: 1, targets: 0 },
                { responsivePriority: 2, targets: 1 },
                { responsivePriority: 3, targets: 2 },
                { responsivePriority: 4, targets: -1 }
            ],
            destroy: true
        });
    }
}

function showUserlistForm(data = {}) {
    const isNew = !data.username;
    const typeOptions = ['ADMIN_PUSAT', 'ADMIN_KLUB'];

    // Poin 1: Form Pengguna yang Responsif
    const formHtml = `
        <form id="genericForm" data-action="${isNew ? 'CREATE' : 'UPDATE'}" class="row g-3">
            <div class="col-md-6">
                <label for="username" class="form-label">Username <span class="text-danger">*</span></label>
                <input type="text" class="form-control" id="username" name="username" value="${data.username || ''}" ${isNew ? 'required' : 'disabled'}>
            </div>
            <div class="col-md-6">
                <label for="password" class="form-label">Password ${isNew ? '<span class="text-danger">*</span>' : '(Isi jika ingin ganti)'}</label>
                <input type="password" class="form-control" id="password" name="password" ${isNew ? 'required' : ''}>
            </div>
            <div class="col-md-6">
                <label for="type_users" class="form-label">Tipe Pengguna</label>
                <select class="form-select" id="type_users" name="type_users" required>
                    ${typeOptions.map(t => `<option value="${t}" ${data.type_users === t ? 'selected' : ''}>${t}</option>`).join('')}
                </select>
            </div>
            <div class="col-md-6">
                <label for="id_klub" class="form-label">ID Klub (Wajib untuk ADMIN_KLUB)</label>
                <input type="text" class="form-control" id="id_klub" name="id_klub" value="${data.id_klub || ''}">
            </div>
        </form>
    `;

    showModalForm(`${isNew ? 'Tambah' : 'Edit'} Pengguna`, formHtml, handleUserlistFormSubmit, 'lg');
}

async function handleUserlistFormSubmit(e) {
    await handleGenericFormSubmit(e, 'CRUD_USERLIST', [], loadUserlistSetting);
}

function confirmDeleteUserlist(username) {
    showConfirmationModal(`Apakah Anda yakin ingin menghapus pengguna ${username}?`, async () => {
        const data = { action: 'DELETE', username: username };
        const result = await callAppsScript('CRUD_USERLIST', { data: JSON.stringify(data) });
        
        if (result && result.success) {
            showToast(result.message || 'Pengguna berhasil dihapus.');
            loadUserlistSetting();
        }
    });
}

// --- INISIALISASI ---

function init() {
    const storedUser = sessionStorage.getItem('currentUser');
    const loginTime = sessionStorage.getItem('loginTime');

    if (storedUser && loginTime) {
        currentUser = JSON.parse(storedUser);
        // Poin 3: Cek apakah sesi sudah habis saat inisialisasi
        if (checkSessionTimeout()) {
            // lockApp() sudah dipanggil di checkSessionTimeout
        } else {
            renderMainLayout();
        }
    } else {
        renderLoginPage();
    }
}

// Event listener saat DOM selesai dimuat
document.addEventListener('DOMContentLoaded', init);
