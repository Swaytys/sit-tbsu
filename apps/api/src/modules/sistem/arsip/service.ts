import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { gunzip, gzip } from 'node:zlib';
import { eq, sql } from 'drizzle-orm';
import type { HasilPeriksaArsip, RingkasanArsip, TahunArsip } from '@sit/shared';
import { db, type Executor } from '../../../db/client';
import { pengguna, tutupTahun } from '../../../db/schema';
import { env } from '../../../env';
import { AppError, galatKolom } from '../../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { dalamTransaksi } from '../../../lib/transaksi';
import { saatLokal, sekarang, tanggalOperasional } from '../../../lib/waktu';
import { catatLog } from '../log-aktivitas';
import { TABEL_MASTER, TABEL_TRANSAKSI, type Periode } from './tabel';

/*
 * K-165: tutup tahun dan arsip tahunan (docs/05 §18). Keputusan: data TETAP di satu database (tidak dipindah),
 * karena volume toko (ratusan ribu baris per tahun) jauh di bawah batas yang membuat PostgreSQL berindeks lambat,
 * dan memindah baris akan memutus rujukan lintas tahun (retur/pelunasan atas nota tahun lalu). Tutup tahun:
 * (1) memastikan tidak ada dokumen setengah jalan di tahun itu, (2) menulis berkas arsip utuh (semua transaksi
 * termasuk void/retur + potret master) yang ikut dicadangkan, (3) mengunci tahun itu dari dokumen/perubahan
 * bertanggal tahun tersebut. Owner bisa membuka kembali (alasan wajib) lalu menutup ulang.
 */

const gzipA = promisify(gzip);
const gunzipA = promisify(gunzip);

/** Folder arsip di dalam folder penyimpanan (ikut cadangan harian restic). */
export function folderArsip(): string {
  return path.join(env.STORAGE_DIR, 'arsip');
}

function periode(tahun: number): Periode {
  const dari = `${tahun}-01-01`;
  const sampai = `${tahun}-12-31`;
  return {
    dari,
    sampai,
    awal: saatLokal(dari, '00:00'),
    akhir: saatLokal(`${tahun + 1}-01-01`, '00:00'),
  };
}

const tahunIni = () => Number(tanggalOperasional().slice(0, 4));

async function angka(ex: Executor, q: ReturnType<typeof sql>): Promise<number> {
  const r = await ex.execute<{ n: string | number | null }>(q);
  return Number(r.rows[0]?.n ?? 0);
}

/** Dokumen yang belum selesai di tahun itu (harus diselesaikan dulu). */
async function penghalang(ex: Executor, tahun: number): Promise<string[]> {
  const p = periode(tahun);
  const hasil: string[] = [];
  if (tahun >= tahunIni())
    hasil.push('Tahun berjalan belum selesai; hanya tahun yang sudah lewat bisa ditutup.');
  const cek: [ReturnType<typeof sql>, string][] = [
    [
      sql`select count(*) n from order_penjualan where tanggal_operasional between ${p.dari} and ${p.sampai}
        and status in ('DRAFT','MENUNGGU','DIPROSES','DISIMPAN')`,
      'order belum selesai/batal',
    ],
    [
      sql`select count(*) n from shift_kasir where tanggal_operasional between ${p.dari} and ${p.sampai} and status <> 'TUTUP'`,
      'shift belum ditutup',
    ],
    [
      sql`select count(*) n from penyesuaian_stok where tanggal_operasional between ${p.dari} and ${p.sampai} and status = 'DRAFT'`,
      'penyesuaian stok masih draf',
    ],
    [
      sql`select count(*) n from retur_penjualan where tanggal_operasional between ${p.dari} and ${p.sampai} and status = 'MENUNGGU'`,
      'retur menunggu persetujuan',
    ],
    [
      sql`select count(*) n from void_transaksi where tanggal_operasional between ${p.dari} and ${p.sampai} and status = 'MENUNGGU'`,
      'void menunggu persetujuan',
    ],
    [
      sql`select count(*) n from surat_jalan where tanggal >= ${p.awal} and tanggal < ${p.akhir}
        and status in ('DIPROSES','DIMUAT','DIKIRIM')`,
      'surat jalan belum selesai/batal',
    ],
    [
      sql`select count(*) n from perjalanan where dibuat_pada >= ${p.awal} and dibuat_pada < ${p.akhir}
        and status in ('DIRENCANAKAN','JALAN')`,
      'rit pengiriman belum selesai/batal',
    ],
  ];
  for (const [q, teks] of cek) {
    const n = await angka(ex, q);
    if (n > 0) hasil.push(`${n} ${teks}.`);
  }
  return hasil;
}

