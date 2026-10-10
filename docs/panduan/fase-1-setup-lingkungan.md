# Panduan Fase 1 — Setup Lingkungan (Windows 11, semua di drive D)

Waktu: sekitar 1–1,5 jam, termasuk unduhan. Kerjakan berurutan; tiap langkah punya cara memeriksa hasilnya.
Ruang di C hanya terpakai untuk Node.js (± 100 MB) dan beberapa berkas kecil; semua yang besar (paket, database,
repo, cache) di D.

Yang dianggap sudah ada: Git for Windows, VS Code, ekstensi Claude Code (sudah login ke akun Claude), folder
`D:\sit-tbsu` berisi `CLAUDE.md` dan `docs\` dari Batch 1–3.

Semua perintah dijalankan di **PowerShell** (Start → ketik "PowerShell" → buka). Tanda `PS>` tidak ikut diketik.

---

## Langkah 0 — Siapkan folder cache di D dan periksa yang sudah ada

```powershell
PS> mkdir D:\dev-cache
PS> git --version
PS> code --version
```

Kedua perintah terakhir harus mencetak nomor versi. Kalau `code` tidak dikenal: buka VS Code → `Ctrl+Shift+P` →
ketik "Shell Command: Install 'code' command" (di Windows biasanya sudah ada; kalau tidak ada, lewati, tidak wajib).

## Langkah 1 — Node.js 24 LTS (ke D)

1. Buka https://nodejs.org → unduh **Node.js 24 LTS** untuk Windows (x64, `.msi`). Jangan versi "Current".
2. Jalankan installer. Di layar **Custom Setup**, ubah lokasi ke `D:\nodejs\`. Biarkan komponen default.
3. Di layar **Tools for Native Modules**, **jangan** centang "Automatically install the necessary tools" (itu
   memasang Python dan Visual Studio Build Tools berukuran gigabyte ke C; tidak dibutuhkan proyek ini).
4. Selesai → tutup semua jendela PowerShell yang terbuka, buka PowerShell baru, lalu:

```powershell
PS> node -v
PS> npm -v
```

Harus muncul `v24.x.x` dan versi npm. Kalau "node is not recognized": restart PowerShell; kalau masih, restart
laptop (PATH baru dibaca setelah proses dibuka ulang).

5. Pindahkan cache npm ke D:

```powershell
PS> npm config set cache D:\dev-cache\npm --global
```

## Langkah 2 — pnpm (manajer paket)

```powershell
PS> Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
PS> npm install -g pnpm
PS> pnpm -v
PS> pnpm config set store-dir D:\dev-cache\pnpm-store
PS> pnpm config get store-dir
```

Baris pertama mengizinkan PowerShell menjalankan skrip `pnpm.ps1` (tanpanya muncul error "running scripts is
disabled"). Jawab `Y` bila ditanya. `pnpm -v` harus mencetak versi 10.x. Baris terakhir harus mencetak
`D:\dev-cache\pnpm-store`; di sinilah semua paket disimpan (bisa ratusan MB).

## Langkah 3 — PostgreSQL 17 (ke D)

1. Buka https://www.postgresql.org/download/windows/ → "Download the installer" (EDB) → pilih **17.x**, Windows x86-64.
2. Jalankan installer:
   - **Installation Directory**: `D:\PostgreSQL\17`
   - Komponen: centang PostgreSQL Server, pgAdmin 4, Command Line Tools. **Hilangkan centang Stack Builder**.
   - **Data Directory**: `D:\PostgreSQL\17\data`
   - **Password** untuk pengguna `postgres`: pilih yang kuat, **catat**. Ini kunci utama database di laptopmu.
   - **Port**: `5432` (default).
   - **Locale**: biarkan "[Default locale]".
   - Selesai; bila ditawari Stack Builder, batalkan.
3. Tambahkan `D:\PostgreSQL\17\bin` ke PATH (installer tidak melakukannya):
   Start → ketik "environment variables" → "Edit the system environment variables" → tombol **Environment
   Variables…** → di bagian **User variables**, pilih `Path` → **Edit** → **New** → ketik `D:\PostgreSQL\17\bin` →
   OK, OK, OK.
4. Buka PowerShell **baru**, lalu buat pengguna dan dua database untuk aplikasi:

```powershell
PS> psql -U postgres
```

Masukkan password `postgres` (ketikan tidak tampil). Di prompt `postgres=#` ketik satu per satu (akhiri titik koma):

