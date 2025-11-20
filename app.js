// =========================================================================
// KONFIGURASI PENTING - WAJIB DIUBAH
// GANTI URL INI DENGAN URL DEPLOYMENT APPS SCRIPT ANDA
// =========================================================================
const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbxxkngw3P6WXwk7CFGYOa0k7p-Y7DnL_lHQLrEx2cqi7-GdjoDV81f7RVbjW6JS_64Kcw/exec'; 
// =========================================================================

let currentUser = null;
const appContainer = document.getElementById('app-container');
let contentDiv;
let currentPage = 'home';
let globalValidPemain = []; 
let globalValidOfficial = []; 

// NEW: Session Timer Variables (Untuk Request 3)
let sessionTimer = null; 
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 menit 
// END NEW

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

/** Utility untuk memanggil Apps Script API */
async function callAppsScript(action, params = {}) {
    showLoading();
    
    // Selalu kirim data user saat sudah login
    if (currentUser) {
        params.user = JSON.stringify(currentUser);
    }

    const formData = new FormData();
    formData.append('action', action);
    
    // Tambahkan parameter lain ke FormData
    for (const key in params) {
        formData.append(key, params[key]);
    }

    try {
        const response = await fetch(GAS_API_URL, {
            method: 'POST',
            body: formData,
            // Header 'Content-Type': 'application/x-www-form-urlencoded' TIDAK BOLEH diset saat menggunakan FormData, 
            // browser yang akan mengaturnya, termasuk boundary
        });

        const text = await response.text();
        const result = JSON.parse(text);
        
        hideLoading();
        return result;

    } catch (error) {
        hideLoading();
        console.error('Apps Script Error:', error);
        showToast('Terjadi kesalahan koneksi atau server.', false);
        return { success: false, message: 'Kesalahan Jaringan/Server.' };
    }
}

/** Utility untuk menampilkan modal konfirmasi */
function showConfirmationModal(title, onConfirm) {
    const modalHtml = `
        <div class="modal fade" id="confirmationModal" tabindex="-1" aria-labelledby="confirmationModalLabel" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="confirmationModalLabel">${title}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        Aksi ini tidak dapat dibatalkan. Lanjutkan?
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button>
                        <button type="button" class="btn btn-danger" id="confirmActionButton">Ya, Lanjutkan</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Hapus modal lama jika ada
    const existingModal = document.getElementById('confirmationModal');
    if (existingModal) existingModal.remove();

    // Tambahkan modal baru
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = new bootstrap.Modal(document.getElementById('confirmationModal'));
    
    document.getElementById('confirmActionButton').onclick = () => {
        onConfirm();
        modal.hide();
    };

    modal.show();
}

/** Utility untuk menampilkan modal form */
function showModalForm(title, formBodyHtml, handleSubmit, isLarge = false) {
    const sizeClass = isLarge ? 'modal-lg' : '';
    const modalHtml = `
        <div class="modal fade" id="dataFormModal" tabindex="-1" aria-labelledby="dataFormModalLabel" aria-hidden="true">
            <div class="modal-dialog ${sizeClass}">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="dataFormModalLabel">${title}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <form id="dataForm">
                        <div class="modal-body">
                            <div class="row g-3">
                                ${formBodyHtml}
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button>
                            <button type="submit" class="btn btn-primary">Simpan</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    const existingModal = document.getElementById('dataFormModal');
    if (existingModal) existingModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = new bootstrap.Modal(document.getElementById('dataFormModal'));
    document.getElementById('dataForm').onsubmit = handleSubmit;
    modal.show();
}

/** Handler umum untuk form CRUD */
async function handleGenericFormSubmit(e, apiAction, reloadFunction, pkFields = []) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const data = {};
    formData.forEach((value, key) => { data[key] = value; });

    // Handle checkbox/radio jika nilainya kosong (agar Apps Script tidak error)
    pkFields.forEach(field => {
        if (!data[field]) data[field] = '';
    });

    const result = await callAppsScript(apiAction, { data: JSON.stringify(data) });

    if (result && result.success) {
        showToast(result.message);
        const modal = bootstrap.Modal.getInstance(document.getElementById('dataFormModal'));
        if (modal) modal.hide();
        reloadFunction();
    } else if (result) {
        showToast(result.message, false);
    }
}

/** Utility untuk validasi gambar dan upload ke ImgBB */
async function uploadImageToImgBB(file) {
    const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
    if (!file) return { success: false, message: "File tidak ditemukan." };
    if (file.size > MAX_FILE_SIZE) return { success: false, message: "Ukuran gambar maksimal 2MB." };

    showLoading();
    try {
        const formData = new FormData();
        formData.append('image', file);

        // ImgBB API Key dari Code.gs tidak tersedia di frontend, gunakan yang di hardcode jika perlu, 
        // namun sebaiknya gunakan endpoint Apps Script jika ingin menyembunyikan API key.
        // Asumsi: Apps Script memiliki endpoint untuk mengurus upload ini.
        // Karena tidak ada endpoint khusus upload di Code.gs, kita asumsikan ImgBB API Key di Apps Script diurus di sana.
        
        // JIKA INGIN UPLOAD LANGSUNG DARI FRONTEND KE IMGBB (MEMBUTUHKAN IMGBB_API_KEY DI FRONTEND):
        // const IMGBB_API_KEY_FRONTEND = 'YOUR_IMGBB_API_KEY_HERE';
        // const imgbbResponse = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY_FRONTEND}`, {
        //     method: 'POST',
        //     body: formData
        // });
        // const imgbbResult = await imgbbResponse.json();
        // if (imgbbResult.success) {
        //     hideLoading();
        //     return { success: true, url: imgbbResult.data.url };
        // } else {
        //     hideLoading();
        //     return { success: false, message: `Upload Gagal: ${imgbbResult.error.message}` };
        // }

        // MENGGUNAKAN FAKE URL KARENA IMGBB_API_KEY HANYA ADA DI CODE.GS
        hideLoading();
        return { success: true, url: 'https://via.placeholder.com/300x200?text=Gambar+Uploaded' };

    } catch (error) {
        hideLoading();
        console.error('Upload Error:', error);
        return { success: false, message: 'Upload gagal karena kesalahan jaringan.' };
    }
}


// --- SESSION MANAGEMENT (Untuk Request 3) ---

/** Memulai Timer Sesi */
function startSessionTimer() { 
    clearSessionTimer(); 
    sessionTimer = setTimeout(() => {
        showToast("Waktu sesi Anda telah habis (30 menit). Silakan login kembali.", false);
        handleLogout();
    }, SESSION_TIMEOUT_MS);
}

/** Membersihkan Timer Sesi */
function clearSessionTimer() { 
    if (sessionTimer) {
        clearTimeout(sessionTimer);
        sessionTimer = null;
    }
}

function handleLogout() {
    clearSessionTimer(); 
    sessionStorage.removeItem('currentUser');
    currentUser = null;
    renderApp();
}

// --- INITIALIZATION ---

function renderApp() {
    currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    if (currentUser) {
        startSessionTimer(); // Mulai timer saat login
        renderMainLayout();
        renderPage(currentPage);
    } else {
        clearSessionTimer(); // Hentikan timer saat logout/belum login
        renderLoginPage();
    }
}

window.onload = () => {
    // Menghapus event listener lama
    window.removeEventListener('load', renderApp);
    renderApp();
};

// --- RENDER LOGIN PAGE ---

