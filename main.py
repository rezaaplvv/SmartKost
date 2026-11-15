"""
============================================================
SmartKost Pro - Integrated Boarding House Management System
Main Entry Point with Python Eel & Asynchronous Bridge
============================================================
"""

import os
import sys
import eel

# Pastikan BASE_DIR dan modules dapat diakses
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

# Import Database & Utility
from db import cek_koneksi_db, set_db_config

# Import Modul-Modul Backend
import modules.auth as auth_mod
import modules.kamar as kamar_mod
import modules.penghuni as penghuni_mod
import modules.keuangan as keuangan_mod
import modules.laporan as laporan_mod

# Inisialisasi folder frontend web
WEB_DIR = os.path.join(BASE_DIR, "web")
os.makedirs(WEB_DIR, exist_ok=True)
eel.init(WEB_DIR)


# ==========================================================
# 1. EXPOSE SYSTEM & DIAGNOSTIK
# ==========================================================

@eel.expose
def cek_status_sistem():
    """Memeriksa kesiapan database dan server."""
    status, pesan = cek_koneksi_db()
    return {
        "status": status,
        "pesan": pesan,
        "app_name": "SmartKost Pro",
        "version": "1.0.0"
    }


# ==========================================================
# 2. EXPOSE AUTHENTIKASI & LOG
# ==========================================================

@eel.expose
def login(username, password):
    return auth_mod.login_user(username, password)

@eel.expose
def register(username, password, nama_lengkap, no_hp=""):
    return auth_mod.register_penghuni(username, password, nama_lengkap, no_hp)

@eel.expose
def ganti_password(user_id, password_lama, password_baru):
    return auth_mod.ganti_password(user_id, password_lama, password_baru)

@eel.expose
def get_user_profile(user_id):
    return auth_mod.get_profile(user_id)

@eel.expose
def update_user_profile(user_id, nama_lengkap, foto_profil=None):
    return auth_mod.update_profile(user_id, nama_lengkap, foto_profil)

@eel.expose
def get_logs(limit=50):
    return auth_mod.get_log_aktivitas(limit)


# ==========================================================
# 3. EXPOSE KAMAR & PROFIL KOS
# ==========================================================

@eel.expose
def get_kamar(filter_lantai=None, filter_status=None, filter_tipe=None, search=None):
    return kamar_mod.get_semua_kamar(filter_lantai, filter_status, filter_tipe, search)

@eel.expose
def get_kamar_detail(kamar_id):
    return kamar_mod.get_kamar_by_id(kamar_id)

@eel.expose
def tambah_kamar(nomor_kamar, lantai, tipe, harga_sewa, luas_kamar="3x4 m", fasilitas="", deskripsi="", foto_kamar=None, admin_user="admin"):
    return kamar_mod.tambah_kamar(nomor_kamar, lantai, tipe, harga_sewa, luas_kamar, fasilitas, deskripsi, foto_kamar, admin_user)

@eel.expose
def ubah_kamar(kamar_id, nomor_kamar, lantai, tipe, harga_sewa, luas_kamar, fasilitas, deskripsi, status, foto_kamar=None, admin_user="admin"):
    return kamar_mod.ubah_kamar(kamar_id, nomor_kamar, lantai, tipe, harga_sewa, luas_kamar, fasilitas, deskripsi, status, foto_kamar, admin_user)

@eel.expose
def hapus_kamar(kamar_id, admin_user="admin"):
    return kamar_mod.hapus_kamar(kamar_id, admin_user)

@eel.expose
def get_denah():
    return kamar_mod.get_denah_kamar()

@eel.expose
def get_kamar_stats():
    return kamar_mod.get_statistik_kamar()

@eel.expose
def get_pengaturan():
    return kamar_mod.get_pengaturan_kos()

@eel.expose
def update_pengaturan(
    nama_kos,
    tagline,
    deskripsi,
    alamat,
    no_wa,
    denda_per_hari=10000,
    foto_banner=None,
    admin_user="admin",
    nama_bank=None,
    no_rekening=None,
    atas_nama_rekening=None,
    foto_qris=None
):
    return kamar_mod.update_pengaturan_kos(
        nama_kos,
        tagline,
        deskripsi,
        alamat,
        no_wa,
        denda_per_hari,
        foto_banner,
        admin_user,
        nama_bank,
        no_rekening,
        atas_nama_rekening,
        foto_qris
    )


# ==========================================================
# 4. EXPOSE BOOKING & PENGHUNI
# ==========================================================

@eel.expose
def ajukan_booking(kamar_id, nama_pemohon, no_hp, pekerjaan="", asal_kota="", tanggal_mulai=None, durasi_bulan=1, catatan="", foto_ktp=None):
    return penghuni_mod.ajukan_booking(kamar_id, nama_pemohon, no_hp, pekerjaan, asal_kota, tanggal_mulai, durasi_bulan, catatan, foto_ktp)

@eel.expose
def get_booking(status=None):
    return penghuni_mod.get_daftar_booking(status)

@eel.expose
def proses_booking(booking_id, aksi, alasan_penolakan=None, admin_user="admin"):
    return penghuni_mod.proses_booking(booking_id, aksi, alasan_penolakan, admin_user)

@eel.expose
def checkin_penghuni(kamar_id, nama, no_hp, pekerjaan="", asal_kota="", tanggal_masuk=None, foto_ktp=None, buat_user=True, username=None, password=None, admin_user="admin"):
    return penghuni_mod.checkin_penghuni(kamar_id, nama, no_hp, pekerjaan, asal_kota, tanggal_masuk, foto_ktp, buat_user, username, password, admin_user)

@eel.expose
def get_penghuni(status="Aktif", search=None):
    return penghuni_mod.get_daftar_penghuni(status, search)

