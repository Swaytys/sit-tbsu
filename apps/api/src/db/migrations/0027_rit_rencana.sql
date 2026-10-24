ALTER TABLE "perjalanan" DROP CONSTRAINT "chk_perjalanan_status";--> statement-breakpoint
ALTER TABLE "perjalanan" DROP CONSTRAINT "chk_perjalanan_kembali";--> statement-breakpoint
ALTER TABLE "perjalanan" ALTER COLUMN "status" SET DATA TYPE varchar(12);--> statement-breakpoint
ALTER TABLE "perjalanan" ALTER COLUMN "status" SET DEFAULT 'JALAN';--> statement-breakpoint
ALTER TABLE "perjalanan" ALTER COLUMN "waktu_berangkat" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "perjalanan" ADD COLUMN "jadwal_berangkat" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "perjalanan" ADD COLUMN "alasan_batal" varchar(255);--> statement-breakpoint
ALTER TABLE "perjalanan" ADD CONSTRAINT "chk_perjalanan_status" CHECK (status in ('DIRENCANAKAN','JALAN','SELESAI','BATAL'));--> statement-breakpoint
ALTER TABLE "perjalanan" ADD CONSTRAINT "chk_perjalanan_kembali" CHECK ((status in ('DIRENCANAKAN', 'BATAL') and waktu_kembali is null)
        or (status = 'JALAN' and waktu_kembali is null and waktu_berangkat is not null)
        or (status = 'SELESAI' and waktu_kembali is not null and waktu_berangkat is not null));