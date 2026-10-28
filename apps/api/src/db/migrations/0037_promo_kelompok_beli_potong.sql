ALTER TABLE "promo" DROP CONSTRAINT "chk_promo_jenis";--> statement-breakpoint
ALTER TABLE "promo" DROP CONSTRAINT "chk_promo_nilai";--> statement-breakpoint
ALTER TABLE "promo" DROP CONSTRAINT "chk_promo_sasaran";--> statement-breakpoint
ALTER TABLE "promo_sasaran" DROP CONSTRAINT "chk_promo_sasaran_satu";--> statement-breakpoint
ALTER TABLE "promo" ADD CONSTRAINT "chk_promo_jenis" CHECK (jenis_potongan in ('PERSEN','NOMINAL','HARGA_KHUSUS','GRATIS','BELI_POTONG'));--> statement-breakpoint
ALTER TABLE "promo" ADD CONSTRAINT "chk_promo_nilai" CHECK ((jenis_potongan = 'PERSEN' and potongan_persen is not null and potongan_persen between 0 and 100
          and potongan_nominal is null and harga_khusus is null and beli_qty is null and gratis_qty is null)
        or (jenis_potongan = 'NOMINAL' and potongan_nominal is not null and potongan_nominal >= 0
          and potongan_persen is null and harga_khusus is null and beli_qty is null and gratis_qty is null)
        or (jenis_potongan = 'HARGA_KHUSUS' and harga_khusus > 0 and potongan_persen is null
          and potongan_nominal is null and beli_qty is null and gratis_qty is null)
        or (jenis_potongan = 'GRATIS' and beli_qty > 0 and gratis_qty > 0 and potongan_persen is null
          and potongan_nominal is null and harga_khusus is null)
        or (jenis_potongan = 'BELI_POTONG' and beli_qty > 0 and potongan_nominal > 0
          and potongan_persen is null and harga_khusus is null and gratis_qty is null));--> statement-breakpoint
ALTER TABLE "promo" ADD CONSTRAINT "chk_promo_sasaran" CHECK (sasaran in ('SEMUA','KATEGORI','MERK','BARANG','KELOMPOK'));--> statement-breakpoint
ALTER TABLE "promo_sasaran" ADD CONSTRAINT "chk_promo_sasaran_isi" CHECK (num_nonnulls(id_barang, id_kategori, id_merk) >= 1);