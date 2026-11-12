"""
Database Initializer and Realistic Data Seeder for SmartKost Pro
Jalankan file ini untuk membuat database, 9 tabel, dan mengisi data simulasi 6 bulan.
"""

import sys
import datetime
import mysql.connector
from mysql.connector import Error

from db import DB_CONFIG, koneksi_db, tutup_koneksi


DDL_TABLES = [
    """
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
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        nama_lengkap VARCHAR(100) NOT NULL,
        role ENUM('admin', 'penghuni') NOT NULL DEFAULT 'penghuni',
        foto_profil LONGTEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
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
    )
    """,
    """
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
    )
    """,
    """
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
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS tagihan_pembayaran (
        id INT PRIMARY KEY AUTO_INCREMENT,
        penghuni_id INT NOT NULL,
        kamar_id INT NOT NULL,
        kode_invoice VARCHAR(50) UNIQUE NOT NULL,
        bulan_tahun VARCHAR(20) NOT NULL,
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
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS pengeluaran (
        id INT PRIMARY KEY AUTO_INCREMENT,
        kategori ENUM('Listrik', 'Air', 'WiFi', 'Kebersihan', 'Maintenance', 'Lainnya') NOT NULL DEFAULT 'Lainnya',
        keterangan VARCHAR(255) NOT NULL,
        nominal INT NOT NULL,
        tanggal DATE NOT NULL,
        bukti_nota LONGTEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
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
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS log_aktivitas (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NULL,
        username VARCHAR(50) NOT NULL,
        role VARCHAR(20) NOT NULL,
        aksi VARCHAR(100) NOT NULL,
        detail TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """
]