```sql
CREATE ROLE sit WITH LOGIN PASSWORD 'sit';
CREATE DATABASE tbsu_dev OWNER sit;
CREATE DATABASE tbsu_test OWNER sit;
\l
\q
```

`\l` harus menampilkan `tbsu_dev` dan `tbsu_test` dengan owner `sit`. Pengguna `sit` / password `sit` hanya untuk
laptop pengembangan; produksi memakai password lain (Fase 8).

5. Uji koneksi sebagai `sit`:

```powershell
PS> psql -U sit -d tbsu_dev -c "select version();"
```

Harus mencetak "PostgreSQL 17.x". Kalau ditolak "password authentication failed", ulangi langkah 4.

pgAdmin 4 (Start → pgAdmin 4) adalah tampilan grafis untuk melihat isi database; tidak wajib dipakai, tetapi berguna
untuk mengintip tabel nanti.

## Langkah 4 — Ekstensi VS Code

Buka VS Code → `Ctrl+Shift+X` → cari dan pasang:

| Ekstensi | Penerbit | Untuk |
|---|---|---|
| Claude Code | Anthropic | sudah ada |
| ESLint | Microsoft | menandai kesalahan kode |
| Prettier - Code formatter | Prettier | merapikan format otomatis |
| Tailwind CSS IntelliSense | Tailwind Labs | melengkapi kelas CSS |
| PostgreSQL (opsional) | Chris Kolkman atau Microsoft | menjalankan SQL dari VS Code |

Lalu `Ctrl+,` (Settings) → cari `format on save` → centang **Editor: Format On Save**.

## Langkah 5 — Konfigurasi Git (sekali seumur laptop)

```powershell
PS> git config --global user.name "Nama Kamu"
PS> git config --global user.email "email@kamu.com"
PS> git config --global core.autocrlf false
PS> git config --global core.longpaths true
PS> git config --global init.defaultBranch main
```

`core.autocrlf false` mencegah Git mengubah akhir baris (Prettier yang mengaturnya, konsisten LF). `core.longpaths
true` mencegah error "Filename too long" pada `node_modules`.

## Langkah 6 — Variabel lingkungan supaya browser tes tidak masuk C

Playwright (tes end-to-end, Fase 8) mengunduh browser ± 500 MB. Arahkan ke D sekarang:

```powershell
PS> setx PLAYWRIGHT_BROWSERS_PATH "D:\dev-cache\ms-playwright"
```

Berlaku untuk PowerShell yang dibuka setelah ini.

## Langkah 7 — Inisialisasi repo

```powershell
PS> cd D:\sit-tbsu
PS> dir
```

