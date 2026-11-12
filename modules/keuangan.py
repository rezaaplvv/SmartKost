"""
Billing, Payment Verification, Official Receipts, Expenses, and Maintenance Complaints Module
"""

import datetime
from db import execute_query
from modules.auth import catat_log


def get_daftar_tagihan(filter_status=None, bulan_tahun=None, search=None, penghuni_id=None):
    """
    Mengambil data tagihan sewa bulanan dengan perhitungan denda otomatis jika telat bayar.
    """
    conditions = []
    params = []

    if filter_status and filter_status != "Semua":
        conditions.append("t.status = %s")
        params.append(filter_status)

    if bulan_tahun and bulan_tahun != "Semua":
        conditions.append("t.bulan_tahun = %s")
        params.append(bulan_tahun)

    if penghuni_id:
        conditions.append("t.penghuni_id = %s")
        params.append(int(penghuni_id))

    if search:
        conditions.append("(p.nama LIKE %s OR k.nomor_kamar LIKE %s OR t.kode_invoice LIKE %s)")
        wildcard = f"%{search}%"
        params.extend([wildcard, wildcard, wildcard])

    where_clause = " WHERE " + " AND ".join(conditions) if conditions else ""

    query = f"""
        SELECT t.id, t.penghuni_id, t.kamar_id, t.kode_invoice, t.bulan_tahun,
               t.nominal, t.denda, t.total_bayar,
               t.jatuh_tempo,
               DATE_FORMAT(t.jatuh_tempo, '%%d/%%m/%%Y') AS tgl_jatuh_tempo,
               DATE_FORMAT(t.tanggal_bayar, '%%d/%%m/%%Y') AS tgl_bayar,
               t.metode_pembayaran, t.bukti_transfer, t.status, t.catatan,
               p.nama AS nama_penghuni, p.no_hp AS no_hp_penghuni,
               k.nomor_kamar, k.tipe AS tipe_kamar
        FROM tagihan_pembayaran t
        JOIN penghuni p ON t.penghuni_id = p.id
        JOIN kamar k ON t.kamar_id = k.id
        {where_clause}
        ORDER BY t.id DESC
    """
    res = execute_query(query, params, fetchall=True)
    if not res["status"] or not res["data"]:
        return res

    # Cek & sesuaikan status keterlambatan (overdue) untuk presentasi real-time
    today = datetime.date.today()
    for row in res["data"]:
        jt = row.get("jatuh_tempo")
        if isinstance(jt, str):
            try:
                jt = datetime.date.fromisoformat(jt)
            except Exception:
                pass

        row["jatuh_tempo"] = str(jt)
        if row["status"] == "Belum Bayar" and jt and jt < today:
            row["is_telat"] = True
            row["hari_telat"] = (today - jt).days
        else:
            row["is_telat"] = False
            row["hari_telat"] = 0

    return res


def generate_tagihan_bulanan(bulan_tahun=None, admin_user="admin"):
    """
    Menghasilkan tagihan massal untuk semua penghuni aktif pada bulan target (format YYYY-MM).
    """
    bulan_tahun = bulan_tahun or datetime.date.today().strftime("%Y-%m")

    # Ambil pengaturan denda dan seluruh penghuni aktif
    q_penghuni = """
        SELECT p.id, p.nama, p.kamar_id, k.harga_sewa, k.nomor_kamar
        FROM penghuni p
        JOIN kamar k ON p.kamar_id = k.id
        WHERE p.status = 'Aktif'
    """
    res_p = execute_query(q_penghuni, fetchall=True)
    if not res_p["status"] or not res_p["data"]:
        return {"status": False, "pesan": "Tidak ada penghuni aktif yang ditemukan."}

    penghuni_list = res_p["data"]
    created_count = 0
    tgl_jt = f"{bulan_tahun}-10"  # Default tanggal 10 tiap bulan

    for p in penghuni_list:
        # Cek apakah tagihan bulan ini sudah ada
        q_cek = "SELECT id FROM tagihan_pembayaran WHERE penghuni_id = %s AND bulan_tahun = %s"
        cek = execute_query(q_cek, (p["id"], bulan_tahun), fetchone=True)
        if cek["status"] and cek["data"]:
            continue  # Sudah ada, lewati

        kode_inv = f"INV/{bulan_tahun.replace('-', '')}/{p['id']}{int(datetime.datetime.now().timestamp()) % 1000}"
        nominal = p["harga_sewa"]

        res_ins = execute_query("""
            INSERT INTO tagihan_pembayaran 
            (penghuni_id, kamar_id, kode_invoice, bulan_tahun, nominal, denda, total_bayar, jatuh_tempo, status, catatan)
            VALUES (%s, %s, %s, %s, %s, 0, %s, %s, 'Belum Bayar', 'Tagihan sewa bulanan')
        """, (p["id"], p["kamar_id"], kode_inv, bulan_tahun, nominal, nominal, tgl_jt), commit=True)

        if res_ins["status"]:
            created_count += 1

    catat_log(None, admin_user, "admin", "Generate Tagihan", f"Menerbitkan {created_count} tagihan sewa periode {bulan_tahun}")

    if created_count > 0:
        return {"status": True, "pesan": f"Berhasil menerbitkan {created_count} tagihan baru untuk periode {bulan_tahun}."}
    return {"status": True, "pesan": f"Semua penghuni aktif sudah memiliki tagihan untuk periode {bulan_tahun}."}


