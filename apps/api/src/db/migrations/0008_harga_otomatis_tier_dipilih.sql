-- K-094: harga otomatis menjadi bawaan untuk semua barang, dan tier baris order bisa otomatis (tier pelanggan
-- atau syarat qty) atau dipilih kasir (tier_dipilih).
ALTER TABLE "barang" ALTER COLUMN "harga_otomatis" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "order_penjualan_detail" ADD COLUMN "tier_dipilih" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Keputusan pemilik: semua barang berharga otomatis (bisa dimatikan per barang).
UPDATE "barang" SET "harga_otomatis" = true WHERE "harga_otomatis" = false;--> statement-breakpoint
-- Sebelum K-094 tier baris hanya berbeda dari tier bawaan (tier pelanggan, atau tier default) bila dipilih
-- kasir; baris seperti itu tetap dianggap pilihan kasir.
UPDATE "order_penjualan_detail" d SET "tier_dipilih" = true
FROM "order_penjualan" o
LEFT JOIN "pelanggan" p ON p."id" = o."id_pelanggan"
WHERE o."id" = d."id_order"
  AND NOT d."harga_manual"
  AND d."id_tingkat_harga" IS DISTINCT FROM coalesce(
    p."id_tingkat_harga",
    (SELECT t."id" FROM "tingkat_harga" t WHERE t."is_default")
  );
