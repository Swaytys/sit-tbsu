# Pembuat proposal

Skrip yang menyusun `Proposal-Implementasi-BonsaiUrip-UD-Sumber-Urip.docx`.

- `demo.mjs`, `demo2.mjs`: mengisi data contoh di paket BonsaiUrip yang dijalankan dengan `BONSAIURIP_DATA`
  terpisah, lalu memotret layar (Playwright).
- `diagram.mjs`: menggambar diagram (d1–d11) dari HTML.
- `buat_proposal.py` + `pr_alat.py` + `pr_isi1.py` + `pr_isi2.py`: menyusun dokumen Word (python-docx).

Gambar disimpan di folder `proposal` di luar repo; ubah konstanta `G` di `pr_alat.py` ke folder gambar sebelum
menjalankan ulang. Setelah dibuat, buka di Word lalu perbarui daftar isi (klik kanan › Update Field).