def bayar_tagihan(tagihan_id, metode_pembayaran="Transfer Bank", bukti_transfer=None, catatan="", role="penghuni", user_nama="User"):
    """
    Mencatat pembayaran tagihan:
    - Jika oleh penghuni: status menjadi 'Menunggu Konfirmasi'
    - Jika oleh admin: langsung disahkan menjadi 'Lunas'
    """
    t = execute_query("SELECT id, kode_invoice, status, total_bayar FROM tagihan_pembayaran WHERE id = %s", (tagihan_id,), fetchone=True)
    if not t["status"] or not t["data"]:
        return {"status": False, "pesan": "Data tagihan tidak ditemukan."}

    tagihan = t["data"]
    if tagihan["status"] == "Lunas":
        return {"status": False, "pesan": "Tagihan ini sudah lunas sebelumnya."}

    today_str = str(datetime.date.today())

    if role == "admin":
        # Admin langsung melunaskan
        query = """
            UPDATE tagihan_pembayaran 
            SET status = 'Lunas', tanggal_bayar = %s, metode_pembayaran = %s, bukti_transfer = COALESCE(%s, bukti_transfer), catatan = %s
            WHERE id = %s
        """
        params = (today_str, metode_pembayaran, bukti_transfer, catatan or "Pembayaran dikonfirmasi oleh Admin", tagihan_id)
        res = execute_query(query, params, commit=True)
        if res["status"]:
            catat_log(None, user_nama, "admin", "Pelunasan Tagihan", f"Konfirmasi lunas tagihan {tagihan['kode_invoice']}")
            return {"status": True, "pesan": f"Tagihan {tagihan['kode_invoice']} berhasil dilunasi."}
    else:
        # Penghuni upload bukti pembayaran
        query = """
            UPDATE tagihan_pembayaran 
            SET status = 'Menunggu Konfirmasi', tanggal_bayar = %s, metode_pembayaran = %s, bukti_transfer = %s, catatan = %s
            WHERE id = %s
        """
        params = (today_str, metode_pembayaran, bukti_transfer, catatan or "Menunggu verifikasi admin", tagihan_id)
        res = execute_query(query, params, commit=True)
        if res["status"]:
            catat_log(None, user_nama, "penghuni", "Kirim Bukti Pembayaran", f"Penghuni mengunggah bukti bayar invoice {tagihan['kode_invoice']}")
            return {"status": True, "pesan": "Bukti pembayaran berhasil dikirim! Menunggu konfirmasi admin."}

    return {"status": False, "pesan": "Gagal memproses pembayaran tagihan."}


def verifikasi_tagihan(tagihan_id, status_verifikasi="Lunas", admin_user="admin"):
    """Admin menyetujui pembayaran (Lunas) atau menolak (Belum Bayar)."""
    t = execute_query("SELECT kode_invoice FROM tagihan_pembayaran WHERE id = %s", (tagihan_id,), fetchone=True)
    if not t["status"] or not t["data"]:
        return {"status": False, "pesan": "Tagihan tidak ditemukan."}

    kode = t["data"]["kode_invoice"]
    today_str = str(datetime.date.today()) if status_verifikasi == "Lunas" else None

    query = "UPDATE tagihan_pembayaran SET status = %s, tanggal_bayar = %s WHERE id = %s"
    res = execute_query(query, (status_verifikasi, today_str, tagihan_id), commit=True)
    if res["status"]:
        catat_log(None, admin_user, "admin", "Verifikasi Tagihan", f"Mengubah status tagihan {kode} menjadi '{status_verifikasi}'")
        return {"status": True, "pesan": f"Tagihan {kode} berhasil diubah statusnya menjadi {status_verifikasi}."}
    return {"status": False, "pesan": res["pesan"]}


