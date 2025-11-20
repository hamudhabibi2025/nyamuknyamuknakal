// =========================================================================
// KONFIGURASI PENTING - WAJIB DIUBAH
// GANTI URL INI DENGAN URL DEPLOYMENT APPS SCRIPT ANDA (Jika menggunakan fetch)
// Catatan: Kode ini menggunakan google.script.run, jadi URL ini TIDAK DIPAKAI
// =========================================================================
const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbxxkngw3P6WXwk7CFGYOa0k7p-Y7DnL_lHQLrEx2cqi7-GdjoDV81f7RVbjW6JS_64Kcw/exec'; 
// =========================================================================

let currentUser = null;
const appContainer = document.getElementById('app-container');
let contentDiv;
let currentPage = 'home';
let globalValidPemain = []; 
let globalValidOfficial = []; 

// --- CACHING KLIN UTK MENGHEMAT LIMIT APPS SCRIPT ---
// Variabel untuk menyimpan data yang jarang berubah (Misal: List Klub, List Kompetisi Valid)
const clientCache = {
    GET_LIST_KLUB: null,
    GET_LIST_KOMPETISI: null,
    // Tambahkan properti lain yang perlu di-cache di sini
};
const CACHE_LIFETIME_MS = 300000; // 5 menit (300000 ms)

// --- CORE UTILITIES ---

function showLoading() {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) loadingOverlay.style.display = 'flex';
}

function hideLoading() {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) loadingOverlay.style.display = 'none';
}

/** * Menampilkan Toast Notifikasi
 * @param {string} message Pesan yang akan ditampilkan.
 * @param {boolean} [isSuccess=true] Apakah pesan sukses (hijau) atau error (merah).
 */
function showToast(message, isSuccess = true) {
    const toast = document.getElementById('liveToast');
    const toastBody = document.getElementById('toast-body');
    if (!toast || !toastBody) return;
    
    toast.className = `toast align-items-center text-white border-0 ${isSuccess ? 'bg-success' : 'bg-danger'}`;
    toastBody.textContent = message;
    
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
}

/** * Memanggil fungsi sisi server Google Apps Script.
 * Menggunakan google.script.run (Lebih aman dan cepat).
 * @param {string} funcName Nama fungsi yang akan dipanggil di Code.gs.
 * @param {object} params Parameter yang akan dikirim.
 * @param {boolean} [useCache=false] Apakah boleh menggunakan data cache jika tersedia.
 * @returns {Promise<object>} Hasil dari server.
 */
function callAppsScript(funcName, params = {}, useCache = false) {
    return new Promise((resolve, reject) => {
        
        // 1. Cek Cache (Hanya untuk fungsi GET)
        if (useCache && clientCache[funcName] && (Date.now() - clientCache[funcName].timestamp < CACHE_LIFETIME_MS)) {
            console.log(`[CACHE HIT] Mengambil data dari cache: ${funcName}`);
            resolve(clientCache[funcName].data);
            return; // Hentikan panggilan ke Apps Script
        }
        
        showLoading();
        
        // 2. Jika tidak ada cache atau kadaluarsa, panggil Apps Script
        google.script.run
            .withSuccessHandler(resultString => {
                hideLoading();
                const result = JSON.parse(resultString);
                
                if (result && result.success) {
                    
                    // 3. Simpan ke Cache jika berhasil
                    if (useCache && funcName.startsWith('GET_')) {
                        clientCache[funcName] = { 
                            data: result, 
                            timestamp: Date.now() 
                        };
                        console.log(`[CACHE MISS] Menyimpan data ke cache: ${funcName}`);
                    }
                    
                    resolve(result);
                } else {
                    showToast(result.message || "Terjadi kesalahan server yang tidak diketahui.", false);
                    reject(result);
                }
            })
            .withFailureHandler(error => {
                hideLoading();
                showToast(`Gagal memanggil server: ${error.message}`, false);
                reject(error);
            })
            // Tambahkan parameter wajib untuk Apps Script Handler
            .handleServerRequest({
                action: funcName,
                user_data: JSON.stringify(currentUser),
                ...params
            });
    });
}

