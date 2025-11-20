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

function showConfirmationModal(message, onConfirm) {
    const modalHtml = `
        <div class="modal fade" id="confirmationModal" tabindex="-1" aria-labelledby="confirmationModalLabel" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="confirmationModalLabel">Konfirmasi Aksi</h5>
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

    // Hapus modal lama jika ada
    const existingModal = document.getElementById('confirmationModal');
    if (existingModal) existingModal.remove();

    // Tambahkan modal baru ke body
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modalElement = document.getElementById('confirmationModal');
    const bsModal = new bootstrap.Modal(modalElement);
    
    document.getElementById('confirmButton').onclick = () => {
        onConfirm();
        bsModal.hide();
    };

    bsModal.show();
}


async function callAppsScript(action, params = {}) {
    showLoading();
    
    const url = new URL(GAS_API_URL);
    url.searchParams.append('action', action);
    
    // Tambahkan parameter lain
    for (const key in params) {
        url.searchParams.append(key, params[key]);
    }

    // Tambahkan token pengguna jika sudah login
    if (currentUser && currentUser.token) {
        url.searchParams.append('token', currentUser.token);
    }

    try {
        const response = await fetch(url, { method: 'POST' });
        const result = await response.json();
        
        hideLoading();

        if (result && result.message) {
            showToast(result.message, result.success);
        }

        // Handle Token Expired/Invalid
        if (result && result.unauthorized) {
            showToast("Sesi Anda berakhir atau tidak valid. Silakan login kembali.", false);
            handleLogout();
            return null;
        }

        return result;

    } catch (error) {
        hideLoading();
        console.error('Error calling Apps Script:', error);
        showToast('Terjadi kesalahan koneksi atau server.', false);
        return null;
    }
}

function showModalForm(title, formBodyHtml, onSubmitFunction) {
    const modalHtml = `
        <div class="modal fade" id="dataFormModal" tabindex="-1" aria-labelledby="dataFormModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <form id="genericDataForm">
                        <div class="modal-header bg-primary text-white">
                            <h5 class="modal-title" id="dataFormModalLabel">${title}</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
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

    // Hapus modal lama jika ada
    const existingModal = document.getElementById('dataFormModal');
    if (existingModal) existingModal.remove();

    // Tambahkan modal baru ke body
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    const modalElement = document.getElementById('dataFormModal');
    const formElement = document.getElementById('genericDataForm');
    
    formElement.onsubmit = async (e) => {
        e.preventDefault();
        await onSubmitFunction(e);
        // Jika submit berhasil, modal akan ditutup di handleGenericFormSubmit
    };
    
    const bsModal = new bootstrap.Modal(modalElement);
    bsModal.show();
    
    // Simpan instance modal agar bisa ditutup secara manual setelah submit
    modalElement.bsModal = bsModal;
}

// Fungsi serbaguna untuk menangani submit form CRUD
async function handleGenericFormSubmit(e, actionType, filesToUpload = [], onCompleteCallback) {
    const form = e.target;
    const formData = new FormData(form);
    const data = {};
    
    // Kumpulkan data teks/input biasa
    formData.forEach((value, key) => {
        if (!filesToUpload.includes(key)) {
            data[key] = value;
        }
    });

    // Handle upload file
    for (const fileKey of filesToUpload) {
        const fileInput = form.querySelector(`#${fileKey}`);
        if (fileInput && fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const fileData = await getBase64(file);
            data[fileKey] = fileData;
            data[`${fileKey}_name`] = file.name;
        } else if (form.querySelector(`input[name="existing_${fileKey}"]`)) {
            // Jika ada field tersembunyi untuk file lama
            data[fileKey] = form.querySelector(`input[name="existing_${fileKey}"]`).value;
        }
    }
    
    const result = await callAppsScript(actionType, { data: JSON.stringify(data) });

    if (result && result.success) {
        // Tutup modal
        const modalElement = document.getElementById('dataFormModal');
        if (modalElement && modalElement.bsModal) {
            modalElement.bsModal.hide();
        }
        
        // Panggil callback setelah berhasil
        if (onCompleteCallback) {
            onCompleteCallback();
        }
    }
}

// Helper untuk konversi file ke base64
function getBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]); // Ambil hanya data base64 setelah koma
        reader.onerror = error => reject(error);
    });
}


// --- AUTHENTICATION ---

function checkAuth() {
    const user = localStorage.getItem('currentUser');
    if (user) {
        currentUser = JSON.parse(user);
        renderMainLayout();
        handleRoute(currentPage);
    } else {
        renderLogin();
    }
}

function renderLogin() {
    currentPage = 'login';
    document.title = 'Login - SIPAKEM';
    appContainer.innerHTML = `
        <div id="login-page">
            <div id="login-form">
                <h3 class="text-center mb-4 text-primary"><i class="fas fa-futbol me-2"></i>SIPAKEM Login</h3>
                <form id="loginForm">
                    <div class="mb-3">
                        <label for="username" class="form-label">Username</label>
                        <input type="text" class="form-control" id="username" name="username" required>
                    </div>
                    <div class="mb-3">
                        <label for="password" class="form-label">Password</label>
                        <input type="password" class="form-control" id="password" name="password" required>
                    </div>
                    <button type="submit" class="btn btn-primary w-100">Masuk</button>
                </form>
            </div>
        </div>
    `;
    
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
}

async function handleLogin(e) {
    e.preventDefault();
    const form = e.target;
    const username = form.username.value;
    const password = form.password.value;

    const result = await callAppsScript('LOGIN', { username, password });

    if (result && result.success) {
        currentUser = result.user;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        showToast('Login Berhasil!', true);
        renderMainLayout();
        handleRoute('home');
    }
}

function handleLogout() {
    localStorage.removeItem('currentUser');
    currentUser = null;
    renderLogin();
}

// --- ROUTING AND LAYOUT ---

