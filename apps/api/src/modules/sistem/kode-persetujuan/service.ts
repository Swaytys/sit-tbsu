import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import {
  IZIN_PER_PERAN,
  type InfoKodePersetujuan,
  type Izin,
  type JenisKodePersetujuan,
} from '@sit/shared';
import { db, type Tx } from '../../../db/client';
import { catatPercobaan, type OpsiBatas } from '../../../lib/batas-percobaan';
import { AppError, galatKolom } from '../../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { dalamTransaksi } from '../../../lib/transaksi';
import { jamLokal, sekarang, tambahMenit } from '../../../lib/waktu';
import { catatLog } from '../log-aktivitas';
import { kirimKePengguna, penerimaBerizin } from '../saluran/service';
import * as repo from './repo';

/*
 * Kode persetujuan sekali pakai (docs/04 §6, K-102). Pengaju (mis. Kasir) meminta kode; sistem mengirim kode
 * 6 angka yang BERBEDA ke tiap Admin/Owner lewat Telegram/email beserta rincian yang diminta; atasan yang
 * setuju menyebutkan kodenya; pengaju mengetiknya. Kode yang dipakai menunjukkan siapa yang menyetujui.
 *
 * Tidak ada password atasan yang diketik di perangkat kasir. Kode terikat pada satu permintaan (dokumen atau
 * pelanggan + nilai), satu pengaju, berlaku 10 menit, sekali pakai, dan hangus setelah 5 kali salah ketik.
 */

const UMUR_KODE_MENIT = 10;
const BATAS_SALAH = 5;
/** Permintaan kode per pengaju: tiap permintaan mengirim pesan ke atasan, jadi tidak boleh membanjir. */
export const BATAS_MINTA_KODE: OpsiBatas = { maks: 5, jendelaDetik: 300 };

/** Atasan yang menyetujui lewat kodenya: cukup identitasnya (tidak login di perangkat itu). */
export type Atasan = Pick<PenggunaAktif, 'id' | 'username' | 'namaPengguna' | 'peran'>;

const LABEL: Record<JenisKodePersetujuan, { nama: string; entitas: string }> = {
  RETUR: { nama: 'retur', entitas: 'retur_penjualan' },
  VOID: { nama: 'void', entitas: 'void_transaksi' },
  LIMIT_KREDIT: { nama: 'melewati limit kredit', entitas: 'pelanggan' },
  UBAH_PELANGGAN: { nama: 'perubahan data pelanggan', entitas: 'pelanggan' },
  KOREKSI_KAS: { nama: 'koreksi modal kas shift', entitas: 'shift_kasir' },
};

function hashKode(idPermintaan: number, idAtasan: number, kode: string): string {
  return createHash('sha256').update(`${idPermintaan}:${idAtasan}:${kode}`).digest('hex');
}

function kodeAcak(sudah: Set<string>): string {
  for (;;) {
    const k = String(randomInt(0, 1_000_000)).padStart(6, '0');
    if (!sudah.has(k)) {
      sudah.add(k);
      return k;
    }
  }
}

/**
 * Membuat permintaan dan mengirim kode ke semua atasan pemegang `izin` yang punya Telegram/email.
 * `ringkasan` disusun pemanggil dari data di database (bukan dari teks kiriman klien), karena itulah yang
 * dibaca atasan saat memutuskan.
 */
