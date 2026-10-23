import {
  bandingQty,
  kurangQty,
  tambahQty,
  type BarisSuratJalan,
  type KondisiRetur,
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

type Kolom = 'qtyKembali' | 'qtyRusak' | 'qtyDitolak';
type Isian = Record<Kolom, string> & { kondisiDitolak: KondisiRetur };

const POLA = /^\d+(\.\d{1,3})?$/;
const angka = (v: string) => (v.trim() === '' ? '0' : v.trim().replace(',', '.'));
const sah = (v: string) => POLA.test(angka(v));

const KOLOM: { kunci: Kolom; label: string; bantu: string }[] = [
  { kunci: 'qtyKembali', label: 'Kembali utuh', bantu: 'Dibawa pulang utuh; dikirim ulang nanti' },
  { kunci: 'qtyRusak', label: 'Rusak di jalan', bantu: 'Ditanggung toko' },
  { kunci: 'qtyDitolak', label: 'Ditolak', bantu: 'Pembeli tidak mau; jadi retur' },
];

/**
 * S10–S11 (K-149, K-151): catat hasil pengantaran per barang. Isi hanya yang tidak diterima; sisanya dianggap
 * diterima. Hitungan "diterima" di layar hanya tampilan; angka final dicek API.
 */
export function DialogHasil({ sj, onTutup }: { sj: BarisSuratJalan; onTutup: () => void }) {
  const catat = useCatatHasil();
  const [isi, setIsi] = useState<Record<number, Isian>>(() =>
    Object.fromEntries(
      sj.baris.map((b) => [
        b.idPenjualanDetail,
        { qtyKembali: '', qtyRusak: '', qtyDitolak: '', kondisiDitolak: 'BAIK' },
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
    const valid = KOLOM.every((k) => sah(x[k.kunci]));
    const lain = valid ? KOLOM.reduce((t, k) => tambahQty(t, angka(x[k.kunci])), '0') : '0';
    const diterima = valid ? kurangQty(b.qtyKirim, lain) : null;
    return { b, x, valid, diterima, lebih: diterima !== null && bandingQty(diterima, 0) < 0 };
  });
  const adaRusak = baris.some((r) => r.valid && bandingQty(angka(r.x.qtyRusak), 0) > 0);
  const adaUang = baris.some(
    (r) =>
      r.valid &&
      (bandingQty(angka(r.x.qtyDitolak), 0) > 0 ||
        (penanganan === 'KURANGI_TAGIHAN' && bandingQty(angka(r.x.qtyRusak), 0) > 0)),
  );
  const adaSalah = baris.some((r) => !r.valid || r.lebih);

  function ubah(id: number, k: keyof Isian, v: string) {
    setIsi((s) => ({ ...s, [id]: { ...s[id]!, [k]: v } }));
  }

  function simpan(semuaDiterima: boolean) {
    if (!semuaDiterima && adaSalah) {
      toast.error('Periksa angka yang merah: jumlahnya tidak boleh melebihi qty kirim.');
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
            qtyRusak: semuaDiterima ? '0' : angka(r.x.qtyRusak),
            qtyDitolak: semuaDiterima ? '0' : angka(r.x.qtyDitolak),
            kondisiDitolak: r.x.kondisiDitolak,
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
        for (const r of [h.hasil?.returUang, h.hasil?.returTukar]) {
          if (r && r.status === 'MENUNGGU')
            pesan.push(`Retur ${r.nomor} menunggu persetujuan atasan.`);
        }
        const ulang =
          !semuaDiterima &&
          baris.some(
            (r) =>
              bandingQty(angka(r.x.qtyKembali), 0) > 0 ||
              (penanganan === 'KIRIM_PENGGANTI' && bandingQty(angka(r.x.qtyRusak), 0) > 0),
          );
        if (ulang) pesan.push('Sisa barang masuk kolom "Perlu surat jalan" untuk dikirim ulang.');
        toast.success(pesan.join(' '));
        onTutup();
      })
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }

  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Catat hasil {sj.nomor}</DialogTitle>
          <DialogDescription>
            {sj.namaPelanggan ?? '—'} · {sj.alamatKirim}
            {sj.sopir ? ` · sopir ${sj.sopir}` : ''}. Isi hanya barang yang <b>tidak</b> diterima;
            sisanya dihitung diterima.
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
                {KOLOM.map((k) => (
                  <th key={k.kunci} className="w-24 py-1 text-right" title={k.bantu}>
                    {k.label}
                  </th>
                ))}
                <th className="w-20 py-1 text-right">Diterima</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {baris.map(({ b, x, valid, diterima, lebih }) => (
                <tr key={b.idPenjualanDetail} className="align-top">
                  <td className="py-1.5">
                    <div className="font-medium">{b.namaBarang}</div>
                    {valid && bandingQty(angka(x.qtyDitolak), 0) > 0 && (
                      <label className="mt-1 flex items-center gap-1 text-xs text-slate-600">
                        Kondisi yang ditolak:
                        <select
                          className="rounded border px-1 py-0.5"
                          value={x.kondisiDitolak}
                          onChange={(e) =>
                            ubah(b.idPenjualanDetail, 'kondisiDitolak', e.target.value)
                          }
                          aria-label={`Kondisi ditolak ${b.namaBarang}`}
                        >
                          <option value="BAIK">Baik (kembali ke stok jual)</option>
                          <option value="RUSAK">Rusak</option>
                          <option value="CACAT">Cacat</option>
                        </select>
                      </label>
                    )}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {formatDesimal(b.qtyKirim)} {b.kodeSatuan}
                  </td>
                  {KOLOM.map((k) => (
                    <td key={k.kunci} className="py-1 pl-2">
                      <Input
                        className={cn(
                          'h-8 text-right',
                          !sah(x[k.kunci]) && 'border-red-500 ring-2 ring-red-200',
                        )}
                        inputMode="decimal"
                        placeholder="0"
                        value={x[k.kunci]}
                        onChange={(e) => ubah(b.idPenjualanDetail, k.kunci, e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                        aria-label={`${k.label} ${b.namaBarang}`}
                      />
                    </td>
                  ))}
                  <td
                    className={cn(
                      'py-1.5 text-right font-semibold tabular-nums',
                      lebih ? 'text-red-600' : 'text-emerald-700',
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
        {adaRusak && (
          <fieldset className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
            <legend className="px-1 font-semibold text-amber-900">
              Barang rusak di jalan ditanggung toko. Pembeli memilih:
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
            <legend className="px-1 font-semibold">Nilai barang ditolak/rusak</legend>
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
                  className="h-8 w-56"
                  value={rekening}
                  onChange={(e) => setRekening(e.target.value)}
                  placeholder="Rekening pembeli"
                  aria-label="Rekening pembeli"
                />
              )}
            </div>
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
