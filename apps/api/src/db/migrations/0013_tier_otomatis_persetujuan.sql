-- K-099: persetujuan retur/void di tempat dan batas bebas (cara_persetujuan), pengajuan bisa dibatalkan
-- (status DIBATALKAN), dan tier harga selalu otomatis (tier_dipilih dihapus).
ALTER TABLE "retur_penjualan" DROP CONSTRAINT "chk_retur_status";--> statement-breakpoint
ALTER TABLE "void_transaksi" DROP CONSTRAINT "chk_void_status";--> statement-breakpoint
ALTER TABLE "retur_penjualan" ADD COLUMN "cara_persetujuan" varchar(12);--> statement-breakpoint
ALTER TABLE "void_transaksi" ADD COLUMN "cara_persetujuan" varchar(12);--> statement-breakpoint
ALTER TABLE "order_penjualan_detail" DROP COLUMN "tier_dipilih";--> statement-breakpoint
-- K-099: tier tidak lagi bisa dipilih manual. Tier aktif selain tier dasar yang belum punya syarat belanja
-- dinonaktifkan (syaratnya tidak bisa ditebak); pemilik mengisi "Mulai belanja" lalu mengaktifkannya kembali.
UPDATE "tingkat_harga" SET "status_aktif" = 'NONAKTIF', "diubah_pada" = now()
  WHERE NOT "is_default" AND "min_belanja" IS NULL AND "status_aktif" = 'AKTIF';--> statement-breakpoint
ALTER TABLE "tingkat_harga" ADD CONSTRAINT "chk_tingkat_harga_aktif_bersyarat" CHECK (is_default or min_belanja is not null or status_aktif = 'NONAKTIF');--> statement-breakpoint
-- Dokumen lama yang sudah disetujui: pengaju = penyetuju berarti disetujui sendiri (K-017), selain itu dari
-- akun atasan (satu-satunya cara sebelum K-099).
UPDATE "retur_penjualan" SET "cara_persetujuan" =
  CASE WHEN "id_penyetuju" = "id_pengaju" THEN 'SENDIRI' ELSE 'AKUN_ATASAN' END
  WHERE "status" = 'DISETUJUI';--> statement-breakpoint
UPDATE "void_transaksi" SET "cara_persetujuan" =
  CASE WHEN "id_penyetuju" = "id_pengaju" THEN 'SENDIRI' ELSE 'AKUN_ATASAN' END
  WHERE "status" = 'DISETUJUI';--> statement-breakpoint
ALTER TABLE "retur_penjualan" ADD CONSTRAINT "chk_retur_cara" CHECK ((status = 'DISETUJUI') = (cara_persetujuan is not null)
        and (cara_persetujuan is null or cara_persetujuan in ('SENDIRI','AKUN_ATASAN','DI_TEMPAT','BATAS_BEBAS')));--> statement-breakpoint
ALTER TABLE "retur_penjualan" ADD CONSTRAINT "chk_retur_status" CHECK (status in ('MENUNGGU','DISETUJUI','DITOLAK','DIBATALKAN'));--> statement-breakpoint
ALTER TABLE "void_transaksi" ADD CONSTRAINT "chk_void_cara" CHECK ((status = 'DISETUJUI') = (cara_persetujuan is not null)
        and (cara_persetujuan is null or cara_persetujuan in ('SENDIRI','AKUN_ATASAN','DI_TEMPAT','BATAS_BEBAS')));--> statement-breakpoint
ALTER TABLE "void_transaksi" ADD CONSTRAINT "chk_void_status" CHECK (status in ('MENUNGGU','DISETUJUI','DITOLAK','DIBATALKAN'));