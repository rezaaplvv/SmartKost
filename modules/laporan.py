"""
Data Analytics, Aggregations, Chart.js Visualizations, and Excel/CSV Export Module using Pandas
"""

import os
import datetime
import pandas as pd
from db import execute_query


def _get_exports_dir():
    """Membuat dan mengembalikan folder penyimpanan export laporan."""
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    export_path = os.path.join(base_dir, "exports")
    os.makedirs(export_path, exist_ok=True)
    return export_path


def get_kpi_dashboard():
    """
    Menghitung Key Performance Indicators (KPI) utama untuk kartu metrik Dashboard
    menggunakan agregasi Pandas DataFrame.
    """
    now = datetime.date.today()
    bln_ini = now.strftime("%Y-%m")
    bln_lalu = (now.replace(day=1) - datetime.timedelta(days=1)).strftime("%Y-%m")

    # 1. Pemasukan dari Tagihan Lunas
    q_tagihan = """
        SELECT bulan_tahun, total_bayar, status
        FROM tagihan_pembayaran
    """
    res_t = execute_query(q_tagihan, fetchall=True)
    df_t = pd.DataFrame(res_t["data"] or [])

    pemasukan_ini = 0
    pemasukan_lalu = 0
    total_tunggakan = 0

    if not df_t.empty:
        # Pemasukan lunas bulan ini
        mask_lunas_ini = (df_t["bulan_tahun"] == bln_ini) & (df_t["status"] == "Lunas")
        pemasukan_ini = int(df_t[mask_lunas_ini]["total_bayar"].sum()) if not df_t[mask_lunas_ini].empty else 0

        # Pemasukan lunas bulan lalu
        mask_lunas_lalu = (df_t["bulan_tahun"] == bln_lalu) & (df_t["status"] == "Lunas")
        pemasukan_lalu = int(df_t[mask_lunas_lalu]["total_bayar"].sum()) if not df_t[mask_lunas_lalu].empty else 0

        # Total tagihan menunggak (semua bulan berjalan yang belum lunas)
        mask_tunggakan = df_t["status"] == "Belum Bayar"
        total_tunggakan = int(df_t[mask_tunggakan]["total_bayar"].sum()) if not df_t[mask_tunggakan].empty else 0

    # Persentase pertumbuhan omzet
    if pemasukan_lalu > 0:
        growth_pemasukan = round(((pemasukan_ini - pemasukan_lalu) / pemasukan_lalu) * 100, 1)
    else:
        growth_pemasukan = 100.0 if pemasukan_ini > 0 else 0.0

    # 2. Pengeluaran Bulan Ini
    q_exp = """
        SELECT DATE_FORMAT(tanggal, '%%Y-%%m') AS bulan_tahun, nominal
        FROM pengeluaran
    """
    res_e = execute_query(q_exp, fetchall=True)
    df_e = pd.DataFrame(res_e["data"] or [])

    pengeluaran_ini = 0
    if not df_e.empty:
        mask_exp_ini = df_e["bulan_tahun"] == bln_ini
        pengeluaran_ini = int(df_e[mask_exp_ini]["nominal"].sum()) if not df_e[mask_exp_ini].empty else 0

    laba_bersih_ini = pemasukan_ini - pengeluaran_ini

    # 3. Metrik Kamar & Okupansi
    res_kamar = execute_query("SELECT status FROM kamar", fetchall=True)
    df_k = pd.DataFrame(res_kamar["data"] or [])
    total_kamar = len(df_k)
    kamar_terisi = len(df_k[df_k["status"] == "Terisi"]) if not df_k.empty else 0
    kamar_tersedia = len(df_k[df_k["status"] == "Tersedia"]) if not df_k.empty else 0
    okupansi_rate = round((kamar_terisi / total_kamar * 100), 1) if total_kamar > 0 else 0

    # 4. Penghuni Aktif & Action Center Counts
    res_ph = execute_query("SELECT COUNT(*) AS total FROM penghuni WHERE status = 'Aktif'", fetchone=True)
    penghuni_aktif = res_ph["data"]["total"] if res_ph["status"] else 0

    res_bk = execute_query("SELECT COUNT(*) AS total FROM booking WHERE status = 'Pending'", fetchone=True)
    pending_booking = res_bk["data"]["total"] if res_bk["status"] else 0

    res_kl = execute_query("SELECT COUNT(*) AS total FROM keluhan WHERE status IN ('Menunggu', 'Diproses')", fetchone=True)
    active_keluhan = res_kl["data"]["total"] if res_kl["status"] else 0

    return {
        "status": True,
        "data": {
            "pemasukan_bulan_ini": pemasukan_ini,
            "pengeluaran_bulan_ini": pengeluaran_ini,
            "laba_bersih_bulan_ini": laba_bersih_ini,
            "growth_pemasukan": growth_pemasukan,
            "total_tunggakan": total_tunggakan,
            "total_kamar": total_kamar,
            "kamar_terisi": kamar_terisi,
            "kamar_tersedia": kamar_tersedia,
            "penghuni_aktif": penghuni_aktif,
            "okupansi_rate": okupansi_rate,
            "pending_booking": pending_booking,
            "active_keluhan": active_keluhan,
            "periode_sekarang": bln_ini
        }
    }


