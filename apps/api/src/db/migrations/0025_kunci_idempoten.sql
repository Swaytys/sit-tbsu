CREATE TABLE "kunci_idempoten" (
	"kunci" varchar(64) NOT NULL,
	"id_pengguna" bigint NOT NULL,
	"metode" varchar(8) NOT NULL,
	"jalur" varchar(255) NOT NULL,
	"hash_body" char(64) NOT NULL,
	"status" varchar(10) DEFAULT 'PROSES' NOT NULL,
	"kode_http" integer,
	"respons" text,
	"dibuat_pada" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kunci_idempoten_pkey" PRIMARY KEY("kunci","id_pengguna"),
	CONSTRAINT "chk_kunci_idempoten_status" CHECK (status in ('PROSES','SELESAI'))
);
--> statement-breakpoint
ALTER TABLE "kunci_idempoten" ADD CONSTRAINT "kunci_idempoten_id_pengguna_fkey" FOREIGN KEY ("id_pengguna") REFERENCES "public"."pengguna"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_kunci_idempoten_dibuat" ON "kunci_idempoten" USING btree ("dibuat_pada");