// =========================================================================
// KONFIGURASI PENTING - WAJIB DIUBAH
// GANTI URL INI DENGAN URL DEPLOYMENT APPS SCRIPT ANDA
// =========================================================================
const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbzqItCd_Wbep_pQP5Carx-J6_Pu3YiiLa1DxHET2yvVWBzGCw-qYq1Flox-rqfHZ8pBEw/exec'; 
// GANTI DENGAN URL DEPLOYMENT APPS SCRIPT ANDA
// =========================================================================

// --- KONFIGURASI FRONTEND TAMBAHAN (Poin 2 & 3) ---
const PSSI_LOGO_URL = 'https://upload.wikimedia.org/wikipedia/id/thumb/a/a2/PSSI_logo.svg/1200px-PSSI_logo.svg.png'; // Ganti dengan URL Logo PSSI Anda
const SESSION_TIMEOUT_MINUTES = 30; // Waktu habis sesi (dalam menit) - Poin 3

let currentUser = null;
const appContainer = document.getElementById('app-container');
let contentDiv;
let currentPage = 'home';
let globalValidPemain = []; 
let globalValidOfficial = []; 
let globalKompetisi = [];
let globalCurrentKompetisi = null;

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

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });
}

function previewImage(event, elementId) {
    const reader = new FileReader();
    reader.onload = function(){
        const output = document.getElementById(elementId);
        if (output) output.src = reader.result;
    };
    reader.readAsDataURL(event.target.files[0]);
}

function calculateAge(birthDate) {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age;
}

// Cek apakah data masih bisa di-edit (Poin 4)
function isEditable(timestamp, userType) {
    if (userType === 'ADMIN_PUSAT') return true;
    if (!timestamp) return false; 

    const timeDiff = new Date().getTime() - new Date(timestamp).getTime();
    // Gunakan 3 hari (72 jam) di frontend untuk mencocokkan logika backend
    const CLUB_EDIT_LIMIT_MS = 3 * 24 * 60 * 60 * 1000; 
    return timeDiff < CLUB_EDIT_LIMIT_MS; 
}


// --- Session Timeout Logic (Poin 3) ---
function extendSession() {
    sessionStorage.setItem('lastActivity', new Date().getTime());
}

function checkTimeout() {
    const lastActivity = sessionStorage.getItem('lastActivity');
    if (!lastActivity || !currentUser) return; 
    
    const currentTime = new Date().getTime();
    const timeoutMs = SESSION_TIMEOUT_MINUTES * 60 * 1000;

    if (currentTime - lastActivity > timeoutMs) {
        if (window.sessionCheckInterval) clearInterval(window.sessionCheckInterval); 
        showToast(`Sesi berakhir setelah ${SESSION_TIMEOUT_MINUTES} menit tidak aktif. Silakan login kembali.`, false);
        handleLogout(false); 
        return true;
    }
    return false;
}
// --- END: Session Timeout Logic ---

// Ubah showModalForm untuk tampilan mobile (Poin 1)
function showModalForm(title, formHtml, onSubmitFunction, customFooterHtml = '') {
    const modalId = 'genericModal';
    const existingModal = document.getElementById(modalId);
    if (existingModal) existingModal.remove();
    
    const defaultFooter = `
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button>
        <button type="submit" class="btn btn-primary" id="modalSubmitButton">Simpan</button>
    `;
    const footerContent = customFooterHtml || defaultFooter;

    const modalHtml = `
        <div class="modal fade" id="${modalId}" tabindex="-1" aria-labelledby="${modalId}Label" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable"> 
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="${modalId}Label">${title}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <form id="generic-form">
                        <div class="modal-body row g-2"> 
                            ${formHtml}
                        </div>
                        <div class="modal-footer justify-content-between">
                            ${footerContent}
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modalElement = document.getElementById(modalId);
    const modal = new bootstrap.Modal(modalElement);
    modal.show();

    modalElement.addEventListener('hidden.bs.modal', () => modalElement.remove());
    if (onSubmitFunction) {
        const formElement = document.getElementById('generic-form');
        if (formElement) formElement.addEventListener('submit', onSubmitFunction);
    }
    
    return { modal, modalElement };
}

function showConfirmationModal(message, onConfirm) {
    const modalId = 'confirmationModal';
    const existingModal = document.getElementById(modalId);
    if (existingModal) existingModal.remove();

    const modalHtml = `
        <div class="modal fade" id="${modalId}" tabindex="-1" aria-labelledby="${modalId}Label" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="${modalId}Label">Konfirmasi Aksi</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        ${message}
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button>
                        <button type="button" class="btn btn-danger" id="confirmActionButton">Ya, Lanjutkan</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modalElement = document.getElementById(modalId);
    const modal = new bootstrap.Modal(modalElement);

    document.getElementById('confirmActionButton').onclick = () => {
        modal.hide();
        onConfirm();
    };
    modalElement.addEventListener('hidden.bs.modal', () => modalElement.remove());
    modal.show();
}

// Update callAppsScript untuk session timeout (Poin 3)
async function callAppsScript(action, params = {}) {
    // Check timeout sebelum call
    if (checkTimeout() && action !== 'CHECK_AUTH') {
        return { success: false, message: "Sesi berakhir. Silakan login kembali." }; 
    }
    
    const finalParams = new URLSearchParams({
        action: action,
        user: JSON.stringify(currentUser),
        ...params
    });
    showLoading();
    
    try {
        extendSession(); // Perpanjang sesi sebelum mengirim request
        const response = await fetch(GAS_API_URL, {
            method: 'POST',
            body: finalParams,
        });
        const result = await response.json();
        
        if (!result.success && result.message && result.message.includes('Akses ditolak. Mohon login.')) {
            handleLogout(false);
        }
        
        return result;
        
    } catch (error) {
        console.error("Error calling Apps Script:", error);
        return { success: false, message: `Terjadi kesalahan jaringan: ${error.message}` };
    } finally {
        hideLoading();
    }
}

async function handleGenericFormSubmit(e, action, fileFields = [], callbackSuccess) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const data = {};

    for (let [key, value] of formData.entries()) {
        if (value instanceof File && value.name === '') {
            // Jika file kosong, gunakan nilai lama (URL)
            data[key] = form.elements[key].dataset.oldValue || ''; 
        } else {
            data[key] = value;
        }
    }
    
    // Process files (Diusulkan: upload di frontend untuk menghemat limit GAS)
    const fileUploadPromises = [];
    for (const field of fileFields) {
        const fileInput = form.elements[field];
        if (fileInput && fileInput.files.length > 0) {
            fileUploadPromises.push(
                fileToBase64(fileInput.files[0]).then(base64Content => {
                    return callAppsScript('UPLOAD_IMAGE', { base64Data: base64Content }).then(result => {
                        if (result.success) {
                            return { field, url: result.url };
                        } else {
                            throw new Error(result.message);
                        }
                    });
                })
            );
        }
    }
    
    if (fileUploadPromises.length > 0) {
        try {
            const uploadedFiles = await Promise.all(fileUploadPromises);
            uploadedFiles.forEach(item => {
                data[item.field] = item.url;
            });
        } catch (error) {
            showToast(`Gagal mengupload salah satu gambar: ${error.message}`, false);
            return;
        }
    }

    // Peringatan: Password tidak di-hash di frontend, dibiarkan di-hash di backend (Code.gs)
    if (data.action === 'UPDATE' && data.password === '') {
        delete data.password; // Jangan kirim password kosong, biarkan backend mempertahankan yang lama
    }

    const result = await callAppsScript(action, { data: JSON.stringify(data) });

    if (result && result.success) {
        showToast(result.message);
        const modalElement = document.getElementById('genericModal');
        if (modalElement) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) modal.hide();
        }
        if (callbackSuccess) await callbackSuccess();
    } else {
        showToast(result.message || "Gagal menyimpan data.", false);
    }
}


// --- APP FLOW & AUTHENTICATION ---

function renderApp() {
    currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    if (currentUser) {
        if (!checkTimeout()) { // Poin 3: Cek timeout saat render
            extendSession(); // Poin 3: Perpanjang sesi pada render
            renderMainLayout();
            renderPage('home');
        }
    } else {
        renderLoginPage();
    }
}

// Perbaikan renderLoginPage untuk mobile (Poin 1 & 2)
function renderLoginPage() {
    if (window.sessionCheckInterval) clearInterval(window.sessionCheckInterval); 
    appContainer.innerHTML = `
        <div id="login-page">
            <div id="login-form">
                <div class="text-center mb-4">
                    <img src="${PSSI_LOGO_URL}" alt="PSSI Logo" style="height: 60px; margin-bottom: 10px;">
                    <h5 class="text-primary fw-bold">Sistem Informasi PSSI Kepulauan Mentawai (SIPAKEM)</h5>
                </div>
                <form id="auth-form">
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
        </div>
    `;
    document.getElementById('auth-form').addEventListener('submit', handleLogin);
}