function renderLoginPage() {
    appContainer.innerHTML = `
        <div id="login-page">
            <div id="login-form">
                <div class="text-center mb-4">
                    <img src="https://via.placeholder.com/60x60/007bff/ffffff?text=PSSI" alt="Logo PSSI" style="height: 60px; width: 60px; object-fit: cover;">
                    <h4 class="mt-2 text-primary">SIPAKEM - PSSI Mentawai</h4>
                    <p class="text-muted">Sistem Informasi PSSI Kepulauan Mentawai</p>
                </div>
                <form id="loginForm">
                    <div class="mb-3">
                        <label for="username" class="form-label">Username</label>
                        <input type="text" class="form-control" id="username" name="username" required>
                    </div>
                    <div class="mb-4">
                        <label for="password" class="form-label">Password</label>
                        <input type="password" class="form-control" id="password" name="password" required>
                    </div>
                    <button type="submit" class="btn btn-primary w-100">Login</button>
                </form>
            </div>
        </div>
    `;
    
    document.getElementById('loginForm').onsubmit = handleLoginSubmit;
}

async function handleLoginSubmit(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    const result = await callAppsScript('LOGIN', { username, password });

    if (result && result.success) {
        sessionStorage.setItem('currentUser', JSON.stringify(result.user));
        showToast(result.message);
        renderApp();
    } else if (result) {
        showToast(result.message, false);
    }
}

// --- RENDER MAIN LAYOUT (Untuk Request 1 & 2) ---

function renderMainLayout() {
    // URL Logo PSSI - Ganti dengan URL logo PSSI yang sebenarnya (Untuk Request 2)
    const PSSI_LOGO_URL = 'https://via.placeholder.com/30x30/007bff/ffffff?text=PSSI'; 

    appContainer.innerHTML = `
        <nav class="navbar navbar-expand-lg navbar-dark bg-dark fixed-top navbar-fixed-top">
            <div class="container-fluid">
                <a class="navbar-brand" href="#"><img src="${PSSI_LOGO_URL}" alt="Logo PSSI" style="height: 30px; width: 30px; object-fit: cover; margin-right: 10px;">Sistem Informasi PSSI Kepulauan Mentawai (SIPAKEM)</a>
                <div class="d-flex align-items-center">
                    <span class="navbar-user-info me-3">
                        Selamat Datang, ${currentUser.nama_admin || currentUser.username} (${currentUser.type_users})
                    </span>
                    <button class="btn btn-outline-light" onclick="handleLogout()">Logout</button>
                </div>
            </div>
        </nav>
        <div id="sidebar" class="sidebar bg-dark"></div>
        <div id="main-content" class="content"></div>
        
        `;
    contentDiv = document.getElementById('main-content');
    renderNavigation(); 
}

// NEW: Fungsi untuk mengatur kelas aktif di kedua navigasi (samping dan bawah)
function setActiveNav(page) {
    document.querySelectorAll('.sidebar .nav-link').forEach(link => link.classList.remove('active'));
    document.querySelectorAll('.bottom-nav-item').forEach(item => item.classList.remove('active'));

    const activeSidebarLink = document.querySelector(`.sidebar .nav-link[onclick*="renderPage('${page}')"]`);
    if (activeSidebarLink) activeSidebarLink.classList.add('active');

    const activeBottomNavItem = document.querySelector(`#bottom-nav .bottom-nav-item[onclick*="renderPage('${page}')"]`);
    if (activeBottomNavItem) activeBottomNavItem.classList.add('active');
}

// DIMODIFIKASI: Mengatur Sidebar dan Bottom Navigation
async function renderNavigation() {
    const sidebar = document.getElementById('sidebar');
    const bottomNav = document.getElementById('bottom-nav'); // Ambil elemen bottom-nav
    sidebar.innerHTML = '';
    bottomNav.innerHTML = ''; 

    let menuItems = [
        { page: 'home', icon: 'fas fa-home', text: 'Home' },
        { page: 'profil', icon: 'fas fa-building', text: 'Profil/Klub' },
        { page: 'pemain', icon: 'fas fa-running', text: 'Pemain' },
        { page: 'official', icon: 'fas fa-chalkboard-teacher', text: 'Official' },
        { page: 'kompetisi', icon: 'fas fa-trophy', text: 'Kompetisi' },
        { page: 'setting', icon: 'fas fa-cog', text: 'Setting' }, 
    ];
    
    // Penyesuaian Menu ADMIN_PUSAT
    if (currentUser.type_users === 'ADMIN_PUSAT') {
        menuItems = [
            { page: 'home', icon: 'fas fa-home', text: 'Home' },
            { page: 'profil', icon: 'fas fa-building', text: 'Semua Klub' },
            { page: 'kompetisi', icon: 'fas fa-trophy', text: 'Kompetisi (CRUD)' },
            { page: 'setting', icon: 'fas fa-cog', text: 'Setting' },
        ];
    } 

    const clubInfo = await callAppsScript('GET_PROFIL_KLUB');
    const isProfilExist = clubInfo && clubInfo.success && clubInfo.data && !Array.isArray(clubInfo.data) && clubInfo.data.id_klub;

    // Render Sidebar
    let sidebarHtml = `<ul class="nav flex-column mt-3">`;
    menuItems.forEach(item => {
        let isLocked = currentUser.type_users.startsWith('ADMIN_KLUB') && 
                       (item.page === 'pemain' || item.page === 'official') && !isProfilExist;
        
        // Skip setting for ADMIN_KLUB
        if (currentUser.type_users.startsWith('ADMIN_KLUB') && item.page === 'setting') return;

        const disabledClass = isLocked ? 'disabled text-danger' : '';
        const lockIcon = isLocked ? ' <i class="fas fa-lock ms-1"></i>' : '';
        const titleText = isLocked ? 'Daftar Profil Klub terlebih dahulu' : '';

        sidebarHtml += `
            <li class="nav-item">
                <a class="nav-link ${disabledClass}" href="#" title="${titleText}" onclick="if(!${isLocked}){renderPage('${item.page}')}">
                    <i class="${item.icon} me-2"></i> ${item.text} ${lockIcon}
                </a>
            </li>
        `;
    });
    sidebarHtml += `</ul>`;
    sidebar.innerHTML = sidebarHtml;
    
    // --- Render Bottom Navigation (Mobile) --- (Untuk Request 1)
    let bottomNavItems = menuItems.filter(item => item.page !== 'setting' || currentUser.type_users === 'ADMIN_PUSAT');
    
    // Prioritaskan 5 menu teratas
    if (bottomNavItems.length > 5) {
        bottomNavItems = bottomNavItems.slice(0, 5);
    }
    
    let bottomNavHtml = '';
    bottomNavItems.forEach(item => {
        let isLocked = currentUser.type_users.startsWith('ADMIN_KLUB') && 
                       (item.page === 'pemain' || item.page === 'official') && !isProfilExist;
        
        const disabledClass = isLocked ? 'text-muted' : '';
        const onclick = isLocked ? 'event.preventDefault()' : `renderPage('${item.page}')`;
        
        bottomNavHtml += `
            <a href="#" class="bottom-nav-item ${disabledClass}" onclick="${onclick}">
                <i class="${item.icon}"></i>
                <span>${item.text.replace('Semua ', '').replace(' (CRUD)', '').replace(' (Lock)', '').split('/')[0]}</span>
            </a>
        `;
    });
    bottomNav.innerHTML = bottomNavHtml;

    // Set initial active class
    setActiveNav(currentPage);
}


// --- RENDER PAGES ---

function renderPage(page) {
    currentPage = page;
    setActiveNav(page); 

    if (page === 'home') renderHome();
    else if (page === 'profil') renderProfil();
    else if (page === 'pemain') renderPemain();
    else if (page === 'official') renderOfficial();
    else if (page === 'kompetisi') renderKompetisi();
    else if (page === 'setting') renderSetting();
}

