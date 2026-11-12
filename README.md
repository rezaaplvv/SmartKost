# SmartKost Pro - Sistem Manajemen Kos Terpadu

SmartKost Pro adalah platform aplikasi desktop terintegrasi berbasis **Python + Eel**, didukung oleh database relasional **MySQL**, pengolahan data analitik dengan **Pandas**, dan visualisasi interaktif **Chart.js**. Aplikasi ini dirancang untuk memudahkan operasional pengelolaan rumah kos, pemantauan arus kas (cash flow), katalog kamar interaktif bagi calon penyewa, dan portal mandiri bagi penghuni kos.

---

## 🌟 Fitur Utama

### 1. Landing Page Dinamis & Katalog Publik
- **Katalog Kamar Real-Time**: Terhubung langsung ke database MySQL dengan filter per lantai, tipe kamar (Reguler, VIP, Eksklusif), dan rentang harga.
- **Formulir Booking Online**: Calon penyewa dapat mengajukan reservasi kamar langsung dengan durasi sewa dan upload KTP (Base64).
- **Akses Cepat Admin & Penghuni**: Modal login elegan langsung dari beranda.

### 2. Portal Admin & Pemilik Kos
- **Executive Dashboard**: Ringkasan KPI (omzet, pengeluaran, laba bersih, tingkat okupansi, total tunggakan).
- **Grafik Interaktif (Chart.js & Pandas)**: Tren arus kas 12 bulan (pemasukan vs pengeluaran vs profit), proporsi pengeluaran, dan rasio okupansi kamar.
- **Smart Notification**: Deteksi penghuni yang mendekati jatuh tempo atau menunggak dengan tombol **Tagih via WhatsApp Otomatis**.
- **Floor Plan View (Denah Kamar)**: Visualisasi kamar per lantai dengan indikator status (Tersedia, Terisi, Perbaikan).
- **Manajemen Penghuni & Kontrak**: Check-in penyewa baru, mutasi/pindah kamar otomatis, dan arsip riwayat alumni penghuni.
- **Keuangan & Cetak Kuitansi**: Pembuatan tagihan bulanan massal, verifikasi bukti transfer, cetak nota/kuitansi berlogo resmi siap print/PDF, dan pencatatan pengeluaran operasional.
- **Manajemen Keluhan / Tiket Maintenance**: Catat keluhan penghuni, pelacakan proses perbaikan, dan biaya perbaikan otomatis tercatat ke buku pengeluaran.
- **Ekspor Laporan (Pandas)**: Unduh rekapitulasi keuangan multi-sheet dan master data penghuni ke format Microsoft Excel (`.xlsx`) atau CSV sekali klik.
- **Audit Trail (Log Aktivitas)**: Rekam jejak seluruh aktivitas penting admin dan penghuni di dalam sistem.

### 3. Portal Penghuni Kos
- Cek status tagihan bulanan dan histori pembayaran sewa.
- Upload bukti transfer pembayaran langsung dari aplikasi (Base64).
- Cetak / download kuitansi pembayaran resmi.
- Pengajuan laporan keluhan / perbaikan fasilitas kamar secara mandiri.

---

## 🛠️ Tech Stack & Arsitektur

- **Backend**: Python 3.10+
- **Desktop GUI Engine**: Eel (Komunikasi dua arah Python ↔ JavaScript via WebSockets)
- **Database**: MySQL (didukung MariaDB / XAMPP)
- **Data Analytics & Export**: Pandas & OpenPyXL
- **Frontend**: HTML5, Modern Responsive CSS3 (Glassmorphism & Clean Card Layout), JavaScript (ES6+ Asynchronous)
- **Charting**: Chart.js
- **Media Transfer**: Base64 data encoding
- **Packaging**: PyInstaller (Siap dibundel ke `.exe`)

---

## 📂 Struktur Proyek

```text
SmartKost/
├── main.py                  # Entry point aplikasi & registrasi fungsi @eel.expose
├── db.py                    # Konfigurasi koneksi MySQL & safe query helpers
├── database.sql             # Skema DDL 9 tabel relasional database smartkost_db
├── init_db.py               # Script otomatis pembuatan DB & seeding dummy data 6 bulan
├── requirements.txt         # Daftar pustaka Python yang dibutuhkan
├── README.md                # Dokumentasi proyek
├── modules/                 # Modul logika bisnis backend
│   ├── __init__.py
│   ├── auth.py              # Autentikasi, registrasi, profil, dan log aktivitas
│   ├── kamar.py             # CRUD kamar, denah lantai, dan pengaturan kos
│   ├── penghuni.py          # Booking, check-in, mutasi kamar, dan check-out
│   ├── keuangan.py          # Tagihan, kuitansi, pengeluaran, dan keluhan
│   └── laporan.py           # Analitik data Pandas & export Excel/CSV
└── web/                     # Antarmuka frontend (HTML/CSS/JS)
    ├── index.html           # Landing page katalog & modal login
    ├── admin.html           # Portal manajemen admin
    ├── penghuni.html        # Portal akun mandiri penghuni
    ├── css/
    │   └── style.css        # Styling tema modern
    └── js/
        ├── utils.js         # Format Rupiah, Toast notifikasi, Base64 helper
        ├── landing.js       # Logika interaktif landing page
        ├── admin.js         # Logika dashboard admin & chart
        └── penghuni.js      # Logika portal penghuni
```

---

## 🚀 Panduan Memulai

### 1. Prasyarat
- Pastikan **Python 3.10+** terinstal.
- Pastikan service **MySQL** sudah berjalan (misal: jalankan module MySQL di XAMPP Control Panel).

### 2. Instalasi Dependensi
```powershell
pip install -r requirements.txt
```

### 3. Inisialisasi Database
Jalankan script `init_db.py` untuk membuat database `smartkost_db`, 9 tabel relasional, serta data contoh realistis 6 bulan terakhir:
```powershell
python init_db.py
```

### 4. Menjalankan Aplikasi
```powershell
python main.py
```

### 5. Akun Bawaan (Default):
- **Admin**:
  - Username: `admin`
  - Password: `admin123`
- **Penghuni**:
  - Username: `budi`
  - Password: `user123`
