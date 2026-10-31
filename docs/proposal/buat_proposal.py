from docx import Document
from docx.enum.section import WD_ORIENT
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

G = r'C:\Users\LEONAR~1\AppData\Local\Temp\claude\d--sit-tbsu\6674e442-ae89-4859-8501-29d0007c9f62\scratchpad\proposal'
OUT = r'D:\sit-tbsu\docs\proposal\Proposal-Implementasi-BonsaiUrip-UD-Sumber-Urip.docx'

BIRU = RGBColor(0x1D, 0x4E, 0xD8)
KAYU = RGBColor(0x36, 0x26, 0x1C)
ABU = RGBColor(0x47, 0x55, 0x69)

d = Document()
sec = d.sections[0]
sec.page_height, sec.page_width = Cm(29.7), Cm(21)
for s in ('left_margin', 'right_margin'):
    setattr(sec, s, Cm(2.2))
sec.top_margin, sec.bottom_margin = Cm(2), Cm(2)

st = d.styles['Normal']
st.font.name = 'Calibri'
st.font.size = Pt(11.5)
st.element.rPr.rFonts.set(qn('w:eastAsia'), 'Calibri')
st.paragraph_format.space_after = Pt(5)
st.paragraph_format.line_spacing = 1.15
for n, ukuran, warna in (('Heading 1', 20, KAYU), ('Heading 2', 14.5, BIRU), ('Heading 3', 12.5, KAYU)):
    h = d.styles[n]
    h.font.name = 'Calibri'
    h.font.size = Pt(ukuran)
    h.font.bold = True
    h.font.color.rgb = warna
    h.element.rPr.rFonts.set(qn('w:asciiTheme'), 'minorHAnsi') if False else None
    h.paragraph_format.space_before = Pt(14 if n == 'Heading 1' else 10)
    h.paragraph_format.space_after = Pt(6)

# Nomor halaman di kaki
fp = sec.footer.paragraphs[0]
fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = fp.add_run('Proposal Implementasi BonsaiUrip · UD. Sumber Urip · halaman ')
r.font.size = Pt(9)
r.font.color.rgb = ABU
for kode in ('begin', None, 'end'):
    if kode is None:
        it = OxmlElement('w:instrText')
        it.set(qn('xml:space'), 'preserve')
        it.text = 'PAGE'
        rr = fp.add_run()
        rr._r.append(it)
    else:
        fc = OxmlElement('w:fldChar')
        fc.set(qn('w:fldCharType'), kode)
        rr = fp.add_run()
        rr._r.append(fc)
    rr.font.size = Pt(9)


def warna_sel(sel, hexwarna):
    tcPr = sel._tc.get_or_add_tcPr()
    sh = OxmlElement('w:shd')
    sh.set(qn('w:val'), 'clear')
    sh.set(qn('w:color'), 'auto')
    sh.set(qn('w:fill'), hexwarna)
    tcPr.append(sh)


def p(teks='', tebal=False, miring=False, ukuran=None, warna=None, rata=None, setelah=None):
    para = d.add_paragraph()
    if rata == 'tengah':
        para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    tambah_teks(para, teks, tebal, miring, ukuran, warna)
    if setelah is not None:
        para.paragraph_format.space_after = Pt(setelah)
    return para


def tambah_teks(para, teks, tebal=False, miring=False, ukuran=None, warna=None):
    # **tebal** di dalam teks
    bagian = teks.split('**')
    for i, b in enumerate(bagian):
        if not b:
            continue
        r = para.add_run(b)
        r.bold = tebal or (i % 2 == 1)
        r.italic = miring
        if ukuran:
            r.font.size = Pt(ukuran)
        if warna:
            r.font.color.rgb = warna


def poin(teks, tingkat=0, nomor=False):
    para = d.add_paragraph(style='List Number' if nomor else 'List Bullet')
    para.paragraph_format.left_indent = Cm(0.7 + 0.6 * tingkat)
    para.paragraph_format.space_after = Pt(2)
    tambah_teks(para, teks)
    return para


def tabel(kepala, baris, lebar=None, warna_kepala='1E3A8A', ukuran=10):
    t = d.add_table(rows=1, cols=len(kepala))
    t.style = 'Table Grid'
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, k in enumerate(kepala):
        sel = t.rows[0].cells[i]
        sel.text = ''
        tambah_teks(sel.paragraphs[0], k, tebal=True, ukuran=ukuran, warna=RGBColor(0xFF, 0xFF, 0xFF))
        warna_sel(sel, warna_kepala)
    for j, br in enumerate(baris):
        sel_baris = t.add_row().cells
        for i, isi in enumerate(br):
            sel_baris[i].text = ''
            for k, baris_teks in enumerate(str(isi).split('\n')):
                para = sel_baris[i].paragraphs[0] if k == 0 else sel_baris[i].add_paragraph()
                para.paragraph_format.space_after = Pt(1)
                tambah_teks(para, baris_teks, ukuran=ukuran)
            if j % 2 == 1:
                warna_sel(sel_baris[i], 'F1F5F9')
    if lebar:
        for row in t.rows:
            for i, w in enumerate(lebar):
                row.cells[i].width = Cm(w)
    d.add_paragraph().paragraph_format.space_after = Pt(2)
    return t


