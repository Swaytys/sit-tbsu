-- K-098: harga jual tier ditentukan total nilai belanja transaksi (min_belanja), berlaku untuk semua barang.
-- Tier selain tier dasar selalu memakai markup tier (IKUT_TIER); harga khusus per barang pindah ke promo.
ALTER TABLE "tingkat_harga" ADD COLUMN "min_belanja" bigint;--> statement-breakpoint
ALTER TABLE "tingkat_harga" ADD CONSTRAINT "chk_tingkat_harga_min_belanja" CHECK (min_belanja is null or (min_belanja > 0 and not is_default));--> statement-breakpoint
-- Baris harga tier selain tier dasar yang diatur per barang (Rp tetap / markup sendiri) dikembalikan ke markup
-- tier dan dihitung ulang: bulatkan ke atas (dasar x (1 + markup tier / 100)) ke kelipatan pembulatan harga.
UPDATE "harga_barang" h SET
  "metode" = 'IKUT_TIER',
  "markup_persen" = NULL,
  "harga_tetap" = NULL,
  "dasar_markup_saat_hitung" = d."dasar",
  "harga_jual" = (ceil(d."dasar" * (1 + t."markup_default_persen" / 100) / k."kelipatan") * k."kelipatan")::bigint,
  "diubah_pada" = now()
FROM "tingkat_harga" t,
  (SELECT b."id",
          CASE
            WHEN b."kepemilikan" = 'KONSINYASI' THEN coalesce(b."harga_titip", 0)
            WHEN p."tanggal_beli_terakhir" IS NULL THEN b."harga_modal_awal"
            WHEN (SELECT "nilai" FROM "konfigurasi" WHERE "kode" = 'dasar_markup') = 'HPP_RATA2' THEN p."hpp_rata2"
            ELSE p."harga_beli_terakhir"
          END AS "dasar"
     FROM "barang" b JOIN "persediaan" p ON p."id_barang" = b."id") d,
  (SELECT greatest(1, coalesce(
            (SELECT "nilai"::int FROM "konfigurasi" WHERE "kode" = 'pembulatan_harga' AND "nilai" ~ '^[0-9]+$'),
            100)) AS "kelipatan") k
WHERE t."id" = h."id_tingkat_harga" AND NOT t."is_default"
  AND h."id_satuan_jual" IS NULL AND h."metode" <> 'IKUT_TIER' AND d."id" = h."id_barang";--> statement-breakpoint
-- Harga tetap kemasan (satuan jual) pada tier selain tier dasar kembali otomatis (harga tier satuan dasar x isi).
UPDATE "harga_barang" h SET "metode" = 'IKUT_TIER', "markup_persen" = NULL, "harga_tetap" = NULL, "diubah_pada" = now()
FROM "tingkat_harga" t
WHERE t."id" = h."id_tingkat_harga" AND NOT t."is_default"
  AND h."id_satuan_jual" IS NOT NULL AND h."metode" <> 'IKUT_TIER';