function getSidebarMenu() {
    if (!currentUser) return '';

    const isAdmin = currentUser.type_users === 'ADMIN';
    const isTimTeknis = currentUser.type_users === 'TIM_TEKNIS';
    const isKlub = currentUser.type_users === 'ADMIN_KLUB';

    let menu = '';

    // Menu Umum untuk semua
    menu += getMenuItem('home', 'Beranda', 'fas fa-home', true);
    menu += getMenuItem('kompetisi', 'Kompetisi', 'fas fa-trophy');

    if (isKlub) {
        menu += `<li class="nav-header text-uppercase text-white-50 mt-3 small">Pendaftaran Klub</li>`;
        menu += getMenuItem('pendaftaran_pemain', 'Pemain', 'fas fa-users');
        menu += getMenuItem('pendaftaran_official', 'Official', 'fas fa-user-tie');
    }

    if (isTimTeknis || isAdmin) {
        menu += `<li class="nav-header text-uppercase text-white-50 mt-3 small">Verifikasi</li>`;
        menu += getMenuItem('verifikasi_pemain', 'Verifikasi Pemain', 'fas fa-user-check');
        menu += getMenuItem('verifikasi_official', 'Verifikasi Official', 'fas fa-user-shield');
    }

    if (isAdmin) {
        menu += `<li class="nav-header text-uppercase text-white-50 mt-3 small">Pengaturan Admin</li>`;
        menu += getMenuItem('setting_banner', 'Banner', 'fas fa-image');
        menu += getMenuItem('setting_userlist', 'Daftar Pengguna', 'fas fa-users-cog');
    }
    
    // Menu Logout
    menu += `<li class="nav-item">
                <a href="#" class="nav-link text-danger" onclick="event.preventDefault(); handleLogout();">
                    <i class="fas fa-sign-out-alt me-2"></i> Keluar
                </a>
            </li>`;

    return `<ul class="nav flex-column">${menu}</ul>`;
}

function getMenuItem(route, label, iconClass, isHome = false) {
    const isActive = currentPage === route;
    return `
        <li class="nav-item">
            <a href="#${route}" class="nav-link ${isActive ? 'active' : ''}" onclick="handleRoute('${route}', event)">
                <i class="${iconClass} me-2"></i> ${label}
            </a>
        </li>
    `;
}

function updateSidebarActiveState() {
    // Hapus active dari semua
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    
    // Tambahkan active ke yang sesuai
    document.querySelectorAll(`a[href="#${currentPage}"]`).forEach(link => {
        link.classList.add('active');
    });
}


function renderMainLayout() {
    if (!currentUser) return;
    
    // 1. Sinkronkan Menu Sidebar ke Desktop dan Mobile Offcanvas
    const menuHtml = getSidebarMenu();
    
    const desktopSidebar = document.getElementById('sidebar-menu-list-desktop');
    const mobileSidebar = document.getElementById('sidebar-menu-list-mobile');

    if (desktopSidebar) desktopSidebar.innerHTML = menuHtml;
    if (mobileSidebar) mobileSidebar.innerHTML = menuHtml;

    // 2. Render Main Navbar with Mobile Toggle
    const navbar = `
        <nav class="navbar navbar-expand-lg navbar-dark bg-dark fixed-top">
            <div class="container-fluid">
                <button class="btn btn-dark d-lg-none me-3" type="button" data-bs-toggle="offcanvas" data-bs-target="#mobileSidebar" aria-controls="mobileSidebar">
                    <i class="fas fa-bars"></i>
                </button>

                <a class="navbar-brand" href="#home" onclick="handleRoute('home', event)">
                    <i class="fas fa-futbol me-2"></i>SIPAKEM
                </a>
                
                <div class="ms-auto d-flex align-items-center">
                    <span class="navbar-user-info me-3 d-none d-md-inline">
                        <i class="fas fa-user-circle me-1"></i> ${currentUser.username} (${currentUser.type_users})
                    </span>
                    <button class="btn btn-outline-light" onclick="handleLogout()">
                        <i class="fas fa-sign-out-alt"></i> Keluar
                    </button>
                </div>
            </div>
        </nav>
    `;

    // 3. Render Main Content Area
    // Perhatikan: contentDiv ini akan diisi oleh fungsi-fungsi loadXxx
    const content = `
        <div class="content" style="padding-top: 20px;">
            <div id="content-div">
                </div>
        </div>
    `;
    
    // Hanya sisipkan navbar dan content ke dalam app-container
    appContainer.innerHTML = navbar + content;
    contentDiv = document.getElementById('content-div');
}


function handleRoute(route, event = null) {
    if (event) {
        event.preventDefault();
        // Tutup offcanvas setelah navigasi di mobile
        const mobileSidebar = document.getElementById('mobileSidebar');
        if (mobileSidebar) {
            const bsOffcanvas = bootstrap.Offcanvas.getInstance(mobileSidebar);
            if (bsOffcanvas) bsOffcanvas.hide();
        }
    }
    
    currentPage = route;
    window.location.hash = route;
    updateSidebarActiveState();

    if (!contentDiv) {
        // Ini terjadi saat pertama kali login atau refresh. Panggil renderMainLayout lagi.
        renderMainLayout();
    }
    
    switch (route) {
        case 'home':
            loadHomePage();
            break;
        case 'kompetisi':
            loadKompetisiPage();
            break;
        case 'pendaftaran_pemain':
            loadPendaftaranPemainPage();
            break;
        case 'pendaftaran_official':
            loadPendaftaranOfficialPage();
            break;
        case 'verifikasi_pemain':
            loadVerifikasiPemainPage();
            break;
        case 'verifikasi_official':
            loadVerifikasiOfficialPage();
            break;
        case 'setting_banner':
            loadBannerSetting();
            break;
        case 'setting_userlist':
            loadUserlistSetting();
            break;
        default:
            loadNotFoundPage();
    }
    
    document.title = `${currentPage.charAt(0).toUpperCase() + currentPage.slice(1)} - SIPAKEM`;
}

// --- PAGE LOADERS ---

function loadNotFoundPage() {
    contentDiv.innerHTML = `
        <div class="alert alert-danger">
            <h4>Halaman Tidak Ditemukan (404)</h4>
            <p>Halaman yang Anda cari tidak ada atau Anda tidak memiliki akses.</p>
            <a href="#home" class="btn btn-primary" onclick="handleRoute('home', event)">Kembali ke Beranda</a>
        </div>
    `;
}

// -------------------------------------------------------------------------
// HALAMAN HOME
// -------------------------------------------------------------------------