def kotak(judul, isi, warna='FEF3C7'):
    t = d.add_table(rows=1, cols=1)
    t.style = 'Table Grid'
    sel = t.rows[0].cells[0]
    warna_sel(sel, warna)
    sel.text = ''
    tambah_teks(sel.paragraphs[0], judul, tebal=True)
    for baris in isi:
        para = sel.add_paragraph()
        para.paragraph_format.space_after = Pt(1)
        tambah_teks(para, baris)
    d.add_paragraph().paragraph_format.space_after = Pt(2)


def gambar(nama, lebar=16.5, keterangan=None):
    d.add_picture(f'{G}\\{nama}', width=Cm(lebar))
    d.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
    if keterangan:
        p(keterangan, miring=True, ukuran=9.5, warna=ABU, rata='tengah', setelah=8)


def baru():
    d.add_paragraph().add_run().add_break(WD_BREAK.PAGE)


# ======================= SAMPUL =======================
for _ in range(3):
    d.add_paragraph()
d.add_picture(r'D:\sit-tbsu\apps\web\public\ikon-512.png', width=Cm(4))
d.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
p('PROPOSAL', tebal=True, ukuran=16, warna=ABU, rata='tengah', setelah=0)
p('Rencana Implementasi Sistem Informasi', tebal=True, ukuran=24, warna=KAYU, rata='tengah', setelah=0)
p('BonsaiUrip', tebal=True, ukuran=30, warna=BIRU, rata='tengah', setelah=4)
p('Penjualan · Persediaan · Kas · Pengantaran · Laporan', ukuran=13, warna=ABU, rata='tengah', setelah=30)
p('untuk', ukuran=12, rata='tengah', setelah=0)
p('UD. Sumber Urip', tebal=True, ukuran=20, rata='tengah', setelah=0)
p('Toko Bahan Bangunan · Peterongan, Jombang', ukuran=12, rata='tengah', setelah=60)
p('Disusun oleh: ______________________________', ukuran=12, rata='tengah', setelah=2)
p('Tanggal: ____ / ____ / 2026', ukuran=12, rata='tengah', setelah=2)
p('Versi aplikasi yang diperagakan: 1.18.0', ukuran=10, warna=ABU, rata='tengah')
baru()

# ======================= ISI =======================
d.add_heading('Isi proposal', level=1)
for i, j in enumerate([
    'Ringkasan untuk Bapak/Ibu Owner (1 halaman)',
    'Mengenal BonsaiUrip: siapa memakai apa',
    'Fitur lengkap, dijelaskan per pekerjaan',
    'Pilihan tempat aplikasi berjalan: di toko atau server online',
    'Kebutuhan perangkat dan perkiraan biaya',
    'Kebutuhan orang (SDM) dan pembagian tugas',
    'Rencana pelaksanaan langkah demi langkah',
    'Perubahan cara kerja toko (sebelum vs sesudah)',
    'Pelatihan karyawan',
    'Pengawasan (kontrol) dan budaya kerja baru',
    'Manajemen perubahan: hambatan, risiko, dan jalan keluarnya',
    'Keamanan dan cadangan data',
    'Keputusan yang diminta dari Owner',
    'Lampiran: daftar istilah, lembar keputusan',
], 1):
    p(f'{i}.  {j}', setelah=3)
baru()

# ======================= 1. RINGKASAN =======================
d.add_heading('1. Ringkasan untuk Bapak/Ibu Owner', level=1)
p('**BonsaiUrip** adalah aplikasi untuk mencatat seluruh kegiatan toko dalam satu tempat: pesanan, kasir, '
  'pengantaran, stok barang, uang kas, piutang, hutang pemasok, sampai laporan laba. Dibuat khusus mengikuti cara '
  'kerja toko bahan bangunan seperti UD. Sumber Urip.')
tabel(['Keadaan sekarang (umumnya)', 'Dengan BonsaiUrip'], [
    ['Stok dihitung manual, sering tidak cocok dengan gudang', 'Stok berubah otomatis setiap jual, terima, retur'],
    ['Uang laci baru ketahuan selisih di akhir hari, sulit dilacak', 'Uang dicocokkan per shift; selisih terlihat siapa dan kapan'],
    ['Piutang dan jatuh tempo diingat atau dicatat di buku', 'Piutang tercatat per pelanggan, ada pengingat jatuh tempo'],
    ['Owner harus di toko untuk tahu keadaan', 'Owner melihat penjualan, stok, laba dari HP kapan saja'],
    ['Laporan direkap manual, butuh waktu', 'Laporan siap cetak / Excel dengan sekali klik'],
    ['Kesalahan sulit ditelusuri', 'Setiap aksi tercatat atas nama karyawan (jejak lengkap)'],
], lebar=[8, 8.6])
kotak('Yang kami minta diputuskan Owner (rincian di Bab 13):', [
    '1.  Aplikasi dijalankan **di toko (lokal)** atau **di server online (sewa hosting)**.',
    '2.  Perangkat yang dibeli / dipakai (komputer, printer, tablet).',
    '3.  Siapa **penanggung jawab (PIC)** sistem di toko.',
    '4.  Tanggal mulai uji coba dan tanggal mulai penuh.',
], warna='DBEAFE')
p('**Rekomendasi kami:** mulai dengan **server di toko (lokal)** karena tanpa biaya bulanan dan tetap jalan saat '
  'internet putus. Bila kelak toko bertambah cabang, data bisa dipindah ke server online tanpa input ulang.')
baru()

