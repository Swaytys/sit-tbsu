# Keputusan Fondasi — 18–19 September 2026

Peserta: pemilik proyek (owner, penentu ruang lingkup) dan arsitek (Claude, penentu teknis).
Berkas ini append-only. Keputusan yang berubah ditulis sebagai entri baru yang merujuk nomor lama.

Format: **Keputusan** · **Alasan** · **Ditolak** (alternatif yang tidak dipilih).

---

### K-001 — Bentuk aplikasi: web
**Keputusan:** Aplikasi web di browser, satu server, satu database. Bukan `.exe`.
**Alasan:** Dipakai bersamaan oleh beberapa orang di perangkat berbeda; `.exe` tetap butuh server database dan
update harus dipasang di tiap PC.
**Ditolak:** Electron/Tauri, aplikasi desktop native.

### K-002 — Stack
**Keputusan:** TypeScript strict; React + Vite + Tailwind + shadcn/ui + React Router; React Hook Form + Zod;
TanStack Query; Hono; Drizzle; PostgreSQL; argon2id; decimal.js; pino; Vitest; Playwright; pnpm monorepo.
**Alasan:** Satu bahasa, tipe data mengalir backend → frontend, sama dengan stack mockup Figma Make, semua gratis
dan open source, arsitek menguasainya.
**Ditolak:** Next.js, FastAPI/Django, Laravel, Express, Prisma. Alasan di docs/02 §2.

### K-003 — Database PostgreSQL, DDL v3 sebagai migrasi awal
**Keputusan:** PostgreSQL (kampus tidak mewajibkan Oracle). `docs/03-skema-database-v3.sql` menjadi migrasi
`0000`; skema Drizzle dibuat agar identik dan diverifikasi.
**Alasan:** Gratis, standar, CHECK/FK dari skema laporan terpakai utuh; Drizzle tidak mendukung Oracle.

### K-004 — Alat kerja: chat arsitek + Claude Code di VS Code
**Keputusan:** Chat Project Claude.ai untuk keputusan, spesifikasi, review. Claude Code (ekstensi VS Code) untuk
menulis, menjalankan, dan menguji kode. Jembatan = `CLAUDE.md` + `docs/` di repo. Mode auto-accept tidak dipakai.
**Alasan:** Cowork adalah alat kerja dokumen, bukan alat coding. Sesi Claude Code tidak membaca project knowledge
Claude.ai, jadi sumber kebenaran harus ada di repo.
**Ditolak:** Cowork; dua chat paralel tanpa dokumen di repo.

### K-005 — Penamaan berkas
**Keputusan:** Berkas tooling memakai nama baku (`CLAUDE.md`, `package.json`, komponen). Dokumen hidup diberi
nomor urut (`01-…`). Hanya log keputusan dan catatan yang bertanggal `YYYY-MM-DD-topik.md`.
**Alasan:** Tooling mewajibkan nama tertentu; tanggal di nama dokumen hidup menyesatkan setelah isinya berubah.

### K-006 — Stok tiga angka; order = reservasi
**Keputusan:** `stok_fisik`, `stok_dipesan`, `stok_tersedia = fisik − dipesan`. Order MENUNGGU/DIPROSES menambah
dipesan; checkout memotong fisik dan melepas dipesan dalam satu transaksi; batal melepas dipesan. Order DRAFT tidak
menahan stok.
**Alasan:** System flow laporan membuat order dan penjualan sama-sama "memperbarui persediaan" (potong dua kali).
Pemilik ingin barang yang sudah dipesan tidak disambar penjualan langsung; reservasi memenuhi itu tanpa bug.

### K-007 — Order basi
**Keputusan:** Order MENUNGGU lebih tua dari `konfigurasi.batas_umur_order_jam` (default 24) ditandai basi, masuk
notifikasi dan daftar stok tertahan per barang. Auto-batal opsional (`konfigurasi.auto_batal_order_basi`, default
mati).
**Alasan:** Permintaan pemilik: order yang lupa dibatalkan jangan diam-diam menahan stok.

### K-008 — HPP rata-rata tertimbang
**Keputusan:** HPP per barang = rata-rata tertimbang bergerak, diperbarui setiap penerimaan pembelian. Setiap baris
penjualan menyimpan snapshot `hpp_saat_transaksi`. Nilai persediaan dan gross profit memakai HPP ini.
**Alasan:** Rancangan laporan menyebut FIFO sekaligus "harga beli terakhir" (kontradiksi); FIFO butuh lapisan biaya
yang tidak ada di skema. Rata-rata tertimbang sederhana, umum di POS ritel, dan konsisten.
**Ditolak:** FIFO, harga beli terakhir sebagai HPP.

