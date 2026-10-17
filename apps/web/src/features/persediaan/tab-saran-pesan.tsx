import {
  formatRupiah,
  LABEL_STATUS_SARAN_PESAN,
  type BarisSaranPesan,
  type StatusSaranPesan,
} from '@sit/shared';
import { FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useDaftarPemasok } from '@/api/mitra';
import { useSaranPesan, type SaringSaranPesan } from '@/api/persediaan';
import { useDaftarKategori } from '@/api/referensi';
import { ButirPenjelasan, Penjelasan } from '@/components/penjelasan';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { pesanGalat } from '@/api/client';
import { formatDesimal, formatTanggal } from '@/lib/format';
import { useTunda } from '@/lib/use-tunda';
import { cn } from '@/lib/utils';

const WARNA: Record<StatusSaranPesan, string> = {
  PESAN_SEKARANG: 'border-red-300 bg-red-50 text-red-800',
  SEGERA: 'border-amber-300 bg-amber-50 text-amber-900',
  AMAN: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  TIDAK_LAKU: 'border-slate-300 bg-slate-50 text-slate-700',
};

const KET: Record<StatusSaranPesan, string> = {
  PESAN_SEKARANG: 'stok tersedia sudah di titik pesan ulang',
  SEGERA: 'akan habis sebelum belanja berikutnya tiba',
  AMAN: 'cukup sampai belanja berikutnya',
  TIDAK_LAKU: 'tidak terjual selama periode',
};

const KELAS_PILIH = 'h-9 rounded-md border bg-white px-2 text-sm';

/**
 * Stok Persediaan › Saran Pesan (K-113, docs/05 §17): barang yang perlu dibeli ulang dan berapa banyak, dikelompokkan
 * per pemasok pembelian terakhir. Semua angka dari server; layar hanya menampilkan dan menyaring.
 */
