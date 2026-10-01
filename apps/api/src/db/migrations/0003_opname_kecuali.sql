ALTER TABLE "penyesuaian_stok_detail" ADD COLUMN "dikecualikan" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "penyesuaian_stok_detail" ADD COLUMN "alasan_kecuali" varchar(150);--> statement-breakpoint
ALTER TABLE "penyesuaian_stok_detail" ADD COLUMN "id_pengguna_kecuali" bigint;--> statement-breakpoint
ALTER TABLE "penyesuaian_stok_detail" ADD COLUMN "waktu_kecuali" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "penyesuaian_stok_detail" ADD CONSTRAINT "penyesuaian_stok_detail_id_pengguna_kecuali_fkey" FOREIGN KEY ("id_pengguna_kecuali") REFERENCES "public"."pengguna"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "penyesuaian_stok_detail" ADD CONSTRAINT "chk_penyesuaian_detail_kecuali" CHECK (not dikecualikan or (alasan_kecuali is not null and id_pengguna_kecuali is not null and waktu_kecuali is not null));