### K-009 — Dasar markup: harga beli terakhir
**Keputusan:** Harga jual dari markup dihitung atas `harga_beli_terakhir` (default). Bisa diganti ke HPP rata-rata
di `konfigurasi.dasar_markup`.
**Alasan:** HPP rata-rata lambat mengikuti kenaikan harga beli; toko menetapkan harga jual dari harga beli terbaru.

### K-010 — Harga jual disimpan, bukan dihitung ulang otomatis
**Keputusan:** Harga jual per tier disimpan. Bila dasar markup berubah, barang ditandai `perlu_tinjau_harga`;
halaman Tinjau Harga menampilkan usulan (markup + pembulatan ke atas kelipatan `konfigurasi.pembulatan_harga`,
default Rp 100) dan Admin menerapkannya, satu per satu atau massal. Per barang boleh diset `harga_otomatis=true`
agar langsung berubah.
**Alasan:** Harga yang berubah diam-diam tiap barang masuk menghasilkan angka aneh dan harga tidak konsisten ke
pelanggan; sulit diaudit.
**Ditolak:** Harga dinamis murni `HPP × (1+markup)` saat transaksi.

### K-011 — Tier harga
**Keputusan:** Master `tingkat_harga` bebas didefinisikan (seed: Normal, Grosir, Distributor), tiap tier punya
markup default dan opsional `saran_min_qty`. Per barang boleh override per tier: markup % sendiri atau harga tetap.
Saat order/checkout, tiap baris punya dropdown tier; default = tier pelanggan, bila tidak ada = tier bertanda
default (Normal). Sistem menyorot tier yang `saran_min_qty`-nya terpenuhi, tidak memaksa. Harga manual di luar
tier hanya Admin/Owner dan tercatat.
**Alasan:** Laporan KP menuntut 3 tingkat harga; pemilik ingin markup per barang dan pilihan tier per baris saat
checkout.

### K-012 — Diskon dan promo
**Keputusan:** Diskon manual per baris (Rp atau %) dan per transaksi, dibatasi `konfigurasi.batas_diskon_<peran>`
(default Kasir 0 %, Admin/Owner tanpa batas). Promo: nama, periode, jenis potongan (%/Rp), sasaran (semua /
kategori / barang), syarat (min qty / min belanja), aktif. Diterapkan otomatis, satu promo per baris, tercatat
terpisah dari diskon manual, tercetak di struk. Tidak dibuat: beli X gratis Y, kupon, poin loyalitas.
**Alasan:** Permintaan pemilik; dibatasi agar tidak jadi mesin promo yang rumit.

### K-013 — Tipe uang dan kuantitas
**Keputusan:** Uang = `bigint` rupiah utuh (TS `number` safe integer). Kuantitas = `numeric(14,3)` (TS lewat
decimal.js). Tidak ada float.
**Alasan:** Toko menjual pecahan (0,5 m³ pasir, kabel per meter). Rupiah tidak punya sen dalam praktik. Float
menghasilkan selisih sen yang merusak rekonsiliasi kas.
**Ditolak:** `numeric(19,2)` untuk uang (menyisakan sen yang tidak pernah dipakai), qty integer.

### K-014 — Satuan, atribut, multi-satuan jual
**Keputusan:** Master `satuan` dengan `jenis_dimensi` (PANJANG, LUAS, VOLUME, BERAT, JUMLAH, DAYA, LAINNYA) dan
`faktor_ke_basis`; konversi hanya sesama dimensi. Atribut barang sebagai baris `barang_atribut` (jenis atribut +
nilai + satuan), master `jenis_atribut` bisa ditambah Admin. Multi-satuan jual (`barang_satuan_jual`, faktor ke
satuan dasar); stok selalu dalam satuan dasar; harga per satuan jual default = harga dasar × faktor, bisa override.
**Alasan:** Permintaan pemilik: keleluasaan memilih cm/m/dm dan dimensi lain; kabel dijual per meter atau per roll.
**Ditolak:** Kolom teks tetap `UKURAN`, `PANJANG`, `BERAT` seperti skema FINAL2.

