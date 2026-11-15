"""
Authentication, User Management, and Activity Logging Module
"""

from db import execute_query


def catat_log(user_id, username, role, aksi, detail=""):
    """Mencatat aktivitas ke dalam tabel log_aktivitas."""
    query = """
        INSERT INTO log_aktivitas (user_id, username, role, aksi, detail)
        VALUES (%s, %s, %s, %s, %s)
    """
    execute_query(query, (user_id, username or "Guest", role or "User", aksi, detail), commit=True)


def login_user(username, password):
    """
    Memvalidasi kredensial login admin atau penghuni.
    Mengembalikan data user beserta relasi kamar bila ada.
    """
    username = str(username or "").strip()
    password = str(password or "").strip()

    if not username or not password:
        return {"status": False, "pesan": "Username dan password wajib diisi."}

    query = """
        SELECT id, username, password, nama_lengkap, role, foto_profil
        FROM users
        WHERE username = %s
    """
    res = execute_query(query, (username,), fetchone=True)

    if not res["status"] or not res["data"]:
        return {"status": False, "pesan": "Username atau password salah."}

    user = res["data"]
    if user["password"] != password:
        return {"status": False, "pesan": "Username atau password salah."}

    # Jika penghuni, ambil relasi kamar & id penghuni
    user_payload = {
        "id": user["id"],
        "username": user["username"],
        "nama_lengkap": user["nama_lengkap"],
        "role": user["role"],
        "foto_profil": user["foto_profil"],
        "penghuni_id": None,
        "kamar_id": None,
        "nomor_kamar": None
    }

    if user["role"] == "penghuni":
        q_penghuni = """
            SELECT p.id AS penghuni_id, p.kamar_id, k.nomor_kamar, p.status AS status_penghuni
            FROM penghuni p
            LEFT JOIN kamar k ON p.kamar_id = k.id
            WHERE p.user_id = %s AND p.status = 'Aktif'
            ORDER BY p.id DESC
            LIMIT 1
        """
        res_p = execute_query(q_penghuni, (user["id"],), fetchone=True)
        if not (res_p["status"] and res_p["data"]):
            # Fallback: kaitkan otomatis jika ada penghuni aktif dengan nama sama yang belum terhubung user_id
            res_match = execute_query("""
                SELECT p.id AS penghuni_id, p.kamar_id, k.nomor_kamar, p.status AS status_penghuni
                FROM penghuni p
                LEFT JOIN kamar k ON p.kamar_id = k.id
                WHERE p.user_id IS NULL AND p.status = 'Aktif' AND LOWER(p.nama) = LOWER(%s)
                ORDER BY p.id DESC
                LIMIT 1
            """, (user["nama_lengkap"],), fetchone=True)
            if res_match["status"] and res_match["data"]:
                execute_query("UPDATE penghuni SET user_id = %s WHERE id = %s", (user["id"], res_match["data"]["penghuni_id"]), commit=True)
                res_p = res_match

        if res_p["status"] and res_p["data"]:
            user_payload["penghuni_id"] = res_p["data"]["penghuni_id"]
            user_payload["kamar_id"] = res_p["data"]["kamar_id"]
            user_payload["nomor_kamar"] = res_p["data"]["nomor_kamar"]

    # Catat log sukses login
    catat_log(user["id"], user["username"], user["role"], "Login", f"User {user['username']} berhasil login.")

    return {
        "status": True,
        "pesan": f"Selamat datang, {user['nama_lengkap']}!",
        "user": user_payload
    }


def register_penghuni(username, password, nama_lengkap, no_hp=""):
    """Registrasi mandiri calon penghuni / user baru."""
    username = str(username or "").strip()
    password = str(password or "").strip()
    nama_lengkap = str(nama_lengkap or "").strip()
    no_hp = str(no_hp or "").strip()

    if len(username) < 3:
        return {"status": False, "pesan": "Username minimal harus 3 karakter."}
    if len(password) < 4:
        return {"status": False, "pesan": "Password minimal harus 4 karakter."}
    if not nama_lengkap:
        return {"status": False, "pesan": "Nama lengkap wajib diisi."}

    # Cek duplikasi username
    q_cek = "SELECT id FROM users WHERE username = %s"
    res_cek = execute_query(q_cek, (username,), fetchone=True)
    if res_cek["status"] and res_cek["data"]:
        return {"status": False, "pesan": "Username sudah digunakan, silakan pilih yang lain."}

    query = """
        INSERT INTO users (username, password, nama_lengkap, role)
        VALUES (%s, %s, %s, 'penghuni')
    """
    res = execute_query(query, (username, password, nama_lengkap), commit=True, return_id=True)
    if not res["status"]:
        return {"status": False, "pesan": res["pesan"]}

    catat_log(res["last_id"], username, "penghuni", "Registrasi Akun", f"Registrasi akun penghuni: {nama_lengkap}")
    return {"status": True, "pesan": "Akun berhasil didaftarkan. Silakan login."}