export function TabSaranPesan() {
  const [p, setP] = useState<SaringSaranPesan>({ tampil: 'PERLU' });
  const [kata, setKata] = useState('');
  const cari = useTunda(kata, 300);
  const q = useSaranPesan({ ...p, cari: cari || undefined });
  const pemasok =
    useDaftarPemasok({ cari: '', status: 'AKTIF', halaman: 1, perHalaman: 100 }).data?.data ?? [];
  const kategori = useDaftarKategori('AKTIF').data ?? [];
  const h = q.data;

  const kelompok = new Map<string, { nama: string; baris: BarisSaranPesan[] }>();
  for (const b of h?.baris ?? []) {
    const k = String(b.idPemasok ?? 0);
    const g = kelompok.get(k) ?? { nama: b.namaPemasok ?? 'Belum pernah dibeli', baris: [] };
    g.baris.push(b);
    kelompok.set(k, g);
  }
  const grup = [...kelompok.entries()].sort((a, b) => a[1].nama.localeCompare(b[1].nama, 'id'));
  const biayaPemasok = new Map(
    (h?.perPemasok ?? []).map((x) => [String(x.idPemasok ?? 0), x.perkiraanBiaya]),
  );
  const totalBiaya = (h?.perPemasok ?? []).reduce((t, x) => t + (x.perkiraanBiaya ?? 0), 0);
  const adaBiaya = (h?.perPemasok ?? []).some((x) => x.perkiraanBiaya !== undefined);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-80 text-sm text-slate-600">
          <p>
            Saran berapa banyak barang dibeli ulang, dihitung dari rata-rata penjualan dan lama
            kirim pemasok. Gunakan sebagai bahan keputusan belanja; angka akhirnya tetap keputusan
            Anda.
          </p>
          {h && (
            <p className="text-xs text-slate-500">
              Penjualan diamati {formatTanggal(h.parameter.dari)} s.d.{' '}
              {formatTanggal(h.parameter.sampai)} ({h.parameter.periodeHari} hari, sampai kemarin) ·
              stok pengaman {h.parameter.hariPengaman} hari · bawaan pemasok: kirim{' '}
              {h.parameter.lamaKirimBawaan} hari, belanja tiap {h.parameter.jarakBelanjaBawaan}{' '}
              hari.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/laporan?laporan=rekomendasi-pesan"
            className="flex h-9 items-center gap-1.5 rounded-md border bg-white px-3 text-sm hover:bg-slate-50"
          >
            <FileSpreadsheet className="size-4" /> Cetak / Excel
          </Link>
          <PenjelasanSaran />
        </div>
      </div>

      {h && (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {(['PESAN_SEKARANG', 'SEGERA', 'AMAN', 'TIDAK_LAKU'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setP((x) => ({ ...x, tampil: x.tampil === s ? 'PERLU' : s }))}
              aria-pressed={p.tampil === s}
              className={cn(
                'rounded-lg border px-3 py-2 text-left',
                WARNA[s],
                p.tampil === s && 'ring-2 ring-blue-500',
              )}
            >
              <p className="text-xs font-medium">{LABEL_STATUS_SARAN_PESAN[s]}</p>
              <p className="text-2xl font-bold tabular-nums">{h.jumlah[s]}</p>
              <p className="text-xs opacity-80">{KET[s]}</p>
            </button>
          ))}
        </div>
      )}

      <Card className="flex flex-row flex-wrap items-end gap-2 p-3">
        <label className="grid gap-1 text-xs text-slate-600">
          Tampilkan
          <select
            className={KELAS_PILIH}
            aria-label="Tampilkan"
            value={p.tampil}
            onChange={(e) =>
              setP((x) => ({ ...x, tampil: e.target.value as SaringSaranPesan['tampil'] }))
            }
          >
            <option value="PERLU">Yang perlu dipesan</option>
            <option value="PESAN_SEKARANG">Pesan sekarang</option>
            <option value="SEGERA">Segera pesan</option>
            <option value="AMAN">Aman</option>
            <option value="TIDAK_LAKU">Tidak laku</option>
            <option value="SEMUA">Semua barang</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs text-slate-600">
          Pemasok
          <select
            className={cn(KELAS_PILIH, 'max-w-56')}
            aria-label="Pemasok"
            value={p.idPemasok ?? ''}
            onChange={(e) =>
              setP((x) => ({
                ...x,
                idPemasok: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
          >
            <option value="">Semua pemasok</option>
            {pemasok.map((x) => (
              <option key={x.id} value={x.id}>
                {x.namaPemasok}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-slate-600">
          Kategori
          <select
            className={cn(KELAS_PILIH, 'max-w-48')}
            aria-label="Kategori"
            value={p.idKategori ?? ''}
            onChange={(e) =>
              setP((x) => ({
                ...x,
                idKategori: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
          >
            <option value="">Semua kategori</option>
            {kategori.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nama}
              </option>
            ))}
          </select>
        </label>
        <label className="grid min-w-48 flex-1 gap-1 text-xs text-slate-600">
          Cari barang
          <Input
            value={kata}
            onChange={(e) => setKata(e.target.value)}
            placeholder="Nama atau kode barang"
            className="h-9"
          />
        </label>
        {adaBiaya && (
          <p className="ml-auto text-sm">
            Perkiraan belanja: <b className="tabular-nums">{formatRupiah(totalBiaya)}</b>
          </p>
        )}
      </Card>

      {q.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : q.isError ? (
        <Card className="p-6 text-sm text-red-600">{pesanGalat(q.error)}</Card>
      ) : grup.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-500">
          {p.tampil === 'PERLU'
            ? 'Tidak ada barang yang perlu dipesan saat ini.'
            : 'Tidak ada barang yang cocok dengan saringan.'}
        </Card>
      ) : (
        grup.map(([k, g]) => (
          <Card key={k} className="gap-0 overflow-hidden p-0" data-testid="grup-saran-pesan">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b bg-slate-50 px-4 py-2">
              <p className="font-semibold text-slate-900">
                {g.nama}{' '}
                <span className="text-xs font-normal text-slate-500">
                  kirim {g.baris[0]?.lamaKirimHari} hari · belanja tiap{' '}
                  {g.baris[0]?.jarakBelanjaHari} hari
                </span>
              </p>
              <p className="text-sm text-slate-600">
                {g.baris.length} barang
                {biayaPemasok.get(k) !== undefined && (
                  <>
                    {' '}
                    · perkiraan{' '}
                    <b className="tabular-nums">{formatRupiah(biayaPemasok.get(k) ?? 0)}</b>
                  </>
                )}
              </p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="px-4 py-2 font-medium">Barang</th>
                  <th className="px-2 py-2 text-right font-medium">Terjual · rata/hari</th>
                  <th className="px-2 py-2 text-right font-medium">Tersedia · cukup</th>
                  <th className="px-2 py-2 text-right font-medium">Titik pesan</th>
                  <th className="px-2 py-2 text-right font-medium">Saran pesan</th>
                  {adaBiaya && <th className="px-2 py-2 text-right font-medium">Perkiraan</th>}
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {g.baris.map((b) => (
                  <tr key={b.idBarang} className="align-top">
                    <td className="px-4 py-2">
                      <p className="font-medium text-slate-900">{b.namaBarang}</p>
                      <p className="text-xs text-slate-500">
                        <span className="font-mono">{b.kode}</span> · {b.namaKategori}
                      </p>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {formatDesimal(b.terjual)} {b.kodeSatuan}
                      <p className="text-xs text-slate-500">
                        {formatDesimal(b.rataPerHari)}/hari · {b.hariAmatan} hari
                      </p>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {formatDesimal(b.stokTersedia)} {b.kodeSatuan}
                      <p className="text-xs text-slate-500">
                        {b.hariCukup === null ? '—' : `cukup ±${formatDesimal(b.hariCukup)} hari`}
                      </p>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {formatDesimal(b.titikPesan)}
                      <p className="text-xs text-slate-500">min. {formatDesimal(b.stokMinimum)}</p>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      <b className="text-base">{formatDesimal(b.saranPesan)}</b> {b.kodeSatuan}
                      {b.saranKemasan && (
                        <p className="text-xs text-slate-500">≈ {b.saranKemasan}</p>
                      )}
                    </td>
                    {adaBiaya && (
                      <td className="px-2 py-2 text-right tabular-nums">
                        {b.perkiraanBiaya ? formatRupiah(b.perkiraanBiaya) : '—'}
                      </td>
                    )}
                    <td className="px-4 py-2">
                      <span
                        className={cn(
                          'inline-block rounded border px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
                          WARNA[b.status],
                        )}
                        title={KET[b.status]}
                      >
                        {LABEL_STATUS_SARAN_PESAN[b.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ))
      )}
    </div>
  );
}

function PenjelasanSaran() {
  return (
    <Penjelasan judul="Cara sistem menghitung saran pesan">
      <ButirPenjelasan>
        <li>
          <b>Rata-rata jual per hari</b> = jumlah terjual bersih (penjualan dikurangi retur dan
          void) selama periode pengamatan ÷ jumlah hari. Periode berakhir <i>kemarin</i>, supaya
          penjualan hari ini yang belum selesai tidak menurunkan rata-rata. Barang yang baru
          dimiliki kurang dari periode diamati sejak stok pertamanya masuk.
        </li>
        <li>
          <b>Stok pengaman</b> = rata-rata × hari pengaman (Pengaturan › Operasional). Ini cadangan
          bila penjualan sedang ramai atau kiriman terlambat.
        </li>
        <li>
          <b>Titik pesan</b> = rata-rata × lama kirim + stok pengaman. Bila stok tersedia sudah
          sebanyak ini atau kurang, barang harus dipesan <b>sekarang</b> supaya tidak habis sebelum
          kiriman tiba.
        </li>
        <li>
          <b>Saran pesan</b> = rata-rata × (lama kirim + jarak belanja) + stok pengaman − stok
          tersedia, dibulatkan ke atas. Artinya: cukup untuk menunggu kiriman ini <i>dan</i> sampai
          belanja berikutnya tiba. Bila barang punya kemasan (mis. dus), jumlah kemasannya ikut
          ditulis.
        </li>
        <li>
          <b>Lama kirim</b> dan <b>jarak belanja</b> diambil dari Data Pemasok (pemasok pembelian
          terakhir barang itu). Bila kosong, dipakai nilai bawaan di Pengaturan › Operasional.
        </li>
        <li>
          <b>Contoh:</b> semen terjual 240 sak dalam 30 hari → 8 sak/hari. Pemasok mengirim 3 hari
          setelah dipesan, toko belanja tiap 7 hari, stok pengaman 2 hari (16 sak). Titik pesan = 8
          × 3 + 16 = 40 sak. Stok tersedia 40 sak → <b>Pesan sekarang</b>, saran = 8 × (3 + 7) + 16
          − 40 = <b>56 sak</b>.
        </li>
        <li>
          <b>Status:</b> Pesan sekarang (stok ≤ titik pesan) · Segera pesan (stok belum cukup sampai
          belanja berikutnya) · Aman · Tidak laku (tidak terjual selama periode; modal tertahan).
        </li>
        <li>
          Barang titipan (konsinyasi) tidak dihitung karena diisi penitipnya. Perkiraan biaya =
          saran × harga beli terakhir, hanya terlihat oleh yang boleh melihat harga modal.
        </li>
      </ButirPenjelasan>
    </Penjelasan>
  );
}