# ======================= 2. MENGENAL =======================
d.add_heading('2. Mengenal BonsaiUrip', level=1)
gambar('d1-alur.png', 16.5, 'Gambar 1. Alur kerja harian: setiap langkah dicatat sekali, sisanya dihitung aplikasi.')
d.add_heading('Siapa memakai apa', level=2)
tabel(['Peran', 'Pekerjaan utama di aplikasi', 'Tidak bisa melihat'], [
    ['**Owner** (pemilik)', 'Semua: laporan laba, pengaturan, akun karyawan, persetujuan, cadangan data', '—'],
    ['**Admin**', 'Data barang & harga, penerimaan barang, stok/opname, pengiriman, laporan', 'Pengaturan inti, laba (sesuai izin)'],
    ['**Kasir**', 'Buka/tutup shift, terima pembayaran, cetak struk, retur/void (perlu persetujuan)', 'Harga modal, laba'],
    ['**Staf penjualan**', 'Mencatat pesanan pembeli, cek stok & harga', 'Uang, laporan, harga modal'],
    ['**Sopir / gudang**', 'Tidak wajib punya akun; hasil kirim dicatat admin/kasir', '—'],
], lebar=[3.4, 8.5, 4.7])
p('Setiap orang masuk dengan **akun sendiri**. Menu yang tampil menyesuaikan perannya, sehingga data sensitif '
  '(harga modal, laba) hanya terlihat oleh yang berhak.')
gambar('02-dashboard.png', 16.5, 'Gambar 2. Dashboard: ringkasan hari ini, aksi cepat, hal yang perlu perhatian.')
baru()

# ======================= 3. FITUR =======================
d.add_heading('3. Fitur lengkap, per pekerjaan', level=1)
p('Dijelaskan singkat: **apa gunanya bagi toko**. Semua fitur sudah ada di versi yang diperagakan.')

d.add_heading('3.1 Penjualan', level=2)
tabel(['Fitur', 'Gunanya bagi toko'], [
    ['**Kasir (Penjualan Langsung)**', 'Jual cepat dengan keyboard/scan barcode. Bayar tunai, transfer, EDC, QRIS, atau campuran. Struk tercetak otomatis.'],
    ['**Order Penjualan**', 'Staf mencatat pesanan di lantai toko/gudang; pesanan langsung masuk antrean kasir. Stok barang dipesan (tidak terjual ke orang lain).'],
    ['**Penjualan Pengantaran**', 'Untuk barang diantar: alamat kirim, DP (uang muka), bayar saat terima, atau kredit. Hasilnya invoice.'],
    ['**Harga bertingkat & promo**', 'Harga eceran/grosir otomatis menurut total belanja. Promo: beli X gratis Y, potongan, harga khusus, berlaku jam/hari tertentu.'],
    ['**Piutang & limit kredit**', 'Tagihan pelanggan per jatuh tempo, pengingat terlambat, batas kredit per pelanggan.'],
    ['**Retur & Void**', 'Koreksi transaksi tanpa menghapus. Di atas batas tertentu perlu kode persetujuan atasan (dikirim ke HP atasan).'],
    ['**Pengecekan qty tidak biasa**', 'Salah ketik (mis. 2 jadi 20) ditandai dan ditanyakan sebelum bayar.'],
], lebar=[4.6, 12])
gambar('04-kasir.png', 16, 'Gambar 3. Layar kasir: cari barang (F2), keranjang, total, cara bayar, Bayar & cetak (Enter).')

d.add_heading('3.2 Pengantaran dan armada', level=2)
tabel(['Fitur', 'Gunanya bagi toko'], [
    ['**Papan Pengiriman**', 'Semua pesanan antar terlihat dalam satu papan. Disusun per rit (kendaraan + sopir + jam).'],
    ['**Surat jalan 2 rangkap**', 'Dicetak dari rit: asli untuk arsip toko, salinan untuk penerima.'],
    ['**Cek muatan kendaraan**', 'Berat dan ukuran muatan dihitung; kelebihan muatan diperingatkan/ditolak (mencegah truk kelebihan beban).'],
    ['**Hasil kirim**', 'Barang diterima / kembali / rusak dicatat; tagihan dan stok menyesuaikan otomatis.'],
    ['**Data kendaraan & sopir**', 'Pengingat STNK/KIR dan servis.'],
], lebar=[4.6, 12])
gambar('06-pengiriman.png', 15, 'Gambar 4. Papan Pengiriman.')

d.add_heading('3.3 Persediaan (stok) dan pembelian', level=2)
tabel(['Fitur', 'Gunanya bagi toko'], [
    ['**Stok otomatis**', 'Stok fisik, stok dipesan, dan stok tersedia per barang; berubah hanya lewat transaksi (tidak bisa diketik asal).'],
    ['**Penerimaan barang**', 'Barang datang dari pemasok dicatat; stok bertambah, harga modal rata-rata (HPP) dihitung otomatis.'],
    ['**Opname & koreksi**', 'Hitung fisik gudang, cocokkan, alasan wajib. Panduan menangani selisih karena salah input/serah.'],
    ['**Saran pesan**', 'Daftar barang yang perlu dipesan dihitung dari kecepatan laku; bisa langsung jadi order pembelian.'],
    ['**Order pembelian & hutang pemasok**', 'Pesan ke pemasok, uang muka, terima barang, jatuh tempo hutang.'],
    ['**Barang titipan (konsinyasi)**', 'Barang milik pemasok dicatat terpisah dan disetor sesuai penjualan.'],
    ['**Satuan & harga**', 'Satu barang bisa banyak satuan (sak, palet, batang, meter). Harga jual dari markup atau harga tetap.'],
], lebar=[4.6, 12])
gambar('07-stok.png', 15, 'Gambar 5. Stok Persediaan: habis, kritis, perlu dipesan, aman.')

