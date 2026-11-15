"""
Tenant Lifecycle, Online Booking, Room Mutation, and Checkout Module
"""

import datetime
from db import execute_query
from modules.auth import catat_log


def ajukan_booking(kamar_id, nama_pemohon, no_hp, pekerjaan="", asal_kota="", tanggal_mulai=None, durasi_bulan=1, catatan="", foto_ktp=None):
    """
    Menyimpan pengajuan reservasi kamar dari Landing Page publik.
    """
    nama_pemohon = str(nama_pemohon or "").strip()
    no_hp = str(no_hp or "").strip()

    if not nama_pemohon or not no_hp:
        return {"status": False, "pesan": "Nama lengkap dan nomor WhatsApp wajib diisi."}

    # Cek ketersediaan kamar
    kamar = execute_query("SELECT id, nomor_kamar, status FROM kamar WHERE id = %s", (kamar_id,), fetchone=True)
    if not kamar["status"] or not kamar["data"]:
        return {"status": False, "pesan": "Kamar yang dipilih tidak ditemukan."}

    if kamar["data"]["status"] != "Tersedia":
        return {"status": False, "pesan": f"Kamar {kamar['data']['nomor_kamar']} saat ini tidak berstatus Tersedia."}

    tanggal_mulai = tanggal_mulai or str(datetime.date.today())
    durasi_bulan = max(1, int(durasi_bulan or 1))

    query = """
        INSERT INTO booking (kamar_id, nama_pemohon, no_hp, pekerjaan, asal_kota, tanggal_mulai, durasi_bulan, catatan, foto_ktp, status)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'Pending')
    """
    res = execute_query(query, (kamar_id, nama_pemohon, no_hp, pekerjaan, asal_kota, tanggal_mulai, durasi_bulan, catatan, foto_ktp), commit=True, return_id=True)
    if res["status"]:
        catat_log(None, "Public", "Guest", "Pengajuan Booking", f"Booking kamar {kamar['data']['nomor_kamar']} oleh {nama_pemohon}")
        return {
            "status": True,
            "pesan": f"Permohonan sewa Kamar {kamar['data']['nomor_kamar']} berhasil dikirim! Admin akan segera memverifikasi pesanan Anda.",
            "booking_id": res["last_id"]
        }
    return {"status": False, "pesan": res["pesan"]}


def get_daftar_booking(status=None):
    """Mengambil daftar pengajuan booking kamar."""
    conditions = []
    params = []
    if status and status != "Semua":
        conditions.append("b.status = %s")
        params.append(status)

    where_clause = " WHERE " + " AND ".join(conditions) if conditions else ""

    query = f"""
        SELECT b.id, b.kamar_id, k.nomor_kamar, k.tipe AS tipe_kamar, k.harga_sewa,
               b.nama_pemohon, b.no_hp, b.pekerjaan, b.asal_kota,
               DATE_FORMAT(b.tanggal_mulai, '%d/%m/%Y') AS tanggal_mulai,
               b.durasi_bulan, b.catatan, b.foto_ktp, b.status, b.alasan_penolakan,
               DATE_FORMAT(b.created_at, '%d/%m/%Y %H:%i') AS waktu_pengajuan
        FROM booking b
        JOIN kamar k ON b.kamar_id = k.id
        {where_clause}
        ORDER BY b.id DESC
    """
    return execute_query(query, params, fetchall=True)


