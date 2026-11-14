"""
Room Management, Floor Plan, and Kos Profile Settings Module
"""

from db import execute_query
from modules.auth import catat_log


def get_semua_kamar(filter_lantai=None, filter_status=None, filter_tipe=None, search=None):
    """
    Mengambil seluruh daftar kamar dengan filter fleksibel dan informasi penghuni aktif.
    """
    conditions = []
    params = []

    if filter_lantai:
        conditions.append("k.lantai = %s")
        params.append(int(filter_lantai))

    if filter_status and filter_status != "Semua":
        conditions.append("k.status = %s")
        params.append(filter_status)

    if filter_tipe and filter_tipe != "Semua":
        conditions.append("k.tipe = %s")
        params.append(filter_tipe)

    if search:
        conditions.append("(k.nomor_kamar LIKE %s OR k.fasilitas LIKE %s OR k.tipe LIKE %s)")
        wildcard = f"%{search}%"
        params.extend([wildcard, wildcard, wildcard])

    where_clause = " WHERE " + " AND ".join(conditions) if conditions else ""

    query = f"""
        SELECT k.id, k.nomor_kamar, k.lantai, k.tipe, k.harga_sewa, k.luas_kamar,
               k.fasilitas, k.deskripsi, k.foto_kamar, k.status,
               p.id AS penghuni_id, p.nama AS nama_penghuni, p.no_hp AS no_hp_penghuni,
               DATE_FORMAT(p.tanggal_masuk, '%%d/%%m/%%Y') AS tgl_masuk_penghuni
        FROM kamar k
        LEFT JOIN penghuni p ON k.id = p.kamar_id AND p.status = 'Aktif'
        {where_clause}
        ORDER BY k.lantai ASC, k.nomor_kamar ASC
    """
    res = execute_query(query, params, fetchall=True)
    return res


def get_kamar_by_id(kamar_id):
    """Mengambil detail satu kamar berdasarkan ID."""
    query = """
        SELECT k.id, k.nomor_kamar, k.lantai, k.tipe, k.harga_sewa, k.luas_kamar,
               k.fasilitas, k.deskripsi, k.foto_kamar, k.status,
               p.id AS penghuni_id, p.nama AS nama_penghuni, p.no_hp AS no_hp_penghuni,
               p.pekerjaan, p.asal_kota,
               DATE_FORMAT(p.tanggal_masuk, '%%d/%%m/%%Y') AS tgl_masuk_penghuni
        FROM kamar k
        LEFT JOIN penghuni p ON k.id = p.kamar_id AND p.status = 'Aktif'
        WHERE k.id = %s
    """
    res = execute_query(query, (kamar_id,), fetchone=True)
    return res


def tambah_kamar(nomor_kamar, lantai, tipe, harga_sewa, luas_kamar="3x4 m", fasilitas="", deskripsi="", foto_kamar=None, admin_user="admin"):
    """Menambahkan unit kamar baru ke sistem."""
    nomor_kamar = str(nomor_kamar or "").strip().upper()
    if not nomor_kamar:
        return {"status": False, "pesan": "Nomor kamar wajib diisi."}

    # Cek nomor kamar duplikat
    cek = execute_query("SELECT id FROM kamar WHERE nomor_kamar = %s", (nomor_kamar,), fetchone=True)
    if cek["status"] and cek["data"]:
        return {"status": False, "pesan": f"Kamar nomor '{nomor_kamar}' sudah terdaftar."}

    try:
        lantai = int(lantai or 1)
        harga_sewa = int(harga_sewa or 0)
    except ValueError:
        return {"status": False, "pesan": "Lantai dan harga sewa harus berupa angka valid."}

    if harga_sewa <= 0:
        return {"status": False, "pesan": "Harga sewa harus lebih dari 0."}

    query = """
        INSERT INTO kamar (nomor_kamar, lantai, tipe, harga_sewa, luas_kamar, fasilitas, deskripsi, foto_kamar, status)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'Tersedia')
    """
    res = execute_query(query, (nomor_kamar, lantai, tipe, harga_sewa, luas_kamar, fasilitas, deskripsi, foto_kamar), commit=True, return_id=True)
    if res["status"]:
        catat_log(None, admin_user, "admin", "Tambah Kamar", f"Menambahkan kamar baru: {nomor_kamar} (Lantai {lantai})")
        return {"status": True, "pesan": f"Kamar {nomor_kamar} berhasil ditambahkan.", "id": res["last_id"]}
    return {"status": False, "pesan": res["pesan"]}