d.add_heading('3.4 Kas dan shift', level=2)
tabel(['Fitur', 'Gunanya bagi toko'], [
    ['**Buka/tutup shift**', 'Uang laci dihitung per pecahan saat buka dan tutup. Uang tunai hanya bisa diterima saat shift terbuka.'],
    ['**Kas masuk/keluar**', 'Kasbon, beli bensin, setoran ke owner tercatat, sehingga hitungan akhir pasti cocok.'],
    ['**Cocokkan uang (clerical check)**', 'Selisih langsung terlihat; ada bantuan urutan uang masuk-keluar untuk mencari sebabnya.'],
    ['**Cek transfer/EDC/QRIS**', 'Setiap pembayaran non-tunai wajib No. referensi dan dicek masuk rekening.'],
    ['**Pengaman shift**', 'Aplikasi tidak bisa dimatikan selama shift belum ditutup. Bila listrik mati mendadak, saat menyala lagi tampil ringkasan shift dan langkah pemeriksaan.'],
], lebar=[4.6, 12])

d.add_heading('3.5 Laporan untuk Owner', level=2)
p('Penjualan (harian, per barang, per kasir, per jam ramai), laba rugi, stok & nilai persediaan, kartu stok, piutang, '
  'hutang, kas & shift, retur/void, pengiriman. Semua bisa dicetak (format laporan resmi dengan kop & tanda tangan) '
  'atau diekspor ke Excel.')
gambar('08-laporan.png', 15, 'Gambar 6. Laporan: pilih jenis dan periode, pratinjau per halaman A4.')

d.add_heading('3.6 Kontrol, keamanan, dan data', level=2)
tabel(['Fitur', 'Gunanya bagi toko'], [
    ['**Hak akses per peran**', 'Karyawan hanya melihat yang perlu; harga modal & laba tersembunyi.'],
    ['**Persetujuan atasan**', 'Void/retur besar, ubah limit kredit memakai kode sekali pakai yang dikirim ke HP/email atasan.'],
    ['**Log aktivitas**', 'Siapa mengubah apa dan kapan; tidak bisa dihapus.'],
    ['**Cadangan harian**', 'Data disalin otomatis setiap hari (terenkripsi) ke flashdisk/hardisk lain; diuji sebulan sekali.'],
    ['**Pindah komputer**', 'Seluruh data bisa dibawa ke komputer baru dengan satu berkas bersandi.'],
    ['**Lupa password**', 'Kode ke email atau kode pemulihan kertas; Owner punya jalan pemulihan khusus di komputer toko.'],
], lebar=[4.6, 12])

d.add_heading('3.7 Mudah dipelajari, bisa dari HP/tablet', level=2)
tabel(['Fitur', 'Gunanya bagi toko'], [
    ['**Setup awal langkah demi langkah**', 'Pertama dipasang: isi data usaha dan akun Owner seperti mengisi formulir.'],
    ['**Tur di dalam aplikasi**', 'Setiap halaman bisa menampilkan sorotan dan penjelasan; karyawan baru belajar sendiri.'],
    ['**HP dan tablet**', 'Dipasang di layar utama HP seperti aplikasi; Owner memantau dari luar toko.'],
    ['**Buku SOP & panduan**', 'Prosedur baku per peran sudah tersedia untuk dicetak.'],
], lebar=[4.6, 12])
baru()

# ======================= 4. DEPLOY =======================
d.add_heading('4. Pilihan tempat aplikasi berjalan', level=1)
p('Aplikasi perlu satu "rumah" (server) tempat data disimpan. Ada dua pilihan. **Aplikasi dan fiturnya sama**; '
  'yang berbeda adalah biaya, ketergantungan internet, dan siapa yang merawat.')
gambar('d2-lokal.png', 13.5)
gambar('d3-server.png', 13.5)
tabel(['Pertimbangan', 'A. Server di toko (lokal)', 'B. Server online (hosting)'], [
    ['Biaya awal', 'Komputer server (bisa memakai yang ada) + UPS', 'Hampir tidak ada (tanpa komputer server)'],
    ['Biaya bulanan', '**Tidak ada** sewa (internet yang sudah ada)', 'Sewa server ± Rp 150–400 rb/bulan + domain'],
    ['Saat internet putus', '**Toko tetap jalan** (WiFi toko)', 'Toko **berhenti mencatat**'],
    ['Saat listrik mati', 'Berhenti sampai listrik/UPS; data aman', 'Server tetap jalan; perangkat toko perlu listrik'],
    ['Akses Owner dari luar', 'Ya, lewat Tailscale (gratis, terenkripsi)', 'Ya, langsung lewat alamat web'],
    ['Kecepatan di toko', 'Sangat cepat (jaringan lokal)', 'Tergantung internet'],
    ['Perawatan', 'Komputer server dijaga di toko; cadangan ke flashdisk', 'Penyedia hosting + pengembang'],
    ['Risiko utama', 'Komputer rusak/hilang (diatasi cadangan harian)', 'Internet tidak stabil; biaya terus berjalan'],
    ['Cocok untuk', '**1 toko**, internet kadang tidak stabil', 'Banyak cabang, internet sangat stabil'],
], lebar=[3.6, 6.5, 6.5])
kotak('Rekomendasi', [
    '**Mulai dengan A (server di toko).** Berkas Setup .exe yang diperagakan adalah bentuk A: dipasang sekali, '
    'tanpa sewa. Bila nanti toko berkembang, data dipindah ke B tanpa input ulang (fitur pindah komputer).',
    'Keputusan tetap di tangan Owner.',
], warna='DCFCE7')
gambar('11-akses.png', 10.5, 'Gambar 7. Pengaturan › Akses HP/tablet: alamat dan kode QR untuk HP karyawan dan Owner.')
t2 = d.add_table(rows=1, cols=2)
for i, (n, k) in enumerate((('14-hp-dashboard.png', 'Dashboard di HP'), ('15-hp-menu.png', 'Menu di HP'))):
    sel = t2.rows[0].cells[i]
    sel.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
    sel.paragraphs[0].add_run().add_picture(f'{G}\\{n}', width=Cm(3.6))
    tambah_teks(sel.add_paragraph(), k, miring=True, ukuran=9.5)
    sel.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