export async function mintaKode(
  p: {
    jenis: JenisKodePersetujuan;
    izin: Izin;
    pengaju: PenggunaAktif;
    rujukan: repo.Rujukan;
    idEntitas: number;
    nomorDokumen: string | null;
    nilai: number;
    ringkasan: string;
    /** Sidik isian yang disetujui (jenis yang menyetujui sebuah isian, K-107); kosong untuk jenis lain. */
    sidik?: string;
  },
  asal: AsalRequest,
): Promise<InfoKodePersetujuan> {
  catatPercobaan(`minta-kode:${p.pengaju.id}`, BATAS_MINTA_KODE);
  const penerima = await penerimaBerizin(p.izin, p.pengaju.id);
  if (penerima.length === 0) {
    throw new AppError(
      'KONFLIK',
      'Belum ada Admin/Owner yang bisa menerima kode. Atasan perlu menghubungkan Telegram atau mengisi email di menu Akun saya.',
      409,
    );
  }

  const waktu = sekarang();
  const kadaluarsa = tambahMenit(waktu, UMUR_KODE_MENIT);
  const dipakai = new Set<string>();
  const kode = new Map(penerima.map((a) => [a.id, kodeAcak(dipakai)]));
  const idPermintaan = await dalamTransaksi(async (tx) => {
    await repo.gantikanYangMenunggu(
      tx,
      { jenis: p.jenis, idPengaju: p.pengaju.id, rujukan: p.rujukan },
      waktu,
    );
    const id = await repo.tambahPermintaan(tx, {
      jenis: p.jenis,
      idPengaju: p.pengaju.id,
      idRetur: p.rujukan.idRetur ?? null,
      idVoid: p.rujukan.idVoid ?? null,
      idPelanggan: p.rujukan.idPelanggan ?? null,
      nilai: p.nilai,
      ringkasan: p.ringkasan.slice(0, 500),
      sidik: p.sidik ?? null,
      kadaluarsaPada: kadaluarsa,
    });
    await repo.tambahKode(
      tx,
      penerima.map((a) => ({
        idPermintaan: id,
        idAtasan: a.id,
        kodeHash: hashKode(id, a.id, kode.get(a.id) ?? ''),
      })),
    );
    return id;
  });

  const judul = `BonsaiUrip: persetujuan ${LABEL[p.jenis].nama}`;
  const hasil = await Promise.all(
    penerima.map(async (a) => {
      const isi =
        `Permintaan persetujuan dari ${p.pengaju.namaPengguna} (${p.pengaju.username}).\n\n` +
        `${p.ringkasan}\n\n` +
        `Kode: ${kode.get(a.id) ?? ''}\n` +
        `Berlaku sampai pukul ${jamLokal(kadaluarsa)}, sekali pakai. Sebutkan kode ini kepada ` +
        `${p.pengaju.namaPengguna} hanya bila Anda setuju. Bila tidak setuju, abaikan pesan ini.`;
      const h = await kirimKePengguna(a, judul, isi);
      await repo.catatSaluran(db, idPermintaan, a.id, h.terkirim.join(','));
      return { nama: a.namaPengguna, saluran: h.terkirim, tiruan: h.tiruan, galat: h.galat };
    }),
  );
  const sampai = hasil.filter((h) => h.saluran.length > 0);
  if (sampai.length === 0) {
    await repo.ubahStatus(db, idPermintaan, { status: 'GAGAL', diputusPada: sekarang() });
    const sebab = [...new Set(hasil.flatMap((h) => h.galat))].join(' ');
    throw new AppError(
      'INTERNAL',
      `Kode tidak terkirim. ${sebab || 'Periksa internet server dan Pengaturan › Persetujuan.'}`,
      503,
    );
  }
  await catatLog(db, {
    aksi: 'PERSETUJUAN_KODE_KIRIM',
    idPengguna: p.pengaju.id,
    entitas: LABEL[p.jenis].entitas,
    idEntitas: p.idEntitas,
    ...(p.nomorDokumen ? { nomorDokumen: p.nomorDokumen } : {}),
    // Kodenya sendiri tidak pernah dicatat.
    ringkasan: `Kode persetujuan ${LABEL[p.jenis].nama} dikirim ke ${sampai
      .map((h) => `${h.nama} (${h.saluran.join('+').toLowerCase()})`)
      .join(', ')}`,
    ip: asal.ip,
  });
  return {
    idPermintaan,
    kadaluarsa: kadaluarsa.toISOString(),
    penerima: sampai.map((h) => ({ nama: h.nama, saluran: h.saluran })),
    simulasi: sampai.some((h) => h.tiruan.length > 0),
  };
}

type Permintaan = NonNullable<Awaited<ReturnType<typeof repo.kunciPermintaan>>>;
export type KodeSah = { atasan: Atasan; permintaan: Permintaan };

const TIDAK_BERLAKU =
  'Kode sudah tidak berlaku (kadaluarsa, sudah dipakai, atau diganti). Minta kode baru.';

