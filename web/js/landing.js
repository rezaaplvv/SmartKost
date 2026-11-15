/**
 * ==========================================================
 * SmartKost Pro - Dynamic Landing Page Controller
 * Strict no-emoji policy: Clean professional UI with SVG icons
 * ==========================================================
 */

let allRooms = [];
let currentFilter = 'Semua';
let searchQuery = '';
let selectedFacility = 'Semua';
let selectedRoomForBooking = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Setup navbar scroll transition
    setupNavbarScroll();

    // Cek status sesi yang tersimpan
    checkExistingSession();

    // Muat data profil kos dan katalog kamar
    await loadKosProfile();
    await loadRoomCatalog();

    // Setup event listener filter dan pencarian
    setupCatalogFilters();
    setupModals();
    setupForms();

    // Auto-sinkronisasi jika Admin memperbarui kamar/foto dari tab Admin Console
    window.addEventListener('storage', (e) => {
        if (e.key === 'smartkost_rooms_updated') {
            loadRoomCatalog();
        }
    });
    window.addEventListener('focus', () => {
        loadRoomCatalog();
    });
});

/**
 * Mengatur tampilan navbar agar transparan di atas hero dan solid saat di-scroll
 */
function setupNavbarScroll() {
    const navbar = document.getElementById('main-navbar');
    if (!navbar) return;

    const navLinks = document.querySelectorAll('#nav-links-pill a');
    const sections = [
        { id: 'beranda', el: document.getElementById('beranda') },
        { id: 'katalog', el: document.getElementById('katalog') },
        { id: 'kontak', el: document.getElementById('kontak') }
    ].filter(s => s.el);

    const setActiveLink = (hash) => {
        navLinks.forEach(a => {
            a.classList.toggle('active', a.getAttribute('href') === hash);
        });
    };

    navLinks.forEach(a => {
        a.addEventListener('click', () => {
            setActiveLink(a.getAttribute('href'));
        });
    });

    const toggleScrolled = () => {
        if (window.scrollY > 30) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }

        // Scroll-spy aktif untuk pill navigasi
        const atBottom = (window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - 40);
        if (atBottom) {
            setActiveLink('#kontak');
            return;
        }
        const scrollPos = window.scrollY + 140;
        let currentId = '#beranda';
        for (const sec of sections) {
            if (scrollPos >= sec.el.offsetTop) {
                currentId = `#${sec.id}`;
            }
        }
        setActiveLink(currentId);
    };

    toggleScrolled();
    window.addEventListener('scroll', toggleScrolled, { passive: true });
}

/**
 * Memeriksa apakah user sudah login sebelumnya
 */
function checkExistingSession() {
    const user = getAuthSession();
    const navActions = document.getElementById('nav-auth-actions');
    if (!navActions) return;

    if (user && user.role) {
        const portalUrl = user.role === 'admin' ? 'admin.html' : 'penghuni.html';
        const roleLabel = user.role === 'admin' ? 'Dashboard Admin' : 'Portal Penghuni';

        navActions.innerHTML = `
            <a href="${portalUrl}" class="btn btn-primary btn-sm">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                ${roleLabel}
            </a>
            <button onclick="handleLogout()" class="btn btn-secondary btn-sm" title="Keluar">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                Keluar
            </button>
        `;
    }
}

function handleLogout() {
    clearAuthSession();
    showToast('Sesi Anda telah diakhiri.', 'info');
    setTimeout(() => window.location.reload(), 600);
}

/**
 * Memuat konfigurasi profil kos dari database via Eel
 */
