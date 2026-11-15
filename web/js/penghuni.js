/**
 * ==========================================================
 * SmartKost Residence - Portal Penghuni Controller (penghuni.js)
 * Clean SaaS UI • Dynamic Bank & QRIS • Real-time Sync
 * Strict zero-emoji policy
 * ==========================================================
 */

let currentUser = null;
let userProfile = null;
let kosSettings = {
    nama_kos: 'SmartKost Residence',
    no_wa: '081234567890',
    alamat: '-',
    nama_bank: 'Bank BCA',
    no_rekening: '8720-1928-33',
    atas_nama_rekening: 'Pengelola SmartKost Residence',
    foto_qris: null
};

let currentUserTab = 'overview';
let currentTagihanFilter = 'Semua';
let userTagihanCache = [];
let userKeluhanCache = [];
let availableRoomsCache = [];

const USER_TAB_META = {
    overview: {
        title: 'Beranda Penghuni',
        subtitle: 'Ringkasan informasi kamar hunian, status tagihan bulanan, dan layanan perbaikan.'
    },
    tagihan: {
        title: 'Tagihan & Pembayaran Sewa',
        subtitle: 'Kelola invoice bulanan, transfer atau scan QRIS, dan cetak kuitansi resmi.'
    },
    keluhan: {
        title: 'Keluhan & Perbaikan Fasilitas',
        subtitle: 'Laporkan kendala fasilitas kamar dan pantau progres tindak lanjut teknisi.'
    },
    profil: {
        title: 'Profil & Keamanan Akun',
        subtitle: 'Perbarui biodata penghuni, foto profil, dan kata sandi akun Anda.'
    }
};

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', async () => {
    const session = getAuthSession();
    if (!session) {
        window.location.href = 'index.html';
        return;
    }
    if (session.role === 'admin') {
        window.location.href = 'admin.html';
        return;
    }

    currentUser = session;

    setupUserSidebarNav();
    setupUserModals();
    setupUserForms();

    await loadKosPaymentSettings();
    await refreshPortalState();

    // Auto-sinkronisasi ketika Admin mengubah pengaturan QRIS/Kamar/Verifikasi di tab lain
    window.addEventListener('storage', async (e) => {
        if (e.key === 'smartkost_settings_updated') {
            await loadKosPaymentSettings();
        } else if (e.key === 'smartkost_rooms_updated') {
            await refreshPortalState();
        }
    });

    window.addEventListener('focus', async () => {
        await loadKosPaymentSettings();
        await refreshPortalState();
    });
});

/* ==========================================================
   1. NAVIGASI SIDEBAR & MODAL HELPERS
   ========================================================== */
function setupUserSidebarNav() {
    document.querySelectorAll('.sidebar-link[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.getAttribute('data-tab');
            switchUserTab(tab);
        });
    });
}

async function switchUserTab(tabName) {
    if (!USER_TAB_META[tabName]) return;
    currentUserTab = tabName;

    document.querySelectorAll('.sidebar-link[data-tab]').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });

    document.querySelectorAll('.admin-tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === `tab-${tabName}`);
    });

    const titleEl = document.getElementById('topbar-page-title');
    const subEl = document.getElementById('topbar-page-subtitle');
    if (titleEl) titleEl.textContent = USER_TAB_META[tabName].title;
    if (subEl) subEl.textContent = USER_TAB_META[tabName].subtitle;

    document.getElementById('user-sidebar')?.classList.remove('open');

    if (tabName === 'overview') {
        await refreshPortalState();
    } else if (tabName === 'tagihan') {
        await loadKosPaymentSettings();
        await loadUserTagihan();
    } else if (tabName === 'keluhan') {
        await loadUserKeluhan();
    } else if (tabName === 'profil') {
        populateProfileForm();
    }
}

function toggleUserSidebar() {
    document.getElementById('user-sidebar')?.classList.toggle('open');
}

function handleUserThemeToggle() {
    toggleTheme();
}

function handleLogoutUser() {
    clearAuthSession();
    showToast('Anda telah keluar dari Portal Penghuni.', 'info');
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 500);
}

function setupUserModals() {
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal-backdrop');
            if (modal) modal.classList.remove('active');
        });
    });

    document.querySelectorAll('.modal-backdrop').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    });
}

function openModal(id) {
    document.getElementById(id)?.classList.add('active');
}

function closeModal(id) {
    document.getElementById(id)?.classList.remove('active');
}

function openImagePreview(base64Src, title = 'Pratinjau Dokumen') {
    if (!base64Src) {
        showToast('Gambar tidak tersedia.', 'warning');
        return;
    }
    document.getElementById('preview-img-title').textContent = title;
    document.getElementById('preview-img-el').src = base64Src;
    openModal('modal-image-preview');
}

/* ==========================================================
   2. PENGATURAN KOS, REKENING BANK & QRIS DINAMIS
   ========================================================== */