Harus terlihat `CLAUDE.md` dan folder `docs`. Pastikan `docs\referensi\` sudah terisi sesuai
`docs\referensi\README.md` (laporan KP, diagram, skema lama, mockup). Lalu:

```powershell
PS> git init
PS> git add -A
PS> git commit -m "docs: paket fondasi (CLAUDE.md, docs 01-07, skema v3.1, keputusan)"
PS> git log --oneline
```

Satu commit tampil. Mulai titik ini, setiap perubahan tercatat.

## Langkah 8 — (Opsional, sangat disarankan) Cadangan ke GitHub

Kalau laptop rusak, repo lokal ikut hilang. Push ke GitHub = salinan di server.

1. Buat akun di https://github.com (gratis). Klik **New repository** → nama `sit-tbsu` → **Private** → jangan
   centang "Add a README" → Create.
2. Di PowerShell:

```powershell
PS> cd D:\sit-tbsu
PS> git remote add origin https://github.com/<username-github>/sit-tbsu.git
PS> git push -u origin main
```

Saat pertama push, jendela browser terbuka meminta login GitHub (Git Credential Manager, sudah ikut Git for
Windows). Setelah itu cukup `git push` tiap kali ingin mencadangkan. `push` = unggah ke server; `pull` = unduh dari
server (dipakai kalau kamu bekerja dari dua laptop).

## Langkah 9 — (Opsional) Pengecualian Windows Defender

Defender memindai ribuan berkas `node_modules` dan memperlambat `pnpm install` serta `pnpm dev`. Start → "Windows
Security" → Virus & threat protection → Manage settings → Exclusions → Add → Folder → `D:\sit-tbsu` dan
`D:\dev-cache`. Hanya lakukan bila kamu yakin tidak menyalin berkas asing ke folder itu.

## Langkah 10 — Mulai Fase 1 bersama Claude Code (gue sampe disini, tinggal mulai fase 1)

1. Buka VS Code → File → Open Folder → `D:\sit-tbsu`.
2. Buka panel Claude Code (ikon di Activity Bar kiri). Pastikan status login OK dan **mode auto-accept tidak
   aktif** (Claude harus meminta persetujuan sebelum mengedit).
3. Buat branch di terminal VS Code (`Ctrl+`` ` ``):

```powershell
PS> git checkout -b feat/01-setup
```

4. Tempel prompt berikut ke Claude Code (sesuaikan angka versi dengan hasil `node -v`, `pnpm -v`, `psql --version`):

> Baca `CLAUDE.md`, `docs/README.md`, `docs/02-arsitektur.md`, `docs/03-skema-database-v3.md`, dan bagian
> **Fase 1** di `docs/07-roadmap.md`.
>
> Lingkungan saya: Windows 11, PowerShell. Node.js v24.21.0, pnpm 12.6.0, PostgreSQL 17.11 di `localhost:5432`.
> Pengguna database `sit` password `sit`, database `tbsu_dev` dan `tbsu_test` sudah ada dan masih kosong.
> Repo sudah `git init` di `D:\sit-tbsu` berisi `CLAUDE.md` dan `docs/`, branch `feat/01-setup`.
> Store pnpm di `D:\dev-cache\pnpm-store`.
>
> Tugas: kerjakan **Fase 1 — Setup lingkungan** sesuai deliverable dan definisi selesai di roadmap.
> Sebelum mengedit apa pun:
> 1. Periksa versi terbaru yang stabil untuk paket inti di registry npm (react, vite, tailwindcss, hono,
>    drizzle-orm, drizzle-kit, zod, @tanstack/react-query, react-hook-form, vitest, playwright, typescript)
>    dan usulkan versi yang akan dipin, beserta catatan kompatibilitas (Zod 4 vs 3, Tailwind 4 dengan Vite).
> 2. Tulis rencana: daftar berkas yang akan dibuat, urutan pengerjaan, dan cara mengujinya.
>
> Tunggu persetujuan saya sebelum membuat berkas. Jelaskan singkat konsep baru yang muncul (monorepo, migrasi,
> workspace) karena saya sedang belajar.

5. Baca rencananya. Kalau ada yang tidak jelas, tanya di panel yang sama, atau tempel ke chat arsitek. Setujui
   dengan menulis "Setuju, lanjutkan" (atau sebut koreksi).
6. Claude akan membuat struktur monorepo, memasang paket (`pnpm install`, beberapa menit pertama kali), menyalin
   DDL v3.1 sebagai migrasi `0000`, menulis skema Drizzle, seed, endpoint `health` dan `satuan`, halaman `/satuan`,
   dan tes. Ia akan menjalankan `pnpm typecheck`, `pnpm lint`, `pnpm test`, lalu meminta kamu mencoba `pnpm dev`.
7. Cek sendiri di terminal:

```powershell
PS> pnpm dev
```

Buka http://localhost:5173 → halaman Satuan menampilkan daftar satuan dari database. Buka
http://localhost:3000/api/health → `{"data":{"status":"ok","db":"ok"}}`. Tekan `Ctrl+C` di terminal untuk berhenti.

8. Salin `.env.example` menjadi `.env` bila Claude belum melakukannya (ia tidak boleh mengisi rahasia untukmu):
   `SEED_OWNER_PASSWORD` = password Owner awal (nanti diminta ganti saat login pertama).
9. Semua lulus → commit dan merge:

```powershell
PS> git add -A
PS> git commit -m "feat(setup): monorepo, migrasi 0000, seed, health, halaman satuan"
PS> git checkout main
PS> git merge feat/01-setup
PS> git push        # bila memakai GitHub
```

10. Minta Claude memperbarui status Fase 1 di `docs/07-roadmap.md` menjadi Selesai dan mencatat versi paket
    yang dipin sebagai keputusan baru di `docs/keputusan/`. Commit lagi.

Fase 1 selesai. Fase 2 dimulai dengan pola yang sama: branch `feat/02-akses-dasar`, prompt merujuk Fase 2 di
roadmap dan `docs/04-hak-akses.md`.

---

## Troubleshooting

| Gejala | Penyebab | Solusi |
|---|---|---|
| `pnpm : File ... pnpm.ps1 cannot be loaded because running scripts is disabled` | Execution policy | Ulangi Langkah 2 baris pertama |
| `node`/`pnpm`/`psql` "is not recognized" | PATH belum dibaca | Tutup dan buka lagi PowerShell/VS Code; kalau masih, restart laptop; untuk psql periksa Langkah 3 poin 3 |
| `psql: password authentication failed for user "sit"` | Role belum dibuat / salah password | Ulangi Langkah 3 poin 4 |
| `port 5432 already in use` saat install PostgreSQL | Ada PostgreSQL lain | Pakai port 5433 di installer dan di `.env` (`DATABASE_URL=...:5433/...`) |
| `EPERM`/`EBUSY` saat `pnpm install` | Antivirus/Defender atau VS Code memegang berkas | Tutup VS Code, jalankan `pnpm install` di PowerShell, pertimbangkan Langkah 9 |
| `Filename too long` dari Git | Long paths | `git config --global core.longpaths true` |
| `pnpm dev` jalan tapi browser kosong / error koneksi DB | `.env` belum ada atau salah | Periksa `DATABASE_URL=postgres://sit:sit@localhost:5432/tbsu_dev` |
| Port 3000 atau 5173 sudah dipakai | Proses lama masih jalan | Tutup terminal lama; atau `netstat -ano | findstr :3000` lalu `taskkill /PID <pid> /F` |
| Claude Code mengedit tanpa bertanya | Auto-accept aktif | Matikan di panel Claude Code; ingatkan "lihat CLAUDE.md bagian Cara kerja" |
| Claude Code memakai versi paket yang berbeda dari docs/02 | Wajar; docs/02 hanya perkiraan | Terima usulannya bila ia menjelaskan kompatibilitas; versi final dicatat di keputusan |
| Ruang C menyusut | Cache atau browser Playwright di C | Periksa `npm config get cache`, `pnpm config get store-dir`, dan variabel `PLAYWRIGHT_BROWSERS_PATH` |

## Perintah harian yang akan sering dipakai

```powershell
pnpm dev                 # jalankan aplikasi (api + web)
pnpm typecheck           # cek tipe
pnpm lint                # cek gaya kode
pnpm test                # tes otomatis (butuh tbsu_test)
pnpm db:migrate          # terapkan migrasi baru
pnpm db:seed             # data awal
git status               # apa yang berubah
git add -A; git commit -m "pesan"
git checkout -b feat/xx-nama     # branch fitur baru
git checkout main; git merge feat/xx-nama
git push                 # cadangkan ke GitHub
```