def get_data_kuitansi(tagihan_id):
    """
    Mengambil data terstruktur untuk pencetakan kuitansi resmi (Kop Kos, Detail Pembayaran, TTD).
    """
    query = """
        SELECT t.id, t.kode_invoice, t.bulan_tahun, t.nominal, t.denda, t.total_bayar,
               DATE_FORMAT(t.jatuh_tempo, '%%d/%%m/%%Y') AS jatuh_tempo,
               DATE_FORMAT(t.tanggal_bayar, '%%d/%%m/%%Y') AS tanggal_bayar,
               t.metode_pembayaran, t.status, t.catatan,
               p.nama AS nama_penghuni, p.no_hp AS no_hp_penghuni,
               k.nomor_kamar, k.tipe AS tipe_kamar,
               pk.nama_kos, pk.tagline AS tagline_kos, pk.alamat AS alamat_kos, pk.no_wa AS no_wa_kos
        FROM tagihan_pembayaran t
        JOIN penghuni p ON t.penghuni_id = p.id
        JOIN kamar k ON t.kamar_id = k.id
        LEFT JOIN pengaturan_kos pk ON pk.id = 1
        WHERE t.id = %s
    """
    res = execute_query(query, (tagihan_id,), fetchone=True)
    return res


def get_daftar_pengeluaran(bulan_tahun=None, kategori=None):
    """Mengambil daftar transaksi pengeluaran operasional."""
    conditions = []
    params = []

    if bulan_tahun and bulan_tahun != "Semua":
        conditions.append("DATE_FORMAT(tanggal, '%%Y-%%m') = %s")
        params.append(bulan_tahun)

    if kategori and kategori != "Semua":
        conditions.append("kategori = %s")
        params.append(kategori)

    where_clause = " WHERE " + " AND ".join(conditions) if conditions else ""

    query = f"""
        SELECT id, kategori, keterangan, nominal,
               DATE_FORMAT(tanggal, '%%d/%%m/%%Y') AS tgl_format, tanggal,
               bukti_nota
        FROM pengeluaran
        {where_clause}
        ORDER BY tanggal DESC, id DESC
    """
    return execute_query(query, params, fetchall=True)


def tambah_pengeluaran(kategori, keterangan, nominal, tanggal=None, bukti_nota=None, admin_user="admin"):
    """Mencatat pengeluaran operasional baru."""
    keterangan = str(keterangan or "").strip()
    if not keterangan:
        return {"status": False, "pesan": "Keterangan pengeluaran wajib diisi."}

    try:
        nominal = int(nominal or 0)
    except ValueError:
        return {"status": False, "pesan": "Nominal harus berupa angka valid."}

    if nominal <= 0:
        return {"status": False, "pesan": "Nominal pengeluaran harus lebih dari 0."}

    tanggal = tanggal or str(datetime.date.today())

    query = """
        INSERT INTO pengeluaran (kategori, keterangan, nominal, tanggal, bukti_nota)
        VALUES (%s, %s, %s, %s, %s)
    """
    res = execute_query(query, (kategori, keterangan, nominal, tanggal, bukti_nota), commit=True, return_id=True)
    if res["status"]:
        catat_log(None, admin_user, "admin", "Catat Pengeluaran", f"Pengeluaran {kategori}: {keterangan} (Rp {nominal:,})")
        return {"status": True, "pesan": "Pengeluaran berhasil dicatat."}
    return {"status": False, "pesan": res["pesan"]}


def hapus_pengeluaran(pengeluaran_id, admin_user="admin"):
    """Menghapus catatan pengeluaran."""
    res = execute_query("DELETE FROM pengeluaran WHERE id = %s", (pengeluaran_id,), commit=True)
    if res["status"]:
        catat_log(None, admin_user, "admin", "Hapus Pengeluaran", f"Menghapus pengeluaran ID #{pengeluaran_id}")
        return {"status": True, "pesan": "Data pengeluaran berhasil dihapus."}
    return {"status": False, "pesan": res["pesan"]}


