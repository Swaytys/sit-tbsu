import { and, count, eq, isNull, ne, sql } from 'drizzle-orm';
import type { Executor, Tx } from '../../db/client';
import { pengguna, sesiLogin } from '../../db/schema';

const kolomPengguna = {
  id: pengguna.id,
  kode: pengguna.kode,
  username: pengguna.username,
  namaPengguna: pengguna.namaPengguna,
  peran: pengguna.peran,
  statusAktif: pengguna.statusAktif,
  wajibGantiPassword: pengguna.wajibGantiPassword,
};

export async function penggunaUntukLogin(ex: Executor, username: string) {
  const [baris] = await ex
    .select({
      ...kolomPengguna,
      passwordHash: pengguna.passwordHash,
      terkunciSampai: pengguna.terkunciSampai,
    })
    .from(pengguna)
    .where(eq(pengguna.username, username))
    .limit(1);
  return baris;
}

export type CalonLogin = NonNullable<Awaited<ReturnType<typeof penggunaUntukLogin>>>;

/**
 * Menambah hitungan gagal login secara atomik. Bila mencapai `maks`, akun dikunci sampai `kunciSampai`
 * dan hitungan kembali ke 0. Mengembalikan nilai `terkunci_sampai` terbaru.
 */
export async function catatGagalLogin(
  tx: Tx,
  idPengguna: number,
  maks: number,
  kunciSampai: Date,
): Promise<Date | null> {
  const mencapaiBatas = sql`${pengguna.gagalLoginBerturut} + 1 >= ${maks}`;
  const [baris] = await tx
    .update(pengguna)
    .set({
      gagalLoginBerturut: sql`case when ${mencapaiBatas} then 0 else ${pengguna.gagalLoginBerturut} + 1 end`,
      terkunciSampai: sql`case when ${mencapaiBatas} then ${kunciSampai}::timestamptz else ${pengguna.terkunciSampai} end`,
    })
    .where(eq(pengguna.id, idPengguna))
    .returning({ terkunciSampai: pengguna.terkunciSampai });
  return baris?.terkunciSampai ?? null;
}

export async function catatLoginSukses(tx: Tx, idPengguna: number, waktu: Date): Promise<void> {
  await tx
    .update(pengguna)
    .set({ gagalLoginBerturut: 0, terkunciSampai: null, loginTerakhir: waktu })
    .where(eq(pengguna.id, idPengguna));
}

export async function buatSesi(
  tx: Tx,
  nilai: {
    idPengguna: number;
    tokenHash: string;
    kadaluarsaAbsolut: Date;
    terakhirAktif: Date;
    ip: string | null;
    userAgent: string | null;
  },
): Promise<number> {
  const [baris] = await tx.insert(sesiLogin).values(nilai).returning({ id: sesiLogin.id });
  if (!baris) throw new Error('Sesi gagal dibuat');
  return baris.id;
}

export async function sesiDenganPengguna(ex: Executor, tokenHash: string) {
  const [baris] = await ex
    .select({
      idSesi: sesiLogin.id,
      kadaluarsaAbsolut: sesiLogin.kadaluarsaAbsolut,
      terakhirAktif: sesiLogin.terakhirAktif,
      dicabutPada: sesiLogin.dicabutPada,
      ...kolomPengguna,
    })
    .from(sesiLogin)
    .innerJoin(pengguna, eq(sesiLogin.idPengguna, pengguna.id))
    .where(eq(sesiLogin.tokenHash, tokenHash))
    .limit(1);
  return baris;
}

export async function perbaruiAktivitasSesi(
  ex: Executor,
  idSesi: number,
  waktu: Date,
): Promise<void> {
  await ex.update(sesiLogin).set({ terakhirAktif: waktu }).where(eq(sesiLogin.id, idSesi));
}

export async function cabutSesi(
  ex: Executor,
  idSesi: number,
  alasan: string,
  waktu: Date,
): Promise<void> {
  await ex
    .update(sesiLogin)
    .set({ dicabutPada: waktu, alasanCabut: alasan })
    .where(and(eq(sesiLogin.id, idSesi), isNull(sesiLogin.dicabutPada)));
}

