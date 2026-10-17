ALTER TABLE "pemasok" ADD COLUMN "lama_kirim_hari" integer;--> statement-breakpoint
ALTER TABLE "pemasok" ADD COLUMN "jarak_belanja_hari" integer;--> statement-breakpoint
ALTER TABLE "pemasok" ADD CONSTRAINT "chk_pemasok_lama_kirim" CHECK (lama_kirim_hari is null or lama_kirim_hari between 0 and 365);--> statement-breakpoint
ALTER TABLE "pemasok" ADD CONSTRAINT "chk_pemasok_jarak_belanja" CHECK (jarak_belanja_hari is null or jarak_belanja_hari between 1 and 365);