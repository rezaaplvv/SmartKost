/**
 * ==========================================================
 * Kost Cemara / SmartKost Pro - Admin Console Controller
 * Strict no-emoji policy: SVG icons & clean structured UI
 * ==========================================================
 */

let currentAdmin = null;
let currentTab = 'overview';
let roomViewMode = 'denah';
let roomsCache = [];
let bookingsCache = [];
let penghuniCache = [];
let tagihanCache = [];
let pengeluaranCache = [];
let keluhanCache = [];

// Chart.js instances
let cashflowChart = null;
let okupansiChart = null;
let pengeluaranChart = null;

const TAB_META = {
    overview: {
        title: 'Dashboard Analitik',
        subtitle: 'Ringkasan operasional, analisa, dan laporan bisnis secara real-time.'
    },
    kamar: {
        title: 'Denah & Manajemen Kamar',
        subtitle: 'Kelola unit kamar per lantai, harga sewa, fasilitas, dan status ketersediaan'
    },
    booking: {
        title: 'Permohonan Booking Online',
        subtitle: 'Verifikasi pendaftaran calon penghuni yang masuk melalui landing page'
    },
    penghuni: {
        title: 'Data Penghuni Kos',
        subtitle: 'Kelola penghuni aktif, proses check-in, mutasi kamar, hingga check-out alumni'
    },
    tagihan: {
        title: 'Tagihan & Pembayaran',
        subtitle: 'Terbitkan tagihan bulanan massal, verifikasi bukti bayar, dan cetak kuitansi resmi'
    },
    pengeluaran: {
        title: 'Pengeluaran Operasional',
        subtitle: 'Catat biaya listrik, air, internet, kebersihan, dan pemeliharaan gedung'
    },
    keluhan: {
        title: 'Keluhan & Perbaikan',
        subtitle: 'Pantau dan tindak lanjuti tiket laporan kerusakan fasilitas dari penghuni'
    },
    laporan: {
        title: 'Ekspor Laporan & Log Aktivitas',
        subtitle: 'Unduh rekap keuangan Excel/CSV via Pandas dan pantau riwayat sistem'
    },
    pengaturan: {
        title: 'Pengaturan Profil Kos',
        subtitle: 'Sesuaikan identitas kos, kontak WhatsApp, tarif denda, dan keamanan akun'
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Validasi sesi Admin
    const user = getAuthSession();
    if (!user || user.role !== 'admin') {
        window.location.href = 'index.html';
        return;
    }
    currentAdmin = user;

    // Set identitas Admin di Topbar
    const rawName = user.nama_lengkap || user.username || 'Administrator Utama';
    const displayName = rawName === 'Administrator' ? 'Administrator Utama' : rawName;
    const elName = document.getElementById('admin-display-name');
    const elAvatar = document.getElementById('admin-avatar-initial');
    if (elName) elName.textContent = displayName;
    if (elAvatar) elAvatar.textContent = displayName.charAt(0).toUpperCase();

    // 2. Setup UI listeners & Modals
    setupSidebarNavigation();
    setupModals();
    setupAdminForms();

    // 3. Muat data awal dashboard
    await Promise.all([
        loadKosSettings(),
        loadOverviewData()
    ]);
});

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function adminUsername() {
    return (currentAdmin && currentAdmin.username) ? currentAdmin.username : 'admin';
}

function toggleSidebar() {
    const sb = document.getElementById('admin-sidebar');
    if (sb) sb.classList.toggle('open');
}

function handleAdminThemeToggle() {
    toggleTheme();
    if (currentTab === 'overview') {
        loadOverviewCharts();
    }
}

function handleLogout() {
    clearAuthSession();
    showToast('Sesi Admin telah diakhiri.', 'info');
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 500);
}

/* ==========================================================
   NAVIGASI SIDEBAR & TAB CONTROLLER
   ========================================================== */
function setupSidebarNavigation() {
    document.querySelectorAll('.sidebar-link[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-tab');
            switchAdminTab(target);
            const sb = document.getElementById('admin-sidebar');
            if (sb && sb.classList.contains('open')) sb.classList.remove('open');
        });
    });
}

async function switchAdminTab(tabName) {
    currentTab = tabName;

    // Update sidebar active state
    document.querySelectorAll('.sidebar-link[data-tab]').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });

    // Update panel visibility
    document.querySelectorAll('.admin-tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === `tab-${tabName}`);
    });

    // Update topbar header
    const meta = TAB_META[tabName] || TAB_META.overview;
    const titleEl = document.getElementById('topbar-page-title');
    const subEl = document.getElementById('topbar-page-subtitle');
    if (titleEl) titleEl.textContent = meta.title;
    if (subEl) subEl.textContent = meta.subtitle;

    // Muat data sesuai tab
    if (tabName === 'overview') await loadOverviewData();
    else if (tabName === 'kamar') await loadRoomsAdmin();
    else if (tabName === 'booking') await loadBookingsAdmin();
    else if (tabName === 'penghuni') await loadPenghuniAdmin();
    else if (tabName === 'tagihan') await loadTagihanAdmin();
    else if (tabName === 'pengeluaran') await loadPengeluaranAdmin();
    else if (tabName === 'keluhan') await loadKeluhanAdmin();
    else if (tabName === 'laporan') await loadLogsAdmin();
    else if (tabName === 'pengaturan') await loadKosSettings();
}

/* ==========================================================
   MODALS & IMAGE PREVIEW CONTROLLER
   ========================================================== */
function setupModals() {
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
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
}

function openImagePreview(src, title = 'Pratinjau Dokumen') {
    if (!src) {
        showToast('Tidak ada file gambar yang tersimpan.', 'warning');
        return;
    }
    document.getElementById('preview-img-title').textContent = title;
    document.getElementById('preview-img-el').src = src;
    openModal('modal-image-preview');
}

/* ==========================================================
   1. DASHBOARD OVERVIEW & ANALITIK PANDAS + CHART.JS
   ========================================================== */
async function loadOverviewData() {
    await Promise.all([
        loadKpiCards(),
        loadOverviewCharts(),
        loadOverviewActionList()
    ]);
}

