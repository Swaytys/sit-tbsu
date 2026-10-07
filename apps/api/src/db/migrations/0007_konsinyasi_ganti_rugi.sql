-- K-092: pemusnahan barang titipan ditagihkan sebagai ganti rugi di setoran konsinyasi (penanda di
-- penyesuaian_stok_detail) dan kolom qty_ganti_rugi di detail setoran.
ALTER TABLE "penyelesaian_konsinyasi_detail" DROP CONSTRAINT "chk_ksg_detail";--> statement-breakpoint
ALTER TABLE "penyesuaian_stok_detail" ADD COLUMN "id_penyelesaian_konsinyasi" bigint;--> statement-breakpoint
ALTER TABLE "penyelesaian_konsinyasi_detail" ADD COLUMN "qty_ganti_rugi" numeric(14, 3) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "penyesuaian_stok_detail" ADD CONSTRAINT "penyesuaian_stok_detail_id_penyelesaian_konsinyasi_fkey" FOREIGN KEY ("id_penyelesaian_konsinyasi") REFERENCES "public"."penyelesaian_konsinyasi"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_penyesuaian_detail_ksg" ON "penyesuaian_stok_detail" USING btree ("id_penyelesaian_konsinyasi");--> statement-breakpoint
ALTER TABLE "penyelesaian_konsinyasi_detail" ADD CONSTRAINT "chk_ksg_detail" CHECK (qty_terjual >= 0 and qty_retur >= 0 and qty_ganti_rugi >= 0 and qty_neto >= 0 and harga_titip >= 0 and subtotal >= 0);