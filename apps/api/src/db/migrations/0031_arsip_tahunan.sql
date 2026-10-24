CREATE TABLE "tutup_tahun" (
	"tahun" integer PRIMARY KEY NOT NULL,
	"status" varchar(10) NOT NULL,
	"ditutup_pada" timestamp with time zone NOT NULL,
	"ditutup_oleh" bigint NOT NULL,
	"ringkasan" jsonb NOT NULL,
	"berkas" varchar(255) NOT NULL,
	"sha256" char(64) NOT NULL,
	"ukuran" bigint NOT NULL,
	"dibuka_pada" timestamp with time zone,
	"dibuka_oleh" bigint,
	"alasan_buka" varchar(255),
	CONSTRAINT "chk_tutup_tahun_status" CHECK (status in ('DITUTUP','DIBUKA')),
	CONSTRAINT "chk_tutup_tahun_tahun" CHECK (tahun between 2000 and 2999),
	CONSTRAINT "chk_tutup_tahun_buka" CHECK ((status = 'DIBUKA') = (dibuka_pada is not null and alasan_buka is not null))
);
--> statement-breakpoint
ALTER TABLE "tutup_tahun" ADD CONSTRAINT "tutup_tahun_ditutup_oleh_fkey" FOREIGN KEY ("ditutup_oleh") REFERENCES "public"."pengguna"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutup_tahun" ADD CONSTRAINT "tutup_tahun_dibuka_oleh_fkey" FOREIGN KEY ("dibuka_oleh") REFERENCES "public"."pengguna"("id") ON DELETE no action ON UPDATE no action;