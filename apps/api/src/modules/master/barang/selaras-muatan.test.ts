import type { DetailBarang } from '@sit/shared';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { siapkanMasterPersediaan } from '../../../../test/fixtur-persediaan';
import { json, minta, sesiUji, siapkanDatabaseSistem } from '../../../../test/pembantu';
import { kosongkanTabel } from '../../../../test/reset';
import { db } from '../../../db/client';
import { isiDataAwal } from '../../../db/data-awal';
import {
  barang,
  hargaBarang,
  jenisAtribut,
  kategori,
  satuan,
  tingkatHarga,
} from '../../../db/schema';
import { invalidasiKonfigurasi } from '../../sistem/konfigurasi/service';

type Sesi = Awaited<ReturnType<typeof sesiUji>>;
let admin: Sesi;
let idKat: number;
let id: Record<string, number>;

beforeEach(async () => {
  await siapkanDatabaseSistem();
  await siapkanMasterPersediaan();
  await kosongkanTabel(hargaBarang, barang, kategori, satuan, jenisAtribut, tingkatHarga);
  await isiDataAwal(db, { passwordOwner: null, akunDemo: false });
  invalidasiKonfigurasi();
  admin = await sesiUji('ADMIN');
  idKat = (await db.select().from(kategori).where(eq(kategori.nama, 'Cat & Pelapis')))[0]!.id;
  const s = await db.select().from(satuan);
  const j = await db.select().from(jenisAtribut);
  id = {
    ...Object.fromEntries(s.map((x) => [`s_${x.kode}`, x.id])),
    ...Object.fromEntries(j.map((x) => [`j_${x.kode}`, x.id])),
  };
});

const tambah = (isi: Record<string, unknown>) =>
  minta('/api/barang', {
    method: 'POST',
    cookie: admin.cookie,
    body: {
      namaBarang: `Cat Uji ${Math.random()}`,
      idKategori: idKat,
      idSatuanDasar: id.s_pail,
      hargaModalAwal: 90000,
      abaikanMirip: true,
      ...isi,
    },
  });

describe('atribut dimensi ↔ data muatan satu sumber (K-169)', () => {
  it('data muatan saja → atribut Panjang/Lebar/Tinggi/Berat terisi otomatis', async () => {
    const r = await tambah({
      atribut: [],
      muatan: { beratKg: '5,5', panjangCm: '22', lebarCm: '22', tinggiCm: '20' },
    });
    expect(r.status).toBe(201);
    const b = (await json<{ data: DetailBarang }>(r)).data;
    const kode = (idJenis: number) =>
      Object.entries(id).find(([k, v]) => k.startsWith('j_') && v === idJenis)?.[0];
    const atr = Object.fromEntries(b.atribut.map((a) => [kode(a.idJenisAtribut) ?? '?', a.nilai]));
    expect(atr).toMatchObject({ j_PANJANG: '22', j_LEBAR: '22', j_TINGGI: '20', j_BERAT: '5.5' });
  });

  it('atribut saja (satuan apa pun) → data muatan terisi dalam kg dan cm', async () => {
    const r = await tambah({
      atribut: [
        { idJenisAtribut: id.j_PANJANG, nilai: '0,22', idSatuan: id.s_m },
        { idJenisAtribut: id.j_LEBAR, nilai: '220', idSatuan: id.s_mm },
        { idJenisAtribut: id.j_TINGGI, nilai: '20', idSatuan: id.s_cm },
        { idJenisAtribut: id.j_BERAT, nilai: '5500', idSatuan: id.s_g },
      ],
    });
    expect(r.status).toBe(201);
    const b = (await json<{ data: DetailBarang }>(r)).data;
    expect(b.muatan).toMatchObject({
      beratKg: '5.5',
      panjangCm: '22',
      lebarCm: '22',
      tinggiCm: '20',
    });
  });

  it('atribut dan data muatan berbeda → ditolak; sama setelah konversi → diterima', async () => {
    const beda = await tambah({
      atribut: [{ idJenisAtribut: id.j_BERAT, nilai: '6', idSatuan: id.s_kg }],
      muatan: { beratKg: '5,5', panjangCm: null, lebarCm: null, tinggiCm: null },
    });
    expect(beda.status).toBe(400);
    expect((await json<{ error: { pesan: string } }>(beda)).error.pesan).toContain(
      'Berat di atribut (6 kg) berbeda dengan data muatan (5.5 kg)',
    );
    const sama = await tambah({
      atribut: [{ idJenisAtribut: id.j_BERAT, nilai: '5500', idSatuan: id.s_g }],
      muatan: { beratKg: '5,5', panjangCm: null, lebarCm: null, tinggiCm: null },
    });
    expect(sama.status).toBe(201);
  });

  it('barang tidak curah: volume isi (liter) tetap atribut produk, bukan volume muatan', async () => {
    const r = await tambah({
      atribut: [{ idJenisAtribut: id.j_VOLUME, nilai: '5', idSatuan: id.s_L }],
      muatan: { beratKg: null, panjangCm: '22', lebarCm: '22', tinggiCm: '20' },
    });
    expect(r.status).toBe(201);
    const b = (await json<{ data: DetailBarang }>(r)).data;
    expect(b.muatan.volumeM3).toBeNull();
  });
});
