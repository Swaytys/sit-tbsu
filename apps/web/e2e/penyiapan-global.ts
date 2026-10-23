import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request, type APIRequestContext, type FullConfig } from '@playwright/test';
import { CATATAN_UJI_E2E } from './pembantu';

/*
 * Penyiapan sebelum seluruh tes e2e (K-106). Tes berjalan di database pengembangan dan menghitung dengan
 * harga tier dasar; tier lain yang sedang diaktifkan pemilik (mis. "Harga 23%" mulai belanja Rp 500.000)
 * mengubah total dan menggagalkan tes yang tidak ada hubungannya. Karena itu tier selain tier dasar
 * dinonaktifkan selama tes berjalan, lalu diaktifkan kembali sesudahnya.
 *
 * Selain itu shift demo dari hari sebelumnya yang belum ditutup ditutup lebih dulu (lihat
 * `tutupShiftTerlewat`).
 *
 * Daftar tier yang dinonaktifkan disimpan di berkas sementara. Bila tes terhenti paksa (mis. kehabisan
 * memori) sehingga pemulihan tidak sempat jalan, penyiapan berikutnya memulihkannya lebih dulu.
 */

const BERKAS = join(tmpdir(), 'tbsu-e2e-tier-dinonaktifkan.json');

type Tier = { id: number; nama: string; isDefault: boolean; statusAktif: string };

async function masukAdmin(baseURL: string): Promise<APIRequestContext> {
  const api = await request.newContext({ baseURL, extraHTTPHeaders: { origin: baseURL } });
  const res = await api.post('/api/auth/masuk-cepat', { data: { peran: 'ADMIN' } });
  if (!res.ok()) {
    throw new Error(
      `Penyiapan e2e: masuk cepat Admin gagal (${res.status()}). Pastikan server pengembangan berjalan di ${baseURL} dan pnpm db:seed sudah dijalankan.`,
    );
  }
  return api;
}

async function aturStatus(api: APIRequestContext, id: number, statusAktif: 'AKTIF' | 'NONAKTIF') {
  const res = await api.patch(`/api/tingkat-harga/${id}/status`, { data: { statusAktif } });
  if (!res.ok()) {
    throw new Error(`Penyiapan e2e: tier ${id} → ${statusAktif} gagal: ${await res.text()}`);
  }
}

async function pulihkan(api: APIRequestContext): Promise<void> {
  if (!existsSync(BERKAS)) return;
  const id = JSON.parse(readFileSync(BERKAS, 'utf8')) as number[];
  for (const x of id) await aturStatus(api, x, 'AKTIF');
  rmSync(BERKAS);
}

type ShiftTerbuka = { id: number; nomor: string; waktu: { terlewat: boolean } | null };

/**
 * K-109: shift dari hari sebelumnya yang belum ditutup mengunci penjualan pemiliknya, sehingga akun demo
 * yang shiftnya tertinggal terbuka (dari tes atau percobaan kemarin) tidak bisa menjual. Shift seperti itu
 * ditutup di sini oleh Admin dengan uang fisik = saldo sistem (selisih 0) dan keterangan yang jelas. Begitu juga
 * shift ganda sisa aturan lama (K-132).
 */
async function tutupShiftTerlewat(api: APIRequestContext): Promise<void> {
  const res = await api.get('/api/shift?perluDitutup=true&perHalaman=100');
  const daftar = ((await res.json()) as { data: ShiftTerbuka[] }).data;
  // K-132: sisa shift ganda dari aturan lama (satu shift per pengguna) ikut ditutup; yang paling lama dibuka
  // tetap menjadi shift toko.
  const aktif = (await (await api.get('/api/shift/aktif')).json()) as {
    data: { lainTerbuka: { id: number; nomor: string }[] } | null;
  };
  const ganda = (aktif.data?.lainTerbuka ?? []).map((x) => ({ ...x, waktu: { terlewat: true } }));
  for (const s of [...daftar.filter((x) => x.waktu?.terlewat), ...ganda]) {
    const d = (await (await api.get(`/api/shift/${s.id}`)).json()) as {
      data: { ringkasan: { saldoSistem: number } | null };
    };
    const tutup = await api.post(`/api/shift/${s.id}/tutup`, {
      data: {
        uangFisik: d.data.ringkasan?.saldoSistem ?? 0,
        keterangan: 'Shift terlewat ditutup otomatis oleh penyiapan tes e2e',
      },
    });
    if (!tutup.ok()) {
      throw new Error(`Penyiapan e2e: shift ${s.nomor} gagal ditutup: ${await tutup.text()}`);
    }
  }
}

