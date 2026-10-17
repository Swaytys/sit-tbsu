ALTER TABLE "order_penjualan" DROP CONSTRAINT "chk_order_status";--> statement-breakpoint
ALTER TABLE "order_penjualan" ADD COLUMN "no_hp_pembeli" varchar(20);--> statement-breakpoint
ALTER TABLE "order_penjualan" ADD COLUMN "tanggal_ambil" date;--> statement-breakpoint
ALTER TABLE "order_penjualan" ADD CONSTRAINT "chk_order_disimpan" CHECK (status <> 'DISIMPAN' or (tanggal_ambil is not null and no_hp_pembeli is not null));--> statement-breakpoint
ALTER TABLE "order_penjualan" ADD CONSTRAINT "chk_order_status" CHECK (status in ('DRAFT','MENUNGGU','DIPROSES','DISIMPAN','SELESAI','BATAL'));