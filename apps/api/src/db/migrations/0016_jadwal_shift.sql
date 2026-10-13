ALTER TABLE "shift_kasir" ADD COLUMN "jadwal_buka" varchar(5);--> statement-breakpoint
ALTER TABLE "shift_kasir" ADD COLUMN "jadwal_tutup" varchar(5);--> statement-breakpoint
ALTER TABLE "shift_kasir" ADD COLUMN "diingatkan_pada" timestamp with time zone;