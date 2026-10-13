ALTER TABLE "promo" ADD COLUMN "anggaran" bigint;--> statement-breakpoint
ALTER TABLE "promo" ADD COLUMN "maks_per_pembeli" bigint;--> statement-breakpoint
ALTER TABLE "promo" ADD CONSTRAINT "chk_promo_anggaran" CHECK ((anggaran is null or anggaran > 0) and (maks_per_pembeli is null or maks_per_pembeli > 0)
        and (anggaran is null or maks_per_pembeli is null or maks_per_pembeli < anggaran));