async function loadKosProfile() {
    try {
        const res = await eel.get_pengaturan()();
        if (res.status && res.data) {
            const d = res.data;
            document.querySelectorAll('.app-nama-kos').forEach(el => el.textContent = d.nama_kos || 'Kost Cemara');
            document.querySelectorAll('.app-tagline').forEach(el => el.textContent = d.tagline || 'Hunian Terbaik untuk Mahasiswa');
            document.querySelectorAll('.app-deskripsi').forEach(el => el.textContent = d.deskripsi || '');
            document.querySelectorAll('.app-alamat').forEach(el => el.textContent = d.alamat || '');

            const waLinks = document.querySelectorAll('.app-wa-link');
            const cleanWa = (d.no_wa || '081234567890').replace(/[^0-9]/g, '');
            const waUrl = `https://wa.me/62${cleanWa.startsWith('0') ? cleanWa.slice(1) : cleanWa}?text=Halo%20Pengelola%20Kost%20Cemara,%20saya%20tertarik%20dengan%20kamar%20kos`;
            waLinks.forEach(link => link.setAttribute('href', waUrl));

            if (d.foto_banner) {
                const bannerContainer = document.getElementById('hero-banner-box');
                if (bannerContainer) {
                    bannerContainer.innerHTML = `<img src="${d.foto_banner}" alt="Banner Kos" style="width:100%;height:100%;object-fit:cover;">`;
                }
            }
        }
    } catch (err) {
        console.warn('Gagal memuat profil kos:', err);
    }
}

/**
 * Memuat katalog kamar dan statistik ketersediaan
 */
async function loadRoomCatalog() {
    try {
        // Ambil statistik kamar untuk kartu Hero
        const resStats = await eel.get_kamar_stats()();
        if (resStats.status && resStats.data) {
            const st = resStats.data;
            const elTersedia = document.getElementById('stat-kamar-tersedia');
            const elTotal = document.getElementById('stat-total-kamar');
            const elOkupansi = document.getElementById('stat-okupansi');

            if (elTersedia) elTersedia.textContent = st.kamar_tersedia;
            if (elTotal) elTotal.textContent = st.total_kamar;
            if (elOkupansi) elOkupansi.textContent = `${st.persen_okupansi}%`;

            const heroBadge = document.getElementById('hero-tersedia-badge');
            if (heroBadge) {
                heroBadge.textContent = `${st.kamar_tersedia} Kamar Tersedia Siap Huni`;
            }
        }

        // Ambil daftar seluruh kamar
        const resKamar = await eel.get_kamar()();
        if (resKamar.status && resKamar.data) {
            allRooms = resKamar.data;
            renderRoomCards();
        } else {
            renderEmptyCatalog('Belum ada data kamar terdaftar di sistem.');
        }
    } catch (err) {
        console.error('Gagal mengambil data katalog kamar:', err);
        renderEmptyCatalog('Gagal terhubung ke database. Pastikan server MySQL aktif.');
    }
}

/**
 * Menyaring dan merender kartu kamar sesuai filter aktif
 */
