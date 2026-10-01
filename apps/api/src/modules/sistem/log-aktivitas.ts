import type { AksiLog } from '@sit/shared';
import type { Executor } from '../../db/client';
import { logAktivitas } from '../../db/schema';

export type EntriLog = {
  aksi: AksiLog;
  /** null hanya untuk percobaan login dengan username tak dikenal dan aksi otomatis sistem (job). */
  idPengguna: number | null;
  usernamePercobaan?: string;
  entitas?: string;
  idEntitas?: number;
  nomorDokumen?: string;
  ringkasan?: string;
  /** Untuk perubahan master: nilai sebelum dan sesudah. JANGAN berisi password/hash/token. */
  dataLama?: Record<string, unknown>;
  dataBaru?: Record<string, unknown>;
  ip?: string | null;
};

/**
 * Menulis satu baris log aktivitas (docs/04 §8). Dipanggil dengan `tx` yang sama dengan mutasinya,
 * sehingga log dan perubahan data selalu tersimpan bersama atau tidak sama sekali.
 */
export async function catatLog(ex: Executor, entri: EntriLog): Promise<void> {
  await ex.insert(logAktivitas).values({
    aksi: entri.aksi,
    idPengguna: entri.idPengguna,
    usernamePercobaan: entri.usernamePercobaan?.slice(0, 50),
    entitas: entri.entitas,
    idEntitas: entri.idEntitas,
    nomorDokumen: entri.nomorDokumen,
    ringkasan: entri.ringkasan,
    dataLama: entri.dataLama,
    dataBaru: entri.dataBaru,
    ip: entri.ip?.slice(0, 45),
  });
}
