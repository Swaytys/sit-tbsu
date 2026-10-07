-- Fase 9 (K-087): promo per baris order (PR4/PR5) dan indeks pemakaian promo di penjualan_detail.
ALTER TABLE "order_penjualan_detail" DROP CONSTRAINT "chk_order_detail_harga";--> statement-breakpoint
ALTER TABLE "order_penjualan_detail" ADD COLUMN "id_promo" bigint;--> statement-breakpoint
ALTER TABLE "order_penjualan_detail" ADD COLUMN "diskon_promo" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "order_penjualan_detail" ADD COLUMN "promo_nonaktif" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "order_penjualan_detail" ADD CONSTRAINT "order_penjualan_detail_id_promo_fkey" FOREIGN KEY ("id_promo") REFERENCES "public"."promo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_penjualan_detail_promo" ON "penjualan_detail" USING btree ("id_promo") WHERE id_promo is not null;--> statement-breakpoint
ALTER TABLE "order_penjualan_detail" ADD CONSTRAINT "chk_order_detail_harga" CHECK (harga_satuan >= 0 and diskon_baris >= 0 and diskon_promo >= 0 and subtotal >= 0);