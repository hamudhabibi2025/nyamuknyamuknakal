// =========================================================================
// KONFIGURASI PENTING - WAJIB DIUBAH
// GANTI URL INI DENGAN URL DEPLOYMENT APPS SCRIPT ANDA
// =========================================================================
const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbxxkngw3P6WXwk7CFGYOa0k7p-Y7DnL_lHQLrEx2cqi7-GdjoDV81f7RVbjW6JS_64Kcw/exec'; 
// =========================================================================

let currentUser = null;
const appContainer = document.getElementById('app-container');
let contentDiv = document.getElementById('content-div');
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

/** * Fungsi untuk memanggil Google Apps Script API.
 * Menggunakan POST untuk keamanan data.
 */
async function callAppsScript(action, params = {}) {
    showLoading();
    
    const formData = new FormData();
    formData.append('action', action);
    
    // Tambahkan data user untuk otentikasi
    if (currentUser) {
        formData.append('user', JSON.stringify(currentUser));
    }

    // Tambahkan parameter lainnya
    for (const key in params) {
        if (params.hasOwnProperty(key)) {
            formData.append(key, params[key]);
        }
    }

    try {
        const response = await fetch(GAS_API_URL, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`Kesalahan jaringan: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        
        if (result.success === false) {
            showToast(result.message || 'Operasi gagal.', false);
            return null;
        }

        return result;

    } catch (error) {
        console.error('Apps Script API Error:', error);
        showToast(`Terjadi kesalahan: ${error.message}`, false);
        return null;
    } finally {
        hideLoading();
    }
}

// --- AUTHENTICATION ---

function checkAuth() {
    const userJson = localStorage.getItem('currentUser');
    if (userJson) {
        try {
            currentUser = JSON.parse(userJson);
            showApp();
            loadCurrentPage();
            return true;
        } catch (e) {
            console.error("Error parsing user data:", e);
            localStorage.removeItem('currentUser');
        }
    }
    showLogin();
    return false;
}

function showLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    appContainer.style.display = 'none';
    document.getElementById('login-error-message').textContent = '';
}

function showApp() {
    document.getElementById('login-screen').style.display = 'none';
    appContainer.style.display = 'flex';
    updateUserInfo();
    updateMenuVisibility();
}

function updateUserInfo() {
    if (currentUser) {
        const info = `${currentUser.username} (${currentUser.type_users}${currentUser.id_klub ? ' - ' + currentUser.id_klub : ''})`;
        document.getElementById('current-user-info').textContent = info;
    }
}

function updateMenuVisibility() {
    const settingsNavItem = document.getElementById('nav-setting-item');
    if (currentUser && currentUser.type_users === 'ADMIN_SISTEM') {
        settingsNavItem.style.display = 'block';
    } else {
        settingsNavItem.style.display = 'none';
        // Pindahkan ke home jika sedang di settings
        if (currentPage === 'settings') {
            changePage('home');
        }
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('login-error-message');
    errorMessage.textContent = '';
    
    const result = await callAppsScript('LOGIN', { username, password });

    if (result && result.success) {
        currentUser = result.user;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        showToast(`Selamat datang, ${currentUser.username}!`);
        showApp();
        changePage('home');
    } else {
        errorMessage.textContent = result ? result.message : 'Login gagal.';
    }
}

function doLogout() {
    localStorage.removeItem('currentUser');
    currentUser = null;
    showToast('Anda telah keluar.', false);
    showLogin();
}

// --- NAVIGATION & PAGE RENDERING ---

function changePage(page) {
    currentPage = page;
    const navLinks = document.querySelectorAll('#bottom-nav .nav-link');
    navLinks.forEach(link => {
        if (link.getAttribute('data-page') === page) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
    loadCurrentPage();
}

function loadCurrentPage() {
    contentDiv.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-primary"></div><p>Memuat konten...</p></div>';
    switch (currentPage) {
        case 'home':
            loadHomeContent();
            break;
        case 'registration':
            loadRegistrationContent();
            break;
        case 'settings':
            if (currentUser && currentUser.type_users === 'ADMIN_SISTEM') {
                loadSettingsContent();
            } else {
                contentDiv.innerHTML = '<div class="alert alert-danger">Akses Ditolak.</div>';
            }
            break;
        default:
            loadHomeContent();
    }
}

// --- MODAL UTILITIES ---

const mainModal = new bootstrap.Modal(document.getElementById('mainModal'));

function showModalForm(title, bodyHtml, submitHandler, size = '') {
    const modal = document.getElementById('mainModal');
    const dialog = modal.querySelector('.modal-dialog');
    dialog.className = `modal-dialog modal-dialog-centered modal-dialog-scrollable ${size}`;

    document.getElementById('mainModalLabel').textContent = title;
    document.getElementById('modalBodyContent').innerHTML = bodyHtml;
    
    const footer = document.getElementById('modalFooterContent');
    footer.innerHTML = `
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><i class="fas fa-times me-1"></i> Batal</button>
        <button type="submit" class="btn btn-primary" id="modalSubmitBtn"><i class="fas fa-save me-1"></i> Simpan</button>
    `;
    
    const modalForm = document.getElementById('modalForm');
    modalForm.onsubmit = async (e) => {
        e.preventDefault();
        // Handler kustom akan dipanggil
        await submitHandler(e);
    };

    mainModal.show();
}

function showConfirmationModal(message, confirmHandler) {
    const modalBody = `<p class="text-center lead">${message}</p>`;
    const modalFooter = `
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"><i class="fas fa-times me-1"></i> Tidak</button>
        <button type="button" class="btn btn-danger" id="confirmActionBtn"><i class="fas fa-trash-alt me-1"></i> Ya, Hapus</button>
    `;

    showModalForm('Konfirmasi', modalBody, () => {}, ''); // Modal tanpa submit form
    
    document.getElementById('modalFooterContent').innerHTML = modalFooter;
    document.getElementById('confirmActionBtn').onclick = () => {
        confirmHandler();
        mainModal.hide();
    };
}

// --- GENERIC FORM HANDLER ---

/** * Handler generik untuk CRUD.
 * @param {Event} e - Event submit.
 * @param {string} action - Aksi Apps Script yang akan dipanggil (misal: 'CRUD_KLUB').
 * @param {string[]} uploadFields - Daftar nama field input file yang berisi base64 (misal: ['base64_gambar']).
 * @param {Function} reloadFunction - Fungsi yang dipanggil setelah sukses (misal: loadKlubSetting).
 */
async function handleGenericFormSubmit(e, action, uploadFields = [], reloadFunction = null) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const data = {};
    let isUpdate = false;

    // Kumpulkan data form menjadi objek
    for (const [key, value] of formData.entries()) {
        data[key] = value;
        if (key === 'action' && value === 'UPDATE') {
            isUpdate = true;
        }
    }

    // Tangani upload file (konversi ke base64)
    for (const fieldName of uploadFields) {
        const fileInput = form.elements[fieldName.replace('base64_', '')];
        if (fileInput && fileInput.files.length > 0) {
            const file = fileInput.files[0];
            data[fieldName] = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(file);
            });
        } else if (isUpdate) {
             // Untuk UPDATE, jika file kosong, hapus properti base64_gambar agar tidak menimpa yang lama
             delete data[fieldName];
        }
    }

    const result = await callAppsScript(action, { data: JSON.stringify(data) });
    
    if (result && result.success) {
        showToast(result.message);
        mainModal.hide();
        if (reloadFunction) {
            reloadFunction();
        }
    }
}

// =========================================================================
// Halaman Utama (Home)
// =========================================================================

async function loadHomeContent() {
    const result = await callAppsScript('GET_HOME_DATA');

    if (result && result.success) {
        const { banner, klub, kompetisi } = result;

        let html = `
            <h4 class="mb-3 text-primary"><i class="fas fa-home me-2"></i> Beranda</h4>

            <!-- Banner Carousel -->
            <div id="bannerCarousel" class="carousel slide mb-4" data-bs-ride="carousel">
                <div class="carousel-inner rounded-3">
                    ${banner.length > 0 ? banner.map((b, index) => `
                        <div class="carousel-item ${index === 0 ? 'active' : ''}">
                            <img src="${b.url_gambar}" class="d-block w-100" alt="${b.judul}" onerror="this.onerror=null; this.src='https://placehold.co/800x200/cccccc/333333?text=Gambar+Banner+Tidak+Tersedia';">
                            <div class="carousel-caption d-none d-md-block">
                                <h5 class="text-white">${b.judul}</h5>
                            </div>
                        </div>
                    `).join('') : `
                        <div class="carousel-item active">
                            <img src="https://placehold.co/800x200/007bff/ffffff?text=SIPAKEM" class="d-block w-100" alt="SIPAKEM">
                            <div class="carousel-caption">
                                <h5>Selamat Datang</h5>
                            </div>
                        </div>
                    `}
                </div>
                ${banner.length > 1 ? `
                    <button class="carousel-control-prev" type="button" data-bs-target="#bannerCarousel" data-bs-slide="prev">
                        <span class="carousel-control-prev-icon" aria-hidden="true"></span>
                        <span class="visually-hidden">Previous</span>
                    </button>
                    <button class="carousel-control-next" type="button" data-bs-target="#bannerCarousel" data-bs-slide="next">
                        <span class="carousel-control-next-icon" aria-hidden="true"></span>
                        <span class="visually-hidden">Next</span>
                    </button>` : ''}
            </div>

            <!-- Kartu Statistik/Info Cepat -->
            <div class="row row-cols-2 g-3 mb-4">
                <div class="col">
                    <div class="card bg-success text-white text-center shadow">
                        <div class="card-body p-3">
                            <i class="fas fa-trophy fa-2x mb-2"></i>
                            <h5 class="card-title">${kompetisi.length}</h5>
                            <p class="card-text">Kompetisi Aktif</p>
                        </div>
                    </div>
                </div>
                <div class="col">
                    <div class="card bg-primary text-white text-center shadow">
                        <div class="card-body p-3">
                            <i class="fas fa-shield-alt fa-2x mb-2"></i>
                            <h5 class="card-title">${klub.length}</h5>
                            <p class="card-text">Klub Terdaftar</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- List Kompetisi Terkini -->
            <div class="card shadow-sm">
                <div class="card-header bg-light text-dark fw-bold">
                    <i class="fas fa-list-alt me-2"></i> Daftar Kompetisi
                </div>
                <ul class="list-group list-group-flush">
                    ${kompetisi.length > 0 ? kompetisi.map(k => `
                        <li class="list-group-item d-flex justify-content-between align-items-center">
                            <div>
                                <h6 class="mb-0">${k.nama}</h6>
                                <small class="text-muted">${k.tahun}</small>
                            </div>
                            <span class="badge bg-info text-dark rounded-pill">${k.id}</span>
                        </li>
                    `).join('') : `
                        <li class="list-group-item text-center text-muted">Belum ada data kompetisi.</li>
                    `}
                </ul>
            </div>
        `;
        contentDiv.innerHTML = html;
        new bootstrap.Carousel(document.getElementById('bannerCarousel'));
    }
}

// =========================================================================
// Halaman Registrasi (Registration)
// =========================================================================

async function loadRegistrationContent() {
    // Memuat daftar kompetisi untuk dropdown filter
    const kompetisiResult = await callAppsScript('GET_LIST_KOMPETISI');
    const kompetisiList = kompetisiResult ? kompetisiResult.data : [];
    
    // Simpan kompetisi options di global agar bisa digunakan di form
    window.globalKompetisiOptions = kompetisiList;

    let kompetisiOptionsHtml = kompetisiList.map(k => 
        `<option value="${k.id}">${k.nama} (${k.tahun})</option>`
    ).join('');

    // Admin Klub hanya perlu memilih kompetisi
    // Admin Sistem juga bisa melihat data filtered
    const showRegistrationForm = currentUser && currentUser.type_users === 'ADMIN_KLUB';
    const showFilter = currentUser && (currentUser.type_users === 'ADMIN_KLUB' || currentUser.type_users === 'ADMIN_SISTEM');

    let html = `
        <h4 class="mb-3 text-primary"><i class="fas fa-users me-2"></i> Registrasi Pra-Kompetisi</h4>
        
        <div class="card shadow-sm mb-4">
            <div class="card-body">
                ${showFilter ? `
                <div class="mb-3">
                    <label for="reg-kompetisi-filter" class="form-label fw-bold">Pilih Kompetisi:</label>
                    <select class="form-select" id="reg-kompetisi-filter" onchange="filterRegistrationData(this.value)">
                        <option value="">-- Tampilkan Semua Kompetisi --</option>
                        ${kompetisiOptionsHtml}
                    </select>
                </div>
                ` : '<div class="alert alert-warning">Anda tidak memiliki hak akses untuk fitur ini.</div>'}
                
                <div id="registration-content-area">
                    ${showFilter ? `<div class="text-center text-muted">Silakan pilih kompetisi di atas untuk melihat data.</div>` : ''}
                </div>
            </div>
        </div>
    `;

    contentDiv.innerHTML = html;
    
    // Jika hanya 1 kompetisi, langsung muat
    if (kompetisiList.length === 1 && showFilter) {
        document.getElementById('reg-kompetisi-filter').value = kompetisiList[0].id;
        filterRegistrationData(kompetisiList[0].id);
    }
}

async function filterRegistrationData(id_kompetisi) {
    const contentArea = document.getElementById('registration-content-area');
    contentArea.innerHTML = `<div class="text-center p-3"><div class="spinner-border text-primary"></div><p>Memuat data...</p></div>`;

    if (!id_kompetisi) {
        contentArea.innerHTML = `<div class="text-center text-muted">Silakan pilih kompetisi di atas untuk melihat data.</div>`;
        return;
    }
    
    // Muat data Pemain dan Official
    const pemainResult = await callAppsScript('GET_REGISTERED_PEMAIN', { id_kompetisi });
    const officialResult = await callAppsScript('GET_REGISTERED_OFFICIAL', { id_kompetisi });

    if (pemainResult && officialResult) {
        const pemainList = pemainResult.data || [];
        const officialList = officialResult.data || [];
        
        // Simpan data global untuk editing
        globalValidPemain = pemainList;
        globalValidOfficial = officialList;
        window.currentKompetisiId = id_kompetisi;

        let dataViewHtml = `
            <div class="mt-4">
                <ul class="nav nav-pills nav-fill mb-3" id="reg-tabs" role="tablist">
                    <li class="nav-item" role="presentation">
                        <button class="nav-link active" id="pemain-tab" data-bs-toggle="tab" data-bs-target="#pemain-pane" type="button" role="tab">
                            Pemain (${pemainList.length})
                        </button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link" id="official-tab" data-bs-toggle="tab" data-bs-target="#official-pane" type="button" role="tab">
                            Official (${officialList.length})
                        </button>
                    </li>
                </ul>

                <div class="tab-content" id="reg-tab-content">
                    <!-- Tab Pemain -->
                    <div class="tab-pane fade show active" id="pemain-pane" role="tabpanel" aria-labelledby="pemain-tab">
                        ${renderPrakompetisiList(pemainList, 'pemain')}
                    </div>
                    <!-- Tab Official -->
                    <div class="tab-pane fade" id="official-pane" role="tabpanel" aria-labelledby="official-tab">
                        ${renderPrakompetisiList(officialList, 'official')}
                    </div>
                </div>
            </div>
        `;
        
        contentArea.innerHTML = dataViewHtml;
        
        // Tambahkan tombol Tambah jika ADMIN_KLUB
        if (currentUser && currentUser.type_users === 'ADMIN_KLUB') {
            const addBtnHtml = `
                <div class="text-center mt-3">
                    <button class="btn btn-sm btn-success me-2" onclick="showPrakompetisiForm('pemain')">
                        <i class="fas fa-plus-circle me-1"></i> Tambah Pemain
                    </button>
                    <button class="btn btn-sm btn-info text-white" onclick="showPrakompetisiForm('official')">
                        <i class="fas fa-plus-circle me-1"></i> Tambah Official
                    </button>
                </div>
            `;
            contentArea.insertAdjacentHTML('beforeend', addBtnHtml);
        }
    }
}

/** Merender list Pemain/Official dalam format Card untuk Seluler */
function renderPrakompetisiList(dataList, type) {
    const isAdminKlub = currentUser && currentUser.type_users === 'ADMIN_KLUB';

    if (dataList.length === 0) {
        return `
            <div class="alert alert-info text-center">
                Belum ada data ${type} yang didaftarkan.
            </div>
        `;
    }

    return dataList.map(item => `
        <div class="card shadow-sm mb-3">
            <div class="card-body p-3">
                <div class="d-flex align-items-center">
                    <!-- Foto -->
                    <img src="${item.url_foto || 'https://placehold.co/100x120/007bff/ffffff?text=FOTO'}" 
                         alt="Foto ${item.nama}" class="rounded me-3" style="width: 70px; height: 90px; object-fit: cover;">
                    
                    <!-- Info Dasar -->
                    <div class="flex-grow-1">
                        <h5 class="card-title mb-0">${item.nama}</h5>
                        <p class="card-text text-muted mb-1">
                            ${type === 'pemain' ? `No. Punggung: <span class="fw-bold">${item.nomor_punggung || '-'}</span>` : `Jabatan: ${item.jabatan || '-'}`}
                        </p>
                        <p class="card-text mb-0">
                            <span class="badge bg-primary">${item.nama_klub || item.id_klub}</span>
                        </p>
                    </div>

                    <!-- Aksi -->
                    ${isAdminKlub && item.id_klub === currentUser.id_klub ? `
                    <div>
                        <button class="btn btn-sm btn-outline-warning me-1" onclick="showPrakompetisiForm('${type}', '${item.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="confirmDeletePrakompetisi('${type}', '${item.id}', '${item.nama}')">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `).join('');
}


/** Menampilkan form Tambah/Edit Pemain/Official */
function showPrakompetisiForm(type, id = null) {
    if (!window.currentKompetisiId) {
        showToast('Silakan pilih kompetisi terlebih dahulu.', false);
        return;
    }
    
    const isNew = id === null;
    const data = isNew ? {} : (type === 'pemain' ? globalValidPemain : globalValidOfficial).find(item => item.id === id) || {};

    const jabatanOptions = ['Manajer', 'Pelatih Kepala', 'Asisten Pelatih', 'Masseur', 'Dokter', 'Media Officer', 'Lainnya'];
    
    let formHtml = `
        <input type="hidden" name="action" value="${isNew ? 'CREATE' : 'UPDATE'}">
        <input type="hidden" name="id" value="${data.id || ''}">
        <input type="hidden" name="id_kompetisi" value="${window.currentKompetisiId}">

        <div class="mb-3">
            <label for="nama" class="form-label">Nama Lengkap</label>
            <input type="text" class="form-control" id="nama" name="nama" value="${data.nama || ''}" required>
        </div>
        
        <div class="mb-3">
            <label for="nik" class="form-label">NIK (Nomor Induk Kependudukan)</label>
            <input type="text" class="form-control" id="nik" name="nik" value="${data.nik || ''}" required>
        </div>
        
        <div class="row">
            <div class="col-6 mb-3">
                <label for="tanggal_lahir" class="form-label">Tgl Lahir</label>
                <input type="date" class="form-control" id="tanggal_lahir" name="tanggal_lahir" value="${data.tanggal_lahir || ''}" required>
            </div>
            <div class="col-6 mb-3">
                <label for="posisi" class="form-label">Posisi/Jabatan</label>
                ${type === 'pemain' ? `
                    <select class="form-select" id="posisi" name="posisi" required>
                        <option value="">-- Pilih Posisi --</option>
                        <option value="GK" ${data.posisi === 'GK' ? 'selected' : ''}>Kiper (GK)</option>
                        <option value="DF" ${data.posisi === 'DF' ? 'selected' : ''}>Belakang (DF)</option>
                        <option value="MF" ${data.posisi === 'MF' ? 'selected' : ''}>Tengah (MF)</option>
                        <option value="FW" ${data.posisi === 'FW' ? 'selected' : ''}>Depan (FW)</option>
                    </select>
                ` : `
                    <select class="form-select" id="jabatan" name="jabatan" required>
                        <option value="">-- Pilih Jabatan --</option>
                        ${jabatanOptions.map(j => `<option value="${j}" ${data.jabatan === j ? 'selected' : ''}>${j}</option>`).join('')}
                    </select>
                `}
            </div>
        </div>
        
        ${type === 'pemain' ? `
            <div class="mb-3">
                <label for="nomor_punggung" class="form-label">Nomor Punggung</label>
                <input type="number" class="form-control" id="nomor_punggung" name="nomor_punggung" value="${data.nomor_punggung || ''}" required>
            </div>
        ` : ''}

        <div class="mb-3">
            <label for="foto" class="form-label">Foto Terbaru (Maks 1MB)</label>
            <input class="form-control" type="file" id="foto" name="foto" accept="image/*" ${isNew ? 'required' : ''}>
            ${!isNew && data.url_foto ? `<img src="${data.url_foto}" class="img-thumbnail mt-2" style="max-height: 100px;">` : ''}
        </div>
    `;

    const title = `${isNew ? 'Tambah' : 'Edit'} ${type === 'pemain' ? 'Pemain' : 'Official'}`;
    const action = type === 'pemain' ? 'SAVE_PEMAIN_PRAKOMPETISI' : 'SAVE_OFFICIAL_PRAKOMPETISI';

    showModalForm(title, formHtml, async (e) => {
        // Gabungkan id_kompetisi ke params
        const params = { id_kompetisi: window.currentKompetisiId };
        
        await handleGenericFormSubmit(
            e, 
            action, 
            ['base64_foto'], 
            () => filterRegistrationData(window.currentKompetisiId) // Reload data setelah submit
        );
    });
}

function confirmDeletePrakompetisi(type, id, nama) {
    const action = type === 'pemain' ? 'SAVE_PEMAIN_PRAKOMPETISI' : 'SAVE_OFFICIAL_PRAKOMPETISI';
    
    showConfirmationModal(`Hapus ${type} ${nama}?`, async () => {
        const data = { action: 'DELETE', id: id };
        const result = await callAppsScript(action, { 
            data: JSON.stringify(data), 
            id_kompetisi: window.currentKompetisiId 
        });
        
        if (result && result.success) {
            showToast(result.message);
            filterRegistrationData(window.currentKompetisiId);
        }
    });
}


// =========================================================================
// Halaman Pengaturan (Settings - ADMIN_SISTEM ONLY)
// =========================================================================

function loadSettingsContent() {
    let html = `
        <h4 class="mb-3 text-primary"><i class="fas fa-cog me-2"></i> Pengaturan Aplikasi</h4>
        
        <div class="accordion" id="settingsAccordion">
            <!-- Manajemen Pengguna -->
            <div class="accordion-item card shadow-sm mb-3">
                <h2 class="accordion-header" id="headingUserlist">
                    <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseUserlist" aria-expanded="false" aria-controls="collapseUserlist">
                        <i class="fas fa-users-cog me-2"></i> Manajemen Pengguna
                    </button>
                </h2>
                <div id="collapseUserlist" class="accordion-collapse collapse" aria-labelledby="headingUserlist" data-bs-parent="#settingsAccordion">
                    <div class="accordion-body">
                        <button class="btn btn-sm btn-success mb-3" onclick="showUserlistForm()">
                            <i class="fas fa-plus-circle me-1"></i> Tambah Pengguna Baru
                        </button>
                        <div id="userlist-data-area"></div>
                    </div>
                </div>
            </div>

            <!-- Manajemen Klub -->
            <div class="accordion-item card shadow-sm mb-3">
                <h2 class="accordion-header" id="headingKlub">
                    <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseKlub" aria-expanded="false" aria-controls="collapseKlub">
                        <i class="fas fa-shield-alt me-2"></i> Manajemen Klub
                    </button>
                </h2>
                <div id="collapseKlub" class="accordion-collapse collapse" aria-labelledby="headingKlub" data-bs-parent="#settingsAccordion">
                    <div class="accordion-body">
                        <button class="btn btn-sm btn-success mb-3" onclick="showKlubForm()">
                            <i class="fas fa-plus-circle me-1"></i> Tambah Klub
                        </button>
                        <div id="klub-data-area"></div>
                    </div>
                </div>
            </div>

            <!-- Manajemen Kompetisi -->
            <div class="accordion-item card shadow-sm mb-3">
                <h2 class="accordion-header" id="headingKompetisi">
                    <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseKompetisi" aria-expanded="false" aria-controls="collapseKompetisi">
                        <i class="fas fa-trophy me-2"></i> Manajemen Kompetisi
                    </button>
                </h2>
                <div id="collapseKompetisi" class="accordion-collapse collapse" aria-labelledby="headingKompetisi" data-bs-parent="#settingsAccordion">
                    <div class="accordion-body">
                        <button class="btn btn-sm btn-success mb-3" onclick="showKompetisiForm()">
                            <i class="fas fa-plus-circle me-1"></i> Tambah Kompetisi
                        </button>
                        <div id="kompetisi-data-area"></div>
                    </div>
                </div>
            </div>
            
            <!-- Manajemen Banner -->
            <div class="accordion-item card shadow-sm mb-3">
                <h2 class="accordion-header" id="headingBanner">
                    <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseBanner" aria-expanded="false" aria-controls="collapseBanner">
                        <i class="fas fa-image me-2"></i> Manajemen Banner
                    </button>
                </h2>
                <div id="collapseBanner" class="accordion-collapse collapse" aria-labelledby="headingBanner" data-bs-parent="#settingsAccordion">
                    <div class="accordion-body">
                        <button class="btn btn-sm btn-success mb-3" onclick="showBannerForm()">
                            <i class="fas fa-plus-circle me-1"></i> Tambah Banner
                        </button>
                        <div id="banner-data-area"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
    contentDiv.innerHTML = html;
    
    // Tambahkan event listener untuk memuat data saat accordion dibuka
    document.getElementById('collapseUserlist').addEventListener('shown.bs.collapse', loadUserlistSetting);
    document.getElementById('collapseKlub').addEventListener('shown.bs.collapse', loadKlubSetting);
    document.getElementById('collapseKompetisi').addEventListener('shown.bs.collapse', loadKompetisiSetting);
    document.getElementById('collapseBanner').addEventListener('shown.bs.collapse', loadBannerSetting);

}


// --- CRUD KLUB (Setting) ---

async function loadKlubSetting() {
    const area = document.getElementById('klub-data-area');
    area.innerHTML = '<div class="text-center"><div class="spinner-border text-primary"></div></div>';
    
    const result = await callAppsScript('CRUD_KLUB', { data: JSON.stringify({ action: 'READ' }) });
    
    if (result && result.data) {
        window.globalKlubData = result.data; // Simpan untuk edit
        
        let html = `
            <div class="table-responsive-sm">
                <table class="table table-sm table-striped table-hover">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Nama Klub</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${result.data.map(item => `
                            <tr>
                                <td>${item.id}</td>
                                <td>${item.nama}</td>
                                <td>
                                    <button class="btn btn-sm btn-warning me-1" onclick="showKlubForm('${item.id}')"><i class="fas fa-edit"></i></button>
                                    <button class="btn btn-sm btn-danger" onclick="confirmDeleteKlub('${item.id}', '${item.nama}')"><i class="fas fa-trash-alt"></i></button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        area.innerHTML = html;
    } else {
        area.innerHTML = '<div class="alert alert-info">Belum ada data klub.</div>';
    }
}

function showKlubForm(id = null) {
    const isNew = id === null;
    const data = isNew ? {} : window.globalKlubData.find(item => item.id === id) || {};

    const formHtml = `
        <input type="hidden" name="action" value="${isNew ? 'CREATE' : 'UPDATE'}">
        <input type="hidden" name="id" value="${data.id || ''}">
        <div class="mb-3">
            <label for="nama" class="form-label">Nama Klub</label>
            <input type="text" class="form-control" id="nama" name="nama" value="${data.nama || ''}" required>
        </div>
        ${!isNew ? `<div class="mb-3"><label class="form-label">ID Klub</label><p class="form-control-static">${data.id}</p></div>` : ''}
    `;

    showModalForm(`${isNew ? 'Tambah' : 'Edit'} Klub`, formHtml, handleKlubFormSubmit);
}

async function handleKlubFormSubmit(e) {
    await handleGenericFormSubmit(e, 'CRUD_KLUB', [], loadKlubSetting);
}

function confirmDeleteKlub(id, nama) {
    showConfirmationModal(`Hapus Klub ${nama}?`, async () => {
        const data = { action: 'DELETE', id: id };
        const result = await callAppsScript('CRUD_KLUB', { data: JSON.stringify(data) });
        
        if (result && result.success) {
            showToast(result.message);
            loadKlubSetting();
        }
    });
}


// --- CRUD KOMPETISI (Setting) ---

async function loadKompetisiSetting() {
    const area = document.getElementById('kompetisi-data-area');
    area.innerHTML = '<div class="text-center"><div class="spinner-border text-primary"></div></div>';
    
    const result = await callAppsScript('CRUD_KOMPETISI', { data: JSON.stringify({ action: 'READ' }) });
    
    if (result && result.data) {
        window.globalKompetisiData = result.data;
        
        let html = `
            <div class="table-responsive-sm">
                <table class="table table-sm table-striped table-hover">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Nama</th>
                            <th>Tahun</th>
                            <th>Status</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${result.data.map(item => `
                            <tr>
                                <td>${item.id}</td>
                                <td>${item.nama}</td>
                                <td>${item.tahun || '-'}</td>
                                <td><span class="badge bg-${item.status === 'Aktif' ? 'success' : 'secondary'}">${item.status}</span></td>
                                <td>
                                    <button class="btn btn-sm btn-warning me-1" onclick="showKompetisiForm('${item.id}')"><i class="fas fa-edit"></i></button>
                                    <button class="btn btn-sm btn-danger" onclick="confirmDeleteKompetisi('${item.id}', '${item.nama}')"><i class="fas fa-trash-alt"></i></button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        area.innerHTML = html;
    } else {
        area.innerHTML = '<div class="alert alert-info">Belum ada data kompetisi.</div>';
    }
}

function showKompetisiForm(id = null) {
    const isNew = id === null;
    const data = isNew ? { status: 'Aktif' } : window.globalKompetisiData.find(item => item.id === id) || { status: 'Aktif' };

    const statusOptions = ['Aktif', 'Selesai', 'Ditunda'];

    const formHtml = `
        <input type="hidden" name="action" value="${isNew ? 'CREATE' : 'UPDATE'}">
        <input type="hidden" name="id" value="${data.id || ''}">
        <div class="mb-3">
            <label for="nama_kompetisi" class="form-label">Nama Kompetisi</label>
            <input type="text" class="form-control" id="nama_kompetisi" name="nama" value="${data.nama || ''}" required>
        </div>
        <div class="mb-3">
            <label for="tahun" class="form-label">Tahun</label>
            <input type="number" class="form-control" id="tahun" name="tahun" value="${data.tahun || new Date().getFullYear()}" required>
        </div>
        <div class="mb-3">
            <label for="status" class="form-label">Status</label>
            <select class="form-select" id="status" name="status" required>
                ${statusOptions.map(s => `<option value="${s}" ${data.status === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
        </div>
        ${!isNew ? `<div class="mb-3"><label class="form-label">ID Kompetisi</label><p class="form-control-static">${data.id}</p></div>` : ''}
    `;

    showModalForm(`${isNew ? 'Tambah' : 'Edit'} Kompetisi`, formHtml, handleKompetisiFormSubmit);
}

async function handleKompetisiFormSubmit(e) {
    await handleGenericFormSubmit(e, 'CRUD_KOMPETISI', [], loadKompetisiSetting);
}

function confirmDeleteKompetisi(id, nama) {
    showConfirmationModal(`Hapus Kompetisi ${nama}?`, async () => {
        const data = { action: 'DELETE', id: id };
        const result = await callAppsScript('CRUD_KOMPETISI', { data: JSON.stringify(data) });
        
        if (result && result.success) {
            showToast(result.message);
            loadKompetisiSetting();
        }
    });
}


// --- CRUD BANNER (Setting) ---

async function loadBannerSetting() {
    const area = document.getElementById('banner-data-area');
    area.innerHTML = '<div class="text-center"><div class="spinner-border text-primary"></div></div>';
    
    const result = await callAppsScript('GET_BANNER_LIST');
    
    if (result && result.data) {
        window.globalBannerData = result.data;
        
        let html = `
            <div class="table-responsive-sm">
                <table class="table table-sm table-striped table-hover">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Judul</th>
                            <th>Gambar</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${result.data.map(item => `
                            <tr>
                                <td>${item.id}</td>
                                <td>${item.judul}</td>
                                <td><img src="${item.url_gambar}" style="height: 50px; object-fit: cover; border-radius: 5px;" onerror="this.onerror=null; this.src='https://placehold.co/100x50/cccccc/333333?text=Tidak+Ada+Gambar';"></td>
                                <td>
                                    <button class="btn btn-sm btn-warning me-1" onclick="showBannerForm('${item.id}')"><i class="fas fa-edit"></i></button>
                                    <button class="btn btn-sm btn-danger" onclick="confirmDeleteBanner('${item.id}', '${item.judul}')"><i class="fas fa-trash-alt"></i></button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        area.innerHTML = html;
    } else {
        area.innerHTML = '<div class="alert alert-info">Belum ada data banner.</div>';
    }
}

function showBannerForm(id = null) {
    const isNew = id === null;
    const data = isNew ? {} : window.globalBannerData.find(item => item.id === id) || {};

    const formHtml = `
        <input type="hidden" name="action" value="${isNew ? 'CREATE' : 'UPDATE'}">
        <input type="hidden" name="id" value="${data.id || ''}">
        <div class="mb-3">
            <label for="judul_banner" class="form-label">Judul Banner</label>
            <input type="text" class="form-control" id="judul_banner" name="judul" value="${data.judul || ''}" required>
        </div>
        <div class="mb-3">
            <label for="gambar" class="form-label">File Gambar (Maks 1MB)</label>
            <input class="form-control" type="file" id="gambar" name="gambar" accept="image/*" ${isNew ? 'required' : ''}>
            ${!isNew && data.url_gambar ? `<img src="${data.url_gambar}" class="img-thumbnail mt-2" style="max-height: 100px;">` : ''}
        </div>
    `;

    showModalForm(`${isNew ? 'Tambah' : 'Edit'} Banner`, formHtml, handleBannerFormSubmit);
}

async function handleBannerFormSubmit(e) {
    await handleGenericFormSubmit(e, 'CRUD_BANNER', ['base64_gambar'], loadBannerSetting);
}

function confirmDeleteBanner(id, judul) {
    showConfirmationModal(`Hapus Banner ${judul}?`, async () => {
        const data = { action: 'DELETE', id: id };
        const result = await callAppsScript('CRUD_BANNER', { data: JSON.stringify(data) });
        
        if (result && result.success) {
            showToast(result.message);
            loadBannerSetting();
        }
    });
}


// --- CRUD USERLIST (Setting) ---

async function loadUserlistSetting() {
    const area = document.getElementById('userlist-data-area');
    area.innerHTML = '<div class="text-center"><div class="spinner-border text-primary"></div></div>';
    
    const result = await callAppsScript('GET_USERLIST');
    
    if (result && result.data) {
        window.globalUserlistData = result.data;
        
        let html = `
            <div class="table-responsive-sm">
                <table class="table table-sm table-striped table-hover">
                    <thead>
                        <tr>
                            <th>Username</th>
                            <th>Tipe</th>
                            <th>ID Klub</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${result.data.map(item => `
                            <tr>
                                <td>${item.username}</td>
                                <td>${item.type_users}</td>
                                <td>${item.id_klub || '-'}</td>
                                <td>
                                    <button class="btn btn-sm btn-warning me-1" onclick="showUserlistForm('${item.username}')"><i class="fas fa-edit"></i></button>
                                    <button class="btn btn-sm btn-danger" onclick="confirmDeleteUserlist('${item.username}')"><i class="fas fa-trash-alt"></i></button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        area.innerHTML = html;
    } else {
        area.innerHTML = '<div class="alert alert-info">Belum ada data pengguna.</div>';
    }
}

function showUserlistForm(username = null) {
    const isNew = username === null;
    const data = isNew ? {} : window.globalUserlistData.find(item => item.username === username) || {};

    const typeOptions = ['ADMIN_SISTEM', 'ADMIN_KLUB'];

    const formHtml = `
        <input type="hidden" name="action" value="${isNew ? 'CREATE' : 'UPDATE'}">
        <input type="hidden" name="old_username" value="${data.username || ''}">

        <div class="mb-3">
            <label for="username" class="form-label">Username</label>
            <input type="text" class="form-control" id="username" name="username" value="${data.username || ''}" ${isNew ? 'required' : 'readonly'}>
            ${!isNew ? `<small class="text-muted">Username tidak dapat diubah.</small>` : ''}
        </div>
        
        <div class="mb-3">
            <label for="password" class="form-label">Password ${isNew ? '(Wajib)' : '(Kosongkan jika tidak diubah)'}</label>
            <input type="password" class="form-control" id="password" name="password" ${isNew ? 'required' : ''}>
            ${!isNew ? `<small class="text-muted">Isi hanya jika ingin mengganti password.</small>` : ''}
        </div>

        <div class="mb-3">
            <label for="type_users" class="form-label">Tipe Pengguna</label>
            <select class="form-select" id="type_users" name="type_users" required>
                ${typeOptions.map(t => `<option value="${t}" ${data.type_users === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
        </div>

        <div class="mb-3">
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
    showConfirmationModal(`Hapus pengguna ${username}?`, async () => {
        const data = { action: 'DELETE', username: username };
        const result = await callAppsScript('CRUD_USERLIST', { data: JSON.stringify(data) });
        
        if (result && result.success) {
            showToast(result.message);
            loadUserlistSetting();
        }
    });
}


// --- INITIALIZATION ---
window.onload = checkAuth;
