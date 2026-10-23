-- K-132, U10: satu shift terbuka untuk seluruh toko. Bila masih ada shift ganda dari aturan lama, migrasi berhenti
-- dengan pesan jelas (data tidak diubah diam-diam): tutup dulu lewat halaman Shift, lalu ulangi migrasi.
DO $$
BEGIN
  IF (SELECT count(*) FROM shift_kasir WHERE status <> 'TUTUP') > 1 THEN
    RAISE EXCEPTION 'Masih ada lebih dari satu shift terbuka. Tutup dulu di halaman Shift & Clerical Check, lalu jalankan pnpm db:migrate lagi.';
  END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_shift_toko_terbuka" ON "shift_kasir" USING btree ((true)) WHERE status <> 'TUTUP';
