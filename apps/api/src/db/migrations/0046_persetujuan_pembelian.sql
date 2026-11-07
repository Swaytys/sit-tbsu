ALTER TABLE "order_pembelian" DROP CONSTRAINT "chk_po_status";--> statement-breakpoint
ALTER TABLE "order_pembelian" DROP CONSTRAINT "chk_po_nomor";--> statement-breakpoint
ALTER TABLE "order_pembelian" DROP CONSTRAINT "chk_po_dipesan";--> statement-breakpoint
ALTER TABLE "barang" ADD COLUMN "perlu_persetujuan_beli" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "order_pembelian" ADD COLUMN "alasan_persetujuan" varchar(500);--> statement-breakpoint
ALTER TABLE "order_pembelian" ADD COLUMN "id_penyetuju" bigint;--> statement-breakpoint
ALTER TABLE "order_pembelian" ADD COLUMN "disetujui_pada" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "order_pembelian" ADD COLUMN "catatan_persetujuan" varchar(255);--> statement-breakpoint
ALTER TABLE "order_pembelian" ADD CONSTRAINT "order_pembelian_id_penyetuju_fkey" FOREIGN KEY ("id_penyetuju") REFERENCES "public"."pengguna"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_pembelian" ADD CONSTRAINT "chk_po_status" CHECK (status in ('DRAF','DIAJUKAN','DISETUJUI','DIPESAN','DIKONFIRMASI','SEBAGIAN','SELESAI','DITUTUP','BATAL'));--> statement-breakpoint
ALTER TABLE "order_pembelian" ADD CONSTRAINT "chk_po_nomor" CHECK ((status in ('DRAF', 'DIAJUKAN', 'DISETUJUI') and nomor is null) or status = 'BATAL'
        or (status not in ('DRAF', 'DIAJUKAN', 'DISETUJUI', 'BATAL') and nomor is not null));--> statement-breakpoint
ALTER TABLE "order_pembelian" ADD CONSTRAINT "chk_po_dipesan" CHECK (status in ('DRAF', 'DIAJUKAN', 'DISETUJUI', 'BATAL') or tanggal_dipesan is not null);