def ganti_password(user_id, password_lama, password_baru):
    """Mengubah password user."""
    password_lama = str(password_lama or "").strip()
    password_baru = str(password_baru or "").strip()

    if len(password_baru) < 4:
        return {"status": False, "pesan": "Password baru minimal 4 karakter."}

    res_user = execute_query("SELECT password, username, role FROM users WHERE id = %s", (user_id,), fetchone=True)
    if not res_user["status"] or not res_user["data"]:
        return {"status": False, "pesan": "User tidak ditemukan."}

    if res_user["data"]["password"] != password_lama:
        return {"status": False, "pesan": "Password lama tidak sesuai."}

    res_up = execute_query("UPDATE users SET password = %s WHERE id = %s", (password_baru, user_id), commit=True)
    if res_up["status"]:
        catat_log(user_id, res_user["data"]["username"], res_user["data"]["role"], "Ganti Password", "Berhasil memperbarui password.")
        return {"status": True, "pesan": "Password berhasil diperbarui."}
    return {"status": False, "pesan": "Gagal memperbarui password."}


def get_profile(user_id):
    """Mengambil data profil lengkap seorang user beserta detail kamar aktifnya."""
    # Kaitkan otomatis jika user penghuni punya data penghuni aktif bernama sama yang belum memiliki user_id
    u_row = execute_query("SELECT id, nama_lengkap, role FROM users WHERE id = %s", (user_id,), fetchone=True)
    if u_row["status"] and u_row["data"] and u_row["data"]["role"] == "penghuni":
        has_active = execute_query("SELECT id FROM penghuni WHERE user_id = %s AND status = 'Aktif' LIMIT 1", (user_id,), fetchone=True)
        if not (has_active["status"] and has_active["data"]):
            unlinked = execute_query(
                "SELECT id FROM penghuni WHERE user_id IS NULL AND status = 'Aktif' AND LOWER(nama) = LOWER(%s) ORDER BY id DESC LIMIT 1",
                (u_row["data"]["nama_lengkap"],),
                fetchone=True
            )
            if unlinked["status"] and unlinked["data"]:
                execute_query("UPDATE penghuni SET user_id = %s WHERE id = %s", (user_id, unlinked["data"]["id"]), commit=True)

    query = """
        SELECT u.id, u.username, u.nama_lengkap, u.role, u.foto_profil, u.created_at,
               p.id AS penghuni_id, p.kamar_id,
               k.nomor_kamar, k.lantai, k.tipe AS tipe_kamar, k.harga_sewa,
               k.luas_kamar, k.fasilitas, k.deskripsi AS deskripsi_kamar, k.foto_kamar, k.status AS status_kamar,
               p.no_hp, p.pekerjaan, p.asal_kota, p.tanggal_masuk,
               DATE_FORMAT(p.tanggal_masuk, '%d/%m/%Y') AS tgl_masuk_format,
               p.foto_ktp, p.status AS status_penghuni
        FROM users u
        LEFT JOIN penghuni p ON u.id = p.user_id AND p.status = 'Aktif'
        LEFT JOIN kamar k ON p.kamar_id = k.id
        WHERE u.id = %s
    """
    res = execute_query(query, (user_id,), fetchone=True)
    if res["status"] and res["data"]:
        # Konversi datetime / date ke string agar JSON-serializable untuk Eel
        data = res["data"]
        for key in ["created_at", "tanggal_masuk"]:
            if data.get(key):
                data[key] = str(data[key])
        return {"status": True, "data": data}
    return {"status": False, "pesan": "Profil tidak ditemukan."}


def update_profile(user_id, nama_lengkap, foto_profil=None):
    """Memperbarui nama dan foto profil user."""
    nama_lengkap = str(nama_lengkap or "").strip()
    if not nama_lengkap:
        return {"status": False, "pesan": "Nama lengkap tidak boleh kosong."}

    if foto_profil:
        query = "UPDATE users SET nama_lengkap = %s, foto_profil = %s WHERE id = %s"
        params = (nama_lengkap, foto_profil, user_id)
    else:
        query = "UPDATE users SET nama_lengkap = %s WHERE id = %s"
        params = (nama_lengkap, user_id)

    res = execute_query(query, params, commit=True)
    if res["status"]:
        # Update nama di tabel penghuni jika ada
        execute_query("UPDATE penghuni SET nama = %s WHERE user_id = %s", (nama_lengkap, user_id), commit=True)
        return {"status": True, "pesan": "Profil berhasil diperbarui."}
    return {"status": False, "pesan": "Gagal memperbarui profil."}


def get_log_aktivitas(limit=50):
    """Mengambil daftar log aktivitas terbaru."""
    query = """
        SELECT id, username, role, aksi, detail, DATE_FORMAT(created_at, '%d/%m/%Y %H:%i') AS waktu
        FROM log_aktivitas
        ORDER BY id DESC
        LIMIT %s
    """
    res = execute_query(query, (int(limit),), fetchall=True)
    return res