async function loadHomePage() {
    const result = await callAppsScript('GET_ACTIVE_BANNER');
    
    let bannerHtml = '';
    if (result && result.success && result.data && result.data.length > 0) {
        const banners = result.data.map((banner, index) => `
            <div class="carousel-item ${index === 0 ? 'active' : ''}">
                <img src="${banner.url}" class="d-block w-100" alt="${banner.caption}" style="max-height: 400px; object-fit: cover;">
                <div class="carousel-caption d-none d-md-block" style="background: rgba(0,0,0,0.5); padding: 10px;">
                    <h5>${banner.caption}</h5>
                </div>
            </div>
        `).join('');

        bannerHtml = `
            <div id="bannerCarousel" class="carousel slide mb-4" data-bs-ride="carousel">
                <div class="carousel-inner rounded shadow-sm">
                    ${banners}
                </div>
                <button class="carousel-control-prev" type="button" data-bs-target="#bannerCarousel" data-bs-slide="prev">
                    <span class="carousel-control-prev-icon" aria-hidden="true"></span>
                    <span class="visually-hidden">Previous</span>
                </button>
                <button class="carousel-control-next" type="button" data-bs-target="#bannerCarousel" data-bs-slide="next">
                    <span class="carousel-control-next-icon" aria-hidden="true"></span>
                    <span class="visually-hidden">Next</span>
                </button>
            </div>
        `;
    }

    contentDiv.innerHTML = `
        <div class="container">
            <h2 class="mb-4">Selamat Datang di SIPAKEM</h2>
            ${bannerHtml}
            
            <div class="card shadow-sm">
                <div class="card-body">
                    <p class="card-text">Sistem Informasi PSSI Kepulauan Mentawai (SIPAKEM) adalah platform resmi untuk manajemen data pemain, official, dan kompetisi di bawah naungan PSSI Kepulauan Mentawai.</p>
                    <p class="card-text">Silakan gunakan menu di samping untuk mengakses berbagai fitur sesuai dengan peran Anda.</p>
                    <div class="alert alert-info mt-3">
                        Anda login sebagai: <strong>${currentUser.username}</strong> (<span class="badge bg-primary">${currentUser.type_users}</span>)
                    </div>
                </div>
            </div>
        </div>
    `;
}

// -------------------------------------------------------------------------
// HALAMAN KOMPETISI
// -------------------------------------------------------------------------

