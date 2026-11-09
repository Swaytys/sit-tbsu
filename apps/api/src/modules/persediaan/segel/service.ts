import {
  bandingQty,
  kaliQty,
  kelipatanAtasQty,
  kelipatanQty,
  keQty,
  kurangQty,
  rapikanDesimal,
  teksQty,
  type SegelBarang,
} from '@sit/shared';
import { and, desc, eq } from 'drizzle-orm';
import { db, type Executor } from '../../../db/client';
import {
  barang,
  barangSatuanJual,
  mutasiSegel,
  pengguna,
  persediaan,
  satuan,
} from '../../../db/schema';
import { AppError } from '../../../lib/errors';
import type { AsalRequest, PenggunaAktif } from '../../../lib/konteks';
import { dalamTransaksi } from '../../../lib/transaksi';
import { sekarang, tanggalOperasional } from '../../../lib/waktu';
import { catatLog } from '../../sistem/log-aktivitas';
import { aturSegel, kemasanSegel, kunciPersediaan } from '../ledger';

/*
 * K-227 tahap 3: kemasan tersegel per barang. Stok dicatat dua lapis (box utuh tersegel + ecer) tanpa mengubah stok
 * total. Kemasan ditandai di Data Barang; box dibuka manual di sini atau otomatis saat ecer kurang (K-246, ledger).
 */

function tidakAda(): AppError {
  return new AppError('TIDAK_DITEMUKAN', 'Barang tidak ditemukan.', 404);
}

/** Lapisan segel barang beserta 20 catatan terakhir; `null` bila barang tidak punya kemasan tersegel. */
export async function detailSegel(idBarang: number): Promise<SegelBarang | null> {
  const k = await kemasanSegel(db, idBarang);
  if (!k) return null;
  const [p] = await db
    .select({ stokFisik: persediaan.stokFisik, qtySegel: persediaan.qtySegel })
    .from(persediaan)
    .where(eq(persediaan.idBarang, idBarang));
  if (!p) throw tidakAda();
  const riwayat = await db
    .select({
      id: mutasiSegel.id,
      waktu: mutasiSegel.waktu,
      jenis: mutasiSegel.jenis,
      qtyMasuk: mutasiSegel.qtyMasuk,
      qtyKeluar: mutasiSegel.qtyKeluar,
      saldoSetelah: mutasiSegel.saldoSetelah,
      namaPengguna: pengguna.namaPengguna,
      keterangan: mutasiSegel.keterangan,
    })
    .from(mutasiSegel)
    .innerJoin(pengguna, eq(pengguna.id, mutasiSegel.idPengguna))
    .where(eq(mutasiSegel.idBarang, idBarang))
    .orderBy(desc(mutasiSegel.id))
    .limit(20);
  return {
    idSatuanJual: k.idSatuanJual,
    kodeSatuan: k.kodeSatuan,
    isi: rapikanDesimal(k.isi),
    qtySegel: p.qtySegel,
    ecer: kurangQty(p.stokFisik, kaliQty(p.qtySegel, k.isi)),
    riwayat: riwayat.map((r) => ({ ...r, waktu: r.waktu.toISOString() })),
  };
}

/**
 * Menandai satu kemasan (satuan jual aktif, isi bilangan bulat ≥ 2) sebagai tersegel, atau melepasnya (`null`). Box
 * yang tercatat pada kemasan lama dihitung sebagai ecer (tercatat KOREKSI); kemasan baru mulai dari 0 box, diisi lewat
 * penerimaan atau opname.
 */
