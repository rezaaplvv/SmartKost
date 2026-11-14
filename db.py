"""
Database Configuration and Helper Utilities for SmartKost Pro
"""

import mysql.connector
from mysql.connector import Error

DB_CONFIG = {
    "host": "localhost",
    "user": "root",
    "password": "",
    "database": "smartkost_db",
    "port": 3306,
    "autocommit": False
}


def set_db_config(host=None, user=None, password=None, database=None, port=None):
    """Memperbarui konfigurasi database jika diperlukan."""
    global DB_CONFIG
    if host is not None:
        DB_CONFIG["host"] = host
    if user is not None:
        DB_CONFIG["user"] = user
    if password is not None:
        DB_CONFIG["password"] = password
    if database is not None:
        DB_CONFIG["database"] = database
    if port is not None:
        DB_CONFIG["port"] = port


def koneksi_db(database=None):
    """
    Membuka koneksi ke MySQL server.
    Jika database=None, menggunakan database default 'smartkost_db'.
    Jika database='', koneksi dibuka tanpa memilih database (untuk CREATE DATABASE).
    """
    config = DB_CONFIG.copy()
    if database is not None:
        if database == "":
            config.pop("database", None)
        else:
            config["database"] = database

    return mysql.connector.connect(**config)


def tutup_koneksi(cursor=None, connection=None):
    """Menutup cursor dan koneksi database dengan aman."""
    if cursor:
        try:
            cursor.close()
        except Exception:
            pass
    if connection:
        try:
            if connection.is_connected():
                connection.close()
        except Exception:
            pass


def cek_koneksi_db():
    """
    Memeriksa ketersediaan server MySQL dan database.
    Mengembalikan tuple: (status: bool, pesan: str)
    """
    conn = None
    try:
        conn = koneksi_db()
        if conn.is_connected():
            return True, "Koneksi ke database smartkost_db berhasil."
        return False, "Gagal terhubung ke MySQL."
    except Error as e:
        if e.errno == 1049:
            return False, "Database 'smartkost_db' belum dibuat. Jalankan init_db.py terlebih dahulu."
        elif e.errno == 2003:
            return False, "Server MySQL belum aktif. Pastikan XAMPP / MySQL Service sudah di-Start."
        elif e.errno == 1045:
            return False, f"Akses MySQL ditolak (User/Password salah): {e.msg}"
        return False, f"Kesalahan koneksi database: {e.msg}"
    finally:
        tutup_koneksi(connection=conn)


def execute_query(query, params=None, fetchone=False, fetchall=False, commit=False, return_id=False, database=None):
    """
    Helper fleksibel dan aman untuk menjalankan query SQL.
    Otomatis mengelola cursor, rollback bila gagal, dan penutupan resource.
    
    Returns:
        dict: {"status": bool, "data": ..., "pesan": str, "last_id": int | None}
    """
    conn = None
    cursor = None
    try:
        conn = koneksi_db(database=database)
        cursor = conn.cursor(dictionary=True)

        cursor.execute(query, params or ())

        last_id = cursor.lastrowid if return_id else None
        data = None

        if fetchone:
            data = cursor.fetchone()
        elif fetchall:
            data = cursor.fetchall()

        if commit:
            conn.commit()

        return {
            "status": True,
            "data": data,
            "pesan": "Query berhasil dieksekusi.",
            "last_id": last_id
        }
    except Error as e:
        if conn and commit:
            try:
                conn.rollback()
            except Exception:
                pass
        return {
            "status": False,
            "data": None,
            "pesan": f"Database Error ({e.errno}): {e.msg}",
            "last_id": None
        }
    finally:
        tutup_koneksi(cursor, conn)