def get_chart_cashflow(tahun=None):
    """
    Menghitung tren Cash Flow (Pemasukan, Pengeluaran, Profit) selama 12 bulan
    pada tahun tertentu menggunakan agregasi Pandas GroupBy.
    Format output langsung siap pakai di Chart.js!
    """
    tahun = str(tahun or datetime.date.today().year)
    bulan_labels = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]

    # Inisialisasi DataFrame 12 bulan (01 - 12)
    df_result = pd.DataFrame({
        "bulan_str": [f"{i:02d}" for i in range(1, 13)],
        "label": bulan_labels,
        "pemasukan": [0] * 12,
        "pengeluaran": [0] * 12
    }).set_index("bulan_str")

    # 1. Pemasukan Lunas
    q_pemasukan = """
        SELECT SUBSTRING(bulan_tahun, 6, 2) AS bulan_str, total_bayar
        FROM tagihan_pembayaran
        WHERE SUBSTRING(bulan_tahun, 1, 4) = %s AND status = 'Lunas'
    """
    res_p = execute_query(q_pemasukan, (tahun,), fetchall=True)
    if res_p["status"] and res_p["data"]:
        df_p = pd.DataFrame(res_p["data"])
        grouped_p = df_p.groupby("bulan_str")["total_bayar"].sum()
        for bln, val in grouped_p.items():
            if bln in df_result.index:
                df_result.at[bln, "pemasukan"] = int(val)

    # 2. Pengeluaran
    q_pengeluaran = """
        SELECT DATE_FORMAT(tanggal, '%%m') AS bulan_str, nominal
        FROM pengeluaran
        WHERE DATE_FORMAT(tanggal, '%%Y') = %s
    """
    res_e = execute_query(q_pengeluaran, (tahun,), fetchall=True)
    if res_e["status"] and res_e["data"]:
        df_e = pd.DataFrame(res_e["data"])
        grouped_e = df_e.groupby("bulan_str")["nominal"].sum()
        for bln, val in grouped_e.items():
            if bln in df_result.index:
                df_result.at[bln, "pengeluaran"] = int(val)

    df_result["profit"] = df_result["pemasukan"] - df_result["pengeluaran"]

    return {
        "status": True,
        "tahun": tahun,
        "data": {
            "labels": df_result["label"].tolist(),
            "pemasukan": df_result["pemasukan"].tolist(),
            "pengeluaran": df_result["pengeluaran"].tolist(),
            "profit": df_result["profit"].tolist()
        }
    }


def get_chart_okupansi_tipe():
    """
    Mengagregasi tingkat okupansi per tipe kamar (Reguler, VIP, Eksklusif)
    untuk grafik Doughnut / Bar Chart.js.
    """
    query = "SELECT tipe, status FROM kamar"
    res = execute_query(query, fetchall=True)
    if not res["status"] or not res["data"]:
        return {"status": False, "pesan": "Data kamar kosong."}

    df = pd.DataFrame(res["data"])
    tipe_list = ["Reguler", "VIP", "Eksklusif"]
    terisi_list = []
    total_list = []

    for t in tipe_list:
        sub = df[df["tipe"] == t]
        tot = len(sub)
        isi = len(sub[sub["status"] == "Terisi"])
        total_list.append(tot)
        terisi_list.append(isi)

    return {
        "status": True,
        "data": {
            "labels": tipe_list,
            "terisi": terisi_list,
            "total": total_list
        }
    }