@eel.expose
def get_penghuni_detail(penghuni_id):
    return penghuni_mod.get_detail_penghuni(penghuni_id)

@eel.expose
def ubah_penghuni(penghuni_id, nama, no_hp, pekerjaan, asal_kota, admin_user="admin"):
    return penghuni_mod.ubah_penghuni(penghuni_id, nama, no_hp, pekerjaan, asal_kota, admin_user)

@eel.expose
def pindah_kamar(penghuni_id, kamar_id_baru, admin_user="admin"):
    return penghuni_mod.pindah_kamar(penghuni_id, kamar_id_baru, admin_user)

@eel.expose
def checkout_penghuni(penghuni_id, tanggal_keluar=None, admin_user="admin"):
    return penghuni_mod.checkout_penghuni(penghuni_id, tanggal_keluar, admin_user)


# ==========================================================
# 5. EXPOSE KEUANGAN, TAGIHAN, PENGELUARAN & KELUHAN
# ==========================================================

@eel.expose
def get_tagihan(filter_status=None, bulan_tahun=None, search=None, penghuni_id=None):
    return keuangan_mod.get_daftar_tagihan(filter_status, bulan_tahun, search, penghuni_id)

@eel.expose
def generate_tagihan(bulan_tahun=None, admin_user="admin"):
    return keuangan_mod.generate_tagihan_bulanan(bulan_tahun, admin_user)

@eel.expose
def bayar_tagihan(tagihan_id, metode_pembayaran="Transfer Bank", bukti_transfer=None, catatan="", role="penghuni", user_nama="User"):
    return keuangan_mod.bayar_tagihan(tagihan_id, metode_pembayaran, bukti_transfer, catatan, role, user_nama)

@eel.expose
def verifikasi_tagihan(tagihan_id, status_verifikasi="Lunas", admin_user="admin"):
    return keuangan_mod.verifikasi_tagihan(tagihan_id, status_verifikasi, admin_user)

@eel.expose
def get_kuitansi(tagihan_id):
    return keuangan_mod.get_data_kuitansi(tagihan_id)

@eel.expose
def get_pengeluaran(bulan_tahun=None, kategori=None):
    return keuangan_mod.get_daftar_pengeluaran(bulan_tahun, kategori)

@eel.expose
def tambah_pengeluaran(kategori, keterangan, nominal, tanggal=None, bukti_nota=None, admin_user="admin"):
    return keuangan_mod.tambah_pengeluaran(kategori, keterangan, nominal, tanggal, bukti_nota, admin_user)

@eel.expose
def hapus_pengeluaran(pengeluaran_id, admin_user="admin"):
    return keuangan_mod.hapus_pengeluaran(pengeluaran_id, admin_user)

@eel.expose
def lapor_keluhan(penghuni_id, kamar_id, judul, deskripsi, prioritas="Sedang", foto_keluhan=None, user_nama="Penghuni"):
    return keuangan_mod.lapor_keluhan(penghuni_id, kamar_id, judul, deskripsi, prioritas, foto_keluhan, user_nama)

@eel.expose
def get_keluhan(status=None, penghuni_id=None):
    return keuangan_mod.get_daftar_keluhan(status, penghuni_id)

@eel.expose
def update_status_keluhan(keluhan_id, status_baru, tindakan="", biaya_perbaikan=0, admin_user="admin"):
    return keuangan_mod.update_status_keluhan(keluhan_id, status_baru, tindakan, biaya_perbaikan, admin_user)


# ==========================================================
# 6. EXPOSE LAPORAN & ANALITIK PANDAS
# ==========================================================

@eel.expose
def get_kpi():
    return laporan_mod.get_kpi_dashboard()

@eel.expose
def get_chart_cashflow(tahun=None):
    return laporan_mod.get_chart_cashflow(tahun)

@eel.expose
def get_chart_okupansi_tipe():
    return laporan_mod.get_chart_okupansi_tipe()

@eel.expose
def get_chart_pengeluaran(bulan_tahun=None):
    return laporan_mod.get_chart_kategori_pengeluaran(bulan_tahun)

@eel.expose
def export_keuangan_excel(tahun=None):
    return laporan_mod.export_laporan_keuangan_excel(tahun)

@eel.expose
def export_penghuni_excel():
    return laporan_mod.export_data_penghuni_excel()

@eel.expose
def export_csv(jenis="pemasukan", tahun=None):
    return laporan_mod.export_laporan_csv(jenis, tahun)


# ==========================================================
# RUNNER APLIKASI
# ==========================================================

def start_app():
    print("=" * 60)
    print("   MEMULAI SMARTKOST PRO DESKTOP APPLICATION")
    print("=" * 60)

    # Periksa koneksi database sebelum meluncurkan GUI
    koneksi_ok, pesan_db = cek_koneksi_db()
    if not koneksi_ok:
        print(f"\n[PERINGATAN DATABASE]: {pesan_db}")
        print("Silakan pastikan XAMPP/MySQL aktif dan jalankan: python init_db.py\n")
    else:
        print(f"\n[DATABASE OK]: {pesan_db}\n")

    # Jalankan Eel dengan fallback jika browser tertentu tidak tersedia
    try:
        eel.start("index.html", size=(1280, 820), port=8000)
    except (SystemExit, KeyboardInterrupt):
        print("\nAplikasi SmartKost Pro telah ditutup.")
    except Exception as e:
        print(f"Mencoba mode browser alternatif... (Detail: {e})")
        try:
            eel.start("index.html", size=(1280, 820), port=8000, mode=None)
        except Exception as err:
            print(f"Gagal menjalankan antarmuka desktop: {err}")


if __name__ == "__main__":
    start_app()