async function loadKosPaymentSettings() {
    try {
        const res = await eel.get_pengaturan()();
        if (res && res.status && res.data) {
            kosSettings = {
                ...kosSettings,
                ...res.data
            };
        }
    } catch (err) {
        console.warn('Gagal memuat pengaturan kos:', err);
    }

    // Update link WhatsApp pengelola
    const cleanWa = (kosSettings.no_wa || '081234567890').replace(/[^0-9]/g, '');
    const waNum = cleanWa.startsWith('0') ? '62' + cleanWa.slice(1) : cleanWa;
    const namaUser = userProfile?.nama_lengkap || currentUser?.nama_lengkap || 'Penghuni';
    const kamarLabel = userProfile?.nomor_kamar ? ` (Kamar ${userProfile.nomor_kamar})` : '';
    const waUrl = `https://wa.me/${waNum}?text=${encodeURIComponent(`Halo Pengelola ${kosSettings.nama_kos || 'SmartKost Residence'}, saya ${namaUser}${kamarLabel} ingin menanyakan informasi terkait hunian kos.`)}`;

    const btnWa1 = document.getElementById('btn-wa-pengelola');
    const btnWa2 = document.getElementById('btn-wa-unassigned');
    if (btnWa1) btnWa1.href = waUrl;
    if (btnWa2) btnWa2.href = waUrl;

    // Update kartu info rekening di Tab Tagihan & Modal Pembayaran
    const bankName = kosSettings.nama_bank || 'Bank BCA';
    const bankRek = kosSettings.no_rekening || '8720-1928-33';
    const bankHolder = kosSettings.atas_nama_rekening || 'Pengelola SmartKost Residence';

    const elInfoBankName = document.getElementById('info-bank-name');
    const elInfoBankRek = document.getElementById('info-bank-rek');
    const elInfoBankHolder = document.getElementById('info-bank-holder');
    if (elInfoBankName) elInfoBankName.textContent = `Transfer ${bankName}`;
    if (elInfoBankRek) elInfoBankRek.textContent = bankRek;
    if (elInfoBankHolder) elInfoBankHolder.textContent = bankHolder;

    const elGuideBankName = document.getElementById('guide-bank-name');
    const elGuideBankRek = document.getElementById('guide-bank-rek');
    const elGuideBankHolder = document.getElementById('guide-bank-holder');
    if (elGuideBankName) elGuideBankName.textContent = `TRANSFER ${bankName.toUpperCase()}`;
    if (elGuideBankRek) elGuideBankRek.textContent = bankRek;
    if (elGuideBankHolder) elGuideBankHolder.textContent = bankHolder;

    // Update info QRIS dinamis
    const qrisStatusEl = document.getElementById('info-qris-status');
    const qrisActionArea = document.getElementById('info-qris-action-area');
    const guideQrisContent = document.getElementById('guide-qris-content');

    const phoneHintSvg = `
        <svg class="qris-phone-hint" viewBox="0 0 24 36" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="3" y="2" width="18" height="32" rx="4"></rect>
            <line x1="9" y1="6" x2="15" y2="6"></line>
            <circle cx="12" cy="29" r="1.2" fill="currentColor"></circle>
            <path d="M8 14h2v2H8zM14 14h2v2h-2zM8 20h2v2H8zM14 20h2v2h-2z"></path>
        </svg>
    `;

    if (kosSettings.foto_qris) {
        if (qrisStatusEl) qrisStatusEl.textContent = 'Tersedia • Siap Scan QRIS';
        if (qrisActionArea) {
            qrisActionArea.innerHTML = `
                <div class="qris-visual-group">
                    <div class="qris-thumb-box" onclick="openQrisPreview()" title="Klik untuk memperbesar QRIS">
                        <img src="${kosSettings.foto_qris}" alt="QRIS Kos">
                    </div>
                    ${phoneHintSvg}
                </div>
                <button type="button" class="qris-cta-pill" onclick="openQrisPreview()">
                    <span>Lihat QRIS</span>
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                </button>
            `;
        }
        if (guideQrisContent) {
            guideQrisContent.innerHTML = `
                <span style="font-size:0.74rem;font-weight:800;color:#92400E;background:#FFF4D6;padding:4px 12px;border-radius:9999px;border:1px solid #FDE68A;">QRIS RESMI • ${escapeHtml(kosSettings.nama_kos || 'SmartKost Residence')}</span>
                <div class="qris-frame-stage" style="padding:10px;border-radius:16px;">
                    <div class="qris-corner tl"></div>
                    <div class="qris-corner tr"></div>
                    <div class="qris-corner bl"></div>
                    <div class="qris-corner br"></div>
                    <img src="${kosSettings.foto_qris}" alt="Barcode QRIS Kos" onclick="openQrisPreview()" title="Klik untuk memperbesar" style="width:190px;height:190px;object-fit:contain;display:block;border-radius:10px;cursor:zoom-in;">
                </div>
                <div style="font-size:0.84rem;font-weight:800;color:#111827;">a.n. ${escapeHtml(bankHolder)}</div>
                <span style="font-size:0.74rem;color:#64748B;">Klik QRIS untuk memperbesar, lalu unggah bukti bayar di bawah ini.</span>
            `;
        }
    } else {
        if (qrisStatusEl) qrisStatusEl.textContent = 'Belum Diatur oleh Admin';
        if (qrisActionArea) {
            qrisActionArea.innerHTML = `
                <div class="qris-visual-group">
                    <div class="qris-thumb-box" style="cursor:default;color:#94A3B8;" title="Menunggu Admin mengunggah gambar QRIS">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect><path d="M14 14h3v3h-3zM19 14h2v2h-2zM14 19h2v2h-2zM18 18h3v3h-3z"></path></svg>
                    </div>
                    ${phoneHintSvg}
                </div>
                <span class="badge badge-neutral" style="padding:8px 14px;">Belum Diatur</span>
            `;
        }
        if (guideQrisContent) {
            guideQrisContent.innerHTML = `
                <p style="font-size:0.82rem;color:var(--sk-text-muted);padding:10px;">
                    Kode gambar QRIS belum diunggah oleh Admin Pengelola. Silakan gunakan metode <strong>Transfer Bank (${escapeHtml(bankName)}: ${escapeHtml(bankRek)})</strong> atau hubungi Admin melalui WhatsApp.
                </p>
            `;
        }
    }
}

function openQrisPreview() {
    if (!kosSettings.foto_qris) {
        showToast('Kode QRIS belum tersedia.', 'warning');
        return;
    }

    const kosName = kosSettings.nama_kos || 'SmartKost Residence';
    const holderName = kosSettings.atas_nama_rekening || 'Pengelola SmartKost Residence';

    const elKosName = document.getElementById('qris-modal-kos-name');
    const elHolder = document.getElementById('qris-modal-holder');
    const elImg = document.getElementById('qris-modal-img');
    const elDownload = document.getElementById('qris-download-link');

    if (elKosName) elKosName.textContent = kosName;
    if (elHolder) elHolder.textContent = holderName;
    if (elImg) elImg.src = kosSettings.foto_qris;
    if (elDownload) {
        elDownload.href = kosSettings.foto_qris;
        elDownload.download = `QRIS-${kosName.replace(/\s+/g, '-')}.png`;
    }

    openModal('modal-qris-preview');
}