### K-015 — Retur
**Keputusan:** Penyelesaian: REFUND, TUKAR_BARANG, POTONG_TAGIHAN. Kondisi per baris: BAIK / RUSAK / CACAT.
Kasir mengajukan, Admin/Owner menyetujui (lihat K-017). Saat disetujui: hanya BAIK masuk stok jual (RUSAK/CACAT
ke bucket rusak, K-030); barang pengganti pada TUKAR_BARANG = mutasi keluar; refund tunai = kas keluar shift;
POTONG_TAGIHAN mengurangi sisa piutang. Transaksi asal tidak diubah.
**Alasan:** Laporan retur memuat 3 penyelesaian sedangkan skema hanya 2; UI retur menulis stok bertambah walau
barang rusak; BPMN lama menunjukkan owner yang memutuskan retur.

### K-016 — Void
**Keputusan:** Status MENUNGGU / DISETUJUI / DITOLAK, semua tercatat. Lingkup TRANSAKSI atau ITEM (tabel detail).
Hanya untuk penjualan pada shift yang belum ditutup, tanpa surat jalan DIKIRIM/SELESAI, tanpa retur. Disetujui →
stok kembali lewat ledger, pembayaran dikembalikan (tunai = kas keluar shift), status VOID. Order tidak di-void,
cukup BATAL.
**Alasan:** Skema lama hanya mencatat void yang disetujui; mockup memakai dropdown "diotorisasi oleh" (kasir bisa
memilih nama owner sendiri).

### K-017 — Persetujuan dari akun sendiri; pengaju Admin/Owner otomatis disetujui
**Keputusan:** Penyetuju harus login dengan akunnya (bukan dropdown, bukan PIN). Bila pengaju sendiri punya izin
`*.setujui`, dokumen langsung DISETUJUI dan tercatat pengaju = penyetuju. Kolom PIN tidak dibuat di M1.
**Alasan:** Praktis untuk toko kecil yang owner-nya juga admin. Risiko: tidak ada pemisahan tugas untuk Admin;
diterima secara sadar, dipantau lewat log.
**Ditolak:** PIN supervisor di layar kasir (rawan bocor), pemisahan tugas ketat.

### K-018 — Shift kasir dan clerical check dengan blind count
**Keputusan:** Tabel `shift_kasir` (buka: modal awal; tutup) dan `kas_shift` (kas masuk/keluar non-penjualan:
kasbon, setor, refund, lainnya). Semua pembayaran tunai terikat shift. Clerical: kasir menginput uang fisik sebelum
angka sistem tampil; sistem menghitung selisih; selisih ≠ 0 wajib keterangan. 1 shift = 1 clerical.
**Alasan:** Skema lama tidak punya modal awal, shift, maupun tempat untuk kasbon/refund; total sistem tampil
sebelum kasir menghitung.

### K-019 — Hak akses berbasis izin; patokan Use Case Diagram
**Keputusan:** Peran = kumpulan izin (`roles.ts`). Konflik antar-sumber diselesaikan: Laporan untuk Kasir =
penjualan tanpa HPP/laba; Data Pemasok = Admin/Owner; Kelola pengguna = Owner saja. Tidak ada editor peran di M1.
**Alasan:** Tiga sumber (Tabel 5.3, Tabel 5.4, Use Case, menu mockup) saling bertentangan; Use Case Diagram adalah
model yang paling konsisten dan menjadi Gambar 5.4 laporan.

### K-020 — Data sensitif disaring di API
**Keputusan:** Harga modal, HPP, laba, harga titip hanya dikirim bila pemanggil punya izin terkait. Bukan hanya
disembunyikan di UI.

### K-021 — Transaksi append-only; master nonaktif; demo hanya dev
**Keputusan:** Tabel transaksi tidak di-UPDATE/DELETE selain kolom status dan cache terdefinisi; koreksi lewat
dokumen baru. Master dinonaktifkan, tidak dihapus. Tombol "masuk cepat per peran" hanya `NODE_ENV=development`.
**Alasan:** System flow persediaan "memperbarui data penerimaan" dan tombol hapus di mockup akan memutus jejak audit;
tombol demo di produksi = siapa pun masuk sebagai Owner.

### K-022 — Penomoran dokumen
**Keputusan:** Format `PREFIX-YYMMDD-NNN`, nomor urut reset harian, tiga digit (otomatis melebar jika lebih dari
999/hari). Prefix default: ORD order, STR struk langsung, INV invoice pengantaran, SJ surat jalan, BYR pembayaran,
RTR retur, VD void, RCV penerimaan, ADJ penyesuaian, RTP retur pemasok, KSG penyelesaian konsinyasi, SHF shift,
CLC clerical. Prefix bisa diubah di pengaturan; perubahan tidak berlaku surut. Penerbitan lewat tabel
`penghitung_nomor` dengan FOR UPDATE.
**Alasan:** Mockup dan laporan memakai 4 format berbeda. Format ini sudah dipakai mockup (ORD/DO/RCV), pendek,
terurut, dan membedakan struk (STR) dari invoice (INV) sesuai laporan.