def checkin_penghuni(kamar_id, nama, no_hp, pekerjaan="", asal_kota="", tanggal_masuk=None, foto_ktp=None, buat_user=True, username=None, password=None, admin_user="admin"):
    """
    Mendaftarkan penghuni baru:
    1. Cek kamar tersedia
    2. Buat akun login jika diminta
    3. Simpan data penghuni
    4. Ubah status kamar menjadi 'Terisi'
    5. Otomatis buat tagihan pembayaran bulan pertama
    """
    nama = str(nama or "").strip()
    no_hp = str(no_hp or "").strip()
    if not nama or not no_hp:
        return {"status": False, "pesan": "Nama dan nomor kontak penghuni wajib diisi."}

    kamar = execute_query("SELECT id, nomor_kamar, status, harga_sewa FROM kamar WHERE id = %s", (kamar_id,), fetchone=True)
    if not kamar["status"] or not kamar["data"]:
        return {"status": False, "pesan": "Kamar tidak ditemukan."}

    kamar_data = kamar["data"]
    if kamar_data["status"] != "Tersedia":
        return {"status": False, "pesan": f"Kamar {kamar_data['nomor_kamar']} tidak berstatus Tersedia (Status: {kamar_data['status']})."}

    tanggal_masuk = tanggal_masuk or str(datetime.date.today())

    # 1. Buat / Hubungkan User Account jika diminta
    user_id = None
    # Cek apakah sudah ada akun penghuni dengan nama lengkap yang sama & belum punya kamar aktif
    cek_existing_user = execute_query("""
        SELECT u.id
        FROM users u
        LEFT JOIN penghuni p ON p.user_id = u.id AND p.status = 'Aktif'
        WHERE u.role = 'penghuni' AND LOWER(u.nama_lengkap) = LOWER(%s) AND p.id IS NULL
        ORDER BY u.id DESC
        LIMIT 1
    """, (nama,), fetchone=True)
    if cek_existing_user["status"] and cek_existing_user["data"]:
        user_id = cek_existing_user["data"]["id"]
    elif buat_user:
        raw_user = (username or nama.split()[0].lower() + kamar_data["nomor_kamar"].replace("-", "").lower()).strip()
        raw_pass = (password or "user123").strip()

        # Cek apakah username unik
        cek_u = execute_query("SELECT id FROM users WHERE username = %s", (raw_user,), fetchone=True)
        if cek_u["status"] and cek_u["data"]:
            raw_user = f"{raw_user}_{kamar_data['id']}"

        res_u = execute_query("""
            INSERT INTO users (username, password, nama_lengkap, role)
            VALUES (%s, %s, %s, 'penghuni')
        """, (raw_user, raw_pass, nama), commit=True, return_id=True)
        if res_u["status"]:
            user_id = res_u["last_id"]

    # 2. Simpan Data Penghuni
    query_p = """
        INSERT INTO penghuni (user_id, kamar_id, nama, no_hp, pekerjaan, asal_kota, tanggal_masuk, foto_ktp, status)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'Aktif')
    """
    res_p = execute_query(query_p, (user_id, kamar_id, nama, no_hp, pekerjaan, asal_kota, tanggal_masuk, foto_ktp), commit=True, return_id=True)
    if not res_p["status"]:
        return {"status": False, "pesan": res_p["pesan"]}

    penghuni_id = res_p["last_id"]

    # 3. Update Status Kamar Menjadi 'Terisi'
    execute_query("UPDATE kamar SET status = 'Terisi' WHERE id = %s", (kamar_id,), commit=True)

    # 4. Generate Tagihan Sewa Bulan Pertama
    bln_thn = str(tanggal_masuk)[:7]  # YYYY-MM
    tgl_jt = datetime.date.today() + datetime.timedelta(days=7)
    kode_inv = f"INV/{bln_thn.replace('-', '')}/{penghuni_id}{int(datetime.datetime.now().timestamp()) % 1000}"

    execute_query("""
        INSERT INTO tagihan_pembayaran 
        (penghuni_id, kamar_id, kode_invoice, bulan_tahun, nominal, denda, total_bayar, jatuh_tempo, status, catatan)
        VALUES (%s, %s, %s, %s, %s, 0, %s, %s, 'Belum Bayar', 'Tagihan sewa bulan pertama')
    """, (penghuni_id, kamar_id, kode_inv, bln_thn, kamar_data["harga_sewa"], kamar_data["harga_sewa"], tgl_jt), commit=True)

    catat_log(None, admin_user, "admin", "Check-In Penghuni", f"Check-in {nama} ke kamar {kamar_data['nomor_kamar']}")

    return {
        "status": True,
        "pesan": f"Penghuni {nama} berhasil check-in ke Kamar {kamar_data['nomor_kamar']}. Tagihan bulan pertama telah diterbitkan.",
        "penghuni_id": penghuni_id
    }