async function loadKpiCards() {
    try {
        const res = await eel.get_kpi()();
        if (!res.status || !res.data) return;
        const d = res.data;

        const setText = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        setText('kpi-pemasukan', formatRupiah(d.pemasukan_bulan_ini));
        setText('kpi-laba', formatRupiah(d.laba_bersih_bulan_ini));
        setText('kpi-pengeluaran', formatRupiah(d.pengeluaran_bulan_ini));
        setText('kpi-okupansi', `${d.okupansi_rate}%`);
        setText('kpi-kamar-terisi', d.kamar_terisi);
        setText('kpi-kamar-tersedia', d.kamar_tersedia);
        setText('kpi-penghuni-aktif', d.penghuni_aktif ?? d.kamar_terisi);
        setText('kpi-tunggakan', formatRupiah(d.total_tunggakan));

        // Update Donut Card B summary numbers
        setText('donut-okupansi-pct', `${Math.round(d.okupansi_rate || 0)}%`);
        setText('legend-kamar-kosong', d.kamar_tersedia);
        setText('legend-kamar-terisi', d.kamar_terisi);

        const growthEl = document.getElementById('kpi-growth-text');
        if (growthEl) {
            const g = Number(d.growth_pemasukan) || 0;
            const arrowSvg = g >= 0
                ? `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>`
                : `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>`;
            growthEl.style.color = g >= 0 ? '#16A34A' : '#DC2626';
            growthEl.innerHTML = `${arrowSvg}<span>${Math.abs(g)}% dari bulan lalu</span>`;
        }

        const cashflowStatusEl = document.getElementById('kpi-cashflow-status');
        if (cashflowStatusEl) {
            const laba = Number(d.laba_bersih_bulan_ini) || 0;
            cashflowStatusEl.classList.remove('negative', 'neutral');
            if (laba > 0) {
                cashflowStatusEl.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.41 14.59L6.7 12.7l1.41-1.41 2.48 2.47 5.29-5.3 1.42 1.42-6.71 6.71z"></path></svg><span>Cashflow Positif</span>`;
            } else if (laba < 0) {
                cashflowStatusEl.classList.add('negative');
                cashflowStatusEl.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"></path></svg><span>Cashflow Defisit</span>`;
            } else {
                cashflowStatusEl.classList.add('neutral');
                cashflowStatusEl.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4 11H8v-2h8v2z"></path></svg><span>Cashflow Seimbang</span>`;
            }
        }

        // Update Sidebar Badges
        const badgeBk = document.getElementById('badge-pending-booking');
        if (badgeBk) {
            badgeBk.textContent = d.pending_booking;
            badgeBk.style.display = d.pending_booking > 0 ? 'inline-flex' : 'none';
        }
        const badgeKl = document.getElementById('badge-active-keluhan');
        if (badgeKl) {
            badgeKl.textContent = d.active_keluhan;
            badgeKl.style.display = d.active_keluhan > 0 ? 'inline-flex' : 'none';
        }
    } catch (err) {
        console.error('Gagal memuat KPI:', err);
    }
}

async function loadOverviewCharts() {
    if (typeof Chart === 'undefined') return;

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#CBD5E1' : '#64748B';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(226, 232, 240, 0.7)';
    const tahun = document.getElementById('chart-cashflow-year')?.value || '2026';

    try {
        // 1. Card A — Chart Cashflow 12 Bulan (Kuning untuk Pemasukan, Abu-abu untuk Pengeluaran)
        const resCf = await eel.get_chart_cashflow(tahun)();
        if (resCf.status && resCf.data) {
            const ctx = document.getElementById('canvas-cashflow').getContext('2d');
            if (cashflowChart) cashflowChart.destroy();
            cashflowChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: resCf.data.labels,
                    datasets: [
                        {
                            label: 'Pemasukan',
                            data: resCf.data.pemasukan,
                            backgroundColor: '#FFC928',
                            hoverBackgroundColor: '#F5B800',
                            borderRadius: 6,
                            barPercentage: 0.68,
                            categoryPercentage: 0.72
                        },
                        {
                            label: 'Pengeluaran',
                            data: resCf.data.pengeluaran,
                            backgroundColor: isDark ? '#334155' : '#E2E8F0',
                            hoverBackgroundColor: '#CBD5E1',
                            borderRadius: 6,
                            barPercentage: 0.68,
                            categoryPercentage: 0.72
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                            align: 'end',
                            labels: {
                                usePointStyle: true,
                                pointStyle: 'circle',
                                boxWidth: 8,
                                color: textColor,
                                font: { family: 'Plus Jakarta Sans', size: 11, weight: '600' }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: (ctxItem) => `${ctxItem.dataset.label}: ${formatRupiah(ctxItem.raw || 0)}`
                            }
                        }
                    },
                    scales: {
                        x: {
                            ticks: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 11 } },
                            grid: { display: false },
                            border: { display: false }
                        },
                        y: {
                            beginAtZero: true,
                            ticks: {
                                color: textColor,
                                font: { family: 'Plus Jakarta Sans', size: 11 },
                                callback: (v) => v >= 1000000 ? 'Rp ' + (v / 1000000).toFixed(1) + 'jt' : 'Rp ' + (v / 1000).toFixed(0) + 'rb'
                            },
                            grid: { color: gridColor },
                            border: { display: false }
                        }
                    }
                }
            });
        }

        // 2. Card B — Donut Chart Okupansi Kamar + Breakdown per Tipe
        const resOk = await eel.get_chart_okupansi_tipe()();
        if (resOk.status && resOk.data) {
            const labels = resOk.data.labels || [];
            const terisiArr = resOk.data.terisi || [];
            const totalArr = resOk.data.total || [];

            const totalTerisi = terisiArr.reduce((acc, n) => acc + (Number(n) || 0), 0);
            const totalUnit = totalArr.reduce((acc, n) => acc + (Number(n) || 0), 0);
            const totalKosong = Math.max(0, totalUnit - totalTerisi);
            const pct = totalUnit > 0 ? Math.round((totalTerisi / totalUnit) * 100) : 0;

            const pctEl = document.getElementById('donut-okupansi-pct');
            if (pctEl) pctEl.textContent = `${pct}%`;
            const kosongEl = document.getElementById('legend-kamar-kosong');
            if (kosongEl) kosongEl.textContent = totalKosong;
            const terisiEl = document.getElementById('legend-kamar-terisi');
            if (terisiEl) terisiEl.textContent = totalTerisi;

            const breakdownEl = document.getElementById('legend-tipe-breakdown');
            if (breakdownEl && labels.length > 0) {
                breakdownEl.innerHTML = labels.map((lbl, idx) => `
                    <div class="donut-tipe-row">
                        <span>Tipe ${escapeHtml(lbl)}</span>
                        <strong>${terisiArr[idx] || 0}/${totalArr[idx] || 0} Terisi</strong>
                    </div>
                `).join('');
            }

            const ctx2 = document.getElementById('canvas-okupansi').getContext('2d');
            if (okupansiChart) okupansiChart.destroy();
            okupansiChart = new Chart(ctx2, {
                type: 'doughnut',
                data: {
                    labels: ['Kamar Terisi', 'Kamar Kosong'],
                    datasets: [
                        {
                            data: totalUnit > 0 ? [totalTerisi, totalKosong] : [0, 1],
                            backgroundColor: [
                                '#FFC928',
                                isDark ? '#334155' : '#FFF1C2'
                            ],
                            borderWidth: 0,
                            hoverOffset: 3
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '74%',
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (ctxItem) => `${ctxItem.label}: ${ctxItem.raw} Unit`
                            }
                        }
                    }
                }
            });
        }

        // 3. Chart Pengeluaran per Kategori
        const resEx = await eel.get_chart_pengeluaran('Semua')();
        if (resEx.status && resEx.data && resEx.data.labels.length > 0) {
            const ctx3 = document.getElementById('canvas-pengeluaran').getContext('2d');
            if (pengeluaranChart) pengeluaranChart.destroy();
            pengeluaranChart = new Chart(ctx3, {
                type: 'doughnut',
                data: {
                    labels: resEx.data.labels,
                    datasets: [{
                        data: resEx.data.series,
                        backgroundColor: ['#FFC928', '#F59E0B', '#16A34A', '#0EA5E9', '#64748B', '#FDE68A'],
                        borderWidth: 2,
                        borderColor: isDark ? '#1E293B' : '#FFFFFF'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '66%',
                    plugins: {
                        legend: { position: 'right', labels: { color: textColor, boxWidth: 12 } }
                    }
                }
            });
        }
    } catch (err) {
        console.error('Gagal merender grafik:', err);
    }
}