async function ringkasan(
  ex: Executor,
  tahun: number,
  tabel: Record<string, number>,
): Promise<RingkasanArsip> {
  const p = periode(tahun);
  const pj = await ex.execute<{
    n: string;
    neto: string | null;
    v: string | null;
    r: string | null;
  }>(
    sql`select count(*) n, sum(total_neto) filter (where status_transaksi <> 'VOID') neto,
      sum(total_void) v, sum(total_retur) r
      from penjualan where tanggal_operasional between ${p.dari} and ${p.sampai}`,
  );
  const pn = await ex.execute<{ n: string; t: string | null }>(
    sql`select count(*) n, sum(total_faktur) t from penerimaan_barang
      where tanggal_operasional between ${p.dari} and ${p.sampai}`,
  );
  const pt = await ex.execute<{ n: string; s: string | null }>(
    sql`select count(*) n, sum(sisa_tagihan) s from penjualan
      where tanggal_operasional between ${p.dari} and ${p.sampai}
        and status_transaksi <> 'VOID' and status_pembayaran <> 'LUNAS'`,
  );
  const a = pj.rows[0];
  return {
    tabel,
    penjualan: {
      jumlah: Number(a?.n ?? 0),
      totalNeto: Number(a?.neto ?? 0),
      void: Number(a?.v ?? 0),
      retur: Number(a?.r ?? 0),
    },
    penerimaan: { jumlah: Number(pn.rows[0]?.n ?? 0), total: Number(pn.rows[0]?.t ?? 0) },
    piutangTerbuka: { jumlah: Number(pt.rows[0]?.n ?? 0), sisa: Number(pt.rows[0]?.s ?? 0) },
  };
}

/** Jumlah baris per tabel transaksi tahun itu (tanpa mengambil isinya). */
async function hitungTabel(ex: Executor, tahun: number): Promise<Record<string, number>> {
  const p = periode(tahun);
  const hasil: Record<string, number> = {};
  for (const e of TABEL_TRANSAKSI) {
    hasil[e.tabel] = await angka(ex, sql`select count(*) n from (${e.kueri(p)}) x`);
  }
  return hasil;
}

type BarisTutup = typeof tutupTahun.$inferSelect & { namaPenutup: string | null };

async function barisTutup(ex: Executor, tahun?: number): Promise<BarisTutup[]> {
  const q = ex
    .select({
      tahun: tutupTahun.tahun,
      status: tutupTahun.status,
      ditutupPada: tutupTahun.ditutupPada,
      ditutupOleh: tutupTahun.ditutupOleh,
      ringkasan: tutupTahun.ringkasan,
      berkas: tutupTahun.berkas,
      sha256: tutupTahun.sha256,
      ukuran: tutupTahun.ukuran,
      dibukaPada: tutupTahun.dibukaPada,
      dibukaOleh: tutupTahun.dibukaOleh,
      alasanBuka: tutupTahun.alasanBuka,
      namaPenutup: pengguna.namaPengguna,
    })
    .from(tutupTahun)
    .leftJoin(pengguna, eq(pengguna.id, tutupTahun.ditutupOleh));
  return tahun === undefined ? q : q.where(eq(tutupTahun.tahun, tahun));
}

/** Tahun yang punya transaksi (dari penjualan/penerimaan/log), terbaru dulu. */
async function tahunBerdata(ex: Executor): Promise<number[]> {
  const r = await ex.execute<{ t: number }>(sql`
    select distinct t from (
      select extract(year from tanggal_operasional)::int t from penjualan
      union select extract(year from tanggal_operasional)::int from penerimaan_barang
      union select extract(year from tanggal_operasional)::int from shift_kasir
    ) x order by t desc`);
  return r.rows.map((x) => Number(x.t));
}