async function handleLogin(e) {
    e.preventDefault();
    const form = e.target;
    const username = form.username.value;
    const password = form.password.value;

    const result = await callAppsScript('CHECK_AUTH', { username, password });

    if (result && result.success) {
        currentUser = result.user;
        sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
        showToast('Login Berhasil! Selamat datang.');
        renderApp();
    } else {
        showToast(result.message || 'Login Gagal. Cek username dan password Anda.', false);
    }
}

function handleLogout(showGoodbye = true) {
    sessionStorage.removeItem('currentUser');
    sessionStorage.removeItem('lastActivity'); 
    currentUser = null;
    if (showGoodbye) {
        showToast('Anda telah logout. Sampai jumpa!');
    }
    if (window.sessionCheckInterval) clearInterval(window.sessionCheckInterval); 
    renderApp();
}

// Perbaikan renderMainLayout untuk mobile (Poin 1 & 2)
function renderMainLayout() {
    appContainer.innerHTML = `
        <nav class="navbar navbar-expand-lg navbar-dark bg-dark fixed-top"> 
            <div class="container-fluid">
                <a class="navbar-brand d-flex align-items-center" href="#" onclick="renderPage('home')">
                    <img src="${PSSI_LOGO_URL}" alt="PSSI Logo" style="height: 30px; margin-right: 10px;">
                    <span class="d-none d-md-inline">Sistem Informasi PSSI Mentawai (SIPAKEM)</span>
                    <span class="d-md-none">SIPAKEM</span>
                </a>
                <div class="d-flex align-items-center">
                    <span class="navbar-user-info me-3 d-none d-lg-inline">
                        Selamat Datang, ${currentUser.nama_admin || currentUser.username} (${currentUser.type_users})
                    </span>
                    <button class="btn btn-outline-light btn-sm" onclick="handleLogout()">
                        <i class="fas fa-sign-out-alt"></i> <span class="d-none d-sm-inline">Logout</span>
                    </button>
                </div>
            </div>
        </nav>
        <div id="sidebar" class="sidebar bg-dark d-none d-md-block"></div>
        <div id="main-content" class="content"></div>
    `;
    contentDiv = document.getElementById('main-content');
    
    // Poin 3: Set up periodic check for session timeout (every 1 minute)
    if (window.sessionCheckInterval) clearInterval(window.sessionCheckInterval);
    window.sessionCheckInterval = setInterval(checkTimeout, 60000); 

    renderNavigation(); 
}

// Render Navigation (Sidebar untuk Desktop, Bottom Nav untuk Mobile - Poin 1)
async function renderNavigation() {
    const clubInfo = await callAppsScript('GET_PROFIL_KLUB');
    const isProfilExist = clubInfo && clubInfo.success && clubInfo.data && !Array.isArray(clubInfo.data) && clubInfo.data.id_klub;
    
    // Simpan status profil klub di sessionStorage untuk bottom nav
    sessionStorage.setItem('isProfilExist', isProfilExist); 

    const navItems = [];
    navItems.push({ page: 'home', icon: 'fas fa-home', text: 'Home' });

    if (currentUser.type_users.startsWith('ADMIN_KLUB')) {
        navItems.push({ page: 'profil', icon: 'fas fa-building', text: 'Profil Klub' });
        if (isProfilExist) {
            navItems.push({ page: 'pemain', icon: 'fas fa-running', text: 'Pemain' });
            navItems.push({ page: 'official', icon: 'fas fa-chalkboard-teacher', text: 'Official' });
        } else {
            navItems.push({ page: 'pemain', icon: 'fas fa-running', text: 'Pemain', disabled: true, title: 'Daftar Profil Klub terlebih dahulu' });
            navItems.push({ page: 'official', icon: 'fas fa-chalkboard-teacher', text: 'Official', disabled: true, title: 'Daftar Profil Klub terlebih dahulu' });
        }
        navItems.push({ page: 'kompetisi', icon: 'fas fa-trophy', text: 'Kompetisi' });
    } else if (currentUser.type_users === 'ADMIN_PUSAT') {
        navItems.push({ page: 'profil', icon: 'fas fa-building', text: 'Semua Klub' });
        navItems.push({ page: 'pemain', icon: 'fas fa-running', text: 'Semua Pemain' });
        navItems.push({ page: 'official', icon: 'fas fa-chalkboard-teacher', text: 'Semua Official' });
        navItems.push({ page: 'kompetisi', icon: 'fas fa-trophy', text: 'Kompetisi (CRUD)' });
        navItems.push({ page: 'setting', icon: 'fas fa-cog', text: 'Setting' });
    }

    // --- Render Sidebar (Desktop) ---
    const sidebar = document.getElementById('sidebar');
    let menuHtml = `<ul class="nav flex-column mt-3">`;
    navItems.forEach(item => {
        const linkClasses = `nav-link ${item.disabled ? 'disabled text-danger' : ''}`;
        const lockIcon = item.disabled ? `<i class="fas fa-lock ms-1"></i>` : '';
        menuHtml += `
            <li class="nav-item">
                <a class="${linkClasses}" href="#" onclick="${item.disabled ? `showToast('${item.title}', false)` : `renderPage('${item.page}')`}" title="${item.title || ''}">
                    <i class="${item.icon} me-2"></i> ${item.text} ${lockIcon}
                </a>
            </li>
        `;
    });
    menuHtml += `</ul>`;
    if(sidebar) sidebar.innerHTML = menuHtml;
    
    updateActiveNav(currentPage); 
}

// Fungsi untuk mengelola kelas aktif pada sidebar dan bottom nav (Poin 1)
function updateActiveNav(page) {
    currentPage = page;
    
    // Sidebar
    document.querySelectorAll('.sidebar .nav-link').forEach(link => {
        link.classList.remove('active');
    });
    const sidebarLink = document.querySelector(`.sidebar .nav-link[onclick*="renderPage('${page}')"]`);
    if (sidebarLink) sidebarLink.classList.add('active');

    // Bottom Nav (Poin 1)
    const bottomNav = document.getElementById('bottom-nav');
    if (bottomNav) {
        const isProfilExist = sessionStorage.getItem('isProfilExist') === 'true';
        const navItems = [];
        navItems.push({ page: 'home', icon: 'fas fa-home', text: 'Home' });
        if (currentUser.type_users.startsWith('ADMIN_KLUB')) {
            navItems.push({ page: 'profil', icon: 'fas fa-building', text: 'Profil' });
            if (isProfilExist) {
                navItems.push({ page: 'pemain', icon: 'fas fa-running', text: 'Pemain' });
                navItems.push({ page: 'official', icon: 'fas fa-chalkboard-teacher', text: 'Official' });
            }
            navItems.push({ page: 'kompetisi', icon: 'fas fa-trophy', text: 'Kompetisi' });
        } else if (currentUser.type_users === 'ADMIN_PUSAT') {
            navItems.push({ page: 'profil', icon: 'fas fa-building', text: 'Klub' });
            navItems.push({ page: 'pemain', icon: 'fas fa-running', text: 'Pemain' });
            navItems.push({ page: 'official', icon: 'fas fa-chalkboard-teacher', text: 'Official' });
            navItems.push({ page: 'setting', icon: 'fas fa-cog', text: 'Setting' });
        }

        let bottomNavHtml = '';
        const mobileNavItems = navItems.filter(item => !item.disabled).slice(0, 5);
        
        mobileNavItems.forEach(item => {
            bottomNavHtml += `
                <a class="nav-link-bottom ${page === item.page ? 'active' : ''}" href="#" onclick="renderPage('${item.page}')">
                    <i class="${item.icon}"></i>
                    <span class="d-block">${item.text.replace('(CRUD)', '').replace('Semua', '').trim()}</span>
                </a>
            `;
        });
        bottomNav.innerHTML = bottomNavHtml;
    }
}


function renderPage(page) {
    currentPage = page;
    updateActiveNav(page); 

    if (page === 'home') renderHome();
    else if (page === 'profil') renderProfilPage();
    else if (page === 'pemain') renderPemainPage();
    else if (page === 'official') renderOfficialPage();
    else if (page === 'kompetisi') renderKompetisiPage();
    else if (page === 'setting') renderSettingPage();
    else contentDiv.innerHTML = `<h2>Halaman ${page.charAt(0).toUpperCase() + page.slice(1)} Belum Tersedia.</h2>`;
}