baru()

# ======================= 5. ASET =======================
d.add_heading('5. Kebutuhan perangkat dan perkiraan biaya', level=1)
p('Harga adalah **perkiraan pasar (Oktober 2026)**; mohon dicek ulang di toko komputer. Perangkat yang sudah '
  'dimiliki toko bisa dipakai bila memenuhi syarat.', miring=True, warna=ABU)
d.add_heading('5.1 Pilihan A — server di toko', level=2)
tabel(['Perangkat', 'Jml', 'Spesifikasi minimal', 'Perkiraan harga', 'Status'], [
    ['Komputer/laptop server', '1', 'Intel i3/Ryzen 3 ke atas, RAM 8 GB, SSD 256 GB, Windows 10/11', 'Rp 5–8 jt', 'Wajib'],
    ['UPS', '1', '650–1000 VA (bertahan ± 10–20 menit)', 'Rp 0,7–1,5 jt', 'Sangat disarankan'],
    ['Printer struk thermal', '1 per kasir', '80 mm, USB', 'Rp 0,6–1,5 jt', 'Wajib'],
    ['Printer A4', '1', 'Inkjet/laser (invoice, surat jalan, laporan)', 'Rp 1,5–3 jt', 'Wajib bila ada pengantaran'],
    ['Hardisk eksternal / flashdisk', '2', '64 GB–1 TB (cadangan harian, bergantian)', 'Rp 0,2–1 jt', 'Wajib'],
    ['Router WiFi', '1', 'Dual band; bisa memakai yang ada', 'Rp 0,3–0,8 jt', 'Bila belum ada'],
    ['Tablet Android', '1–3', '10 inci, RAM 4 GB (staf penjualan, gudang)', 'Rp 2–4 jt / unit', 'Disarankan'],
    ['Scanner barcode', '1', 'USB', 'Rp 0,3–0,8 jt', 'Opsional'],
    ['Laci uang (cash drawer)', '1', 'Terhubung printer struk', 'Rp 0,5–1 jt', 'Opsional'],
    ['Internet', '—', 'Sudah ada; hanya untuk akses dari luar & cadangan cloud', 'Rp 0 tambahan', '—'],
], lebar=[3.6, 1.3, 5.6, 2.8, 3.3], ukuran=9.5)
p('**Perkiraan total pilihan A:** ± Rp 9–15 juta (sekali beli), **tanpa biaya bulanan**. Bisa lebih murah bila '
  'memakai komputer/printer yang sudah ada.')
d.add_heading('5.2 Pilihan B — server online', level=2)
tabel(['Kebutuhan', 'Perkiraan biaya', 'Keterangan'], [
    ['Sewa server (VPS) 2 CPU, 4 GB RAM', 'Rp 150–400 rb / bulan', 'Dibayar bulanan/tahunan'],
    ['Nama domain (mis. sumberurip.id)', 'Rp 150–300 rb / tahun', 'Alamat web toko'],
    ['Penyimpanan cadangan online', 'Rp 30–100 rb / bulan', 'Disarankan'],
    ['Internet toko yang stabil + cadangan (paket data)', 'Rp 100–200 rb / bulan tambahan', 'Wajib, karena tanpa internet tidak bisa transaksi'],
    ['Perangkat kasir/printer/tablet', 'Sama seperti tabel 5.1, **tanpa** komputer server & UPS server', '—'],
    ['Jasa pemasangan & perawatan server', 'Sesuai kesepakatan', 'Pembaruan, keamanan, pemantauan'],
], lebar=[6, 4.6, 6])
baru()

