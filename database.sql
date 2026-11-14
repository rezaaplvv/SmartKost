-- ========================================================
-- SmartKost Pro Database Schema
-- Database: smartkost_db
-- ========================================================

CREATE DATABASE IF NOT EXISTS smartkost_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE smartkost_db;

-- 1. Tabel Pengaturan Profil Kos
CREATE TABLE IF NOT EXISTS pengaturan_kos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nama_kos VARCHAR(100) NOT NULL DEFAULT 'SmartKost Residence',
    tagline VARCHAR(200) NOT NULL DEFAULT 'Hunian Nyaman, Aman, dan Strategis untuk Mahasiswa & Profesional',
    deskripsi TEXT,
    alamat TEXT,
    no_wa VARCHAR(25) DEFAULT '081234567890',
    denda_per_hari INT DEFAULT 10000,
    foto_banner LONGTEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Tabel Pengguna (Admin & Penghuni)
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    nama_lengkap VARCHAR(100) NOT NULL,
    role ENUM('admin', 'penghuni') NOT NULL DEFAULT 'penghuni',
    foto_profil LONGTEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabel Kamar Kos
CREATE TABLE IF NOT EXISTS kamar (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nomor_kamar VARCHAR(20) UNIQUE NOT NULL,
    lantai INT NOT NULL DEFAULT 1,
    tipe ENUM('Reguler', 'VIP', 'Eksklusif') NOT NULL DEFAULT 'Reguler',
    harga_sewa INT NOT NULL,
    luas_kamar VARCHAR(20) DEFAULT '3x4 m',
    fasilitas TEXT,
    deskripsi TEXT,
    foto_kamar LONGTEXT,
    status ENUM('Tersedia', 'Terisi', 'Perbaikan') NOT NULL DEFAULT 'Tersedia',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabel Permohonan Booking Online (Dari Landing Page)
CREATE TABLE IF NOT EXISTS booking (
    id INT PRIMARY KEY AUTO_INCREMENT,
    kamar_id INT NOT NULL,
    nama_pemohon VARCHAR(100) NOT NULL,
    no_hp VARCHAR(25) NOT NULL,
    pekerjaan VARCHAR(100),
    asal_kota VARCHAR(100),
    tanggal_mulai DATE NOT NULL,
    durasi_bulan INT NOT NULL DEFAULT 1,
    catatan TEXT,
    foto_ktp LONGTEXT,
    status ENUM('Pending', 'Disetujui', 'Ditolak') NOT NULL DEFAULT 'Pending',
    alasan_penolakan VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (kamar_id) REFERENCES kamar(id) ON DELETE CASCADE
);

-- 5. Tabel Data Penghuni
CREATE TABLE IF NOT EXISTS penghuni (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NULL,
    kamar_id INT NULL,
    nama VARCHAR(100) NOT NULL,
    no_hp VARCHAR(25) NOT NULL,
    pekerjaan VARCHAR(100),
    asal_kota VARCHAR(100),
    tanggal_masuk DATE NOT NULL,
    tanggal_keluar DATE NULL,
    foto_ktp LONGTEXT,
    status ENUM('Aktif', 'Keluar') NOT NULL DEFAULT 'Aktif',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (kamar_id) REFERENCES kamar(id) ON DELETE SET NULL
);

-- 6. Tabel Tagihan & Pembayaran Sewa
CREATE TABLE IF NOT EXISTS tagihan_pembayaran (
    id INT PRIMARY KEY AUTO_INCREMENT,
    penghuni_id INT NOT NULL,
    kamar_id INT NOT NULL,
    kode_invoice VARCHAR(50) UNIQUE NOT NULL,
    bulan_tahun VARCHAR(20) NOT NULL, -- Format: YYYY-MM
    nominal INT NOT NULL,
    denda INT NOT NULL DEFAULT 0,
    total_bayar INT NOT NULL,
    jatuh_tempo DATE NOT NULL,
    tanggal_bayar DATE NULL,
    metode_pembayaran ENUM('Tunai', 'Transfer Bank', 'QRIS') NULL,
    bukti_transfer LONGTEXT NULL,
    status ENUM('Belum Bayar', 'Menunggu Konfirmasi', 'Lunas') NOT NULL DEFAULT 'Belum Bayar',
    catatan VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (penghuni_id) REFERENCES penghuni(id) ON DELETE CASCADE,
    FOREIGN KEY (kamar_id) REFERENCES kamar(id) ON DELETE CASCADE
);

-- 7. Tabel Pengeluaran Operasional
CREATE TABLE IF NOT EXISTS pengeluaran (
    id INT PRIMARY KEY AUTO_INCREMENT,
    kategori ENUM('Listrik', 'Air', 'WiFi', 'Kebersihan', 'Maintenance', 'Lainnya') NOT NULL DEFAULT 'Lainnya',
    keterangan VARCHAR(255) NOT NULL,
    nominal INT NOT NULL,
    tanggal DATE NOT NULL,
    bukti_nota LONGTEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Tabel Keluhan & Maintenance Penghuni
CREATE TABLE IF NOT EXISTS keluhan (
    id INT PRIMARY KEY AUTO_INCREMENT,
    penghuni_id INT NOT NULL,
    kamar_id INT NOT NULL,
    judul VARCHAR(150) NOT NULL,
    deskripsi TEXT NOT NULL,
    prioritas ENUM('Rendah', 'Sedang', 'Tinggi') NOT NULL DEFAULT 'Sedang',
    foto_keluhan LONGTEXT NULL,
    status ENUM('Menunggu', 'Diproses', 'Selesai') NOT NULL DEFAULT 'Menunggu',
    tindakan TEXT NULL,
    biaya_perbaikan INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (penghuni_id) REFERENCES penghuni(id) ON DELETE CASCADE,
    FOREIGN KEY (kamar_id) REFERENCES kamar(id) ON DELETE CASCADE
);

-- 9. Tabel Log Audit Aktivitas
CREATE TABLE IF NOT EXISTS log_aktivitas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NULL,
    username VARCHAR(50) NOT NULL,
    role VARCHAR(20) NOT NULL,
    aksi VARCHAR(100) NOT NULL,
    detail TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Default Data: Profil Kos
INSERT INTO pengaturan_kos (nama_kos, tagline, deskripsi, alamat, no_wa, denda_per_hari)
VALUES (
    'Kost Cemara',
    'Hunian Eksklusif, Bersih & Strategis dengan Fasilitas Lengkap',
    'Kost Cemara menyediakan kenyamanan hunian eksklusif berstandar tinggi dengan penawaran harga bersahabat mahasiswa, fasilitas lengkap (AC, Kamar Mandi Dalam, WiFi kencang, Water Heater), serta keamanan terjamin.',
    'Jl. Cemara No. 18, Dago, Coblong, Kota Bandung, Jawa Barat 40132',
    '081234567890',
    10000
) ON DUPLICATE KEY UPDATE id=id;

-- Default Data: Akun Admin
INSERT INTO users (username, password, nama_lengkap, role)
VALUES ('admin', 'admin123', 'Administrator Kost', 'admin')
ON DUPLICATE KEY UPDATE id=id;

