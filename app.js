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

// =================================================================
// PENINGKATAN: FUNGSI UNTUK MERENDER TABEL AGAR RESPONSIVE (RINGAN/ELEGANT)
// =================================================================
/**
 * Merender data dalam format tabel (Desktop) atau kartu (Seluler).
 * @param {Array<Object>} data - Data.
 * @param {Array<Object>} columns - Definisi kolom: [{key: 'key', label: 'Label', mobile: true/false}, ...]
 * @param {Function} actionRenderer - Fungsi untuk merender kolom aksi.
 * @param {string} cardTitleKey - Kunci data yang akan dijadikan judul kartu di mode seluler.
 * @returns {string} HTML untuk tabel atau kartu.
 */
function renderResponsiveTable(data, columns, actionRenderer, cardTitleKey) {
    if (data.length === 0) {
        return '<p class="text-muted">Tidak ada data ditemukan.</p>';
    }

    // 1. Tampilan Seluler: Cards
    const mobileCards = data.map(item => {
        const title = item[cardTitleKey] || columns.find(c => c.key === cardTitleKey)?.label || 'Detail Data';
        const cardBody = columns.filter(c => c.mobile !== false).map(col => `
            <li class="list-group-item d-flex justify-content-between align-items-center px-0 py-2">
                <span class="text-muted small">${col.label}:</span>
                <span class="fw-bold text-end">${item[col.key] || '-'}</span>
            </li>
        `).join('');

        return `
            <div class="card mb-3 shadow-sm">
                <div class="card-header bg-primary text-white fw-bold">${title}</div>
                <ul class="list-group list-group-flush">
                    ${cardBody}
                </ul>
                <div class="card-footer text-end">
                    ${actionRenderer(item)}
                </div>
            </div>
        `;
    }).join('');

    // 2. Tampilan Desktop: Table
    const tableHeader = columns.map(col => `<th scope="col">${col.label}</th>`).join('');
    const tableBody = data.map(item => {
        const rowCells = columns.map(col => `<td>${item[col.key] || '-'}</td>`).join('');
        const actionCell = `<td class="text-nowrap">${actionRenderer(item)}</td>`; 
        return `<tr>${rowCells}${actionCell}</tr>`;
    }).join('');

    const desktopTable = `
        <div class="table-responsive">
            <table class="table table-hover align-middle table-striped">
                <thead>
                    <tr>
                        ${tableHeader}
                        <th scope="col" class="text-nowrap">Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableBody}
                </tbody>
            </table>
        </div>
    `;

    return `
        <div class="d-lg-none">
            ${mobileCards}
        </div>
        <div class="d-none d-lg-block">
            ${desktopTable}
        </div>
    `;
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        // Hapus header data URI ("data:image/jpeg;base64,")
        reader.onload = () => resolve(reader.result.split(',')[1]); 
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

function previewImage(event, previewId) {
    const reader = new FileReader();
    reader.onload = function(){
        const output = document.getElementById(previewId);
        output.src = reader.result;
    }
    reader.readAsDataURL(event.target.files[0]);
}

function calculateAge(dateOfBirth) {
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
        age--;
    }
    return age;
}

function isEditable(timestamp, userType) {
    if (userType === 'ADMIN_PUSAT') return true;
    const timeDiff = new Date().getTime() - new Date(timestamp).getTime();
    return timeDiff < 60 * 60 * 1000;
}

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
            <div class="modal-dialog modal-dialog-centered modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        
                        <h5 class="modal-title" id="${modalId}Label">${title}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <form id="generic-form">
                        <div class="modal-body row g-3">
  
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
    const modalHtml = `
        <div class="modal fade" id="confirmModal" tabindex="-1" aria-labelledby="confirmModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        
                        <h5 class="modal-title" id="confirmModalLabel">Konfirmasi Aksi</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        ${message}
    
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button>
                        <button type="button" class="btn btn-danger" id="confirmButton">Ya, Lanjutkan</button>
      
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modalElement = document.getElementById('confirmModal');
    const modal = new bootstrap.Modal(modalElement);
    modal.show();
    document.getElementById('confirmButton').onclick = () => {
        modal.hide();
        onConfirm();
    };

    modalElement.addEventListener('hidden.bs.modal', () => modalElement.remove());
}

// --- CORE LOGIC (APPS SCRIPT COMMUNICATION) ---

async function callAppsScript(action, params = {}) {
    const finalParams = new URLSearchParams({
        action: action,
        user: JSON.stringify(currentUser),
        ...params
    });
    showLoading();
    
    try {
        const response = await fetch(GAS_API_URL, {
            method: 'POST',
            body: finalParams,
        });
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }
        
        const result = await response.json();
        hideLoading();
        
        if (result && !result.success) {
            showToast(result.message || 'Terjadi kesalahan pada server.', false);
        }
        
        return result;
    } catch (error) {
        hideLoading();
        showToast(`Komunikasi Gagal: ${error.message}. Pastikan URL API sudah benar.`, false);
        return { success: false, message: error.message };
    }
}

async function handleGenericFormSubmit(e, crudAction, fileFields, callback) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    const modalElement = form.closest('.modal');
    const modal = modalElement ? bootstrap.Modal.getInstance(modalElement) : null;
    const isUpdate = data.action === 'UPDATE';
    
    if (crudAction === 'CRUD_USERLIST' && isUpdate && !data.password) {
        delete data.password;
    }

    showLoading();

    // --- 1. PROSES UPLOAD GAMBAR KE IMGBB VIA APPS SCRIPT ---
    let uploadSuccess = true;
    for (const fieldName of fileFields) {
        const fileInput = document.getElementById(fieldName);
        // Nama kolom di Sheet: Ambil bagian sebelum '_file'
        const sheetFieldName = fieldName.replace('_file', '');
        if (fileInput && fileInput.files.length > 0) {
            const base64Data = await fileToBase64(fileInput.files[0]);
            // Panggil Apps Script untuk meneruskan Base64 ke ImgBB
            const uploadResult = await callAppsScript('UPLOAD_IMAGE', { base64Data });
            if (!uploadResult || !uploadResult.success) {
                hideLoading();
                showToast(uploadResult.message || `Gagal mengupload file untuk ${fieldName}.`, false);
                uploadSuccess = false;
                break;
            }
            
            let uploadedUrl = uploadResult.url;
            // ✅ PERBAIKAN DOMAIN IMGBB: Ganti domain pendek menjadi domain panjang yang berfungsi
            if (uploadedUrl && uploadedUrl.includes('https://i.ibb.co/')) {
                uploadedUrl = uploadedUrl.replace('https://i.ibb.co/', 'https://i.ibb.co.com/');
            }

            // Simpan URL yang sudah diperbaiki ke data yang akan dikirim ke Apps Script
            data[sheetFieldName] = uploadedUrl;
        } else if (isUpdate) {
            // Jika update dan tidak ada file baru, pertahankan URL lama yang ada di input hidden
            data[sheetFieldName] = data[sheetFieldName] || ''; 
        }
    }

    if (!uploadSuccess) return;
    // --- 2. HAPUS FIELD ID INPUT TAMBAHAN (untuk CREATE) ---
    if (data.id_pemain_input) {
        data.id_pemain = data.id_pemain_input;
        delete data.id_pemain_input;
    }
    if (data.id_official_input) {
        data.id_official = data.id_official_input;
        delete data.id_official_input;
    }
    
    // --- 3. PANGGIL CRUD APPS SCRIPT ---
    const result = await callAppsScript(crudAction, { data: JSON.stringify(data) });
    hideLoading();

    if (result && result.success) {
        if (modal) modal.hide();
        showToast(result.message);
        callback();
    } else if (result) {
        showToast(result.message, false);
    }
}


// --- APP FLOW & AUTHENTICATION ---

function renderApp() {
    currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    if (currentUser) {
        renderMainLayout();
        changePage('home'); // DIGANTI: renderPage -> changePage
    } else {
        renderLoginPage();
    }
}

function renderLoginPage() {
    appContainer.innerHTML = `
        <div id="login-page">
            <div id="login-form">
                <h4 class="text-center mb-4 text-primary"><i class="fas fa-futbol me-2"></i>Sistem Informasi PSSI Kepulauan Mentawai (SIPAKEM)</h4>
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
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    const result = await callAppsScript('CHECK_AUTH', data);
    if (result && result.success) {
        sessionStorage.setItem('currentUser', JSON.stringify(result.user));
        currentUser = result.user;
        renderApp();
    } else if (result) {
        showToast(result.message, false);
    }
}

function handleLogout() {
    sessionStorage.removeItem('currentUser');
    currentUser = null;
    renderApp();
}