/**
 * Memeriksa kode TANPA memakainya. Dipanggil sebelum transaksi dokumen, di transaksinya sendiri, supaya
 * hitungan salah ketik tetap tersimpan walau dokumennya kemudian gagal. `cocok` memastikan kode memang
 * untuk hal yang sedang dikerjakan (dokumen/pelanggan yang sama). Kode baru dianggap terpakai lewat
 * `pakaiKode()` di dalam transaksi dokumen.
 */
export async function periksaKode(
  p: {
    idPermintaan: number;
    kode: string;
    jenis: JenisKodePersetujuan;
    izin: Izin;
    pengaju: PenggunaAktif;
    cocok: (permintaan: Permintaan) => boolean;
  },
  asal: AsalRequest,
): Promise<KodeSah> {
  const hasil = await dalamTransaksi(async (tx): Promise<KodeSah | { galat: string }> => {
    const m = await repo.kunciPermintaan(tx, p.idPermintaan);
    // Pesan yang sama untuk semua sebab, agar tidak membocorkan permintaan milik orang lain.
    if (!m || m.jenis !== p.jenis || m.idPengaju !== p.pengaju.id || !p.cocok(m)) {
      return { galat: TIDAK_BERLAKU };
    }
    if (m.status !== 'MENUNGGU' || m.kadaluarsaPada <= sekarang()) return { galat: TIDAK_BERLAKU };

    const kandidat = (await repo.kodeTerkirim(tx, m.id)).filter((k) => k.saluran !== '');
    const pemilik = kandidat.find((k) =>
      timingSafeEqual(
        Buffer.from(k.kodeHash, 'hex'),
        Buffer.from(hashKode(m.id, k.idAtasan, p.kode), 'hex'),
      ),
    );
    if (!pemilik) {
      const gagal = await repo.tambahGagal(tx, m.id);
      const habis = gagal >= BATAS_SALAH;
      if (habis) await repo.ubahStatus(tx, m.id, { status: 'GAGAL', diputusPada: sekarang() });
      await catatLog(tx, {
        aksi: 'PERSETUJUAN_GAGAL',
        idPengguna: p.pengaju.id,
        entitas: LABEL[m.jenis].entitas,
        ringkasan: `Kode persetujuan ${LABEL[m.jenis].nama} salah (percobaan ${gagal} dari ${BATAS_SALAH})${habis ? '; kode dibatalkan' : ''}`,
        ip: asal.ip,
      });
      return {
        galat: habis
          ? `Kode salah ${BATAS_SALAH} kali, kode dibatalkan. Minta kode baru.`
          : `Kode salah. Sisa percobaan: ${BATAS_SALAH - gagal}.`,
      };
    }
    // Wewenang diperiksa saat kode dipakai, bukan saat dikirim: akun bisa saja dinonaktifkan sesudahnya.
    if (pemilik.statusAktif !== 'AKTIF' || !IZIN_PER_PERAN[pemilik.peran].has(p.izin)) {
      return { galat: `Akun ${pemilik.namaPengguna} tidak lagi berwenang menyetujui.` };
    }
    return {
      permintaan: m,
      atasan: {
        id: pemilik.idAtasan,
        username: pemilik.username,
        namaPengguna: pemilik.namaPengguna,
        peran: pemilik.peran,
      },
    };
  });
  // Dilempar setelah transaksi selesai, supaya hitungan gagal dan log-nya tidak ikut dibatalkan.
  if ('galat' in hasil) throw galatKolom('kode', hasil.galat);
  return hasil;
}

/** Menandai kode terpakai di dalam transaksi dokumen yang disetujuinya (sekali pakai). */
export async function pakaiKode(tx: Tx, sah: KodeSah): Promise<void> {
  const m = await repo.kunciPermintaan(tx, sah.permintaan.id);
  const waktu = sekarang();
  if (m?.status !== 'MENUNGGU' || m.kadaluarsaPada <= waktu) {
    throw new AppError('KONFLIK', TIDAK_BERLAKU, 409);
  }
  await repo.ubahStatus(tx, m.id, {
    status: 'DIPAKAI',
    idPenyetuju: sah.atasan.id,
    diputusPada: waktu,
  });
}
