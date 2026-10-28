import { formatRupiah, skemaKonfirmasiTransfer, type TugasRefundTransfer } from '@sit/shared';
import { Banknote } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { pesanGalat } from '@/api/client';
import { useKonfirmasiTransfer, useRefundTransfer } from '@/api/penjualan';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { formatWaktu } from '@/lib/format';

function DialogKonfirmasi({ t, onTutup }: { t: TugasRefundTransfer; onTutup: () => void }) {
  const konfirmasi = useKonfirmasiTransfer();
  const [rekening, setRekening] = useState(t.rekeningRefund ?? '');
  const [referensi, setReferensi] = useState('');

  function kirim() {
    const v = skemaKonfirmasiTransfer.safeParse({
      rekeningRefund: rekening,
      referensiRefund: referensi,
    });
    if (!v.success) {
      toast.error(v.error.issues[0]?.message ?? 'Isian belum lengkap.');
      return;
    }
    konfirmasi
      .mutateAsync({ id: t.id, json: v.data })
      .then(() => {
        toast.success(`Refund ${t.nomor} dicatat sudah ditransfer.`);
        onTutup();
      })
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }

  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sudah ditransfer: {formatRupiah(t.nominalRefund)}</DialogTitle>
          <DialogDescription>
            {t.nomor} · {t.nomorPenjualan} · {t.namaPelanggan ?? 'pembeli umum'}. Isi setelah uang
            benar-benar dikirim dari rekening toko.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            kirim();
          }}
        >
          <label className="grid gap-1">
            <span className="font-medium">Rekening tujuan (bank, nomor, atas nama)</span>
            <Input
              autoFocus={!t.rekeningRefund}
              value={rekening}
              onChange={(e) => setRekening(e.target.value)}
              placeholder="mis. BCA 1234567890 a.n. Budi"
              aria-label="Rekening tujuan refund"
            />
          </label>
          <label className="grid gap-1">
            <span className="font-medium">No. referensi / bukti transfer (wajib)</span>
            <Input
              autoFocus={Boolean(t.rekeningRefund)}
              value={referensi}
              onChange={(e) => setReferensi(e.target.value)}
              placeholder="Dari struk/m-banking"
              aria-label="Referensi transfer"
            />
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onTutup}>
              Batal
            </Button>
            <Button type="submit" disabled={konfirmasi.isPending}>
              <Banknote /> {konfirmasi.isPending ? 'Menyimpan…' : 'Sudah ditransfer (Enter)'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * K-176: pengembalian uang lewat transfer dikerjakan belakangan. Daftar ini berisi yang belum ditransfer (rekening
 * boleh diisi saat konfirmasi) dan riwayat yang sudah, lengkap dengan bukti.
 */
export function TabRefundTransfer() {
  const menunggu = useRefundTransfer('MENUNGGU');
  const selesai = useRefundTransfer('SELESAI');
  const [pilih, setPilih] = useState<TugasRefundTransfer | null>(null);
  const daftar = menunggu.data ?? [];
  const riwayat = selesai.data ?? [];
  return (
    <div className="space-y-4">
      <Card className="gap-0 overflow-hidden py-0">
        <div className="border-b p-3">
          <h2 className="font-semibold">Menunggu transfer ({daftar.length})</h2>
          <p className="text-xs text-slate-500">
            Kirim uangnya dari rekening toko, lalu klik <b>Sudah ditransfer</b> dan isi nomor
            referensi dari bank.
          </p>
        </div>
        {daftar.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-400">
            {menunggu.isLoading ? 'Memuat…' : 'Tidak ada refund yang menunggu transfer.'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Retur</th>
                <th className="px-3 py-2 text-left">Pembeli</th>
                <th className="px-3 py-2 text-left">Rekening</th>
                <th className="px-3 py-2 text-right">Nominal</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {daftar.map((t) => (
                <tr key={t.id} data-testid={`transfer-${t.nomor}`}>
                  <td className="px-3 py-2">
                    <div className="font-mono text-xs font-semibold">{t.nomor}</div>
                    <Link
                      to={`/penjualan/${t.idPenjualan}`}
                      className="font-mono text-xs text-blue-700 hover:underline"
                    >
                      {t.nomorPenjualan}
                    </Link>
                    <div className="text-xs text-slate-500">{formatWaktu(t.tanggal)}</div>
                  </td>
                  <td className="px-3 py-2">
                    {t.namaPelanggan ?? 'Pembeli umum'}
                    {t.noHpPelanggan && (
                      <div className="text-xs text-slate-500">{t.noHpPelanggan}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {t.rekeningRefund ?? <span className="text-amber-700">belum diisi</span>}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">
                    {formatRupiah(t.nominalRefund)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" onClick={() => setPilih(t)}>
                      <Banknote /> Sudah ditransfer
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <Card className="gap-0 overflow-hidden py-0">
        <div className="border-b p-3 font-semibold">Sudah ditransfer (terbaru)</div>
        {riwayat.length === 0 ? (
          <p className="p-4 text-center text-sm text-slate-400">Belum ada.</p>
        ) : (
          <ul className="divide-y text-sm">
            {riwayat.slice(0, 20).map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-x-3 px-3 py-2">
                <span className="font-mono text-xs font-semibold">{t.nomor}</span>
                <span>{t.namaPelanggan ?? 'Pembeli umum'}</span>
                <span className="font-semibold tabular-nums">{formatRupiah(t.nominalRefund)}</span>
                <span className="text-xs text-slate-500">
                  ke {t.rekeningRefund} · ref. {t.referensiRefund} · {t.namaPenggunaTransfer},{' '}
                  {formatWaktu(t.waktuTransfer)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {pilih && <DialogKonfirmasi t={pilih} onTutup={() => setPilih(null)} />}
    </div>
  );
}