### K-023 — Status stok
**Keputusan:** HABIS (0), KRITIS (< minimum), PERLU_RESTOCK (minimum ≤ stok ≤ minimum × (1 + ambang), ambang
default 20 % di konfigurasi), AMAN (di atas itu). Dihitung dari stok fisik.
**Alasan:** Mockup memakai 3 nama berbeda untuk level tengah dan contoh datanya tidak konsisten.

### K-024 — Surat jalan
**Keputusan:** Satu invoice boleh punya banyak surat jalan (pengiriman sebagian); `surat_jalan_detail` mencatat qty
kirim per baris invoice; kolom sopir, kendaraan, waktu tiap status (DIPROSES, DIMUAT, DIKIRIM, SELESAI); status
pengiriman invoice = agregat. Stok dipotong saat checkout, bukan saat kirim.
**Alasan:** Order proyek besar sering dikirim bertahap; skema lama membatasi satu surat jalan per penjualan.

### K-025 — Pembayaran
**Keputusan:** Metode: TUNAI, TRANSFER, EDC. "COD" bukan metode melainkan `bayar_saat_terima=true` pada invoice;
uangnya tetap TUNAI/TRANSFER saat diterima. Jenis: PENUH, DP, PELUNASAN. Kolom rekening tujuan dan nomor referensi.
Beberapa pembayaran per transaksi (bayar campuran). Pembayaran tunai terikat shift.
**Alasan:** Skema lama menjadikan COD metode bayar, padahal COD hanya menentukan kapan, bukan dengan apa.

### K-026 — Status pengambilan penjualan langsung
**Keputusan:** `status_pengambilan` DIAMBIL / BELUM_DIAMBIL. Stok terpotong saat bayar. Lembar opname menampilkan
"terjual belum diambil" sebagai surplus fisik yang diharapkan.
**Alasan:** Observasi: pembeli bisa bayar dulu dan mengambil barang kemudian.

### K-027 — Piutang
**Keputusan:** Penjualan belum lunas = piutang dengan `tanggal_jatuh_tempo` (default hari ini + `term_hari`
pelanggan). Pelanggan punya `term_hari` dan `limit_kredit` (nullable). Enforcement limit dan umur piutang di M2
(Fase 10); daftar piutang, jatuh tempo, pelunasan di M1 (Fase 5).

### K-028 — Hutang pemasok dan retur pemasok (M2)
**Keputusan:** Penerimaan PEMBELIAN dengan syarat TEMPO membentuk hutang (`total_faktur`, `sisa_hutang` cache,
jatuh tempo) sejak M1; pembayaran ke pemasok (`pembayaran_pemasok`) dan halaman hutang di Fase 10. Retur ke pemasok
= dokumen `RTP`, mengurangi stok (baik atau rusak) dan sisa hutang bila belum dibayar.
**Alasan:** Observasi: pembelian tempo 1–6 bulan lazim; retur ke pemasok terjadi.

### K-029 — Konsinyasi
**Keputusan:** Kepemilikan di level barang: MILIK_SENDIRI atau KONSINYASI (+ `id_pemasok_konsinyasi`,
`harga_titip`). Penerimaan jenis KONSINYASI: stok masuk, HPP = harga titip, tidak membentuk hutang, tidak mengubah
HPP barang milik sendiri. Nilai persediaan memisahkan milik toko dan titipan. Penyelesaian konsinyasi (`KSG`) per
pemasok per periode = Σ qty terjual × harga titip → hutang → dibayar. Tidak laku → retur pemasok. Kepemilikan dan
penerimaan konsinyasi masuk M1 (Fase 3–4); penyelesaian di Fase 11. Barang tidak boleh berganti kepemilikan selama
stok > 0.
**Alasan:** Pemilik: konsinyasi sering. Kalau penandaan ditunda, laporan nilai persediaan dan gross profit salah
sejak awal.

### K-030 — Stok rusak (bucket) dan kondisi di ledger
**Keputusan:** Ledger punya kolom `kondisi` (BAIK/RUSAK) sejak migrasi awal; `persediaan` punya `stok_rusak`.
M1 hanya memakai BAIK (penyesuaian RUSAK = keluar dari BAIK). Fase 10 mengaktifkan bucket RUSAK: retur kondisi
RUSAK/CACAT masuk bucket rusak, retur pemasok dan pemusnahan mengurangi bucket rusak. Bucket rusak tidak masuk
stok tersedia maupun nilai persediaan.
**Alasan:** Catatan observasi meminta pencatatan barang rusak tersendiri; barang rusak menumpuk menunggu klaim
pemasok.

