ALTER TABLE "permintaan_persetujuan" DROP CONSTRAINT "chk_permintaan_persetujuan_jenis";--> statement-breakpoint
ALTER TABLE "permintaan_persetujuan" DROP CONSTRAINT "chk_permintaan_persetujuan_rujukan";--> statement-breakpoint
ALTER TABLE "permintaan_persetujuan" ADD COLUMN "sidik" varchar(64);--> statement-breakpoint
ALTER TABLE "permintaan_persetujuan" ADD CONSTRAINT "chk_permintaan_persetujuan_jenis" CHECK (jenis in ('RETUR','VOID','LIMIT_KREDIT','UBAH_PELANGGAN'));--> statement-breakpoint
ALTER TABLE "permintaan_persetujuan" ADD CONSTRAINT "chk_permintaan_persetujuan_rujukan" CHECK ((jenis = 'RETUR' and id_retur is not null) or (jenis = 'VOID' and id_void is not null) or (jenis in ('LIMIT_KREDIT', 'UBAH_PELANGGAN') and id_pelanggan is not null));