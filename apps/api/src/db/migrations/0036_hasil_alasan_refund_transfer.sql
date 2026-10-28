ALTER TABLE "retur_penjualan" ADD COLUMN "nominal_refund" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "retur_penjualan" ADD COLUMN "status_transfer" varchar(10);--> statement-breakpoint
ALTER TABLE "retur_penjualan" ADD COLUMN "waktu_transfer" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "retur_penjualan" ADD COLUMN "id_pengguna_transfer" bigint;--> statement-breakpoint
ALTER TABLE "surat_jalan_hasil" ADD COLUMN "id_retur_rusak" bigint;--> statement-breakpoint
ALTER TABLE "surat_jalan_hasil_detail" ADD COLUMN "alasan_kembali" varchar(15);--> statement-breakpoint
ALTER TABLE "surat_jalan_hasil_detail" ADD COLUMN "alasan_rusak" varchar(20);--> statement-breakpoint
ALTER TABLE "retur_penjualan" ADD CONSTRAINT "retur_penjualan_id_pengguna_transfer_fkey" FOREIGN KEY ("id_pengguna_transfer") REFERENCES "public"."pengguna"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surat_jalan_hasil" ADD CONSTRAINT "surat_jalan_hasil_id_retur_rusak_fkey" FOREIGN KEY ("id_retur_rusak") REFERENCES "public"."retur_penjualan"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retur_penjualan" ADD CONSTRAINT "chk_retur_transfer" CHECK (status_transfer is null or (status_transfer in ('MENUNGGU','SELESAI') and metode_refund = 'TRANSFER'));--> statement-breakpoint
ALTER TABLE "surat_jalan_hasil_detail" ADD CONSTRAINT "chk_surat_jalan_hasil_alasan" CHECK ((alasan_kembali is null or alasan_kembali in ('KIRIM_ULANG','KELEBIHAN','SALAH_BARANG','BATAL_BELI'))
        and (alasan_rusak is null or alasan_rusak in ('RUSAK_DI_JALAN','RUSAK_SAAT_DICEK')));