### K-031 — Milestone M1/M2 dan urutan fase
**Keputusan:** M1 Fase 1–8 (ruang lingkup KP + integritas + basic murah), M2 Fase 9–12 (harga & promo; hutang,
retur pemasok, stok rusak; konsinyasi; multi-satuan & label). Skema memuat keduanya sejak awal. Persediaan
dibangun sebelum penjualan.
**Alasan:** Menjaga prototipe KP tercapai lebih dulu, tanpa rework saat M2.

### K-032 — Laporan KP di atas mockup
**Keputusan:** Bila mockup dan laporan berbeda pada struktur/logika, ikuti laporan. Mockup = referensi tampilan.
**Alasan:** Mockup dibuat cepat oleh AI dari sebagian snapshot laporan; ada fitur yang hilang atau ditambah.

### K-033 — Total laporan seluruh periode
**Keputusan:** Baris total menghitung seluruh data periode, bukan halaman tabel yang sedang tampil.

### K-034 — Konvensi penamaan
**Keputusan:** DB `snake_case` huruf kecil (`penjualan_detail`, `id_barang`), nama istilah mengikuti laporan.
Istilah domain di kode Bahasa Indonesia, teknis Inggris. Kode master 5 digit (`BRG-00001`, `PLG-00001`,
`PMS-00001`, `USR-00001`). Tanggal tampil `dd/mm/yyyy`, uang `Rp 1.234.567`.
**Alasan:** Konvensi PostgreSQL; laporan dan UI berbahasa Indonesia; 5 digit cukup untuk puluhan ribu barang.

### K-035 — PostgreSQL lokal lewat installer resmi
**Keputusan:** Dev di Windows 11 memakai installer PostgreSQL + pgAdmin. `docker-compose.yml` disediakan sebagai
opsi, bukan prasyarat.
**Alasan:** Docker Desktop di Windows butuh WSL2 dan virtualisasi; sumber masalah setup paling sering.

### K-036 — Kategori sebagai tabel; barcode opsional
**Keputusan:** `kategori` tabel sendiri (bukan teks bebas). `barang.barcode` nullable unik.

### K-037 — Log aktivitas dan sesi login sebagai tabel
**Keputusan:** `log_aktivitas` dan `sesi_login` di database, append-only, hanya Owner melihat log.
**Alasan:** Kebutuhan nonfungsional laporan (pencatatan aktivitas, session timeout) tanpa tabelnya.

### K-038 — Yang sengaja tidak dibuat
**Keputusan:** PPN; PO/pembelian penuh; multi-gudang; batch & kadaluarsa; komisi sales; akuntansi penuh; nomor
seri; kupon/loyalitas; WhatsApp; offline; mobile native; editor peran.
**Alasan:** Di luar ruang lingkup laporan dan bukan fitur yang diminta pemilik; sebagian mahal (lot tracking).

### K-039 — Dashboard per peran; backup harian; deploy diputuskan Fase 8
**Keputusan:** Staf tidak melihat omzet. Backup `pg_dump` harian + uji restore. Pilihan mini-PC toko vs VPS
diputuskan pada Fase 8 dengan kriteria kebutuhan akses luar dan stabilitas internet.

### K-040 — Import Excel
**Keputusan:** Import master barang (Fase 3) dan saldo awal stok (Fase 4, menghasilkan dokumen SALDO_AWAL)
dengan templat unduh dan pratinjau validasi.
**Alasan:** Go-live tanpa import berarti mengetik ratusan hingga ribuan barang manual.

### K-041 — Nama
**Keputusan:** Repo `sit-tbsu`. Nama tampil "SIT Sumber Urip". Cookie sesi `sit_sesi`. Prefix API `/api`.

### K-042 — Waktu
**Keputusan:** `timestamptz` UTC di DB; server `TZ=UTC`; tampilan `Asia/Jakarta`; `tanggal_operasional` bertipe
`date` lokal Jakarta.

### K-043 — Bahasa dan format UI
**Keputusan:** Semua label, status, pesan Bahasa Indonesia. Desktop-first 1280 px, tablet 1024 px masih bisa.
Layar kasir dapat dioperasikan dengan keyboard (F2, Enter, F9).