// *********** FUNGSI MENU BARU ***********
function getSidebarMenu() {
    const simplifiedMenus = [
        { id: 'home', name: 'Dashboard', icon: 'fas fa-home', roles: ['SUPER_ADMIN', 'ADMIN_KOMPETISI', 'ADMIN_KLUB'] },
        // Menu Klub
        { id: 'profil', name: 'Profil Klub', icon: 'fas fa-building', roles: ['ADMIN_KLUB'] },
        { id: 'pemain', name: 'Pemain', icon: 'fas fa-running', roles: ['ADMIN_KLUB'] },
        { id: 'official', name: 'Official', icon: 'fas fa-chalkboard-teacher', roles: ['ADMIN_KLUB'] },
        // Menu Admin Pusat (Menggunakan ID yang sama untuk routing)
        { id: 'profil', name: 'Semua Klub', icon: 'fas fa-building', roles: ['ADMIN_PUSAT'] }, 
        { id: 'pemain', name: 'Semua Pemain', icon: 'fas fa-running', roles: ['ADMIN_PUSAT'] },
        { id: 'official', name: 'Semua Official', icon: 'fas fa-chalkboard-teacher', roles: ['ADMIN_PUSAT'] },
        { id: 'kompetisi', name: 'Kompetisi (CRUD)', icon: 'fas fa-trophy', roles: ['SUPER_ADMIN', 'ADMIN_KOMPETISI', 'ADMIN_PUSAT'] }, // Asumsi ADMIN_KOMPETISI juga masuk
        { id: 'setting', name: 'Setting', icon: 'fas fa-cog', roles: ['ADMIN_PUSAT'] },
    ];

    // Filter menu berdasarkan peran pengguna
    const menuHtml = simplifiedMenus.filter(menu => menu.roles.includes(currentUser.type_users))
        // Memastikan tidak ada duplikasi ID yang sama di menu yang ditampilkan 
        .reduce((acc, current) => {
            const x = acc.find(item => item.id === current.id && item.roles.includes(currentUser.type_users));
            if (!x) {
                return acc.concat([current]);
            } else {
                return acc;
            }
        }, [])
        .map(menu => {
             let displayName = menu.name;
             const pageId = menu.id;

             return `
                 <li class="nav-item">
                     <a class="nav-link ${currentPage === pageId ? 'active' : ''}" href="#" onclick="changePage('${pageId}'); if(window.innerWidth < 992) { bootstrap.Offcanvas.getInstance('#mobileSidebar').hide(); }">
                         <i class="${menu.icon} fa-fw me-2"></i> ${displayName}
                     </a>
                 </li>
             `;
        }).join('');
    
    return `<ul class="nav flex-column p-3">${menuHtml}</ul>`;
}

// *********** GANTI FUNGSI renderMainLayout ***********
function renderMainLayout() {
    // 1. Sinkronkan Menu Sidebar ke Desktop dan Mobile Offcanvas
    const menuHtml = getSidebarMenu();
    
    const desktopSidebar = document.getElementById('sidebar-menu-list-desktop');
    const mobileSidebar = document.getElementById('sidebar-menu-list-mobile');

    if (desktopSidebar) desktopSidebar.innerHTML = menuHtml;
    if (mobileSidebar) mobileSidebar.innerHTML = menuHtml;

    // 2. Render Main Navbar dengan Mobile Toggle
    const navbar = `
        <nav class="navbar navbar-expand-lg navbar-dark fixed-top shadow-sm" style="background-color: var(--primary-color) !important;">
            <div class="container-fluid">
                
                <button class="navbar-toggler d-lg-none me-3" type="button" data-bs-toggle="offcanvas" data-bs-target="#mobileSidebar" aria-controls="mobileSidebar">
                    <span class="navbar-toggler-icon"></span>
                </button>

                <a class="navbar-brand fw-bold" href="#" onclick="changePage('home')">SIPAKEM</a>
                
                <div class="ms-auto d-flex align-items-center">
                    <span class="navbar-user-info me-3 d-none d-sm-block">
                        <i class="fas fa-user-circle me-1"></i> 
                        ${currentUser.username} (${currentUser.type_users})
                    </span>
                    <button class="btn btn-sm btn-outline-light" onclick="handleLogout()">
                        <i class="fas fa-sign-out-alt"></i> Keluar
                    </button>
                </div>
            </div>
        </nav>
    `;

    // 3. Render Main Content Area
    const content = `
        <div class="content" style="padding-top: 70px;">
            <div id="content-div">
                </div>
        </div>
    `;

    appContainer.innerHTML = navbar + content;
    contentDiv = document.getElementById('content-div');
    changePage(currentPage); 
}

