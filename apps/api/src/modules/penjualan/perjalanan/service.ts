import { eq, sql } from 'drizzle-orm';
import type { DataBerangkat, MetaHalaman, Perjalanan } from '@sit/shared';
import { db, type Executor } from '../../../db/client';
import { suratJalan } from '../../../db/schema';
import { AppError } from '../../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { batasHalaman, metaHalaman } from '../../../lib/paginasi';
import { dalamTransaksi } from '../../../lib/transaksi';
import { sekarang, tanggalOperasional } from '../../../lib/waktu';
import * as armadaRepo from '../../master/armada/repo';
import { masihJalan } from '../../master/armada/service';
import { catatLog } from '../../sistem/log-aktivitas';
import { terbitkanNomor } from '../../sistem/penomoran';
import * as sjRepo from '../surat-jalan/repo';
import * as repo from './repo';

/*
 * Perjalanan pengantaran (docs/05 S9, S12; K-150): satu kendaraan + satu sopir membawa satu atau lebih surat
 * jalan. Kendaraan dan sopir yang sedang jalan tidak bisa berangkat lagi sampai hasil semua surat jalannya
 * dicatat (perjalanan selesai otomatis, lihat surat-jalan/service.ts `catatHasil`).
 */

async function keRespons(
  ex: Executor,
  rows: Awaited<ReturnType<typeof repo.daftar>>['baris'],
): Promise<Perjalanan[]> {
  const sj = await repo.suratJalanPerjalanan(
    ex,
    rows.map((r) => r.id),
  );
  return rows.map((r) => ({
    ...r,
    waktuBerangkat: r.waktuBerangkat.toISOString(),
    waktuKembali: r.waktuKembali?.toISOString() ?? null,
    suratJalan: sj.filter((s) => s.idPerjalanan === r.id).map(({ idPerjalanan: _, ...s }) => s),
  }));
}

export async function daftarPerjalanan(
  p: repo.SaringPerjalanan & { halaman: number; perHalaman: number },
): Promise<{ data: Perjalanan[]; meta: MetaHalaman }> {
  const { baris, total } = await repo.daftar(db, { ...p, ...batasHalaman(p) });
  return { data: await keRespons(db, baris), meta: metaHalaman(total, p) };
}

/** S9: berangkatkan surat jalan DIPROSES/DIMUAT dengan kendaraan dan sopir yang tidak sedang jalan. */
export async function berangkat(
  input: DataBerangkat,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<Perjalanan> {
  const id = await dalamTransaksi(async (tx) => {
    // Kunci kendaraan dan sopir dulu: dua keberangkatan bersamaan dengan kendaraan/sopir yang sama berurutan.
    const k = await armadaRepo.kunciKendaraan(tx, input.idKendaraan);
    if (!k) throw new AppError('TIDAK_DITEMUKAN', 'Kendaraan tidak ditemukan.', 404);
    const s = await armadaRepo.kunciSopir(tx, input.idSopir);
    if (!s) throw new AppError('TIDAK_DITEMUKAN', 'Sopir tidak ditemukan.', 404);
    if (k.statusAktif !== 'AKTIF') {
      throw new AppError('STATUS_TIDAK_VALID', `Kendaraan ${k.plat} nonaktif.`, 409);
    }
    if (s.statusAktif !== 'AKTIF') {
      throw new AppError('STATUS_TIDAK_VALID', `Sopir ${s.nama} nonaktif.`, 409);
    }
    const jk = await armadaRepo.perjalananJalan(tx, { idKendaraan: k.id });
    if (jk) throw masihJalan(`Kendaraan ${k.plat}`, jk);
    const js = await armadaRepo.perjalananJalan(tx, { idSopir: s.id });
    if (js) throw masihJalan(`Sopir ${s.nama}`, js);

    const daftarId = [...new Set(input.idSuratJalan)].sort((a, b) => a - b);
    const nomorSj: string[] = [];
    for (const idSj of daftarId) {
      const sj = await sjRepo.kunci(tx, idSj);
      if (!sj) throw new AppError('TIDAK_DITEMUKAN', 'Surat jalan tidak ditemukan.', 404);
      if (sj.status !== 'DIPROSES' && sj.status !== 'DIMUAT') {
        throw new AppError(
          'STATUS_TIDAK_VALID',
          `Surat jalan ${sj.nomor} sudah ${sj.status === 'BATAL' ? 'batal' : 'berangkat'}; muat ulang halaman.`,
          409,
        );
      }
      nomorSj.push(sj.nomor);
    }

    const waktu = sekarang();
    const nomor = await terbitkanNomor(tx, 'TRP', tanggalOperasional(waktu));
    const idBaru = await repo.tambah(tx, {
      nomor,
      idKendaraan: k.id,
      idSopir: s.id,
      idPengguna: pelaku.id,
      waktuBerangkat: waktu,
      catatan: input.catatan ?? null,
    });
    const teksKendaraan = `${k.plat} (${k.jenis})`.slice(0, 50);
    for (const idSj of daftarId) {
      await tx
        .update(suratJalan)
        .set({
          status: 'DIKIRIM',
          idPerjalanan: idBaru,
          sopir: s.nama,
          kendaraan: teksKendaraan,
          waktuDikirim: waktu,
          waktuDimuat: sql`coalesce(${suratJalan.waktuDimuat}, ${waktu})`,
          diubahPada: waktu,
        })
        .where(eq(suratJalan.id, idSj));
    }
    await catatLog(tx, {
      aksi: 'PERJALANAN_BERANGKAT',
      idPengguna: pelaku.id,
      entitas: 'perjalanan',
      idEntitas: idBaru,
      nomorDokumen: nomor,
      ringkasan: `Perjalanan ${nomor}: ${k.plat}, sopir ${s.nama}, ${nomorSj.join(', ')}`,
      ip: asal.ip,
    });
    return idBaru;
  });
  const { baris } = await repo.daftar(db, { id, limit: 1, offset: 0 });
  const [hasil] = await keRespons(db, baris);
  if (!hasil) throw new Error('perjalanan hilang');
  return hasil;
}