def proses_booking(booking_id, aksi, alasan_penolakan=None, admin_user="admin"):
    """
    Menyetujui atau menolak permohonan booking.
    Jika disetujui, langsung memproses check-in otomatis.
    """
    b = execute_query("SELECT * FROM booking WHERE id = %s", (booking_id,), fetchone=True)
    if not b["status"] or not b["data"]:
        return {"status": False, "pesan": "Permohonan booking tidak ditemukan."}

    booking = b["data"]
    if booking["status"] != "Pending":
        return {"status": False, "pesan": f"Booking ini sudah diproses sebelumnya (Status: {booking['status']})."}

    if aksi == "Disetujui":
        # Jalankan check-in
        res_ci = checkin_penghuni(
            kamar_id=booking["kamar_id"],
            nama=booking["nama_pemohon"],
            no_hp=booking["no_hp"],
            pekerjaan=booking["pekerjaan"],
            asal_kota=booking["asal_kota"],
            tanggal_masuk=booking["tanggal_mulai"],
            foto_ktp=booking["foto_ktp"],
            admin_user=admin_user
        )
        if not res_ci["status"]:
            return res_ci

        execute_query("UPDATE booking SET status = 'Disetujui' WHERE id = %s", (booking_id,), commit=True)
        catat_log(None, admin_user, "admin", "Persetujuan Booking", f"Menyetujui booking ID #{booking_id} ({booking['nama_pemohon']})")
        return {"status": True, "pesan": f"Booking oleh {booking['nama_pemohon']} berhasil disetujui dan check-in otomatis."}

    elif aksi == "Ditolak":
        alasan = alasan_penolakan or "Kamar sudah dipesan oleh pihak lain / data belum lengkap."
        execute_query("UPDATE booking SET status = 'Ditolak', alasan_penolakan = %s WHERE id = %s", (alasan, booking_id), commit=True)
        catat_log(None, admin_user, "admin", "Penolakan Booking", f"Menolak booking ID #{booking_id} ({booking['nama_pemohon']}): {alasan}")
        return {"status": True, "pesan": "Permohonan booking telah ditolak."}

    return {"status": False, "pesan": "Aksi booking tidak valid."}


def get_daftar_penghuni(status="Aktif", search=None):
    """Mengambil daftar seluruh penghuni aktif maupun riwayat alumni."""
    conditions = []
    params = []

    if status and status != "Semua":
        conditions.append("p.status = %s")
        params.append(status)

    if search:
        conditions.append("(p.nama LIKE %s OR p.no_hp LIKE %s OR k.nomor_kamar LIKE %s OR p.asal_kota LIKE %s)")
        wildcard = f"%{search}%"
        params.extend([wildcard, wildcard, wildcard, wildcard])

    where_clause = " WHERE " + " AND ".join(conditions) if conditions else ""

    query = f"""
        SELECT p.id, p.user_id, p.kamar_id, p.nama, p.no_hp, p.pekerjaan, p.asal_kota,
               DATE_FORMAT(p.tanggal_masuk, '%d/%m/%Y') AS tanggal_masuk,
               DATE_FORMAT(p.tanggal_keluar, '%d/%m/%Y') AS tanggal_keluar,
               p.foto_ktp, p.status,
               k.nomor_kamar, k.tipe AS tipe_kamar, k.harga_sewa,
               u.username
        FROM penghuni p
        LEFT JOIN kamar k ON p.kamar_id = k.id
        LEFT JOIN users u ON p.user_id = u.id
        {where_clause}
        ORDER BY p.status ASC, p.id DESC
    """
    return execute_query(query, params, fetchall=True)


def get_detail_penghuni(penghuni_id):
    """Mengambil biodata detail penghuni dan riwayat tagihannya."""
    query_p = """
        SELECT p.id, p.user_id, p.kamar_id, p.nama, p.no_hp, p.pekerjaan, p.asal_kota,
               DATE_FORMAT(p.tanggal_masuk, '%d/%m/%Y') AS tanggal_masuk,
               DATE_FORMAT(p.tanggal_keluar, '%d/%m/%Y') AS tanggal_keluar,
               p.foto_ktp, p.status,
               k.nomor_kamar, k.tipe AS tipe_kamar, k.harga_sewa, k.fasilitas,
               u.username
        FROM penghuni p
        LEFT JOIN kamar k ON p.kamar_id = k.id
        LEFT JOIN users u ON p.user_id = u.id
        WHERE p.id = %s
    """
    res_p = execute_query(query_p, (penghuni_id,), fetchone=True)
    if not res_p["status"] or not res_p["data"]:
        return {"status": False, "pesan": "Penghuni tidak ditemukan."}

    # Riwayat Tagihan
    query_t = """
        SELECT id, kode_invoice, bulan_tahun, nominal, denda, total_bayar,
               DATE_FORMAT(jatuh_tempo, '%d/%m/%Y') AS jatuh_tempo,
               DATE_FORMAT(tanggal_bayar, '%d/%m/%Y') AS tanggal_bayar,
               metode_pembayaran, status, bukti_transfer
        FROM tagihan_pembayaran
        WHERE penghuni_id = %s
        ORDER BY id DESC
    """
    res_t = execute_query(query_t, (penghuni_id,), fetchall=True)

    data = res_p["data"]
    data["tagihan"] = res_t["data"] or []
    return {"status": True, "data": data}