async function loadKompetisiPage() {
    contentDiv.innerHTML = '<h2>Daftar Kompetisi</h2><p>Memuat data kompetisi...</p>';
    
    const result = await callAppsScript('GET_LIST_KOMPETISI');

    if (result && result.success) {
        const kompetisiList = result.data;
        let html = '<h2 class="mb-4">Daftar Kompetisi PSSI Mentawai</h2>';
        
        if (kompetisiList.length === 0) {
            html += '<div class="alert alert-warning">Belum ada kompetisi yang terdaftar.</div>';
        } else {
            html += '<div class="row">';
            kompetisiList.forEach(k => {
                const statusBadge = k.status === 'Aktif' 
                    ? '<span class="badge bg-success">Aktif</span>' 
                    : '<span class="badge bg-secondary">Selesai</span>';
                    
                html += `
                    <div class="col-md-6 col-lg-4 mb-4">
                        <div class="card h-100 shadow-sm border-primary">
                            <div class="card-body">
                                <h5 class="card-title text-primary">${k.nama_kompetisi}</h5>
                                <h6 class="card-subtitle mb-2 text-muted">ID: ${k.id_kompetisi}</h6>
                                <p class="card-text">
                                    <strong>Status:</strong> ${statusBadge}<br>
                                    <strong>Tahun:</strong> ${k.tahun}<br>
                                    <strong>Tipe:</strong> ${k.tipe_kompetisi}<br>
                                    <strong>Keterangan:</strong> ${k.keterangan || '-'}
                                </p>
                                <button class="btn btn-sm btn-outline-primary" onclick="viewKompetisiDetail('${k.id_kompetisi}')">
                                    <i class="fas fa-info-circle me-1"></i> Detail
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }
        contentDiv.innerHTML = html;
    } else {
        contentDiv.innerHTML = `<div class="alert alert-danger">Gagal memuat data kompetisi.</div>`;
    }
}

function viewKompetisiDetail(id_kompetisi) {
    // Implementasi detail kompetisi (Tergantung kebutuhan, mungkin menampilkan list klub, jadwal, dll.)
    showToast(`Melihat detail kompetisi: ${id_kompetisi}`, true);
    // Untuk saat ini, kita hanya menampilkan toast.
}

// -------------------------------------------------------------------------
// HALAMAN PENDAFTARAN PEMAIN (ADMIN_KLUB)
// -------------------------------------------------------------------------

async function loadPendaftaranPemainPage() {
    if (currentUser.type_users !== 'ADMIN_KLUB') {
        contentDiv.innerHTML = '<div class="alert alert-danger">Anda tidak memiliki akses ke halaman ini.</div>';
        return;
    }
    
    contentDiv.innerHTML = '<h2>Pendaftaran Pemain</h2><p>Memuat data...</p>';
    
    const [kompetisiResult, registeredResult, validPemainResult] = await Promise.all([
        callAppsScript('GET_LIST_KOMPETISI'),
        callAppsScript('GET_REGISTERED_PEMAIN'),
        callAppsScript('GET_FILTERED_PEMAIN', { id_kompetisi: 'semua' }) // Ambil semua pemain terdaftar
    ]);

    let kompetisiOptions = [];
    let registeredPemain = [];

    if (kompetisiResult && kompetisiResult.success) {
        kompetisiOptions = kompetisiResult.data.map(k => `<option value="${k.id_kompetisi}">${k.nama_kompetisi} (${k.tahun})</option>`).join('');
    }
    
    if (registeredResult && registeredResult.success) {
        registeredPemain = registeredResult.data;
    }

    if (validPemainResult && validPemainResult.success) {
        globalValidPemain = validPemainResult.data;
    }


    const tableRows = registeredPemain.map((p, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${p.nama}</td>
            <td>${p.nik}</td>
            <td>${p.posisi}</td>
            <td>${p.kompetisi_id}</td>
            <td>
                <span class="badge ${p.verifikasi === 'TERVERIFIKASI' ? 'bg-success' : p.verifikasi === 'DITOLAK' ? 'bg-danger' : 'bg-warning'}">
                    ${p.verifikasi}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="showPemainPrakompetisiForm('${p.id_pemain}', '${p.id_kompetisi}', false)">
                    <i class="fas fa-edit"></i> Edit
                </button>
            </td>
        </tr>
    `).join('');

    contentDiv.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h2>Pendaftaran Pemain Klub ${currentUser.id_klub}</h2>
            <button class="btn btn-success" onclick="showPemainPrakompetisiForm(null, null, true)">
                <i class="fas fa-plus"></i> Tambah Pemain
            </button>
        </div>
        
        <div class="card shadow-sm mb-4">
            <div class="card-header bg-primary text-white">Daftar Pemain Terdaftar</div>
            <div class="card-body">
                <div class="table-responsive">
                    <table class="table table-striped table-hover">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Nama</th>
                                <th>NIK</th>
                                <th>Posisi</th>
                                <th>ID Kompetisi</th>
                                <th>Status Verifikasi</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows || '<tr><td colspan="7" class="text-center">Belum ada pemain terdaftar untuk klub Anda.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function showPemainPrakompetisiForm(id_pemain = null, id_kompetisi = null, isNew = true) {
    const isEdit = !isNew;
    let data = { id_pemain: id_pemain, id_kompetisi: id_kompetisi, klub: currentUser.id_klub };
    let playerDetail = null;
    
    if (isEdit) {
        // Cari data pemain yang sedang diedit
        playerDetail = globalValidPemain.find(p => p.id_pemain === id_pemain);
        if (playerDetail) {
            data = { ...data, ...playerDetail };
        }
    }

    const kompetisiOptionsHtml = document.querySelector('#kompetisi-filter')?.innerHTML || '';
    const posisiOptions = ['GK', 'DF', 'MF', 'FW'];
    
    // Tentukan apakah NIK dan Nama bisa diubah
    const canEditBasicInfo = isNew; // Hanya bisa diubah saat menambah baru

    const formHtml = `
        ${isEdit ? `<input type="hidden" name="action" value="UPDATE"><input type="hidden" name="id_pemain" value="${data.id_pemain}">` : `<input type="hidden" name="action" value="CREATE">`}
        <input type="hidden" name="klub" value="${currentUser.id_klub}">
        <input type="hidden" name="existing_foto_ktp" value="${data.foto_ktp || ''}">
        <input type="hidden" name="existing_foto_kk" value="${data.foto_kk || ''}">
        <input type="hidden" name="existing_foto_diri" value="${data.foto_diri || ''}">

        <div class="col-12">
            <label for="id_kompetisi" class="form-label">Kompetisi</label>
            <select class="form-select" id="id_kompetisi" name="id_kompetisi" required>
                ${kompetisiOptionsHtml}
            </select>
        </div>
        
        <div class="col-md-6">
            <label for="nik" class="form-label">NIK</label>
            <input type="text" class="form-control" id="nik" name="nik" value="${data.nik || ''}" required ${canEditBasicInfo ? '' : 'readonly'}>
        </div>
        <div class="col-md-6">
            <label for="nama" class="form-label">Nama Lengkap</label>
            <input type="text" class="form-control" id="nama" name="nama" value="${data.nama || ''}" required ${canEditBasicInfo ? '' : 'readonly'}>
        </div>
        
        <div class="col-md-6">
            <label for="tempat_lahir" class="form-label">Tempat Lahir</label>
            <input type="text" class="form-control" id="tempat_lahir" name="tempat_lahir" value="${data.tempat_lahir || ''}" required>
        </div>
        <div class="col-md-6">
            <label for="tanggal_lahir" class="form-label">Tanggal Lahir</label>
            <input type="date" class="form-control" id="tanggal_lahir" name="tanggal_lahir" value="${data.tanggal_lahir || ''}" required>
        </div>
        
        <div class="col-md-6">
            <label for="posisi" class="form-label">Posisi Bermain</label>
            <select class="form-select" id="posisi" name="posisi" required>
                <option value="">Pilih Posisi</option>
                ${posisiOptions.map(p => `<option value="${p}" ${data.posisi === p ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
        </div>
        <div class="col-md-6">
            <label for="nomor_punggung" class="form-label">Nomor Punggung</label>
            <input type="number" class="form-control" id="nomor_punggung" name="nomor_punggung" value="${data.nomor_punggung || ''}" required>
        </div>
        
        <div class="col-12"><hr><h6>Dokumen Pendukung (Maksimal 2MB per file)</h6></div>
        
        <div class="col-md-4">
            <label for="foto_ktp" class="form-label">Foto KTP/Pelajar ${data.foto_ktp ? `(<a href="${data.foto_ktp}" target="_blank">Lihat</a>)` : ''}</label>
            <input type="file" class="form-control" id="foto_ktp" name="foto_ktp" accept="image/*" ${isNew ? 'required' : ''}>
        </div>
        <div class="col-md-4">
            <label for="foto_kk" class="form-label">Foto Kartu Keluarga ${data.foto_kk ? `(<a href="${data.foto_kk}" target="_blank">Lihat</a>)` : ''}</label>
            <input type="file" class="form-control" id="foto_kk" name="foto_kk" accept="image/*" ${isNew ? 'required' : ''}>
        </div>
        <div class="col-md-4">
            <label for="foto_diri" class="form-label">Pas Foto Diri ${data.foto_diri ? `(<a href="${data.foto_diri}" target="_blank">Lihat</a>)` : ''}</label>
            <input type="file" class="form-control" id="foto_diri" name="foto_diri" accept="image/*" ${isNew ? 'required' : ''}>
        </div>
    `;

    showModalForm(`${isNew ? 'Tambah' : 'Edit'} Pemain`, formHtml, handlePemainPrakompetisiFormSubmit);
    
    // Set nilai default kompetisi jika ada
    if (data.id_kompetisi && document.getElementById('id_kompetisi')) {
        document.getElementById('id_kompetisi').value = data.id_kompetisi;
    }
}

async function handlePemainPrakompetisiFormSubmit(e) {
    const filesToUpload = ['foto_ktp', 'foto_kk', 'foto_diri'];
    await handleGenericFormSubmit(e, 'SAVE_PEMAIN_PRAKOMPETISI', filesToUpload, loadPendaftaranPemainPage);
}

// -------------------------------------------------------------------------
// HALAMAN PENDAFTARAN OFFICIAL (ADMIN_KLUB)
// -------------------------------------------------------------------------

async function loadPendaftaranOfficialPage() {
    if (currentUser.type_users !== 'ADMIN_KLUB') {
        contentDiv.innerHTML = '<div class="alert alert-danger">Anda tidak memiliki akses ke halaman ini.</div>';
        return;
    }
    
    contentDiv.innerHTML = '<h2>Pendaftaran Official</h2><p>Memuat data...</p>';
    
    const [kompetisiResult, registeredResult, validOfficialResult] = await Promise.all([
        callAppsScript('GET_LIST_KOMPETISI'),
        callAppsScript('GET_REGISTERED_OFFICIAL'),
        callAppsScript('GET_FILTERED_OFFICIAL', { id_kompetisi: 'semua' }) // Ambil semua official terdaftar
    ]);

    let kompetisiOptions = [];
    let registeredOfficial = [];

    if (kompetisiResult && kompetisiResult.success) {
        kompetisiOptions = kompetisiResult.data.map(k => `<option value="${k.id_kompetisi}">${k.nama_kompetisi} (${k.tahun})</option>`).join('');
    }
    
    if (registeredResult && registeredResult.success) {
        registeredOfficial = registeredResult.data;
    }
    
    if (validOfficialResult && validOfficialResult.success) {
        globalValidOfficial = validOfficialResult.data;
    }


    const tableRows = registeredOfficial.map((o, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${o.nama}</td>
            <td>${o.nik}</td>
            <td>${o.jabatan}</td>
            <td>${o.kompetisi_id}</td>
            <td>
                <span class="badge ${o.verifikasi === 'TERVERIFIKASI' ? 'bg-success' : o.verifikasi === 'DITOLAK' ? 'bg-danger' : 'bg-warning'}">
                    ${o.verifikasi}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="showOfficialPrakompetisiForm('${o.id_official}', '${o.id_kompetisi}', false)">
                    <i class="fas fa-edit"></i> Edit
                </button>
            </td>
        </tr>
    `).join('');

    contentDiv.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h2>Pendaftaran Official Klub ${currentUser.id_klub}</h2>
            <button class="btn btn-success" onclick="showOfficialPrakompetisiForm(null, null, true)">
                <i class="fas fa-plus"></i> Tambah Official
            </button>
        </div>
        
        <div class="card shadow-sm mb-4">
            <div class="card-header bg-primary text-white">Daftar Official Terdaftar</div>
            <div class="card-body">
                <div class="table-responsive">
                    <table class="table table-striped table-hover">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Nama</th>
                                <th>NIK</th>
                                <th>Jabatan</th>
                                <th>ID Kompetisi</th>
                                <th>Status Verifikasi</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows || '<tr><td colspan="7" class="text-center">Belum ada official terdaftar untuk klub Anda.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function showOfficialPrakompetisiForm(id_official = null, id_kompetisi = null, isNew = true) {
    const isEdit = !isNew;
    let data = { id_official: id_official, id_kompetisi: id_kompetisi, klub: currentUser.id_klub };
    let officialDetail = null;
    
    if (isEdit) {
        // Cari data official yang sedang diedit
        officialDetail = globalValidOfficial.find(o => o.id_official === id_official);
        if (officialDetail) {
            data = { ...data, ...officialDetail };
        }
    }

    const kompetisiOptionsHtml = document.querySelector('#kompetisi-filter')?.innerHTML || '';
    const jabatanOptions = ['Manager', 'Pelatih Kepala', 'Asisten Pelatih', 'Masseur', 'Kitman', 'Lainnya'];
    
    // Tentukan apakah NIK dan Nama bisa diubah
    const canEditBasicInfo = isNew; // Hanya bisa diubah saat menambah baru

    const formHtml = `
        ${isEdit ? `<input type="hidden" name="action" value="UPDATE"><input type="hidden" name="id_official" value="${data.id_official}">` : `<input type="hidden" name="action" value="CREATE">`}
        <input type="hidden" name="klub" value="${currentUser.id_klub}">
        <input type="hidden" name="existing_foto_ktp" value="${data.foto_ktp || ''}">
        <input type="hidden" name="existing_foto_diri" value="${data.foto_diri || ''}">

        <div class="col-12">
            <label for="id_kompetisi" class="form-label">Kompetisi</label>
            <select class="form-select" id="id_kompetisi" name="id_kompetisi" required>
                ${kompetisiOptionsHtml}
            </select>
        </div>
        
        <div class="col-md-6">
            <label for="nik" class="form-label">NIK</label>
            <input type="text" class="form-control" id="nik" name="nik" value="${data.nik || ''}" required ${canEditBasicInfo ? '' : 'readonly'}>
        </div>
        <div class="col-md-6">
            <label for="nama" class="form-label">Nama Lengkap</label>
            <input type="text" class="form-control" id="nama" name="nama" value="${data.nama || ''}" required ${canEditBasicInfo ? '' : 'readonly'}>
        </div>
        
        <div class="col-md-6">
            <label for="jabatan" class="form-label">Jabatan</label>
            <select class="form-select" id="jabatan" name="jabatan" required>
                <option value="">Pilih Jabatan</option>
                ${jabatanOptions.map(j => `<option value="${j}" ${data.jabatan === j ? 'selected' : ''}>${j}</option>`).join('')}
            </select>
        </div>
        <div class="col-md-6">
            <label for="tempat_lahir" class="form-label">Tempat Lahir</label>
            <input type="text" class="form-control" id="tempat_lahir" name="tempat_lahir" value="${data.tempat_lahir || ''}" required>
        </div>
        <div class="col-md-6">
            <label for="tanggal_lahir" class="form-label">Tanggal Lahir</label>
            <input type="date" class="form-control" id="tanggal_lahir" name="tanggal_lahir" value="${data.tanggal_lahir || ''}" required>
        </div>
        
        <div class="col-12"><hr><h6>Dokumen Pendukung (Maksimal 2MB per file)</h6></div>
        
        <div class="col-md-6">
            <label for="foto_ktp" class="form-label">Foto KTP/Pelajar ${data.foto_ktp ? `(<a href="${data.foto_ktp}" target="_blank">Lihat</a>)` : ''}</label>
            <input type="file" class="form-control" id="foto_ktp" name="foto_ktp" accept="image/*" ${isNew ? 'required' : ''}>
        </div>
        <div class="col-md-6">
            <label for="foto_diri" class="form-label">Pas Foto Diri ${data.foto_diri ? `(<a href="${data.foto_diri}" target="_blank">Lihat</a>)` : ''}</label>
            <input type="file" class="form-control" id="foto_diri" name="foto_diri" accept="image/*" ${isNew ? 'required' : ''}>
        </div>
    `;

    showModalForm(`${isNew ? 'Tambah' : 'Edit'} Official`, formHtml, handleOfficialPrakompetisiFormSubmit);
    
    // Set nilai default kompetisi jika ada
    if (data.id_kompetisi && document.getElementById('id_kompetisi')) {
        document.getElementById('id_kompetisi').value = data.id_kompetisi;
    }
}

async function handleOfficialPrakompetisiFormSubmit(e) {
    const filesToUpload = ['foto_ktp', 'foto_diri'];
    await handleGenericFormSubmit(e, 'SAVE_OFFICIAL_PRAKOMPETISI', filesToUpload, loadPendaftaranOfficialPage);
}


// -------------------------------------------------------------------------
// HALAMAN VERIFIKASI PEMAIN (ADMIN, TIM_TEKNIS)
// -------------------------------------------------------------------------

async function loadVerifikasiPemainPage() {
    if (currentUser.type_users !== 'ADMIN' && currentUser.type_users !== 'TIM_TEKNIS') {
        contentDiv.innerHTML = '<div class="alert alert-danger">Anda tidak memiliki akses ke halaman ini.</div>';
        return;
    }
    
    contentDiv.innerHTML = '<h2>Verifikasi Pemain</h2><p>Memuat data...</p>';
    
    const [kompetisiResult, pemainResult] = await Promise.all([
        callAppsScript('GET_LIST_KOMPETISI'),
        callAppsScript('GET_FILTERED_PEMAIN', { id_kompetisi: 'semua' }) 
    ]);

    let kompetisiOptions = [];
    let pemainList = [];
    if (kompetisiResult && kompetisiResult.success) {
        kompetisiOptions = kompetisiResult.data;
    }
    if (pemainResult && pemainResult.success) {
        pemainList = pemainResult.data;
        globalValidPemain = pemainList; // Update global list
    }
    
    // Filter dan tampilkan hanya yang BELUM TERVERIFIKASI atau DITOLAK
    const unverifiedPemain = pemainList.filter(p => p.verifikasi !== 'TERVERIFIKASI');

    const kompetisiHtmlOptions = kompetisiOptions.map(k => `<option value="${k.id_kompetisi}">${k.nama_kompetisi} (${k.tahun})</option>`).join('');

    contentDiv.innerHTML = `
        <h2 class="mb-4">Verifikasi Pemain Pra-Kompetisi</h2>
        <div class="card shadow-sm mb-4">
            <div class="card-header bg-warning text-dark">Data Menunggu Aksi</div>
            <div class="card-body">
                <div class="mb-3">
                    <label for="kompetisi-filter-verif" class="form-label">Filter Kompetisi</label>
                    <select class="form-select" id="kompetisi-filter-verif" onchange="filterVerifikasiPemain()">
                        <option value="semua">Semua Kompetisi</option>
                        ${kompetisiHtmlOptions}
                    </select>
                </div>
                <div class="table-responsive">
                    <table class="table table-striped table-hover" id="verifikasiPemainTable">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Nama</th>
                                <th>Klub</th>
                                <th>Kompetisi</th>
                                <th>Status</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody id="verifikasiPemainBody">
                            </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    filterVerifikasiPemain(unverifiedPemain);
}

function filterVerifikasiPemain(data = globalValidPemain) {
    const filterId = document.getElementById('kompetisi-filter-verif')?.value || 'semua';
    
    let filteredData = data.filter(p => p.verifikasi !== 'TERVERIFIKASI');

    if (filterId !== 'semua') {
        filteredData = filteredData.filter(p => p.id_kompetisi === filterId);
    }
    
    const tableBody = document.getElementById('verifikasiPemainBody');
    if (!tableBody) return;

    const rows = filteredData.map((p, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${p.nama} (${p.nik})</td>
            <td>${p.klub}</td>
            <td>${p.id_kompetisi}</td>
            <td>
                <span class="badge ${p.verifikasi === 'TERVERIFIKASI' ? 'bg-success' : p.verifikasi === 'DITOLAK' ? 'bg-danger' : 'bg-warning'}">
                    ${p.verifikasi}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-info" onclick="viewPemainDetails('${p.id_pemain}', 'pemain')">
                    <i class="fas fa-eye"></i> Detail
                </button>
            </td>
        </tr>
    `).join('');

    tableBody.innerHTML = rows || '<tr><td colspan="6" class="text-center">Tidak ada data pemain yang membutuhkan verifikasi.</td></tr>';
}

function viewPemainDetails(id_pemain) {
    const pemain = globalValidPemain.find(p => p.id_pemain === id_pemain);
    if (!pemain) {
        showToast('Data pemain tidak ditemukan.', false);
        return;
    }

    const formHtml = `
        <input type="hidden" name="id_pemain" value="${pemain.id_pemain}">
        <input type="hidden" name="action" value="VERIFY">

        <div class="col-md-6"><strong>Nama:</strong> ${pemain.nama}</div>
        <div class="col-md-6"><strong>NIK:</strong> ${pemain.nik}</div>
        <div class="col-md-6"><strong>Klub:</strong> ${pemain.klub}</div>
        <div class="col-md-6"><strong>Kompetisi:</strong> ${pemain.id_kompetisi}</div>
        <div class="col-md-6"><strong>Posisi:</strong> ${pemain.posisi}</div>
        <div class="col-md-6"><strong>No. Punggung:</strong> ${pemain.nomor_punggung}</div>
        <div class="col-12"><hr></div>
        
        <div class="col-md-4">
            <strong>Foto KTP/Pelajar:</strong> 
            <a href="${pemain.foto_ktp}" target="_blank" class="btn btn-sm btn-outline-primary w-100">Lihat</a>
        </div>
        <div class="col-md-4">
            <strong>Foto Kartu Keluarga:</strong> 
            <a href="${pemain.foto_kk}" target="_blank" class="btn btn-sm btn-outline-primary w-100">Lihat</a>
        </div>
        <div class="col-md-4">
            <strong>Pas Foto Diri:</strong> 
            <a href="${pemain.foto_diri}" target="_blank" class="btn btn-sm btn-outline-primary w-100">Lihat</a>
        </div>
        <div class="col-12"><hr></div>
        
        <div class="col-12">
            <label for="status_verifikasi" class="form-label">Keputusan Verifikasi</label>
            <select class="form-select" id="status_verifikasi" name="status_verifikasi" required>
                <option value="MENUNGGU">MENUNGGU (Belum Diperiksa)</option>
                <option value="TERVERIFIKASI">TERVERIFIKASI (Disetujui)</option>
                <option value="DITOLAK">DITOLAK</option>
            </select>
        </div>
        <div class="col-12">
            <label for="catatan_verifikasi" class="form-label">Catatan Verifikasi (Wajib jika DITOLAK)</label>
            <textarea class="form-control" id="catatan_verifikasi" name="catatan_verifikasi">${pemain.catatan_verifikasi || ''}</textarea>
        </div>
    `;

    showModalForm(`Verifikasi Pemain: ${pemain.nama}`, formHtml, handleVerifikasiPemainSubmit);
    
    // Set status verifikasi saat ini
    document.getElementById('status_verifikasi').value = pemain.verifikasi;
}

async function handleVerifikasiPemainSubmit(e) {
    await handleGenericFormSubmit(e, 'VERIFIKASI_PEMAIN', [], loadVerifikasiPemainPage);
}


// -------------------------------------------------------------------------
// HALAMAN VERIFIKASI OFFICIAL (ADMIN, TIM_TEKNIS)
// -------------------------------------------------------------------------

async function loadVerifikasiOfficialPage() {
    if (currentUser.type_users !== 'ADMIN' && currentUser.type_users !== 'TIM_TEKNIS') {
        contentDiv.innerHTML = '<div class="alert alert-danger">Anda tidak memiliki akses ke halaman ini.</div>';
        return;
    }
    
    contentDiv.innerHTML = '<h2>Verifikasi Official</h2><p>Memuat data...</p>';
    
    const [kompetisiResult, officialResult] = await Promise.all([
        callAppsScript('GET_LIST_KOMPETISI'),
        callAppsScript('GET_FILTERED_OFFICIAL', { id_kompetisi: 'semua' }) 
    ]);

    let kompetisiOptions = [];
    let officialList = [];
    if (kompetisiResult && kompetisiResult.success) {
        kompetisiOptions = kompetisiResult.data;
    }
    if (officialResult && officialResult.success) {
        officialList = officialResult.data;
        globalValidOfficial = officialList; // Update global list
    }
    
    // Filter dan tampilkan hanya yang BELUM TERVERIFIKASI atau DITOLAK
    const unverifiedOfficial = officialList.filter(o => o.verifikasi !== 'TERVERIFIKASI');

    const kompetisiHtmlOptions = kompetisiOptions.map(k => `<option value="${k.id_kompetisi}">${k.nama_kompetisi} (${k.tahun})</option>`).join('');

    contentDiv.innerHTML = `
        <h2 class="mb-4">Verifikasi Official Pra-Kompetisi</h2>
        <div class="card shadow-sm mb-4">
            <div class="card-header bg-warning text-dark">Data Menunggu Aksi</div>
            <div class="card-body">
                <div class="mb-3">
                    <label for="kompetisi-filter-verif-official" class="form-label">Filter Kompetisi</label>
                    <select class="form-select" id="kompetisi-filter-verif-official" onchange="filterVerifikasiOfficial()">
                        <option value="semua">Semua Kompetisi</option>
                        ${kompetisiHtmlOptions}
                    </select>
                </div>
                <div class="table-responsive">
                    <table class="table table-striped table-hover" id="verifikasiOfficialTable">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Nama</th>
                                <th>Klub</th>
                                <th>Jabatan</th>
                                <th>Kompetisi</th>
                                <th>Status</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody id="verifikasiOfficialBody">
                            </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    filterVerifikasiOfficial(unverifiedOfficial);
}

function filterVerifikasiOfficial(data = globalValidOfficial) {
    const filterId = document.getElementById('kompetisi-filter-verif-official')?.value || 'semua';
    
    let filteredData = data.filter(o => o.verifikasi !== 'TERVERIFIKASI');

    if (filterId !== 'semua') {
        filteredData = filteredData.filter(o => o.id_kompetisi === filterId);
    }
    
    const tableBody = document.getElementById('verifikasiOfficialBody');
    if (!tableBody) return;

    const rows = filteredData.map((o, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${o.nama} (${o.nik})</td>
            <td>${o.klub}</td>
            <td>${o.jabatan}</td>
            <td>${o.id_kompetisi}</td>
            <td>
                <span class="badge ${o.verifikasi === 'TERVERIFIKASI' ? 'bg-success' : o.verifikasi === 'DITOLAK' ? 'bg-danger' : 'bg-warning'}">
                    ${o.verifikasi}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-info" onclick="viewOfficialDetails('${o.id_official}')">
                    <i class="fas fa-eye"></i> Detail
                </button>
            </td>
        </tr>
    `).join('');

    tableBody.innerHTML = rows || '<tr><td colspan="7" class="text-center">Tidak ada data official yang membutuhkan verifikasi.</td></tr>';
}

function viewOfficialDetails(id_official) {
    const official = globalValidOfficial.find(o => o.id_official === id_official);
    if (!official) {
        showToast('Data official tidak ditemukan.', false);
        return;
    }

    const formHtml = `
        <input type="hidden" name="id_official" value="${official.id_official}">
        <input type="hidden" name="action" value="VERIFY">

        <div class="col-md-6"><strong>Nama:</strong> ${official.nama}</div>
        <div class="col-md-6"><strong>NIK:</strong> ${official.nik}</div>
        <div class="col-md-6"><strong>Klub:</strong> ${official.klub}</div>
        <div class="col-md-6"><strong>Kompetisi:</strong> ${official.id_kompetisi}</div>
        <div class="col-md-6"><strong>Jabatan:</strong> ${official.jabatan}</div>
        <div class="col-md-6"><strong>Tanggal Lahir:</strong> ${official.tanggal_lahir}</div>
        <div class="col-12"><hr></div>
        
        <div class="col-md-6">
            <strong>Foto KTP/Pelajar:</strong> 
            <a href="${official.foto_ktp}" target="_blank" class="btn btn-sm btn-outline-primary w-100">Lihat</a>
        </div>
        <div class="col-md-6">
            <strong>Pas Foto Diri:</strong> 
            <a href="${official.foto_diri}" target="_blank" class="btn btn-sm btn-outline-primary w-100">Lihat</a>
        </div>
        <div class="col-12"><hr></div>
        
        <div class="col-12">
            <label for="status_verifikasi" class="form-label">Keputusan Verifikasi</label>
            <select class="form-select" id="status_verifikasi" name="status_verifikasi" required>
                <option value="MENUNGGU">MENUNGGU (Belum Diperiksa)</option>
                <option value="TERVERIFIKASI">TERVERIFIKASI (Disetujui)</option>
                <option value="DITOLAK">DITOLAK</option>
            </select>
        </div>
        <div class="col-12">
            <label for="catatan_verifikasi" class="form-label">Catatan Verifikasi (Wajib jika DITOLAK)</label>
            <textarea class="form-control" id="catatan_verifikasi" name="catatan_verifikasi">${official.catatan_verifikasi || ''}</textarea>
        </div>
    `;

    showModalForm(`Verifikasi Official: ${official.nama}`, formHtml, handleVerifikasiOfficialSubmit);
    
    // Set status verifikasi saat ini
    document.getElementById('status_verifikasi').value = official.verifikasi;
}

async function handleVerifikasiOfficialSubmit(e) {
    await handleGenericFormSubmit(e, 'VERIFIKASI_OFFICIAL', [], loadVerifikasiOfficialPage);
}


// -------------------------------------------------------------------------
// HALAMAN PENGATURAN BANNER (ADMIN)
// -------------------------------------------------------------------------

async function loadBannerSetting() {
    if (currentUser.type_users !== 'ADMIN') {
        contentDiv.innerHTML = '<div class="alert alert-danger">Anda tidak memiliki akses ke halaman ini.</div>';
        return;
    }
    
    contentDiv.innerHTML = '<h2>Pengaturan Banner</h2><p>Memuat data banner...</p>';
    
    const result = await callAppsScript('GET_ALL_BANNER');

    if (result && result.success) {
        const banners = result.data;
        
        const tableRows = banners.map(b => `
            <tr>
                <td><img src="${b.url}" alt="${b.caption}" style="width: 100px; height: auto;"></td>
                <td>${b.caption}</td>
                <td>${b.is_active === 'TRUE' ? '<span class="badge bg-success">Aktif</span>' : '<span class="badge bg-secondary">Non-Aktif</span>'}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="showBannerForm('${b.id_banner}', false)">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="confirmDeleteBanner('${b.id_banner}', '${b.caption}')">
                        <i class="fas fa-trash"></i> Hapus
                    </button>
                </td>
            </tr>
        `).join('');

        contentDiv.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h2>Manajemen Banner Utama</h2>
                <button class="btn btn-success" onclick="showBannerForm(null, true)">
                    <i class="fas fa-plus"></i> Tambah Banner
                </button>
            </div>
            
            <div class="card shadow-sm">
                <div class="card-header bg-primary text-white">Daftar Banner</div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-striped table-hover">
                            <thead>
                                <tr>
                                    <th>Gambar</th>
                                    <th>Keterangan</th>
                                    <th>Status</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRows || '<tr><td colspan="4" class="text-center">Belum ada banner terdaftar.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    } else {
        contentDiv.innerHTML = `<div class="alert alert-danger">Gagal memuat data banner.</div>`;
    }
}

function showBannerForm(id_banner = null, isNew = true) {
    let data = {};
    if (!isNew) {
        // Logika untuk mengambil data banner yang sudah ada. 
        // Karena data banner tidak disimpan secara global, kita anggap fungsi ini dipanggil dengan data lengkap.
        // Untuk penyederhanaan, kita hanya menggunakan ID dan membuat formulir Edit.
        data.id_banner = id_banner; 
        data.caption = 'Keterangan Banner Lama';
        data.url = ''; 
        data.is_active = 'TRUE';

        // Dalam aplikasi riil, Anda akan memanggil Apps Script untuk GET_BANNER_BY_ID
        // Simulasi data lama:
        const bannerDataList = [
            { id_banner: 'B001', caption: 'Banner 1', url: 'https://i.ibb.co/example/B001.jpg', is_active: 'TRUE' },
            // ... (gunakan data aktual dari hasil GET_ALL_BANNER)
        ];
        const existingBanner = bannerDataList.find(b => b.id_banner === id_banner);
        if (existingBanner) data = existingBanner;
    }

    const formHtml = `
        ${isNew ? `<input type="hidden" name="action" value="CREATE">` : `<input type="hidden" name="action" value="UPDATE"><input type="hidden" name="id_banner" value="${data.id_banner}">`}
        <input type="hidden" name="existing_url" value="${data.url || ''}">

        <div class="col-12">
            <label for="caption" class="form-label">Keterangan Banner</label>
            <input type="text" class="form-control" id="caption" name="caption" value="${data.caption || ''}" required>
        </div>
        <div class="col-md-6">
            <label for="file_banner" class="form-label">File Gambar Banner ${data.url ? `(<a href="${data.url}" target="_blank">Lihat Gambar Saat Ini</a>)` : ''}</label>
            <input type="file" class="form-control" id="file_banner" name="file_banner" accept="image/*" ${isNew ? 'required' : ''}>
        </div>
        <div class="col-md-6">
            <label for="is_active" class="form-label">Status</label>
            <select class="form-select" id="is_active" name="is_active" required>
                <option value="TRUE" ${data.is_active === 'TRUE' ? 'selected' : ''}>Aktif</option>
                <option value="FALSE" ${data.is_active === 'FALSE' ? 'selected' : ''}>Non-Aktif</option>
            </select>
        </div>
    `;

    showModalForm(`${isNew ? 'Tambah' : 'Edit'} Banner`, formHtml, handleBannerFormSubmit);
}

async function handleBannerFormSubmit(e) {
    await handleGenericFormSubmit(e, 'CRUD_BANNER', ['file_banner'], loadBannerSetting);
}

function confirmDeleteBanner(id_banner, caption) {
    showConfirmationModal(`Apakah Anda yakin ingin menghapus banner "${caption}"?`, async () => {
        const data = { action: 'DELETE', id_banner: id_banner };
        const result = await callAppsScript('CRUD_BANNER', { data: JSON.stringify(data) });
        
        if (result && result.success) {
            loadBannerSetting();
        }
    });
}

// -------------------------------------------------------------------------
// HALAMAN PENGATURAN USERLIST (ADMIN)
// -------------------------------------------------------------------------

async function loadUserlistSetting() {
    if (currentUser.type_users !== 'ADMIN') {
        contentDiv.innerHTML = '<div class="alert alert-danger">Anda tidak memiliki akses ke halaman ini.</div>';
        return;
    }
    
    contentDiv.innerHTML = '<h2>Pengaturan Daftar Pengguna</h2><p>Memuat daftar pengguna...</p>';
    
    const result = await callAppsScript('GET_USERLIST');

    if (result && result.success) {
        const userlist = result.data;
        
        const tableRows = userlist.map(u => `
            <tr>
                <td>${u.username}</td>
                <td><span class="badge ${u.type_users === 'ADMIN' ? 'bg-danger' : u.type_users === 'ADMIN_KLUB' ? 'bg-primary' : 'bg-info'}">${u.type_users}</span></td>
                <td>${u.klub || '-'}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="showUserlistForm('${u.username}', ${JSON.stringify(u)})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    ${u.username !== currentUser.username ? `
                    <button class="btn btn-sm btn-danger" onclick="confirmDeleteUserlist('${u.username}')">
                        <i class="fas fa-trash"></i> Hapus
                    </button>` : ''}
                </td>
            </tr>
        `).join('');

        contentDiv.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h2>Manajemen Pengguna</h2>
                <button class="btn btn-success" onclick="showUserlistForm(null, null, true)">
                    <i class="fas fa-user-plus"></i> Tambah Pengguna
                </button>
            </div>
            
            <div class="card shadow-sm">
                <div class="card-header bg-primary text-white">Daftar Akun Pengguna</div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-striped table-hover">
                            <thead>
                                <tr>
                                    <th>Username</th>
                                    <th>Tipe Pengguna</th>
                                    <th>ID Klub</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRows || '<tr><td colspan="4" class="text-center">Belum ada pengguna terdaftar.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    } else {
        contentDiv.innerHTML = `<div class="alert alert-danger">Gagal memuat data pengguna.</div>`;
    }
}

function showUserlistForm(username = null, existingData = null, isNew = true) {
    let data = existingData || {};
    const typeOptions = ['ADMIN', 'TIM_TEKNIS', 'ADMIN_KLUB'];
    
    const formHtml = `
        ${isNew ? `<input type="hidden" name="action" value="CREATE">` : `<input type="hidden" name="action" value="UPDATE"><input type="hidden" name="old_username" value="${username}">`}

        <div class="col-md-6">
            <label for="username" class="form-label">Username</label>
            <input type="text" class="form-control" id="username" name="username" value="${data.username || ''}" required ${!isNew ? 'readonly' : ''}>
        </div>
        <div class="col-md-6">
            <label for="password" class="form-label">Password ${isNew ? ' (Wajib)' : ' (Kosongkan jika tidak diubah)'}</label>
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
            loadUserlistSetting();
        }
    });
}


// --- INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {
    // Cek hash saat halaman dimuat
    if (window.location.hash) {
        currentPage = window.location.hash.substring(1);
    }
    
    // Mulai pengecekan autentikasi
    checkAuth();
});