/** Mencabut semua sesi aktif seorang pengguna, kecuali `kecualiIdSesi` (sesi yang sedang dipakai). */
export async function cabutSesiPengguna(
  ex: Executor,
  idPengguna: number,
  alasan: string,
  waktu: Date,
  kecualiIdSesi?: number,
): Promise<number> {
  const hasil = await ex
    .update(sesiLogin)
    .set({ dicabutPada: waktu, alasanCabut: alasan })
    .where(
      and(
        eq(sesiLogin.idPengguna, idPengguna),
        isNull(sesiLogin.dicabutPada),
        kecualiIdSesi === undefined ? undefined : ne(sesiLogin.id, kecualiIdSesi),
      ),
    )
    .returning({ id: sesiLogin.id });
  return hasil.length;
}

export async function passwordHashPengguna(
  ex: Executor,
  idPengguna: number,
): Promise<string | undefined> {
  const [baris] = await ex
    .select({ passwordHash: pengguna.passwordHash })
    .from(pengguna)
    .where(eq(pengguna.id, idPengguna))
    .limit(1);
  return baris?.passwordHash;
}

export async function ubahPassword(
  tx: Tx,
  idPengguna: number,
  passwordHash: string,
  wajibGantiPassword: boolean,
  waktu: Date,
): Promise<void> {
  await tx
    .update(pengguna)
    .set({
      passwordHash,
      wajibGantiPassword,
      gagalLoginBerturut: 0,
      terkunciSampai: null,
      diubahPada: waktu,
    })
    .where(eq(pengguna.id, idPengguna));
}

/** K-191: jumlah pengguna (akun pertama hanya boleh dibuat bila 0). */
export async function jumlahPengguna(ex: Executor): Promise<number> {
  const [b] = await ex.select({ n: count() }).from(pengguna);
  return b?.n ?? 0;
}

/** K-191: data pemulihan satu pengguna (berdasarkan username huruf kecil). */
export async function penggunaUntukPemulihan(ex: Executor, username: string) {
  const [b] = await ex
    .select({
      id: pengguna.id,
      username: pengguna.username,
      statusAktif: pengguna.statusAktif,
      kodePemulihanHash: pengguna.kodePemulihanHash,
    })
    .from(pengguna)
    .where(eq(pengguna.username, username))
    .limit(1);
  return b;
}

export async function infoKodePemulihan(ex: Executor, idPengguna: number) {
  const [b] = await ex
    .select({
      ada: sql<boolean>`${pengguna.kodePemulihanHash} is not null`,
      dibuatPada: pengguna.kodePemulihanDibuatPada,
    })
    .from(pengguna)
    .where(eq(pengguna.id, idPengguna));
  return b;
}

export async function simpanKodePemulihan(
  tx: Tx,
  idPengguna: number,
  kodeHash: string,
  waktu: Date,
): Promise<void> {
  await tx
    .update(pengguna)
    .set({ kodePemulihanHash: kodeHash, kodePemulihanDibuatPada: waktu, diubahPada: waktu })
    .where(eq(pengguna.id, idPengguna));
}

/** Setelah password dipulihkan: hitungan gagal dan kunci akun dihapus. */
export async function bukaKunciAkun(tx: Tx, idPengguna: number): Promise<void> {
  await tx
    .update(pengguna)
    .set({ gagalLoginBerturut: 0, terkunciSampai: null })
    .where(eq(pengguna.id, idPengguna));
}

/** K-191: akun Owner pertama; password dibuat sendiri, jadi tidak wajib diganti. */
export async function tambahOwnerPertama(
  tx: Tx,
  nilai: { kode: string; username: string; namaPengguna: string; passwordHash: string },
): Promise<number> {
  const [b] = await tx
    .insert(pengguna)
    .values({ ...nilai, peran: 'OWNER', wajibGantiPassword: false })
    .returning({ id: pengguna.id });
  if (!b) throw new Error('Akun pertama gagal disimpan');
  return b.id;
}