def init_database():
    print("=" * 60)
    print("   SMARTKOST PRO - DATABASE INITIALIZATION & SEEDER")
    print("=" * 60)

    # 1. Buat database jika belum ada
    print("\n[1/4] Memeriksa & membuat database 'smartkost_db'...")
    try:
        conn = koneksi_db(database="")
        cursor = conn.cursor()
        cursor.execute("CREATE DATABASE IF NOT EXISTS smartkost_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
        conn.commit()
        tutup_koneksi(cursor, conn)
        print("  -> Database 'smartkost_db' siap!")
    except Error as e:
        print(f"  [ERROR] Gagal membuat database: {e}")
        return False

    # 2. Buat seluruh tabel
    print("\n[2/4] Membuat 9 tabel relasional...")
    try:
        conn = koneksi_db(database="smartkost_db")
        cursor = conn.cursor()

        for ddl in DDL_TABLES:
            cursor.execute(ddl)
        conn.commit()
        tutup_koneksi(cursor, conn)
        print("  -> 9 Tabel berhasil diverifikasi & dibuat!")
    except Error as e:
        print(f"  [ERROR] Gagal membuat tabel: {e}")
        return False

    # 3. Seed data profil & akun pengguna
    print("\n[3/4] Melakukan seeding data awal (Akun, Kamar, Penghuni)...")
    try:
        conn = koneksi_db(database="smartkost_db")
        cursor = conn.cursor(dictionary=True)

        # 3.1 Profil Kos
        cursor.execute("SELECT COUNT(*) AS total FROM pengaturan_kos")
        if cursor.fetchone()["total"] == 0:
            cursor.execute("""
                INSERT INTO pengaturan_kos (nama_kos, tagline, deskripsi, alamat, no_wa, denda_per_hari)
                VALUES (
                    'SmartKost Residence',
                    'Hunian Eksklusif, Bersih & Strategis dengan Fasilitas Lengkap',
                    'SmartKost Residence adalah pilihan hunian modern terbaik dekat kampus dan kawasan bisnis. Dilengkapi fasilitas berkecepatan tinggi, keamanan CCTV 24 jam, kamar mandi dalam, AC, dan lingkungan yang kondusif.',
                    'Jl. Ganesha No. 10, Coblong, Kota Bandung, Jawa Barat 40132',
                    '081234567890',
                    10000
                )
            """)

        # 3.2 Akun Admin
        cursor.execute("SELECT COUNT(*) AS total FROM users WHERE username = 'admin'")
        if cursor.fetchone()["total"] == 0:
            cursor.execute("""
                INSERT INTO users (username, password, nama_lengkap, role)
                VALUES ('admin', 'admin123', 'Administrator Utama', 'admin')
            """)

        # 3.3 Data Kamar (8 Kamar: 4 di Lantai 1, 4 di Lantai 2)
        cursor.execute("SELECT COUNT(*) AS total FROM kamar")
        if cursor.fetchone()["total"] == 0:
            kamar_data = [
                # Lantai 1
                ('A-01', 1, 'Reguler', 1200000, '3x4 m', 'Kasur Springbed, Lemari Pakaian, Meja Belajar, WiFi, Kamar Mandi Luar', 'Kamar reguler lantai 1 dengan pencahayaan alami yang baik.', 'Terisi'),
                ('A-02', 1, 'VIP', 1800000, '4x4 m', 'AC Inverter, Kasur Queen, Kamar Mandi Dalam, Water Heater, Meja Kerja, WiFi', 'Kamar VIP nyaman dengan kamar mandi dalam & water heater.', 'Terisi'),
                ('A-03', 1, 'Reguler', 1200000, '3x4 m', 'Kasur Springbed, Lemari Pakaian, Meja Belajar, WiFi, Kamar Mandi Luar', 'Kamar nyaman dekat ruang santai dan dapur bersama.', 'Tersedia'),
                ('A-04', 1, 'Eksklusif', 2500000, '5x4 m', 'Smart TV 43\", AC, Kulkas Mini, Balkon Pribadi, Water Heater, Smart Lock', 'Kamar suite mewah dengan balkon pribadi & fasilitas lengkap.', 'Perbaikan'),
                # Lantai 2
                ('B-01', 2, 'VIP', 1850000, '4x4 m', 'AC Inverter, Kasur Queen, Kamar Mandi Dalam, Water Heater, WiFi 100 Mbps', 'Kamar VIP lantai 2 yang tenang dengan sirkulasi udara sejuk.', 'Terisi'),
                ('B-02', 2, 'Reguler', 1250000, '3x4 m', 'Kasur Springbed, Lemari Pakaian, Meja Belajar, WiFi, Kamar Mandi Luar', 'Kamar reguler lantai 2 berpemandangan taman asri.', 'Terisi'),
                ('B-03', 2, 'VIP', 1900000, '4x4 m', 'AC, Kamar Mandi Dalam, Balkon View Taman, WiFi, Meja Kerja Ergonomis', 'Kamar VIP lantai 2 siap huni dengan balkon sejuk.', 'Tersedia'),
                ('B-04', 2, 'Eksklusif', 2600000, '5x4 m', 'Smart TV 43\", AC Inverter, Kulkas Mini, Balkon Luas, Water Heater, Smart Door Lock', 'Kamar paling luas di lantai 2 dengan privasi maksimal.', 'Tersedia'),
            ]
            cursor.executemany("""
                INSERT INTO kamar (nomor_kamar, lantai, tipe, harga_sewa, luas_kamar, fasilitas, deskripsi, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, kamar_data)

        # 3.4 Ambil ID Kamar untuk menghubungkan Penghuni
        cursor.execute("SELECT id, nomor_kamar, harga_sewa FROM kamar")
        map_kamar = {row["nomor_kamar"]: row for row in cursor.fetchall()}

        # 3.5 Penghuni & Akun Penghuni
        cursor.execute("SELECT COUNT(*) AS total FROM penghuni")
        if cursor.fetchone()["total"] == 0:
            penghuni_init = [
                {
                    "username": "budi",
                    "nama": "Budi Santoso",
                    "hp": "081299887766",
                    "pekerjaan": "Mahasiswa ITB",
                    "asal": "Bandung",
                    "kamar": "A-01",
                    "masuk": "2026-06-01",
                    "status": "Aktif"
                },
                {
                    "username": "siti",
                    "nama": "Siti Nurhaliza",
                    "hp": "081377665544",
                    "pekerjaan": "UI/UX Designer",
                    "asal": "Jakarta",
                    "kamar": "A-02",
                    "masuk": "2026-07-01",
                    "status": "Aktif"
                },
                {
                    "username": "reza",
                    "nama": "Reza Pratama",
                    "hp": "081955443322",
                    "pekerjaan": "Software Engineer",
                    "asal": "Surabaya",
                    "kamar": "B-01",
                    "masuk": "2026-08-01",
                    "status": "Aktif"
                },
                {
                    "username": "dinda",
                    "nama": "Dinda Kirana",
                    "hp": "082133221100",
                    "pekerjaan": "Mahasiswi Kedokteran",
                    "asal": "Bogor",
                    "kamar": "B-02",
                    "masuk": "2026-09-01",
                    "status": "Aktif"
                },
                {
                    "username": "fauzi",
                    "nama": "Ahmad Fauzi",
                    "hp": "085211009988",
                    "pekerjaan": "Data Analyst",
                    "asal": "Yogyakarta",
                    "kamar": "A-03",
                    "masuk": "2026-05-01",
                    "keluar": "2026-10-31",
                    "status": "Keluar"
                }
            ]

            for p in penghuni_init:
                # Buat akun user
                cursor.execute("""
                    INSERT INTO users (username, password, nama_lengkap, role)
                    VALUES (%s, %s, %s, 'penghuni')
                """, (p["username"], "user123", p["nama"]))
                user_id = cursor.lastrowid

                # Hubungkan ke kamar
                kamar_info = map_kamar.get(p["kamar"])
                kamar_id = kamar_info["id"] if kamar_info and p["status"] == "Aktif" else None
                tgl_keluar = p.get("keluar", None)

                cursor.execute("""
                    INSERT INTO penghuni (user_id, kamar_id, nama, no_hp, pekerjaan, asal_kota, tanggal_masuk, tanggal_keluar, status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (user_id, kamar_id, p["nama"], p["hp"], p["pekerjaan"], p["asal"], p["masuk"], tgl_keluar, p["status"]))

        conn.commit()
        tutup_koneksi(cursor, conn)
        print("  -> Data Akun, Kamar, dan Penghuni siap!")
    except Error as e:
        print(f"  [ERROR] Gagal seeding data awal: {e}")
        return False

    # 4. Seed Histori Keuangan 6 Bulan (Tagihan, Pengeluaran, Booking, Keluhan)
    print("\n[4/4] Melakukan seeding transaksi 6 bulan terakhir untuk analitik Pandas...")
    try:
        conn = koneksi_db(database="smartkost_db")
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT COUNT(*) AS total FROM tagihan_pembayaran")
        if cursor.fetchone()["total"] == 0:
            cursor.execute("SELECT id, nama, kamar_id, tanggal_masuk FROM penghuni WHERE status = 'Aktif'")
            penghuni_list = cursor.fetchall()

            # Bulan simulasi: Juni 2026 s/d November 2026
            daftar_bulan = [
                ("2026-06", datetime.date(2026, 6, 10)),
                ("2026-07", datetime.date(2026, 7, 10)),
                ("2026-08", datetime.date(2026, 8, 10)),
                ("2026-09", datetime.date(2026, 9, 10)),
                ("2026-10", datetime.date(2026, 10, 10)),
                ("2026-11", datetime.date(2026, 11, 10)),
            ]

            invoice_counter = 100
            for p in penghuni_list:
                cursor.execute("SELECT harga_sewa FROM kamar WHERE id = %s", (p["kamar_id"],))
                kamar_row = cursor.fetchone()
                harga = kamar_row["harga_sewa"] if kamar_row else 1500000

                tgl_masuk_str = str(p["tanggal_masuk"])[:7]  # YYYY-MM

                for bln, jatuh_tempo in daftar_bulan:
                    if bln < tgl_masuk_str:
                        continue  # Belum masuk kos pada bulan ini

                    invoice_counter += 1
                    kode_inv = f"INV/{bln.replace('-', '')}/{invoice_counter}"

                    if bln < "2026-11":
                        # Bulan-bulan lalu: LUNAS
                        tgl_bayar = jatuh_tempo - datetime.timedelta(days=2)
                        cursor.execute("""
                            INSERT INTO tagihan_pembayaran 
                            (penghuni_id, kamar_id, kode_invoice, bulan_tahun, nominal, denda, total_bayar, jatuh_tempo, tanggal_bayar, metode_pembayaran, status, catatan)
                            VALUES (%s, %s, %s, %s, %s, 0, %s, %s, %s, 'Transfer Bank', 'Lunas', 'Pembayaran sewa tepat waktu')
                        """, (p["id"], p["kamar_id"], kode_inv, bln, harga, harga, jatuh_tempo, tgl_bayar))
                    else:
                        # Bulan berjalan (November 2026): Variasi status
                        if p["nama"] == "Budi Santoso":
                            cursor.execute("""
                                INSERT INTO tagihan_pembayaran 
                                (penghuni_id, kamar_id, kode_invoice, bulan_tahun, nominal, denda, total_bayar, jatuh_tempo, tanggal_bayar, metode_pembayaran, status, catatan)
                                VALUES (%s, %s, %s, %s, %s, 0, %s, %s, %s, 'QRIS', 'Lunas', 'Lunas via QRIS')
                            """, (p["id"], p["kamar_id"], kode_inv, bln, harga, harga, jatuh_tempo, jatuh_tempo - datetime.timedelta(days=1)))
                        elif p["nama"] == "Siti Nurhaliza":
                            cursor.execute("""
                                INSERT INTO tagihan_pembayaran 
                                (penghuni_id, kamar_id, kode_invoice, bulan_tahun, nominal, denda, total_bayar, jatuh_tempo, tanggal_bayar, metode_pembayaran, status, catatan)
                                VALUES (%s, %s, %s, %s, %s, 0, %s, %s, %s, 'Transfer Bank', 'Lunas', 'Lunas via Transfer BCA')
                            """, (p["id"], p["kamar_id"], kode_inv, bln, harga, harga, jatuh_tempo, jatuh_tempo - datetime.timedelta(days=3)))
                        elif p["nama"] == "Reza Pratama":
                            cursor.execute("""
                                INSERT INTO tagihan_pembayaran 
                                (penghuni_id, kamar_id, kode_invoice, bulan_tahun, nominal, denda, total_bayar, jatuh_tempo, tanggal_bayar, metode_pembayaran, status, catatan)
                                VALUES (%s, %s, %s, %s, %s, 0, %s, %s, NULL, 'Transfer Bank', 'Menunggu Konfirmasi', 'Sudah transfer, menunggu verifikasi admin')
                            """, (p["id"], p["kamar_id"], kode_inv, bln, harga, harga, jatuh_tempo))
                        else:  # Dinda Kirana
                            cursor.execute("""
                                INSERT INTO tagihan_pembayaran 
                                (penghuni_id, kamar_id, kode_invoice, bulan_tahun, nominal, denda, total_bayar, jatuh_tempo, tanggal_bayar, metode_pembayaran, status, catatan)
                                VALUES (%s, %s, %s, %s, %s, 0, %s, %s, NULL, NULL, 'Belum Bayar', 'Mendekati tanggal jatuh tempo')
                            """, (p["id"], p["kamar_id"], kode_inv, bln, harga, harga, jatuh_tempo))

        # 4.2 Pengeluaran Operasional Rutin 6 Bulan
        cursor.execute("SELECT COUNT(*) AS total FROM pengeluaran")
        if cursor.fetchone()["total"] == 0:
            pengeluaran_data = [
                # Juni 2026
                ('Listrik', 'Token Listrik Utama & Pompa Air Juni', 1250000, '2026-06-05'),
                ('WiFi', 'Langganan Internet IndiHome 100 Mbps Juni', 550000, '2026-06-08'),
                ('Air', 'Tagihan Air PDAM Juni', 320000, '2026-06-12'),
                ('Kebersihan', 'Iuran Kebersihan Lingkungan & Angkut Sampah', 150000, '2026-06-15'),
                # Juli 2026
                ('Listrik', 'Token Listrik Utama & Pompa Air Juli', 1350000, '2026-07-05'),
                ('WiFi', 'Langganan Internet IndiHome 100 Mbps Juli', 550000, '2026-07-08'),
                ('Air', 'Tagihan Air PDAM Juli', 340000, '2026-07-12'),
                ('Kebersihan', 'Iuran Kebersihan Lingkungan & Angkut Sampah', 150000, '2026-07-15'),
                ('Maintenance', 'Servis Berkala AC Kamar A-02 & B-01', 300000, '2026-07-20'),
                # Agustus 2026
                ('Listrik', 'Token Listrik Utama & Pompa Air Agustus', 1400000, '2026-08-05'),
                ('WiFi', 'Langganan Internet IndiHome 100 Mbps Agustus', 550000, '2026-08-08'),
                ('Air', 'Tagihan Air PDAM Agustus', 310000, '2026-08-12'),
                ('Kebersihan', 'Iuran Kebersihan Lingkungan & Angkut Sampah', 150000, '2026-08-15'),
                # September 2026
                ('Listrik', 'Token Listrik Utama & Pompa Air September', 1450000, '2026-09-05'),
                ('WiFi', 'Langganan Internet IndiHome 100 Mbps September', 550000, '2026-09-08'),
                ('Air', 'Tagihan Air PDAM September', 360000, '2026-09-12'),
                ('Kebersihan', 'Iuran Kebersihan Lingkungan & Angkut Sampah', 150000, '2026-09-15'),
                ('Maintenance', 'Ganti Pompa Air Pendorong Baru', 750000, '2026-09-18'),
                # Oktober 2026
                ('Listrik', 'Token Listrik Utama & Pompa Air Oktober', 1500000, '2026-10-05'),
                ('WiFi', 'Langganan Internet IndiHome 100 Mbps Oktober', 550000, '2026-10-08'),
                ('Air', 'Tagihan Air PDAM Oktober', 330000, '2026-10-12'),
                ('Kebersihan', 'Iuran Kebersihan Lingkungan & Angkut Sampah', 150000, '2026-10-15'),
                ('Maintenance', 'Perbaikan Plafon Kamar A-04', 350000, '2026-10-25'),
                # November 2026
                ('Listrik', 'Token Listrik Utama & Pompa Air November', 1480000, '2026-11-05'),
                ('WiFi', 'Langganan Internet IndiHome 100 Mbps November', 550000, '2026-11-08'),
                ('Air', 'Tagihan Air PDAM November', 350000, '2026-11-12'),
                ('Kebersihan', 'Iuran Kebersihan Lingkungan & Angkut Sampah', 150000, '2026-11-15'),
            ]
            cursor.executemany("""
                INSERT INTO pengeluaran (kategori, keterangan, nominal, tanggal)
                VALUES (%s, %s, %s, %s)
            """, pengeluaran_data)

        # 4.3 Data Booking Online Masuk
        cursor.execute("SELECT COUNT(*) AS total FROM booking")
        if cursor.fetchone()["total"] == 0:
            cursor.execute("SELECT id FROM kamar WHERE nomor_kamar = 'B-03'")
            kamar_b03 = cursor.fetchone()["id"]
            cursor.execute("SELECT id FROM kamar WHERE nomor_kamar = 'B-04'")
            kamar_b04 = cursor.fetchone()["id"]

            booking_data = [
                (kamar_b03, 'Kevin Sanjaya', '081288990011', 'Data Scientist', 'Medan', '2026-12-01', 6, 'Rencana sewa 6 bulan, mohon info ketersediaan', 'Pending'),
                (kamar_b04, 'Alika Putri', '085733445566', 'Mahasiswi Arsitektur', 'Semarang', '2026-12-15', 3, 'Tertarik dengan kamar tipe Eksklusif balkon', 'Pending')
            ]
            cursor.executemany("""
                INSERT INTO booking (kamar_id, nama_pemohon, no_hp, pekerjaan, asal_kota, tanggal_mulai, durasi_bulan, catatan, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, booking_data)

        # 4.4 Data Keluhan / Maintenance
        cursor.execute("SELECT COUNT(*) AS total FROM keluhan")
        if cursor.fetchone()["total"] == 0:
            cursor.execute("SELECT id, kamar_id FROM penghuni WHERE nama = 'Siti Nurhaliza'")
            siti_info = cursor.fetchone()
            cursor.execute("SELECT id, kamar_id FROM penghuni WHERE nama = 'Budi Santoso'")
            budi_info = cursor.fetchone()

            if siti_info:
                cursor.execute("""
                    INSERT INTO keluhan (penghuni_id, kamar_id, judul, deskripsi, prioritas, status, tindakan, biaya_perbaikan)
                    VALUES (%s, %s, 'Kran shower bocor halus', 'Air kran kamar mandi terus menetes saat ditutup rapat', 'Sedang', 'Selesai', 'Penggantian seal karet dan kepala shower baru', 75000)
                """, (siti_info["id"], siti_info["kamar_id"]))

            if budi_info:
                cursor.execute("""
                    INSERT INTO keluhan (penghuni_id, kamar_id, judul, deskripsi, prioritas, status, tindakan, biaya_perbaikan)
                    VALUES (%s, %s, 'Lampu meja belajar berkedip', 'Lampu meja belajar kadang redup dan berkedip saat malam', 'Rendah', 'Diproses', 'Petugas sedang menyiapkan bohlam pengganti', 0)
                """, (budi_info["id"], budi_info["kamar_id"]))

        # 4.5 Log Aktivitas Awal
        cursor.execute("SELECT COUNT(*) AS total FROM log_aktivitas")
        if cursor.fetchone()["total"] == 0:
            log_data = [
                (1, 'admin', 'admin', 'Inisialisasi Sistem', 'Database dan modul SmartKost Pro berhasil dikonfigurasi.'),
                (1, 'admin', 'admin', 'Verifikasi Pembayaran', 'Admin memverifikasi pembayaran tagihan sewa Kamar A-01.'),
                (1, 'admin', 'admin', 'Pencatatan Pengeluaran', 'Mencatat pengeluaran rutin listrik dan internet bulan berjalan.')
            ]
            cursor.executemany("""
                INSERT INTO log_aktivitas (user_id, username, role, aksi, detail)
                VALUES (%s, %s, %s, %s, %s)
            """, log_data)

        conn.commit()
        tutup_koneksi(cursor, conn)
        print("  -> Transaksi, Booking, Keluhan, dan Log berhasil di-seeding!")
    except Error as e:
        print(f"  [ERROR] Gagal seeding transaksi: {e}")
        return False

    print("\n" + "=" * 60)
    print("   SELURUH DATABASE & DATA DUMMY BERHASIL DI-SETUP!")
    print("=" * 60)
    print("\nAkun Default:")
    print("  - Admin    : username 'admin', password 'admin123'")
    print("  - Penghuni : username 'budi', 'siti', 'reza', password 'user123'")
    print("\nSekarang Anda dapat menjalankan: python main.py")
    return True


if __name__ == "__main__":
    sukses = init_database()
    if not sukses:
        sys.exit(1)
