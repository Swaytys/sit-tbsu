import { IZIN_PER_PERAN, JENIS_CONTOH, skemaPenyesuaian, type ManifestData } from '@sit/shared';
import { and, eq } from 'drizzle-orm';
import { db } from '../../../db/client';
import { barang, konfigurasi, pengguna } from '../../../db/schema';
import { AppError } from '../../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { dalamTransaksi } from '../../../lib/transaksi';
import { sekarang } from '../../../lib/waktu';
import * as authRepo from '../../auth/repo';
import { buatPenyesuaian, selesaikanPenyesuaian } from '../../persediaan/penyesuaian/service';
import { invalidasiKonfigurasi } from '../konfigurasi/service';
import { catatLog } from '../log-aktivitas';
import * as pengaturanRepo from '../pengaturan/repo';
import { terbitkanKodeMaster } from '../penomoran';
import { TANDA_CONTOH } from '../penyiapan/contoh';
import { isiContoh } from '../penyiapan/service';
import { bacaSetupAwal, simpanDataUsaha } from '../setup-awal/service';
import { buatDataBaru, pastikanPasswordPelaku } from './service';

/*
 * K-168 (mode demo) lewat K-219: *data latihan* untuk melatih karyawan tanpa mengganggu data toko sungguhan. Data
 * yang sedang dipakai disimpan dulu (bisa dipakai kembali dari Pengaturan › Data toko), lalu dibuat data baru
 * bernama "LATIHAN – <nama toko>" berisi akun Owner yang sama (username dan password), contoh barang dengan stok,
 * pelanggan, pemasok, kendaraan & sopir. Konfigurasi `mode_latihan` membuat pita MODE LATIHAN tampil di semua layar.
 */

/** Stok awal contoh barang (satuan dasar) agar latihan jual-beli langsung bisa dikerjakan. */
const STOK_LATIHAN = '100';

export const KODE_MODE_LATIHAN = 'mode_latihan';

export async function buatDataLatihan(
  password: string,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<ManifestData> {
  await pastikanPasswordPelaku(pelaku, password);
  const [owner] = await db
    .select({
      username: pengguna.username,
      namaPengguna: pengguna.namaPengguna,
      passwordHash: pengguna.passwordHash,
      email: pengguna.email,
      noHp: pengguna.noHp,
    })
    .from(pengguna)
    .where(eq(pengguna.id, pelaku.id));
  if (!owner) throw new AppError('TIDAK_DITEMUKAN', 'Akun Owner tidak ditemukan.', 404);
  const setup = await bacaSetupAwal();
  const namaAsli = setup.usaha.namaToko.replace(/^LATIHAN – /, '') || 'Toko';

  const disimpan = await buatDataBaru(
    { id: pelaku.id, nama: `${pelaku.namaPengguna} (${pelaku.username})` },
    asal,
    'sebelum membuat data latihan',
  );

  const idOwner = await dalamTransaksi(async (tx) => {
    const kode = await terbitkanKodeMaster(tx, 'USR');
    const id = await authRepo.tambahOwnerPertama(tx, { kode, ...owner });
    await simpanDataUsaha(
      tx,
      { ...setup.usaha, namaToko: `LATIHAN – ${namaAsli}`.slice(0, 100) },
      setup.operasional,
    );
    const waktu = sekarang();
    await pengaturanRepo.simpanKonfigurasi(
      tx,
      { kode: 'setup_awal', nilai: JSON.stringify({ selesai: true, dilewati: [] }), tipe: 'TEKS' },
      waktu,
    );
    await pengaturanRepo.simpanKonfigurasi(
      tx,
      { kode: KODE_MODE_LATIHAN, nilai: '1', tipe: 'TEKS' },
      waktu,
    );
    return id;
  });
  invalidasiKonfigurasi();

  const ownerBaru: PenggunaAktif = {
    ...pelaku,
    id: idOwner,
    izin: IZIN_PER_PERAN.OWNER,
    peran: 'OWNER',
    wajibGantiPassword: false,
  };
  for (const jenis of JENIS_CONTOH) await isiContoh(jenis, ownerBaru, asal);
  const contoh = await db
    .select({ id: barang.id, modal: barang.hargaModalAwal })
    .from(barang)
    .where(and(eq(barang.keterangan, TANDA_CONTOH), eq(barang.statusAktif, 'AKTIF')));
  if (contoh.length > 0) {
    const adj = await buatPenyesuaian(
      skemaPenyesuaian.parse({
        jenis: 'SALDO_AWAL',
        alasan: 'Stok awal data latihan',
        baris: contoh.map((b) => ({
          idBarang: b.id,
          qtyFisik: STOK_LATIHAN,
          hppSatuan: b.modal ?? 1,
        })),
      }),
      ownerBaru,
      asal,
    );
    await selesaikanPenyesuaian(adj.id, ownerBaru, asal);
  }
  await catatLog(db, {
    aksi: 'DATA_GANTI',
    idPengguna: idOwner,
    entitas: 'pustaka_data',
    ringkasan: `Data latihan dibuat; data "${namaAsli}" disimpan dan bisa dipakai kembali dari Pengaturan › Data toko`,
    ip: asal.ip,
  });
  return disimpan;
}

/** Pita MODE LATIHAN: true bila data yang sedang dipakai adalah data latihan. */
export async function modeLatihan(): Promise<boolean> {
  const [b] = await db
    .select({ nilai: konfigurasi.nilai })
    .from(konfigurasi)
    .where(eq(konfigurasi.kode, KODE_MODE_LATIHAN));
  return b?.nilai === '1';
}