async function loadOverviewActionList() {
    const container = document.getElementById('overview-action-list');
    if (!container) return;

    try {
        const [resBk, resTg] = await Promise.all([
            eel.get_booking('Pending')(),
            eel.get_tagihan('Menunggu Konfirmasi', null, null, null)()
        ]);

        const items = [];
        if (resBk.status && resBk.data) {
            resBk.data.slice(0, 3).forEach(b => {
                items.push(`
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:var(--bg-surface-alt);border:1px solid var(--border-color);border-radius:10px;">
                        <div>
                            <strong style="font-size:0.88rem;display:block;">Booking Baru: ${escapeHtml(b.nama_pemohon)}</strong>
                            <span style="font-size:0.78rem;color:var(--text-muted);">Kamar ${escapeHtml(b.nomor_kamar)} • Masuk ${escapeHtml(b.tanggal_mulai)} (${b.durasi_bulan} bln)</span>
                        </div>
                        <button type="button" class="btn btn-primary btn-xs" onclick="switchAdminTab('booking')">Tinjau</button>
                    </div>
                `);
            });
        }
        if (resTg.status && resTg.data) {
            resTg.data.slice(0, 3).forEach(t => {
                items.push(`
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:var(--bg-surface-alt);border:1px solid var(--border-color);border-radius:10px;">
                        <div>
                            <strong style="font-size:0.88rem;display:block;">Verifikasi Bayar: ${escapeHtml(t.nama_penghuni)}</strong>
                            <span style="font-size:0.78rem;color:var(--text-muted);">${escapeHtml(t.kode_invoice)} • ${formatRupiah(t.total_bayar)}</span>
                        </div>
                        <button type="button" class="btn btn-primary btn-xs" onclick="switchAdminTab('tagihan')">Verifikasi</button>
                    </div>
                `);
            });
        }

        if (items.length === 0) {
            container.innerHTML = `
                <div style="padding:28px;text-align:center;color:var(--text-muted);border:1px dashed var(--border-color);border-radius:12px;">
                    <p style="font-size:0.88rem;font-weight:600;">Semua antrean booking dan verifikasi pembayaran sudah tertangani.</p>
                </div>
            `;
        } else {
            container.innerHTML = items.join('');
        }
    } catch (err) {
        container.innerHTML = `<p style="color:var(--danger);font-size:0.85rem;">Gagal memuat antrean tindak lanjut.</p>`;
    }
}

/* ==========================================================
   2. DENAH & MANAJEMEN KAMAR
   ========================================================== */
function setRoomViewMode(mode) {
    roomViewMode = mode;
    const btnDenah = document.getElementById('btn-view-denah');
    const btnTable = document.getElementById('btn-view-table');
    const denahBox = document.getElementById('kamar-denah-container');
    const tableBox = document.getElementById('kamar-table-container');

    if (mode === 'denah') {
        btnDenah.className = 'btn btn-primary btn-sm';
        btnTable.className = 'btn btn-secondary btn-sm';
        denahBox.style.display = 'block';
        tableBox.style.display = 'none';
    } else {
        btnDenah.className = 'btn btn-secondary btn-sm';
        btnTable.className = 'btn btn-primary btn-sm';
        denahBox.style.display = 'none';
        tableBox.style.display = 'block';
    }
}

async function loadRoomsAdmin() {
    const status = document.getElementById('filter-kamar-status')?.value || 'Semua';
    const search = document.getElementById('search-kamar-admin')?.value.trim() || null;

    try {
        const res = await eel.get_kamar(null, status === 'Semua' ? null : status, null, search)();
        if (!res.status) {
            showToast(res.pesan || 'Gagal memuat kamar', 'error');
            return;
        }
        roomsCache = res.data || [];
        renderDenahRooms(roomsCache);
        renderTableRooms(roomsCache);
    } catch (err) {
        console.error(err);
    }
}