# ======================= 6. SDM =======================
d.add_heading('6. Kebutuhan orang (SDM) dan pembagian tugas', level=1)
tabel(['Peran', 'Siapa', 'Tanggung jawab dalam sistem', 'Waktu yang dibutuhkan'], [
    ['**Owner**', 'Pemilik', 'Keputusan, menyetujui void/retur besar, membaca laporan, mengatur akun, menyimpan sandi cadangan', '15–30 menit/hari'],
    ['**PIC Sistem**', '1 orang kepercayaan (mis. admin)', 'Penghubung dengan pengembang; memastikan cadangan, pembaruan, akun karyawan; melatih karyawan baru', '± 30 menit/hari (awal lebih)'],
    ['**Admin**', 'Staf administrasi', 'Data barang & harga, penerimaan barang, opname, pengiriman, cek transfer masuk', 'Sesuai jam kerja'],
    ['**Kasir**', '1–2 orang', 'Shift, pembayaran, struk, retur/void', 'Sesuai jam kerja'],
    ['**Staf penjualan**', 'Pramuniaga', 'Mencatat pesanan dengan tablet', 'Sesuai jam kerja'],
    ['**Gudang & sopir**', 'Tim gudang', 'Menyerahkan/memuat sesuai struk & surat jalan; melapor hasil kirim', 'Sesuai jam kerja'],
    ['**Pengembang**', 'Tim pembuat aplikasi', 'Pemasangan, pelatihan awal, perbaikan, pendampingan', 'Selama masa pendampingan'],
], lebar=[2.8, 3, 7.3, 3.5], ukuran=10)
p('**Tidak perlu menambah karyawan.** Pekerjaan pencatatan manual berkurang; waktunya dipakai untuk melayani pembeli '
  'dan merapikan gudang. Yang perlu ditunjuk hanya **1 PIC Sistem**.')
baru()

# ======================= 7. RENCANA =======================
d.add_heading('7. Rencana pelaksanaan', level=1)
gambar('d4-jadwal.png', 16.5)
tabel(['Tahap', 'Kegiatan', 'Hasil', 'Penanggung jawab'], [
    ['**0. Keputusan** (minggu 1)', 'Pilih lokal/online, perangkat, PIC, jadwal', 'Lembar keputusan ditandatangani', 'Owner'],
    ['**1. Persiapan** (minggu 1–2)', 'Beli/siapkan perangkat; pasang aplikasi; setup awal (data usaha, akun)', 'Aplikasi menyala di toko', 'PIC + pengembang'],
    ['**2. Data awal** (minggu 2–3)', 'Input barang, satuan, harga, pelanggan, pemasok, kendaraan; **hitung stok fisik** (opname) sebagai stok awal', 'Data master lengkap & benar', 'Admin + PIC'],
    ['**3. Pelatihan** (minggu 3–4)', 'Pelatihan per peran dengan data contoh (lihat Bab 9)', 'Karyawan lulus praktik', 'Pengembang + PIC'],
    ['**4. Uji coba paralel** (minggu 4–5)', 'Transaksi dicatat di buku **dan** aplikasi; dibandingkan tiap hari', 'Selisih = 0 selama ≥ 5 hari berturut', 'Semua'],
    ['**5. Mulai penuh** (minggu 6)', 'Buku manual berhenti; semua lewat aplikasi', 'Operasional penuh', 'Owner mengumumkan'],
    ['**6. Pendampingan** (minggu 6–8)', 'Evaluasi mingguan, perbaikan kecil, pelatihan ulang', 'Laporan evaluasi', 'PIC + pengembang'],
], lebar=[3.4, 6.4, 3.8, 3], ukuran=10)
kotak('Kunci keberhasilan tahap 2 (data awal)', [
    '•  Stok awal harus dari **hitungan fisik**, bukan perkiraan. Sebaiknya dihitung saat toko tutup (mis. Minggu).',
    '•  Nama barang dibuat **seragam** (merek + jenis + ukuran), mis. "Semen Gresik 40 kg".',
    '•  Harga jual dan harga modal diperiksa Owner sebelum mulai.',
])
baru()

# ======================= 8. OPERASIONAL =======================
d.add_heading('8. Perubahan cara kerja toko', level=1)
tabel(['Pekerjaan', 'Sebelum', 'Sesudah (dengan BonsaiUrip)'], [
    ['Melayani pembeli', 'Nota tulis tangan, hitung manual', 'Staf catat di tablet / kasir scan barang; total & struk otomatis'],
    ['Pembayaran transfer', 'Dicek kadang-kadang', 'Wajib pilih rekening + No. referensi; dicek masuk setiap hari'],
    ['Pengantaran', 'Catatan di kertas, sopir dari ingatan', 'Rit terjadwal, surat jalan tercetak, hasil kirim dicatat'],
    ['Barang datang', 'Dicatat di buku', 'Dicatat di Penerimaan Barang; stok & modal otomatis'],
    ['Stok', 'Dihitung saat perlu', 'Selalu terlihat; opname kecil tiap minggu, penuh tiap tahun'],
    ['Uang laci', 'Dihitung akhir hari', 'Buka shift (hitung modal) → tutup shift (hitung & cocokkan)'],
    ['Koreksi kesalahan', 'Coret/hapus', 'Void/retur/koreksi dengan alasan & persetujuan; tidak ada yang dihapus'],
    ['Laporan Owner', 'Direkap dari buku', 'Dibuka di HP/komputer kapan saja'],
], lebar=[3.4, 5.4, 7.8])
d.add_heading('Aturan baru yang wajib (ringkas dari Buku SOP)', level=2)
for t in [
    '**Satu orang satu akun.** Dilarang memakai akun orang lain.',
    '**Semua transaksi dicatat sebelum barang diserahkan.**',
    '**Uang tunai hanya diterima saat shift terbuka;** uang keluar-masuk laci lain dicatat sebagai kas.',
    '**Transfer/EDC/QRIS wajib No. referensi** dari bukti bayar.',
    '**Tidak ada menghapus/mengubah transaksi;** koreksi lewat void, retur, atau penyesuaian dengan alasan.',
    '**Shift ditutup setiap akhir hari** sebelum komputer dimatikan.',
    '**Opname kecil setiap minggu** untuk barang mahal/laris.',
]:
    poin(t)
