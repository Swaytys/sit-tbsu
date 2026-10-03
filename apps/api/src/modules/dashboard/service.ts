import type { AksiLog, AktivitasDashboard, Izin, RingkasanDashboard } from '@sit/shared';
import { and, count, desc, eq, gte, inArray, lte, ne, notInArray, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  logAktivitas,
  orderPenjualan,
  penjualan,
  pengguna,
  returPenjualan,
  suratJalan,
  voidTransaksi,
} from '../../db/schema';
import { tambahHari, tanggalOperasional } from '../../lib/waktu';

/*
 * Dashboard per peran (docs/05 ST3). Kartu yang tampil ditentukan izin; angka omzet hanya untuk
 * `dashboard.omzet`. Penjualan bersih harian = Σ (total_neto − total_void − total_retur) penjualan
 * bertanggal operasional hari itu (status ≠ VOID).
 */

export async function ringkasanDashboard(izin: ReadonlySet<Izin>): Promise<RingkasanDashboard> {
  const hariIni = tanggalOperasional();
  const [antrean] = await db
    .select({
      total: count(),
      diproses: sql<number>`count(*) filter (where ${orderPenjualan.status} = 'DIPROSES')`.mapWith(
        Number,
      ),
    })
    .from(orderPenjualan)
    .where(inArray(orderPenjualan.status, ['MENUNGGU', 'DIPROSES']));
  const [kirim] = await db
    .select({
      total: count(),
      dikirim: sql<number>`count(*) filter (where ${suratJalan.status} = 'DIKIRIM')`.mapWith(
        Number,
      ),
    })
    .from(suratJalan)
    .where(inArray(suratJalan.status, ['DIMUAT', 'DIKIRIM']));

  const hasil: RingkasanDashboard = {
    tanggal: hariIni,
    antreanOrder: { total: antrean?.total ?? 0, diproses: antrean?.diproses ?? 0 },
    pengirimanAktif: { total: kirim?.total ?? 0, dikirim: kirim?.dikirim ?? 0 },
  };

  if (izin.has('retur.setujui') || izin.has('void.setujui')) {
    const [r] = await db
      .select({ n: count() })
      .from(returPenjualan)
      .where(eq(returPenjualan.status, 'MENUNGGU'));
    const [v] = await db
      .select({ n: count() })
      .from(voidTransaksi)
      .where(eq(voidTransaksi.status, 'MENUNGGU'));
    hasil.persetujuan = {
      retur: izin.has('retur.setujui') ? (r?.n ?? 0) : 0,
      void: izin.has('void.setujui') ? (v?.n ?? 0) : 0,
    };
  }

  if (izin.has('dashboard.omzet')) {
    const awal = tambahHari(hariIni, -6);
    const harian = await db
      .select({
        tanggal: penjualan.tanggalOperasional,
        nilai: sql<string>`sum(${penjualan.totalNeto} - ${penjualan.totalVoid} - ${penjualan.totalRetur})::text`,
        jumlah: count(),
      })
      .from(penjualan)
      .where(
        and(
          ne(penjualan.statusTransaksi, 'VOID'),
          gte(penjualan.tanggalOperasional, tambahHari(hariIni, -7)),
          lte(penjualan.tanggalOperasional, hariIni),
        ),
      )
      .groupBy(penjualan.tanggalOperasional);
    const per = new Map(harian.map((h) => [h.tanggal, h]));
    const nilai = (t: string) => Number(per.get(t)?.nilai ?? 0);
    hasil.omzet = {
      hariIni: nilai(hariIni),
      kemarin: nilai(tambahHari(hariIni, -1)),
      jumlahTransaksiHariIni: per.get(hariIni)?.jumlah ?? 0,
      tujuhHari: Array.from({ length: 7 }, (_, i) => {
        const t = tambahHari(awal, i);
        return { tanggal: t, nilai: nilai(t) };
      }),
    };
  }
  return hasil;
}

const AKSI_SESI = ['LOGIN_SUKSES', 'LOGIN_GAGAL', 'LOGOUT'] as const;

/**
 * Aktivitas terkini: pemegang `sistem.log.lihat` (Owner) melihat semua pengguna, selain itu hanya
 * aktivitasnya sendiri (docs/04 §8). Aktivitas login/logout tidak ditampilkan.
 */
export async function aktivitasDashboard(
  idPengguna: number,
  izin: ReadonlySet<Izin>,
  batas = 8,
): Promise<AktivitasDashboard[]> {
  const baris = await db
    .select({
      id: logAktivitas.id,
      waktu: logAktivitas.waktu,
      aksi: logAktivitas.aksi,
      namaPengguna: pengguna.namaPengguna,
      nomorDokumen: logAktivitas.nomorDokumen,
      ringkasan: logAktivitas.ringkasan,
    })
    .from(logAktivitas)
    .leftJoin(pengguna, eq(pengguna.id, logAktivitas.idPengguna))
    .where(
      and(
        notInArray(logAktivitas.aksi, [...AKSI_SESI]),
        izin.has('sistem.log.lihat') ? undefined : eq(logAktivitas.idPengguna, idPengguna),
      ),
    )
    .orderBy(desc(logAktivitas.waktu), desc(logAktivitas.id))
    .limit(batas);
  // Kolom aksi hanya ditulis lewat catatLog() yang bertipe AksiLog, aman dipersempit.
  return baris.map((b) => ({ ...b, aksi: b.aksi as AksiLog, waktu: b.waktu.toISOString() }));
}
