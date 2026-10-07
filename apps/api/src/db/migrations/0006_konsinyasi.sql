-- Fase 11 (K-089): penanda retur pelanggan yang sudah diperhitungkan di penyelesaian konsinyasi (KS6), dan
-- baris penyelesaian per barang per harga titip saat jual (KS9).
ALTER TABLE "penyelesaian_konsinyasi_detail" DROP CONSTRAINT "uq_ksg_detail";--> statement-breakpoint
ALTER TABLE "retur_penjualan_detail" ADD COLUMN "id_penyelesaian_konsinyasi" bigint;--> statement-breakpoint
ALTER TABLE "retur_penjualan_detail" ADD CONSTRAINT "retur_penjualan_detail_id_penyelesaian_konsinyasi_fkey" FOREIGN KEY ("id_penyelesaian_konsinyasi") REFERENCES "public"."penyelesaian_konsinyasi"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_retur_detail_ksg" ON "retur_penjualan_detail" USING btree ("id_penyelesaian_konsinyasi");--> statement-breakpoint
ALTER TABLE "penyelesaian_konsinyasi_detail" ADD CONSTRAINT "uq_ksg_detail" UNIQUE("id_penyelesaian","id_barang","harga_titip");