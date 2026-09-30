import { and, asc, count, eq, ilike, ne, or, sql, type SQL } from 'drizzle-orm';
import type { Peran, StatusAktif } from '@sit/shared';
import type { Executor, Tx } from '../../../db/client';
import { pengguna, sesiLogin } from '../../../db/schema';
import { polaCari } from '../../../lib/paginasi';

/** Jumlah sesi yang masih berlaku (belum dicabut, belum melewati batas absolut). */
const jumlahSesiAktif = sql<number>`(
  select count(*)::int from ${sesiLogin}
  where ${sesiLogin.idPengguna} = ${pengguna.id}
    and ${sesiLogin.dicabutPada} is null
    and ${sesiLogin.kadaluarsaAbsolut} > now()
)`;

const kolomDaftar = {
  id: pengguna.id,
  kode: pengguna.kode,
  username: pengguna.username,
  namaPengguna: pengguna.namaPengguna,
  peran: pengguna.peran,
  statusAktif: pengguna.statusAktif,
  noHp: pengguna.noHp,
  wajibGantiPassword: pengguna.wajibGantiPassword,
  terkunciSampai: pengguna.terkunciSampai,
  loginTerakhir: pengguna.loginTerakhir,
  sesiAktif: jumlahSesiAktif,
};

export type BarisPengguna = {
  id: number;
  kode: string;
  username: string;
  namaPengguna: string;
  peran: Peran;
  statusAktif: StatusAktif;
  noHp: string | null;
  wajibGantiPassword: boolean;
  terkunciSampai: Date | null;
  loginTerakhir: Date | null;
  sesiAktif: number;
};

function syaratDaftar(p: {
  cari?: string | undefined;
  status: StatusAktif | 'SEMUA';
}): SQL | undefined {
  const syarat: (SQL | undefined)[] = [];
  if (p.status !== 'SEMUA') syarat.push(eq(pengguna.statusAktif, p.status));
  if (p.cari) {
    const pola = polaCari(p.cari);
    syarat.push(
      or(
        ilike(pengguna.namaPengguna, pola),
        ilike(pengguna.username, pola),
        ilike(pengguna.kode, pola),
      ),
    );
  }
  return and(...syarat);
}

export async function daftarPengguna(
  ex: Executor,
  p: { cari?: string | undefined; status: StatusAktif | 'SEMUA'; limit: number; offset: number },
): Promise<{ baris: BarisPengguna[]; total: number }> {
  const syarat = syaratDaftar(p);
  const baris = await ex
    .select(kolomDaftar)
    .from(pengguna)
    .where(syarat)
    .orderBy(asc(pengguna.kode))
    .limit(p.limit)
    .offset(p.offset);
  const [hitung] = await ex.select({ total: count() }).from(pengguna).where(syarat);
  return { baris, total: hitung?.total ?? 0 };
}

export async function penggunaById(ex: Executor, id: number): Promise<BarisPengguna | undefined> {
  const [baris] = await ex.select(kolomDaftar).from(pengguna).where(eq(pengguna.id, id)).limit(1);
  return baris;
}

/** Mengunci baris pengguna sampai transaksi selesai (mencegah dua perubahan bersamaan). */
export async function kunciPengguna(tx: Tx, id: number): Promise<BarisPengguna | undefined> {
  const [baris] = await tx
    .select(kolomDaftar)
    .from(pengguna)
    .where(eq(pengguna.id, id))
    .limit(1)
    .for('update', { of: pengguna });
  return baris;
}

/**
 * Jumlah Owner AKTIF selain `kecualiId`, dengan mengunci baris-barisnya. Dua Owner yang saling
 * menonaktifkan bersamaan jadi berurutan, sehingga aturan "Owner terakhir" tidak bisa ditembus.
 */
export async function hitungOwnerAktifLain(tx: Tx, kecualiId: number): Promise<number> {
  const baris = await tx
    .select({ id: pengguna.id })
    .from(pengguna)
    .where(
      and(
        eq(pengguna.peran, 'OWNER'),
        eq(pengguna.statusAktif, 'AKTIF'),
        ne(pengguna.id, kecualiId),
      ),
    )
    .for('update');
  return baris.length;
}

export async function usernameDipakai(
  ex: Executor,
  username: string,
  kecualiId?: number,
): Promise<boolean> {
  const [baris] = await ex
    .select({ id: pengguna.id })
    .from(pengguna)
    .where(
      and(
        eq(pengguna.username, username),
        kecualiId === undefined ? undefined : ne(pengguna.id, kecualiId),
      ),
    )
    .limit(1);
  return baris !== undefined;
}

export async function tambahPengguna(
  tx: Tx,
  nilai: {
    kode: string;
    username: string;
    namaPengguna: string;
    peran: Peran;
    noHp: string | null;
    passwordHash: string;
  },
): Promise<number> {
  const [baris] = await tx
    .insert(pengguna)
    .values({ ...nilai, wajibGantiPassword: true })
    .returning({ id: pengguna.id });
  if (!baris) throw new Error('Pengguna gagal disimpan');
  return baris.id;
}

export async function ubahPengguna(
  tx: Tx,
  id: number,
  nilai: { username: string; namaPengguna: string; peran: Peran; noHp: string | null },
  waktu: Date,
): Promise<void> {
  await tx
    .update(pengguna)
    .set({ ...nilai, diubahPada: waktu })
    .where(eq(pengguna.id, id));
}

export async function ubahStatusPengguna(
  tx: Tx,
  id: number,
  statusAktif: StatusAktif,
  waktu: Date,
): Promise<void> {
  await tx
    .update(pengguna)
    .set({
      statusAktif,
      diubahPada: waktu,
      // Mengaktifkan kembali juga membuka kunci gagal login.
      ...(statusAktif === 'AKTIF' ? { gagalLoginBerturut: 0, terkunciSampai: null } : {}),
    })
    .where(eq(pengguna.id, id));
}