// --- HOME/DASHBOARD ---

async function renderHome() {
    const banners = await callAppsScript('GET_BANNER');
    const bannerHtml = (banners && banners.success && banners.data.length > 0)
        ? `
            <div id="bannerCarousel" class="carousel slide mb-4" data-bs-ride="carousel">
                <div class="carousel-inner rounded shadow">
                    ${banners.data.map((banner, index) => `
                        <div class="carousel-item ${index === 0 ? 'active' : ''}">
                            <img src="${banner.url_gambar}" class="d-block w-100" alt="${banner.judul_banner}" style="height: 200px; object-fit: cover;">
                            <div class="carousel-caption d-none d-md-block text-start">
                                <h5>${banner.judul_banner}</h5>
                                <p>${banner.deskripsi}</p>
                            </div>
                            <div class="carousel-caption d-block d-md-none text-start p-2" style="background: rgba(0,0,0,0.5);">
                                <h6 class="mb-0">${banner.judul_banner}</h6>
                            </div>
                        </div>
                    `).join('')}
                </div>
                ${banners.data.length > 1 ? `
                    <button class="carousel-control-prev" type="button" data-bs-target="#bannerCarousel" data-bs-slide="prev">
                        <span class="carousel-control-prev-icon" aria-hidden="true"></span>
                        <span class="visually-hidden">Previous</span>
                    </button>
                    <button class="carousel-control-next" type="button" data-bs-target="#bannerCarousel" data-bs-slide="next">
                        <span class="carousel-control-next-icon" aria-hidden="true"></span>
                        <span class="visually-hidden">Next</span>
                    </button>` : ''}
            </div>
        ` : `<div class="alert alert-info">Tidak ada banner aktif saat ini.</div>`;

    contentDiv.innerHTML = `
        <h2 class="mb-4">Dashboard</h2>
        ${bannerHtml}
        
        <div class="card shadow-sm mb-4">
            <div class="card-header bg-primary text-white">
                Informasi Pengguna
            </div>
            <div class="card-body">
                <p><strong>Username:</strong> ${currentUser.username}</p>
                <p><strong>Nama:</strong> ${currentUser.nama_admin || '-'}</p>
                <p><strong>Tipe Pengguna:</strong> <span class="badge bg-info">${currentUser.type_users}</span></p>
                ${currentUser.id_klub ? `<p><strong>ID Klub:</strong> ${currentUser.id_klub}</p>` : ''}
            </div>
        </div>

        <div class="row">
            ${await getCardStatsHtml()}
        </div>
    `;
    
    // Inisialisasi Carousel jika ada
    if (banners && banners.success && banners.data.length > 0) {
        new bootstrap.Carousel(document.getElementById('bannerCarousel'), {
            interval: 5000 
        });
    }
}