function copyRekeningKos() {
    const rek = kosSettings.no_rekening || '8720-1928-33';
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(rek).then(() => {
            showToast(`Nomor rekening ${rek} berhasil disalin.`, 'success');
        }).catch(() => {
            showToast(`Nomor Rekening: ${rek}`, 'info');
        });
    } else {
        showToast(`Nomor Rekening: ${rek}`, 'info');
    }
}

/* ==========================================================
   3. MUAT PROFIL & STATUS KAMAR PENGHUNI
   ========================================================== */
async function refreshPortalState() {
    try {
        const res = await eel.get_user_profile(currentUser.id)();
        if (res && res.status && res.data) {
            userProfile = res.data;
            // Sinkronkan ke localStorage session
            currentUser = {
                ...currentUser,
                nama_lengkap: userProfile.nama_lengkap,
                foto_profil: userProfile.foto_profil,
                penghuni_id: userProfile.penghuni_id,
                kamar_id: userProfile.kamar_id,
                nomor_kamar: userProfile.nomor_kamar
            };
            setAuthSession(currentUser);
        }
    } catch (err) {
        console.error('Gagal memuat profil penghuni:', err);
    }

    renderTopbarIdentity();
    populateProfileForm();
    await loadKosPaymentSettings();

    const activeView = document.getElementById('resident-active-view');
    const unassignedView = document.getElementById('resident-unassigned-view');

    if (userProfile && userProfile.penghuni_id && userProfile.kamar_id) {
        if (activeView) activeView.style.display = 'block';
        if (unassignedView) unassignedView.style.display = 'none';

        renderActiveRoomCard();
        await loadUserTagihan();
        await loadUserKeluhan();
    } else {
        if (activeView) activeView.style.display = 'none';
        if (unassignedView) unassignedView.style.display = 'block';

        await loadUnassignedState();
        await loadUserTagihan();
        await loadUserKeluhan();
    }
}