function showConfirmationModal(message, confirmAction) {
    const modal = new bootstrap.Modal(document.getElementById('confirmationModal'));
    document.getElementById('confirmationMessage').textContent = message;
    document.getElementById('confirmButton').onclick = () => {
        confirmAction();
        modal.hide();
    };
    modal.show();
}

function showModalForm(title, bodyHtml, submitHandler) {
    const modal = new bootstrap.Modal(document.getElementById('formModal'), { backdrop: 'static', keyboard: false });
    document.getElementById('formModalLabel').textContent = title;
    document.getElementById('formModalBody').innerHTML = bodyHtml;
    
    const form = document.getElementById('mainForm');
    if (form) {
        // Hapus event listener lama
        form.removeEventListener('submit', form.submitListener);
        // Tambahkan event listener baru
        form.submitListener = submitHandler;
        form.addEventListener('submit', form.submitListener);
    }
    
    modal.show();
}

function hideModalForm() {
    const modalEl = document.getElementById('formModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) {
        modal.hide();
    }
}

/**
 * Handle submit form CRUD generik
 */
async function handleGenericFormSubmit(e, actionName, fieldsToValidate = [], callbackSuccess = null, useJson = true) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    const data = {};
    
    for (const [key, value] of formData.entries()) {
        data[key] = value.trim();
    }
    
    // Validasi Dasar
    for (const field of fieldsToValidate) {
        if (!data[field]) {
            showToast(`Kolom ${field.replace('_', ' ')} wajib diisi.`, false);
            return;
        }
    }

    let params = {};
    if (useJson) {
        params.data = JSON.stringify(data);
    } else {
        // Jika tidak menggunakan JSON, kirim sebagai parameter flat (untuk save prakompetisi)
        params = data;
    }
    
    const result = await callAppsScript(actionName, params);
    
    if (result && result.success) {
        showToast(result.message, true);
        hideModalForm();
        if (callbackSuccess) {
            callbackSuccess();
        }
    }
}

// Tambahkan Fungsi toggleSidebar (Untuk Responsif Mobile)
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) sidebar.classList.toggle('active');
    if (backdrop) backdrop.classList.toggle('active');
}
// ------------------------------------

// --- AUTHENTICATION ---

function renderApp() {
    // Tambahkan modal ke DOM (hanya sekali)
    if (!document.getElementById('formModal')) {
        document.body.insertAdjacentHTML('beforeend', getModalHtml());
    }
    
    if (localStorage.getItem('currentUser')) {
        try {
            currentUser = JSON.parse(localStorage.getItem('currentUser'));
            renderMainLayout();
            renderPage(currentPage);
        } catch (e) {
            handleLogout();
        }
    } else {
        renderLoginPage();
    }
}

function renderLoginPage() {
    appContainer.innerHTML = `
        <div id="login-page">
            <form id="login-form" class="shadow-lg">
                <h3 class="text-center mb-4 text-primary"><i class="fas fa-futbol me-2"></i>SIPAKEM Login</h3>
                <div class="mb-3">
                    <label for="username" class="form-label">Username</label>
                    <input type="text" class="form-control" id="username" required>
                </div>
                <div class="mb-3">
                    <label for="password" class="form-label">Password</label>
                    <input type="password" class="form-control" id="password" required>
                </div>
                <button type="submit" class="btn btn-primary w-100">Login</button>
                <p class="mt-3 text-muted text-center" style="font-size: 0.8rem;">Sistem Informasi PSSI Kepulauan Mentawai</p>
            </form>
        </div>
    `;
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    hideLoading();
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    
    const result = await callAppsScript('HANDLE_LOGIN', { username, password });
    
    if (result && result.success) {
        currentUser = result.user;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        showToast(result.message);
        renderApp();
    }
}

