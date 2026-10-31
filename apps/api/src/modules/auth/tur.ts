import { KODE_TUR, type KodeTur, type StatusTur } from '@sit/shared';
import { db } from '../../db/client';
import * as repo from './repo';

/*
 * K-206: tur fitur yang sudah selesai/dilewati, per pengguna (bukan localStorage: tetap tersimpan saat pengguna
 * berganti komputer). Ini preferensi tampilan, bukan data bisnis, sehingga tidak dicatat di log aktivitas.
 */

const kenal = (k: string): k is KodeTur => (KODE_TUR as readonly string[]).includes(k);

export async function bacaTur(idPengguna: number): Promise<StatusTur> {
  const t = await repo.turStatus(db, idPengguna);
  return { selesai: t.selesai.filter(kenal), dilewati: t.dilewati.filter(kenal) };
}

export async function catatTur(
  idPengguna: number,
  kode: KodeTur,
  hasil: 'SELESAI' | 'DILEWATI',
): Promise<StatusTur> {
  const t = await bacaTur(idPengguna);
  const tanpa = (d: KodeTur[]) => d.filter((k) => k !== kode);
  const baru: StatusTur =
    hasil === 'SELESAI'
      ? { selesai: [...tanpa(t.selesai), kode], dilewati: tanpa(t.dilewati) }
      : { selesai: tanpa(t.selesai), dilewati: [...tanpa(t.dilewati), kode] };
  await repo.simpanTurStatus(db, idPengguna, baru);
  return baru;
}

export async function ulangTur(idPengguna: number, kode: KodeTur | 'SEMUA'): Promise<StatusTur> {
  const t = await bacaTur(idPengguna);
  const baru: StatusTur =
    kode === 'SEMUA'
      ? { selesai: [], dilewati: [] }
      : {
          selesai: t.selesai.filter((k) => k !== kode),
          dilewati: t.dilewati.filter((k) => k !== kode),
        };
  await repo.simpanTurStatus(db, idPengguna, baru);
  return baru;
}