def ubah_kamar(kamar_id, nomor_kamar, lantai, tipe, harga_sewa, luas_kamar, fasilitas, deskripsi, status, foto_kamar=None, admin_user="admin"):
    """Mengubah data kamar dan status ketersediaannya."""
    nomor_kamar = str(nomor_kamar or "").strip().upper()
    if not nomor_kamar:
        return {"status": False, "pesan": "Nomor kamar wajib diisi."}

    # Cek duplikasi nomor kamar pada ID yang berbeda
    cek = execute_query("SELECT id FROM kamar WHERE nomor_kamar = %s AND id != %s", (nomor_kamar, kamar_id), fetchone=True)
    if cek["status"] and cek["data"]:
        return {"status": False, "pesan": f"Nomor kamar '{nomor_kamar}' sudah dipakai kamar lain."}

    try:
        lantai = int(lantai or 1)
        harga_sewa = int(harga_sewa or 0)
    except ValueError:
        return {"status": False, "pesan": "Lantai dan harga sewa harus berupa angka valid."}

    if foto_kamar:
        query = """
            UPDATE kamar 
            SET nomor_kamar = %s, lantai = %s, tipe = %s, harga_sewa = %s, luas_kamar = %s,
                fasilitas = %s, deskripsi = %s, status = %s, foto_kamar = %s
            WHERE id = %s
        """
        params = (nomor_kamar, lantai, tipe, harga_sewa, luas_kamar, fasilitas, deskripsi, status, foto_kamar, kamar_id)
    else:
        query = """
            UPDATE kamar 
            SET nomor_kamar = %s, lantai = %s, tipe = %s, harga_sewa = %s, luas_kamar = %s,
                fasilitas = %s, deskripsi = %s, status = %s
            WHERE id = %s
        """
        params = (nomor_kamar, lantai, tipe, harga_sewa, luas_kamar, fasilitas, deskripsi, status, kamar_id)

    res = execute_query(query, params, commit=True)
    if res["status"]:
        catat_log(None, admin_user, "admin", "Ubah Kamar", f"Mengubah informasi kamar: {nomor_kamar}")
        return {"status": True, "pesan": f"Data kamar {nomor_kamar} berhasil diperbarui."}
    return {"status": False, "pesan": res["pesan"]}


def hapus_kamar(kamar_id, admin_user="admin"):
    """Menghapus kamar dengan memastikan tidak ada penghuni aktif di dalamnya."""
    kamar = execute_query("SELECT nomor_kamar, status FROM kamar WHERE id = %s", (kamar_id,), fetchone=True)
    if not kamar["status"] or not kamar["data"]:
        return {"status": False, "pesan": "Kamar tidak ditemukan."}

    nomor = kamar["data"]["nomor_kamar"]

    # Cek penghuni aktif
    cek_p = execute_query("SELECT id FROM penghuni WHERE kamar_id = %s AND status = 'Aktif'", (kamar_id,), fetchone=True)
    if cek_p["status"] and cek_p["data"]:
        return {"status": False, "pesan": f"Kamar {nomor} tidak dapat dihapus karena masih dihuni. Lakukan check-out penghuni terlebih dahulu."}

    res = execute_query("DELETE FROM kamar WHERE id = %s", (kamar_id,), commit=True)
    if res["status"]:
        catat_log(None, admin_user, "admin", "Hapus Kamar", f"Menghapus kamar: {nomor}")
        return {"status": True, "pesan": f"Kamar {nomor} berhasil dihapus."}
    return {"status": False, "pesan": res["pesan"]}