function handleLogout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    renderLoginPage();
    // Clear cache saat logout
    for (const key in clientCache) {
        clientCache[key] = null;
    }
    showToast("Anda telah logout.", true);
}


// --- LAYOUT & NAVIGATION ---

function renderMainLayout() {
    appContainer.innerHTML = `
        <div id="sidebar-backdrop" class="sidebar-backdrop d-lg-none" onclick="toggleSidebar()"></div> 
        
        <nav class="navbar navbar-expand-lg navbar-dark bg-dark fixed-top">
            <div class="container-fluid">
                <button class="navbar-toggler navbar-toggler-desktop-hide me-3" type="button" onclick="toggleSidebar()">
                    <span class="navbar-toggler-icon"></span>
                </button>
                <a class="navbar-brand" href="#" onclick="renderPage('home')"><i class="fas fa-futbol me-2"></i>SIPAKEM</a>
                
                <div class="d-flex align-items-center ms-auto">
                    <span class="navbar-user-info d-none d-lg-inline me-3">
                        Selamat Datang, ${currentUser.nama_admin || currentUser.username} (${currentUser.type_users})
                    </span>
                    <button class="btn btn-outline-light btn-sm" onclick="handleLogout()">
                        <i class="fas fa-sign-out-alt d-lg-none"></i> 
                        <span class="d-none d-lg-inline">Logout</span>
                    </button>
                </div>
            </div>
        </nav>
        
        <div id="sidebar" class="sidebar bg-dark"></div>
        
        <div id="main-content" class="content"></div>
    `;
    contentDiv = document.getElementById('main-content');
    renderSidebar();
    
    // Sembunyikan sidebar saat pertama kali dimuat di desktop agar transisi lancar
    if (window.innerWidth >= 992) {
        document.getElementById('sidebar').classList.add('active');
    }
}

function renderSidebar() {
    const sidebarDiv = document.getElementById('sidebar');
    const userType = currentUser.type_users;
    
    const menuItems = [
        { id: 'home', icon: 'fas fa-home', text: 'Beranda', required: ['ADMIN_PROV', 'ADMIN_ASKOT', 'ADMIN_KLUB'] },
        { id: 'klublist', icon: 'fas fa-shield-alt', text: 'Master Klub', required: ['ADMIN_PROV', 'ADMIN_ASKOT'] },
        { id: 'pemainlist', icon: 'fas fa-users', text: 'Master Pemain', required: ['ADMIN_PROV', 'ADMIN_ASKOT'] },
        { id: 'officiallist', icon: 'fas fa-user-tie', text: 'Master Official', required: ['ADMIN_PROV', 'ADMIN_ASKOT'] },
        { id: 'kompetisi', icon: 'fas fa-trophy', text: 'Kompetisi', required: ['ADMIN_PROV', 'ADMIN_ASKOT', 'ADMIN_KLUB'] },
        { id: 'setting', icon: 'fas fa-cogs', text: 'Pengaturan', required: ['ADMIN_PROV'] },
    ];
    
    const navHtml = menuItems
        .filter(item => item.required.includes(userType))
        .map(item => `
            <li class="nav-item">
                <a class="nav-link ${currentPage === item.id ? 'active' : ''}" 
                   href="#" 
                   onclick="renderPage('${item.id}'); toggleSidebar();">
                    <i class="${item.icon} me-2"></i> ${item.text}
                </a>
            </li>
        `).join('');

    sidebarDiv.innerHTML = `
        <ul class="nav flex-column p-3">
            <li class="nav-item mb-2 text-center border-bottom border-secondary pb-3">
                <span class="text-white fw-bold">${currentUser.nama_admin || currentUser.username}</span>
                <br><span class="badge text-bg-primary">${currentUser.type_users}</span>
            </li>
            ${navHtml}
        </ul>
    `;
}