function renderTopbarIdentity() {
    const nama = userProfile?.nama_lengkap || currentUser?.nama_lengkap || 'Penghuni Kos';
    const initial = nama.trim().charAt(0).toUpperCase() || 'P';

    const nameEl = document.getElementById('user-display-name');
    const roleEl = document.getElementById('user-room-badge');
    const avatarBox = document.getElementById('user-avatar-box');

    if (nameEl) nameEl.textContent = nama;
    if (roleEl) {
        roleEl.textContent = userProfile?.nomor_kamar
            ? `Kamar ${userProfile.nomor_kamar} • ${userProfile.tipe_kamar || 'Aktif'}`
            : 'Calon Penghuni';
    }

    if (avatarBox) {
        if (userProfile?.foto_profil) {
            avatarBox.innerHTML = `<img src="${userProfile.foto_profil}" alt="${escapeHtml(nama)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        } else {
            avatarBox.textContent = initial;
        }
    }
}

function renderActiveRoomCard() {
    if (!userProfile) return;

    const nomor = userProfile.nomor_kamar || '-';
    const tipe = userProfile.tipe_kamar || 'Reguler';
    const lantai = userProfile.lantai || 1;
    const harga = userProfile.harga_sewa || 0;
    const luas = userProfile.luas_kamar || '3x4 m';
    const tglMasuk = userProfile.tgl_masuk_format || formatDateIndo(userProfile.tanggal_masuk);
    const deskripsi = userProfile.deskripsi_kamar || 'Unit kamar nyaman dengan fasilitas terawat.';
    const photoUrl = getRoomPhotoUrl({
        foto_kamar: userProfile.foto_kamar,
        tipe: tipe
    });

    // KPI Card 3
    const kpiRoom = document.getElementById('user-kpi-room');
    const kpiRoomMeta = document.getElementById('user-kpi-room-meta');
    if (kpiRoom) kpiRoom.textContent = `Kamar ${nomor}`;
    if (kpiRoomMeta) {
        kpiRoomMeta.innerHTML = `
            <svg class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.41 14.59L6.7 12.7l1.41-1.41 2.48 2.47 5.29-5.3 1.42 1.42-6.71 6.71z"></path></svg>
            <span>Tipe ${escapeHtml(tipe)} • Lantai ${lantai}</span>
        `;
    }

    // Banner sapaan
    const bannerTitle = document.getElementById('user-welcome-banner-title');
    if (bannerTitle) {
        bannerTitle.textContent = `Halo, ${userProfile.nama_lengkap || 'Penghuni'} (Kamar ${nomor})`;
    }

    // Detail Room Showcase
    const imgEl = document.getElementById('overview-room-photo');
    if (imgEl) imgEl.src = photoUrl;

    document.getElementById('overview-room-tipe').textContent = `Tipe ${tipe}`;
    document.getElementById('overview-room-status').textContent = userProfile.status_penghuni || 'Hunian Aktif';
    document.getElementById('overview-room-title').textContent = `Kamar ${nomor}`;
    document.getElementById('overview-room-desc').textContent = deskripsi;
    document.getElementById('overview-room-price').innerHTML = `${formatRupiah(harga)} <span>/bln</span>`;
    document.getElementById('overview-room-floor').textContent = `Lantai ${lantai}`;
    document.getElementById('overview-room-size').textContent = luas;
    document.getElementById('overview-room-checkin').textContent = tglMasuk;

    const fasBox = document.getElementById('overview-room-facilities');
    if (fasBox) {
        const items = (userProfile.fasilitas || '').split(',').map(s => s.trim()).filter(Boolean);
        if (items.length > 0) {
            fasBox.innerHTML = items.map(f => `
                <span class="resident-facility-chip">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    ${escapeHtml(f)}
                </span>
            `).join('');
        } else {
            fasBox.innerHTML = `<span style="font-size:0.8rem;color:var(--sk-text-muted);">Fasilitas standar kamar kos lengkap.</span>`;
        }
    }
}

/* ==========================================================
   4. STATE USER BELUM PUNYA KAMAR (KATALOG & STATUS BOOKING)
   ========================================================== */
async function loadUnassignedState() {
    // 1. Cek apakah user pernah mengajukan booking
    try {
        const resB = await eel.get_booking('Semua')();
        const cardHistory = document.getElementById('user-booking-history-card');
        const tbodyHistory = document.getElementById('user-booking-table-body');
        const namaUser = (userProfile?.nama_lengkap || currentUser?.nama_lengkap || '').trim().toLowerCase();

        if (resB && resB.status && Array.isArray(resB.data) && namaUser) {
            const myBookings = resB.data.filter(b => (b.nama_pemohon || '').trim().toLowerCase() === namaUser);
            if (myBookings.length > 0 && cardHistory && tbodyHistory) {
                cardHistory.style.display = 'block';
                tbodyHistory.innerHTML = myBookings.map(b => {
                    let badgeCls = 'badge-warning';
                    if (b.status === 'Disetujui') badgeCls = 'badge-success';
                    else if (b.status === 'Ditolak') badgeCls = 'badge-danger';
                    return `
                        <tr>
                            <td>${escapeHtml(b.waktu_pengajuan)}</td>
                            <td>
                                <strong>Kamar ${escapeHtml(b.nomor_kamar)}</strong><br>
                                <span style="font-size:0.76rem;color:var(--sk-text-muted);">${escapeHtml(b.tipe_kamar)} • ${formatRupiah(b.harga_sewa)}/bln</span>
                            </td>
                            <td>
                                ${escapeHtml(b.tgl_mulai_format)}<br>
                                <span style="font-size:0.76rem;color:var(--sk-text-muted);">Durasi: ${b.durasi_bulan} Bulan</span>
                            </td>
                            <td style="font-size:0.8rem;color:var(--sk-text-muted);">${escapeHtml(b.alasan_penolakan || b.catatan || '-')}</td>
                            <td><span class="badge ${badgeCls}">${escapeHtml(b.status)}</span></td>
                        </tr>
                    `;
                }).join('');
            } else if (cardHistory) {
                cardHistory.style.display = 'none';
            }
        }
    } catch (err) {
        console.warn('Gagal memeriksa riwayat booking user:', err);
    }

    // 2. Muat katalog kamar yang Tersedia (3-Column Horizontal Card)
    try {
        const resK = await eel.get_kamar(null, 'Tersedia', null, null)();
        const grid = document.getElementById('unassigned-rooms-grid');
        const countEl = document.getElementById('unassigned-available-count');
        availableRoomsCache = (resK && resK.status && Array.isArray(resK.data)) ? resK.data : [];

        if (countEl) countEl.textContent = `${availableRoomsCache.length} Unit Tersedia`;
        if (!grid) return;

        if (availableRoomsCache.length === 0) {
            grid.innerHTML = `
                <div style="grid-column:1/-1;text-align:center;padding:36px 20px;color:var(--sk-text-muted);">
                    Saat ini seluruh unit kamar sedang terisi. Silakan hubungi Pengelola Kos untuk informasi daftar tunggu.
                </div>
            `;
            return;
        }

        grid.innerHTML = availableRoomsCache.map(r => {
            const photoUrl = getRoomPhotoUrl(r);
            return `
                <div class="denah-room-card status-Tersedia">
                    <div class="denah-room-photo" onclick="openImagePreview('${photoUrl}', 'Foto Kamar ${escapeHtml(r.nomor_kamar)}')" title="Klik untuk melihat foto kamar">
                        <img src="${photoUrl}" alt="Kamar ${escapeHtml(r.nomor_kamar)}" loading="lazy">
                        <span class="denah-photo-badge status-Tersedia">Tersedia</span>
                    </div>
                    <div class="denah-room-body">
                        <div>
                            <div class="denah-room-top">
                                <div style="min-width:0;">
                                    <div class="denah-room-no">Kamar ${escapeHtml(r.nomor_kamar)}</div>
                                    <div class="denah-room-meta">${escapeHtml(r.tipe)} • Lt ${r.lantai} • ${escapeHtml(r.luas_kamar || '3x4 m')}</div>
                                </div>
                            </div>
                            <div class="denah-room-price">${formatRupiah(r.harga_sewa)} <span>/bln</span></div>
                        </div>
                        <div class="denah-card-actions">
                            <button type="button" class="denah-btn denah-btn-checkin" style="width:100%;" onclick="openUserBookingModal(${r.id})">Ajukan Sewa Kamar</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('Gagal memuat kamar tersedia:', err);
    }
}

function openUserBookingModal(kamarId) {
    const room = availableRoomsCache.find(r => r.id === kamarId);
    if (!room) return;

    document.getElementById('form-booking-user')?.reset();
    document.getElementById('user-booking-kamar-id').value = room.id;
    document.getElementById('user-booking-room-label').textContent = `Kamar ${room.nomor_kamar} • Tipe ${room.tipe} (${formatRupiah(room.harga_sewa)}/bln)`;
    document.getElementById('user-booking-nama').value = userProfile?.nama_lengkap || currentUser?.nama_lengkap || '';
    document.getElementById('user-booking-nohp').value = userProfile?.no_hp || '';
    document.getElementById('user-booking-pekerjaan').value = userProfile?.pekerjaan || '';
    document.getElementById('user-booking-asal').value = userProfile?.asal_kota || '';
    document.getElementById('user-booking-tgl').value = new Date().toISOString().split('T')[0];

    openModal('modal-booking-user');
}

/* ==========================================================
   5. TAGIHAN, PEMBAYARAN (TRANSFER / QRIS) & KUITANSI
   ========================================================== */
function setUserTagihanFilter(status) {
    currentTagihanFilter = status || 'Semua';
    document.querySelectorAll('#user-tagihan-filter-pills .filter-pill-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-status') === currentTagihanFilter);
    });
    renderUserTagihanTable();
}