function renderRoomCards() {
    const container = document.getElementById('room-grid-container');
    if (!container) return;

    let filtered = allRooms.filter(room => {
        // Filter Tab
        if (currentFilter === 'Tersedia' && room.status !== 'Tersedia') return false;
        if (currentFilter === 'Lantai 1' && room.lantai !== 1) return false;
        if (currentFilter === 'Lantai 2' && room.lantai !== 2) return false;
        if (currentFilter === 'Reguler' && room.tipe !== 'Reguler') return false;
        if (currentFilter === 'VIP' && room.tipe !== 'VIP') return false;
        if (currentFilter === 'Eksklusif' && room.tipe !== 'Eksklusif') return false;

        // Facility Filter from Hero Search Bar
        if (selectedFacility && selectedFacility !== 'Semua') {
            const fStr = (room.fasilitas || '').toLowerCase();
            if (!fStr.includes(selectedFacility.toLowerCase())) return false;
        }

        // Search Query
        if (searchQuery.trim() !== '') {
            const q = searchQuery.toLowerCase();
            const matchNo = room.nomor_kamar.toLowerCase().includes(q);
            const matchFasilitas = (room.fasilitas || '').toLowerCase().includes(q);
            const matchTipe = room.tipe.toLowerCase().includes(q);
            if (!matchNo && !matchFasilitas && !matchTipe) return false;
        }

        return true;
    });

    if (filtered.length === 0) {
        renderEmptyCatalog('Tidak ada kamar yang sesuai dengan kriteria filter.');
        return;
    }

    container.innerHTML = filtered.map(room => {
        const isTersedia = room.status === 'Tersedia';
        const statusPillClass = isTersedia ? 'room-pill-available' : 'room-pill-unavailable';
        const statusLabel = isTersedia ? 'Tersedia' : 'Tidak Tersedia';
        const statusIconSvg = isTersedia
            ? '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
            : '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>';

        // Gambar kamar dinamis dari database (fallback otomatis ke foto tipe kamar)
        const roomPhotoUrl = getRoomPhotoUrl(room);
        const imgHtml = `<img src="${roomPhotoUrl}" alt="Kamar ${room.nomor_kamar}">`;

        return `
            <div class="room-card">
                <div class="room-img-wrapper">
                    ${imgHtml}
                    <div class="room-status-badge">
                        <span class="room-pill-badge ${statusPillClass}">
                            ${statusIconSvg}
                            ${statusLabel}
                        </span>
                    </div>
                </div>

                <div class="room-body">
                    <h3 class="room-number">Kamar ${room.nomor_kamar}</h3>
                    <div class="room-price">
                        ${formatRupiah(room.harga_sewa)} <span>/ bln</span>
                    </div>

                    <div class="room-meta">
                        <span class="room-meta-item">
                            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"></path><path d="M9 21H3v-6"></path><path d="M21 3l-7 7"></path><path d="M3 21l7-7"></path></svg>
                            ${room.luas_kamar || '3 x 4 m'}
                        </span>
                        <span class="room-meta-sep">|</span>
                        <span class="room-meta-item">
                            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                            ${room.tipe} &bull; Lt. ${room.lantai}
                        </span>
                    </div>

                    <div class="room-footer">
                        <button class="btn btn-detail btn-sm" onclick="showRoomDetailModal(${room.id})">
                            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            Detail
                        </button>
                        ${isTersedia ? `
                            <button class="btn btn-primary btn-sm" onclick="openBookingModal(${room.id})">
                                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7.5" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
                                Sewa Kamar
                            </button>
                        ` : `
                            <button class="btn btn-secondary btn-sm" disabled style="opacity:0.65;cursor:not-allowed;">
                                Tidak Tersedia
                            </button>
                        `}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderEmptyCatalog(message) {
    const container = document.getElementById('room-grid-container');
    if (!container) return;
    container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align:center; padding: 60px 20px; background:var(--bg-surface); border:1px dashed var(--border-color); border-radius:var(--radius-lg);">
            <svg class="icon-xl" style="color:var(--text-muted); margin-bottom:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"></circle><line x1="8" y1="12" x2="16" y2="12"></line></svg>
            <h4 style="font-size:1.1rem; color:var(--text-main); margin-bottom:6px;">Tidak Ada Kamar</h4>
            <p style="color:var(--text-muted); font-size:0.9rem;">${message}</p>
        </div>
    `;
}

/**
 * Setup toolbar filter tab dan search input
 */
function setupCatalogFilters() {
    const filterButtons = document.querySelectorAll('.filter-tab');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.getAttribute('data-filter') || 'Semua';
            renderRoomCards();
        });
    });

    const heroInput = document.getElementById('hero-search-input');
    if (heroInput) {
        heroInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.trim();
            renderRoomCards();
        });
        heroInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleHeroSearch();
            }
        });
    }

    const heroFacility = document.getElementById('hero-facility-select');
    if (heroFacility) {
        heroFacility.addEventListener('change', () => {
            handleHeroSearch();
        });
    }
}

/**
 * Handler tombol Cari Kamar dari Hero Search Bar
 */
function handleHeroSearch() {
    const heroInput = document.getElementById('hero-search-input');
    const heroFacility = document.getElementById('hero-facility-select');

    if (heroInput) {
        searchQuery = heroInput.value.trim();
    }

    if (heroFacility) {
        selectedFacility = heroFacility.value;
    }

    renderRoomCards();

    const catalogSection = document.getElementById('katalog');
    if (catalogSection) {
        catalogSection.scrollIntoView({ behavior: 'smooth' });
    }
}

/**
 * Setup Modal Dialog Controllers
 */
function setupModals() {
    // Tombol close modal
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal-backdrop');
            if (modal) modal.classList.remove('active');
        });
    });

    // Klik di area backdrop luar untuk menutup
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    });

    // Preview File Upload KTP
    const ktpInput = document.getElementById('booking-ktp-file');
    const ktpPreview = document.getElementById('booking-ktp-preview');
    if (ktpInput && ktpPreview) {
        ktpInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                const b64 = await fileToBase64(file);
                ktpPreview.src = b64;
                ktpPreview.style.display = 'block';
            } else {
                ktpPreview.style.display = 'none';
            }
        });
    }
}

