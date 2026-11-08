ALTER TABLE "alokasi_uang_muka" DROP CONSTRAINT "chk_alokasi_sumber";--> statement-breakpoint
ALTER TABLE "pembayaran_pemasok" DROP CONSTRAINT "chk_pbp_metode";--> statement-breakpoint
ALTER TABLE "alokasi_uang_muka" ADD CONSTRAINT "chk_alokasi_sumber" CHECK ((jenis = 'DIPAKAI' and id_penerimaan is not null and metode_kembali is null)
        or (jenis = 'DIKEMBALIKAN' and id_penerimaan is null and metode_kembali in ('TUNAI', 'TRANSFER', 'DEPOSIT')));--> statement-breakpoint
ALTER TABLE "pembayaran_pemasok" ADD CONSTRAINT "chk_pbp_metode" CHECK (metode in ('TUNAI','TRANSFER','KOMPENSASI','DEPOSIT'));