async function loadUserTagihan() {
    const tbody = document.getElementById('user-tagihan-table-body');
    const recentBox = document.getElementById('overview-recent-tagihan');
    const badgeEl = document.getElementById('badge-unpaid-tagihan');

    if (!userProfile || !userProfile.penghuni_id) {
        userTagihanCache = [];
        if (badgeEl) badgeEl.style.display = 'none';
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--sk-text-muted);padding:28px;">Anda belum memiliki tagihan aktif karena belum terdaftar di unit kamar.</td></tr>`;
        }
        if (recentBox) {
            recentBox.innerHTML = `<div style="text-align:center;color:var(--sk-text-muted);padding:16px;font-size:0.84rem;">Belum ada data tagihan.</div>`;
        }
        return;
    }

    // Ambil seluruh tagihan penghuni untuk kalkulasi KPI dan daftar terbaru
    const resAll = await eel.get_tagihan('Semua', null, null, userProfile.penghuni_id)();
    const allBills = (resAll && resAll.status && Array.isArray(resAll.data)) ? resAll.data : [];
    userTagihanCache = allBills;

    // Hitung KPI Tagihan untuk Beranda Penghuni
    const unpaidBills = allBills.filter(t => t.status === 'Belum Bayar');
    const waitingBills = allBills.filter(t => t.status === 'Menunggu Konfirmasi');
    const paidBills = allBills.filter(t => t.status === 'Lunas');

    const unpaidTotal = unpaidBills.reduce((acc, t) => acc + (parseInt(t.total_bayar, 10) || 0), 0);
    const paidTotal = paidBills.reduce((acc, t) => acc + (parseInt(t.total_bayar, 10) || 0), 0);

    const kpiUnpaidEl = document.getElementById('user-kpi-unpaid');
    const kpiUnpaidSub = document.getElementById('user-kpi-unpaid-sub');
    const kpiPaidEl = document.getElementById('user-kpi-paid');
    const kpiPaidCount = document.getElementById('user-kpi-paid-count');

    if (kpiUnpaidEl) kpiUnpaidEl.textContent = formatRupiah(unpaidTotal);
    if (kpiUnpaidSub) {
        if (unpaidBills.length > 0) {
            kpiUnpaidSub.style.color = '#DC2626';
            kpiUnpaidSub.innerHTML = `
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                <span>${unpaidBills.length} tagihan menunggu pembayaran</span>
            `;
        } else if (waitingBills.length > 0) {
            kpiUnpaidSub.style.color = '#D97706';
            kpiUnpaidSub.innerHTML = `
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                <span>${waitingBills.length} pembayaran menunggu verifikasi Admin</span>
            `;
        } else {
            kpiUnpaidSub.style.color = 'var(--sk-green)';
            kpiUnpaidSub.innerHTML = `
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>Semua tagihan telah lunas</span>
            `;
        }
    }

    if (kpiPaidEl) kpiPaidEl.textContent = formatRupiah(paidTotal);
    if (kpiPaidCount) kpiPaidCount.textContent = `${paidBills.length} kuitansi terverifikasi lunas`;

    // Update badge sidebar
    if (badgeEl) {
        if (unpaidBills.length > 0) {
            badgeEl.textContent = unpaidBills.length;
            badgeEl.style.display = 'inline-flex';
        } else {
            badgeEl.style.display = 'none';
        }
    }

    // Render 3 Tagihan Terbaru di Beranda
    if (recentBox) {
        if (allBills.length === 0) {
            recentBox.innerHTML = `<div style="text-align:center;color:var(--sk-text-muted);padding:16px;font-size:0.84rem;">Belum ada riwayat tagihan.</div>`;
        } else {
            recentBox.innerHTML = allBills.slice(0, 3).map(t => {
                let badgeCls = 'badge-danger';
                if (t.status === 'Lunas') badgeCls = 'badge-success';
                else if (t.status === 'Menunggu Konfirmasi') badgeCls = 'badge-warning';

                let actionBtn = '';
                if (t.status === 'Belum Bayar') {
                    actionBtn = `<button type="button" class="btn btn-primary btn-xs" onclick="openBayarUserModal(${t.id})">Bayar</button>`;
                } else if (t.status === 'Lunas') {
                    actionBtn = `<button type="button" class="btn btn-secondary btn-xs" onclick="openKuitansiModal(${t.id})">Kuitansi</button>`;
                } else {
                    actionBtn = `<span class="badge ${badgeCls}">${escapeHtml(t.status)}</span>`;
                }

                return `
                    <div class="resident-mini-item">
                        <div class="resident-mini-item-left">
                            <span class="resident-mini-title">Periode ${escapeHtml(t.bulan_tahun)} • ${formatRupiah(t.total_bayar)}</span>
                            <span class="resident-mini-sub">${escapeHtml(t.kode_invoice)} • Jatuh Tempo: ${escapeHtml(t.tgl_jatuh_tempo || t.jatuh_tempo)}</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;">
                            ${t.status !== 'Menunggu Konfirmasi' ? `<span class="badge ${badgeCls}">${escapeHtml(t.status)}</span>` : ''}
                            ${actionBtn}
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    renderUserTagihanTable();
}

function renderUserTagihanTable() {
    const tbody = document.getElementById('user-tagihan-table-body');
    if (!tbody) return;

    const allBills = userTagihanCache || [];
    let filtered = allBills;
    if (currentTagihanFilter === 'Terlambat') {
        filtered = allBills.filter(t => t.is_telat && t.status !== 'Lunas');
    } else if (currentTagihanFilter !== 'Semua') {
        filtered = allBills.filter(t => t.status === currentTagihanFilter);
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--sk-text-muted);padding:28px;">Tidak ada data tagihan untuk filter ini.</td></tr>`;
        return;
    }

    const docSvg = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm1 7V3.5L19.5 9H15zM8 13h8v1.8H8V13zm0 3.5h5v1.8H8v-1.8z"/></svg>`;
    const printIcon = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;

    tbody.innerHTML = filtered.map(t => {
        let statusCls = 'inv-status-unpaid';
        if (t.status === 'Lunas') statusCls = 'inv-status-lunas';
        else if (t.status === 'Menunggu Konfirmasi') statusCls = 'inv-status-waiting';

        const metodeText = t.metode_pembayaran
            ? `Metode: ${escapeHtml(t.metode_pembayaran)}`
            : (t.status === 'Belum Bayar' ? 'Menunggu pembayaran' : 'Diverifikasi sistem');

        return `
            <tr>
                <td>
                    <div class="inv-cell-code">
                        <span class="inv-doc-icon">${docSvg}</span>
                        <span class="inv-code-text">${escapeHtml(t.kode_invoice)}</span>
                    </div>
                </td>
                <td style="font-weight:600;color:var(--sk-text);">${escapeHtml(t.bulan_tahun)}</td>
                <td style="font-size:0.82rem;color:var(--sk-text);">
                    <div>Sewa ${formatRupiah(t.nominal)}</div>
                    <div style="font-size:0.75rem;color:${t.denda > 0 ? '#DC2626' : 'var(--sk-text-muted)'};font-weight:${t.denda > 0 ? '600' : '400'};">
                        ${t.denda > 0 ? `Denda ${formatRupiah(t.denda)}` : 'Tanpa Denda'}
                    </div>
                </td>
                <td><strong style="font-size:0.92rem;color:var(--sk-text);">${formatRupiah(t.total_bayar)}</strong></td>
                <td style="font-size:0.84rem;color:var(--sk-text);">
                    <div>${escapeHtml(t.tgl_jatuh_tempo || t.jatuh_tempo)}</div>
                    ${t.is_telat ? `<span class="badge badge-danger" style="font-size:0.66rem;padding:2px 8px;margin-top:3px;display:inline-block;">Telat ${t.hari_telat} Hari</span>` : ''}
                </td>
                <td>
                    <div class="inv-status-dot-row ${statusCls}">
                        <span class="inv-dot"></span>
                        <span>${escapeHtml(t.status)}</span>
                    </div>
                    <div class="inv-method-sub">${metodeText}</div>
                </td>
                <td style="text-align:right;">
                    <div class="table-actions" style="justify-content:flex-end;">
                        ${t.status === 'Belum Bayar' ? `
                            <button type="button" class="inv-btn-pay" onclick="openBayarUserModal(${t.id})">Bayar</button>
                        ` : ''}
                        ${t.status === 'Menunggu Konfirmasi' ? `
                            ${t.bukti_transfer ? `<button type="button" class="inv-btn-print" onclick="openUserBukti(${t.id})">Bukti</button>` : ''}
                            <button type="button" class="inv-btn-pay" onclick="openBayarUserModal(${t.id})">Ubah</button>
                        ` : ''}
                        ${t.status === 'Lunas' ? `
                            <button type="button" class="inv-btn-print" onclick="openKuitansiModal(${t.id})">
                                ${printIcon}
                                <span>Cetak</span>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function handleQuickPayTrigger() {
    const unpaid = userTagihanCache.find(t => t.status === 'Belum Bayar');
    if (unpaid) {
        openBayarUserModal(unpaid.id);
    } else {
        switchUserTab('tagihan');
    }
}

function openBayarUserModal(tagihanId) {
    const t = userTagihanCache.find(x => x.id === tagihanId);
    if (!t) return;

    document.getElementById('form-bayar-penghuni')?.reset();
    document.getElementById('user-bayar-tagihan-id').value = t.id;
    document.getElementById('modal-bayar-inv-subtitle').textContent = `${t.kode_invoice} • Kamar ${t.nomor_kamar}`;
    document.getElementById('modal-bayar-periode-label').textContent = `Periode Sewa: ${t.bulan_tahun}`;
    document.getElementById('modal-bayar-total-nominal').textContent = formatRupiah(t.total_bayar);

    const previewWrap = document.getElementById('user-bayar-bukti-preview-wrap');
    if (previewWrap) previewWrap.style.display = 'none';

    handlePaymentMethodSwitch();
    openModal('modal-bayar-penghuni');
}

function handlePaymentMethodSwitch() {
    const metode = document.getElementById('user-bayar-metode')?.value || 'Transfer Bank';
    const boxBank = document.getElementById('payment-guide-bank');
    const boxQris = document.getElementById('payment-guide-qris');
    const boxTunai = document.getElementById('payment-guide-tunai');

    if (boxBank) boxBank.style.display = metode === 'Transfer Bank' ? 'block' : 'none';
    if (boxQris) boxQris.style.display = metode === 'QRIS' ? 'block' : 'none';
    if (boxTunai) boxTunai.style.display = metode === 'Tunai' ? 'block' : 'none';
}

function openUserBukti(tagihanId) {
    const t = userTagihanCache.find(x => x.id === tagihanId);
    openImagePreview(t?.bukti_transfer, `Bukti Pembayaran: ${t?.kode_invoice || ''}`);
}

async function openKuitansiModal(tagihanId) {
    const res = await eel.get_kuitansi(tagihanId)();
    if (!res.status || !res.data) {
        showToast(res.pesan || 'Gagal memuat kuitansi.', 'error');
        return;
    }

    const d = res.data;
    document.getElementById('rec-nama-kos').textContent = d.nama_kos || 'SmartKost Residence';
    document.getElementById('rec-alamat-kos').textContent = d.alamat_kos || '-';
    document.getElementById('rec-wa-kos').textContent = d.no_wa_kos || '-';
    document.getElementById('rec-status').textContent = (d.status || 'LUNAS').toUpperCase();
    document.getElementById('rec-kode-inv').textContent = d.kode_invoice;
    document.getElementById('rec-nama-penghuni').textContent = `${d.nama_penghuni} (${d.no_hp})`;
    document.getElementById('rec-kamar').textContent = `Kamar ${d.nomor_kamar} - Tipe ${d.tipe_kamar} (Lantai ${d.lantai})`;
    document.getElementById('rec-periode').textContent = d.bulan_tahun;
    document.getElementById('rec-tgl-metode').textContent = `${d.tgl_bayar_format} • ${d.metode_pembayaran || 'Transfer Bank'}`;
    document.getElementById('rec-rincian-nominal').textContent = `Sewa Pokok: ${formatRupiah(d.nominal)} + Denda: ${formatRupiah(d.denda)}`;
    document.getElementById('rec-total-bayar').textContent = formatRupiah(d.total_bayar);
    document.getElementById('rec-catatan').textContent = d.catatan || 'Pembayaran sewa kos lunas';

    openModal('modal-kuitansi');
}

/* ==========================================================
   6. KELUHAN & PERBAIKAN FASILITAS
   ========================================================== */
async function loadUserKeluhan() {
    const tbody = document.getElementById('user-keluhan-table-body');
    const recentBox = document.getElementById('overview-recent-keluhan');
    const badgeEl = document.getElementById('badge-active-keluhan-user');

    if (!userProfile || !userProfile.penghuni_id) {
        userKeluhanCache = [];
        if (badgeEl) badgeEl.style.display = 'none';
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--sk-text-muted);padding:28px;">Fitur pelaporan keluhan aktif setelah Anda terdaftar di unit kamar.</td></tr>`;
        }
        if (recentBox) {
            recentBox.innerHTML = `<div style="text-align:center;color:var(--sk-text-muted);padding:16px;font-size:0.84rem;">Belum ada tiket keluhan.</div>`;
        }
        return;
    }

    const filterStatus = document.getElementById('filter-user-keluhan-status')?.value || 'Semua';
    const resAll = await eel.get_keluhan('Semua', userProfile.penghuni_id)();
    const allTickets = (resAll && resAll.status && Array.isArray(resAll.data)) ? resAll.data : [];
    userKeluhanCache = allTickets;

    const activeTickets = allTickets.filter(k => k.status !== 'Selesai');
    if (badgeEl) {
        if (activeTickets.length > 0) {
            badgeEl.textContent = activeTickets.length;
            badgeEl.style.display = 'inline-flex';
        } else {
            badgeEl.style.display = 'none';
        }
    }

    // Render di Beranda
    if (recentBox) {
        if (allTickets.length === 0) {
            recentBox.innerHTML = `<div style="text-align:center;color:var(--sk-text-muted);padding:16px;font-size:0.84rem;">Tidak ada keluhan fasilitas. Kamar dalam kondisi baik.</div>`;
        } else {
            recentBox.innerHTML = allTickets.slice(0, 3).map(c => {
                let stCls = 'badge-warning';
                if (c.status === 'Diproses') stCls = 'badge-info';
                else if (c.status === 'Selesai') stCls = 'badge-success';

                return `
                    <div class="resident-mini-item">
                        <div class="resident-mini-item-left">
                            <span class="resident-mini-title">${escapeHtml(c.judul)}</span>
                            <span class="resident-mini-sub">${escapeHtml(c.waktu_lapor)} • Tindak Lanjut: ${escapeHtml(c.tindakan || 'Menunggu pemeriksaan')}</span>
                        </div>
                        <span class="badge ${stCls}">${escapeHtml(c.status)}</span>
                    </div>
                `;
            }).join('');
        }
    }

    // Filter untuk tabel di Tab Keluhan
    const filtered = filterStatus === 'Semua'
        ? allTickets
        : allTickets.filter(c => c.status === filterStatus);

    if (!tbody) return;
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--sk-text-muted);padding:28px;">Belum ada laporan keluhan untuk filter ini.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(c => {
        let prioCls = 'badge-info';
        if (c.prioritas === 'Tinggi') prioCls = 'badge-danger';
        else if (c.prioritas === 'Sedang') prioCls = 'badge-warning';

        let stCls = 'badge-warning';
        if (c.status === 'Diproses') stCls = 'badge-info';
        else if (c.status === 'Selesai') stCls = 'badge-success';

        return `
            <tr>
                <td style="white-space:nowrap;font-size:0.8rem;color:var(--sk-text-muted);">${escapeHtml(c.waktu_lapor)}</td>
                <td style="max-width:300px;">
                    <strong>${escapeHtml(c.judul)}</strong>
                    <p style="font-size:0.8rem;color:var(--sk-text-muted);margin-top:2px;">${escapeHtml(c.deskripsi)}</p>
                    ${c.foto_keluhan ? `<button type="button" class="btn btn-secondary btn-xs" style="margin-top:6px;" onclick="openUserKeluhanFoto(${c.id})">Lihat Foto</button>` : ''}
                </td>
                <td><span class="badge ${prioCls}">${escapeHtml(c.prioritas)}</span></td>
                <td style="font-size:0.82rem;color:var(--sk-text);">
                    ${escapeHtml(c.tindakan || 'Menunggu pemeriksaan petugas kos')}
                </td>
                <td><span class="badge ${stCls}">${escapeHtml(c.status)}</span></td>
            </tr>
        `;
    }).join('');
}

