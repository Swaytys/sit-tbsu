-- K-098: syarat qty tier (K-097) diganti syarat total nilai belanja (tingkat_harga.min_belanja, 0011).
ALTER TABLE "harga_barang" DROP CONSTRAINT "chk_harga_min_qty";--> statement-breakpoint
ALTER TABLE "tingkat_harga" DROP CONSTRAINT "chk_tingkat_harga_min_qty";--> statement-breakpoint
ALTER TABLE "harga_barang" DROP COLUMN "min_qty";--> statement-breakpoint
ALTER TABLE "tingkat_harga" DROP COLUMN "min_qty";