def get_chart_kategori_pengeluaran(bulan_tahun=None):
    """
    Mengagregasi total pengeluaran berdasarkan kategori untuk grafik Pie/Donut.
    """
    conditions = []
    params = []
    if bulan_tahun and bulan_tahun != "Semua":
        conditions.append("DATE_FORMAT(tanggal, '%%Y-%%m') = %s")
        params.append(bulan_tahun)

    where_clause = " WHERE " + " AND ".join(conditions) if conditions else ""
    query = f"SELECT kategori, nominal FROM pengeluaran {where_clause}"

    res = execute_query(query, params, fetchall=True)
    if not res["status"] or not res["data"]:
        return {
            "status": True,
            "data": {"labels": [], "series": []}
        }

    df = pd.DataFrame(res["data"])
    grouped = df.groupby("kategori")["nominal"].sum()

    return {
        "status": True,
        "data": {
            "labels": grouped.index.tolist(),
            "series": [int(x) for x in grouped.values]
        }
    }


def export_laporan_keuangan_excel(tahun=None, output_filename=None):
    """
    Menghasilkan berkas Microsoft Excel (.xlsx) komprehensif dengan 3 Sheet:
    1. Sheet 'Pemasukan' (Daftar seluruh invoice sewa)
    2. Sheet 'Pengeluaran' (Daftar rincian beban operasional)
    3. Sheet 'Ringkasan Laba Bersih' (Matriks rekonsiliasi bulanan)
    """
    tahun = str(tahun or datetime.date.today().year)
    export_dir = _get_exports_dir()
    filename = output_filename or f"Laporan_Keuangan_SmartKost_{tahun}_{int(datetime.datetime.now().timestamp())}.xlsx"
    file_path = os.path.join(export_dir, filename)

    # 1. Query Pemasukan
    q_p = """
        SELECT t.kode_invoice AS 'Kode Invoice',
               t.bulan_tahun AS 'Periode',
               p.nama AS 'Nama Penghuni',
               k.nomor_kamar AS 'Kamar',
               k.tipe AS 'Tipe Kamar',
               t.nominal AS 'Nominal Sewa',
               t.denda AS 'Denda',
               t.total_bayar AS 'Total Bayar',
               t.status AS 'Status',
               DATE_FORMAT(t.tanggal_bayar, '%%d/%%m/%%Y') AS 'Tanggal Bayar',
               t.metode_pembayaran AS 'Metode Pembayaran'
        FROM tagihan_pembayaran t
        JOIN penghuni p ON t.penghuni_id = p.id
        JOIN kamar k ON t.kamar_id = k.id
        WHERE SUBSTRING(t.bulan_tahun, 1, 4) = %s
        ORDER BY t.id ASC
    """
    res_p = execute_query(q_p, (tahun,), fetchall=True)
    df_p = pd.DataFrame(res_p["data"] or [])

    # 2. Query Pengeluaran
    q_e = """
        SELECT DATE_FORMAT(tanggal, '%%d/%%m/%%Y') AS 'Tanggal',
               kategori AS 'Kategori',
               keterangan AS 'Keterangan',
               nominal AS 'Nominal Pengeluaran'
        FROM pengeluaran
        WHERE DATE_FORMAT(tanggal, '%%Y') = %s
        ORDER BY tanggal ASC
    """
    res_e = execute_query(q_e, (tahun,), fetchall=True)
    df_e = pd.DataFrame(res_e["data"] or [])

    # 3. Sheet Ringkasan Bulanan (Pandas Grouping)
    cashflow = get_chart_cashflow(tahun)["data"]
    df_summary = pd.DataFrame({
        "Bulan": cashflow["labels"],
        "Total Pemasukan (Rp)": cashflow["pemasukan"],
        "Total Pengeluaran (Rp)": cashflow["pengeluaran"],
        "Laba Bersih / Cash Flow (Rp)": cashflow["profit"]
    })

    # Tulis multi-sheet Excel
    with pd.ExcelWriter(file_path, engine="openpyxl") as writer:
        df_summary.to_excel(writer, sheet_name="Ringkasan Arus Kas", index=False)
        df_p.to_excel(writer, sheet_name="Rincian Pemasukan", index=False)
        df_e.to_excel(writer, sheet_name="Rincian Pengeluaran", index=False)

    return {
        "status": True,
        "pesan": f"Laporan keuangan tahun {tahun} berhasil diekspor ke Excel.",
        "file_path": file_path,
        "file_name": filename
    }


