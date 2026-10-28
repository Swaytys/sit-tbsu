import {
  ALASAN_KEMBALI,
  ALASAN_RUSAK,
  bandingQty,
  kurangQty,
  LABEL_ALASAN_KEMBALI,
  LABEL_ALASAN_RUSAK,
  tambahQty,
  type AlasanKembali,
  type AlasanRusak,
  type BarisSuratJalan,
  type MetodeRefund,
  type PenangananRusak,
} from '@sit/shared';
import { CheckCheck } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { pesanGalat } from '@/api/client';
import { useCatatHasil } from '@/api/armada';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { formatDesimal } from '@/lib/format';
import { cn } from '@/lib/utils';

type Isian = {
  qtyKembali: string;
  alasanKembali: AlasanKembali | '';
  qtyRusak: string;
  alasanRusak: AlasanRusak | '';
};

const POLA = /^\d+(\.\d{1,3})?$/;
const angka = (v: string) => (v.trim() === '' ? '0' : v.trim().replace(',', '.'));
const sah = (v: string) => POLA.test(angka(v));
const ada = (v: string) => sah(v) && bandingQty(angka(v), 0) > 0;

const kelasPilih = 'h-8 w-full rounded-md border border-slate-300 bg-white px-1 text-xs';

/**
 * S10–S11 (K-149, K-151, K-176): catat hasil pengantaran per barang. Isi hanya yang tidak diterima beserta
 * alasannya; sisanya dihitung diterima. Hitungan "diterima" di layar hanya tampilan; angka final dicek API.
 */