gambar('09-shift.png', 14, 'Gambar 8. Shift & Clerical Check: buka shift, kas masuk/keluar, tutup shift.')
baru()

# ======================= 9. PELATIHAN =======================
d.add_heading('9. Pelatihan karyawan', level=1)
p('Prinsip: **belajar sambil praktik** dengan data contoh, **singkat per peran**, dan diulang sampai lancar.')
tabel(['Peserta', 'Materi', 'Durasi', 'Lulus bila'], [
    ['Semua', 'Masuk/keluar, menu, cari (Ctrl+K), notifikasi, tur aplikasi, aturan baru', '1 jam', 'Bisa masuk & menjelaskan aturan baru'],
    ['Kasir', 'Buka shift, jual (F2/Enter), bayar tunai/non-tunai, struk, retur/void, tutup shift', '2 × 2 jam', '10 transaksi praktik tanpa salah; tutup shift selisih 0'],
    ['Staf penjualan', 'Order cepat di tablet, pelanggan, cek stok & harga, order disimpan', '1,5 jam', '5 order praktik benar'],
    ['Admin', 'Barang & harga, penerimaan, opname, pengiriman & rit, cek transfer, laporan', '2 × 2 jam', 'Praktik satu siklus beli–jual–kirim'],
    ['Owner', 'Dashboard, laporan, persetujuan, akun karyawan, cadangan, HP', '1,5 jam', 'Bisa membaca laporan & menyetujui dari HP'],
    ['PIC Sistem', 'Semua di atas + cadangan, pemulihan, pembaruan, pindah komputer', '3 jam', 'Bisa melatih karyawan baru'],
], lebar=[2.6, 7.6, 2, 4.4], ukuran=10)
d.add_heading('Bahan belajar yang sudah tersedia', level=2)
for t in ['**Tur di dalam aplikasi** per halaman (bisa diulang kapan saja).',
          '**Buku SOP** (prosedur baku per peran) dan **Buku Panduan** (cara memakai tiap layar) untuk dicetak.',
          '**Panduan mulai pakai** di menu Start komputer.',
          '**Data contoh** untuk latihan tanpa mengganggu data asli.',
          'Karyawan baru: dilatih PIC dengan daftar periksa yang sama.']:
    poin(t)
gambar('13-tur.png', 13, 'Gambar 9. Halaman Tur & panduan.')
baru()

# ======================= 10. KONTROL =======================
d.add_heading('10. Pengawasan (kontrol) dan budaya kerja baru', level=1)
gambar('d5-kontrol.png', 16.5)
d.add_heading('Angka yang dipantau Owner', level=2)
tabel(['Ukuran', 'Target', 'Dilihat di'], [
    ['Selisih uang saat tutup shift', '≤ Rp 1.000 (toleransi bisa diatur)', 'Shift & Clerical Check'],
    ['Transfer yang tidak masuk rekening', '0', 'Notifikasi, Shift › Non-tunai'],
    ['Selisih stok saat opname', 'Turun dari bulan ke bulan', 'Laporan penyesuaian'],
    ['Jumlah void/retur per kasir', 'Wajar & beralasan', 'Laporan retur/void, log'],
    ['Piutang terlambat', 'Turun', 'Piutang, notifikasi'],
    ['Cadangan data', 'Berhasil setiap hari', 'Pengaturan › Cadangan'],
], lebar=[6, 5, 5.6])
d.add_heading('Membangun budaya', level=2)
for t in ['**Owner memberi contoh:** keputusan memakai angka dari aplikasi, bukan perkiraan.',
          '**Rapat singkat mingguan (15 menit):** bahas selisih, kendala, ide perbaikan.',
          '**Penghargaan:** kasir/admin dengan selisih 0 sebulan penuh.',
          '**Konsekuensi jelas:** memakai akun orang lain atau tidak mencatat transaksi adalah pelanggaran.',
          '**Kesalahan jujur dilaporkan, bukan disembunyikan:** aplikasi menyediakan jalan koreksi yang rapi.']:
    poin(t)
baru()

# ======================= 11. MANAJEMEN PERUBAHAN =======================
d.add_heading('11. Manajemen perubahan', level=1)
p('Mengganti kebiasaan lama butuh waktu. Hambatan yang biasa muncul dan cara mengatasinya:')
tabel(['Hambatan', 'Cara mengatasi'], [
    ['"Lebih cepat pakai buku"', 'Uji coba paralel menunjukkan hasilnya; kasir dengan keyboard justru lebih cepat setelah 1–2 minggu.'],
    ['Takut salah / gaptek', 'Latihan dengan data contoh; tur di aplikasi; PIC siap membantu; kesalahan bisa dikoreksi.'],
    ['Merasa diawasi', 'Jelaskan tujuannya: melindungi karyawan dari tuduhan selisih, karena semua tercatat jelas.'],
    ['Lupa mencatat saat ramai', 'Aturan "catat dulu baru serahkan"; pesanan staf langsung masuk antrean kasir.'],
    ['Kembali ke cara lama', 'Owner hanya menerima laporan dari aplikasi; buku manual dihentikan setelah tahap 5.'],
], lebar=[4.6, 12])
d.add_heading('Risiko dan jalan keluarnya', level=2)
tabel(['Risiko', 'Pencegahan', 'Bila terjadi'], [
    ['Listrik mati', 'UPS; aplikasi menyala otomatis', 'Ringkasan shift & langkah pemeriksaan tampil otomatis'],
    ['Komputer rusak/hilang', 'Cadangan harian ke disk terpisah', 'Pasang di komputer baru, pakai data cadangan'],
    ['Internet putus', 'Pilihan A tidak bergantung internet', 'Toko tetap jalan; akses Owner dari luar menunggu'],
    ['Salah input', 'Pengecekan qty tidak biasa, persetujuan atasan', 'Void/retur/koreksi dengan jejak'],
    ['Karyawan keluar', 'Akun pribadi', 'Nonaktifkan akun hari itu juga'],
    ['Password/sandi hilang', 'Kode pemulihan & sandi cadangan dicatat di kertas', 'Pemulihan akses Owner di komputer toko'],
    ['Penyalahgunaan', 'Hak akses, log aktivitas', 'Telusuri log; tindak sesuai aturan'],
], lebar=[3.6, 6.2, 6.8])
baru()

