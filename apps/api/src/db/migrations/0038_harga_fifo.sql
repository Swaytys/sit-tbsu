ALTER TABLE "persediaan" ADD COLUMN "harga_fifo" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "persediaan" ADD CONSTRAINT "chk_persediaan_fifo" CHECK (harga_fifo >= 0);--> statement-breakpoint
-- K-184: isi awal harga FIFO dari ledger (lapisan masuk BAIK terbaru → terlama sampai menutup stok fisik).
UPDATE "persediaan" p SET "harga_fifo" = coalesce(
  CASE WHEN p.stok_fisik > 0 THEN coalesce(
    (SELECT m.hpp_satuan FROM (
       SELECT id, hpp_satuan, sum(qty_masuk) OVER (ORDER BY id DESC) AS kum
         FROM mutasi_persediaan
        WHERE id_barang = p.id_barang AND kondisi = 'BAIK' AND qty_masuk > 0
     ) m WHERE m.kum >= p.stok_fisik ORDER BY m.kum, m.id DESC LIMIT 1),
    (SELECT hpp_satuan FROM mutasi_persediaan
      WHERE id_barang = p.id_barang AND kondisi = 'BAIK' AND qty_masuk > 0 ORDER BY id LIMIT 1)
  ) END,
  p.harga_beli_terakhir);