// *********** GANTI NAMA fungsi renderPage LAMA menjadi changePage ***********
// Fungsi renderSidebar LAMA dihapus total.
function changePage(page) {
    currentPage = page;
    
    // Perbarui active class di kedua sidebar (Desktop dan Mobile Offcanvas)
    document.querySelectorAll('#sidebar-menu-list-desktop .nav-link, #sidebar-menu-list-mobile .nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Gunakan page sebagai selector untuk menyamakan class active
    const activeLinks = document.querySelectorAll(`.nav-link[onclick="changePage('${page}')"]`);
    activeLinks.forEach(link => link.classList.add('active'));

    // Panggil fungsi render halaman yang sesuai
    if (page === 'home') renderHome();
    else if (page === 'profil') renderProfil();
    else if (page === 'pemain') renderPemain();
    else if (page === 'official') renderOfficial();
    else if (page === 'kompetisi') renderKompetisi();
    else if (page === 'setting') renderSetting();
    else contentDiv.innerHTML = `<h2>Halaman Tidak Ditemukan</h2>`;
}


// --- NAVIGASI HOME ---
async function loadBanners() {
    const result = await callAppsScript('GET_BANNERS');
    const inner = document.getElementById('banner-inner');
    inner.innerHTML = '';

    if (!result || !result.success || Object.keys(result.data).length === 0) {
        inner.innerHTML = `<div class="carousel-item active"><div class="alert alert-warning text-center">Tidak ada banner terdaftar.</div></div>`;
        return;
    }

    let first = true;
    let hasContent = false;
    for (let i = 1; i <= 3; i++) {
        const url = result.data[`url_banner${i}`];
        if (url) {
            inner.innerHTML += `
                <div class="carousel-item ${first ? 'active' : ''}">
                    <img src="${url}" class="d-block w-100 rounded" style="height: 250px; object-fit: cover;"
                        alt="Banner ${i}">
                </div>
            `;
            first = false;
            hasContent = true;
        }
    }
     if (!hasContent) {
        inner.innerHTML = `<div class="carousel-item active"><div class="alert alert-info text-center">Tidak ada gambar banner.</div></div>`;
    }
}

async function renderHome() {
    const clubInfo = await callAppsScript('GET_PROFIL_KLUB');
    const profilKlub = clubInfo && clubInfo.success && !Array.isArray(clubInfo.data) ? clubInfo.data : null;
    contentDiv.innerHTML = `
        <h2><i class="fas fa-home me-2"></i>Dashboard Klub</h2>
        <div id="home-alerts"></div>
        <div class="row g-4 mt-3">
            <div class="col-lg-6">
                <div class="card shadow-sm h-100">
                    <div class="card-header bg-primary text-white"><i class="fas fa-shield-alt me-2"></i>Status Profil Klub</div>
      
                    <div class="card-body" id="club-status-card">
                        ${profilKlub ?
                            `
                            <h5 class="card-title">${profilKlub.nama_klub}</h5>
                            <p class="card-text">
                                ID Klub: ${profilKlub.id_klub}<br>
        
                                Alamat: ${profilKlub.alamat_klub ||
                                    '-'}<br>
                                Nama Manajer: ${profilKlub.nama_manajer ||
                                    '-'}
                            </p>
                            <span class="badge bg-success"><i class="fas fa-check-circle me-1"></i> Profil Lengkap</span>
                            <button class="btn btn-sm btn-outline-primary float-end" onclick="changePage('profil')">Lihat Detail</button>
   
                        ` : currentUser.type_users.startsWith('ADMIN_KLUB') ?
                            `
                            <div class="alert alert-danger">
                                <i class="fas fa-exclamation-triangle me-2"></i> Peringatan: Profil Klub Anda belum terdaftar!
                            </div>
                            <button class="btn btn-danger w-100" onclick="changePage('profil')">Daftarkan Profil Klub Sekarang</button>
                        ` : `
                            <div class="alert alert-info">
         
                                <i class="fas fa-info-circle me-2"></i> Admin Pusat memiliki akses penuh ke semua data klub.
                            </div>
                            <button class="btn btn-primary w-100" onclick="changePage('profil')">Lihat Semua Klub</button>
                        `}
                    </div>
                </div>
      
            </div>
            <div class="col-lg-6">
                <div class="card shadow-sm h-100">
                    <div class="card-header bg-info text-dark"><i class="fas fa-bell me-2"></i>Pembaruan & Notifikasi</div>
                    <div class="card-body" id="notification-card">
            
                        <ul class="list-group list-group-flush" id="notification-list">
                            <li class="list-group-item text-muted">Memuat notifikasi...</li>
                        </ul>
                    </div>
          
                </div>
            </div>
        </div>
        <div class="mt-4">
            <h4><i class="fas fa-images me-2"></i>Info Terbaru</h4>
            <div id="banner-carousel" class="carousel slide" data-bs-ride="carousel">
                <div class="carousel-inner" id="banner-inner">
               
                    <p class="text-center p-5"><i class="fas fa-spinner fa-spin me-2"></i>Memuat banner...</p>
                </div>
                <button class="carousel-control-prev" type="button" data-bs-target="#banner-carousel" data-bs-slide="prev">
                    <span class="carousel-control-prev-icon" aria-hidden="true"></span>
                    <span class="visually-hidden">Previous</span>
         
                </button>
                <button class="carousel-control-next" type="button" data-bs-target="#banner-carousel" data-bs-slide="next">
                    <span class="carousel-control-next-icon" aria-hidden="true"></span>
                    <span class="visually-hidden">Next</span>
                </button>
            </div>
  
        </div>
    `;
    
    loadBanners();
    if (currentUser.type_users.startsWith('ADMIN_KLUB')) {
        loadClubNotifications();
    } else if (currentUser.type_users === 'ADMIN_PUSAT') {
        loadAdminPusatNotifications();
    }
}

async function loadClubNotifications() {
    const list = document.getElementById('notification-list');
    list.innerHTML = '';
    
    const pemainResult = await callAppsScript('GET_PEMAIN');
    const officialResult = await callAppsScript('GET_OFFICIAL');
    const kompetisiResult = await callAppsScript('GET_LIST_KOMPETISI');
    const now = new Date().getTime();
    const oneHour = 60 * 60 * 1000;
    
    let recentChanges = 0;
    if (pemainResult && pemainResult.success) {
        pemainResult.data.filter(p => p.id_klub === currentUser.id_klub && (now - new Date(p.time_stamp).getTime() < oneHour)).forEach(p => {
            list.innerHTML += `<li class="list-group-item list-group-item-warning"><i class="fas fa-edit me-2"></i> Pemain ${p.nama_pemain} hanya bisa di Edit/Hapus dalam 10 hari.</li>`;
            recentChanges++;
        });
    }

    if (officialResult && officialResult.success) {
        officialResult.data.filter(o => o.id_klub === currentUser.id_klub && (now - new Date(o.time_stamp).getTime() < oneHour)).forEach(o => {
            list.innerHTML += `<li class="list-group-item list-group-item-warning"><i class="fas fa-edit me-2"></i> Official ${o.nama_official}  hanya bisa di Edit/Hapus dalam 10 hari.</li>`;
            recentChanges++;
        });
    }

    if (kompetisiResult && kompetisiResult.success) {
        kompetisiResult.data.forEach(k => {
            const startDate = new Date(k.tanggal_awal_pendaftaran).getTime();
            const endDate = new Date(k.tanggal_akhir_pendaftaran).getTime();
            if (now >= startDate && now <= endDate) {
                list.innerHTML += `<li class="list-group-item list-group-item-success"><i class="fas fa-trophy me-2"></i> Pendaftaran ${k.nama_kompetisi} telah dibuka!</li>`;
   
                recentChanges++;
            }
        });
    }

    if (recentChanges === 0) {
        list.innerHTML = `<li class="list-group-item text-success"><i class="fas fa-check me-2"></i> Semua data Anda stabil.
Tidak ada pembaruan mendesak.</li>`;
    }
}

function loadAdminPusatNotifications() {
    const list = document.getElementById('notification-list');
    list.innerHTML = `
        <li class="list-group-item text-primary"><i class="fas fa-star me-2"></i> Selamat datang kembali, Admin Pusat.</li>
        <li class="list-group-item"><i class="fas fa-cog me-2"></i> Akses penuh ke Setting (Banner & Userlist) dan CRUD Kompetisi.</li>
        <li class="list-group-item text-muted"><i class="fas fa-search me-2"></i> Lihat data klub dan pemain di menu terkait.</li>
    `;
}

// --- NAVIGASI PROFIL KLUB ---
async function renderProfil() {
    if (currentUser.type_users === 'ADMIN_PUSAT') {
        renderAllKlubList();
    } else {
        renderKlubForm();
    }
}

async function renderKlubForm() {
    const result = await callAppsScript('GET_PROFIL_KLUB');
    const data = result && result.success && !Array.isArray(result.data) ? result.data : {};
    const isNew = !data.id_klub;
    // Perubahan 1: Menggunakan logo_klub
    contentDiv.innerHTML = `
        <h2><i class="fas fa-building me-2"></i>${isNew ?
            'Daftar' : 'Edit'} Profil Klub</h2>
        <div class="card p-3 shadow-sm">
            <form id="profil-klub-form" class="row g-3">
                <input type="hidden" name="action" value="${isNew ? 'CREATE' : 'UPDATE'}">
                <input type="hidden" name="id_klub" value="${data.id_klub || currentUser.id_klub}">
                
          
                <div class="col-12 text-center">
                    <img id="logo-preview" src="${data.logo_klub || 'https://via.placeholder.com/150?text=Logo+Klub'}" class="rounded shadow mb-2" style="width: 150px; height: 150px; object-fit: cover;">
                    <input type="file" class="form-control" id="logo_klub_file" accept="image/*" onchange="previewImage(event, 'logo-preview')" ${isNew ?
                        '' : ''}>
                    <input type="hidden" name="logo_klub" value="${data.logo_klub || ''}">
                </div>

                <div class="col-md-6">
                    <label for="id_klub_display" class="form-label">ID Klub</label>
                 
                    <input type="text" class="form-control" id="id_klub_display" value="${currentUser.id_klub}" readonly>
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
                    <label for="alamat_klub" class="form-label">Alamat Klub</label>
                    <input type="text" class="form-control" id="alamat_klub" name="alamat_klub" value="${data.alamat_klub || ''}">
                </div>
                <div class="col-12">
                    <label for="ketua_klub" class="form-label">Ketua Klub</label>
                    <input type="text" class="form-control" id="ketua_klub" name="ketua_klub" value="${data.ketua_klub || ''}">
                </div>
                <div class="col-12 mt-4">
                    <button type="submit" class="btn btn-primary w-100"><i class="fas fa-save me-2"></i> Simpan Profil</button>
                </div>
            </form>
        </div>
    `;

    document.getElementById('profil-klub-form').addEventListener('submit', (e) => {
        handleGenericFormSubmit(e, 'CRUD_PROFIL_KLUB', ['logo_klub_file'], renderKlubForm);
    });
}

async function renderAllKlubList() {
    contentDiv.innerHTML = `
        <h2><i class="fas fa-building me-2"></i>Daftar Semua Klub</h2>
        <div class="row g-3 mt-3" id="klub-list">
            <p class="text-center"><i class="fas fa-spinner fa-spin me-2"></i>Memuat data klub...</p>
        </div>
    `;
    const result = await callAppsScript('GET_PROFIL_KLUB');
    const listDiv = document.getElementById('klub-list');
    listDiv.innerHTML = '';
    if (!result || !result.success || result.data.length === 0) {
        listDiv.innerHTML = `<div class="col-12"><div class="alert alert-info text-center">Tidak ada profil klub yang terdaftar.</div></div>`;
        return;
    }
    result.data.forEach(klub => {
        listDiv.innerHTML += `
            <div class="col-12 col-md-6 col-lg-4 d-flex">
                <div class="card w-100 shadow-sm">
                    <div class="card-body">
                        <h5 class="card-title">${klub.nama_klub}</h5>
                        <p class="card-text mb-1">ID: ${klub.id_klub}</p>
                        <p class="card-text mb-1">Manajer: ${klub.nama_manajer || '-'}</p>
                        <small class="text-muted">Terdaftar: ${new Date(klub.time_stamp).toLocaleDateString()}</small>
                        <button class="btn btn-sm btn-outline-info float-end mt-2" onclick="showKlubDetailAdmin('${klub.id_klub}', ${JSON.stringify(klub).replace(/"/g, '&quot;')})">Lihat Detail</button>
                    </div>
                </div>
            </div>
        `;
    });
}
function showKlubDetailAdmin(id_klub, klub) {
    // Perubahan 1: Menggunakan logo_klub
    const formHtml = `
        <div class="col-12 text-center mb-3">
            <img src="${klub.logo_klub ||
                'https://via.placeholder.com/100x100?text=Logo'}" class="rounded shadow" style="width: 100px; height: 100px; object-fit: cover;">
        </div>
        <div class="col-12">
            <ul class="list-group list-group-flush">
                <li class="list-group-item"><strong>Nama Klub:</strong> ${klub.nama_klub}</li>
                <li class="list-group-item"><strong>ID Klub:</strong> ${klub.id_klub}</li>
                <li class="list-group-item"><strong>Nama Manajer:</strong> ${klub.nama_manajer}</li>
                <li class="list-group-item"><strong>Ketua Klub:</strong> ${klub.ketua_klub || '-'}</li>
                <li class="list-group-item"><strong>Alamat:</strong> ${klub.alamat_klub || '-'}</li>
                <li class="list-group-item"><strong>Terakhir Diperbarui:</strong> ${new Date(klub.time_stamp).toLocaleString()}</li>
            </ul>
        </div>
    `;
    const customFooter = `<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Tutup</button>`;
    showModalForm('Detail Klub', formHtml, (e) => e.preventDefault(), customFooter);
}


// --- NAVIGASI PEMAIN ---
async function renderPemain() {
    contentDiv.innerHTML = `
        <h2><i class="fas fa-running me-2"></i>Data Pemain</h2>
        <div class="input-group mb-3">
            <input type="text" class="form-control" placeholder="Cari Pemain..." id="search-pemain" onkeyup="filterPemainList()">
            <button class="btn btn-primary" type="button" onclick="filterPemainList()"><i class="fas fa-search"></i></button>
        </div>
        ${(currentUser.type_users.startsWith('ADMIN_KLUB') || currentUser.type_users === 'ADMIN_PUSAT') ?
            `<button class="btn btn-success mb-3" onclick="openPemainForm('NEW')"><i class="fas fa-plus me-1"></i> Tambah Pemain</button>` : ''}
        <div id="pemain-list" class="row g-3">
            <p class="text-center"><i class="fas fa-spinner fa-spin me-2"></i>Memuat data pemain...</p>
        </div>
    `;
    loadPemainList();
}

async function loadPemainList() {
    const result = await callAppsScript('GET_PEMAIN');
    const listDiv = document.getElementById('pemain-list');
    listDiv.innerHTML = '';
    
    let pemainToDisplay = [];
    if (result && result.success) {
        pemainToDisplay = result.data;
    }

    if (pemainToDisplay.length === 0) {
        listDiv.innerHTML = `<div class="col-12"><div class="alert alert-info text-center">Tidak ada data pemain terdaftar.</div></div>`;
        return;
    }

    // Menggunakan Kartu (Cards) untuk tampilan pemain (cocok untuk mobile)
    pemainToDisplay.forEach(pemain => {
        listDiv.innerHTML += `
            <div class="col-12 col-sm-6 col-md-4 col-lg-3 d-flex" data-nama="${pemain.nama_pemain.toLowerCase()}">
                <div class="card w-100 shadow-sm clickable" onclick="showPemainDetail('${pemain.id_pemain}', ${JSON.stringify(pemain).replace(/"/g, '&quot;')})">
                    <img src="${pemain.pas_photo_pemain || 'https://via.placeholder.com/150x200?text=Foto'}" class="card-img-top" style="height: 200px; object-fit: cover;">
                    <div class="card-body p-2">
                        <h6 class="card-title mb-0 text-truncate">${pemain.nama_pemain}</h6>
                        <small class="text-muted d-block">${pemain.posisi} | No. ${pemain.no_punggung}</small>
                        <small class="text-muted d-block">Usia: ${calculateAge(pemain.tanggal_lahir)} th</small>
                    </div>
                </div>
            </div>
        `;
    });
}
function openPemainForm(id_pemain, data = {}) {
    const isNew = id_pemain === 'NEW';
    const posisiOptions = ["Kiper", "Bek Kanan", "Bek Tengah", "Bek Kiri", "Gelandang Kanan", "Gelandang Tengah", "Gelandang Kiri", "Penyerang"];
    // Perubahan 2: Menggunakan pas_photo_pemain
    const formHtml = `
        <input type="hidden" name="action" value="${isNew ? 'CREATE' : 'UPDATE'}">
        <input type="hidden" name="id_pemain" value="${data.id_pemain || ''}">
        <div class="col-12 text-center">
            <img id="photo-preview" src="${data.pas_photo_pemain || 'https://via.placeholder.com/150x200?text=Foto'}" class="rounded shadow mb-2" style="width: 150px; height: 200px; object-fit: cover;">
            <input type="file" class="form-control" id="pas_photo_pemain_file" accept="image/*" onchange="previewImage(event, 'photo-preview')" ${isNew ?
                '' : ''}>
            <input type="hidden" name="pas_photo_pemain" value="${data.pas_photo_pemain || ''}">
        </div>
        ${isNew ?
            ` <div class="col-md-6"> <label for="id_pemain" class="form-label">ID Pemain (16 Angka Unik)</label> <input type="number" class="form-control" id="id_pemain_input" name="id_pemain_input" value="" required minlength="16" maxlength="16"> </div>` : ''}
        <div class="col-md-6">
            <label for="nama_pemain" class="form-label">Nama Pemain</label>
            <input type="text" class="form-control" id="nama_pemain" name="nama_pemain" value="${data.nama_pemain || ''}" required>
        </div>
        <div class="col-md-6">
            <label for="tanggal_lahir" class="form-label">Tanggal Lahir (yyyy-mm-dd)</label>
            <input type="date" class="form-control" id="tanggal_lahir" name="tanggal_lahir" value="${data.tanggal_lahir ? new Date(data.tanggal_lahir).toISOString().split('T')[0] : ''}" required>
        </div>
        <div class="col-md-6">
            <label for="posisi" class="form-label">Posisi</label>
            <select class="form-select" id="posisi" name="posisi" required>
                ${posisiOptions.map(p => `<option value="${p}" ${data.posisi === p ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
        </div>
        <div class="col-md-6">
            <label for="no_punggung" class="form-label">No. Punggung</label>
            <input type="number" class="form-control" id="no_punggung" name="no_punggung" value="${data.no_punggung || ''}" required>
        </div>
    `;

    showModalForm(`${isNew ? 'Tambah' : 'Edit'} Pemain`, formHtml, handlePemainFormSubmit);
}
async function handlePemainFormSubmit(e) {
    await handleGenericFormSubmit(e, 'CRUD_PEMAIN', ['pas_photo_pemain_file'], loadPemainList);
}
function showPemainDetail(id_pemain, data) {
    const isEditAllowed = isEditable(data.time_stamp, currentUser.type_users);
    const formHtml = `
        <div class="col-12 text-center mb-3">
            <img src="${data.pas_photo_pemain || 'https://via.placeholder.com/150x200?text=Foto'}" class="rounded shadow mb-2" style="width: 150px; height: 200px; object-fit: cover;">
        </div>
        <div class="col-12">
            <ul class="list-group list-group-flush">
                <li class="list-group-item"><strong>ID Pemain:</strong> ${data.id_pemain}</li>
                <li class="list-group-item"><strong>Nama:</strong> ${data.nama_pemain}</li>
                <li class="list-group-item"><strong>Tgl Lahir:</strong> ${data.tanggal_lahir} (Usia: ${calculateAge(data.tanggal_lahir)} th)</li>
                <li class="list-group-item"><strong>Posisi:</strong> ${data.posisi}</li>
                <li class="list-group-item"><strong>No. Punggung:</strong> ${data.no_punggung}</li>
                <li class="list-group-item"><strong>Klub:</strong> ${data.nama_klub_admin || currentUser.nama_klub}</li>
                <li class="list-group-item"><strong>Waktu Data:</strong> ${new Date(data.time_stamp).toLocaleString()}</li>
            </ul>
        </div>
    `;

    let customFooter = '';
    if (isEditAllowed) {
        customFooter = `
            <button type="button" class="btn btn-primary" onclick="openPemainForm('${data.id_pemain}', ${JSON.stringify(data).replace(/"/g, '&quot;')})" data-bs-dismiss="modal">Edit</button>
            <button type="button" class="btn btn-danger" onclick="confirmDeletePemain('${data.id_pemain}', '${data.nama_pemain}')" data-bs-dismiss="modal">Hapus</button>
        `;
    } else if (currentUser.type_users.startsWith('ADMIN_KLUB')) {
        customFooter = `<div class="text-danger">Batas waktu edit/hapus (1o hari) telah berakhir.</div>`;
    } else {
        customFooter = `<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Tutup</button>`;
    }

    showModalForm('Detail Pemain', formHtml, (e) => e.preventDefault(), customFooter);
}
function confirmDeletePemain(id_pemain, nama_pemain) {
    showConfirmationModal(`Apakah Anda yakin ingin menghapus data pemain ${nama_pemain}?`, async () => {
        const data = { action: 'DELETE', id_pemain: id_pemain };
        const result = await callAppsScript('CRUD_PEMAIN', { data: JSON.stringify(data) });
        if (result && result.success) {
            showToast(result.message);
            loadPemainList();
        } else if (result) {
            showToast(result.message, false);
        }
    });
}
function filterPemainList() {
    const searchText = document.getElementById('search-pemain').value.toLowerCase();
    document.querySelectorAll('#pemain-list > div').forEach(card => {
        const nama = card.dataset.nama;
        card.style.display = nama.includes(searchText) ? 'flex' : 'none';
    });
}

// --- NAVIGASI OFFICIAL ---
async function renderOfficial() {
    contentDiv.innerHTML = `
        <h2><i class="fas fa-chalkboard-teacher me-2"></i>Data Official</h2>
        <div class="input-group mb-3">
            <input type="text" class="form-control" placeholder="Cari Official..." id="search-official" onkeyup="filterOfficialList()">
            <button class="btn btn-primary" type="button" onclick="filterOfficialList()"><i class="fas fa-search"></i></button>
        </div>
        ${(currentUser.type_users.startsWith('ADMIN_KLUB') || currentUser.type_users === 'ADMIN_PUSAT') ?
            `<button class="btn btn-success mb-3" onclick="openOfficialForm('NEW')"><i class="fas fa-plus me-1"></i> Tambah Official</button>` : ''}
        <div id="official-list" class="row g-3">
            <p class="text-center"><i class="fas fa-spinner fa-spin me-2"></i>Memuat data official...</p>
        </div>
    `;
    loadOfficialList();
}

async function loadOfficialList() {
    const result = await callAppsScript('GET_OFFICIAL');
    const listDiv = document.getElementById('official-list');
    listDiv.innerHTML = '';
    
    let officialToDisplay = [];
    if (result && result.success) {
        officialToDisplay = result.data;
    }

    if (officialToDisplay.length === 0) {
        listDiv.innerHTML = `<div class="col-12"><div class="alert alert-info text-center">Tidak ada data official terdaftar.</div></div>`;
        return;
    }

    // Menggunakan Kartu (Cards) untuk tampilan official (cocok untuk mobile)
    officialToDisplay.forEach(official => {
        listDiv.innerHTML += `
            <div class="col-12 col-sm-6 col-md-4 col-lg-3 d-flex" data-nama="${official.nama_official.toLowerCase()}">
                <div class="card w-100 shadow-sm clickable" onclick="showOfficialDetail('${official.id_official}', ${JSON.stringify(official).replace(/"/g, '&quot;')})">
                    <img src="${official.pas_photo_official || 'https://via.placeholder.com/150x200?text=Foto'}" class="card-img-top" style="height: 200px; object-fit: cover;">
                    <div class="card-body p-2">
                        <h6 class="card-title mb-0 text-truncate">${official.nama_official}</h6>
                        <small class="text-muted d-block">${official.jabatan}</small>
                        <small class="text-muted d-block">Usia: ${calculateAge(official.tanggal_lahir)} th</small>
                    </div>
                </div>
            </div>
        `;
    });
}
function openOfficialForm(id_official, data = {}) {
    const isNew = id_official === 'NEW';
    const jabatanOptions = ["Pelatih Kepala", "Asisten Pelatih", "Manajer Tim", "Dokter Tim", "Fisioterapis", "Kitman"];
    // Perubahan 2: Menggunakan pas_photo_official
    const formHtml = `
        <input type="hidden" name="action" value="${isNew ? 'CREATE' : 'UPDATE'}">
        <input type="hidden" name="id_official" value="${data.id_official || ''}">
        <div class="col-12 text-center">
            <img id="photo-preview" src="${data.pas_photo_official || 'https://via.placeholder.com/150x200?text=Foto'}" class="rounded shadow mb-2" style="width: 150px; height: 200px; object-fit: cover;">
            <input type="file" class="form-control" id="pas_photo_official_file" accept="image/*" onchange="previewImage(event, 'photo-preview')" ${isNew ?
                '' : ''}>
            <input type="hidden" name="pas_photo_official" value="${data.pas_photo_official || ''}">
        </div>
        ${isNew ?
            ` <div class="col-md-6"> <label for="id_official" class="form-label">ID Official (16 Angka Unik)</label> <input type="number" class="form-control" id="id_official_input" name="id_official_input" value="" required minlength="16" maxlength="16"> </div>` : ''}
        <div class="col-md-6">
            <label for="nama_official" class="form-label">Nama Official</label>
            <input type="text" class="form-control" id="nama_official" name="nama_official" value="${data.nama_official || ''}" required>
        </div>
        <div class="col-md-6">
            <label for="tanggal_lahir" class="form-label">Tanggal Lahir (yyyy-mm-dd)</label>
            <input type="date" class="form-control" id="tanggal_lahir" name="tanggal_lahir" value="${data.tanggal_lahir ? new Date(data.tanggal_lahir).toISOString().split('T')[0] : ''}" required>
        </div>
        <div class="col-md-6">
            <label for="jabatan" class="form-label">Jabatan</label>
            <select class="form-select" id="jabatan" name="jabatan" required>
                ${jabatanOptions.map(p => `<option value="${p}" ${data.jabatan === p ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
        </div>
    `;
    showModalForm(`${isNew ? 'Tambah' : 'Edit'} Official`, formHtml, handleOfficialFormSubmit);
}
async function handleOfficialFormSubmit(e) {
    await handleGenericFormSubmit(e, 'CRUD_OFFICIAL', ['pas_photo_official_file'], loadOfficialList);
}
function showOfficialDetail(id_official, data) {
    const isEditAllowed = isEditable(data.time_stamp, currentUser.type_users);
    const formHtml = `
        <div class="col-12 text-center mb-3">
            <img src="${data.pas_photo_official || 'https://via.placeholder.com/150x200?text=Foto'}" class="rounded shadow mb-2" style="width: 150px; height: 200px; object-fit: cover;">
        </div>
        <div class="col-12">
            <ul class="list-group list-group-flush">
                <li class="list-group-item"><strong>ID Official:</strong> ${data.id_official}</li>
                <li class="list-group-item"><strong>Nama:</strong> ${data.nama_official}</li>
                <li class="list-group-item"><strong>Tgl Lahir:</strong> ${data.tanggal_lahir} (Usia: ${calculateAge(data.tanggal_lahir)} th)</li>
                <li class="list-group-item"><strong>Jabatan:</strong> ${data.jabatan}</li>
                <li class="list-group-item"><strong>Klub:</strong> ${data.nama_klub_admin || currentUser.nama_klub}</li>
                <li class="list-group-item"><strong>Waktu Data:</strong> ${new Date(data.time_stamp).toLocaleString()}</li>
            </ul>
        </div>
    `;

    let customFooter = '';
    if (isEditAllowed) {
        customFooter = `
            <button type="button" class="btn btn-primary" onclick="openOfficialForm('${data.id_official}', ${JSON.stringify(data).replace(/"/g, '&quot;')})" data-bs-dismiss="modal">Edit</button>
            <button type="button" class="btn btn-danger" onclick="confirmDeleteOfficial('${data.id_official}', '${data.nama_official}')" data-bs-dismiss="modal">Hapus</button>
        `;
    } else if (currentUser.type_users.startsWith('ADMIN_KLUB')) {
        customFooter = `<div class="text-danger">Batas waktu edit/hapus (1o hari) telah berakhir.</div>`;
    } else {
        customFooter = `<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Tutup</button>`;
    }
    showModalForm('Detail Official', formHtml, (e) => e.preventDefault(), customFooter);
}
function confirmDeleteOfficial(id_official, nama_official) {
    showConfirmationModal(`Apakah Anda yakin ingin menghapus data official ${nama_official}?`, async () => {
        const data = { action: 'DELETE', id_official: id_official };
        const result = await callAppsScript('CRUD_OFFICIAL', { data: JSON.stringify(data) });
        if (result && result.success) {
            showToast(result.message);
            loadOfficialList();
        } else if (result) {
            showToast(result.message, false);
        }
    });
}
function filterOfficialList() {
    const searchText = document.getElementById('search-official').value.toLowerCase();
    document.querySelectorAll('#official-list > div').forEach(card => {
        const nama = card.dataset.nama;
        card.style.display = nama.includes(searchText) ? 'flex' : 'none';
    });
}

// --- NAVIGASI KOMPETISI ---
function getPemainDetail(id_pemain) {
    return globalValidPemain.find(p => p.id_pemain === id_pemain);
}
function getOfficialDetail(id_official) {
    return globalValidOfficial.find(o => o.id_official === id_official);
}
async function renderKompetisi() {
    contentDiv.innerHTML = `
        <h2><i class="fas fa-trophy me-2"></i>Daftar Kompetisi</h2>
        ${currentUser.type_users === 'ADMIN_PUSAT' ?
            `<button class="btn btn-primary mb-3" onclick="openKompetisiForm('NEW')"><i class="fas fa-plus me-1"></i> Buat Kompetisi</button>` : ''}
        <div id="kompetisi-list" class="row g-3">
            <p class="text-center"><i class="fas fa-spinner fa-spin me-2"></i>Memuat daftar kompetisi...</p>
        </div>
    `;
    loadKompetisiList();
}
async function loadKompetisiList() {
    const result = await callAppsScript('GET_LIST_KOMPETISI');
    const listDiv = document.getElementById('kompetisi-list');
    listDiv.innerHTML = '';
    
    if (!result || !result.success || result.data.length === 0) {
        listDiv.innerHTML = `<div class="col-12"><div class="alert alert-info text-center">Tidak ada kompetisi yang terdaftar.</div></div>`;
        return;
    }
    
    result.data.forEach(kompetisi => {
        const startDate = new Date(kompetisi.tanggal_awal_pendaftaran);
        const endDate = new Date(kompetisi.tanggal_akhir_pendaftaran);
        const now = new Date();
        const isRegistrationOpen = now >= startDate && now <= endDate;
        const registrationStatus = now < startDate ? 'Belum Dibuka' : now > endDate ? 'Ditutup' : 'Dibuka';
        const statusClass = now < startDate ? 'warning' : now > endDate ? 'danger' : 'success';
        
        // Tombol Aksi
        let actionButton = '';
        if (currentUser.type_users === 'ADMIN_PUSAT') {
             actionButton = `<button class="btn btn-sm btn-outline-primary" onclick="openKompetisiForm('${kompetisi.id_kompetisi}', ${JSON.stringify(kompetisi).replace(/"/g, '&quot;')})">Edit & Hapus</button>`;
        } else if (currentUser.type_users.startsWith('ADMIN_KLUB')) {
            if (isRegistrationOpen) {
                 actionButton = `<button class="btn btn-sm btn-success" onclick="renderPrakompetisi('${kompetisi.id_kompetisi}', '${kompetisi.nama_kompetisi}', ${JSON.stringify(kompetisi).replace(/"/g, '&quot;')})">Daftar Tim</button>`;
            } else {
                 actionButton = `<button class="btn btn-sm btn-secondary" disabled>Pendaftaran ${registrationStatus}</button>`;
            }
        }
        
        listDiv.innerHTML += `
            <div class="col-12">
                <div class="card shadow-sm">
                    <div class="card-body">
                        <div class="d-flex align-items-center">
                            <img src="${kompetisi.url_logo_liga || 'https://via.placeholder.com/60'}" class="rounded me-3" style="width: 60px; height: 60px; object-fit: cover;">
                            <div>
                                <h5 class="card-title mb-1">${kompetisi.nama_kompetisi}</h5>
                                <p class="card-text text-muted mb-1">${kompetisi.deskripsi || 'Tidak ada deskripsi.'}</p>
                                <span class="badge bg-${statusClass} me-2">Pendaftaran: ${registrationStatus}</span>
                                <small class="text-muted">(${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()})</small>
                            </div>
                            <div class="ms-auto">
                                ${actionButton}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
}
function openKompetisiForm(id_kompetisi, data = {}) {
    const isNew = id_kompetisi === 'NEW';
    const formHtml = `
        <input type="hidden" name="action" value="${isNew ? 'CREATE' : 'UPDATE'}">
        <input type="hidden" name="id_kompetisi" value="${data.id_kompetisi || ''}">
        
        <div class="col-12">
            <label for="nama_kompetisi" class="form-label">Nama Kompetisi</label>
            <input type="text" class="form-control" id="nama_kompetisi" name="nama_kompetisi" value="${data.nama_kompetisi || ''}" required>
        </div>
        <div class="col-md-6">
            <label for="url_logo_liga" class="form-label">Logo Liga/Kompetisi (File)</label>
            <input type="hidden" id="url_logo_liga" name="url_logo_liga" value="${data.url_logo_liga || ''}" placeholder="URL Gambar Logo">
            <input type="file" class="form-control mt-2" id="url_logo_liga_file" accept="image/*" onchange="previewImage(event, 'logo-liga-preview')">
            <img id="logo-liga-preview" src="${data.url_logo_liga || 'https://via.placeholder.com/60'}" class="mt-2 rounded" style="width: 60px; height: 60px; object-fit: cover;">
        </div>
        <div class="col-md-6">
            <label for="tanggal_awal_pendaftaran" class="form-label">Awal Pendaftaran</label>
            <input type="date" class="form-control" id="tanggal_awal_pendaftaran" name="tanggal_awal_pendaftaran" value="${data.tanggal_awal_pendaftaran ? new Date(data.tanggal_awal_pendaftaran).toISOString().split('T')[0] : ''}" required>
        </div>
        <div class="col-md-6">
            <label for="tanggal_akhir_pendaftaran" class="form-label">Akhir Pendaftaran</label>
            <input type="date" class="form-control" id="tanggal_akhir_pendaftaran" name="tanggal_akhir_pendaftaran" value="${data.tanggal_akhir_pendaftaran ?
                new Date(data.tanggal_akhir_pendaftaran).toISOString().split('T')[0] : ''}" required>
        </div>
        <div class="col-12">
            <label for="deskripsi" class="form-label">Deskripsi</label>
            <textarea class="form-control" id="deskripsi" name="deskripsi" rows="2">${data.deskripsi || ''}</textarea>
        </div>
    `;
    const modalFooter = isNew ? '' : `
        <button type="button" class="btn btn-danger me-auto" onclick="confirmDeleteKompetisi('${data.id_kompetisi}', '${data.nama_kompetisi}')" data-bs-dismiss="modal">Hapus</button>
    `;
    showModalForm(`${isNew ? 'Buat' : 'Edit'} Kompetisi`, formHtml, handleKompetisiFormSubmit, modalFooter);
}
async function handleKompetisiFormSubmit(e) {
    // Tambahkan 'url_logo_liga_file' ke fileFields
    await handleGenericFormSubmit(e, 'CRUD_LIST_KOMPETISI', ['url_logo_liga_file'], loadKompetisiList);
}
function confirmDeleteKompetisi(id_kompetisi, nama_kompetisi) {
    showConfirmationModal(`Apakah Anda yakin ingin menghapus kompetisi ${nama_kompetisi} beserta semua data pendaftarannya?`, async () => {
        const data = { action: 'DELETE', id_kompetisi: id_kompetisi };
        const result = await callAppsScript('CRUD_LIST_KOMPETISI', { data: JSON.stringify(data) });
        if (result && result.success) {
            showToast(result.message);
            loadKompetisiList();
        } else if (result) {
            showToast(result.message, false);
        }
    });
}

// --- PRA-KOMPETISI (PENDAFTARAN KLUB) ---
async function renderPrakompetisi(id_kompetisi, nama_kompetisi, dataKompetisi) {
    contentDiv.innerHTML = `
        <h2><i class="fas fa-file-signature me-2"></i>Pendaftaran ${nama_kompetisi}</h2>
        <p class="text-muted">Isi data pemain dan official yang akan didaftarkan ke kompetisi ini. Pemain/Official harus memenuhi batasan usia kompetisi.</p>
        <input type="hidden" id="idKlub" value="${currentUser.id_klub}">
        <input type="hidden" id="idKompetisi" value="${id_kompetisi}">
        
        <div class="card shadow-sm mb-4">
            <div class="card-header bg-primary text-white">
                <i class="fas fa-users me-2"></i> Daftar Pemain (Maksimal 25)
            </div>
            <div class="card-body">
                <div class="table-responsive">
                    <table class="table table-striped align-middle">
                        <thead>
                            <tr>
                                <th style="width: 50px;">No.</th>
                                <th>Nama Pemain (ID Pemain)</th>
                                <th style="width: 150px;">Posisi</th>
                                <th style="width: 100px;">No. Punggung</th>
                                <th style="width: 50px;">Aksi</th>
                            </tr>
                        </thead>
                        <tbody id="pemain-prakompetisi-body">
                            </tbody>
                    </table>
                </div>
                <button type="button" class="btn btn-sm btn-info" onclick="addRowPemainPrakompetisi(document.getElementById('idKompetisi').value)">
                    <i class="fas fa-plus"></i> Tambah Baris Pemain
                </button>
                <div class="mt-3 text-end">
                    <span class="text-muted me-3">Total Pemain: <span id="pemain-count">0</span></span>
                    <button class="btn btn-success" onclick="savePemainPrakompetisi('${id_kompetisi}')"><i class="fas fa-save"></i> Simpan Daftar Pemain</button>
                </div>
            </div>
        </div>
        
        <div class="card shadow-sm mb-4">
            <div class="card-header bg-success text-white">
                <i class="fas fa-chalkboard-teacher me-2"></i> Daftar Official (Maksimal 10)
            </div>
            <div class="card-body">
                <div class="table-responsive">
                    <table class="table table-striped align-middle">
                        <thead>
                            <tr>
                                <th style="width: 50px;">No.</th>
                                <th>Nama Official (ID Official)</th>
                                <th style="width: 150px;">Jabatan</th>
                                <th style="width: 50px;">Aksi</th>
                            </tr>
                        </thead>
                        <tbody id="official-prakompetisi-body">
                            </tbody>
                    </table>
                </div>
                <button type="button" class="btn btn-sm btn-info" onclick="addRowOfficialPrakompetisi(document.getElementById('idKompetisi').value)">
                    <i class="fas fa-plus"></i> Tambah Baris Official
                </button>
                <div class="mt-3 text-end">
                    <span class="text-muted me-3">Total Official: <span id="official-count">0</span></span>
                    <button class="btn btn-success" onclick="saveOfficialPrakompetisi('${id_kompetisi}')"><i class="fas fa-save"></i> Simpan Daftar Official</button>
                </div>
            </div>
        </div>
        <button class="btn btn-secondary w-100 mt-3" onclick="changePage('kompetisi')">Kembali ke Daftar Kompetisi</button>
    `;
    await Promise.all([
        loadPemainPrakompetisi(id_kompetisi),
        loadOfficialPrakompetisi(id_kompetisi)
    ]);
}
// Subform Players Logic
async function loadPemainPrakompetisi(id_kompetisi) {
    const [allValidResult, registeredResult] = await Promise.all([
        callAppsScript('GET_FILTERED_PEMAIN', { id_kompetisi }),
        callAppsScript('GET_REGISTERED_PEMAIN', { id_kompetisi })
    ]);
    const tbody = document.getElementById('pemain-prakompetisi-body');
    const countSpan = document.getElementById('pemain-count');
    tbody.innerHTML = '';
    globalValidPemain = allValidResult.success ?
        allValidResult.data.filter(p => p.id_klub === currentUser.id_klub) : [];
    const registeredPemain = registeredResult.data || [];
    
    if (globalValidPemain.length === 0 && registeredPemain.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Tidak ada Pemain yang memenuhi batasan usia di klub Anda.</td></tr>`;
        countSpan.textContent = '0';
        return;
    }
    // Render data yang sudah terdaftar
    registeredPemain.forEach((reg, index) => {
        addRowPemainPrakompetisi(id_kompetisi, reg);
    });
    // Tambahkan baris kosong untuk entri baru (jika tidak ada data terdaftar)
    if (tbody.querySelectorAll('tr').length === 0 && globalValidPemain.length > 0) {
        addRowPemainPrakompetisi(id_kompetisi);
    }
    // Update count
    const currentRowCount = tbody.querySelectorAll('tr').length;
    countSpan.textContent = currentRowCount;
}
function addRowPemainPrakompetisi(id_kompetisi, data = {}) {
    const tbody = document.getElementById('pemain-prakompetisi-body');
    const countSpan = document.getElementById('pemain-count');
    const selectOptions = globalValidPemain.map(p => {
        // Gabungkan data posisi dan no_punggung ke dataset
        return `<option value="${p.id_pemain}" data-nama="${p.nama_pemain}" data-posisi="${p.posisi}" data-nopunggung="${p.no_punggung}" ${data.id_pemain === p.id_pemain ? 'selected' : ''}>${p.nama_pemain} (${p.id_pemain})</option>`;
    }).join('');
    
    const newRow = tbody.insertRow();
    newRow.innerHTML = `
        <td class="row-number"></td>
        <td>
            <select class="form-select form-select-sm pemain-select" onchange="updatePemainInfo(this)" required>
                <option value="">Pilih Pemain</option>
                ${selectOptions}
            </select>
            <input type="hidden" class="pemain-id" name="id_pemain" value="${data.id_pemain || ''}">
            <input type="hidden" class="pemain-nama" name="nama_pemain" value="${data.nama_pemain || ''}">
        </td>
        <td>
            <input type="text" class="form-control form-control-sm pemain-posisi" value="${data.posisi || ''}" readonly>
        </td>
        <td>
            <input type="number" class="form-control form-control-sm pemain-nopunggung" value="${data.no_punggung || ''}">
        </td>
        <td><button type="button" class="btn btn-danger btn-sm" onclick="removeRow(this, 'pemain-count')"><i class="fas fa-trash"></i></button></td>
    `;
    updateRowNumbers(tbody);
    countSpan.textContent = tbody.querySelectorAll('tr').length;
    
    // Jika data sudah ada, panggil updatePemainInfo untuk mengisi kolom lain
    if (data.id_pemain) {
        const select = newRow.querySelector('.pemain-select');
        updatePemainInfo(select);
    }
}
function updatePemainInfo(selectElement) {
    const selectedOption = selectElement.options[selectElement.selectedIndex];
    const row = selectElement.closest('tr');
    const id = selectedOption.value;
    const nama = selectedOption.dataset.nama || '';
    const posisi = selectedOption.dataset.posisi || '';
    const noPunggung = selectedOption.dataset.nopunggung || '';
    
    row.querySelector('.pemain-id').value = id;
    row.querySelector('.pemain-nama').value = nama;
    row.querySelector('.pemain-posisi').value = posisi;
    row.querySelector('.pemain-nopunggung').value = noPunggung;
}
async function savePemainPrakompetisi(id_kompetisi) {
    const tbody = document.getElementById('pemain-prakompetisi-body');
    const rows = tbody.querySelectorAll('tr');
    const idKlub = document.getElementById('idKlub').value;
    const entries = [];
    let isValid = true;
    let selectedIds = new Set();
    
    rows.forEach(row => {
        // Ambil nilai dari input hidden (yang diisi oleh updatePemainInfo)
        const id = row.querySelector('.pemain-id').value;
        const nama = row.querySelector('.pemain-nama').value;
        const posisi = row.querySelector('.pemain-posisi').value;
        const no_punggung = row.querySelector('.pemain-nopunggung').value;
        
        // Hanya proses baris yang memiliki ID dan Nama (telah dipilih dari select box)
        if (id && nama) {
            if (selectedIds.has(id)) {
                showToast(`Duplikasi Pemain ID: ${id}. Harap hapus duplikasi.`, false);
                isValid = false;
                return;
            }
            entries.push({ 
                id_kompetisi, 
                id_klub: idKlub, 
                id_pemain: id, 
                nama_pemain: nama, 
                posisi, 
                no_punggung // Data No. Punggung ikut terkirim
            });
            selectedIds.add(id);
        }
    });
    
    if (!isValid) return;
    if (entries.length > 25) {
        showToast("Maksimal 25 Pemain!", false);
        return;
    }
    if (entries.length === 0 && rows.length > 0) {
        showToast("Pilih minimal 1 pemain untuk disimpan, atau hapus semua baris untuk mengosongkan daftar.", false);
        return;
    }
    
    // Panggil Apps Script
    const result = await callAppsScript('SAVE_PEMAIN_PRAKOMPETISI', { id_kompetisi, entries: JSON.stringify(entries) });
    if (result.success) {
        showToast(result.message);
        loadPemainPrakompetisi(id_kompetisi); // Reload data
    } else {
        showToast(result.message, false);
    }
}

// Subform Official Logic
async function loadOfficialPrakompetisi(id_kompetisi) {
    const [allValidResult, registeredResult] = await Promise.all([
        callAppsScript('GET_FILTERED_OFFICIAL', { id_kompetisi }),
        callAppsScript('GET_REGISTERED_OFFICIAL', { id_kompetisi })
    ]);
    const tbody = document.getElementById('official-prakompetisi-body');
    const countSpan = document.getElementById('official-count');
    tbody.innerHTML = '';
    globalValidOfficial = allValidResult.success ?
        allValidResult.data.filter(o => o.id_klub === currentUser.id_klub) : [];
    const registeredOfficial = registeredResult.data || [];

    if (globalValidOfficial.length === 0 && registeredOfficial.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Tidak ada Official yang memenuhi batasan usia di klub Anda.</td></tr>`;
        countSpan.textContent = '0';
        return;
    }
    
    // Render data yang sudah terdaftar
    registeredOfficial.forEach(reg => {
        addRowOfficialPrakompetisi(id_kompetisi, reg);
    });
    // Tambahkan baris kosong untuk entri baru (jika tidak ada data terdaftar)
    if (tbody.querySelectorAll('tr').length === 0 && globalValidOfficial.length > 0) {
        addRowOfficialPrakompetisi(id_kompetisi);
    }
    // Update count
    const currentRowCount = tbody.querySelectorAll('tr').length;
    countSpan.textContent = currentRowCount;
}
function addRowOfficialPrakompetisi(id_kompetisi, data = {}) {
    const tbody = document.getElementById('official-prakompetisi-body');
    const countSpan = document.getElementById('official-count');
    const selectOptions = globalValidOfficial.map(o => {
        // Gabungkan data jabatan ke dataset
        return `<option value="${o.id_official}" data-nama="${o.nama_official}" data-jabatan="${o.jabatan}" ${data.id_official === o.id_official ? 'selected' : ''}>${o.nama_official} (${o.id_official})</option>`;
    }).join('');
    
    const newRow = tbody.insertRow();
    newRow.innerHTML = `
        <td class="row-number"></td>
        <td>
            <select class="form-select form-select-sm official-select" onchange="updateOfficialInfo(this)" required>
                <option value="">Pilih Official</option>
                ${selectOptions}
            </select>
            <input type="hidden" class="official-id" name="id_official" value="${data.id_official || ''}">
            <input type="hidden" class="official-nama" name="nama_official" value="${data.nama_official || ''}">
        </td>
        <td>
            <input type="text" class="form-control form-control-sm official-jabatan" value="${data.jabatan || ''}" readonly>
        </td>
        <td><button type="button" class="btn btn-danger btn-sm" onclick="removeRow(this, 'official-count')"><i class="fas fa-trash"></i></button></td>
    `;
    updateRowNumbers(tbody);
    countSpan.textContent = tbody.querySelectorAll('tr').length;
    if(data.id_official) {
        const select = newRow.querySelector('.official-select');
        updateOfficialInfo(select);
    }
}
function updateOfficialInfo(selectElement) {
    const selectedOption = selectElement.options[selectElement.selectedIndex];
    const row = selectElement.closest('tr');
    const id = selectedOption.value;
    const nama = selectedOption.dataset.nama || '';
    const jabatan = selectedOption.dataset.jabatan || '';
    
    // Menggunakan kelas official-id untuk input hidden
    row.querySelector('.official-id').value = id;
    row.querySelector('.official-nama').value = nama;
    row.querySelector('.official-jabatan').value = jabatan;
}
async function saveOfficialPrakompetisi(id_kompetisi) {
    const tbody = document.getElementById('official-prakompetisi-body');
    const rows = tbody.querySelectorAll('tr');
    const idKlub = document.getElementById('idKlub').value;
    const entries = [];
    let isValid = true;
    let selectedIds = new Set();
    
    rows.forEach(row => {
        const id = row.querySelector('.official-id').value;
        const nama = row.querySelector('.official-nama').value;
        const jabatan = row.querySelector('.official-jabatan').value;
        
        if (id && nama) {
            if (selectedIds.has(id)) {
                showToast(`Duplikasi Official ID: ${id}. Harap hapus duplikasi.`, false);
                isValid = false;
                return;
            }
            entries.push({ id_kompetisi, id_klub: idKlub, id_official: id, nama_official: nama, jabatan });
            selectedIds.add(id);
        }
    });
    
    if (!isValid) return;
    if (entries.length > 10) {
        showToast("Maksimal 10 Official!", false);
        return;
    }
    if (entries.length === 0 && rows.length > 0) {
        showToast("Pilih minimal 1 official untuk disimpan, atau hapus semua baris untuk mengosongkan daftar.", false);
        return;
    }
    
    const result = await callAppsScript('SAVE_OFFICIAL_PRAKOMPETISI', { id_kompetisi, entries: JSON.stringify(entries) });
    if (result.success) {
        showToast(result.message);
        loadOfficialPrakompetisi(id_kompetisi);
    } else {
        showToast(result.message, false);
    }
}

function updateRowNumbers(tbody) {
    tbody.querySelectorAll('tr').forEach((row, index) => {
        const cell = row.querySelector('.row-number');
        if (cell) cell.textContent = index + 1;
    });
}
function removeRow(buttonElement, countElementId) {
    const row = buttonElement.closest('tr');
    const tbody = row.closest('tbody');
    row.remove();
    updateRowNumbers(tbody);
    document.getElementById(countElementId).textContent = tbody.querySelectorAll('tr').length;
}


// --- SETTING PAGE ---
async function renderSetting() {
    currentPage = 'setting';
    contentDiv.innerHTML = `
        <h2><i class="fas fa-cog me-2"></i>Pengaturan Sistem</h2>
        <div class="row g-4 mt-3">
            <div class="col-lg-6">
                <div class="card shadow-sm">
                    <div class="card-header bg-primary text-white">Pengaturan Banner (Slide)</div>
                    <div class="card-body" id="setting-banner-content">
                        <p class="text-center"><i class="fas fa-spinner fa-spin me-2"></i>Memuat data banner...</p>
                    </div>
                </div>
            </div>
            <div class="col-lg-6">
                <div class="card shadow-sm">
                    <div class="card-header bg-info text-white">Pengaturan Pengguna (Userlist)</div>
                    <div class="card-body" id="setting-userlist-content">
                         <p class="text-center"><i class="fas fa-spinner fa-spin me-2"></i>Memuat data pengguna...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    loadBannerSetting(); 
    loadUserlistSetting(); // Panggil fungsi yang sudah dimodifikasi
}
async function loadBannerSetting() {
    const result = await callAppsScript('GET_BANNERS');
    const content = document.getElementById('setting-banner-content');
    const data = result && result.success ? result.data : {};
    
    content.innerHTML = `
        <form id="banner-form" class="row g-3">
            ${[1, 2, 3].map(i => `
                <div class="col-12 col-md-4">
                    <label class="form-label">Banner ${i} URL</label>
                    <input type="url" class="form-control form-control-sm" name="url_banner${i}" value="${data[`url_banner${i}`] || ''}" placeholder="URL Gambar ${i}">
                    <img src="${data[`url_banner${i}`] || 'https://via.placeholder.com/100x50?text=Banner'}" class="mt-2 rounded w-100" style="height: 50px; object-fit: cover;">
                </div>
            `).join('')}
            <div class="col-12 mt-4">
                <button type="submit" class="btn btn-primary w-100"><i class="fas fa-save me-2"></i> Simpan Banner</button>
            </div>
        </form>
    `;

    document.getElementById('banner-form').addEventListener('submit', (e) => {
        handleGenericFormSubmit(e, 'CRUD_BANNER', [], loadBannerSetting);
    });
}


// *********** FUNGSI BARU (Renderer untuk loadUserlistSetting) ***********
function userlistActionRenderer(data) {
    return `
        <button class="btn btn-sm btn-primary me-2" onclick="openUserlistForm('${data.username}', ${JSON.stringify(data).replace(/"/g, '&quot;')})" title="Edit">
            <i class="fas fa-edit"></i> Edit
        </button>
        <button class="btn btn-sm btn-danger" onclick="confirmDeleteUserlist('${data.username}')" title="Hapus">
            <i class="fas fa-trash-alt"></i> Hapus
        </button>
    `;
}

// *********** GANTI FUNGSI loadUserlistSetting ***********
async function loadUserlistSetting() {
    // 1. Tentukan Struktur Kolom
    const columns = [
        { key: 'username', label: 'Username', mobile: true }, 
        { key: 'nama', label: 'Nama Lengkap', mobile: true }, 
        { key: 'type_users', label: 'Tipe Pengguna', mobile: true }, 
        { key: 'id_klub', label: 'ID Klub', mobile: false } // Sembunyi di mobile
    ];

    showLoading();
    const result = await callAppsScript('GET_USERLIST');
    hideLoading();

    let html = `
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h5 class="card-title mb-0">Daftar Pengguna Sistem</h5>
            <button class="btn btn-success btn-sm" onclick="openUserlistForm('NEW')">
                <i class="fas fa-plus"></i> Tambah Pengguna
            </button>
        </div>
    `;
    
    const userlistDiv = document.getElementById('setting-userlist-content');
    
    if (result && result.success) {
        const users = result.data;
        
        // 2. Gunakan renderResponsiveTable
        const dataHtml = renderResponsiveTable(
            users, 
            columns, 
            userlistActionRenderer, 
            'username' // Judul Card Seluler
        );

        html += `<div class="mt-3">${dataHtml}</div>`;
    } else {
        html += `<div class="alert alert-danger mt-3">${result ? result.message : 'Gagal memuat data pengguna.'}</div>`;
    }

    if (userlistDiv) userlistDiv.innerHTML = html;
}

function openUserlistForm(username, data = {}) {
    const isNew = username === 'NEW';
    const typeOptions = ["ADMIN_PUSAT", "ADMIN_KOMPETISI", "ADMIN_KLUB"];
    
    const formHtml = `
        <input type="hidden" name="action" value="${isNew ? 'CREATE' : 'UPDATE'}">
        <input type="hidden" name="old_username" value="${data.username || ''}">

        <div class="col-md-6">
            <label for="username" class="form-label">Username</label>
            <input type="text" class="form-control" id="username" name="username" value="${data.username || ''}" required ${!isNew ? 'readonly' : ''}>
        </div>
        <div class="col-md-6">
            <label for="nama" class="form-label">Nama Lengkap</label>
            <input type="text" class="form-control" id="nama" name="nama" value="${data.nama || ''}" required>
        </div>
        <div class="col-12">
            <label for="password" class="form-label">Password ${!isNew ? '(Isi untuk mengganti)' : ''}</label>
            <input type="password" class="form-control" id="password" name="password" ${isNew ? 'required' : ''}>
            ${!isNew ? `<small class="text-muted">Kosongkan jika tidak ingin mengganti password.</small>` : ''}
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
    `;

    showModalForm(`${isNew ? 'Tambah' : 'Edit'} Pengguna`, formHtml, handleUserlistFormSubmit);
}

async function handleUserlistFormSubmit(e) {
    await handleGenericFormSubmit(e, 'CRUD_USERLIST', [], loadUserlistSetting);
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

// --- INIT APP ---
document.addEventListener('DOMContentLoaded', renderApp);