# ======================= 12. KEAMANAN =======================
d.add_heading('12. Keamanan dan cadangan data', level=1)
for t in ['Password tersimpan teracak (tidak bisa dibaca siapa pun, termasuk pengembang).',
          'Data **milik toko** dan tersimpan di komputer toko (pilihan A).',
          '**Cadangan otomatis setiap hari**, terenkripsi sandi, ke flashdisk/hardisk terpisah; diuji pulih sebulan sekali.',
          'Akses dari HP lewat jalur terenkripsi (Tailscale); hanya perangkat yang didaftarkan Owner.',
          '**Kode pemulihan** dan **sandi cadangan** disimpan Owner di tempat aman (tidak bisa diminta ulang).',
          'Setiap perubahan tercatat di log aktivitas.']:
    poin(t)
gambar('10-cadangan.png', 14, 'Gambar 10. Pengaturan › Cadangan.')
baru()

# ======================= 13. KEPUTUSAN =======================
d.add_heading('13. Keputusan yang diminta dari Owner', level=1)
tabel(['No', 'Keputusan', 'Pilihan', 'Dipilih Owner'], [
    ['1', 'Tempat aplikasi berjalan', '☐ A. Server di toko (disarankan)   ☐ B. Server online', ''],
    ['2', 'Komputer server', '☐ Pakai yang ada   ☐ Beli baru', ''],
    ['3', 'Perangkat kasir & printer', '☐ Printer struk ☐ Printer A4 ☐ Scanner ☐ Laci uang', ''],
    ['4', 'Tablet untuk staf/gudang', '☐ 0  ☐ 1  ☐ 2  ☐ 3 unit', ''],
    ['5', 'PIC Sistem', 'Nama: ____________________', ''],
    ['6', 'Tanggal mulai persiapan', '____ / ____ / 20__', ''],
    ['7', 'Tanggal mulai penuh (go-live)', '____ / ____ / 20__', ''],
    ['8', 'Hari hitung stok awal (opname)', '____ / ____ / 20__', ''],
], lebar=[1, 4.4, 8, 3.2])
p('')
tabel(['Disetujui oleh', 'Disusun oleh'], [['\n\n\n\n( Owner UD. Sumber Urip )\nTanggal: ____________', '\n\n\n\n( ______________________ )\nTanggal: ____________']], lebar=[8.3, 8.3], warna_kepala='36261C')

# ======================= LAMPIRAN =======================
baru()
d.add_heading('Lampiran A. Daftar istilah sederhana', level=1)
tabel(['Istilah', 'Artinya'], [
    ['Server', 'Komputer "rumah" aplikasi tempat data disimpan'],
    ['Lokal', 'Server berada di toko sendiri'],
    ['Hosting / VPS', 'Server sewaan di internet, dibayar bulanan'],
    ['Shift', 'Masa kerja kasir dari buka sampai tutup kas'],
    ['Clerical check', 'Pencocokan uang laci dengan catatan aplikasi'],
    ['Void', 'Membatalkan transaksi'],
    ['Retur', 'Barang dikembalikan pembeli / ke pemasok'],
    ['Opname', 'Menghitung stok fisik di gudang lalu dicocokkan'],
    ['HPP / harga modal', 'Rata-rata harga beli barang'],
    ['Rit', 'Satu perjalanan pengantaran (kendaraan + sopir)'],
    ['Surat jalan', 'Dokumen pengiriman barang'],
    ['Piutang / hutang', 'Uang yang belum dibayar pelanggan / yang belum dibayar ke pemasok'],
    ['Cadangan (backup)', 'Salinan data untuk berjaga bila komputer rusak'],
    ['Tailscale', 'Aplikasi gratis untuk menyambungkan HP ke komputer toko dengan aman'],
    ['PIC', 'Orang yang ditunjuk sebagai penanggung jawab'],
], lebar=[4.4, 12.2])
d.add_heading('Lampiran B. Contoh tampilan lain', level=1)
gambar('03-barang.png', 12.5, 'Data Barang.')
gambar('05-order.png', 12.5, 'Order Penjualan (staf).')
gambar('12-pelanggan.png', 12.5, 'Data Pelanggan.')
gambar('01-setup.png', 12.5, 'Setup awal saat aplikasi pertama dipasang.')

import os
os.makedirs(os.path.dirname(OUT), exist_ok=True)
d.save(OUT)
print('ok', OUT)