function openLaporKeluhanModal() {
    if (!userProfile || !userProfile.penghuni_id || !userProfile.kamar_id) {
        showToast('Anda harus terdaftar di unit kamar aktif terlebih dahulu untuk melaporkan keluhan.', 'warning');
        return;
    }
    document.getElementById('form-lapor-keluhan')?.reset();
    openModal('modal-lapor-keluhan');
}

function openUserKeluhanFoto(id) {
    const c = userKeluhanCache.find(x => x.id === id);
    openImagePreview(c?.foto_keluhan, `Foto Keluhan: ${c?.judul || ''}`);
}

/* ==========================================================
   7. PROFIL & KEAMANAN AKUN PENGHUNI
   ========================================================== */
function populateProfileForm() {
    if (!userProfile && !currentUser) return;
    const nama = userProfile?.nama_lengkap || currentUser?.nama_lengkap || '';
    const username = userProfile?.username || currentUser?.username || '';
    const kamarInfo = userProfile?.nomor_kamar
        ? `Kamar ${userProfile.nomor_kamar} (${userProfile.tipe_kamar || 'Reguler'} • Lantai ${userProfile.lantai || 1})`
        : 'Belum Terdaftar di Kamar Aktif';

    const fUsername = document.getElementById('profil-username');
    const fKamar = document.getElementById('profil-kamar-info');
    const fNama = document.getElementById('profil-nama');
    const fNohp = document.getElementById('profil-nohp');
    const fPekerjaan = document.getElementById('profil-pekerjaan');
    const fAsal = document.getElementById('profil-asal');
    const avatarCircle = document.getElementById('profil-avatar-preview');

    if (fUsername) fUsername.value = username;
    if (fKamar) fKamar.value = kamarInfo;
    if (fNama) fNama.value = nama;
    if (fNohp) fNohp.value = userProfile?.no_hp || '';
    if (fPekerjaan) fPekerjaan.value = userProfile?.pekerjaan || '';
    if (fAsal) fAsal.value = userProfile?.asal_kota || '';

    if (avatarCircle) {
        if (userProfile?.foto_profil) {
            avatarCircle.innerHTML = `<img src="${userProfile.foto_profil}" alt="${escapeHtml(nama)}">`;
        } else {
            avatarCircle.textContent = (nama.trim().charAt(0) || 'P').toUpperCase();
        }
    }
}

