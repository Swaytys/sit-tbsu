ALTER TABLE "barang" ADD COLUMN "berat_kg" numeric(12, 3);--> statement-breakpoint
ALTER TABLE "barang" ADD COLUMN "panjang_cm" numeric(10, 1);--> statement-breakpoint
ALTER TABLE "barang" ADD COLUMN "lebar_cm" numeric(10, 1);--> statement-breakpoint
ALTER TABLE "barang" ADD COLUMN "tinggi_cm" numeric(10, 1);--> statement-breakpoint
ALTER TABLE "barang" ADD COLUMN "curah" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "barang" ADD COLUMN "volume_m3" numeric(12, 4);--> statement-breakpoint
ALTER TABLE "kendaraan" ADD COLUMN "bak_panjang_cm" integer;--> statement-breakpoint
ALTER TABLE "kendaraan" ADD COLUMN "bak_lebar_cm" integer;--> statement-breakpoint
ALTER TABLE "kendaraan" ADD COLUMN "bak_tinggi_cm" integer;--> statement-breakpoint
ALTER TABLE "kendaraan" ADD COLUMN "berlaku_stnk" date;--> statement-breakpoint
ALTER TABLE "kendaraan" ADD COLUMN "berlaku_kir" date;--> statement-breakpoint
ALTER TABLE "perjalanan" ADD COLUMN "muatan_berat_kg" numeric(12, 3);--> statement-breakpoint
ALTER TABLE "perjalanan" ADD COLUMN "muatan_volume_m3" numeric(12, 4);--> statement-breakpoint
ALTER TABLE "perjalanan" ADD COLUMN "alasan_muatan" varchar(500);--> statement-breakpoint
ALTER TABLE "barang" ADD CONSTRAINT "chk_barang_muatan" CHECK ((berat_kg is null or berat_kg >= 0) and (panjang_cm is null or panjang_cm > 0)
        and (lebar_cm is null or lebar_cm > 0) and (tinggi_cm is null or tinggi_cm > 0)
        and (volume_m3 is null or volume_m3 > 0));--> statement-breakpoint
ALTER TABLE "kendaraan" ADD CONSTRAINT "chk_kendaraan_bak" CHECK ((bak_panjang_cm is null or bak_panjang_cm > 0) and (bak_lebar_cm is null or bak_lebar_cm > 0)
        and (bak_tinggi_cm is null or bak_tinggi_cm > 0));