export async function daftarTahun(): Promise<TahunArsip[]> {
  const tutup = new Map((await barisTutup(db)).map((b) => [b.tahun, b]));
  const semua = [...new Set([...(await tahunBerdata(db)), ...tutup.keys()])].sort((a, b) => b - a);
  const hasil: TahunArsip[] = [];
  for (const tahun of semua) {
    const b = tutup.get(tahun);
    const ditutup = b?.status === 'DITUTUP';
    hasil.push({
      tahun,
      status: b?.status ?? null,
      penghalang: ditutup ? [] : await penghalang(db, tahun),
      ringkasan: ditutup
        ? (b.ringkasan as RingkasanArsip)
        : await ringkasan(db, tahun, await hitungTabel(db, tahun)),
      berkas: b?.berkas ?? null,
      ukuran: b?.ukuran ?? null,
      sha256: b?.sha256 ?? null,
      ditutupPada: b?.ditutupPada.toISOString() ?? null,
      ditutupOleh: b?.namaPenutup ?? null,
      dibukaPada: b?.dibukaPada?.toISOString() ?? null,
      alasanBuka: b?.alasanBuka ?? null,
    });
  }
  return hasil;
}

/** Ambil isi arsip satu tahun (transaksi + potret master). */
async function isiArsip(ex: Executor, tahun: number) {
  const p = periode(tahun);
  const transaksi: Record<string, unknown[]> = {};
  for (const e of TABEL_TRANSAKSI) transaksi[e.tabel] = (await ex.execute(e.kueri(p))).rows;
  const master: Record<string, unknown[]> = {};
  for (const m of TABEL_MASTER) master[m.tabel] = (await ex.execute(m.kueri)).rows;
  return { transaksi, master };
}

/**
 * Tutup tahun: hanya Owner (`sistem.cadangan.kelola`), tahun yang sudah lewat, tanpa dokumen setengah jalan.
 * Berkas arsip ditulis dulu, baru tahun dikunci (satu transaksi; baris `tutup_tahun` dikunci).
 */