/**
 * Membuka Modal Detail Kamar
 */
function showRoomDetailModal(roomId) {
    const room = allRooms.find(r => r.id === roomId);
    if (!room) return;

    const modal = document.getElementById('modal-room-detail');
    if (!modal) return;

    const imgContainer = document.getElementById('detail-room-img-box');
    if (imgContainer) {
        const roomPhotoUrl = getRoomPhotoUrl(room);
        imgContainer.innerHTML = `<img src="${roomPhotoUrl}" alt="Kamar ${room.nomor_kamar}" style="width:100%;height:100%;object-fit:cover;">`;
    }

    document.getElementById('detail-room-title').textContent = `Kamar ${room.nomor_kamar} (Lantai ${room.lantai})`;
    document.getElementById('detail-room-tipe').textContent = room.tipe;
    document.getElementById('detail-room-harga').textContent = `${formatRupiah(room.harga_sewa)} / bulan`;
    document.getElementById('detail-room-luas').textContent = room.luas_kamar || '3x4 meter';
    document.getElementById('detail-room-status').textContent = room.status;
    document.getElementById('detail-room-desc').textContent = room.deskripsi || 'Kamar nyaman dan bersih dengan fasilitas lengkap.';

    const fasContainer = document.getElementById('detail-room-fasilitas');
    if (fasContainer) {
        const list = (room.fasilitas || '').split(',').map(f => f.trim()).filter(Boolean);
        fasContainer.innerHTML = list.map(f => `
            <div style="display:flex;align-items:center;gap:8px;font-size:0.9rem;padding:6px 0;">
                <svg class="icon" style="color:var(--success);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                ${f}
            </div>
        `).join('') || '<p style="color:var(--text-muted);">Tidak ada rincian fasilitas.</p>';
    }

    const btnBookingAction = document.getElementById('detail-room-action-btn');
    if (btnBookingAction) {
        if (room.status === 'Tersedia') {
            btnBookingAction.style.display = 'inline-flex';
            btnBookingAction.onclick = () => {
                modal.classList.remove('active');
                openBookingModal(room.id);
            };
        } else {
            btnBookingAction.style.display = 'none';
        }
    }

    modal.classList.add('active');
}

/**
 * Membuka Modal Permohonan Booking
 */
function openBookingModal(roomId) {
    const room = allRooms.find(r => r.id === roomId);
    if (!room) return;

    selectedRoomForBooking = room;
    const modal = document.getElementById('modal-booking');
    if (!modal) return;

    document.getElementById('booking-room-label').textContent = `Kamar ${room.nomor_kamar} - Tipe ${room.tipe} (${formatRupiah(room.harga_sewa)}/bln)`;
    document.getElementById('booking-room-id').value = room.id;

    // Set tanggal default hari ini
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('booking-tgl-mulai').value = today;

    // Reset preview foto KTP
    const ktpPreview = document.getElementById('booking-ktp-preview');
    if (ktpPreview) ktpPreview.style.display = 'none';

    modal.classList.add('active');
}

/**
 * Membuka Modal Login
 */
function openLoginModal() {
    const modal = document.getElementById('modal-login');
    if (modal) {
        document.getElementById('login-form').reset();
        modal.classList.add('active');
    }
}

/**
 * Quick Fill Akun Demo untuk Pengujian
 */
function quickFillDemo(role) {
    const uInput = document.getElementById('login-username');
    const pInput = document.getElementById('login-password');
    if (role === 'admin') {
        uInput.value = 'admin';
        pInput.value = 'admin123';
    } else {
        uInput.value = 'budi';
        pInput.value = 'user123';
    }
}

/**
 * Setup Submit Form Booking & Login
 */