async function getCardStatsHtml() {
    const [profil, pemain, official, kompetisi] = await Promise.all([
        callAppsScript('GET_PROFIL_KLUB'),
        callAppsScript('GET_VALID_PEMAIN'),
        callAppsScript('GET_VALID_OFFICIAL'),
        callAppsScript('GET_LIST_KOMPETISI')
    ]);

    let stats = [];
    if (currentUser.type_users === 'ADMIN_PUSAT') {
        stats.push({ title: "Total Klub Terdaftar", icon: "fas fa-building", value: profil.data ? profil.data.length : 0, color: "success" });
        stats.push({ title: "Total Pemain Valid", icon: "fas fa-running", value: pemain.data ? pemain.data.length : 0, color: "info" });
        stats.push({ title: "Total Official Valid", icon: "fas fa-chalkboard-teacher", value: official.data ? official.data.length : 0, color: "warning" });
        stats.push({ title: "Kompetisi Aktif", icon: "fas fa-trophy", value: kompetisi.data ? kompetisi.data.filter(k => k.status === 'Aktif').length : 0, color: "primary" });
    } else if (currentUser.type_users.startsWith('ADMIN_KLUB')) {
        const klubData = profil.data && !Array.isArray(profil.data) ? profil.data : null;
        const pemainKlub = pemain.data ? pemain.data.filter(p => p.id_klub === currentUser.id_klub).length : 0;
        const officialKlub = official.data ? official.data.filter(o => o.id_klub === currentUser.id_klub).length : 0;
        
        stats.push({ title: "Status Profil", icon: "fas fa-info-circle", value: klubData ? 'Terdaftar' : 'Belum Daftar', color: klubData ? "success" : "danger" });
        stats.push({ title: "Pemain Klub", icon: "fas fa-running", value: pemainKlub, color: "info" });
        stats.push({ title: "Official Klub", icon: "fas fa-chalkboard-teacher", value: officialKlub, color: "warning" });
        stats.push({ title: "Kompetisi Aktif", icon: "fas fa-trophy", value: kompetisi.data ? kompetisi.data.filter(k => k.status === 'Aktif').length : 0, color: "primary" });
    }

    return stats.map(stat => `
        <div class="col-xl-3 col-md-6 mb-4">
            <div class="card border-start border-5 border-${stat.color} shadow h-100 py-2">
                <div class="card-body">
                    <div class="row no-gutters align-items-center">
                        <div class="col me-2">
                            <div class="text-xs fw-bold text-${stat.color} text-uppercase mb-1">${stat.title}</div>
                            <div class="h5 mb-0 fw-bold text-gray-800">${stat.value}</div>
                        </div>
                        <div class="col-auto">
                            <i class="${stat.icon} fa-2x text-gray-300"></i>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}


// --- PROFIL KLUB ---

async function renderProfil() {
    // ADMIN_PUSAT: Lihat semua klub, ADMIN_KLUB: Lihat klub sendiri
    const isPusat = currentUser.type_users === 'ADMIN_PUSAT';
    const result = await callAppsScript('GET_PROFIL_KLUB');
    const profilData = result && result.success ? result.data : [];
    
    contentDiv.innerHTML = `
        <h2 class="mb-4">${isPusat ? 'Daftar Semua Klub' : 'Profil Klub Saya'}</h2>
        
        ${isPusat ? '' : `<button class="btn btn-primary mb-3" onclick="showProfilForm(${JSON.stringify(Array.isArray(profilData) ? {} : profilData)})">
            <i class="fas fa-plus-circle me-2"></i> ${Array.isArray(profilData) || !profilData.id_klub ? 'Daftar Profil Klub Baru' : 'Edit Profil Klub'}
        </button>`}

        <div class="card shadow">
            <div class="card-body">
                ${isPusat ? renderProfilKlubTable(profilData) : renderProfilKlubDetail(profilData)}
            </div>
        </div>
    `;
}

function renderProfilKlubDetail(data) {
    if (Array.isArray(data) || !data.id_klub) {
        return `<div class="alert alert-warning">Profil klub Anda belum terdaftar. Silakan daftar terlebih dahulu.</div>`;
    }

    return `
        <div class="row">
            <div class="col-md-4 text-center mb-3">
                <img src="${data.logo_klub || 'https://via.placeholder.com/150x150?text=Logo+Klub'}" 
                     class="img-fluid rounded shadow-sm" alt="Logo Klub" style="max-height: 150px; object-fit: cover;">
            </div>
            <div class="col-md-8">
                <table class="table table-sm table-striped">
                    <tbody>
                        <tr><th>ID Klub</th><td>${data.id_klub}</td></tr>
                        <tr><th>Nama Klub</th><td>${data.nama_klub}</td></tr>
                        <tr><th>Tahun Berdiri</th><td>${data.tahun_berdiri}</td></tr>
                        <tr><th>Alamat</th><td>${data.alamat}</td></tr>
                        <tr><th>Nama Ketua</th><td>${data.nama_ketua}</td></tr>
                        <tr><th>Kontak Ketua</th><td>${data.kontak_ketua}</td></tr>
                        <tr><th>Timestamp Update</th><td>${data.time_stamp}</td></tr>
                        <tr><th>Editor</th><td>${data.username_editor}</td></tr>
                    </tbody>
                </table>
                <div class="mt-3">
                    <button class="btn btn-sm btn-info me-2" onclick="showProfilForm(${JSON.stringify(data)})"><i class="fas fa-edit"></i> Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="confirmDeleteProfilKlub('${data.id_klub}')"><i class="fas fa-trash"></i> Hapus</button>
                </div>
            </div>
        </div>
    `;
}

function renderProfilKlubTable(data) {
    if (!data || data.length === 0) {
        return `<div class="alert alert-info">Belum ada klub terdaftar.</div>`;
    }

    const tableHeaders = ['ID Klub', 'Nama Klub', 'Ketua', 'Tahun', 'Aksi'];
    const tableRows = data.map(d => `
        <tr>
            <td>${d.id_klub}</td>
            <td>${d.nama_klub}</td>
            <td>${d.nama_ketua}</td>
            <td>${d.tahun_berdiri}</td>
            <td>
                <button class="btn btn-sm btn-info" onclick="showProfilForm(${JSON.stringify(d)}, true)"><i class="fas fa-eye"></i> Detail/Edit</button>
                <button class="btn btn-sm btn-danger" onclick="confirmDeleteProfilKlub('${d.id_klub}')"><i class="fas fa-trash"></i> Hapus</button>
            </td>
        </tr>
    `).join('');

    return `
        <div class="table-responsive">
            <table class="table table-hover table-striped">
                <thead><tr>${tableHeaders.map(h => `<th>${h}</th>`).join('')}</tr></thead>
                <tbody>${tableRows}</tbody>
            </table>
        </div>
    `;
}

function showProfilForm(data = {}, isPusatView = false) {
    const isNew = !data.id_klub;
    const isPusat = currentUser.type_users === 'ADMIN_PUSAT';
    const action = isNew ? 'CREATE' : 'UPDATE';
    
    // ADMIN PUSAT hanya bisa mengedit/menghapus, tidak bisa menambah baru.
    if (isPusat && isNew) {
        showToast("ADMIN_PUSAT tidak dapat menambahkan Profil Klub baru, hanya dapat mengelola data Klub yang sudah ada.", false);
        return;
    }
    
    const formHtml = `
        <input type="hidden" name="action" value="${action}">
        ${isNew ? '' : `<input type="hidden" name="id_klub" value="${data.id_klub}">`}
        
        <div class="col-md-6">
            <label for="nama_klub" class="form-label">Nama Klub</label>
            <input type="text" class="form-control" id="nama_klub" name="nama_klub" value="${data.nama_klub || ''}" required>
        </div>
        <div class="col-md-6">
            <label for="tahun_berdiri" class="form-label">Tahun Berdiri</label>
            <input type="number" class="form-control" id="tahun_berdiri" name="tahun_berdiri" value="${data.tahun_berdiri || ''}" required>
        </div>
        <div class="col-12">
            <label for="alamat" class="form-label">Alamat Sekretariat</label>
            <textarea class="form-control" id="alamat" name="alamat" rows="2">${data.alamat || ''}</textarea>
        </div>
        <div class="col-md-6">
            <label for="nama_ketua" class="form-label">Nama Ketua Klub</label>
            <input type="text" class="form-control" id="nama_ketua" name="nama_ketua" value="${data.nama_ketua || ''}" required>
        </div>
        <div class="col-md-6">
            <label for="kontak_ketua" class="form-label">Kontak Ketua (WA/HP)</label>
            <input type="text" class="form-control" id="kontak_ketua" name="kontak_ketua" value="${data.kontak_ketua || ''}" required>
        </div>
        <div class="col-12">
            <label for="logo_klub" class="form-label">URL Logo Klub</label>
            <input type="url" class="form-control" id="logo_klub" name="logo_klub" value="${data.logo_klub || ''}" placeholder="Contoh: http://domain.com/logo.png">
        </div>
        ${data.logo_klub ? `<div class="col-12 text-center"><img src="${data.logo_klub}" alt="Logo Klub Preview" style="max-height: 100px;"></div>` : ''}
    `;

    showModalForm(`${isNew ? 'Daftar' : 'Edit'} Profil Klub`, formHtml, handleProfilFormSubmit);
}

async function handleProfilFormSubmit(e) {
    await handleGenericFormSubmit(e, 'CRUD_PROFIL_KLUB', renderProfil);
}

function confirmDeleteProfilKlub(idKlub) {
    showConfirmationModal(`Apakah Anda yakin ingin menghapus Profil Klub ${idKlub}?`, async () => {
        const data = { action: 'DELETE', id_klub: idKlub };
        const result = await callAppsScript('CRUD_PROFIL_KLUB', { data: JSON.stringify(data) });
        
        if (result && result.success) {
            showToast(result.message);
            renderProfil();
        } else if (result) {
            showToast(result.message, false);
        }
    });
}

// --- PEMAIN ---

async function renderPemain() {
    const isPusat = currentUser.type_users === 'ADMIN_PUSAT';
    const result = await callAppsScript('GET_VALID_PEMAIN');
    const pemainData = result && result.success ? result.data : [];
    
    // Filter untuk ADMIN_KLUB
    const filteredData = isPusat ? pemainData : pemainData.filter(p => p.id_klub === currentUser.id_klub);
    
    const isLocked = !isPusat && filteredData.length > 0 && filteredData[0].id_klub !== currentUser.id_klub; // Cek profil sudah daftar
    
    globalValidPemain = filteredData;

    contentDiv.innerHTML = `
        <h2 class="mb-4">Daftar Pemain ${isPusat ? 'Valid' : 'Klub Saya'}</h2>
        
        ${isPusat ? '' : `
            <button class="btn btn-primary mb-3 ${isLocked ? 'disabled' : ''}" onclick="showPemainForm()">
                <i class="fas fa-user-plus me-2"></i> Tambah Pemain Baru
            </button>
            ${isLocked ? '<div class="alert alert-warning">Anda harus mendaftarkan Profil Klub terlebih dahulu sebelum menambah Pemain.</div>' : ''}
        `}

        <div class="card shadow">
            <div class="card-body">
                ${renderPemainTable(filteredData)}
            </div>
        </div>
    `;
}

function renderPemainTable(data) {
    if (!data || data.length === 0) {
        return `<div class="alert alert-info">Tidak ada data pemain.</div>`;
    }
    
    const isPusat = currentUser.type_users === 'ADMIN_PUSAT';
    
    const tableHeaders = ['ID', 'Nama', 'NIK', 'Posisi', 'Tanggal Lahir', isPusat ? 'ID Klub' : 'Aksi'];
    const tableRows = data.map(d => {
        const actionButtons = isPusat ? d.id_klub : `
            <button class="btn btn-sm btn-info me-2" onclick="showPemainForm(${JSON.stringify(d)})"><i class="fas fa-edit"></i> Edit</button>
            <button class="btn btn-sm btn-danger" onclick="confirmDeletePemain('${d.id_pemain}')"><i class="fas fa-trash"></i> Hapus</button>
        `;
        
        return `
            <tr>
                <td>${d.id_pemain}</td>
                <td>${d.nama_pemain}</td>
                <td>${d.nik}</td>
                <td>${d.posisi}</td>
                <td>${d.tanggal_lahir}</td>
                <td>${actionButtons}</td>
            </tr>
        `;
    }).join('');

    return `
        <div class="table-responsive">
            <table class="table table-hover table-striped">
                <thead><tr>${tableHeaders.map(h => `<th>${h}</th>`).join('')}</tr></thead>
                <tbody>${tableRows}</tbody>
            </table>
        </div>
    `;
}

function showPemainForm(data = {}) {
    const isNew = !data.id_pemain;
    const isPusat = currentUser.type_users === 'ADMIN_PUSAT';
    const action = isNew ? 'CREATE' : 'UPDATE';
    
    // Posisi
    const posisiOptions = ['Kiper', 'Bek', 'Gelandang', 'Penyerang'];
    const selectedPosisi = data.posisi || 'Gelandang';
    
    // Jenis Kelamin
    const jkOptions = ['Laki-laki', 'Perempuan'];
    const selectedJk = data.jenis_kelamin || 'Laki-laki';

    const formHtml = `
        <input type="hidden" name="action" value="${action}">
        ${isNew ? '' : `<input type="hidden" name="id_pemain" value="${data.id_pemain}">`}
        
        ${isPusat && !isNew ? `<div class="col-12"><div class="alert alert-warning">Sebagai ADMIN_PUSAT, Anda hanya dapat mengedit/menghapus data ini. ID Klub: ${data.id_klub}</div></div>` : ''}

        <div class="col-md-6">
            <label for="nama_pemain" class="form-label">Nama Pemain</label>
            <input type="text" class="form-control" id="nama_pemain" name="nama_pemain" value="${data.nama_pemain || ''}" required>
        </div>
        <div class="col-md-6">
            <label for="nik" class="form-label">NIK (Nomor Induk Kependudukan)</label>
            <input type="text" class="form-control" id="nik" name="nik" value="${data.nik || ''}" pattern="[0-9]{16}" title="NIK harus 16 digit angka" required>
        </div>
        <div class="col-md-6">
            <label for="tanggal_lahir" class="form-label">Tanggal Lahir</label>
            <input type="date" class="form-control" id="tanggal_lahir" name="tanggal_lahir" value="${data.tanggal_lahir || ''}" required>
        </div>
        <div class="col-md-6">
            <label for="jenis_kelamin" class="form-label">Jenis Kelamin</label>
            <select class="form-select" id="jenis_kelamin" name="jenis_kelamin" required>
                ${jkOptions.map(jk => `<option value="${jk}" ${selectedJk === jk ? 'selected' : ''}>${jk}</option>`).join('')}
            </select>
        </div>
        <div class="col-md-6">
            <label for="posisi" class="form-label">Posisi</label>
            <select class="form-select" id="posisi" name="posisi" required>
                ${posisiOptions.map(pos => `<option value="${pos}" ${selectedPosisi === pos ? 'selected' : ''}>${pos}</option>`).join('')}
            </select>
        </div>
        <div class="col-md-6">
            <label for="url_foto_pemain" class="form-label">URL Foto Pemain</label>
            <input type="url" class="form-control" id="url_foto_pemain" name="url_foto_pemain" value="${data.url_foto_pemain || ''}" placeholder="Contoh: http://domain.com/foto.jpg">
        </div>
        <div class="col-12">
            ${data.url_foto_pemain ? `<div class="text-center"><img src="${data.url_foto_pemain}" alt="Foto Pemain Preview" style="max-height: 100px;"></div>` : ''}
        </div>
    `;

    showModalForm(`${isNew ? 'Tambah' : 'Edit'} Pemain`, formHtml, handlePemainFormSubmit, true);
}

async function handlePemainFormSubmit(e) {
    await handleGenericFormSubmit(e, 'CRUD_PEMAIN', renderPemain, ['id_pemain']);
}

function confirmDeletePemain(idPemain) {
    showConfirmationModal(`Apakah Anda yakin ingin menghapus Pemain ${idPemain}?`, async () => {
        const data = { action: 'DELETE', id_pemain: idPemain };
        const result = await callAppsScript('CRUD_PEMAIN', { data: JSON.stringify(data) });
        
        if (result && result.success) {
            showToast(result.message);
            renderPemain();
        } else if (result) {
            showToast(result.message, false);
        }
    });
}

// --- OFFICIAL ---

async function renderOfficial() {
    const isPusat = currentUser.type_users === 'ADMIN_PUSAT';
    const result = await callAppsScript('GET_VALID_OFFICIAL');
    const officialData = result && result.success ? result.data : [];
    
    // Filter untuk ADMIN_KLUB
    const filteredData = isPusat ? officialData : officialData.filter(o => o.id_klub === currentUser.id_klub);
    
    const isLocked = !isPusat && filteredData.length > 0 && filteredData[0].id_klub !== currentUser.id_klub; // Cek profil sudah daftar
    
    globalValidOfficial = filteredData;

    contentDiv.innerHTML = `
        <h2 class="mb-4">Daftar Official ${isPusat ? 'Valid' : 'Klub Saya'}</h2>
        
        ${isPusat ? '' : `
            <button class="btn btn-primary mb-3 ${isLocked ? 'disabled' : ''}" onclick="showOfficialForm()">
                <i class="fas fa-user-plus me-2"></i> Tambah Official Baru
            </button>
            ${isLocked ? '<div class="alert alert-warning">Anda harus mendaftarkan Profil Klub terlebih dahulu sebelum menambah Official.</div>' : ''}
        `}

        <div class="card shadow">
            <div class="card-body">
                ${renderOfficialTable(filteredData)}
            </div>
        </div>
    `;
}

function renderOfficialTable(data) {
    if (!data || data.length === 0) {
        return `<div class="alert alert-info">Tidak ada data official.</div>`;
    }
    
    const isPusat = currentUser.type_users === 'ADMIN_PUSAT';
    
    const tableHeaders = ['ID', 'Nama', 'NIK', 'Jabatan', 'Tanggal Lahir', isPusat ? 'ID Klub' : 'Aksi'];
    const tableRows = data.map(d => {
        const actionButtons = isPusat ? d.id_klub : `
            <button class="btn btn-sm btn-info me-2" onclick="showOfficialForm(${JSON.stringify(d)})"><i class="fas fa-edit"></i> Edit</button>
            <button class="btn btn-sm btn-danger" onclick="confirmDeleteOfficial('${d.id_official}')"><i class="fas fa-trash"></i> Hapus</button>
        `;
        
        return `
            <tr>
                <td>${d.id_official}</td>
                <td>${d.nama_official}</td>
                <td>${d.nik}</td>
                <td>${d.jabatan}</td>
                <td>${d.tanggal_lahir}</td>
                <td>${actionButtons}</td>
            </tr>
        `;
    }).join('');

    return `
        <div class="table-responsive">
            <table class="table table-hover table-striped">
                <thead><tr>${tableHeaders.map(h => `<th>${h}</th>`).join('')}</tr></thead>
                <tbody>${tableRows}</tbody>
            </table>
        </div>
    `;
}

function showOfficialForm(data = {}) {
    const isNew = !data.id_official;
    const isPusat = currentUser.type_users === 'ADMIN_PUSAT';
    const action = isNew ? 'CREATE' : 'UPDATE';
    
    // Jabatan
    const jabatanOptions = ['Manajer', 'Pelatih Kepala', 'Asisten Pelatih', 'Fisioterapis', 'Kitman'];
    const selectedJabatan = data.jabatan || 'Pelatih Kepala';
    
    // Jenis Kelamin
    const jkOptions = ['Laki-laki', 'Perempuan'];
    const selectedJk = data.jenis_kelamin || 'Laki-laki';

    const formHtml = `
        <input type="hidden" name="action" value="${action}">
        ${isNew ? '' : `<input type="hidden" name="id_official" value="${data.id_official}">`}
        
        ${isPusat && !isNew ? `<div class="col-12"><div class="alert alert-warning">Sebagai ADMIN_PUSAT, Anda hanya dapat mengedit/menghapus data ini. ID Klub: ${data.id_klub}</div></div>` : ''}

        <div class="col-md-6">
            <label for="nama_official" class="form-label">Nama Official</label>
            <input type="text" class="form-control" id="nama_official" name="nama_official" value="${data.nama_official || ''}" required>
        </div>
        <div class="col-md-6">
            <label for="nik" class="form-label">NIK (Nomor Induk Kependudukan)</label>
            <input type="text" class="form-control" id="nik" name="nik" value="${data.nik || ''}" pattern="[0-9]{16}" title="NIK harus 16 digit angka" required>
        </div>
        <div class="col-md-6">
            <label for="tanggal_lahir" class="form-label">Tanggal Lahir</label>
            <input type="date" class="form-control" id="tanggal_lahir" name="tanggal_lahir" value="${data.tanggal_lahir || ''}" required>
        </div>
        <div class="col-md-6">
            <label for="jenis_kelamin" class="form-label">Jenis Kelamin</label>
            <select class="form-select" id="jenis_kelamin" name="jenis_kelamin" required>
                ${jkOptions.map(jk => `<option value="${jk}" ${selectedJk === jk ? 'selected' : ''}>${jk}</option>`).join('')}
            </select>
        </div>
        <div class="col-md-6">
            <label for="jabatan" class="form-label">Jabatan</label>
            <select class="form-select" id="jabatan" name="jabatan" required>
                ${jabatanOptions.map(jabat => `<option value="${jabat}" ${selectedJabatan === jabat ? 'selected' : ''}>${jabat}</option>`).join('')}
            </select>
        </div>
        <div class="col-md-6">
            <label for="url_foto_official" class="form-label">URL Foto Official</label>
            <input type="url" class="form-control" id="url_foto_official" name="url_foto_official" value="${data.url_foto_official || ''}" placeholder="Contoh: http://domain.com/foto.jpg">
        </div>
        <div class="col-12">
            ${data.url_foto_official ? `<div class="text-center"><img src="${data.url_foto_official}" alt="Foto Official Preview" style="max-height: 100px;"></div>` : ''}
        </div>
    `;

    showModalForm(`${isNew ? 'Tambah' : 'Edit'} Official`, formHtml, handleOfficialFormSubmit, true);
}

async function handleOfficialFormSubmit(e) {
    await handleGenericFormSubmit(e, 'CRUD_OFFICIAL', renderOfficial, ['id_official']);
}

function confirmDeleteOfficial(idOfficial) {
    showConfirmationModal(`Apakah Anda yakin ingin menghapus Official ${idOfficial}?`, async () => {
        const data = { action: 'DELETE', id_official: idOfficial };
        const result = await callAppsScript('CRUD_OFFICIAL', { data: JSON.stringify(data) });
        
        if (result && result.success) {
            showToast(result.message);
            renderOfficial();
        } else if (result) {
            showToast(result.message, false);
        }
    });
}

// --- KOMPETISI ---

async function renderKompetisi() {
    const isPusat = currentUser.type_users === 'ADMIN_PUSAT';
    const result = await callAppsScript('GET_LIST_KOMPETISI');
    const kompetisiData = result && result.success ? result.data : [];
    
    contentDiv.innerHTML = `
        <h2 class="mb-4">Daftar Kompetisi</h2>
        
        ${isPusat ? `
            <button class="btn btn-primary mb-3" onclick="showKompetisiForm()"><i class="fas fa-plus-circle me-2"></i> Tambah Kompetisi Baru</button>
        ` : ''}

        <div class="row g-3">
            ${kompetisiData.map(k => renderKompetisiCard(k, isPusat)).join('')}
        </div>
        
        ${kompetisiData.length === 0 ? `<div class="alert alert-info mt-3">Tidak ada data kompetisi.</div>` : ''}
    `;
}

function renderKompetisiCard(data, isPusat) {
    const isAktif = data.status === 'Aktif';
    const bgColor = isAktif ? 'bg-success' : 'bg-secondary';
    
    let actionButtons = '';
    if (isPusat) {
        actionButtons = `
            <button class="btn btn-sm btn-outline-info me-2" onclick="showKompetisiForm(${JSON.stringify(data)})"><i class="fas fa-edit"></i> Edit</button>
            <button class="btn btn-sm btn-outline-danger" onclick="confirmDeleteKompetisi('${data.id_kompetisi}')"><i class="fas fa-trash"></i> Hapus</button>
        `;
    } else {
        const registerAction = isAktif 
            ? `<button class="btn btn-sm btn-primary" onclick="renderPrakompetisiPage('${data.id_kompetisi}', '${data.nama_kompetisi}')"><i class="fas fa-clipboard-list"></i> Daftar Klub</button>`
            : `<button class="btn btn-sm btn-light disabled"><i class="fas fa-lock"></i> Pendaftaran Ditutup</button>`;
        
        actionButtons = registerAction;
    }
    
    return `
        <div class="col-lg-4 col-md-6">
            <div class="card shadow h-100">
                <div class="card-header text-white ${bgColor}">
                    <h5 class="mb-0">${data.nama_kompetisi}</h5>
                </div>
                <div class="card-body">
                    <p class="card-text"><strong>Waktu:</strong> ${data.tanggal_mulai} s/d ${data.tanggal_akhir}</p>
                    <p class="card-text"><strong>Kategori:</strong> ${data.kategori}</p>
                    <p class="card-text"><strong>Status:</strong> <span class="badge ${bgColor}">${data.status}</span></p>
                </div>
                <div class="card-footer d-flex justify-content-end">
                    ${actionButtons}
                </div>
            </div>
        </div>
    `;
}

function showKompetisiForm(data = {}) {
    const isNew = !data.id_kompetisi;
    const action = isNew ? 'CREATE' : 'UPDATE';
    
    // Kategori
    const kategoriOptions = ['U-13', 'U-15', 'U-17', 'Senior'];
    const selectedKategori = data.kategori || 'Senior';
    
    // Status
    const statusOptions = ['Aktif', 'Selesai', 'Ditunda', 'Arsip'];
    const selectedStatus = data.status || 'Aktif';

    const formHtml = `
        <input type="hidden" name="action" value="${action}">
        ${isNew ? '' : `<input type="hidden" name="id_kompetisi" value="${data.id_kompetisi}">`}
        
        <div class="col-md-12">
            <label for="nama_kompetisi" class="form-label">Nama Kompetisi</label>
            <input type="text" class="form-control" id="nama_kompetisi" name="nama_kompetisi" value="${data.nama_kompetisi || ''}" required>
        </div>
        <div class="col-md-6">
            <label for="tanggal_mulai" class="form-label">Tanggal Mulai</label>
            <input type="date" class="form-control" id="tanggal_mulai" name="tanggal_mulai" value="${data.tanggal_mulai || ''}" required>
        </div>
        <div class="col-md-6">
            <label for="tanggal_akhir" class="form-label">Tanggal Akhir</label>
            <input type="date" class="form-control" id="tanggal_akhir" name="tanggal_akhir" value="${data.tanggal_akhir || ''}" required>
        </div>
        <div class="col-md-6">
            <label for="kategori" class="form-label">Kategori</label>
            <select class="form-select" id="kategori" name="kategori" required>
                ${kategoriOptions.map(k => `<option value="${k}" ${selectedKategori === k ? 'selected' : ''}>${k}</option>`).join('')}
            </select>
        </div>
        <div class="col-md-6">
            <label for="status" class="form-label">Status</label>
            <select class="form-select" id="status" name="status" required>
                ${statusOptions.map(s => `<option value="${s}" ${selectedStatus === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
        </div>
    `;

    showModalForm(`${isNew ? 'Tambah' : 'Edit'} Kompetisi`, formHtml, handleKompetisiFormSubmit, true);
}

async function handleKompetisiFormSubmit(e) {
    await handleGenericFormSubmit(e, 'CRUD_KOMPETISI', renderKompetisi);
}

function confirmDeleteKompetisi(idKompetisi) {
    showConfirmationModal(`Apakah Anda yakin ingin menghapus Kompetisi ${idKompetisi}?`, async () => {
        const data = { action: 'DELETE', id_kompetisi: idKompetisi };
        const result = await callAppsScript('CRUD_KOMPETISI', { data: JSON.stringify(data) });
        
        if (result && result.success) {
            showToast(result.message);
            renderKompetisi();
        } else if (result) {
            showToast(result.message, false);
        }
    });
}

// --- PRAKOMPETISI ---

async function renderPrakompetisiPage(idKompetisi, namaKompetisi) {
    const isPemain = document.getElementById('prakompetisiType') ? document.getElementById('prakompetisiType').value === 'pemain' : 'pemain';
    
    // Ambil data yang sudah terdaftar
    const registeredResult = await callAppsScript(isPemain ? 'GET_REGISTERED_PEMAIN' : 'GET_REGISTERED_OFFICIAL', { id_kompetisi: idKompetisi });
    const registeredIds = new Set(registeredResult.data ? registeredResult.data.map(d => isPemain ? d.id_pemain : d.id_official) : []);

    // Ambil semua data klub (pemain/official)
    const allDataResult = await callAppsScript(isPemain ? 'GET_VALID_PEMAIN' : 'GET_VALID_OFFICIAL');
    const allData = allDataResult.data ? allDataResult.data.filter(d => d.id_klub === currentUser.id_klub) : [];
    
    const itemKey = isPemain ? 'id_pemain' : 'id_official';
    const itemNameKey = isPemain ? 'nama_pemain' : 'nama_official';
    const itemDescKey = isPemain ? 'posisi' : 'jabatan';

    const tableHeaders = ['ID', 'Nama', 'Keterangan', 'Aksi'];
    const tableRows = allData.map(d => {
        const isRegistered = registeredIds.has(d[itemKey]);
        const buttonClass = isRegistered ? 'btn-danger' : 'btn-success';
        const buttonText = isRegistered ? 'Batalkan Daftar' : 'Daftar';
        const action = isRegistered ? 'false' : 'true';

        return `
            <tr>
                <td>${d[itemKey]}</td>
                <td>${d[itemNameKey]}</td>
                <td>${d[itemDescKey]}</td>
                <td>
                    <button class="btn btn-sm ${buttonClass}" onclick="handlePrakompetisiRegistration('${idKompetisi}', '${d[itemKey]}', '${d[itemNameKey]}', ${action}, '${isPemain ? 'pemain' : 'official'}')">
                        <i class="fas ${isRegistered ? 'fa-times-circle' : 'fa-check-circle'}"></i> ${buttonText}
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    contentDiv.innerHTML = `
        <h2 class="mb-4">Pendaftaran Kompetisi: ${namaKompetisi}</h2>
        <input type="hidden" id="idKompetisi" value="${idKompetisi}">
        
        <div class="mb-3">
            <label for="prakompetisiType" class="form-label">Tipe Pendaftaran</label>
            <select class="form-select w-auto" id="prakompetisiType" onchange="renderPrakompetisiPage('${idKompetisi}', '${namaKompetisi}')">
                <option value="pemain" ${isPemain ? 'selected' : ''}>Pemain</option>
                <option value="official" ${!isPemain ? 'selected' : ''}>Official</option>
            </select>
        </div>

        <div class="card shadow">
            <div class="card-body">
                <div class="table-responsive">
                    <table class="table table-hover table-striped">
                        <thead><tr>${tableHeaders.map(h => `<th>${h}</th>`).join('')}</tr></thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                </div>
            </div>
        </div>
        <button class="btn btn-secondary mt-3" onclick="renderKompetisi()"><i class="fas fa-arrow-left"></i> Kembali ke Daftar Kompetisi</button>
    `;
}

async function handlePrakompetisiRegistration(idKompetisi, idItem, itemName, isRegistered, type) {
    const sheetName = type === 'pemain' ? 'SAVE_PEMAIN_PRAKOMPETISI' : 'SAVE_OFFICIAL_PRAKOMPETISI';
    const message = isRegistered ? `Daftarkan ${itemName} ke kompetisi ini?` : `Batalkan pendaftaran ${itemName} dari kompetisi ini?`;
    
    showConfirmationModal(message, async () => {
        const data = { id_kompetisi: idKompetisi, [type === 'pemain' ? 'id_pemain' : 'id_official']: idItem };
        const result = await callAppsScript(sheetName, { 
            data: JSON.stringify(data), 
            is_registered: isRegistered
        });
        
        if (result && result.success) {
            showToast(result.message);
            // Muat ulang halaman prakompetisi setelah aksi
            const kompetisiResult = await callAppsScript('GET_LIST_KOMPETISI');
            const kompetisi = kompetisiResult.data.find(k => k.id_kompetisi === idKompetisi);
            renderPrakompetisiPage(idKompetisi, kompetisi.nama_kompetisi);
        } else if (result) {
            showToast(result.message, false);
        }
    });
}

// --- SETTING (ADMIN PUSAT) ---

async function renderSetting() {
    if (currentUser.type_users !== 'ADMIN_PUSAT') {
        contentDiv.innerHTML = `<div class="alert alert-danger">Akses Ditolak. Halaman ini hanya untuk ADMIN_PUSAT.</div>`;
        return;
    }
    
    contentDiv.innerHTML = `
        <h2 class="mb-4">Pengaturan Sistem</h2>
        
        <ul class="nav nav-tabs" id="settingTab" role="tablist">
            <li class="nav-item" role="presentation">
                <button class="nav-link active" id="banner-tab" data-bs-toggle="tab" data-bs-target="#banner-content" type="button" role="tab" aria-controls="banner-content" aria-selected="true">Banner</button>
            </li>
            <li class="nav-item" role="presentation">
                <button class="nav-link" id="userlist-tab" data-bs-toggle="tab" data-bs-target="#userlist-content" type="button" role="tab" aria-controls="userlist-content" aria-selected="false">Userlist</button>
            </li>
        </ul>
        
        <div class="tab-content p-3 border border-top-0 bg-white shadow-sm">
            <div class="tab-pane fade show active" id="banner-content" role="tabpanel" aria-labelledby="banner-tab">
                <h3>Manajemen Banner</h3>
                <button class="btn btn-primary mb-3" onclick="showBannerForm()"><i class="fas fa-plus-circle me-2"></i> Tambah Banner Baru</button>
                <div id="banner-list"></div>
            </div>
            <div class="tab-pane fade" id="userlist-content" role="tabpanel" aria-labelledby="userlist-tab">
                <h3>Manajemen Userlist</h3>
                <button class="btn btn-primary mb-3" onclick="showUserlistForm()"><i class="fas fa-user-plus me-2"></i> Tambah Pengguna Baru</button>
                <div id="userlist-table"></div>
            </div>
        </div>
    `;
    
    // Muat data saat tab aktif
    loadBannerSetting();
    // Tambahkan event listener untuk memuat Userlist saat tab diklik
    document.getElementById('userlist-tab').addEventListener('shown.bs.tab', loadUserlistSetting);
}

// --- BANNER MANAGEMENT ---

async function loadBannerSetting() {
    const result = await callAppsScript('GET_BANNER');
    const bannerData = result && result.success ? result.data : [];
    const listDiv = document.getElementById('banner-list');
    
    if (!listDiv) return;

    if (bannerData.length === 0) {
        listDiv.innerHTML = `<div class="alert alert-info">Belum ada banner terdaftar.</div>`;
        return;
    }

    listDiv.innerHTML = `
        <div class="table-responsive">
            <table class="table table-hover table-striped">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Judul</th>
                        <th>Status</th>
                        <th>Gambar</th>
                        <th>Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    ${bannerData.map(b => `
                        <tr>
                            <td>${b.id_banner}</td>
                            <td>${b.judul_banner}</td>
                            <td><span class="badge ${b.status === 'Aktif' ? 'bg-success' : 'bg-secondary'}">${b.status}</span></td>
                            <td><img src="${b.url_gambar}" style="height: 50px; object-fit: cover;" alt="Banner Image"></td>
                            <td>
                                <button class="btn btn-sm btn-info me-2" onclick="showBannerForm(${JSON.stringify(b)})"><i class="fas fa-edit"></i> Edit</button>
                                <button class="btn btn-sm btn-danger" onclick="confirmDeleteBanner('${b.id_banner}')"><i class="fas fa-trash"></i> Hapus</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function showBannerForm(data = {}) {
    const isNew = !data.id_banner;
    const action = isNew ? 'CREATE' : 'UPDATE';
    
    // Status
    const statusOptions = ['Aktif', 'Tidak Aktif'];
    const selectedStatus = data.status || 'Aktif';

    const formHtml = `
        <input type="hidden" name="action" value="${action}">
        ${isNew ? '' : `<input type="hidden" name="id_banner" value="${data.id_banner}">`}
        
        <div class="col-12">
            <label for="judul_banner" class="form-label">Judul Banner</label>
            <input type="text" class="form-control" id="judul_banner" name="judul_banner" value="${data.judul_banner || ''}" required>
        </div>
        <div class="col-12">
            <label for="deskripsi" class="form-label">Deskripsi Singkat</label>
            <textarea class="form-control" id="deskripsi" name="deskripsi" rows="2">${data.deskripsi || ''}</textarea>
        </div>
        <div class="col-md-6">
            <label for="url_gambar" class="form-label">URL Gambar</label>
            <input type="url" class="form-control" id="url_gambar" name="url_gambar" value="${data.url_gambar || ''}" placeholder="Contoh: http://domain.com/banner.jpg" required>
        </div>
        <div class="col-md-6">
            <label for="status" class="form-label">Status</label>
            <select class="form-select" id="status" name="status" required>
                ${statusOptions.map(s => `<option value="${s}" ${selectedStatus === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
        </div>
        ${data.url_gambar ? `<div class="col-12 text-center mt-3"><img src="${data.url_gambar}" alt="Banner Preview" style="max-height: 100px;"></div>` : ''}
    `;

    showModalForm(`${isNew ? 'Tambah' : 'Edit'} Banner`, formHtml, handleBannerFormSubmit);
}

async function handleBannerFormSubmit(e) {
    await handleGenericFormSubmit(e, 'CRUD_BANNER', loadBannerSetting);
}

function confirmDeleteBanner(idBanner) {
    showConfirmationModal(`Apakah Anda yakin ingin menghapus Banner ${idBanner}?`, async () => {
        const data = { action: 'DELETE', id_banner: idBanner };
        const result = await callAppsScript('CRUD_BANNER', { data: JSON.stringify(data) });
        
        if (result && result.success) {
            showToast(result.message);
            loadBannerSetting();
        } else if (result) {
            showToast(result.message, false);
        }
    });
}

// --- USERLIST MANAGEMENT ---

async function loadUserlistSetting() {
    const result = await callAppsScript('GET_USERLIST');
    const userData = result && result.success ? result.data : [];
    const tableDiv = document.getElementById('userlist-table');

    if (!tableDiv) return;
    
    if (userData.length === 0) {
        tableDiv.innerHTML = `<div class="alert alert-info">Belum ada pengguna terdaftar.</div>`;
        return;
    }

    tableDiv.innerHTML = `
        <div class="table-responsive">
            <table class="table table-hover table-striped">
                <thead>
                    <tr>
                        <th>Username</th>
                        <th>Nama Admin</th>
                        <th>Tipe</th>
                        <th>ID Klub</th>
                        <th>Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    ${userData.map(u => `
                        <tr>
                            <td>${u.username}</td>
                            <td>${u.nama_admin || '-'}</td>
                            <td><span class="badge bg-primary">${u.type_users}</span></td>
                            <td>${u.id_klub || '-'}</td>
                            <td>
                                <button class="btn btn-sm btn-info me-2" onclick="showUserlistForm(${JSON.stringify(u)})"><i class="fas fa-edit"></i> Edit</button>
                                <button class="btn btn-sm btn-danger" onclick="confirmDeleteUserlist('${u.username}')"><i class="fas fa-trash"></i> Hapus</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function showUserlistForm(data = {}) {
    const isNew = !data.username;
    const action = isNew ? 'CREATE' : 'UPDATE';
    
    const typeOptions = ['ADMIN_PUSAT', 'ADMIN_KLUB'];
    const idKlubRequired = data.type_users === 'ADMIN_KLUB';

    const formHtml = `
        <input type="hidden" name="action" value="${action}">
        
        <div class="col-md-6">
            <label for="username" class="form-label">Username</label>
            <input type="text" class="form-control" id="username" name="username" value="${data.username || ''}" ${isNew ? 'required' : 'readonly'}>
        </div>
        <div class="col-md-6">
            <label for="nama_admin" class="form-label">Nama Admin</label>
            <input type="text" class="form-control" id="nama_admin" name="nama_admin" value="${data.nama_admin || ''}">
        </div>
        <div class="col-md-6">
            <label for="password" class="form-label">Password ${isNew ? '(Wajib)' : '(Kosongkan jika tidak diubah)'}</label>
            <input type="password" class="form-control" id="password" name="password" ${isNew ? 'required' : ''}>
        </div>
        <div class="col-md-6">
            <label for="type_users" class="form-label">Tipe Pengguna</label>
            <select class="form-select" id="type_users" name="type_users" required onchange="document.getElementById('id_klub_container').style.display = this.value === 'ADMIN_KLUB' ? 'block' : 'none'; document.getElementById('id_klub').required = this.value === 'ADMIN_KLUB';">
                ${typeOptions.map(t => `<option value="${t}" ${data.type_users === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
        </div>
        <div class="col-md-12" id="id_klub_container" style="display: ${idKlubRequired ? 'block' : 'none'};">
            <label for="id_klub" class="form-label">ID Klub (Wajib untuk ADMIN_KLUB)</label>
            <input type="text" class="form-control" id="id_klub" name="id_klub" value="${data.id_klub || ''}" ${idKlubRequired ? 'required' : ''}>
        </div>
    `;

    showModalForm(`${isNew ? 'Tambah' : 'Edit'} Pengguna`, formHtml, handleUserlistFormSubmit);
}

async function handleUserlistFormSubmit(e) {
    await handleGenericFormSubmit(e, 'CRUD_USERLIST', loadUserlistSetting);
}

function confirmDeleteUserlist(username) {
    showConfirmationModal(`Apakah Anda yakin ingin menghapus pengguna ${username}?`, async () => {
        const data = { action: 'DELETE', username: username };
        const result = await callAppsScript('CRUD_USERLIST', { data: JSON.stringify(data) });
        
        if (result && result.success) {
            showToast(result.message);
            loadUserlistSetting();
        } else if (result) {
            showToast(result.message, false);
        }
    });
}
