"""
Announcement Board (Papan Pengumuman Kos) Module for SmartKost Pro
"""

from db import execute_query
from modules.auth import catat_log

VALID_KATEGORI = ("Info Umum", "Maintenance", "Penting")
_table_ready = False


def ensure_pengumuman_table():
    """Memastikan tabel pengumuman tersedia pada database aktif."""
    global _table_ready
    if _table_ready:
        return True

    query = """
        CREATE TABLE IF NOT EXISTS pengumuman (
            id INT PRIMARY KEY AUTO_INCREMENT,
            judul VARCHAR(160) NOT NULL,
            isi TEXT NOT NULL,
            kategori ENUM('Info Umum', 'Maintenance', 'Penting') NOT NULL DEFAULT 'Info Umum',
            is_pinned TINYINT(1) NOT NULL DEFAULT 0,
            dibuat_oleh VARCHAR(80) DEFAULT 'admin',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """
    res = execute_query(query, commit=True)
    if res["status"]:
        _table_ready = True
    return res["status"]


def _normalize_kategori(kategori):
    val = str(kategori or "Info Umum").strip()
    return val if val in VALID_KATEGORI else "Info Umum"


def get_daftar_pengumuman(kategori=None, limit=50):
    """Mengambil daftar pengumuman diurutkan dari yang disematkan dan terbaru."""
    ensure_pengumuman_table()

    try:
        limit_val = max(1, min(int(limit or 50), 200))
    except (ValueError, TypeError):
        limit_val = 50

    conditions = []
    params = []

    if kategori and kategori != "Semua" and kategori in VALID_KATEGORI:
        conditions.append("kategori = %s")
        params.append(kategori)

    where_clause = " WHERE " + " AND ".join(conditions) if conditions else ""
    query = f"""
        SELECT id, judul, isi, kategori, is_pinned, dibuat_oleh,
               DATE_FORMAT(created_at, '%d/%m/%Y %H:%i') AS waktu_buat,
               DATE_FORMAT(updated_at, '%d/%m/%Y %H:%i') AS waktu_ubah
        FROM pengumuman
        {where_clause}
        ORDER BY is_pinned DESC, id DESC
        LIMIT %s
    """
    params.append(limit_val)
    return execute_query(query, tuple(params), fetchall=True)


def tambah_pengumuman(judul, isi, kategori="Info Umum", is_pinned=False, admin_user="admin"):
    """Menambahkan pengumuman baru dari Admin ke Papan Pengumuman Kos."""
    ensure_pengumuman_table()

    judul = str(judul or "").strip()
    isi = str(isi or "").strip()
    if not judul or not isi:
        return {"status": False, "pesan": "Judul dan isi pengumuman wajib diisi."}

    kat = _normalize_kategori(kategori)
    pinned_flag = 1 if is_pinned else 0
    author = str(admin_user or "admin").strip() or "admin"

    query = """
        INSERT INTO pengumuman (judul, isi, kategori, is_pinned, dibuat_oleh)
        VALUES (%s, %s, %s, %s, %s)
    """
    res = execute_query(query, (judul, isi, kat, pinned_flag, author), commit=True, return_id=True)
    if res["status"]:
        catat_log(None, author, "admin", "Buat Pengumuman", f"[{kat}] {judul}")
        return {"status": True, "pesan": "Pengumuman berhasil diterbitkan ke Portal Penghuni.", "id": res["last_id"]}
    return {"status": False, "pesan": res["pesan"]}


def ubah_pengumuman(pengumuman_id, judul, isi, kategori="Info Umum", is_pinned=False, admin_user="admin"):
    """Memperbarui konten pengumuman yang sudah ada."""
    ensure_pengumuman_table()

    judul = str(judul or "").strip()
    isi = str(isi or "").strip()
    if not judul or not isi:
        return {"status": False, "pesan": "Judul dan isi pengumuman wajib diisi."}

    kat = _normalize_kategori(kategori)
    pinned_flag = 1 if is_pinned else 0
    author = str(admin_user or "admin").strip() or "admin"

    query = """
        UPDATE pengumuman
        SET judul = %s, isi = %s, kategori = %s, is_pinned = %s
        WHERE id = %s
    """
    res = execute_query(query, (judul, isi, kat, pinned_flag, int(pengumuman_id)), commit=True)
    if res["status"]:
        catat_log(None, author, "admin", "Ubah Pengumuman", f"Pengumuman #{pengumuman_id}: {judul}")
        return {"status": True, "pesan": "Pengumuman berhasil diperbarui."}
    return {"status": False, "pesan": res["pesan"]}


def toggle_pin_pengumuman(pengumuman_id, admin_user="admin"):
    """Menyematkan atau melepas sematan pengumuman."""
    ensure_pengumuman_table()

    cek = execute_query("SELECT id, judul, is_pinned FROM pengumuman WHERE id = %s", (int(pengumuman_id),), fetchone=True)
    if not cek["status"] or not cek["data"]:
        return {"status": False, "pesan": "Pengumuman tidak ditemukan."}

    next_pin = 0 if cek["data"]["is_pinned"] else 1
    res = execute_query("UPDATE pengumuman SET is_pinned = %s WHERE id = %s", (next_pin, int(pengumuman_id)), commit=True)
    if res["status"]:
        author = str(admin_user or "admin").strip() or "admin"
        state_label = "Disematkan" if next_pin else "Dilepas dari sematan"
        catat_log(None, author, "admin", "Pin Pengumuman", f"{cek['data']['judul']} -> {state_label}")
        return {"status": True, "pesan": f"Pengumuman berhasil {state_label.lower()}.", "is_pinned": bool(next_pin)}
    return {"status": False, "pesan": res["pesan"]}


def hapus_pengumuman(pengumuman_id, admin_user="admin"):
    """Menghapus pengumuman dari papan informasi."""
    ensure_pengumuman_table()

    cek = execute_query("SELECT id, judul FROM pengumuman WHERE id = %s", (int(pengumuman_id),), fetchone=True)
    if not cek["status"] or not cek["data"]:
        return {"status": False, "pesan": "Pengumuman tidak ditemukan."}

    res = execute_query("DELETE FROM pengumuman WHERE id = %s", (int(pengumuman_id),), commit=True)
    if res["status"]:
        author = str(admin_user or "admin").strip() or "admin"
        catat_log(None, author, "admin", "Hapus Pengumuman", f"Menghapus pengumuman: {cek['data']['judul']}")
        return {"status": True, "pesan": "Pengumuman berhasil dihapus."}
    return {"status": False, "pesan": res["pesan"]}