def export_data_penghuni_excel(output_filename=None):
    """
    Mengekspor Master Data Seluruh Penghuni & Arsip Alumni ke berkas Excel.
    """
    export_dir = _get_exports_dir()
    filename = output_filename or f"Data_Penghuni_SmartKost_{int(datetime.datetime.now().timestamp())}.xlsx"
    file_path = os.path.join(export_dir, filename)

    query = """
        SELECT p.nama AS 'Nama Penghuni',
               k.nomor_kamar AS 'Kamar',
               k.tipe AS 'Tipe Kamar',
               p.no_hp AS 'No. Kontak / WhatsApp',
               p.pekerjaan AS 'Pekerjaan / Instansi',
               p.asal_kota AS 'Asal Kota',
               DATE_FORMAT(p.tanggal_masuk, '%%d/%%m/%%Y') AS 'Tanggal Masuk',
               DATE_FORMAT(p.tanggal_keluar, '%%d/%%m/%%Y') AS 'Tanggal Keluar',
               p.status AS 'Status Huni'
        FROM penghuni p
        LEFT JOIN kamar k ON p.kamar_id = k.id
        ORDER BY p.status ASC, p.id DESC
    """
    res = execute_query(query, fetchall=True)
    df = pd.DataFrame(res["data"] or [])

    with pd.ExcelWriter(file_path, engine="openpyxl") as writer:
        df[df["Status Huni"] == "Aktif"].to_excel(writer, sheet_name="Penghuni Aktif", index=False)
        df[df["Status Huni"] == "Keluar"].to_excel(writer, sheet_name="Arsip Alumni Keluar", index=False)

    return {
        "status": True,
        "pesan": "Master data penghuni berhasil diekspor ke Excel.",
        "file_path": file_path,
        "file_name": filename
    }


def export_laporan_csv(jenis="pemasukan", tahun=None):
    """
    Mengekspor data ke format CSV menggunakan fungsi bawaan Pandas df.to_csv()
    (Implementasi materi Pertemuan 7/8).
    """
    export_dir = _get_exports_dir()
    tahun = str(tahun or datetime.date.today().year)

    if jenis == "pemasukan":
        q = """
            SELECT t.kode_invoice, t.bulan_tahun, p.nama, k.nomor_kamar, t.nominal, t.denda, t.total_bayar, t.status, t.tanggal_bayar, t.metode_pembayaran
            FROM tagihan_pembayaran t
            JOIN penghuni p ON t.penghuni_id = p.id
            JOIN kamar k ON t.kamar_id = k.id
            WHERE SUBSTRING(t.bulan_tahun, 1, 4) = %s
        """
        filename = f"Pemasukan_{tahun}.csv"
    else:
        q = """
            SELECT tanggal, kategori, keterangan, nominal
            FROM pengeluaran
            WHERE DATE_FORMAT(tanggal, '%%Y') = %s
        """
        filename = f"Pengeluaran_{tahun}.csv"

    res = execute_query(q, (tahun,), fetchall=True)
    df = pd.DataFrame(res["data"] or [])
    file_path = os.path.join(export_dir, filename)
    df.to_csv(file_path, index=False, encoding="utf-8")

    return {
        "status": True,
        "pesan": f"Data {jenis} berhasil diekspor ke {filename}",
        "file_path": file_path
    }

