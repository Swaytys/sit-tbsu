import { izinEfektif, type Izin, type Peran } from '@sit/shared';
import { sql } from 'drizzle-orm';
import { kolomPenuh } from '../db/kolom-penuh';
import { pengguna, peranKustom } from '../db/schema';

/*
 * K-243: kolom yang dibutuhkan untuk menghitung izin efektif sebuah akun (peran + peran khusus aktif + penyesuaian
 * akun). Dipakai di setiap select pengguna yang hasilnya dipakai untuk memeriksa wewenang (sesi, pemilik kode
 * persetujuan, penerima pesan).
 */
export const kolomIzin = {
  izinTambah: pengguna.izinTambah,
  izinCabut: pengguna.izinCabut,
  idPeranKustom: pengguna.idPeranKustom,
  namaPeranKustom: sql<string | null>`(select ${peranKustom.nama} from ${peranKustom}
    where ${peranKustom.id} = ${kolomPenuh(pengguna.idPeranKustom)} and ${peranKustom.statusAktif} = 'AKTIF')`,
  kustomTambah: sql<string[] | null>`(select ${peranKustom.izinTambah} from ${peranKustom}
    where ${peranKustom.id} = ${kolomPenuh(pengguna.idPeranKustom)} and ${peranKustom.statusAktif} = 'AKTIF')`,
  kustomCabut: sql<string[] | null>`(select ${peranKustom.izinCabut} from ${peranKustom}
    where ${peranKustom.id} = ${kolomPenuh(pengguna.idPeranKustom)} and ${peranKustom.statusAktif} = 'AKTIF')`,
};

export type BarisIzin = {
  peran: Peran;
  izinTambah: string[];
  izinCabut: string[];
  kustomTambah: string[] | null;
  kustomCabut: string[] | null;
};

export function izinDari(b: BarisIzin): Set<Izin> {
  return izinEfektif(
    b.peran,
    b.kustomTambah || b.kustomCabut
      ? { tambah: b.kustomTambah ?? [], cabut: b.kustomCabut ?? [] }
      : null,
    { tambah: b.izinTambah, cabut: b.izinCabut },
  );
}