function renderDenahRooms(list) {
    const container = document.getElementById('kamar-denah-container');
    if (!container) return;

    if (!list.length) {
        container.innerHTML = `<div class="panel-card" style="text-align:center;color:var(--text-muted);">Tidak ada unit kamar sesuai filter.</div>`;
        return;
    }

    // Kelompokkan per lantai
    const grouped = {};
    list.forEach(k => {
        const lt = k.lantai || 1;
        if (!grouped[lt]) grouped[lt] = [];
        grouped[lt].push(k);
    });

    const floors = Object.keys(grouped).sort((a, b) => Number(a) - Number(b));
    container.innerHTML = floors.map(lt => {
        const cards = grouped[lt].map(k => {
            const badgeCls = k.status === 'Tersedia' ? 'badge-success' : (k.status === 'Terisi' ? 'badge-neutral' : 'badge-warning');
            return `
                <div class="denah-room-card status-${escapeHtml(k.status)}">
                    <div>
                        <div class="denah-room-top">
                            <div>
                                <div class="denah-room-no">Kamar ${escapeHtml(k.nomor_kamar)}</div>
                                <div class="denah-room-meta">${escapeHtml(k.tipe)} • ${escapeHtml(k.luas_kamar || '3x4 m')}</div>
                            </div>
                            <span class="badge ${badgeCls}">${escapeHtml(k.status)}</span>
                        </div>
                        <div class="denah-room-price" style="margin-top:10px;">${formatRupiah(k.harga_sewa)} <span style="font-weight:500;font-size:0.75rem;color:var(--text-muted);">/ bln</span></div>
                        <p style="font-size:0.78rem;color:var(--text-muted);margin-top:6px;line-height:1.4;">${escapeHtml((k.fasilitas || '-').slice(0, 65))}</p>
                    </div>
                    <div class="table-actions">
                        <button type="button" class="btn btn-secondary btn-xs" onclick="openKamarModal(${k.id})">Edit</button>
                        ${k.status === 'Tersedia' ? `<button type="button" class="btn btn-primary btn-xs" onclick="openCheckinModal(${k.id})">Check-In</button>` : ''}
                        <button type="button" class="btn btn-danger btn-xs" onclick="handleHapusKamar(${k.id}, '${escapeHtml(k.nomor_kamar)}')">Hapus</button>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="panel-card floor-section">
                <div class="floor-header">
                    <div class="floor-title">
                        <svg class="icon" style="color:var(--primary);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                        <span>Lantai ${lt}</span>
                    </div>
                    <span style="font-size:0.8rem;color:var(--text-muted);font-weight:600;">${grouped[lt].length} Unit</span>
                </div>
                <div class="floor-grid">${cards}</div>
            </div>
        `;
    }).join('');
}

function renderTableRooms(list) {
    const tbody = document.getElementById('kamar-table-body');
    if (!tbody) return;
    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:24px;">Data kamar kosong.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(k => {
        const badgeCls = k.status === 'Tersedia' ? 'badge-success' : (k.status === 'Terisi' ? 'badge-neutral' : 'badge-warning');
        return `
            <tr>
                <td><strong>${escapeHtml(k.nomor_kamar)}</strong></td>
                <td>Lantai ${k.lantai}</td>
                <td>${escapeHtml(k.tipe)} <span style="color:var(--text-muted);font-size:0.8rem;">(${escapeHtml(k.luas_kamar || '-')})</span></td>
                <td><strong>${formatRupiah(k.harga_sewa)}</strong></td>
                <td style="max-width:220px;font-size:0.8rem;color:var(--text-muted);">${escapeHtml(k.fasilitas || '-')}</td>
                <td><span class="badge ${badgeCls}">${escapeHtml(k.status)}</span></td>
                <td>
                    <div class="table-actions">
                        <button type="button" class="btn btn-secondary btn-xs" onclick="openKamarModal(${k.id})">Edit</button>
                        ${k.status === 'Tersedia' ? `<button type="button" class="btn btn-primary btn-xs" onclick="openCheckinModal(${k.id})">Check-In</button>` : ''}
                        <button type="button" class="btn btn-danger btn-xs" onclick="handleHapusKamar(${k.id}, '${escapeHtml(k.nomor_kamar)}')">Hapus</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function openKamarModal(kamarId = null) {
    const form = document.getElementById('form-kamar');
    form.reset();
    document.getElementById('kamar-edit-id').value = '';
    const statusGroup = document.getElementById('group-kamar-status');

    if (kamarId) {
        const k = roomsCache.find(r => r.id === kamarId);
        if (!k) return;
        document.getElementById('modal-kamar-title').textContent = `Edit Kamar ${k.nomor_kamar}`;
        document.getElementById('kamar-edit-id').value = k.id;
        document.getElementById('kamar-nomor').value = k.nomor_kamar;
        document.getElementById('kamar-lantai').value = k.lantai;
        document.getElementById('kamar-tipe').value = k.tipe;
        document.getElementById('kamar-harga').value = k.harga_sewa;
        document.getElementById('kamar-luas').value = k.luas_kamar || '3x4 m';
        document.getElementById('kamar-fasilitas').value = k.fasilitas || '';
        document.getElementById('kamar-deskripsi').value = k.deskripsi || '';
        document.getElementById('kamar-status').value = k.status;
        statusGroup.style.display = 'block';
    } else {
        document.getElementById('modal-kamar-title').textContent = 'Tambah Kamar Baru';
        statusGroup.style.display = 'none';
    }
    openModal('modal-kamar');
}

async function handleHapusKamar(id, nomor) {
    if (!confirm(`Yakin ingin menghapus Kamar ${nomor}?`)) return;
    const res = await eel.hapus_kamar(id, adminUsername())();
    showToast(res.pesan, res.status ? 'success' : 'error');
    if (res.status) {
        await loadRoomsAdmin();
        await loadKpiCards();
    }
}

/* ==========================================================
   3. BOOKING ONLINE
   ========================================================== */
async function loadBookingsAdmin() {
    const status = document.getElementById('filter-booking-status')?.value || 'Semua';
    const res = await eel.get_booking(status === 'Semua' ? null : status)();
    const tbody = document.getElementById('booking-table-body');
    if (!tbody) return;

    if (!res.status || !res.data || res.data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px;">Belum ada permohonan booking.</td></tr>`;
        return;
    }

    bookingsCache = res.data;
    tbody.innerHTML = res.data.map(b => {
        const badgeCls = b.status === 'Pending' ? 'badge-warning' : (b.status === 'Disetujui' ? 'badge-success' : 'badge-danger');
        return `
            <tr>
                <td>
                    <strong>${escapeHtml(b.nama_pemohon)}</strong><br>
                    <span style="font-size:0.78rem;color:var(--text-muted);">${escapeHtml(b.no_hp)} • ${escapeHtml(b.pekerjaan || '-')}</span>
                </td>
                <td>
                    <strong>Kamar ${escapeHtml(b.nomor_kamar)}</strong><br>
                    <span style="font-size:0.78rem;color:var(--text-muted);">${escapeHtml(b.tipe)} (${formatRupiah(b.harga_sewa)})</span>
                </td>
                <td>
                    ${formatDateIndo(b.tanggal_mulai)}<br>
                    <span style="font-size:0.78rem;color:var(--text-muted);">Durasi: ${b.durasi_bulan} Bulan</span>
                </td>
                <td style="max-width:200px;font-size:0.8rem;">
                    ${b.foto_ktp ? `<button type="button" class="btn btn-secondary btn-xs" onclick="openBookingKtp(${b.id})">Lihat KTP</button>` : '<span style="color:var(--text-muted);">Tanpa KTP</span>'}
                    <div style="color:var(--text-muted);margin-top:4px;">${escapeHtml(b.catatan || b.alasan_penolakan || '')}</div>
                </td>
                <td><span class="badge ${badgeCls}">${escapeHtml(b.status)}</span></td>
                <td>
                    ${b.status === 'Pending' ? `
                        <div class="table-actions">
                            <button type="button" class="btn btn-primary btn-xs" onclick="handleApproveBooking(${b.id}, '${escapeHtml(b.nama_pemohon)}')">Setujui</button>
                            <button type="button" class="btn btn-danger btn-xs" onclick="openTolakBookingModal(${b.id})">Tolak</button>
                        </div>
                    ` : `<span style="font-size:0.78rem;color:var(--text-muted);">Diproses pada ${escapeHtml(b.waktu_pengajuan)}</span>`}
                </td>
            </tr>
        `;
    }).join('');
}

function openBookingKtp(bookingId) {
    const b = bookingsCache.find(x => x.id === bookingId);
    openImagePreview(b?.foto_ktp, `KTP Pemohon: ${b?.nama_pemohon || ''}`);
}

async function handleApproveBooking(id, nama) {
    if (!confirm(`Setujui booking atas nama ${nama}?\nSistem akan otomatis melakukan check-in dan membuat tagihan bulan pertama.`)) return;
    const res = await eel.proses_booking(id, 'Disetujui', null, adminUsername())();
    showToast(res.pesan, res.status ? 'success' : 'error');
    if (res.status) {
        await loadBookingsAdmin();
        await loadKpiCards();
    }
}

function openTolakBookingModal(id) {
    document.getElementById('form-tolak-booking').reset();
    document.getElementById('tolak-booking-id').value = id;
    openModal('modal-tolak-booking');
}

/* ==========================================================
   4. DATA PENGHUNI & MUTASI
   ========================================================== */
async function loadPenghuniAdmin() {
    const status = document.getElementById('filter-penghuni-status')?.value || 'Aktif';
    const search = document.getElementById('search-penghuni-admin')?.value.trim() || null;
    const res = await eel.get_penghuni(status, search)();
    const tbody = document.getElementById('penghuni-table-body');
    if (!tbody) return;

    if (!res.status || !res.data || res.data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:24px;">Tidak ada data penghuni ditemukan.</td></tr>`;
        return;
    }

    penghuniCache = res.data;
    tbody.innerHTML = res.data.map(p => {
        const badgeCls = p.status === 'Aktif' ? 'badge-success' : 'badge-neutral';
        const cleanWa = (p.no_hp || '').replace(/[^0-9]/g, '');
        const waNum = cleanWa.startsWith('0') ? '62' + cleanWa.slice(1) : cleanWa;

        return `
            <tr>
                <td>
                    <strong>${escapeHtml(p.nama)}</strong><br>
                    <span style="font-size:0.76rem;color:var(--text-muted);">User: ${escapeHtml(p.username || '-')}</span>
                </td>
                <td>
                    <strong>Kamar ${escapeHtml(p.nomor_kamar)}</strong><br>
                    <span style="font-size:0.76rem;color:var(--text-muted);">${escapeHtml(p.tipe)} • Lt ${p.lantai}</span>
                </td>
                <td>
                    <div>${escapeHtml(p.no_hp)}</div>
                    ${waNum ? `<a href="https://wa.me/${waNum}" target="_blank" style="font-size:0.76rem;color:#16a34a;font-weight:600;">Chat WhatsApp</a>` : ''}
                </td>
                <td>
                    ${escapeHtml(p.pekerjaan || '-')}<br>
                    <span style="font-size:0.76rem;color:var(--text-muted);">${escapeHtml(p.asal_kota || '-')}</span>
                </td>
                <td>${escapeHtml(p.tgl_masuk_format || formatDateIndo(p.tanggal_masuk))}</td>
                <td><span class="badge ${badgeCls}">${escapeHtml(p.status)}</span></td>
                <td>
                    <div class="table-actions">
                        ${p.foto_ktp ? `<button type="button" class="btn btn-secondary btn-xs" onclick="openPenghuniKtp(${p.id})">KTP</button>` : ''}
                        <button type="button" class="btn btn-secondary btn-xs" onclick="openEditPenghuniModal(${p.id})">Edit</button>
                        ${p.status === 'Aktif' ? `
                            <button type="button" class="btn btn-primary btn-xs" onclick="openPindahKamarModal(${p.id})">Pindah</button>
                            <button type="button" class="btn btn-danger btn-xs" onclick="handleCheckoutPenghuni(${p.id}, '${escapeHtml(p.nama)}')">Check-Out</button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function openPenghuniKtp(id) {
    const p = penghuniCache.find(x => x.id === id);
    openImagePreview(p?.foto_ktp, `KTP Penghuni: ${p?.nama || ''}`);
}

async function openCheckinModal(preselectedKamarId = null) {
    const res = await eel.get_kamar(null, 'Tersedia', null, null)();
    const select = document.getElementById('checkin-kamar-id');
    const rooms = (res.status && res.data) ? res.data : [];

    if (rooms.length === 0) {
        showToast('Saat ini tidak ada kamar berstatus Tersedia.', 'warning');
        return;
    }

    select.innerHTML = rooms.map(r => `<option value="${r.id}">Kamar ${escapeHtml(r.nomor_kamar)} - ${escapeHtml(r.tipe)} (${formatRupiah(r.harga_sewa)}/bln)</option>`).join('');
    if (preselectedKamarId) select.value = String(preselectedKamarId);

    document.getElementById('form-checkin').reset();
    if (preselectedKamarId) select.value = String(preselectedKamarId);
    document.getElementById('checkin-tgl').value = new Date().toISOString().split('T')[0];
    openModal('modal-checkin');
}

function openEditPenghuniModal(id) {
    const p = penghuniCache.find(x => x.id === id);
    if (!p) return;
    document.getElementById('edit-penghuni-id').value = p.id;
    document.getElementById('edit-penghuni-nama').value = p.nama;
    document.getElementById('edit-penghuni-nohp').value = p.no_hp;
    document.getElementById('edit-penghuni-pekerjaan').value = p.pekerjaan || '';
    document.getElementById('edit-penghuni-asal').value = p.asal_kota || '';
    openModal('modal-edit-penghuni');
}

async function openPindahKamarModal(penghuniId) {
    const p = penghuniCache.find(x => x.id === penghuniId);
    if (!p) return;

    const res = await eel.get_kamar(null, 'Tersedia', null, null)();
    const rooms = (res.status && res.data) ? res.data : [];
    if (rooms.length === 0) {
        showToast('Tidak ada kamar kosong untuk tujuan pindah.', 'warning');
        return;
    }

    document.getElementById('pindah-penghuni-id').value = p.id;
    document.getElementById('pindah-info-text').textContent = `Memindahkan ${p.nama} dari Kamar ${p.nomor_kamar} ke kamar baru:`;
    document.getElementById('pindah-kamar-baru-id').innerHTML = rooms.map(r => `<option value="${r.id}">Kamar ${escapeHtml(r.nomor_kamar)} (${escapeHtml(r.tipe)} - ${formatRupiah(r.harga_sewa)})</option>`).join('');
    openModal('modal-pindah-kamar');
}

async function handleCheckoutPenghuni(id, nama) {
    if (!confirm(`Proses check-out untuk ${nama}?\nKamar akan dikosongkan kembali menjadi Tersedia.`)) return;
    const res = await eel.checkout_penghuni(id, null, adminUsername())();
    showToast(res.pesan, res.status ? 'success' : 'error');
    if (res.status) {
        await loadPenghuniAdmin();
        await loadKpiCards();
    }
}

/* ==========================================================
   5. TAGIHAN, PEMBAYARAN & KUITANSI RESMI
   ========================================================== */
function resetTagihanFilter() {
    document.getElementById('filter-tagihan-status').value = 'Semua';
    document.getElementById('filter-tagihan-bulan').value = '';
    document.getElementById('search-tagihan-admin').value = '';
    loadTagihanAdmin();
}

async function loadTagihanAdmin() {
    const status = document.getElementById('filter-tagihan-status')?.value || 'Semua';
    const bulan = document.getElementById('filter-tagihan-bulan')?.value || null;
    const search = document.getElementById('search-tagihan-admin')?.value.trim() || null;

    const res = await eel.get_tagihan(status, bulan, search, null)();
    const tbody = document.getElementById('tagihan-table-body');
    if (!tbody) return;

    if (!res.status || !res.data || res.data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:24px;">Tidak ada data tagihan.</td></tr>`;
        return;
    }

    tagihanCache = res.data;
    tbody.innerHTML = res.data.map(t => {
        let badgeCls = 'badge-danger';
        if (t.status === 'Lunas') badgeCls = 'badge-success';
        else if (t.status === 'Menunggu Konfirmasi') badgeCls = 'badge-warning';

        const cleanWa = (t.no_hp_penghuni || '').replace(/[^0-9]/g, '');
        const waNum = cleanWa.startsWith('0') ? '62' + cleanWa.slice(1) : cleanWa;
        const waText = encodeURIComponent(`Halo ${t.nama_penghuni}, ini pengingat tagihan sewa Kamar ${t.nomor_kamar} periode ${t.bulan_tahun} sebesar ${formatRupiah(t.total_bayar)} (Invoice: ${t.kode_invoice}). Mohon segera diselesaikan. Terima kasih.`);

        return `
            <tr>
                <td><strong>${escapeHtml(t.kode_invoice)}</strong></td>
                <td>${escapeHtml(t.bulan_tahun)}</td>
                <td>
                    <strong>${escapeHtml(t.nama_penghuni)}</strong><br>
                    <span style="font-size:0.76rem;color:var(--text-muted);">Kamar ${escapeHtml(t.nomor_kamar)} (${escapeHtml(t.tipe_kamar)})</span>
                </td>
                <td><strong>${formatRupiah(t.total_bayar)}</strong></td>
                <td>
                    ${escapeHtml(t.tgl_jatuh_tempo || t.jatuh_tempo)}
                    ${t.is_telat ? `<br><span class="badge badge-danger" style="font-size:0.68rem;padding:2px 8px;">Telat ${t.hari_telat} Hari</span>` : ''}
                </td>
                <td><span class="badge ${badgeCls}">${escapeHtml(t.status)}</span></td>
                <td>
                    <div class="table-actions">
                        ${t.status === 'Menunggu Konfirmasi' ? `
                            ${t.bukti_transfer ? `<button type="button" class="btn btn-secondary btn-xs" onclick="openBuktiTransfer(${t.id})">Bukti</button>` : ''}
                            <button type="button" class="btn btn-success btn-xs" onclick="handleVerifikasiTagihan(${t.id}, 'Lunas')">Verifikasi</button>
                            <button type="button" class="btn btn-danger btn-xs" onclick="handleVerifikasiTagihan(${t.id}, 'Belum Bayar')">Tolak</button>
                        ` : ''}
                        ${t.status === 'Belum Bayar' ? `
                            <button type="button" class="btn btn-primary btn-xs" onclick="openBayarAdminModal(${t.id})">Lunaskan</button>
                            ${waNum ? `<a href="https://wa.me/${waNum}?text=${waText}" target="_blank" class="btn btn-wa btn-xs">Ingatkan WA</a>` : ''}
                        ` : ''}
                        ${t.status === 'Lunas' ? `
                            <button type="button" class="btn btn-secondary btn-xs" onclick="openKuitansiModal(${t.id})">Kuitansi</button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function handleGenerateTagihan() {
    const res = await eel.generate_tagihan(null, adminUsername())();
    showToast(res.pesan, res.status ? 'success' : 'error');
    if (res.status) {
        if (currentTab === 'tagihan') await loadTagihanAdmin();
        await loadKpiCards();
    }
}

function openBuktiTransfer(tagihanId) {
    const t = tagihanCache.find(x => x.id === tagihanId);
    openImagePreview(t?.bukti_transfer, `Bukti Transfer: ${t?.kode_invoice || ''}`);
}

async function handleVerifikasiTagihan(tagihanId, statusBaru) {
    const label = statusBaru === 'Lunas' ? 'menyetujui pembayaran menjadi LUNAS' : 'menolak bukti transfer';
    if (!confirm(`Konfirmasi untuk ${label}?`)) return;
    const res = await eel.verifikasi_tagihan(tagihanId, statusBaru, adminUsername())();
    showToast(res.pesan, res.status ? 'success' : 'error');
    if (res.status) {
        await loadTagihanAdmin();
        await loadKpiCards();
    }
}

function openBayarAdminModal(tagihanId) {
    const t = tagihanCache.find(x => x.id === tagihanId);
    if (!t) return;
    document.getElementById('form-bayar-admin').reset();
    document.getElementById('bayar-tagihan-id').value = t.id;
    document.getElementById('bayar-info-label').textContent = `${t.kode_invoice} • ${t.nama_penghuni} (${formatRupiah(t.total_bayar)})`;
    openModal('modal-bayar-admin');
}

async function openKuitansiModal(tagihanId) {
    const res = await eel.get_kuitansi(tagihanId)();
    if (!res.status || !res.data) {
        showToast('Gagal mengambil data kuitansi.', 'error');
        return;
    }
    const k = res.data;
    document.getElementById('rec-nama-kos').textContent = k.nama_kos || 'Kost Cemara';
    document.getElementById('rec-alamat-kos').textContent = k.alamat_kos || '-';
    document.getElementById('rec-wa-kos').textContent = k.no_wa_kos || '-';
    document.getElementById('rec-status').textContent = (k.status || 'LUNAS').toUpperCase();
    document.getElementById('rec-kode-inv').textContent = k.kode_invoice;
    document.getElementById('rec-nama-penghuni').textContent = k.nama_penghuni;
    document.getElementById('rec-kamar').textContent = `Kamar ${k.nomor_kamar} (${k.tipe_kamar})`;
    document.getElementById('rec-periode').textContent = k.bulan_tahun;
    document.getElementById('rec-tgl-metode').textContent = `${k.tanggal_bayar || '-'} • ${k.metode_pembayaran || '-'}`;
    document.getElementById('rec-rincian-nominal').textContent = `Sewa: ${formatRupiah(k.nominal)} + Denda: ${formatRupiah(k.denda)}`;
    document.getElementById('rec-total-bayar').textContent = formatRupiah(k.total_bayar);
    document.getElementById('rec-catatan').textContent = k.catatan || '-';

    openModal('modal-kuitansi');
}

/* ==========================================================
   6. PENGELUARAN KOS
   ========================================================== */
async function loadPengeluaranAdmin() {
    const kat = document.getElementById('filter-pengeluaran-kategori')?.value || 'Semua';
    const bln = document.getElementById('filter-pengeluaran-bulan')?.value || null;
    const res = await eel.get_pengeluaran(bln, kat)();
    const tbody = document.getElementById('pengeluaran-table-body');
    if (!tbody) return;

    if (!res.status || !res.data || res.data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px;">Belum ada catatan pengeluaran.</td></tr>`;
        return;
    }

    pengeluaranCache = res.data;
    tbody.innerHTML = res.data.map(e => `
        <tr>
            <td>${escapeHtml(e.tgl_format || formatDateIndo(e.tanggal))}</td>
            <td><span class="badge badge-neutral">${escapeHtml(e.kategori)}</span></td>
            <td>${escapeHtml(e.keterangan)}</td>
            <td><strong style="color:var(--danger);">${formatRupiah(e.nominal)}</strong></td>
            <td>${e.bukti_nota ? `<button type="button" class="btn btn-secondary btn-xs" onclick="openNotaPreview(${e.id})">Lihat Nota</button>` : '<span style="color:var(--text-muted);font-size:0.78rem;">-</span>'}</td>
            <td><button type="button" class="btn btn-danger btn-xs" onclick="handleHapusPengeluaran(${e.id})">Hapus</button></td>
        </tr>
    `).join('');
}

function openNotaPreview(id) {
    const e = pengeluaranCache.find(x => x.id === id);
    openImagePreview(e?.bukti_nota, `Nota Pengeluaran: ${e?.keterangan || ''}`);
}

function openPengeluaranModal() {
    document.getElementById('form-pengeluaran').reset();
    document.getElementById('exp-tanggal').value = new Date().toISOString().split('T')[0];
    openModal('modal-pengeluaran');
}

async function handleHapusPengeluaran(id) {
    if (!confirm('Hapus catatan pengeluaran ini?')) return;
    const res = await eel.hapus_pengeluaran(id, adminUsername())();
    showToast(res.pesan, res.status ? 'success' : 'error');
    if (res.status) {
        await loadPengeluaranAdmin();
        await loadKpiCards();
    }
}

/* ==========================================================
   7. KELUHAN & PERBAIKAN
   ========================================================== */
async function loadKeluhanAdmin() {
    const status = document.getElementById('filter-keluhan-status')?.value || 'Semua';
    const res = await eel.get_keluhan(status, null)();
    const tbody = document.getElementById('keluhan-table-body');
    if (!tbody) return;

    if (!res.status || !res.data || res.data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px;">Tidak ada tiket keluhan.</td></tr>`;
        return;
    }

    keluhanCache = res.data;
    tbody.innerHTML = res.data.map(c => {
        const prioCls = c.prioritas === 'Tinggi' ? 'badge-danger' : (c.prioritas === 'Sedang' ? 'badge-warning' : 'badge-neutral');
        const stCls = c.status === 'Selesai' ? 'badge-success' : (c.status === 'Diproses' ? 'badge-warning' : 'badge-danger');

        return `
            <tr>
                <td>
                    <strong>${escapeHtml(c.nama_penghuni)}</strong> (Kamar ${escapeHtml(c.nomor_kamar)})<br>
                    <span style="font-size:0.76rem;color:var(--text-muted);">${escapeHtml(c.waktu_lapor)}</span>
                </td>
                <td style="max-width:260px;">
                    <strong>${escapeHtml(c.judul)}</strong>
                    <p style="font-size:0.8rem;color:var(--text-muted);margin-top:2px;">${escapeHtml(c.deskripsi)}</p>
                    ${c.foto_keluhan ? `<button type="button" class="btn btn-secondary btn-xs" style="margin-top:4px;" onclick="openKeluhanFoto(${c.id})">Lihat Foto</button>` : ''}
                </td>
                <td><span class="badge ${prioCls}">${escapeHtml(c.prioritas)}</span></td>
                <td style="font-size:0.82rem;">
                    <div>${escapeHtml(c.tindakan || '-')}</div>
                    ${c.biaya_perbaikan > 0 ? `<strong style="color:var(--danger);">${formatRupiah(c.biaya_perbaikan)}</strong>` : ''}
                </td>
                <td><span class="badge ${stCls}">${escapeHtml(c.status)}</span></td>
                <td>
                    <button type="button" class="btn btn-primary btn-xs" onclick="openKeluhanModal(${c.id})">Update</button>
                </td>
            </tr>
        `;
    }).join('');
}

function openKeluhanFoto(id) {
    const c = keluhanCache.find(x => x.id === id);
    openImagePreview(c?.foto_keluhan, `Foto Keluhan: ${c?.judul || ''}`);
}

function openKeluhanModal(id) {
    const c = keluhanCache.find(x => x.id === id);
    if (!c) return;
    document.getElementById('keluhan-edit-id').value = c.id;
    document.getElementById('keluhan-info-title').textContent = `Kamar ${c.nomor_kamar} • ${c.judul}`;
    document.getElementById('keluhan-status').value = c.status;
    document.getElementById('keluhan-tindakan').value = c.tindakan || '';
    document.getElementById('keluhan-biaya').value = c.biaya_perbaikan || 0;
    openModal('modal-keluhan');
}

/* ==========================================================
   8. EKSPOR PANDAS & LOG AKTIVITAS
   ========================================================== */
async function handleExportKeuanganExcel() {
    const tahun = document.getElementById('export-year-select')?.value || '2026';
    const res = await eel.export_keuangan_excel(tahun)();
    showToast(res.pesan, res.status ? 'success' : 'error');
    if (res.status && res.file_path) {
        showExportResult(res.file_path);
    }
}

async function handleExportPenghuniExcel() {
    const res = await eel.export_penghuni_excel()();
    showToast(res.pesan, res.status ? 'success' : 'error');
    if (res.status && res.file_path) {
        showExportResult(res.file_path);
    }
}

async function handleExportCSV(jenis) {
    const tahun = document.getElementById('export-year-select')?.value || '2026';
    const res = await eel.export_csv(jenis, tahun)();
    showToast(res.pesan, res.status ? 'success' : 'error');
    if (res.status && res.file_path) {
        showExportResult(res.file_path);
    }
}

function showExportResult(path) {
    const banner = document.getElementById('export-result-banner');
    const pathEl = document.getElementById('export-result-path');
    if (banner && pathEl) {
        pathEl.textContent = `File tersimpan di: ${path}`;
        banner.style.display = 'block';
    }
}

async function loadLogsAdmin() {
    const res = await eel.get_logs(50)();
    const tbody = document.getElementById('logs-table-body');
    if (!tbody) return;

    if (!res.status || !res.data || res.data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px;">Belum ada catatan log aktivitas.</td></tr>`;
        return;
    }

    tbody.innerHTML = res.data.map(l => `
        <tr>
            <td style="white-space:nowrap;font-size:0.8rem;color:var(--text-muted);">${escapeHtml(l.waktu || l.created_at || '-')}</td>
            <td><strong>${escapeHtml(l.username)}</strong></td>
            <td><span class="badge badge-neutral">${escapeHtml(l.role)}</span></td>
            <td><strong>${escapeHtml(l.aksi)}</strong></td>
            <td style="font-size:0.82rem;color:var(--text-muted);">${escapeHtml(l.detail || '-')}</td>
        </tr>
    `).join('');
}

/* ==========================================================
   9. PENGATURAN PROFIL KOS & FORM SUBMIT HANDLERS
   ========================================================== */
async function loadKosSettings() {
    try {
        const res = await eel.get_pengaturan()();
        if (res.status && res.data) {
            const d = res.data;
            document.querySelectorAll('.app-nama-kos').forEach(el => el.textContent = d.nama_kos || 'Kost Cemara');
            const fNama = document.getElementById('set-nama-kos');
            if (fNama) {
                fNama.value = d.nama_kos || 'Kost Cemara';
                document.getElementById('set-tagline').value = d.tagline || '';
                document.getElementById('set-no-wa').value = d.no_wa || '';
                document.getElementById('set-denda').value = d.denda_per_hari || 10000;
                document.getElementById('set-alamat').value = d.alamat || '';
                document.getElementById('set-deskripsi').value = d.deskripsi || '';
            }
        }
    } catch (err) {
        console.warn('Gagal memuat pengaturan kos:', err);
    }
}

function setupAdminForms() {
    // Form Tambah / Edit Kamar
    document.getElementById('form-kamar')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const editId = document.getElementById('kamar-edit-id').value;
        const nomor = document.getElementById('kamar-nomor').value.trim();
        const lantai = parseInt(document.getElementById('kamar-lantai').value, 10);
        const tipe = document.getElementById('kamar-tipe').value;
        const harga = parseInt(document.getElementById('kamar-harga').value, 10);
        const luas = document.getElementById('kamar-luas').value.trim();
        const fasilitas = document.getElementById('kamar-fasilitas').value.trim();
        const deskripsi = document.getElementById('kamar-deskripsi').value.trim();
        const status = document.getElementById('kamar-status').value;
        const file = document.getElementById('kamar-foto-file').files[0];
        const fotoB64 = file ? await fileToBase64(file) : null;

        let res;
        if (editId) {
            res = await eel.ubah_kamar(parseInt(editId, 10), nomor, lantai, tipe, harga, luas, fasilitas, deskripsi, status, fotoB64, adminUsername())();
        } else {
            res = await eel.tambah_kamar(nomor, lantai, tipe, harga, luas, fasilitas, deskripsi, fotoB64, adminUsername())();
        }

        showToast(res.pesan, res.status ? 'success' : 'error');
        if (res.status) {
            closeModal('modal-kamar');
            await loadRoomsAdmin();
            await loadKpiCards();
        }
    });

    // Form Check-In Penghuni
    document.getElementById('form-checkin')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const kamarId = parseInt(document.getElementById('checkin-kamar-id').value, 10);
        const nama = document.getElementById('checkin-nama').value.trim();
        const nohp = document.getElementById('checkin-nohp').value.trim();
        const pekerjaan = document.getElementById('checkin-pekerjaan').value.trim();
        const asal = document.getElementById('checkin-asal').value.trim();
        const tgl = document.getElementById('checkin-tgl').value;
        const buatUser = document.getElementById('checkin-buat-user').checked;
        const file = document.getElementById('checkin-ktp-file').files[0];
        const fotoB64 = file ? await fileToBase64(file) : null;

        const res = await eel.checkin_penghuni(kamarId, nama, nohp, pekerjaan, asal, tgl, fotoB64, buatUser, null, null, adminUsername())();
        showToast(res.pesan, res.status ? 'success' : 'error');
        if (res.status) {
            closeModal('modal-checkin');
            if (currentTab === 'penghuni') await loadPenghuniAdmin();
            if (currentTab === 'kamar') await loadRoomsAdmin();
            await loadKpiCards();
        }
    });

    // Form Edit Penghuni
    document.getElementById('form-edit-penghuni')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = parseInt(document.getElementById('edit-penghuni-id').value, 10);
        const nama = document.getElementById('edit-penghuni-nama').value.trim();
        const nohp = document.getElementById('edit-penghuni-nohp').value.trim();
        const pekerjaan = document.getElementById('edit-penghuni-pekerjaan').value.trim();
        const asal = document.getElementById('edit-penghuni-asal').value.trim();

        const res = await eel.ubah_penghuni(id, nama, nohp, pekerjaan, asal, adminUsername())();
        showToast(res.pesan, res.status ? 'success' : 'error');
        if (res.status) {
            closeModal('modal-edit-penghuni');
            await loadPenghuniAdmin();
        }
    });

    // Form Pindah Kamar
    document.getElementById('form-pindah-kamar')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const penghuniId = parseInt(document.getElementById('pindah-penghuni-id').value, 10);
        const kamarBaruId = parseInt(document.getElementById('pindah-kamar-baru-id').value, 10);

        const res = await eel.pindah_kamar(penghuniId, kamarBaruId, adminUsername())();
        showToast(res.pesan, res.status ? 'success' : 'error');
        if (res.status) {
            closeModal('modal-pindah-kamar');
            await loadPenghuniAdmin();
            await loadKpiCards();
        }
    });

    // Form Tolak Booking
    document.getElementById('form-tolak-booking')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = parseInt(document.getElementById('tolak-booking-id').value, 10);
        const alasan = document.getElementById('tolak-booking-alasan').value.trim();

        const res = await eel.proses_booking(id, 'Ditolak', alasan, adminUsername())();
        showToast(res.pesan, res.status ? 'success' : 'error');
        if (res.status) {
            closeModal('modal-tolak-booking');
            await loadBookingsAdmin();
            await loadKpiCards();
        }
    });

    // Form Pelunasan Tagihan oleh Admin
    document.getElementById('form-bayar-admin')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = parseInt(document.getElementById('bayar-tagihan-id').value, 10);
        const metode = document.getElementById('bayar-metode').value;
        const catatan = document.getElementById('bayar-catatan').value.trim();

        const res = await eel.bayar_tagihan(id, metode, null, catatan, 'admin', adminUsername())();
        showToast(res.pesan, res.status ? 'success' : 'error');
        if (res.status) {
            closeModal('modal-bayar-admin');
            await loadTagihanAdmin();
            await loadKpiCards();
        }
    });

    // Form Catat Pengeluaran
    document.getElementById('form-pengeluaran')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const kategori = document.getElementById('exp-kategori').value;
        const tanggal = document.getElementById('exp-tanggal').value;
        const nominal = parseInt(document.getElementById('exp-nominal').value, 10);
        const keterangan = document.getElementById('exp-keterangan').value.trim();
        const file = document.getElementById('exp-nota-file').files[0];
        const notaB64 = file ? await fileToBase64(file) : null;

        const res = await eel.tambah_pengeluaran(kategori, keterangan, nominal, tanggal, notaB64, adminUsername())();
        showToast(res.pesan, res.status ? 'success' : 'error');
        if (res.status) {
            closeModal('modal-pengeluaran');
            await loadPengeluaranAdmin();
            await loadKpiCards();
        }
    });

    // Form Update Keluhan
    document.getElementById('form-keluhan')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = parseInt(document.getElementById('keluhan-edit-id').value, 10);
        const status = document.getElementById('keluhan-status').value;
        const tindakan = document.getElementById('keluhan-tindakan').value.trim();
        const biaya = parseInt(document.getElementById('keluhan-biaya').value, 10) || 0;

        const res = await eel.update_status_keluhan(id, status, tindakan, biaya, adminUsername())();
        showToast(res.pesan, res.status ? 'success' : 'error');
        if (res.status) {
            closeModal('modal-keluhan');
            await loadKeluhanAdmin();
            await loadKpiCards();
        }
    });

    // Form Pengaturan Kos
    document.getElementById('form-pengaturan-kos')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nama = document.getElementById('set-nama-kos').value.trim();
        const tagline = document.getElementById('set-tagline').value.trim();
        const noWa = document.getElementById('set-no-wa').value.trim();
        const denda = parseInt(document.getElementById('set-denda').value, 10) || 10000;
        const alamat = document.getElementById('set-alamat').value.trim();
        const deskripsi = document.getElementById('set-deskripsi').value.trim();

        const res = await eel.update_pengaturan(nama, tagline, deskripsi, alamat, noWa, denda, null, adminUsername())();
        showToast(res.pesan, res.status ? 'success' : 'error');
        if (res.status) await loadKosSettings();
    });

    // Form Ganti Password Admin
    document.getElementById('form-ganti-password')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const lama = document.getElementById('pass-lama').value;
        const baru = document.getElementById('pass-baru').value;
        const res = await eel.ganti_password(currentAdmin.id, lama, baru)();
        showToast(res.pesan, res.status ? 'success' : 'error');
        if (res.status) e.target.reset();
    });
}

