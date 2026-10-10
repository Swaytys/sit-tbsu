-- K-097: tier pelanggan dan syarat qty "saran" diganti golongan pelanggan dan tingkat_harga.min_qty (0009).
ALTER TABLE "pelanggan" DROP CONSTRAINT "pelanggan_id_tingkat_harga_fkey";
--> statement-breakpoint
ALTER TABLE "pelanggan" DROP COLUMN "id_tingkat_harga";--> statement-breakpoint
ALTER TABLE "tingkat_harga" DROP COLUMN "saran_min_qty";