export async function tutupTahunIni(
  tahun: number,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<TahunArsip> {
  await dalamTransaksi(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('tutup_tahun'), ${tahun})`);
    const [lama] = await barisTutup(tx, tahun);
    if (lama?.status === 'DITUTUP') {
      throw new AppError('STATUS_TIDAK_VALID', `Tahun ${tahun} sudah ditutup.`, 409);
    }
    const halangan = await penghalang(tx, tahun);
    if (halangan.length > 0) {
      throw new AppError(
        'STATUS_TIDAK_VALID',
        `Tahun ${tahun} belum bisa ditutup: ${halangan.join(' ')}`,
        409,
        {
          penghalang: halangan,
        },
      );
    }
    const isi = await isiArsip(tx, tahun);
    const tabel = Object.fromEntries(Object.entries(isi.transaksi).map(([k, v]) => [k, v.length]));
    const ring = await ringkasan(tx, tahun, tabel);
    const waktu = sekarang();
    const berkasJson = JSON.stringify({
      format: 'bonsaiurip-arsip-tahunan',
      versi: 1,
      tahun,
      dibuatPada: waktu.toISOString(),
      ringkasan: ring,
      transaksi: isi.transaksi,
      master: isi.master,
    });
    const isiGz = await gzipA(Buffer.from(berkasJson, 'utf8'));
    const sha256 = createHash('sha256').update(isiGz).digest('hex');
    const nama = `arsip-${tahun}-${waktu.toISOString().replace(/[-:.]/g, '')}.json.gz`;
    await mkdir(folderArsip(), { recursive: true });
    await writeFile(path.join(folderArsip(), nama), isiGz);
    const nilai = {
      status: 'DITUTUP' as const,
      ditutupPada: waktu,
      ditutupOleh: pelaku.id,
      ringkasan: ring,
      berkas: nama,
      sha256,
      ukuran: isiGz.length,
      dibukaPada: null,
      dibukaOleh: null,
      alasanBuka: null,
    };
    if (lama) await tx.update(tutupTahun).set(nilai).where(eq(tutupTahun.tahun, tahun));
    else await tx.insert(tutupTahun).values({ tahun, ...nilai });
    await catatLog(tx, {
      aksi: 'TAHUN_TUTUP',
      idPengguna: pelaku.id,
      entitas: 'tutup_tahun',
      idEntitas: tahun,
      ringkasan: `Tutup tahun ${tahun}: ${ring.penjualan.jumlah} penjualan, berkas ${nama} (${isiGz.length} byte)`,
      dataBaru: { berkas: nama, sha256, tabel },
      ip: asal.ip,
    });
  });
  const [t] = (await daftarTahun()).filter((x) => x.tahun === tahun);
  if (!t) throw new Error('tahun hilang');
  return t;
}

/** Buka kembali tahun yang ditutup (Owner, alasan wajib). Berkas arsip lama tetap disimpan. */
export async function bukaTahun(
  tahun: number,
  alasan: string,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<void> {
  await dalamTransaksi(async (tx) => {
    const [lama] = await barisTutup(tx, tahun);
    if (lama?.status !== 'DITUTUP') {
      throw new AppError('STATUS_TIDAK_VALID', `Tahun ${tahun} tidak sedang ditutup.`, 409);
    }
    await tx
      .update(tutupTahun)
      .set({ status: 'DIBUKA', dibukaPada: sekarang(), dibukaOleh: pelaku.id, alasanBuka: alasan })
      .where(eq(tutupTahun.tahun, tahun));
    await catatLog(tx, {
      aksi: 'TAHUN_BUKA',
      idPengguna: pelaku.id,
      entitas: 'tutup_tahun',
      idEntitas: tahun,
      ringkasan: `Buka kembali tahun ${tahun}: ${alasan}`,
      ip: asal.ip,
    });
  });
}

/** Periksa berkas arsip: checksum dan jumlah baris tiap tabel dibanding database sekarang. */
export async function periksaArsip(
  tahun: number,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<HasilPeriksaArsip> {
  const [b] = await barisTutup(db, tahun);
  if (!b) throw new AppError('TIDAK_DITEMUKAN', `Tahun ${tahun} belum pernah ditutup.`, 404);
  const lokasi = path.join(folderArsip(), b.berkas);
  const isi = await readFile(lokasi).catch(() => null);
  const checksumCocok = isi !== null && createHash('sha256').update(isi).digest('hex') === b.sha256;
  const selisih: HasilPeriksaArsip['selisih'] = [];
  if (isi !== null && checksumCocok) {
    const data = JSON.parse((await gunzipA(isi)).toString('utf8')) as {
      transaksi: Record<string, unknown[]>;
    };
    const sekarangDb = await hitungTabel(db, tahun);
    for (const [tabel, baris] of Object.entries(data.transaksi)) {
      const nDb = sekarangDb[tabel] ?? 0;
      if (nDb !== baris.length) selisih.push({ tabel, berkas: baris.length, database: nDb });
    }
  }
  await catatLog(db, {
    aksi: 'ARSIP_PERIKSA',
    idPengguna: pelaku.id,
    entitas: 'tutup_tahun',
    idEntitas: tahun,
    ringkasan: `Periksa arsip ${tahun}: ${isi === null ? 'berkas tidak ada' : checksumCocok ? `checksum cocok, ${selisih.length} tabel berbeda` : 'checksum TIDAK cocok'}`,
    ip: asal.ip,
  });
  return { tahun, berkasAda: isi !== null, checksumCocok, selisih };
}

/** Isi berkas arsip untuk diunduh. */
export async function berkasArsip(tahun: number): Promise<{ isi: Buffer; nama: string }> {
  const [b] = await barisTutup(db, tahun);
  if (!b) throw new AppError('TIDAK_DITEMUKAN', `Tahun ${tahun} belum pernah ditutup.`, 404);
  const lokasi = path.join(folderArsip(), b.berkas);
  try {
    await stat(lokasi);
  } catch {
    throw new AppError('TIDAK_DITEMUKAN', `Berkas ${b.berkas} tidak ada di folder arsip.`, 404);
  }
  return { isi: await readFile(lokasi), nama: b.berkas };
}

/**
 * Pengaman (K-165): dokumen atau perubahan bertanggal `tanggal` ditolak bila tahunnya DITUTUP. Dipakai isian
 * yang tanggalnya boleh dipilih (mis. catatan BBM/servis); dokumen lain selalu bertanggal hari ini.
 */
export async function pastikanTahunTerbuka(
  ex: Executor,
  tanggal: string,
  kolom = 'tanggal',
): Promise<void> {
  const tahun = Number(tanggal.slice(0, 4));
  const [b] = await ex
    .select({ status: tutupTahun.status })
    .from(tutupTahun)
    .where(eq(tutupTahun.tahun, tahun));
  if (b?.status === 'DITUTUP') {
    throw galatKolom(
      kolom,
      `Tahun ${tahun} sudah ditutup (arsip tahunan); tidak bisa mencatat atau mengubah di tahun itu.`,
    );
  }
}