export async function aturKemasanSegel(
  idBarang: number,
  idSatuanJual: number | null,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<SegelBarang | null> {
  await dalamTransaksi(async (tx) => {
    const [brg] = await tx
      .select({ nama: barang.namaBarang })
      .from(barang)
      .where(eq(barang.id, idBarang));
    if (!brg) throw tidakAda();
    const p = await kunciPersediaan(tx, idBarang);
    const [lama] = await tx
      .select({
        idSatuanJual: barangSatuanJual.id,
        isi: barangSatuanJual.faktorKeDasar,
        kodeSatuan: satuan.kode,
      })
      .from(barangSatuanJual)
      .innerJoin(satuan, eq(satuan.id, barangSatuanJual.idSatuan))
      .where(and(eq(barangSatuanJual.idBarang, idBarang), eq(barangSatuanJual.kemasanSegel, true)));
    if ((lama?.idSatuanJual ?? null) === idSatuanJual) return;
    let baru: { kode: string; isi: string } | null = null;
    if (idSatuanJual !== null) {
      const [sj] = await tx
        .select({
          isi: barangSatuanJual.faktorKeDasar,
          statusAktif: barangSatuanJual.statusAktif,
          kode: satuan.kode,
        })
        .from(barangSatuanJual)
        .innerJoin(satuan, eq(satuan.id, barangSatuanJual.idSatuan))
        .where(and(eq(barangSatuanJual.id, idSatuanJual), eq(barangSatuanJual.idBarang, idBarang)));
      if (sj?.statusAktif !== 'AKTIF') {
        throw new AppError('VALIDASI', 'Pilih kemasan (satuan jual) aktif milik barang ini.', 400);
      }
      if (bandingQty(sj.isi, kelipatanQty(sj.isi, 1)) !== 0 || bandingQty(sj.isi, 2) < 0) {
        throw new AppError(
          'VALIDASI',
          `Kemasan tersegel harus berisi bilangan bulat minimal 2 (isi ${sj.kode} sekarang ${rapikanDesimal(sj.isi)}).`,
          400,
        );
      }
      baru = { kode: sj.kode, isi: sj.isi };
    }
    if (lama && bandingQty(p.qtySegel, 0) > 0) {
      await aturSegel(tx, {
        idBarang,
        jenis: 'KOREKSI',
        saldoBaru: 0,
        kemasan: lama,
        idPengguna: pelaku.id,
        tanggalOperasional: tanggalOperasional(),
        keterangan: `Kemasan ${lama.kodeSatuan} tidak lagi tersegel: ${teksQty(p.qtySegel)} box dihitung ecer`,
      });
    }
    await tx
      .update(barangSatuanJual)
      .set({ kemasanSegel: false, diubahPada: sekarang() })
      .where(and(eq(barangSatuanJual.idBarang, idBarang), eq(barangSatuanJual.kemasanSegel, true)));
    if (idSatuanJual !== null) {
      await tx
        .update(barangSatuanJual)
        .set({ kemasanSegel: true, diubahPada: sekarang() })
        .where(eq(barangSatuanJual.id, idSatuanJual));
    }
    await catatLog(tx, {
      aksi: 'SEGEL_ATUR',
      idPengguna: pelaku.id,
      entitas: 'barang',
      idEntitas: idBarang,
      ringkasan: baru
        ? `Kemasan tersegel ${brg.nama}: ${baru.kode} isi ${rapikanDesimal(baru.isi)}`
        : `Kemasan tersegel ${brg.nama} dilepas`,
      ip: asal.ip,
    });
  });
  return detailSegel(idBarang);
}

/** Buka N box segel menjadi ecer (stok total tetap), dengan alasan; tercatat siapa dan kapan. */
export async function bukaSegel(
  idBarang: number,
  jumlah: number,
  alasan: string,
  pelaku: PenggunaAktif,
  asal: AsalRequest,
): Promise<SegelBarang | null> {
  await dalamTransaksi(async (tx) => {
    const [brg] = await tx
      .select({ nama: barang.namaBarang })
      .from(barang)
      .where(eq(barang.id, idBarang));
    if (!brg) throw tidakAda();
    const p = await kunciPersediaan(tx, idBarang);
    const k = await kemasanSegel(tx, idBarang);
    if (!k) throw new AppError('VALIDASI', `${brg.nama} tidak punya kemasan tersegel.`, 400);
    const ada = kelipatanQty(p.qtySegel, 1);
    if (jumlah > ada) {
      throw new AppError(
        'KONFLIK',
        `Box ${k.kodeSatuan} segel ${brg.nama} hanya ${ada}; tidak bisa membuka ${jumlah}.`,
        409,
      );
    }
    await aturSegel(tx, {
      idBarang,
      jenis: 'BUKA',
      saldoBaru: ada - jumlah,
      idPengguna: pelaku.id,
      tanggalOperasional: tanggalOperasional(),
      keterangan: `Buka kemasan: ${alasan}`,
    });
    await catatLog(tx, {
      aksi: 'SEGEL_BUKA',
      idPengguna: pelaku.id,
      entitas: 'barang',
      idEntitas: idBarang,
      ringkasan: `Buka ${jumlah} ${k.kodeSatuan} segel ${brg.nama} (isi ${keQty(
        kaliQty(jumlah, k.isi),
      )} jadi ecer): ${alasan}`.slice(0, 1000),
      ip: asal.ip,
    });
  });
  return detailSegel(idBarang);
}

/**
 * K-246: perkiraan box segel yang dibuka otomatis bila keranjang dibayar sekarang (aturan sama dengan ledger:
 * baris per kemasan tersegel mengambil box dulu; sisa box × isi tidak boleh melebihi stok sesudah jual). Hasil per
 * indeks baris ecer pertama barang itu. Hanya perkiraan untuk pemberitahuan; yang tercatat ditentukan saat bayar.
 */
export async function perkiraanBukaSegel(
  ex: Executor,
  baris: { idBarang: number; idSatuanJual: number | null; qty: string; qtyDasar: string }[],
): Promise<Map<number, { jumlah: number; kodeSatuan: string }>> {
  const hasil = new Map<number, { jumlah: number; kodeSatuan: string }>();
  const idBarang = [...new Set(baris.map((b) => b.idBarang))];
  for (const id of idBarang) {
    const k = await kemasanSegel(ex, id);
    if (!k) continue;
    const [p] = await ex
      .select({ stokFisik: persediaan.stokFisik, qtySegel: persediaan.qtySegel })
      .from(persediaan)
      .where(eq(persediaan.idBarang, id));
    if (!p || bandingQty(p.qtySegel, 0) <= 0) continue;
    let segel = kelipatanQty(p.qtySegel, 1);
    let stok = p.stokFisik;
    let ecerPertama: number | null = null;
    baris.forEach((b, i) => {
      if (b.idBarang !== id) return;
      if (b.idSatuanJual === k.idSatuanJual) {
        segel -= Math.min(segel, kelipatanQty(b.qty, 1));
      } else if (ecerPertama === null) {
        ecerPertama = i;
      }
      stok = kurangQty(stok, b.qtyDasar);
    });
    const lebih = kurangQty(kaliQty(segel, k.isi), stok);
    if (ecerPertama === null || bandingQty(lebih, 0) <= 0 || bandingQty(stok, 0) < 0) continue;
    hasil.set(ecerPertama, {
      jumlah: Math.min(segel, kelipatanAtasQty(lebih, k.isi)),
      kodeSatuan: k.kodeSatuan,
    });
  }
  return hasil;
}