/* ==========================================================
   8. FORM SUBMIT HANDLERS
   ========================================================== */
function setupUserForms() {
    // Live preview bukti pembayaran
    document.getElementById('user-bayar-bukti-file')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        const wrap = document.getElementById('user-bayar-bukti-preview-wrap');
        const img = document.getElementById('user-bayar-bukti-preview');
        if (file && wrap && img) {
            const b64 = await fileToBase64(file);
            img.src = b64;
            wrap.style.display = 'block';
        } else if (wrap) {
            wrap.style.display = 'none';
        }
    });

    // Live preview foto profil
    document.getElementById('profil-foto-file')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        const avatarCircle = document.getElementById('profil-avatar-preview');
        if (file && avatarCircle) {
            const b64 = await fileToBase64(file);
            avatarCircle.innerHTML = `<img src="${b64}" alt="Preview Profil">`;
        }
    });

    // 1. Submit Pembayaran Tagihan oleh Penghuni
    document.getElementById('form-bayar-penghuni')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const tagihanId = parseInt(document.getElementById('user-bayar-tagihan-id').value, 10);
        const metode = document.getElementById('user-bayar-metode').value;
        const catatan = document.getElementById('user-bayar-catatan').value.trim();
        const file = document.getElementById('user-bayar-bukti-file').files[0];

        if (!file) {
            showToast('Mohon unggah foto bukti transfer / pembayaran terlebih dahulu.', 'warning');
            return;
        }

        const btnSubmit = document.getElementById('btn-submit-bayar-user');
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.textContent = 'Mengirim...';
        }

        try {
            const buktiB64 = await fileToBase64(file);
            const namaUser = userProfile?.nama_lengkap || currentUser?.nama_lengkap || 'Penghuni';
            const res = await eel.bayar_tagihan(tagihanId, metode, buktiB64, catatan, 'penghuni', namaUser)();
            showToast(res.pesan, res.status ? 'success' : 'error');
            if (res.status) {
                closeModal('modal-bayar-penghuni');
                await loadUserTagihan();
            }
        } catch (err) {
            showToast(`Gagal mengirim bukti pembayaran: ${err}`, 'error');
        } finally {
            if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.textContent = 'Kirim Bukti Pembayaran';
            }
        }
    });

    // 2. Submit Laporan Keluhan Baru
    document.getElementById('form-lapor-keluhan')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!userProfile?.penghuni_id || !userProfile?.kamar_id) {
            showToast('Data kamar aktif tidak ditemukan.', 'error');
            return;
        }

        const judul = document.getElementById('lapor-judul').value.trim();
        const prioritas = document.getElementById('lapor-prioritas').value;
        const deskripsi = document.getElementById('lapor-deskripsi').value.trim();
        const file = document.getElementById('lapor-foto-file').files[0];
        const fotoB64 = file ? await fileToBase64(file) : null;

        const res = await eel.lapor_keluhan(
            userProfile.penghuni_id,
            userProfile.kamar_id,
            judul,
            deskripsi,
            prioritas,
            fotoB64,
            userProfile.nama_lengkap || 'Penghuni'
        )();

        showToast(res.pesan, res.status ? 'success' : 'error');
        if (res.status) {
            closeModal('modal-lapor-keluhan');
            await loadUserKeluhan();
        }
    });

    // 3. Submit Permohonan Booking (untuk akun yang belum punya kamar)
    document.getElementById('form-booking-user')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const kamarId = parseInt(document.getElementById('user-booking-kamar-id').value, 10);
        const nama = document.getElementById('user-booking-nama').value.trim();
        const noHp = document.getElementById('user-booking-nohp').value.trim();
        const pekerjaan = document.getElementById('user-booking-pekerjaan').value.trim();
        const asal = document.getElementById('user-booking-asal').value.trim();
        const tglMulai = document.getElementById('user-booking-tgl').value;
        const durasi = parseInt(document.getElementById('user-booking-durasi').value, 10) || 1;
        const catatan = document.getElementById('user-booking-catatan').value.trim();
        const file = document.getElementById('user-booking-ktp').files[0];
        const ktpB64 = file ? await fileToBase64(file) : null;

        const res = await eel.ajukan_booking(
            kamarId,
            nama,
            noHp,
            pekerjaan,
            asal,
            tglMulai,
            durasi,
            catatan,
            ktpB64
        )();

        showToast(res.pesan, res.status ? 'success' : 'error');
        if (res.status) {
            closeModal('modal-booking-user');
            await loadUnassignedState();
        }
    });

    // 4. Submit Perubahan Biodata & Foto Profil
    document.getElementById('form-profil-penghuni')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nama = document.getElementById('profil-nama').value.trim();
        const nohp = document.getElementById('profil-nohp').value.trim();
        const pekerjaan = document.getElementById('profil-pekerjaan').value.trim();
        const asal = document.getElementById('profil-asal').value.trim();
        const file = document.getElementById('profil-foto-file').files[0];
        const fotoB64 = file ? await fileToBase64(file) : null;

        const resUser = await eel.update_user_profile(currentUser.id, nama, fotoB64)();
        if (userProfile?.penghuni_id) {
            await eel.ubah_penghuni(
                userProfile.penghuni_id,
                nama,
                nohp,
                pekerjaan,
                asal,
                currentUser.username || 'penghuni'
            )();
        }

        showToast(resUser.pesan || 'Biodata berhasil diperbarui.', resUser.status ? 'success' : 'error');
        if (resUser.status) {
            const fileInput = document.getElementById('profil-foto-file');
            if (fileInput) fileInput.value = '';
            await refreshPortalState();
        }
    });

    // 5. Submit Ganti Password
    document.getElementById('form-password-penghuni')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const lama = document.getElementById('user-pass-lama').value;
        const baru = document.getElementById('user-pass-baru').value;
        const konfirmasi = document.getElementById('user-pass-konfirmasi').value;

        if (baru !== konfirmasi) {
            showToast('Konfirmasi password baru tidak cocok.', 'warning');
            return;
        }

        const res = await eel.ganti_password(currentUser.id, lama, baru)();
        showToast(res.pesan, res.status ? 'success' : 'error');
        if (res.status) {
            e.target.reset();
        }
    });
}