function setupForms() {
    // Form Booking
    const formBooking = document.getElementById('form-booking');
    if (formBooking) {
        formBooking.addEventListener('submit', async (e) => {
            e.preventDefault();

            const roomId = parseInt(document.getElementById('booking-room-id').value, 10);
            const nama = document.getElementById('booking-nama').value.trim();
            const noHp = document.getElementById('booking-nohp').value.trim();
            const pekerjaan = document.getElementById('booking-pekerjaan').value.trim();
            const asalKota = document.getElementById('booking-asal').value.trim();
            const tglMulai = document.getElementById('booking-tgl-mulai').value;
            const durasi = parseInt(document.getElementById('booking-durasi').value, 10) || 1;
            const catatan = document.getElementById('booking-catatan').value.trim();

            const ktpFile = document.getElementById('booking-ktp-file').files[0];
            let fotoKtpBase64 = null;
            if (ktpFile) {
                fotoKtpBase64 = await fileToBase64(ktpFile);
            }

            const btnSubmit = document.getElementById('btn-submit-booking');
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = `Mengirim...`;

            try {
                const res = await eel.ajukan_booking(
                    roomId, nama, noHp, pekerjaan, asalKota, tglMulai, durasi, catatan, fotoKtpBase64
                )();

                if (res.status) {
                    showToast(res.pesan, 'success');
                    document.getElementById('modal-booking').classList.remove('active');
                    formBooking.reset();
                    await loadRoomCatalog();
                } else {
                    showToast(res.pesan, 'error');
                }
            } catch (err) {
                showToast(`Gagal mengirim permohonan sewa: ${err}`, 'error');
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = `
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    Kirim Permohonan Sewa
                `;
            }
        });
    }

    // Form Login
    const formLogin = document.getElementById('login-form');
    if (formLogin) {
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();

            const username = document.getElementById('login-username').value.trim();
            const password = document.getElementById('login-password').value.trim();

            const btnLogin = document.getElementById('btn-submit-login');
            btnLogin.disabled = true;
            btnLogin.innerHTML = `Memverifikasi...`;

            try {
                const res = await eel.login(username, password)();
                if (res.status && res.user) {
                    setAuthSession(res.user);
                    showToast(`Login berhasil. Mengalihkan ke ${res.user.role}...`, 'success');

                    setTimeout(() => {
                        if (res.user.role === 'admin') {
                            window.location.href = 'admin.html';
                        } else {
                            window.location.href = 'penghuni.html';
                        }
                    }, 800);
                } else {
                    showToast(res.pesan || 'Username atau password salah.', 'error');
                }
            } catch (err) {
                showToast(`Kesalahan proses login: ${err}`, 'error');
            } finally {
                btnLogin.disabled = false;
                btnLogin.innerHTML = `
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>
                    Masuk ke Sistem
                `;
            }
        });
    }

    // Form Registrasi Penghuni Baru
    const formRegister = document.getElementById('register-form');
    if (formRegister) {
        formRegister.addEventListener('submit', async (e) => {
            e.preventDefault();

            const username = document.getElementById('reg-username').value.trim();
            const password = document.getElementById('reg-password').value.trim();
            const nama = document.getElementById('reg-nama').value.trim();
            const noHp = document.getElementById('reg-nohp').value.trim();

            const btnReg = document.getElementById('btn-submit-register');
            btnReg.disabled = true;
            btnReg.innerHTML = 'Mendaftarkan...';

            try {
                const res = await eel.register(username, password, nama, noHp)();
                if (res.status) {
                    showToast(res.pesan, 'success');
                    switchAuthTab('login');
                    document.getElementById('login-username').value = username;
                    document.getElementById('login-password').value = password;
                } else {
                    showToast(res.pesan, 'error');
                }
            } catch (err) {
                showToast(`Gagal mendaftar: ${err}`, 'error');
            } finally {
                btnReg.disabled = false;
                btnReg.innerHTML = 'Daftar Akun Baru';
            }
        });
    }
}

/**
 * Switch antara form login dan register di dalam modal
 */
function switchAuthTab(tab) {
    const boxLogin = document.getElementById('auth-box-login');
    const boxRegister = document.getElementById('auth-box-register');
    const title = document.getElementById('modal-auth-title');

    if (tab === 'register') {
        boxLogin.style.display = 'none';
        boxRegister.style.display = 'block';
        if (title) title.textContent = 'Registrasi Penghuni Baru';
    } else {
        boxRegister.style.display = 'none';
        boxLogin.style.display = 'block';
        if (title) title.textContent = 'Masuk ke SmartKost Pro';
    }
}

