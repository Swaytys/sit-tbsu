ALTER TABLE "pemasok" ADD COLUMN "tempo_hari" integer;--> statement-breakpoint
ALTER TABLE "order_pembelian" ADD COLUMN "syarat_bayar" varchar(12);--> statement-breakpoint
ALTER TABLE "order_pembelian" ADD COLUMN "tempo_hari" integer;--> statement-breakpoint
ALTER TABLE "order_pembelian" ADD COLUMN "uang_muka_rencana" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "order_pembelian" ADD COLUMN "tanggal_kirim_diminta" date;--> statement-breakpoint
ALTER TABLE "order_pembelian" ADD COLUMN "cara_kirim" varchar(8);--> statement-breakpoint
ALTER TABLE "order_pembelian" ADD COLUMN "metode_bayar_rencana" varchar(10);--> statement-breakpoint
ALTER TABLE "order_pembelian" ADD COLUMN "tanggal_janji_awal" date;--> statement-breakpoint
ALTER TABLE "order_pembelian" ADD COLUMN "jumlah_ubah_janji" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "pemasok" ADD CONSTRAINT "chk_pemasok_tempo" CHECK (tempo_hari is null or tempo_hari between 1 and 365);--> statement-breakpoint
ALTER TABLE "order_pembelian" ADD CONSTRAINT "chk_po_syarat" CHECK (syarat_bayar is null or syarat_bayar in ('DI_MUKA', 'SAAT_TERIMA', 'TEMPO'));--> statement-breakpoint
ALTER TABLE "order_pembelian" ADD CONSTRAINT "chk_po_tempo" CHECK (tempo_hari is null or tempo_hari between 1 and 365);--> statement-breakpoint
ALTER TABLE "order_pembelian" ADD CONSTRAINT "chk_po_uang_muka_rencana" CHECK (uang_muka_rencana >= 0);--> statement-breakpoint
ALTER TABLE "order_pembelian" ADD CONSTRAINT "chk_po_cara_kirim" CHECK (cara_kirim is null or cara_kirim in ('DIANTAR', 'DIAMBIL'));