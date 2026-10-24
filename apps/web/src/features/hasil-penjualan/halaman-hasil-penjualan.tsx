import {
  akhirBulan,
  dariNomorHari,
  formatRupiah,
  LABEL_JENIS_PENJUALAN,
  nomorHari,
  type BarisNilai,
  type HasilPenjualanHalaman,
  type KelasAbc,
  type RingkasanHasilPenjualan,
} from '@sit/shared';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { pesanGalat } from '@/api/client';
import { useHasilPenjualan } from '@/api/laporan';
import { ButirPenjelasan, Penjelasan } from '@/components/penjelasan';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDesimal, formatTanggal, tanggalHariIni } from '@/lib/format';
import { cn } from '@/lib/utils';

/*
 * K-126 Hasil Penjualan: kinerja penjualan satu periode tanpa membuka Laporan. Semua angka dari server
 * (definisi sama dengan laporan); layar hanya menampilkan. Laba hanya tampil bila server mengirimnya.
 */

type Periode = { dari: string; sampai: string };

function preset(): { kunci: string; label: string; p: Periode }[] {
  const hari = tanggalHariIni();
  const n = nomorHari(hari);
  const awalBulan = `${hari.slice(0, 8)}01`;
  const akhirBulanLalu = dariNomorHari(nomorHari(awalBulan) - 1);
  return [
    { kunci: 'hari', label: 'Hari ini', p: { dari: hari, sampai: hari } },
    {
      kunci: 'kemarin',
      label: 'Kemarin',
      p: { dari: dariNomorHari(n - 1), sampai: dariNomorHari(n - 1) },
    },
    { kunci: '7', label: '7 hari', p: { dari: dariNomorHari(n - 6), sampai: hari } },
    { kunci: '30', label: '30 hari', p: { dari: dariNomorHari(n - 29), sampai: hari } },
    { kunci: 'bulan', label: 'Bulan ini', p: { dari: awalBulan, sampai: hari } },
    {
      kunci: 'bulan-lalu',
      label: 'Bulan lalu',
      p: { dari: `${akhirBulanLalu.slice(0, 8)}01`, sampai: akhirBulan(akhirBulanLalu) },
    },
    { kunci: 'tahun', label: 'Tahun ini', p: { dari: `${hari.slice(0, 4)}-01-01`, sampai: hari } },
  ];
}

function Perubahan({ kini, lalu }: { kini: number; lalu: number }) {
  if (lalu === 0) return <span className="text-xs text-slate-400">periode lalu 0</span>;
  // Persen tampilan saja (bukan nilai simpan): dibulatkan 1 desimal.
  const persen = Math.round(((kini - lalu) / Math.abs(lalu)) * 1000) / 10;
  return (
    <span
      className={cn(
        'text-xs font-semibold',
        persen > 0 ? 'text-emerald-700' : persen < 0 ? 'text-red-700' : 'text-slate-500',
      )}
    >
      {persen > 0 ? '▲' : persen < 0 ? '▼' : '='} {Math.abs(persen).toLocaleString('id-ID')}% dari
      periode lalu
    </span>
  );
}

function KartuAngka({
  judul,
  nilai,
  bawah,
  className,
}: {
  judul: string;
  nilai: ReactNode;
  bawah?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('gap-1 p-3', className)}>
      <p className="text-xs font-medium text-slate-500">{judul}</p>
      <p className="text-xl font-bold whitespace-nowrap text-slate-900 tabular-nums">{nilai}</p>
      {bawah && <div>{bawah}</div>}
    </Card>
  );
}