async function renderPage(pageId, params = {}) {
    if (contentDiv) {
        showLoading();
        currentPage = pageId;
        renderSidebar(); // Update status active di sidebar
        
        // Sembunyikan sidebar di mobile setelah navigasi
        if (window.innerWidth < 992) {
            toggleSidebar();
        }

        switch (pageId) {
            case 'home':
                renderHome();
                break;
            case 'klublist':
                await loadKlublist();
                break;
            case 'pemainlist':
                await loadPemainlist();
                break;
            case 'officiallist':
                await loadOfficiallist();
                break;
            case 'kompetisi':
                await loadKompetisi();
                break;
            case 'kompetisi_detail':
                renderKompetisiForm(params.id);
                break;
            case 'setting':
                await loadUserlistSetting();
                break;
            default:
                renderHome();
        }
        hideLoading();
    } else {
        renderApp(); // Render ulang jika contentDiv belum siap
    }
}

// --- HOME PAGE ---

let currentData = {
    klublist: [],
    listKompetisi: [],
    pemainlist: [],
    officiallist: [],
    userlist: [],
};

function renderHome() {
    contentDiv.innerHTML = `
        <h1 class="mb-4">Dashboard</h1>
        <p class="lead">Selamat datang di Sistem Informasi PSSI Kepulauan Mentawai (SIPAKEM).</p>
        
        <div class="row g-4">
            <div class="col-md-4">
                <div class="card bg-primary text-white shadow-sm">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <h5 class="card-title">Total Klub</h5>
                                <p class="card-text fs-2 fw-bold">${currentData.klublist.length}</p>
                            </div>
                            <i class="fas fa-shield-alt fa-3x"></i>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card bg-success text-white shadow-sm">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <h5 class="card-title">Total Pemain</h5>
                                <p class="card-text fs-2 fw-bold">${currentData.pemainlist.length}</p>
                            </div>
                            <i class="fas fa-users fa-3x"></i>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card bg-info text-white shadow-sm">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <h5 class="card-title">Kompetisi Aktif</h5>
                                <p class="card-text fs-2 fw-bold">${currentData.listKompetisi.filter(k => k.status_kompetisi === 'Aktif').length}</p>
                            </div>
                            <i class="fas fa-trophy fa-3x"></i>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="card mt-4 shadow-sm">
            <div class="card-header bg-white">
                Informasi Pengguna
            </div>
            <div class="card-body">
                <p><strong>Username:</strong> ${currentUser.username}</p>
                <p><strong>Nama:</strong> ${currentUser.nama_admin}</p>
                <p><strong>Tipe Akses:</strong> <span class="badge text-bg-secondary">${currentUser.type_users}</span></p>
                ${currentUser.id_klub ? `<p><strong>ID Klub Terkait:</strong> ${currentUser.id_klub}</p>` : ''}
            </div>
        </div>
    `;
    
    // Panggil data untuk dashboard
    loadKlublist(true);
    loadPemainlist(true);
    loadKompetisi(true);
}

// --- MASTER DATA: KLUB ---

async function loadKlublist(silent = false) {
    if (!silent) showLoading();
    // Menggunakan caching (true) untuk menghemat limit GAS
    const result = await callAppsScript('GET_LIST_KLUB', {}, true); 
    
    if (result && result.success) {
        currentData.klublist = result.data;
        if (!silent) renderKlublistTable(currentData.klublist);
    }
    if (!silent) hideLoading();
}