/**
 * K-111: pembayaran transfer/EDC/QRIS yang dibuat tes berstatus "Belum dicek" dan akan menumpuk di lonceng
 * notifikasi Admin/Owner. Yang dicatat selama tes ini berjalan ditandai "Sudah masuk" dengan catatan jelas,
 * begitu juga yang ditandai "Tidak masuk" oleh tes; pembayaran lain (percobaan pemilik) tidak disentuh.
 */
async function rapikanNonTunai(api: APIRequestContext, mulai: number): Promise<void> {
  type Baris = { id: number; tanggal: string; catatanVerifikasi: string | null };
  const ambil = async (status: string): Promise<Baris[]> => {
    const res = await api.get(`/api/pembayaran-nontunai?status=${status}&perHalaman=100`);
    return res.ok() ? ((await res.json()) as { data: Baris[] }).data : [];
  };
  const belumDicek = (await ambil('BELUM_DICEK')).filter((x) => Date.parse(x.tanggal) >= mulai);
  // Tanda "Tidak masuk" buatan tes dikenali dari catatannya sendiri, kapan pun dibuatnya.
  const tidakMasuk = (await ambil('TIDAK_MASUK')).filter((x) =>
    x.catatanVerifikasi?.endsWith(CATATAN_UJI_E2E),
  );
  for (const p of [...belumDicek, ...tidakMasuk]) {
    await api.post(`/api/pembayaran-nontunai/${p.id}/verifikasi`, {
      data: { status: 'SUDAH_MASUK', catatan: 'Pembayaran uji dari tes e2e' },
    });
  }
}

/**
 * K-154: non-tunai hanya ke rekening penerimaan terdaftar. Tes kasir memakai Transfer/EDC/QRIS, jadi tiap jenis
 * dipastikan punya satu rekening AKTIF (dibuat "E2E …" bila belum ada; data milik toko tidak diubah).
 */
async function pastikanRekening(api: APIRequestContext): Promise<void> {
  const res = await api.get('/api/rekening?status=AKTIF');
  const ada = ((await res.json()) as { data: { jenis: string }[] }).data;
  for (const jenis of ['TRANSFER', 'EDC', 'QRIS'] as const) {
    if (ada.some((r) => r.jenis === jenis)) continue;
    const r = await api.post('/api/rekening', {
      data: {
        jenis,
        bank: `E2E ${jenis}`,
        nomor: jenis === 'TRANSFER' ? '0001' : null,
        isDefault: true,
      },
    });
    if (!r.ok()) throw new Error(`Penyiapan e2e: rekening ${jenis} gagal: ${await r.text()}`);
  }
}

export default async function penyiapanGlobal(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL ?? 'http://localhost:5173';
  const api = await masukAdmin(baseURL);
  await pulihkan(api); // sisa penyiapan yang tidak sempat dipulihkan
  await tutupShiftTerlewat(api);
  await pastikanRekening(api);
  const res = await api.get('/api/tingkat-harga');
  const tier = ((await res.json()) as { data: Tier[] }).data;
  const dimatikan = tier.filter((t) => !t.isDefault && t.statusAktif === 'AKTIF');
  if (dimatikan.length > 0) {
    writeFileSync(BERKAS, JSON.stringify(dimatikan.map((t) => t.id)));
    for (const t of dimatikan) await aturStatus(api, t.id, 'NONAKTIF');
  }
  await api.dispose();

  const mulai = Date.now();

  // Nilai kembalian = pemulihan setelah semua tes selesai.
  return async () => {
    const lagi = await masukAdmin(baseURL);
    await pulihkan(lagi);
    await rapikanNonTunai(lagi, mulai);
    await lagi.dispose();
  };
}