# ==========================================
# Modul Keluhan & Maintenance
# ==========================================

def lapor_keluhan(penghuni_id, kamar_id, judul, deskripsi, prioritas="Sedang", foto_keluhan=None, user_nama="Penghuni"):
    """Penghuni mengajukan komplain atau permohonan perbaikan fasilitas."""
    judul = str(judul or "").strip()
    deskripsi = str(deskripsi or "").strip()
    if not judul or not deskripsi:
        return {"status": False, "pesan": "Judul dan deskripsi keluhan wajib diisi."}

    query = """
        INSERT INTO keluhan (penghuni_id, kamar_id, judul, deskripsi, prioritas, foto_keluhan, status)
        VALUES (%s, %s, %s, %s, %s, %s, 'Menunggu')
    """
    res = execute_query(query, (penghuni_id, kamar_id, judul, deskripsi, prioritas, foto_keluhan), commit=True, return_id=True)
    if res["status"]:
        catat_log(None, user_nama, "penghuni", "Tiket Keluhan", f"Mengajukan keluhan: {judul}")
        return {"status": True, "pesan": "Keluhan Anda telah dikirim! Pengelola akan segera menindaklanjuti."}
    return {"status": False, "pesan": res["pesan"]}


def get_daftar_keluhan(status=None, penghuni_id=None):
    """Mengambil daftar tiket keluhan."""
    conditions = []
    params = []

    if status and status != "Semua":
        conditions.append("c.status = %s")
        params.append(status)

    if penghuni_id:
        conditions.append("c.penghuni_id = %s")
        params.append(int(penghuni_id))

    where_clause = " WHERE " + " AND ".join(conditions) if conditions else ""

    query = f"""
        SELECT c.id, c.penghuni_id, c.kamar_id, c.judul, c.deskripsi, c.prioritas,
               c.foto_keluhan, c.status, c.tindakan, c.biaya_perbaikan,
               DATE_FORMAT(c.created_at, '%%d/%%m/%%Y %%H:%%i') AS waktu_lapor,
               p.nama AS nama_penghuni, p.no_hp AS no_hp_penghuni,
               k.nomor_kamar
        FROM keluhan c
        JOIN penghuni p ON c.penghuni_id = p.id
        JOIN kamar k ON c.kamar_id = k.id
        {where_clause}
        ORDER BY c.id DESC
    """
    return execute_query(query, params, fetchall=True)


def update_status_keluhan(keluhan_id, status_baru, tindakan="", biaya_perbaikan=0, admin_user="admin"):
    """
    Admin memperbarui tiket keluhan (Menunggu -> Diproses -> Selesai).
    Jika status Selesai dan biaya_perbaikan > 0, otomatis dicatat ke tabel pengeluaran!
    """
    c = execute_query("SELECT id, judul, kamar_id FROM keluhan WHERE id = %s", (keluhan_id,), fetchone=True)
    if not c["status"] or not c["data"]:
        return {"status": False, "pesan": "Keluhan tidak ditemukan."}

    keluhan = c["data"]
    try:
        biaya_perbaikan = int(biaya_perbaikan or 0)
    except ValueError:
        biaya_perbaikan = 0

    query = """
        UPDATE keluhan 
        SET status = %s, tindakan = %s, biaya_perbaikan = %s
        WHERE id = %s
    """
    res = execute_query(query, (status_baru, tindakan, biaya_perbaikan, keluhan_id), commit=True)
    if not res["status"]:
        return {"status": False, "pesan": res["pesan"]}

    # Jika berbiaya dan status selesai, otomatis input ke Pengeluaran
    if status_baru == "Selesai" and biaya_perbaikan > 0:
        keterangan_exp = f"Perbaikan Keluhan #{keluhan_id}: {keluhan['judul']}"
        tambah_pengeluaran("Maintenance", keterangan_exp, biaya_perbaikan, str(datetime.date.today()), admin_user=admin_user)

    catat_log(None, admin_user, "admin", "Update Tiket Keluhan", f"Keluhan #{keluhan_id} diubah ke status '{status_baru}'")
    return {"status": True, "pesan": f"Status keluhan berhasil diperbarui menjadi {status_baru}."}