def get_denah_kamar():
    """
    Mengelompokkan data kamar per lantai untuk tampilan Floor Plan interaktif.
    Returns: {"status": True, "data": { lantai_1: [...], lantai_2: [...] }}
    """
    res = get_semua_kamar()
    if not res["status"]:
        return res

    denah = {}
    for k in res["data"]:
        lt = k["lantai"]
        if lt not in denah:
            denah[lt] = []
        denah[lt].append(k)

    return {"status": True, "data": denah}


def get_statistik_kamar():
    """Menghitung ringkasan statistik ketersediaan kamar."""
    query = """
        SELECT 
            COUNT(*) AS total_kamar,
            SUM(CASE WHEN status = 'Tersedia' THEN 1 ELSE 0 END) AS kamar_tersedia,
            SUM(CASE WHEN status = 'Terisi' THEN 1 ELSE 0 END) AS kamar_terisi,
            SUM(CASE WHEN status = 'Perbaikan' THEN 1 ELSE 0 END) AS kamar_perbaikan
        FROM kamar
    """
    res = execute_query(query, fetchone=True)
    if res["status"] and res["data"]:
        d = res["data"]
        total = d["total_kamar"] or 0
        terisi = d["kamar_terisi"] or 0
        tersedia = d["kamar_tersedia"] or 0
        perbaikan = d["kamar_perbaikan"] or 0
        okupansi = round((terisi / total * 100), 1) if total > 0 else 0

        return {
            "status": True,
            "data": {
                "total_kamar": total,
                "kamar_terisi": terisi,
                "kamar_tersedia": tersedia,
                "kamar_perbaikan": perbaikan,
                "persen_okupansi": okupansi
            }
        }
    return res


def get_pengaturan_kos():
    """Mengambil konfigurasi profil kos untuk Landing Page dan Kuitansi."""
    query = "SELECT * FROM pengaturan_kos ORDER BY id ASC LIMIT 1"
    res = execute_query(query, fetchone=True)
    if res["status"] and res["data"]:
        if res["data"].get("updated_at"):
            res["data"]["updated_at"] = str(res["data"]["updated_at"])
    return res


def update_pengaturan_kos(nama_kos, tagline, deskripsi, alamat, no_wa, denda_per_hari=10000, foto_banner=None, admin_user="admin"):
    """Memperbarui informasi profil kos."""
    nama_kos = str(nama_kos or "").strip()
    if not nama_kos:
        return {"status": False, "pesan": "Nama kos wajib diisi."}

    if foto_banner:
        query = """
            UPDATE pengaturan_kos 
            SET nama_kos = %s, tagline = %s, deskripsi = %s, alamat = %s, no_wa = %s, denda_per_hari = %s, foto_banner = %s
            WHERE id = 1
        """
        params = (nama_kos, tagline, deskripsi, alamat, no_wa, int(denda_per_hari or 10000), foto_banner)
    else:
        query = """
            UPDATE pengaturan_kos 
            SET nama_kos = %s, tagline = %s, deskripsi = %s, alamat = %s, no_wa = %s, denda_per_hari = %s
            WHERE id = 1
        """
        params = (nama_kos, tagline, deskripsi, alamat, no_wa, int(denda_per_hari or 10000))

    res = execute_query(query, params, commit=True)
    if res["status"]:
        catat_log(None, admin_user, "admin", "Update Profil Kos", f"Memperbarui profil kos: {nama_kos}")
        return {"status": True, "pesan": "Pengaturan profil kos berhasil diperbarui."}
    return {"status": False, "pesan": res["pesan"]}