function renderKlublistTable(data) {
    contentDiv.innerHTML = `
        <h1 class="mb-4">Master Data Klub</h1>
        <div class="card shadow-sm">
            <div class="card-header d-flex justify-content-between align-items-center bg-white">
                Daftar Klub Terdaftar
                <button class="btn btn-primary btn-sm" onclick="renderKlubForm()"><i class="fas fa-plus me-1"></i> Tambah Klub</button>
            </div>
            <div class="card-body p-0">
                <div class="table-responsive">
                    <table class="table table-striped table-hover table-sm mb-0">
                        <thead class="table-dark">
                            <tr>
                                <th style="width: 1%;">#</th>
                                <th>ID Klub</th>
                                <th>Nama Klub</th>
                                <th>Ketua Klub</th>
                                <th>Tgl Berdiri</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.map((klub, index) => `
                                <tr>
                                    <td>${index + 1}</td>
                                    <td>${klub.id_klub}</td>
                                    <td>${klub.nama_klub}</td>
                                    <td>${klub.ketua_klub}</td>
                                    <td>${klub.tanggal_berdiri}</td>
                                    <td>
                                        <button class="btn btn-sm btn-warning me-1" onclick="renderKlubForm('${klub.id_klub}')"><i class="fas fa-edit"></i></button>
                                        <button class="btn btn-sm btn-danger" onclick="confirmDeleteKlub('${klub.id_klub}', '${klub.nama_klub}')"><i class="fas fa-trash"></i></button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function renderKlubForm(id_klub = null) {
    const isNew = id_klub === null;
    const data = isNew ? {} : currentData.klublist.find(k => k.id_klub === id_klub) || {};

    const formHtml = `
        <form id="mainForm" data-action="${isNew ? 'CREATE' : 'UPDATE'}">
            <div class="row g-3">
                <div class="col-md-6">
                    <label for="id_klub" class="form-label">ID Klub</label>
                    <input type="text" class="form-control" id="id_klub" name="id_klub" value="${data.id_klub || ''}" ${isNew ? 'required' : 'readonly'}>
                </div>
                <div class="col-md-6">
                    <label for="nama_klub" class="form-label">Nama Klub</label>
                    <input type="text" class="form-control" id="nama_klub" name="nama_klub" value="${data.nama_klub || ''}" required>
                </div>
                <div class="col-md-6">
                    <label for="ketua_klub" class="form-label">Ketua Klub</label>
                    <input type="text" class="form-control" id="ketua_klub" name="ketua_klub" value="${data.ketua_klub || ''}">
                </div>
                <div class="col-md-6">
                    <label for="tanggal_berdiri" class="form-label">Tanggal Berdiri</label>
                    <input type="date" class="form-control" id="tanggal_berdiri" name="tanggal_berdiri" value="${data.tanggal_berdiri || ''}">
                </div>
            </div>
            <div class="modal-footer mt-4">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button>
                <button type="submit" class="btn btn-primary">Simpan</button>
            </div>
        </form>
    `;

    showModalForm(`${isNew ? 'Tambah' : 'Edit'} Klub`, formHtml, handleKlubFormSubmit);
}

async function handleKlubFormSubmit(e) {
    await handleGenericFormSubmit(e, 'CRUD_KLUB', ['id_klub', 'nama_klub'], loadKlublist);
}

function confirmDeleteKlub(id_klub, nama_klub) {
    showConfirmationModal(`Apakah Anda yakin ingin menghapus Klub ${nama_klub} (${id_klub})?`, async () => {
        const data = { action: 'DELETE', id_klub: id_klub };
        const result = await callAppsScript('CRUD_KLUB', { data: JSON.stringify(data) });
        
        if (result && result.success) {
            showToast(result.message, true);
            loadKlublist();
        }
    });
}

// --- MASTER DATA: PEMAIN ---
// (Fungsi Master Pemain Dihilangkan/Disimpan Saja karena terlalu panjang, tapi logika CRUD-nya sama)

async function loadPemainlist(silent = false) {
    if (!silent) showLoading();
    const result = await callAppsScript('GET_LIST_PEMAIN'); 
    if (result && result.success) {
        currentData.pemainlist = result.data;
        if (!silent) renderPemainlistTable(currentData.pemainlist);
        globalValidPemain = currentData.pemainlist.map(p => ({ id: p.id_pemain, nama: p.nama_pemain }));
    }
    if (!silent) hideLoading();
}

// ... (renderPemainlistTable, renderPemainForm, handlePemainFormSubmit, confirmDeletePemain) ...
// Asumsi: Kode CRUD Pemain dan Official sudah ada dan menggunakan callAppsScript

// --- MASTER DATA: OFFICIAL ---
// (Fungsi Master Official Dihilangkan/Disimpan Saja karena terlalu panjang, tapi logika CRUD-nya sama)

async function loadOfficiallist(silent = false) {
    if (!silent) showLoading();
    const result = await callAppsScript('GET_LIST_OFFICIAL'); 
    if (result && result.success) {
        currentData.officiallist = result.data;
        if (!silent) renderOfficiallistTable(currentData.officiallist);
        globalValidOfficial = currentData.officiallist.map(o => ({ id: o.id_official, nama: o.nama_official }));
    }
    if (!silent) hideLoading();
}

// ... (renderOfficiallistTable, renderOfficialForm, handleOfficialFormSubmit, confirmDeleteOfficial) ...
// Asumsi: Kode CRUD Pemain dan Official sudah ada dan menggunakan callAppsScript

// --- KOMPETISI ---

async function loadKompetisi(silent = false) {
    if (!silent) showLoading();
    // Menggunakan caching (true) untuk menghemat limit GAS
    const result = await callAppsScript('GET_LIST_KOMPETISI', {}, true); 
    
    if (result && result.success) {
        currentData.listKompetisi = result.data;
        if (!silent) renderKompetisiTable(currentData.listKompetisi);
    }
    if (!silent) hideLoading();
}

function renderKompetisiTable(data) {
    // ... (Logika render tabel kompetisi sama) ...
    contentDiv.innerHTML = `
        <h1 class="mb-4">Daftar Kompetisi</h1>
        <div class="card shadow-sm">
            <div class="card-header d-flex justify-content-between align-items-center bg-white">
                Daftar Kompetisi
                ${(currentUser.type_users === 'ADMIN_PROV' || currentUser.type_users === 'ADMIN_ASKOT') ? 
                    `<button class="btn btn-primary btn-sm" onclick="renderKompetisiForm(null, true)"><i class="fas fa-plus me-1"></i> Tambah Kompetisi</button>` 
                    : ''}
            </div>
            <div class="card-body p-0">
                <div class="table-responsive">
                    <table class="table table-striped table-hover table-sm mb-0">
                        <thead class="table-dark">
                            <tr>
                                <th style="width: 1%;">#</th>
                                <th>ID Kompetisi</th>
                                <th>Nama Kompetisi</th>
                                <th>Tahun</th>
                                <th>Status</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.map((kompetisi, index) => `
                                <tr>
                                    <td>${index + 1}</td>
                                    <td>${kompetisi.id_kompetisi}</td>
                                    <td>${kompetisi.nama_kompetisi}</td>
                                    <td>${kompetisi.tahun}</td>
                                    <td><span class="badge text-bg-${kompetisi.status_kompetisi === 'Aktif' ? 'success' : 'secondary'}">${kompetisi.status_kompetisi}</span></td>
                                    <td>
                                        <button class="btn btn-sm btn-info me-1" onclick="renderPage('kompetisi_detail', { id: '${kompetisi.id_kompetisi}' })"><i class="fas fa-eye"></i> Detail</button>
                                        ${(currentUser.type_users === 'ADMIN_PROV' || currentUser.type_users === 'ADMIN_ASKOT') ? `
                                            <button class="btn btn-sm btn-warning me-1" onclick="renderKompetisiForm('${kompetisi.id_kompetisi}')"><i class="fas fa-edit"></i></button>
                                            <button class="btn btn-sm btn-danger" onclick="confirmDeleteKompetisi('${kompetisi.id_kompetisi}', '${kompetisi.nama_kompetisi}')"><i class="fas fa-trash"></i></button>
                                        ` : ''}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

// Tambahkan table-responsive pada bagian pendaftaran pemain/official
function renderKompetisiForm(idKompetisi = null, isMasterForm = false) {
    const data = currentData.listKompetisi.find(k => k.id_kompetisi === idKompetisi) || {};
    const isNew = idKompetisi === null && isMasterForm;

    // ... (Logika master form untuk ADMIN_PROV/ASKOT) ...

    // Jika ADMIN_KLUB atau tampilan detail
    if (!isNew && currentUser.type_users !== 'ADMIN_PROV' && currentUser.type_users !== 'ADMIN_ASKOT') {
        // Tampilan Detail dan Pendaftaran Klub
        contentDiv.innerHTML = `
            <h1 class="mb-4">${data.nama_kompetisi} (${data.tahun})</h1>
            <p class="lead">Pendaftaran Skuad Klub ${currentUser.id_klub} untuk Kompetisi ini.</p>
            
            <div class="row g-4">
                
                <div class="col-12">
                    <div class="card shadow-sm">
                        <div class="card-header bg-primary text-white">
                            <i class="fas fa-users me-2"></i> Daftar Pemain
                        </div>
                        <div class="card-body">
                            <div class="mb-3 d-flex justify-content-between align-items-center">
                                <button class="btn btn-sm btn-success" onclick="addRowPemain()"><i class="fas fa-plus me-1"></i> Tambah Baris Pemain</button>
                                <button class="btn btn-sm btn-primary" onclick="savePemainPrakompetisi('${idKompetisi}')"><i class="fas fa-save me-1"></i> Simpan Daftar Pemain</button>
                            </div>
                            
                            <div class="table-responsive"> 
                                <table class="table table-bordered table-striped table-sm">
                                    <thead>
                                        <tr>
                                            <th style="width: 1%;">No.</th>
                                            <th style="min-width: 150px;">Pemain</th>
                                            <th style="min-width: 100px;">Posisi</th>
                                            <th style="width: 100px;">No. Punggung</th>
                                            <th style="width: 1%;">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody id="pemain-prakompetisi-body"></tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="col-12">
                    <div class="card shadow-sm">
                        <div class="card-header bg-success text-white">
                            <i class="fas fa-user-tie me-2"></i> Daftar Official
                        </div>
                        <div class="card-body">
                            <div class="mb-3 d-flex justify-content-between align-items-center">
                                <button class="btn btn-sm btn-success" onclick="addRowOfficial()"><i class="fas fa-plus me-1"></i> Tambah Baris Official</button>
                                <button class="btn btn-sm btn-primary" onclick="saveOfficialPrakompetisi('${idKompetisi}')"><i class="fas fa-save me-1"></i> Simpan Daftar Official</button>
                            </div>
                            
                            <div class="table-responsive">
                                <table class="table table-bordered table-striped table-sm">
                                    <thead>
                                        <tr>
                                            <th style="width: 1%;">No.</th>
                                            <th style="min-width: 150px;">Official</th>
                                            <th style="min-width: 100px;">Jabatan</th>
                                            <th style="width: 1%;">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody id="official-prakompetisi-body"></tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <button class="btn btn-secondary mt-4" onclick="loadKompetisi()">Kembali ke Daftar Kompetisi</button>
        `;
        loadPemainOfficialPrakompetisi(idKompetisi);
    } 
    // ... (Logika master form dan fungsi CRUD lainnya dihilangkan karena terlalu panjang)
}

// ... (Logika loadPemainOfficialPrakompetisi, addRowPemain, savePemainPrakompetisi, dll. tidak diubah)

// --- MODAL HTML ---

function getModalHtml() {
    return `
        <div class="modal fade" id="formModal" tabindex="-1" aria-labelledby="formModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title" id="formModalLabel">Formulir Data</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body" id="formModalBody">
                        </div>
                </div>
            </div>
        </div>

        <div class="modal fade" id="confirmationModal" tabindex="-1" aria-labelledby="confirmationModalLabel" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header bg-danger text-white">
                        <h5 class="modal-title" id="confirmationModalLabel">Konfirmasi Hapus</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <p id="confirmationMessage"></p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button>
                        <button type="button" class="btn btn-danger" id="confirmButton">Hapus</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Panggil renderApp() saat DOM selesai dimuat
document.addEventListener('DOMContentLoaded', renderApp);