/** Daftar batang mendatar: panjang batang = nilai ÷ nilai terbesar. */
function Batang({
  baris,
  kosong = 'Belum ada data.',
  teksJumlah = 'trx',
}: {
  baris: BarisNilai[];
  kosong?: string;
  teksJumlah?: string;
}) {
  const maks = Math.max(0, ...baris.map((b) => b.nilai));
  if (baris.every((b) => b.nilai === 0 && b.jumlah === 0)) {
    return <p className="py-4 text-center text-sm text-slate-500">{kosong}</p>;
  }
  return (
    <ul className="space-y-1.5">
      {baris.map((b) => (
        <li
          key={b.kunci}
          className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2 text-sm"
        >
          <span className="truncate text-slate-700" title={b.label}>
            {b.label}
          </span>
          <span className="h-3 rounded bg-slate-100">
            <span
              className="block h-3 rounded bg-blue-600"
              style={{ width: `${maks > 0 ? (b.nilai / maks) * 100 : 0}%` }}
            />
          </span>
          <span className="text-right text-xs whitespace-nowrap text-slate-600 tabular-nums">
            <b className="text-slate-900">{formatRupiah(b.nilai)}</b> · {b.jumlah} {teksJumlah}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Bagian({
  judul,
  children,
  kanan,
}: {
  judul: string;
  children: ReactNode;
  kanan?: ReactNode;
}) {
  return (
    <Card className="gap-3 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-800">{judul}</h2>
        {kanan}
      </div>
      {children}
    </Card>
  );
}

const WARNA_KELAS: Record<KelasAbc, string> = {
  A: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  B: 'border-amber-300 bg-amber-50 text-amber-800',
  C: 'border-slate-300 bg-slate-50 text-slate-600',
};

function Ringkasan({ r, lalu }: { r: RingkasanHasilPenjualan; lalu: RingkasanHasilPenjualan }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3" data-testid="ringkasan-hasil">
      <KartuAngka
        judul="Omzet"
        nilai={formatRupiah(r.omzet)}
        bawah={<Perubahan kini={r.omzet} lalu={lalu.omzet} />}
      />
      <KartuAngka
        judul="Jumlah transaksi"
        nilai={r.jumlahTransaksi.toLocaleString('id-ID')}
        bawah={<Perubahan kini={r.jumlahTransaksi} lalu={lalu.jumlahTransaksi} />}
      />
      <KartuAngka
        judul="Rata-rata per transaksi"
        nilai={formatRupiah(r.rataTransaksi)}
        bawah={<Perubahan kini={r.rataTransaksi} lalu={lalu.rataTransaksi} />}
      />
      <KartuAngka
        judul="Penjualan bersih"
        nilai={formatRupiah(r.penjualanBersih)}
        bawah={
          <span className="text-xs text-slate-500">omzet − retur {formatRupiah(r.retur)}</span>
        }
      />
      {r.labaKotor !== undefined ? (
        <KartuAngka
          judul="Laba kotor"
          nilai={formatRupiah(r.labaKotor)}
          bawah={
            <span className="text-xs text-slate-500">
              margin{' '}
              {r.marginPersen === null || r.marginPersen === undefined
                ? '—'
                : `${r.marginPersen.toLocaleString('id-ID')}%`}
              {lalu.labaKotor !== undefined && (
                <>
                  {' · '}
                  <Perubahan kini={r.labaKotor} lalu={lalu.labaKotor} />
                </>
              )}
            </span>
          }
        />
      ) : (
        <KartuAngka
          judul="Diskon promo & ongkir"
          nilai={formatRupiah(r.diskon)}
          bawah={<span className="text-xs text-slate-500">ongkir {formatRupiah(r.ongkir)}</span>}
        />
      )}
      <KartuAngka
        judul="Void"
        nilai={formatRupiah(r.voidPenuh.nilai + r.voidSebagian)}
        bawah={
          <span className="text-xs text-slate-500">
            {r.voidPenuh.jumlah} transaksi dibatalkan penuh
          </span>
        }
      />
    </div>
  );
}

function GrafikHarian({ h }: { h: HasilPenjualanHalaman }) {
  const maks = Math.max(0, ...h.harian.map((x) => x.omzet));
  const banyak = h.harian.length > 62;
  // Periode panjang: dijumlah per bulan agar batang tetap terbaca.
  const data = banyak
    ? [
        ...h.harian
          .reduce((m, x) => {
            const k = x.tanggal.slice(0, 7);
            const y = m.get(k) ?? { tanggal: k, jumlah: 0, omzet: 0 };
            y.jumlah += x.jumlah;
            y.omzet += x.omzet;
            return m.set(k, y);
          }, new Map<string, { tanggal: string; jumlah: number; omzet: number }>())
          .values(),
      ]
    : h.harian;
  const maksData = banyak ? Math.max(0, ...data.map((x) => x.omzet)) : maks;
  return (
    <Bagian judul={banyak ? 'Omzet per bulan' : 'Omzet per hari'}>
      {maksData === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">
          Belum ada penjualan pada periode ini.
        </p>
      ) : (
        <div className="flex h-40 items-end gap-0.5" role="img" aria-label="Grafik omzet">
          {data.map((x) => (
            <div
              key={x.tanggal}
              className="group relative flex h-full min-w-0 flex-1 flex-col justify-end"
              title={`${banyak ? x.tanggal : formatTanggal(x.tanggal)}: ${formatRupiah(x.omzet)} (${x.jumlah} transaksi)`}
            >
              <div
                className="rounded-t bg-blue-600 group-hover:bg-blue-700"
                style={{ height: `${(x.omzet / maksData) * 100}%`, minHeight: x.omzet > 0 ? 2 : 0 }}
              />
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-between text-xs text-slate-500">
        <span>{banyak ? data[0]?.tanggal : formatTanggal(data[0]?.tanggal)}</span>
        <span>{banyak ? data.at(-1)?.tanggal : formatTanggal(data.at(-1)?.tanggal)}</span>
      </div>
    </Bagian>
  );
}

function Isi({ h }: { h: HasilPenjualanHalaman }) {
  const r = h.ringkasan;
  return (
    <div className="space-y-4">
      <Ringkasan r={r} lalu={h.ringkasanLalu} />
      <p className="text-xs text-slate-500">
        Dibandingkan dengan {formatTanggal(h.periodeLalu.dari)} s.d.{' '}
        {formatTanggal(h.periodeLalu.sampai)} (jumlah hari sama). Langsung:{' '}
        {h.perJenis.LANGSUNG.jumlah} transaksi ({formatRupiah(h.perJenis.LANGSUNG.omzet)}) ·{' '}
        {LABEL_JENIS_PENJUALAN.PENGANTARAN}: {h.perJenis.PENGANTARAN.jumlah} transaksi (
        {formatRupiah(h.perJenis.PENGANTARAN.omzet)}).
      </p>
      <GrafikHarian h={h} />

      <div className="grid gap-4 xl:grid-cols-2">
        <Bagian
          judul={`Barang terlaris (${h.barang.length} dari ${h.jumlahBarangTerjual} barang terjual)`}
          kanan={<PenjelasanAbc />}
        >
          <div className="flex flex-wrap gap-2 text-xs">
            {(['A', 'B', 'C'] as const).map((k) => (
              <span key={k} className={cn('rounded border px-2 py-0.5', WARNA_KELAS[k])}>
                Kelas {k}: {h.abc[k].jumlahBarang} barang · {formatRupiah(h.abc[k].nilai)}
              </span>
            ))}
          </div>
          {h.barang.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">Belum ada barang terjual.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="py-1 font-medium">#</th>
                  <th className="py-1 font-medium">Barang</th>
                  <th className="py-1 text-right font-medium">Qty</th>
                  <th className="py-1 text-right font-medium">Nilai</th>
                  <th className="py-1 text-right font-medium">Porsi</th>
                  <th className="py-1 pl-2 font-medium">Kelas</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {h.barang.map((b) => (
                  <tr key={b.kode}>
                    <td className="py-1 text-slate-500 tabular-nums">{b.peringkat}</td>
                    <td className="py-1">
                      <p className="font-medium text-slate-900">{b.namaBarang}</p>
                      <p className="text-xs text-slate-500">{b.namaKategori}</p>
                    </td>
                    <td className="py-1 text-right whitespace-nowrap tabular-nums">
                      {formatDesimal(b.qty)} {b.kodeSatuan}
                    </td>
                    <td className="py-1 text-right tabular-nums">{formatRupiah(b.nilai)}</td>
                    <td className="py-1 text-right text-slate-600 tabular-nums">
                      {b.kontribusi === null ? '—' : `${b.kontribusi.toLocaleString('id-ID')}%`}
                    </td>
                    <td className="py-1 pl-2">
                      <span
                        className={cn(
                          'rounded border px-1.5 text-xs font-semibold',
                          WARNA_KELAS[b.kelas],
                        )}
                      >
                        {b.kelas}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Bagian>

        <div className="space-y-4">
          <Bagian judul="Per kategori">
            <Batang baris={h.perKategori} teksJumlah="barang" />
          </Bagian>
          <Bagian judul="Pelanggan teratas">
            <Batang baris={h.perPelanggan} />
          </Bagian>
        </div>

        <Bagian judul="Per kasir">
          <Batang baris={h.perKasir} />
        </Bagian>
        <Bagian
          judul="Uang masuk per cara bayar"
          kanan={
            <span className="text-xs text-slate-500">
              menurut tanggal bayar, termasuk pelunasan
            </span>
          }
        >
          <Batang baris={h.perMetode} teksJumlah="pembayaran" />
        </Bagian>
        <Bagian judul="Per jam">
          <Batang baris={h.perJam.filter((x) => x.jumlah > 0)} />
        </Bagian>
        <Bagian judul="Per hari dalam minggu">
          <Batang baris={h.perHari} />
        </Bagian>
        <Bagian judul="Promo">
          <p className="text-sm text-slate-600">
            Potongan promo <b className="text-slate-900">{formatRupiah(h.promo.diskonPromo)}</b>{' '}
            pada {h.promo.transaksiBerpromo} transaksi.
          </p>
          <Batang baris={h.promo.teratas} kosong="Tidak ada promo terpakai." />
        </Bagian>
        <Bagian judul="Retur dan void">
          <ul className="space-y-1 text-sm text-slate-700">
            <li>
              Retur disetujui: <b>{h.returDokumen}</b> dokumen, {formatRupiah(r.retur)} (mengurangi
              penjualan bersih).
            </li>
            <li>
              Void penuh: <b>{r.voidPenuh.jumlah}</b> transaksi, {formatRupiah(r.voidPenuh.nilai)}{' '}
              (tidak dihitung omzet).
            </li>
            <li>
              Void sebagian (barang dibatalkan dari transaksi): {formatRupiah(r.voidSebagian)}.
            </li>
          </ul>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link className="text-blue-700 hover:underline" to="/retur">
              Buka Retur Penjualan
            </Link>
            <Link className="text-blue-700 hover:underline" to="/void">
              Buka Void Transaksi
            </Link>
          </div>
        </Bagian>
      </div>
    </div>
  );
}

function PenjelasanAbc() {
  return (
    <Penjelasan judul="Arti kelas A, B, C dan angka di halaman ini">
      <ButirPenjelasan>
        <li>
          Barang diurutkan dari nilai penjualan terbesar. <b>Kelas A</b> = barang teratas yang
          bersama-sama menyumbang ±80% nilai penjualan; <b>B</b> = 15% berikutnya; <b>C</b> = 5%
          sisanya. Kelas A jangan sampai kehabisan stok.
        </li>
        <li>
          <b>Omzet</b> = total transaksi dikurangi void sebagian; transaksi yang dibatalkan penuh
          tidak dihitung. <b>Penjualan bersih</b> = omzet − retur. Angka sama dengan menu Laporan.
        </li>
        <li>
          Persen ▲/▼ membandingkan dengan periode sebelumnya yang panjangnya sama (mis. 7 hari ini
          dengan 7 hari sebelumnya).
        </li>
        <li>
          <b>Uang masuk per cara bayar</b> dihitung dari tanggal pembayaran, termasuk pelunasan
          piutang transaksi lama.
        </li>
      </ButirPenjelasan>
    </Penjelasan>
  );
}

/** K-126: halaman Transaksi › Hasil Penjualan. */
export function HalamanHasilPenjualan() {
  const daftar = preset();
  const [pilih, setPilih] = useState('7');
  const [p, setP] = useState<Periode>(daftar.find((x) => x.kunci === '7')!.p);
  const q = useHasilPenjualan(p);
  const h = q.data;

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Hasil Penjualan</h1>
          <p className="text-sm text-slate-500">
            Kinerja penjualan per periode: omzet, barang, pelanggan, kasir, jam ramai, cara bayar.
          </p>
        </div>
        <Link
          to="/laporan"
          className="flex h-9 items-center gap-1.5 rounded-md border bg-white px-3 text-sm hover:bg-slate-50"
        >
          <FileSpreadsheet className="size-4" /> Laporan lengkap / cetak
        </Link>
      </div>

      <Card className="flex flex-row flex-wrap items-end gap-2 p-3">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Periode cepat">
          {daftar.map((x) => (
            <button
              key={x.kunci}
              type="button"
              aria-pressed={pilih === x.kunci}
              onClick={() => {
                setPilih(x.kunci);
                setP(x.p);
              }}
              className={cn(
                'h-9 rounded-md border px-3 text-sm',
                pilih === x.kunci
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'bg-white hover:bg-slate-50',
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
        <label className="grid gap-1 text-xs text-slate-600">
          Dari
          <Input
            type="date"
            className="h-9 w-40"
            value={p.dari}
            onChange={(e) => {
              setPilih('');
              setP((x) => ({ ...x, dari: e.target.value }));
            }}
          />
        </label>
        <label className="grid gap-1 text-xs text-slate-600">
          Sampai
          <Input
            type="date"
            className="h-9 w-40"
            value={p.sampai}
            onChange={(e) => {
              setPilih('');
              setP((x) => ({ ...x, sampai: e.target.value }));
            }}
          />
        </label>
        {q.isFetching && (
          <span className="ml-auto flex items-center gap-1 text-xs text-blue-700">
            <Loader2 className="size-3.5 animate-spin" /> Menghitung…
          </span>
        )}
      </Card>

      {p.dari > p.sampai ? (
        <Card className="p-4 text-sm text-red-600">
          Tanggal awal tidak boleh setelah tanggal akhir.
        </Card>
      ) : q.isError ? (
        <Card className="p-4 text-sm text-red-600">{pesanGalat(q.error)}</Card>
      ) : !h ? (
        <Skeleton className="h-72 w-full" />
      ) : (
        <Isi h={h} />
      )}
    </div>
  );
}
