# Pintasan pemilik (K-210)

Berkas `.cmd` di folder ini dijalankan dengan **klik dua kali** dari File Explorer. Tujuannya: pekerjaan berulang
(membuat Setup, menguji, menyalakan versi pengembangan) bisa dijalankan pemilik sendiri tanpa meminta pengembang,
sehingga percakapan dengan pengembang dipakai untuk hal yang memang butuh pemikiran.

| Berkas             | Gunanya                                                                            | Lama        | Hasil                                                                     |
| ------------------ | ---------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------- |
| `Buat-Setup.cmd`   | Membuat Setup .exe dari kode terbaru di folder ini (termasuk yang belum di-commit) | 5–10 menit  | `installer\keluaran\Setup-BonsaiUrip-<versi>.exe`, folder terbuka sendiri |
| `Uji-Penuh.cmd`    | Typecheck + lint + seluruh tes otomatis                                            | 10–15 menit | Tulisan LULUS atau GAGAL                                                  |
| `Nyalakan-Dev.cmd` | Pasang dependency, perbarui database, nyalakan versi pengembangan                  | 1–2 menit   | Peramban membuka `http://localhost:5173`                                  |

Catatan lengkap tiap pintasan ditulis ke `pintasan\log\` (tidak ikut git). Bila gagal, cukup kirim ke pengembang
kalimat seperti _"Buat-Setup gagal, lihat pintasan\log\buat-setup.txt"_: pengembang membaca bagian akhirnya saja.

## Aturan

- Jalankan **satu pintasan dalam satu waktu** (memori laptop 7,7 GB).
- `Buat-Setup` tidak mengubah BonsaiUrip yang sudah terpasang; Setup barunya baru terpasang saat Anda menjalankannya.
- Prasyarat di laptop pengembangan (sudah ada di laptop ini): Node 24, pnpm, PostgreSQL 17 di `D:\PostgreSQL`,
  Inno Setup 6, internet sekali untuk mengunduh program cadangan (disimpan di `installer\alat-cache`).
- Bila pengembang menambah bagian baru yang harus ikut paket (mis. program bantu baru), pengembang memperbarui
  `installer\buat-installer.ps1`; pintasan ini tidak perlu diubah.

## Cara lain membantu menghemat percakapan

- Kirim hasil uji dengan nomor baris uji (U1…) dan tangkapan layar, sekaligus dalam satu pesan.
- Setelah pengembang selesai, jalankan `Uji-Penuh` dan `Buat-Setup` sendiri; laporkan hanya bila gagal.
- Simpan pertanyaan konsep untuk satu pesan; pengembang menjawab sekaligus.
