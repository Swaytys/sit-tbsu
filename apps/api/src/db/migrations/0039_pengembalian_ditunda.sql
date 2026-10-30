ALTER TABLE "retur_penjualan" DROP CONSTRAINT "chk_retur_transfer";--> statement-breakpoint
ALTER TABLE "retur_penjualan" ADD COLUMN "pengembalian_ditunda" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "retur_penjualan" ADD COLUMN "potong_dulu" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "retur_penjualan" ADD CONSTRAINT "chk_retur_transfer" CHECK (status_transfer is null or (status_transfer in ('MENUNGGU','SELESAI') and metode_refund in ('TUNAI','TRANSFER')));