export function DialogHasil({ sj, onTutup }: { sj: BarisSuratJalan; onTutup: () => void }) {
  const catat = useCatatHasil();
  const [isi, setIsi] = useState<Record<number, Isian>>(() =>
    Object.fromEntries(
      sj.baris.map((b) => [
        b.idPenjualanDetail,
        { qtyKembali: '', alasanKembali: '', qtyRusak: '', alasanRusak: '' },
      ]),
    ),
  );
  const [penanganan, setPenanganan] = useState<PenangananRusak | null>(null);
  const [metode, setMetode] = useState<MetodeRefund | null>(null);
  const [rekening, setRekening] = useState('');
  const [penerima, setPenerima] = useState(sj.namaPenerima ?? '');
  const [catatan, setCatatan] = useState('');

  const baris = sj.baris.map((b) => {
    const x = isi[b.idPenjualanDetail]!;
    const valid = sah(x.qtyKembali) && sah(x.qtyRusak);
    const lain = valid ? tambahQty(angka(x.qtyKembali), angka(x.qtyRusak)) : '0';
    const diterima = valid ? kurangQty(b.qtyKirim, lain) : null;
    const tanpaAlasan =
      (ada(x.qtyKembali) && !x.alasanKembali) || (ada(x.qtyRusak) && !x.alasanRusak);
    return {
      b,
      x,
      valid,
      diterima,
      tanpaAlasan,
      lebih: diterima !== null && bandingQty(diterima, 0) < 0,
    };
  });
  const adaRusak = baris.some((r) => ada(r.x.qtyRusak));
  const adaUang = baris.some(
    (r) =>
      (ada(r.x.qtyKembali) && r.x.alasanKembali !== '' && r.x.alasanKembali !== 'KIRIM_ULANG') ||
      (penanganan === 'KURANGI_TAGIHAN' && ada(r.x.qtyRusak)),
  );
  const adaSalah = baris.some((r) => !r.valid || r.lebih);

  function ubah<K extends keyof Isian>(id: number, k: K, v: Isian[K]) {
    setIsi((s) => ({ ...s, [id]: { ...s[id]!, [k]: v } }));
  }

  function simpan(semuaDiterima: boolean) {
    if (!semuaDiterima && adaSalah) {
      toast.error('Periksa angka yang merah: jumlahnya tidak boleh melebihi qty kirim.');
      return;
    }
    if (!semuaDiterima && baris.some((r) => r.tanpaAlasan)) {
      toast.error('Pilih alasan untuk setiap barang yang kembali atau rusak.');
      return;
    }
    if (!semuaDiterima && adaRusak && !penanganan) {
      toast.error('Ada barang rusak: pilih kirim pengganti atau kurangi tagihan.');
      return;
    }
    catat
      .mutateAsync({
        id: sj.id,
        json: {
          baris: baris.map((r) => ({
            idPenjualanDetail: r.b.idPenjualanDetail,
            qtyDiterima: semuaDiterima ? r.b.qtyKirim : (r.diterima ?? '0'),
            qtyKembali: semuaDiterima ? '0' : angka(r.x.qtyKembali),
            alasanKembali: semuaDiterima || !ada(r.x.qtyKembali) ? null : r.x.alasanKembali || null,
            qtyRusak: semuaDiterima ? '0' : angka(r.x.qtyRusak),
            alasanRusak: semuaDiterima || !ada(r.x.qtyRusak) ? null : r.x.alasanRusak || null,
          })),
          penangananRusak: semuaDiterima || !adaRusak ? null : penanganan,
          metodeRefund: semuaDiterima ? null : metode,
          rekeningRefund: metode === 'TRANSFER' ? rekening.trim() || null : null,
          namaPenerima: penerima.trim() || null,
          catatan: catatan.trim() || null,
        },
      })
      .then((h) => {
        const pesan = [`Hasil ${h.nomor} dicatat.`];
        for (const r of [h.hasil?.returUang, h.hasil?.returRusak, h.hasil?.returTukar]) {
          if (r && r.status === 'MENUNGGU')
            pesan.push(`Retur ${r.nomor} menunggu persetujuan atasan.`);
        }
        const ulang =
          !semuaDiterima &&
          baris.some(
            (r) =>
              (ada(r.x.qtyKembali) && r.x.alasanKembali === 'KIRIM_ULANG') ||
              (penanganan === 'KIRIM_PENGGANTI' && ada(r.x.qtyRusak)),
          );
        if (ulang) pesan.push('Barang yang dikirim ulang muncul lagi di Backlog Pengiriman.');
        if (!semuaDiterima && metode === 'TRANSFER' && adaUang)
          pesan.push(
            'Pengembalian uang lewat transfer menunggu di Retur Penjualan › Refund transfer.',
          );
        toast.success(pesan.join(' '), { duration: 10_000 });
        onTutup();
      })
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }

  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Catat hasil {sj.nomor}</DialogTitle>
          <DialogDescription>
            {sj.namaPelanggan ?? '—'} · {sj.alamatKirim}
            {sj.sopir ? ` · sopir ${sj.sopir}` : ''}. Isi hanya barang yang <b>tidak</b> diterima,
            beserta alasannya; sisanya dihitung diterima.
          </DialogDescription>
        </DialogHeader>
        <Button
          size="lg"
          className="h-12 w-full bg-emerald-600 text-base hover:bg-emerald-700"
          disabled={catat.isPending}
          onClick={() => simpan(true)}
          autoFocus
        >
          <CheckCheck /> Semua diterima (Enter)
        </Button>
        <div className="max-h-[45vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white text-xs text-slate-500">
              <tr>
                <th className="py-1 text-left">Barang</th>
                <th className="w-20 py-1 text-right">Dikirim</th>
                <th className="w-48 py-1 pl-2 text-left" title="Barang kembali dalam keadaan baik">
                  Kembali utuh · alasan
                </th>
                <th className="w-48 py-1 pl-2 text-left" title="Ditanggung toko">
                  Rusak · alasan
                </th>
                <th className="w-20 py-1 text-right">Diterima</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {baris.map(({ b, x, valid, diterima, lebih }) => (
                <tr key={b.idPenjualanDetail} className="align-top">
                  <td className="py-1.5 font-medium">{b.namaBarang}</td>
                  <td className="py-1.5 text-right tabular-nums">
                    {formatDesimal(b.qtyKirim)} {b.kodeSatuan}
                  </td>
                  <td className="space-y-1 py-1 pl-2">
                    <Input
                      className={cn(
                        'h-8 text-right',
                        !sah(x.qtyKembali) && 'border-red-500 ring-2 ring-red-200',
                      )}
                      inputMode="decimal"
                      placeholder="0"
                      value={x.qtyKembali}
                      onChange={(e) => ubah(b.idPenjualanDetail, 'qtyKembali', e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                      aria-label={`Kembali utuh ${b.namaBarang}`}
                    />
                    {ada(x.qtyKembali) && (
                      <select
                        className={cn(kelasPilih, !x.alasanKembali && 'border-red-500')}
                        value={x.alasanKembali}
                        onChange={(e) =>
                          ubah(
                            b.idPenjualanDetail,
                            'alasanKembali',
                            e.target.value as AlasanKembali,
                          )
                        }
                        aria-label={`Alasan kembali ${b.namaBarang}`}
                      >
                        <option value="">— pilih alasan —</option>
                        {ALASAN_KEMBALI.map((a) => (
                          <option key={a} value={a}>
                            {LABEL_ALASAN_KEMBALI[a]}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="space-y-1 py-1 pl-2">
                    <Input
                      className={cn(
                        'h-8 text-right',
                        !sah(x.qtyRusak) && 'border-red-500 ring-2 ring-red-200',
                      )}
                      inputMode="decimal"
                      placeholder="0"
                      value={x.qtyRusak}
                      onChange={(e) => ubah(b.idPenjualanDetail, 'qtyRusak', e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                      aria-label={`Rusak ${b.namaBarang}`}
                    />
                    {ada(x.qtyRusak) && (
                      <select
                        className={cn(kelasPilih, !x.alasanRusak && 'border-red-500')}
                        value={x.alasanRusak}
                        onChange={(e) =>
                          ubah(b.idPenjualanDetail, 'alasanRusak', e.target.value as AlasanRusak)
                        }
                        aria-label={`Alasan rusak ${b.namaBarang}`}
                      >
                        <option value="">— pilih alasan —</option>
                        {ALASAN_RUSAK.map((a) => (
                          <option key={a} value={a}>
                            {LABEL_ALASAN_RUSAK[a]}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td
                    className={cn(
                      'py-1.5 text-right font-semibold tabular-nums',
                      lebih || !valid ? 'text-red-600' : 'text-emerald-700',
                    )}
                    data-testid={`diterima-${b.idPenjualanDetail}`}
                  >
                    {diterima === null ? '?' : formatDesimal(diterima)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500">
          <b>Kirim ulang nanti</b>: barang tetap milik pembeli dan muncul lagi di Backlog.{' '}
          <b>Kelebihan / salah barang / pembeli batal</b>: barang kembali ke stok dan tagihan
          dikurangi otomatis.
        </p>
        {adaRusak && (
          <fieldset className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
            <legend className="px-1 font-semibold text-amber-900">
              Barang rusak ditanggung toko. Pembeli memilih:
            </legend>
            <div className="flex flex-wrap gap-4">
              {(
                [
                  ['KIRIM_PENGGANTI', 'Dikirim pengganti (tagihan tetap)'],
                  ['KURANGI_TAGIHAN', 'Tagihan dikurangi'],
                ] as const
              ).map(([v, label]) => (
                <label key={v} className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="penanganan-rusak"
                    checked={penanganan === v}
                    onChange={() => setPenanganan(v)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {adaUang && (
          <fieldset className="rounded-md border p-3 text-sm">
            <legend className="px-1 font-semibold">Nilai barang dikembalikan/rusak</legend>
            <p className="text-slate-600">
              Memotong sisa tagihan. Bila tagihan sudah lunas, uangnya dikembalikan lewat:
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-4">
              {(
                [
                  ['TUNAI', 'Tunai (uang shift)'],
                  ['TRANSFER', 'Transfer'],
                ] as const
              ).map(([v, label]) => (
                <label key={v} className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="metode-refund"
                    checked={metode === v}
                    onChange={() => setMetode(v)}
                  />
                  {label}
                </label>
              ))}
              {metode === 'TRANSFER' && (
                <Input
                  className="h-8 w-64"
                  value={rekening}
                  onChange={(e) => setRekening(e.target.value)}
                  placeholder="Rekening pembeli (boleh diisi nanti)"
                  aria-label="Rekening pembeli"
                />
              )}
            </div>
            {metode === 'TRANSFER' && (
              <p className="mt-1 text-xs text-slate-500">
                Transfer dikerjakan belakangan: tugasnya muncul di Retur Penjualan › Refund transfer
                sampai dikonfirmasi dengan nomor referensi/bukti transfer.
              </p>
            )}
          </fieldset>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Input
            value={penerima}
            onChange={(e) => setPenerima(e.target.value)}
            placeholder="Nama yang menerima (opsional)"
            aria-label="Nama yang menerima"
          />
          <Input
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Catatan (opsional)"
            aria-label="Catatan hasil"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onTutup}>
            Batal
          </Button>
          <Button disabled={catat.isPending || adaSalah} onClick={() => simpan(false)}>
            {catat.isPending ? 'Menyimpan…' : 'Simpan hasil'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