// Penyesuaian renderHome grid (Poin 1)
async function renderHome() {
    const clubInfo = await callAppsScript('GET_PROFIL_KLUB');
    const clubData = clubInfo && clubInfo.success && clubInfo.data && !Array.isArray(clubInfo.data) ? clubInfo.data : null;
    const isProfilExist = !!clubData && clubData.id_klub;
    
    sessionStorage.setItem('isProfilExist', isProfilExist); 
    renderNavigation(); // Update bottom nav setelah cek status profil

    const isClubAdmin = currentUser.type_users.startsWith('ADMIN_KLUB');
    let alertHtml = '';

    if (isClubAdmin && !isProfilExist) {
        alertHtml = `
            <div class="alert alert-warning d-flex align-items-center" role="alert">
                <i class="fas fa-exclamation-triangle me-2"></i>
                <div>
                    **Peringatan!** Profil Klub Anda belum terdaftar. Silakan lengkapi data di menu **Profil Klub** agar dapat mendaftar Pemain dan Official.
                </div>
            </div>
        `;
    }
    
    const bannerInfo = await callAppsScript('GET_BANNERS');
    const bannerData = bannerInfo && bannerInfo.success && bannerInfo.data ? bannerInfo.data : {};
    const currentBanner = { 
        title: bannerData.title_banner || 'Selamat Datang', 
        description: bannerData.description_banner || 'Silakan gunakan menu navigasi untuk mengelola data.', 
        image_url: bannerData.url_banner || '' 
    };

    contentDiv.innerHTML = `
        <h2 class="d-none d-md-block"><i class="fas fa-home me-2"></i>Dashboard Klub</h2>
        <div id="home-alerts" class="mt-4">${alertHtml}</div>
        
        <div class="card shadow-sm mt-4">
            ${currentBanner.image_url ? `<img src="${currentBanner.image_url}" class="card-img-top" alt="Banner" style="max-height: 250px; object-fit: cover;">` : ''}
            <div class="card-body">
                <h3 class="card-title text-primary">${currentBanner.title}</h3>
                <p class="card-text">${currentBanner.description}</p>
            </div>
        </div>

        <div class="row g-4 mt-3">
            <div class="col-12 col-lg-6"> 
                <div class="card shadow-sm h-100">
                    <div class="card-header bg-primary text-white"><i class="fas fa-shield-alt me-2"></i>Status Profil Klub</div>
                    <div class="card-body">
                        ${isClubAdmin ? `
                            <p>Status: <span class="badge ${isProfilExist ? 'bg-success' : 'bg-danger'}">${isProfilExist ? 'Telah Terdaftar' : 'Belum Terdaftar'}</span></p>
                            ${clubData ? `
                                <p>ID Klub: <strong>${clubData.id_klub}</strong></p>
                                <p>Nama Klub: <strong>${clubData.nama_klub || '-'}</strong></p>
                                <p>Manajer: ${clubData.nama_manajer || '-'}</p>
                                <p class="text-muted"><small>Terakhir diubah: ${clubData.time_stamp || '-'}</small></p>
                            ` : '<p class="text-danger">Data klub tidak ditemukan.</p>'}
                            <a href="#" onclick="renderPage('profil')" class="btn btn-sm btn-outline-primary mt-2">
                                ${isProfilExist ? 'Lihat/Edit Profil' : 'Daftar Profil Sekarang'}
                            </a>
                        ` : `
                            <p>Anda adalah **ADMIN PUSAT**.</p>
                            <p>Silakan gunakan menu navigasi di samping/bawah untuk mengelola semua data klub, pemain, dan official.</p>
                            <a href="#" onclick="renderPage('profil')" class="btn btn-sm btn-outline-primary mt-2">Lihat Semua Klub</a>
                        `}
                    </div>
                </div>
            </div>

            <div class="col-12 col-lg-6"> 
                <div class="card shadow-sm h-100">
                    <div class="card-header bg-success text-white"><i class="fas fa-chart-line me-2"></i>Statistik Data Klub</div>
                    <div class="card-body" id="home-stats-body">
                        <p>Memuat data statistik...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    loadHomeStats();
}

async function loadHomeStats() {
    const statsBody = document.getElementById('home-stats-body');
    if (!statsBody) return;
    statsBody.innerHTML = `<p>Memuat data...</p>`;

    const [pemainRes, officialRes, klubRes] = await Promise.all([
        callAppsScript('GET_PEMAIN'),
        callAppsScript('GET_OFFICIAL'),
        callAppsScript('GET_PROFIL_KLUB')
    ]);

    let totalPemain = 0;
    let totalOfficial = 0;
    let totalKlub = 0;

    if (pemainRes.success) {
        totalPemain = pemainRes.data.length;
    }
    if (officialRes.success) {
        totalOfficial = officialRes.data.length;
    }
    if (klubRes.success) {
        totalKlub = Array.isArray(klubRes.data) ? klubRes.data.length : 1; 
    }

    // Filter data berdasarkan klub jika ADMIN_KLUB
    if (currentUser.type_users.startsWith('ADMIN_KLUB')) {
        if (pemainRes.success) {
            totalPemain = pemainRes.data.filter(p => p.id_klub === currentUser.id_klub).length;
        }
        if (officialRes.success) {
            totalOfficial = officialRes.data.filter(o => o.id_klub === currentUser.id_klub).length;
        }
        // Total klub tetap 1 (klub mereka sendiri) jika berhasil mendapatkan data klub
    }
    
    statsBody.innerHTML = `
        <div class="row text-center">
            <div class="col-4">
                <div class="p-2 border rounded shadow-sm">
                    <h4 class="text-primary">${totalKlub}</h4>
                    <p class="text-muted mb-0">${currentUser.type_users === 'ADMIN_PUSAT' ? 'Total Klub' : 'Klub Anda'}</p>
                </div>
            </div>
            <div class="col-4">
                <div class="p-2 border rounded shadow-sm">
                    <h4 class="text-success">${totalPemain}</h4>
                    <p class="text-muted mb-0">Total Pemain</p>
                </div>
            </div>
            <div class="col-4">
                <div class="p-2 border rounded shadow-sm">
                    <h4 class="text-warning">${totalOfficial}</h4>
                    <p class="text-muted mb-0">Total Official</p>
                </div>
            </div>
        </div>
        <p class="mt-3 text-muted"><small>Statistik ini diperbarui berdasarkan data yang tersedia di sistem.</small></p>
    `;
}

// --- FUNGSI PROFIL KLUB ---

async function renderProfilPage() {
    contentDiv.innerHTML = `<h2><i class="fas fa-building me-2"></i>${currentUser.type_users === 'ADMIN_PUSAT' ? 'Daftar Semua Klub' : 'Profil Klub Anda'}</h2><hr>`;
    
    if (currentUser.type_users.startsWith('ADMIN_KLUB')) {
        loadProfilKlubDetail();
    } else {
        loadSemuaKlubTable();
    }
}

async function loadProfilKlubDetail() {
    const result = await callAppsScript('GET_PROFIL_KLUB');
    const data = result.success && !Array.isArray(result.data) ? result.data : null;
    const isExist = !!data;
    
    contentDiv.innerHTML = `
        <h2><i class="fas fa-building me-2"></i>Profil Klub Anda</h2><hr>
        <div class="card shadow-sm">
            <div class="card-header bg-primary text-white d-flex justify-content-between align-items-center">
                <span>Data Klub</span>
                <button class="btn btn-sm btn-light" onclick="showProfilKlubForm(${isExist ? `'${data.id_klub}', ${JSON.stringify(data)}` : 'null, {}'})">
                    <i class="fas fa-${isExist ? 'edit' : 'plus'} me-1"></i> ${isExist ? 'Edit Profil' : 'Daftar Profil'}
                </button>
            </div>
            <div class="card-body">
                ${isExist ? `
                    <div class="row g-3">
                        <div class="col-md-4 text-center">
                            <img src="${data.logo_url || 'https://via.placeholder.com/150?text=Logo+Klub'}" class="img-thumbnail" alt="Logo Klub" style="max-width: 150px; height: auto;">
                            <p class="mt-2 text-muted"><small>Logo Klub</small></p>
                        </div>
                        <div class="col-md-8">
                            <dl class="row">
                                <dt class="col-sm-4">ID Klub</dt>
                                <dd class="col-sm-8">${data.id_klub}</dd>
                                <dt class="col-sm-4">Nama Klub</dt>
                                <dd class="col-sm-8"><strong>${data.nama_klub}</strong></dd>
                                <dt class="col-sm-4">Nama Manajer</dt>
                                <dd class="col-sm-8">${data.nama_manajer || '-'}</dd>
                                <dt class="col-sm-4">Alamat Sekretariat</dt>
                                <dd class="col-sm-8">${data.alamat_sekretariat || '-'}</dd>
                                <dt class="col-sm-4">Email</dt>
                                <dd class="col-sm-8">${data.email || '-'}</dd>
                                <dt class="col-sm-4">No. Telp</dt>
                                <dd class="col-sm-8">${data.no_telp || '-'}</dd>
                                <dt class="col-sm-4">Time Stamp</dt>
                                <dd class="col-sm-8 text-muted">${data.time_stamp || '-'}</dd>
                            </dl>
                            <p class="text-danger mt-3">
                                <i class="fas fa-lock me-1"></i> Data profil klub ini tidak dikunci.
                            </p>
                        </div>
                    </div>
                ` : '<p class="text-danger">Anda belum mendaftarkan profil klub Anda. Klik tombol "Daftar Profil" di atas.</p>'}
            </div>
        </div>
    `;
}

async function loadSemuaKlubTable() {
    const result = await callAppsScript('GET_PROFIL_KLUB');
    const allClubs = result.success && Array.isArray(result.data) ? result.data : [];

    let tableHtml = `
        <div class="table-responsive">
            <table class="table table-striped table-hover table-sm">
                <thead class="bg-dark text-white">
                    <tr>
                        <th>ID Klub</th>
                        <th>Nama Klub</th>
                        <th>Manajer</th>
                        <th>No. Telp</th>
                        <th>Time Stamp</th>
                        <th>Aksi</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    if (allClubs.length === 0) {
        tableHtml += `<tr><td colspan="6" class="text-center">Tidak ada data klub terdaftar.</td></tr>`;
    } else {
        allClubs.forEach(club => {
            tableHtml += `
                <tr>
                    <td>${club.id_klub}</td>
                    <td>${club.nama_klub}</td>
                    <td>${club.nama_manajer || '-'}</td>
                    <td>${club.no_telp || '-'}</td>
                    <td class="text-muted"><small>${club.time_stamp || '-'}</small></td>
                    <td>
                        <button class="btn btn-sm btn-primary me-1" onclick="showProfilKlubForm('${club.id_klub}', ${JSON.stringify(club)})" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="confirmDeleteProfilKlub('${club.id_klub}', '${club.nama_klub}')" title="Hapus">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
    }
    
    tableHtml += `</tbody></table></div>`;
    
    contentDiv.innerHTML += tableHtml;
    // Tambahkan tombol tambah jika ADMIN_PUSAT
    if (currentUser.type_users === 'ADMIN_PUSAT') {
        contentDiv.insertAdjacentHTML('afterbegin', `
            <button class="btn btn-success mb-3" onclick="showProfilKlubForm(null, {})">
                <i class="fas fa-plus me-1"></i> Tambah Klub Baru
            </button>
        `);
    }
}

function showProfilKlubForm(idKlub, data) {
    const isNew = !idKlub;
    data.action = isNew ? 'CREATE' : 'UPDATE';
    data.id_klub = idKlub || '';

    const formHtml = `
        <input type="hidden" name="action" value="${data.action}">
        <div class="col-md-6">
            <label for="id_klub" class="form-label">ID Klub ${isNew ? '(16 Digit Angka)' : ''}</label>
            <input type="text" class="form-control" id="id_klub" name="id_klub" value="${data.id_klub}" ${isNew || currentUser.type_users === 'ADMIN_PUSAT' ? '' : 'readonly'} required>
            ${!isNew && currentUser.type_users.startsWith('ADMIN_KLUB') ? '<small class="text-muted">ID Klub tidak dapat diubah.</small>' : ''}
        </div>
        <div class="col-md-6">
            <label for="nama_klub" class="form-label">Nama Klub</label>
            <input type="text" class="form-control" id="nama_klub" name="nama_klub" value="${data.nama_klub || ''}" required>
        </div>
        <div class="col-md-6">
            <label for="nama_manajer" class="form-label">Nama Manajer</label>
            <input type="text" class="form-control" id="nama_manajer" name="nama_manajer" value="${data.nama_manajer || ''}" required>
        </div>
        <div class="col-md-6">
            <label for="no_telp" class="form-label">No. Telepon</label>
            <input type="tel" class="form-control" id="no_telp" name="no_telp" value="${data.no_telp || ''}">
        </div>
        <div class="col-12">
            <label for="alamat_sekretariat" class="form-label">Alamat Sekretariat</label>
            <input type="text" class="form-control" id="alamat_sekretariat" name="alamat_sekretariat" value="${data.alamat_sekretariat || ''}">
        </div>
        <div class="col-12">
            <label for="email" class="form-label">Email</label>
            <input type="email" class="form-control" id="email" name="email" value="${data.email || ''}">
        </div>
        <div class="col-12">
            <label for="logo_file" class="form-label">Logo Klub (Max 1MB)</label>
            <input type="file" class="form-control" id="logo_file" name="logo_file" accept="image/*" onchange="previewImage(event, 'logo-preview')" data-old-value="${data.logo_url || ''}">
            <img id="logo-preview" src="${data.logo_url || 'https://via.placeholder.com/100?text=Logo'}" class="img-thumbnail mt-2" style="max-height: 100px;">
            <input type="hidden" name="logo_url" value="${data.logo_url || ''}">
        </div>
    `;

    showModalForm(`${isNew ? 'Daftar' : 'Edit'} Profil Klub`, formHtml, handleProfilKlubFormSubmit);
}

async function handleProfilKlubFormSubmit(e) {
    const isClubAdmin = currentUser.type_users.startsWith('ADMIN_KLUB');
    const callback = isClubAdmin ? loadProfilKlubDetail : loadSemuaKlubTable;
    await handleGenericFormSubmit(e, 'CRUD_PROFIL_KLUB', ['logo_file'], callback);
}

function confirmDeleteProfilKlub(idKlub, namaKlub) {
    showConfirmationModal(`Apakah Anda yakin ingin menghapus klub **${namaKlub}** (ID: ${idKlub})? Tindakan ini tidak dapat dibatalkan.`, async () => {
        const data = { action: 'DELETE', id_klub: idKlub };
        const result = await callAppsScript('CRUD_PROFIL_KLUB', { data: JSON.stringify(data) });
        
        if (result && result.success) {
            showToast(result.message);
            loadSemuaKlubTable();
        } else {
            showToast(result.message || "Gagal menghapus klub.", false);
        }
    });
}

// --- FUNGSI PEMAIN ---

async function renderPemainPage() {
    contentDiv.innerHTML = `<h2><i class="fas fa-running me-2"></i>${currentUser.type_users === 'ADMIN_PUSAT' ? 'Daftar Semua Pemain' : 'Daftar Pemain Klub'}</h2><hr>`;
    await loadPemainTable();
}

async function loadPemainTable() {
    const result = await callAppsScript('GET_PEMAIN');
    let allPemain = result.success ? result.data : [];
    
    if (currentUser.type_users.startsWith('ADMIN_KLUB')) {
        allPemain = allPemain.filter(p => p.id_klub === currentUser.id_klub);
    }
    
    globalValidPemain = allPemain;

    let tableHtml = `
        <div class="table-responsive">
            <table class="table table-striped table-hover table-sm">
                <thead class="bg-dark text-white">
                    <tr>
                        <th>Nama</th>
                        <th>Posisi</th>
                        <th>No. Punggung</th>
                        <th>Tgl Lahir (Usia)</th>
                        ${currentUser.type_users === 'ADMIN_PUSAT' ? '<th>ID Klub</th>' : ''}
                        <th>Status</th>
                        <th>Aksi</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    if (allPemain.length === 0) {
        tableHtml += `<tr><td colspan="${currentUser.type_users === 'ADMIN_PUSAT' ? 7 : 6}" class="text-center">Tidak ada data pemain terdaftar.</td></tr>`;
    } else {
        allPemain.forEach(pemain => {
            const isEditable = currentUser.type_users === 'ADMIN_PUSAT' || (pemain.time_stamp && isEditable(pemain.time_stamp, currentUser.type_users));
            const statusBadge = isEditable ? '<span class="badge bg-success">Dapat Diubah</span>' : '<span class="badge bg-danger">Terkunci</span>';
            const age = calculateAge(pemain.tanggal_lahir);
            
            tableHtml += `
                <tr>
                    <td>${pemain.nama_pemain}</td>
                    <td>${pemain.posisi}</td>
                    <td>${pemain.no_punggung}</td>
                    <td>${pemain.tanggal_lahir} (${age})</td>
                    ${currentUser.type_users === 'ADMIN_PUSAT' ? `<td>${pemain.id_klub}</td>` : ''}
                    <td>${statusBadge}</td>
                    <td>
                        <button class="btn btn-sm btn-primary me-1" onclick="showPemainForm('${pemain.id_pemain}', ${JSON.stringify(pemain)})" title="Edit" ${isEditable ? '' : 'disabled'}>
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="confirmDeletePemain('${pemain.id_pemain}', '${pemain.nama_pemain}', ${isEditable})" title="Hapus" ${isEditable ? '' : 'disabled'}>
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
    }
    
    tableHtml += `</tbody></table></div>`;
    
    contentDiv.innerHTML += tableHtml;
    // Tombol Tambah hanya untuk ADMIN_KLUB
    if (currentUser.type_users.startsWith('ADMIN_KLUB')) {
        contentDiv.insertAdjacentHTML('afterbegin', `
            <button class="btn btn-success mb-3" onclick="showPemainForm(null, {})">
                <i class="fas fa-plus me-1"></i> Tambah Pemain
            </button>
        `);
    }
}

function showPemainForm(id_pemain, data) {
    const isNew = !id_pemain;
    data.action = isNew ? 'CREATE' : 'UPDATE';
    data.id_pemain = id_pemain || '';
    
    const isReadOnly = currentUser.type_users.startsWith('ADMIN_KLUB') && !isNew && !isEditable(data.time_stamp, currentUser.type_users);

    const formHtml = `
        <input type="hidden" name="action" value="${data.action}">
        <input type="hidden" name="id_pemain" value="${data.id_pemain}">
        
        <div class="col-md-6">
            <label for="id_pemain_input" class="form-label">ID Pemain ${isNew ? '(16 Digit Angka)' : ''}</label>
            <input type="text" class="form-control" id="id_pemain_input" name="id_pemain" value="${data.id_pemain}" ${isNew ? '' : 'readonly'} required>
            ${!isNew ? '<small class="text-muted">ID Pemain tidak dapat diubah.</small>' : ''}
        </div>
        <div class="col-md-6">
            <label for="nama_pemain" class="form-label">Nama Lengkap</label>
            <input type="text" class="form-control" id="nama_pemain" name="nama_pemain" value="${data.nama_pemain || ''}" ${isReadOnly ? 'readonly' : ''} required>
        </div>
        <div class="col-md-6">
            <label for="no_punggung" class="form-label">No. Punggung</label>
            <input type="number" class="form-control" id="no_punggung" name="no_punggung" value="${data.no_punggung || ''}" ${isReadOnly ? 'readonly' : ''} required>
        </div>
        <div class="col-md-6">
            <label for="posisi" class="form-label">Posisi</label>
            <select class="form-select" id="posisi" name="posisi" ${isReadOnly ? 'disabled' : ''} required>
                ${['GK', 'CB', 'LB', 'RB', 'CM', 'LM', 'RM', 'CAM', 'ST'].map(p => 
                    `<option value="${p}" ${data.posisi === p ? 'selected' : ''}>${p}</option>`
                ).join('')}
            </select>
            ${isReadOnly ? `<input type="hidden" name="posisi" value="${data.posisi || ''}">` : ''}
        </div>
        <div class="col-md-6">
            <label for="tanggal_lahir" class="form-label">Tanggal Lahir</label>
            <input type="date" class="form-control" id="tanggal_lahir" name="tanggal_lahir" value="${data.tanggal_lahir || ''}" ${isReadOnly ? 'readonly' : ''} required>
        </div>
        <div class="col-md-6">
            <label for="foto_file" class="form-label">Foto Pemain (Max 1MB)</label>
            <input type="file" class="form-control" id="foto_file" name="foto_file" accept="image/*" onchange="previewImage(event, 'foto-preview')" data-old-value="${data.foto_url || ''}" ${isReadOnly ? 'disabled' : ''}>
            <input type="hidden" name="foto_url" value="${data.foto_url || ''}">
            <img id="foto-preview" src="${data.foto_url || 'https://via.placeholder.com/100?text=Foto'}" class="img-thumbnail mt-2" style="max-height: 100px;">
        </div>
        <div class="col-12">
            ${isReadOnly ? `<div class="alert alert-danger p-2 mt-2"><i class="fas fa-exclamation-triangle me-1"></i> Data Pemain ini telah **Terkunci** dan tidak dapat diubah/dihapus karena telah melewati batas waktu edit (${data.time_stamp}).</div>` : ''}
        </div>
    `;

    const isEditableNow = isNew || !isReadOnly;
    const footerHtml = isEditableNow ? '' : `<button type="button" class="btn btn-secondary w-100" data-bs-dismiss="modal">Tutup</button>`;

    showModalForm(`${isNew ? 'Tambah' : 'Edit'} Data Pemain`, formHtml, handlePemainFormSubmit, footerHtml);
}

async function handlePemainFormSubmit(e) {
    await handleGenericFormSubmit(e, 'CRUD_PEMAIN', ['foto_file'], loadPemainTable);
}

function confirmDeletePemain(id_pemain, nama_pemain, isEditable) {
    if (!isEditable) {
        showToast('Data sudah terkunci dan tidak bisa dihapus.', false);
        return;
    }
    showConfirmationModal(`Apakah Anda yakin ingin menghapus pemain **${nama_pemain}**? Tindakan ini tidak dapat dibatalkan.`, async () => {
        const data = { action: 'DELETE', id_pemain: id_pemain };
        const result = await callAppsScript('CRUD_PEMAIN', { data: JSON.stringify(data) });
        
        if (result && result.success) {
            showToast(result.message);
            loadPemainTable();
        } else {
            showToast(result.message || "Gagal menghapus pemain.", false);
        }
    });
}

// --- FUNGSI OFFICIAL ---

async function renderOfficialPage() {
    contentDiv.innerHTML = `<h2><i class="fas fa-chalkboard-teacher me-2"></i>${currentUser.type_users === 'ADMIN_PUSAT' ? 'Daftar Semua Official' : 'Daftar Official Klub'}</h2><hr>`;
    await loadOfficialTable();
}

async function loadOfficialTable() {
    const result = await callAppsScript('GET_OFFICIAL');
    let allOfficial = result.success ? result.data : [];
    
    if (currentUser.type_users.startsWith('ADMIN_KLUB')) {
        allOfficial = allOfficial.filter(p => p.id_klub === currentUser.id_klub);
    }
    
    globalValidOfficial = allOfficial;

    let tableHtml = `
        <div class="table-responsive">
            <table class="table table-striped table-hover table-sm">
                <thead class="bg-dark text-white">
                    <tr>
                        <th>Nama</th>
                        <th>Jabatan</th>
                        <th>Tgl Lahir (Usia)</th>
                        ${currentUser.type_users === 'ADMIN_PUSAT' ? '<th>ID Klub</th>' : ''}
                        <th>Status</th>
                        <th>Aksi</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    if (allOfficial.length === 0) {
        tableHtml += `<tr><td colspan="${currentUser.type_users === 'ADMIN_PUSAT' ? 6 : 5}" class="text-center">Tidak ada data official terdaftar.</td></tr>`;
    } else {
        allOfficial.forEach(official => {
            const isEditable = currentUser.type_users === 'ADMIN_PUSAT' || (official.time_stamp && isEditable(official.time_stamp, currentUser.type_users));
            const statusBadge = isEditable ? '<span class="badge bg-success">Dapat Diubah</span>' : '<span class="badge bg-danger">Terkunci</span>';
            const age = calculateAge(official.tanggal_lahir);
            
            tableHtml += `
                <tr>
                    <td>${official.nama_official}</td>
                    <td>${official.jabatan}</td>
                    <td>${official.tanggal_lahir} (${age})</td>
                    ${currentUser.type_users === 'ADMIN_PUSAT' ? `<td>${official.id_klub}</td>` : ''}
                    <td>${statusBadge}</td>
                    <td>
                        <button class="btn btn-sm btn-primary me-1" onclick="showOfficialForm('${official.id_official}', ${JSON.stringify(official)})" title="Edit" ${isEditable ? '' : 'disabled'}>
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="confirmDeleteOfficial('${official.id_official}', '${official.nama_official}', ${isEditable})" title="Hapus" ${isEditable ? '' : 'disabled'}>
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
    }
    
    tableHtml += `</tbody></table></div>`;
    
    contentDiv.innerHTML += tableHtml;
    // Tombol Tambah hanya untuk ADMIN_KLUB
    if (currentUser.type_users.startsWith('ADMIN_KLUB')) {
        contentDiv.insertAdjacentHTML('afterbegin', `
            <button class="btn btn-success mb-3" onclick="showOfficialForm(null, {})">
                <i class="fas fa-plus me-1"></i> Tambah Official
            </button>
        `);
    }
}

function showOfficialForm(id_official, data) {
    const isNew = !id_official;
    data.action = isNew ? 'CREATE' : 'UPDATE';
    data.id_official = id_official || '';
    
    const isReadOnly = currentUser.type_users.startsWith('ADMIN_KLUB') && !isNew && !isEditable(data.time_stamp, currentUser.type_users);

    const jabatanOptions = ['Pelatih Kepala', 'Asisten Pelatih', 'Manajer Tim', 'Dokter Tim', 'Fisioterapis', 'Kitman', 'Media Officer', 'Official Lain'];

    const formHtml = `
        <input type="hidden" name="action" value="${data.action}">
        <input type="hidden" name="id_official" value="${data.id_official}">
        
        <div class="col-md-6">
            <label for="id_official_input" class="form-label">ID Official ${isNew ? '(16 Digit Angka)' : ''}</label>
            <input type="text" class="form-control" id="id_official_input" name="id_official" value="${data.id_official}" ${isNew ? '' : 'readonly'} required>
            ${!isNew ? '<small class="text-muted">ID Official tidak dapat diubah.</small>' : ''}
        </div>
        <div class="col-md-6">
            <label for="nama_official" class="form-label">Nama Lengkap</label>
            <input type="text" class="form-control" id="nama_official" name="nama_official" value="${data.nama_official || ''}" ${isReadOnly ? 'readonly' : ''} required>
        </div>
        <div class="col-md-6">
            <label for="jabatan" class="form-label">Jabatan</label>
            <select class="form-select" id="jabatan" name="jabatan" ${isReadOnly ? 'disabled' : ''} required>
                ${jabatanOptions.map(j => 
                    `<option value="${j}" ${data.jabatan === j ? 'selected' : ''}>${j}</option>`
                ).join('')}
            </select>
            ${isReadOnly ? `<input type="hidden" name="jabatan" value="${data.jabatan || ''}">` : ''}
        </div>
        <div class="col-md-6">
            <label for="tanggal_lahir" class="form-label">Tanggal Lahir</label>
            <input type="date" class="form-control" id="tanggal_lahir" name="tanggal_lahir" value="${data.tanggal_lahir || ''}" ${isReadOnly ? 'readonly' : ''} required>
        </div>
        <div class="col-md-6">
            <label for="foto_file" class="form-label">Foto Official (Max 1MB)</label>
            <input type="file" class="form-control" id="foto_file" name="foto_file" accept="image/*" onchange="previewImage(event, 'foto-preview')" data-old-value="${data.foto_url || ''}" ${isReadOnly ? 'disabled' : ''}>
            <input type="hidden" name="foto_url" value="${data.foto_url || ''}">
            <img id="foto-preview" src="${data.foto_url || 'https://via.placeholder.com/100?text=Foto'}" class="img-thumbnail mt-2" style="max-height: 100px;">
        </div>
        <div class="col-12">
            ${isReadOnly ? `<div class="alert alert-danger p-2 mt-2"><i class="fas fa-exclamation-triangle me-1"></i> Data Official ini telah **Terkunci** dan tidak dapat diubah/dihapus karena telah melewati batas waktu edit (${data.time_stamp}).</div>` : ''}
        </div>
    `;
    
    const isEditableNow = isNew || !isReadOnly;
    const footerHtml = isEditableNow ? '' : `<button type="button" class="btn btn-secondary w-100" data-bs-dismiss="modal">Tutup</button>`;

    showModalForm(`${isNew ? 'Tambah' : 'Edit'} Data Official`, formHtml, handleOfficialFormSubmit, footerHtml);
}

async function handleOfficialFormSubmit(e) {
    await handleGenericFormSubmit(e, 'CRUD_OFFICIAL', ['foto_file'], loadOfficialTable);
}

function confirmDeleteOfficial(id_official, nama_official, isEditable) {
    if (!isEditable) {
        showToast('Data sudah terkunci dan tidak bisa dihapus.', false);
        return;
    }
    showConfirmationModal(`Apakah Anda yakin ingin menghapus official **${nama_official}**? Tindakan ini tidak dapat dibatalkan.`, async () => {
        const data = { action: 'DELETE', id_official: id_official };
        const result = await callAppsScript('CRUD_OFFICIAL', { data: JSON.stringify(data) });
        
        if (result && result.success) {
            showToast(result.message);
            loadOfficialTable();
        } else {
            showToast(result.message || "Gagal menghapus official.", false);
        }
    });
}

// --- FUNGSI KOMPETISI ---

async function renderKompetisiPage() {
    contentDiv.innerHTML = `<h2><i class="fas fa-trophy me-2"></i>Daftar Kompetisi</h2><hr>`;
    await loadKompetisiList();
}

async function loadKompetisiList() {
    const result = await callAppsScript('GET_LIST_KOMPETISI');
    globalKompetisi = result.success ? result.data : [];
    
    let listHtml = '';
    
    if (currentUser.type_users === 'ADMIN_PUSAT') {
        listHtml = await renderKompetisiTableAdminPusat(globalKompetisi);
    } else {
        listHtml = await renderKompetisiListAdminKlub(globalKompetisi);
    }

    contentDiv.innerHTML += listHtml;

    // Inisialisasi tabs
    const triggerEl = document.querySelector('#kompetisi-tabs a[href="#tab-register"]');
    if(triggerEl) bootstrap.Tab.getInstance(triggerEl).show(); // Tampilkan tab pertama (jika ada)
}

async function renderKompetisiTableAdminPusat(kompetisi) {
    let tableHtml = `
        <button class="btn btn-success mb-3" onclick="showKompetisiForm(null, {})">
            <i class="fas fa-plus me-1"></i> Tambah Kompetisi
        </button>
        <div class="table-responsive">
            <table class="table table-striped table-hover table-sm">
                <thead class="bg-dark text-white">
                    <tr>
                        <th>ID</th>
                        <th>Nama Kompetisi</th>
                        <th>U-Max</th>
                        <th>Tgl Mulai</th>
                        <th>Aksi</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    if (kompetisi.length === 0) {
        tableHtml += `<tr><td colspan="5" class="text-center">Tidak ada kompetisi terdaftar.</td></tr>`;
    } else {
        kompetisi.forEach(k => {
            tableHtml += `
                <tr>
                    <td>${k.id_kompetisi}</td>
                    <td>${k.nama_kompetisi}</td>
                    <td>U-${k.umur_maksimal}</td>
                    <td>${k.tanggal_mulai}</td>
                    <td>
                        <button class="btn btn-sm btn-primary me-1" onclick="showKompetisiForm('${k.id_kompetisi}', ${JSON.stringify(k)})" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="confirmDeleteKompetisi('${k.id_kompetisi}', '${k.nama_kompetisi}')" title="Hapus">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
    }
    
    tableHtml += `</tbody></table></div>`;
    return tableHtml;
}

function showKompetisiForm(id_kompetisi, data) {
    const isNew = !id_kompetisi;
    data.action = isNew ? 'CREATE' : 'UPDATE';
    data.id_kompetisi = id_kompetisi || '';

    const formHtml = `
        <input type="hidden" name="action" value="${data.action}">
        <div class="col-md-6">
            <label for="id_kompetisi" class="form-label">ID Kompetisi ${isNew ? '(Contoh: K-2024-001)' : ''}</label>
            <input type="text" class="form-control" id="id_kompetisi" name="id_kompetisi" value="${data.id_kompetisi}" ${isNew ? '' : 'readonly'} required>
        </div>
        <div class="col-md-6">
            <label for="nama_kompetisi" class="form-label">Nama Kompetisi</label>
            <input type="text" class="form-control" id="nama_kompetisi" name="nama_kompetisi" value="${data.nama_kompetisi || ''}" required>
        </div>
        <div class="col-md-6">
            <label for="umur_maksimal" class="form-label">Umur Maksimal (U-max)</label>
            <input type="number" class="form-control" id="umur_maksimal" name="umur_maksimal" value="${data.umur_maksimal || ''}" required>
        </div>
        <div class="col-md-6">
            <label for="tanggal_mulai" class="form-label">Tanggal Mulai</label>
            <input type="date" class="form-control" id="tanggal_mulai" name="tanggal_mulai" value="${data.tanggal_mulai || ''}" required>
        </div>
    `;

    showModalForm(`${isNew ? 'Tambah' : 'Edit'} Kompetisi`, formHtml, handleKompetisiFormSubmit);
}

async function handleKompetisiFormSubmit(e) {
    await handleGenericFormSubmit(e, 'CRUD_LIST_KOMPETISI', [], loadKompetisiList);
}

function confirmDeleteKompetisi(id_kompetisi, nama_kompetisi) {
    showConfirmationModal(`Apakah Anda yakin ingin menghapus kompetisi **${nama_kompetisi}**?`, async () => {
        const data = { action: 'DELETE', id_kompetisi: id_kompetisi };
        const result = await callAppsScript('CRUD_LIST_KOMPETISI', { data: JSON.stringify(data) });
        
        if (result && result.success) {
            showToast(result.message);
            loadKompetisiList();
        } else {
            showToast(result.message || "Gagal menghapus kompetisi.", false);
        }
    });
}

// --- REGISTRASI KOMPETISI (ADMIN KLUB) ---

async function renderKompetisiListAdminKlub(kompetisi) {
    const hasProfil = sessionStorage.getItem('isProfilExist') === 'true';

    let options = '<option value="">-- Pilih Kompetisi --</option>';
    kompetisi.forEach(k => {
        options += `<option value="${k.id_kompetisi}" data-maxage="${k.umur_maksimal}">(${k.tanggal_mulai}) ${k.nama_kompetisi} (U-${k.umur_maksimal})</option>`;
    });

    const formHtml = `
        <div class="row mb-3">
            <div class="col-12">
                <label for="kompetisi-select" class="form-label">Pilih Kompetisi:</label>
                <select class="form-select" id="kompetisi-select" onchange="loadPrakompetisiData(this.value)" ${!hasProfil ? 'disabled' : ''}>
                    ${options}
                </select>
                ${!hasProfil ? '<div class="alert alert-warning mt-2">Daftar Profil Klub terlebih dahulu untuk melakukan registrasi.</div>' : ''}
            </div>
        </div>
        <div id="prakompetisi-details">
            <p class="text-center text-muted">Silakan pilih kompetisi di atas.</p>
        </div>
    `;
    
    return formHtml;
}

async function loadPrakompetisiData(idKompetisi) {
    globalCurrentKompetisi = globalKompetisi.find(k => k.id_kompetisi === idKompetisi);
    const detailDiv = document.getElementById('prakompetisi-details');
    detailDiv.innerHTML = `<p class="text-center text-muted">Memuat data registrasi...</p>`;
    
    if (!idKompetisi || !globalCurrentKompetisi) {
        detailDiv.innerHTML = `<p class="text-center text-muted">Silakan pilih kompetisi di atas.</p>`;
        return;
    }

    const [pemainRes, officialRes] = await Promise.all([
        callAppsScript('GET_REGISTERED_PEMAIN', { id_kompetisi: idKompetisi }),
        callAppsScript('GET_REGISTERED_OFFICIAL', { id_kompetisi: idKompetisi })
    ]);
    
    if (!pemainRes.success || !officialRes.success) {
        detailDiv.innerHTML = `<div class="alert alert-danger">Gagal memuat data registrasi.</div>`;
        return;
    }
    
    const pemainRegistered = pemainRes.data;
    const officialRegistered = officialRes.data;

    detailDiv.innerHTML = `
        <ul class="nav nav-tabs" id="kompetisi-tabs" role="tablist">
            <li class="nav-item" role="presentation">
                <button class="nav-link active" id="tab-register-pemain-tab" data-bs-toggle="tab" data-bs-target="#tab-register-pemain" type="button" role="tab" aria-controls="tab-register-pemain" aria-selected="true">
                    Daftar Pemain (${pemainRegistered.length}/25)
                </button>
            </li>
            <li class="nav-item" role="presentation">
                <button class="nav-link" id="tab-register-official-tab" data-bs-toggle="tab" data-bs-target="#tab-register-official" type="button" role="tab" aria-controls="tab-register-official" aria-selected="false">
                    Daftar Official (${officialRegistered.length}/10)
                </button>
            </li>
        </ul>
        <div class="tab-content border border-top-0 p-3 bg-white" id="kompetisi-tab-content">
            <div class="tab-pane fade show active" id="tab-register-pemain" role="tabpanel" aria-labelledby="tab-register-pemain-tab">
                <p>Pilih pemain untuk didaftarkan pada kompetisi U-${globalCurrentKompetisi.umur_maksimal} ini. Pemain yang ditampilkan adalah yang memenuhi batas usia.</p>
                <button class="btn btn-sm btn-primary mb-3" onclick="showPrakompetisiForm('pemain', ${JSON.stringify(pemainRegistered)})">
                    <i class="fas fa-list-check me-1"></i> Atur Daftar Pemain
                </button>
                ${renderRegisteredList('pemain', pemainRegistered)}
            </div>
            <div class="tab-pane fade" id="tab-register-official" role="tabpanel" aria-labelledby="tab-register-official-tab">
                <p>Pilih official untuk didaftarkan pada kompetisi ini.</p>
                <button class="btn btn-sm btn-primary mb-3" onclick="showPrakompetisiForm('official', ${JSON.stringify(officialRegistered)})">
                    <i class="fas fa-list-check me-1"></i> Atur Daftar Official
                </button>
                ${renderRegisteredList('official', officialRegistered)}
            </div>
        </div>
    `;
}

function renderRegisteredList(type, data) {
    const isPemain = type === 'pemain';
    let listHtml = `<div class="table-responsive"><table class="table table-sm table-bordered"><thead><tr>`;
    listHtml += `<th>${isPemain ? 'Nama Pemain' : 'Nama Official'}</th>`;
    listHtml += `<th>${isPemain ? 'Posisi' : 'Jabatan'}</th>`;
    listHtml += isPemain ? '<th>No. Punggung</th>' : '';
    listHtml += `</tr></thead><tbody>`;

    if (data.length === 0) {
        listHtml += `<tr><td colspan="${isPemain ? 3 : 2}" class="text-center">Belum ada yang didaftarkan.</td></tr>`;
    } else {
        data.forEach(item => {
            listHtml += `<tr>`;
            listHtml += `<td>${isPemain ? item.nama_pemain : item.nama_official}</td>`;
            listHtml += `<td>${isPemain ? item.posisi : item.jabatan}</td>`;
            listHtml += isPemain ? `<td>${item.no_punggung}</td>` : '';
            listHtml += `</tr>`;
        });
    }

    listHtml += `</tbody></table></div>`;
    return listHtml;
}

async function showPrakompetisiForm(type, currentEntries) {
    const isPemain = type === 'pemain';
    let dataList = [];
    let fetchAction = isPemain ? 'GET_FILTERED_PEMAIN' : 'GET_OFFICIAL';
    
    // Untuk pemain, kita perlu memfilter berdasarkan U-max
    if (isPemain) {
        const result = await callAppsScript(fetchAction, { id_kompetisi: globalCurrentKompetisi.id_kompetisi });
        dataList = result.success ? result.data : [];
    } else {
        // Untuk official, kita ambil semua official klub yang terdaftar
        const result = await callAppsScript(fetchAction);
        dataList = result.success ? result.data.filter(o => o.id_klub === currentUser.id_klub) : [];
    }
    
    // Tandai mana yang sudah terpilih
    dataList = dataList.map(item => {
        const idKey = isPemain ? 'id_pemain' : 'id_official';
        const isRegistered = currentEntries.some(e => e[idKey] === item[idKey]);
        return { ...item, isRegistered: isRegistered };
    });

    const maxEntries = isPemain ? 25 : 10;
    const idKey = isPemain ? 'id_pemain' : 'id_official';
    const nameKey = isPemain ? 'nama_pemain' : 'nama_official';
    const detailKey = isPemain ? 'posisi' : 'jabatan';

    let listHtml = `
        <div class="alert alert-info">Pilih maksimal **${maxEntries}** ${isPemain ? 'Pemain' : 'Official'}.</div>
        <form id="prakompetisi-form">
            <input type="hidden" name="id_kompetisi" value="${globalCurrentKompetisi.id_kompetisi}">
            <div id="selection-list" class="list-group">
                ${dataList.map(item => {
                    const detail = isPemain ? `${item.posisi} (${calculateAge(item.tanggal_lahir)} tahun)` : item.jabatan;
                    return `
                        <label class="list-group-item d-flex justify-content-between align-items-center ${!item.isRegistered && currentEntries.length >= maxEntries && !isPemain ? 'disabled' : ''}">
                            <input class="form-check-input me-3" type="checkbox" name="selected_items" value="${item[idKey]}" 
                                data-name="${item[nameKey]}"
                                data-detail="${item[detailKey]}"
                                data-extra="${isPemain ? item.no_punggung : ''}"
                                ${item.isRegistered ? 'checked' : ''}
                                onchange="updatePrakompetisiCount(this, ${maxEntries}, '${type}')"
                                ${!item.isRegistered && currentEntries.length >= maxEntries ? 'disabled' : ''}>
                            
                            <div>
                                <strong>${item[nameKey]}</strong>
                                <span class="badge bg-secondary ms-2">${isPemain ? `No.${item.no_punggung}` : item.jabatan}</span>
                                <small class="d-block text-muted">${detail}</small>
                            </div>
                        </label>
                    `;
                }).join('')}
            </div>
            <div class="mt-3 text-end">
                Total terpilih: <strong id="prakompetisi-count">${currentEntries.length}</strong> / ${maxEntries}
            </div>
        </form>
    `;

    showModalForm(`Atur Daftar ${isPemain ? 'Pemain' : 'Official'}`, listHtml, (e) => handlePrakompetisiFormSubmit(e, type));
}

function updatePrakompetisiCount(checkbox, maxEntries, type) {
    const form = checkbox.closest('form');
    const selected = form.querySelectorAll('input[name="selected_items"]:checked');
    const countElement = document.getElementById('prakompetisi-count');
    countElement.textContent = selected.length;

    // Nonaktifkan checkbox lain jika sudah mencapai batas
    const listGroupItems = document.querySelectorAll('#selection-list .list-group-item');
    listGroupItems.forEach(item => {
        const itemCheckbox = item.querySelector('input[type="checkbox"]');
        if (!itemCheckbox.checked && selected.length >= maxEntries) {
            itemCheckbox.disabled = true;
            item.classList.add('disabled');
        } else {
            // Aktifkan kembali yang tidak terpilih jika batas belum tercapai
            itemCheckbox.disabled = false;
            item.classList.remove('disabled');
        }
    });
    
    if (selected.length > maxEntries) {
        showToast(`Maksimal ${maxEntries} entri untuk ${type}.`, false);
    }
}

async function handlePrakompetisiFormSubmit(e, type) {
    e.preventDefault();
    const form = e.target;
    const selectedCheckboxes = form.querySelectorAll('input[name="selected_items"]:checked');
    const maxEntries = type === 'pemain' ? 25 : 10;
    
    if (selectedCheckboxes.length > maxEntries) {
        showToast(`Maksimal ${maxEntries} entri untuk ${type}.`, false);
        return;
    }
    
    const entries = Array.from(selectedCheckboxes).map(cb => {
        const item = {};
        const isPemain = type === 'pemain';
        const idKey = isPemain ? 'id_pemain' : 'id_official';

        item[idKey] = cb.value;
        item[isPemain ? 'nama_pemain' : 'nama_official'] = cb.dataset.name;
        item[isPemain ? 'posisi' : 'jabatan'] = cb.dataset.detail.split(' (')[0]; // Ambil Posisi/Jabatan tanpa usia

        if (isPemain) {
            item.no_punggung = cb.dataset.extra;
        }
        return item;
    });

    const action = type === 'pemain' ? 'SAVE_PEMAIN_PRAKOMPETISI' : 'SAVE_OFFICIAL_PRAKOMPETISI';
    const dataToSend = {
        id_kompetisi: form.id_kompetisi.value,
        entries: JSON.stringify(entries)
    };

    const result = await callAppsScript(action, dataToSend);
    
    if (result && result.success) {
        showToast(result.message);
        const modalElement = document.getElementById('genericModal');
        if (modalElement) {
            bootstrap.Modal.getInstance(modalElement).hide();
        }
        loadPrakompetisiData(form.id_kompetisi.value);
    } else {
        showToast(result.message || "Gagal menyimpan pendaftaran.", false);
    }
}


// --- FUNGSI SETTING (ADMIN PUSAT) ---

async function renderSettingPage() {
    if (currentUser.type_users !== 'ADMIN_PUSAT') {
        contentDiv.innerHTML = `<div class="alert alert-danger">Akses ditolak. Halaman ini hanya untuk Admin Pusat.</div>`;
        return;
    }
    
    contentDiv.innerHTML = `
        <h2><i class="fas fa-cog me-2"></i>Pengaturan Sistem</h2><hr>
        <ul class="nav nav-tabs" id="setting-tabs" role="tablist">
            <li class="nav-item" role="presentation">
                <button class="nav-link active" id="banner-tab" data-bs-toggle="tab" data-bs-target="#tab-banner" type="button" role="tab" aria-controls="tab-banner" aria-selected="true">
                    Pengaturan Banner
                </button>
            </li>
            <li class="nav-item" role="presentation">
                <button class="nav-link" id="userlist-tab" data-bs-toggle="tab" data-bs-target="#tab-userlist" type="button" role="tab" aria-controls="tab-userlist" aria-selected="false" onclick="loadUserlistSetting()">
                    Manajemen Pengguna
                </button>
            </li>
        </ul>
        <div class="tab-content border border-top-0 p-3 bg-white" id="setting-tab-content">
            <div class="tab-pane fade show active" id="tab-banner" role="tabpanel" aria-labelledby="banner-tab">
                ${await renderBannerSetting()}
            </div>
            <div class="tab-pane fade" id="tab-userlist" role="tabpanel" aria-labelledby="userlist-tab">
                <div id="userlist-content">Memuat data pengguna...</div>
            </div>
        </div>
    `;
}

async function renderBannerSetting() {
    const result = await callAppsScript('GET_BANNERS');
    const data = result.success ? result.data : {};
    
    return `
        <p>Atur judul, deskripsi, dan gambar yang akan muncul di halaman Dashboard.</p>
        <form id="banner-form" class="row g-3">
            <input type="hidden" name="action" value="UPDATE">
            
            <div class="col-12">
                <label for="title_banner" class="form-label">Judul Banner</label>
                <input type="text" class="form-control" id="title_banner" name="title_banner" value="${data.title_banner || ''}">
            </div>
            <div class="col-12">
                <label for="description_banner" class="form-label">Deskripsi Banner</label>
                <textarea class="form-control" id="description_banner" name="description_banner">${data.description_banner || ''}</textarea>
            </div>
            <div class="col-12">
                <label for="banner_file" class="form-label">Gambar Banner (Max 1MB)</label>
                <input type="file" class="form-control" id="banner_file" name="banner_file" accept="image/*" onchange="previewImage(event, 'banner-preview')" data-old-value="${data.url_banner || ''}">
                <input type="hidden" name="url_banner" value="${data.url_banner || ''}">
                <img id="banner-preview" src="${data.url_banner || 'https://via.placeholder.com/200x100?text=Banner+Preview'}" class="img-thumbnail mt-2" style="max-height: 100px;">
            </div>
            
            <div class="col-12 text-end">
                <button type="submit" class="btn btn-primary">Simpan Pengaturan</button>
            </div>
        </form>
        <script>
            document.getElementById('banner-form').addEventListener('submit', handleBannerFormSubmit);
        </script>
    `;
}

async function handleBannerFormSubmit(e) {
    await handleGenericFormSubmit(e, 'CRUD_BANNER', ['banner_file'], renderHome);
}

async function loadUserlistSetting() {
    const userlistContent = document.getElementById('userlist-content');
    userlistContent.innerHTML = `<p>Memuat daftar pengguna...</p>`;
    
    const result = await callAppsScript('GET_USERLIST');
    const allUsers = result.success ? result.data : [];

    let tableHtml = `
        <button class="btn btn-success mb-3" onclick="showUserlistForm(null, {})">
            <i class="fas fa-plus me-1"></i> Tambah Pengguna Baru
        </button>
        <div class="table-responsive">
            <table class="table table-striped table-hover table-sm">
                <thead class="bg-dark text-white">
                    <tr>
                        <th>Username</th>
                        <th>Tipe Pengguna</th>
                        <th>ID Klub (Jika Admin Klub)</th>
                        <th>Aksi</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    if (allUsers.length === 0) {
        tableHtml += `<tr><td colspan="4" class="text-center">Tidak ada pengguna terdaftar.</td></tr>`;
    } else {
        allUsers.forEach(user => {
            const isSelf = user.username === currentUser.username;
            tableHtml += `
                <tr>
                    <td>${user.username} ${isSelf ? '<span class="badge bg-info">Anda</span>' : ''}</td>
                    <td>${user.type_users}</td>
                    <td>${user.id_klub || '-'}</td>
                    <td>
                        <button class="btn btn-sm btn-primary me-1" onclick="showUserlistForm('${user.username}', ${JSON.stringify(user)})" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="confirmDeleteUserlist('${user.username}')" title="Hapus" ${isSelf ? 'disabled' : ''}>
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
    }
    
    tableHtml += `</tbody></table></div>`;
    userlistContent.innerHTML = tableHtml;
}

function showUserlistForm(username, data) {
    const isNew = !username;
    data.action = isNew ? 'CREATE' : 'UPDATE';
    data.username = username || '';

    const typeOptions = ['ADMIN_PUSAT', 'ADMIN_KLUB'];
    const isSelf = username === currentUser.username;

    const formHtml = `
        <input type="hidden" name="action" value="${data.action}">
        <div class="col-md-6">
            <label for="username" class="form-label">Username</label>
            <input type="text" class="form-control" id="username" name="username" value="${data.username}" ${isNew ? '' : 'readonly'} required>
            ${!isNew ? '<small class="text-muted">Username tidak dapat diubah.</small>' : ''}
        </div>
        <div class="col-md-6">
            <label for="password" class="form-label">Password ${isNew ? '' : '(Kosongkan jika tidak ingin diubah)'}</label>
            <input type="password" class="form-control" id="password" name="password" ${isNew ? 'required' : ''}>
        </div>
        <div class="col-md-6">
            <label for="type_users" class="form-label">Tipe Pengguna</label>
            <select class="form-select" id="type_users" name="type_users" required ${isSelf ? 'disabled' : ''}>
                ${typeOptions.map(t => `<option value="${t}" ${data.type_users === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
            ${isSelf ? `<input type="hidden" name="type_users" value="${data.type_users}">` : ''}
            ${isSelf ? '<small class="text-danger">Anda tidak dapat mengubah tipe pengguna Anda sendiri.</small>' : ''}
        </div>
        <div class="col-md-6">
            <label for="id_klub" class="form-label">ID Klub (Wajib untuk ADMIN_KLUB)</label>
            <input type="text" class="form-control" id="id_klub" name="id_klub" value="${data.id_klub || ''}">
        </div>
    `;

    showModalForm(`${isNew ? 'Tambah' : 'Edit'} Pengguna`, formHtml, handleUserlistFormSubmit);
}

async function handleUserlistFormSubmit(e) {
    await handleGenericFormSubmit(e, 'CRUD_USERLIST', [], loadUserlistSetting);
}

function confirmDeleteUserlist(username) {
    if (username === currentUser.username) {
         showToast('Anda tidak bisa menghapus akun Anda sendiri.', false);
         return;
    }
    showConfirmationModal(`Apakah Anda yakin ingin menghapus pengguna **${username}**?`, async () => {
        const data = { action: 'DELETE', username: username };
        const result = await callAppsScript('CRUD_USERLIST', { data: JSON.stringify(data) });
        
        if (result && result.success) {
            showToast(result.message);
            loadUserlistSetting();
        } else {
            showToast(result.message || "Gagal menghapus pengguna.", false);
        }
    });
}

// Inisialisasi Aplikasi
window.onload = renderApp;