def ubah_penghuni(penghuni_id, nama, no_hp, pekerjaan, asal_kota, admin_user="admin"):
    """Mengubah biodata kontak penghuni."""
    nama = str(nama or "").strip()
    no_hp = str(no_hp or "").strip()
    if not nama or not no_hp:
        return {"status": False, "pesan": "Nama dan kontak tidak boleh kosong."}

    query = """
        UPDATE penghuni 
        SET nama = %s, no_hp = %s, pekerjaan = %s, asal_kota = %s
        WHERE id = %s
    """
    res = execute_query(query, (nama, no_hp, pekerjaan, asal_kota, penghuni_id), commit=True)
    if res["status"]:
        catat_log(None, admin_user, "admin", "Ubah Data Penghuni", f"Memperbarui biodata {nama}")
        return {"status": True, "pesan": "Data penghuni berhasil diperbarui."}
    return {"status": False, "pesan": res["pesan"]}


def pindah_kamar(penghuni_id, kamar_id_baru, admin_user="admin"):
    """
    Memindahkan penghuni aktif ke kamar lain yang masih tersedia.
    Kamar lama otomatis berstatus 'Tersedia', kamar baru menjadi 'Terisi'.
    """
    p = execute_query("SELECT id, nama, kamar_id, status FROM penghuni WHERE id = %s", (penghuni_id,), fetchone=True)
    if not p["status"] or not p["data"]:
        return {"status": False, "pesan": "Penghuni tidak ditemukan."}

    penghuni = p["data"]
    if penghuni["status"] != "Aktif":
        return {"status": False, "pesan": "Hanya penghuni berstatus Aktif yang dapat dipindahkan kamarnya."}

    kamar_lama_id = penghuni["kamar_id"]
    if int(kamar_lama_id or 0) == int(kamar_id_baru):
        return {"status": False, "pesan": "Kamar baru harus berbeda dari kamar saat ini."}

    # Cek kamar baru
    k_baru = execute_query("SELECT id, nomor_kamar, status FROM kamar WHERE id = %s", (kamar_id_baru,), fetchone=True)
    if not k_baru["status"] or not k_baru["data"]:
        return {"status": False, "pesan": "Kamar tujuan tidak ditemukan."}

    if k_baru["data"]["status"] != "Tersedia":
        return {"status": False, "pesan": f"Kamar {k_baru['data']['nomor_kamar']} tidak tersedia (Status: {k_baru['data']['status']})."}

    # 1. Update kamar lama menjadi Tersedia
    if kamar_lama_id:
        execute_query("UPDATE kamar SET status = 'Tersedia' WHERE id = %s", (kamar_lama_id,), commit=True)

    # 2. Update kamar baru menjadi Terisi
    execute_query("UPDATE kamar SET status = 'Terisi' WHERE id = %s", (kamar_id_baru,), commit=True)

    # 3. Update penghuni
    execute_query("UPDATE penghuni SET kamar_id = %s WHERE id = %s", (kamar_id_baru, penghuni_id), commit=True)

    catat_log(None, admin_user, "admin", "Pindah Kamar", f"Memindahkan {penghuni['nama']} ke kamar {k_baru['data']['nomor_kamar']}")
    return {"status": True, "pesan": f"Penghuni {penghuni['nama']} berhasil dipindahkan ke Kamar {k_baru['data']['nomor_kamar']}."}


def checkout_penghuni(penghuni_id, tanggal_keluar=None, admin_user="admin"):
    """
    Memproses kepulangan penghuni:
    - Status penghuni diubah jadi 'Keluar' (masuk arsip)
    - Kamar dikembalikan ke status 'Tersedia'
    """
    p = execute_query("SELECT id, nama, kamar_id, status FROM penghuni WHERE id = %s", (penghuni_id,), fetchone=True)
    if not p["status"] or not p["data"]:
        return {"status": False, "pesan": "Penghuni tidak ditemukan."}

    penghuni = p["data"]
    if penghuni["status"] != "Aktif":
        return {"status": False, "pesan": "Penghuni ini sudah tidak aktif sebelumnya."}

    kamar_id = penghuni["kamar_id"]
    tanggal_keluar = tanggal_keluar or str(datetime.date.today())

    # Update kamar menjadi Tersedia
    if kamar_id:
        execute_query("UPDATE kamar SET status = 'Tersedia' WHERE id = %s", (kamar_id,), commit=True)

    # Update penghuni
    execute_query("""
        UPDATE penghuni 
        SET status = 'Keluar', tanggal_keluar = %s, kamar_id = NULL 
        WHERE id = %s
    """, (tanggal_keluar, penghuni_id), commit=True)

    catat_log(None, admin_user, "admin", "Check-Out Penghuni", f"Check-out {penghuni['nama']} pada tanggal {tanggal_keluar}")
    return {"status": True, "pesan": f"Penghuni {penghuni['nama']} berhasil check-out. Kamar sekarang kembali Tersedia."}

