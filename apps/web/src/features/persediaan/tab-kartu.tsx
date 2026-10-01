import { formatRupiah, type BarisMutasi, type KondisiStok } from '@sit/shared';
import { Printer, X } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useKartuStok } from '@/api/persediaan';
import { PilihBarang } from '@/components/pilih-barang';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { pesanGalat } from '@/api/client';
import {
  awalBulanIni,
  formatDesimal,
  formatTanggal,
  formatWaktu,
  tanggalHariIni,
} from '@/lib/format';
import { LABEL_JENIS_MUTASI } from '@/lib/label';
import { TautanDokumen } from './tautan-dokumen';

/**
 * Kartu stok satu barang (docs/01 §6): saldo awal periode, setiap mutasi berurutan ledger dengan
 * dokumen sumbernya, total masuk/keluar, saldo akhir. Bisa dicetak.
 */
export function TabKartu() {
  const [url, setUrl] = useSearchParams();
  const idBarang = Number(url.get('barang')) || null;
  const [kondisi, setKondisi] = useState<KondisiStok>('BAIK');
  const [dari, setDari] = useState(awalBulanIni);
  const [sampai, setSampai] = useState(tanggalHariIni);
  const kartu = useKartuStok(idBarang, { kondisi, dari, sampai });
  const k = kartu.data;
  const lihatHpp = k?.hppAkhir !== undefined;
  const tanggalTerbalik = dari !== '' && sampai !== '' && dari > sampai;

  function pilihBarang(id: number | null) {
    setUrl(id === null ? { tab: 'kartu' } : { tab: 'kartu', barang: String(id) }, {
      replace: true,
    });
  }

  const qty = (n: string) => formatDesimal(n);
  const kosongBilaNol = (n: string, awalan: string) =>
    n === '0.000' ? '' : `${awalan}${formatDesimal(n)}`;

  return (
    <Card className="gap-0 py-0 print:border-0 print:shadow-none">
      <div className="flex flex-wrap items-end gap-3 border-b p-3 print:hidden">
        <div className="w-80 space-y-1">
          <Label>Barang</Label>
          {idBarang === null ? (
            <PilihBarang onPilih={(b) => pilihBarang(b.id)} />
          ) : (
            <div className="flex h-9 items-center gap-2 rounded-md border bg-slate-50 px-3 text-sm">
              <span className="flex-1 truncate font-medium">
                {k ? `${k.barang.kode} · ${k.barang.namaBarang}` : 'Memuat…'}
              </span>
              <button
                type="button"
                onClick={() => pilihBarang(null)}
                aria-label="Ganti barang"
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="size-4" />
              </button>
            </div>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="kartu-kondisi">Kondisi</Label>
          <Select value={kondisi} onValueChange={(v) => setKondisi(v as KondisiStok)}>
            <SelectTrigger id="kartu-kondisi" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BAIK">Baik</SelectItem>
              <SelectItem value="RUSAK">Rusak</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="kartu-dari">Dari</Label>
          <Input
            id="kartu-dari"
            type="date"
            value={dari}
            onChange={(e) => setDari(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="kartu-sampai">Sampai</Label>
          <Input
            id="kartu-sampai"
            type="date"
            value={sampai}
            onChange={(e) => setSampai(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="flex-1" />
        <Button variant="outline" disabled={!k} onClick={() => window.print()}>
          <Printer /> Cetak
        </Button>
      </div>

      {tanggalTerbalik && (
        <p className="p-6 text-sm text-red-600">Tanggal awal tidak boleh setelah tanggal akhir.</p>
      )}
      {idBarang === null && (
        <p className="p-6 text-sm text-slate-500">Pilih barang untuk melihat kartu stoknya.</p>
      )}
      {idBarang !== null && kartu.isLoading && (
        <div className="space-y-2 p-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-7 w-full" />
          ))}
        </div>
      )}
      {kartu.error && <p className="p-6 text-sm text-red-600">{pesanGalat(kartu.error)}</p>}

      {k && (
        <div className="space-y-3 p-4 print:p-0">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Kartu Stok — {k.barang.namaBarang}
            </h2>
            <p className="text-sm text-slate-500">
              {k.barang.kode} · satuan {k.barang.kodeSatuan} · kondisi{' '}
              {k.kondisi === 'BAIK' ? 'baik' : 'rusak'} · periode {formatTanggal(k.dari)} s/d{' '}
              {formatTanggal(k.sampai)}
            </p>
          </div>
          <div className="grid grid-cols-4 gap-3 text-sm">
            {[
              ['Saldo awal', k.saldoAwal],
              ['Total masuk', k.totalMasuk],
              ['Total keluar', k.totalKeluar],
              ['Saldo akhir', k.saldoAkhir],
            ].map(([judul, nilai]) => (
              <div key={judul} className="rounded-md border p-2">
                <div className="text-xs text-slate-500">{judul}</div>
                <div className="font-semibold tabular-nums" data-testid={`kartu-${judul}`}>
                  {qty(nilai!)} {k.barang.kodeSatuan}
                </div>
              </div>
            ))}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Waktu</TableHead>
                <TableHead>Dokumen</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead className="text-right">Masuk</TableHead>
                <TableHead className="text-right">Keluar</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                {lihatHpp && <TableHead className="text-right">HPP satuan</TableHead>}
                {lihatHpp && <TableHead className="text-right">HPP rata-rata</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-slate-50">
                <TableCell colSpan={6} className="text-slate-600">
                  Saldo awal per {formatTanggal(k.dari)}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {qty(k.saldoAwal)}
                </TableCell>
                {lihatHpp && <TableCell />}
                {lihatHpp && (
                  <TableCell className="text-right tabular-nums">
                    {k.hppAwal === null || k.hppAwal === undefined ? '—' : formatRupiah(k.hppAwal)}
                  </TableCell>
                )}
              </TableRow>
              {k.baris.map((m: BarisMutasi) => (
                <TableRow key={m.id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {formatWaktu(m.waktu)}
                  </TableCell>
                  <TableCell>
                    <TautanDokumen m={m} />
                  </TableCell>
                  <TableCell>{LABEL_JENIS_MUTASI[m.jenis]}</TableCell>
                  <TableCell className="max-w-72 min-w-48 text-xs whitespace-normal text-slate-600">
                    {m.keterangan ?? ''}
                    <span className="text-slate-400"> · {m.namaPengguna}</span>
                  </TableCell>
                  <TableCell className="text-right text-green-700 tabular-nums">
                    {kosongBilaNol(m.qtyMasuk, '+')}
                  </TableCell>
                  <TableCell className="text-right text-red-700 tabular-nums">
                    {kosongBilaNol(m.qtyKeluar, '−')}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {qty(m.saldoSetelah)}
                  </TableCell>
                  {lihatHpp && (
                    <TableCell className="text-right tabular-nums">
                      {formatRupiah(m.hppSatuan ?? 0)}
                    </TableCell>
                  )}
                  {lihatHpp && (
                    <TableCell className="text-right tabular-nums">
                      {formatRupiah(m.hppSetelah ?? 0)}
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {k.baris.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-6 text-center text-sm text-slate-500">
                    Tidak ada mutasi pada periode ini.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4}>Saldo akhir per {formatTanggal(k.sampai)}</TableCell>
                <TableCell className="text-right tabular-nums">{qty(k.totalMasuk)}</TableCell>
                <TableCell className="text-right tabular-nums">{qty(k.totalKeluar)}</TableCell>
                <TableCell className="text-right tabular-nums">{qty(k.saldoAkhir)}</TableCell>
                {lihatHpp && <TableCell />}
                {lihatHpp && (
                  <TableCell className="text-right tabular-nums">
                    {k.hppAkhir === null || k.hppAkhir === undefined
                      ? '—'
                      : formatRupiah(k.hppAkhir)}
                  </TableCell>
                )}
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </Card>
  );
}
