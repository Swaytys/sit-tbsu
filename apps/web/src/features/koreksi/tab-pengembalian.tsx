import {
  formatRupiah,
  skemaKonfirmasiPengembalian,
  type MetodeRefund,
  type TugasPengembalian,
} from '@sit/shared';
import { ArrowLeftRight, Banknote, HandCoins } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { pesanGalat } from '@/api/client';
import {
  useGantiCaraPengembalian,
  useKonfirmasiPengembalian,
  usePengembalian,
} from '@/api/penjualan';
import { usePengguna } from '@/api/auth';
import { DialogAlasan } from '@/components/dialog-alasan';
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
import { SARAN_ALASAN } from '@/lib/saran-alasan';

const NAMA_CARA: Record<MetodeRefund, string> = { TUNAI: 'tunai', TRANSFER: 'transfer' };

/** Konfirmasi uang sudah dikembalikan: tunai keluar dari kas shift; transfer wajib rekening + No. referensi. */
function DialogKonfirmasi({ t, onTutup }: { t: TugasPengembalian; onTutup: () => void }) {
  const konfirmasi = useKonfirmasiPengembalian();
  const tunai = t.metodeRefund === 'TUNAI';
  const [rekening, setRekening] = useState(t.rekeningRefund ?? '');
  const [referensi, setReferensi] = useState('');

  function kirim() {
    const v = skemaKonfirmasiPengembalian.safeParse({
      metode: t.metodeRefund,
      rekeningRefund: tunai ? null : rekening,
      referensiRefund: tunai ? null : referensi,
    });
    if (!v.success) {
      toast.error(v.error.issues[0]?.message ?? 'Isian belum lengkap.');
      return;
    }
    konfirmasi
      .mutateAsync({ id: t.id, json: v.data })
      .then(() => {
        toast.success(
          tunai
            ? `Uang ${t.nomor} ${formatRupiah(t.nominalRefund)} dicatat keluar dari kas shift.`
            : `Refund ${t.nomor} dicatat sudah ditransfer.`,
        );
        onTutup();
      })
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }

  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {tunai ? 'Uang diserahkan tunai' : 'Sudah ditransfer'}: {formatRupiah(t.nominalRefund)}
          </DialogTitle>
          <DialogDescription>
            {t.nomor} · {t.nomorPenjualan} · {t.namaPelanggan ?? 'pembeli umum'}.{' '}
            {tunai
              ? 'Klik setelah uangnya benar-benar diserahkan ke pembeli. Uang dicatat keluar dari kas shift yang sedang buka.'
              : 'Isi setelah uang benar-benar dikirim dari rekening toko.'}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            kirim();
          }}
        >
          {!tunai && (
            <>
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
                  placeholder="4–40 huruf/angka dari m-banking"
                  aria-label="Referensi transfer"
                />
              </label>
            </>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onTutup}>
              Batal
            </Button>
            <Button type="submit" autoFocus={tunai} disabled={konfirmasi.isPending}>
              {tunai ? <HandCoins /> : <Banknote />}{' '}
              {konfirmasi.isPending
                ? 'Menyimpan…'
                : tunai
                  ? 'Sudah diserahkan (Enter)'
                  : 'Sudah ditransfer (Enter)'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TabelMenunggu({
  judul,
  ket,
  daftar,
  memuat,
  metode,
  bolehTransfer,
  onKonfirmasi,
  onGanti,
}: {
  judul: string;
  ket: string;
  daftar: TugasPengembalian[];
  memuat: boolean;
  metode: MetodeRefund;
  bolehTransfer: boolean;
  onKonfirmasi: (t: TugasPengembalian) => void;
  onGanti: (t: TugasPengembalian) => void;
}) {
  const lain: MetodeRefund = metode === 'TUNAI' ? 'TRANSFER' : 'TUNAI';
  return (
    <Card className="gap-0 overflow-hidden py-0" data-testid={`pengembalian-${metode}`}>
      <div className="border-b p-3">
        <h2 className="font-semibold">
          {judul} ({daftar.length})
        </h2>
        <p className="text-xs text-slate-500">{ket}</p>
      </div>
      {daftar.length === 0 ? (
        <p className="p-6 text-center text-sm text-slate-400">
          {memuat ? 'Memuat…' : 'Tidak ada yang menunggu.'}
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Retur</th>
              <th className="px-3 py-2 text-left">Pembeli</th>
              {metode === 'TRANSFER' && <th className="px-3 py-2 text-left">Rekening</th>}
              <th className="px-3 py-2 text-right">Nominal</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {daftar.map((t) => (
              <tr key={t.id} data-testid={`kembali-${t.nomor}`}>
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
                {metode === 'TRANSFER' && (
                  <td className="px-3 py-2 text-xs">
                    {t.rekeningRefund ?? <span className="text-amber-700">belum diisi</span>}
                  </td>
                )}
                <td className="px-3 py-2 text-right font-semibold tabular-nums">
                  {formatRupiah(t.nominalRefund)}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onGanti(t)}
                    title={`Ganti cara pengembalian menjadi ${NAMA_CARA[lain]}`}
                  >
                    <ArrowLeftRight /> Jadikan {NAMA_CARA[lain]}
                  </Button>
                  {(metode === 'TUNAI' || bolehTransfer) && (
                    <Button size="sm" onClick={() => onKonfirmasi(t)}>
                      {metode === 'TUNAI' ? <HandCoins /> : <Banknote />}{' '}
                      {metode === 'TUNAI' ? 'Sudah diserahkan' : 'Sudah ditransfer'}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

/**
 * K-176, K-193: pengembalian uang retur yang dikerjakan belakangan (mis. dari hasil pengantaran, pembeli tidak di
 * toko). Dua daftar: menunggu diserahkan tunai dan menunggu ditransfer; cara bisa diganti selama menunggu. Pengguna
 * tidak perlu mengingat mana yang belum dikembalikan; tunai baru keluar dari kas shift saat diserahkan.
 */
export function TabPengembalian() {
  const menunggu = usePengembalian('MENUNGGU');
  const selesai = usePengembalian('SELESAI');
  const ganti = useGantiCaraPengembalian();
  const bolehTransfer = usePengguna().izin.includes('retur.setujui');
  const [pilih, setPilih] = useState<TugasPengembalian | null>(null);
  const [gantiCara, setGantiCara] = useState<TugasPengembalian | null>(null);
  const daftar = menunggu.data ?? [];
  const riwayat = selesai.data ?? [];
  const lain = (m: MetodeRefund): MetodeRefund => (m === 'TUNAI' ? 'TRANSFER' : 'TUNAI');
  return (
    <div className="space-y-4">
      <TabelMenunggu
        judul="Menunggu diserahkan tunai"
        ket="Uangnya diambil pembeli di toko atau diantar. Klik Sudah diserahkan saat uang diberikan; uang keluar dari kas shift yang sedang buka."
        daftar={daftar.filter((t) => t.metodeRefund === 'TUNAI')}
        memuat={menunggu.isLoading}
        metode="TUNAI"
        bolehTransfer={bolehTransfer}
        onKonfirmasi={setPilih}
        onGanti={setGantiCara}
      />
      <TabelMenunggu
        judul="Menunggu ditransfer"
        ket={
          bolehTransfer
            ? 'Kirim uangnya dari rekening toko, lalu klik Sudah ditransfer dan isi No. referensi dari bank.'
            : 'Ditransfer Admin/Owner yang memegang rekening toko.'
        }
        daftar={daftar.filter((t) => t.metodeRefund === 'TRANSFER')}
        memuat={menunggu.isLoading}
        metode="TRANSFER"
        bolehTransfer={bolehTransfer}
        onKonfirmasi={setPilih}
        onGanti={setGantiCara}
      />
      <Card className="gap-0 overflow-hidden py-0">
        <div className="border-b p-3 font-semibold">Sudah dikembalikan (terbaru)</div>
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
                  {t.metodeRefund === 'TUNAI'
                    ? 'tunai dari kas shift'
                    : `transfer ke ${t.rekeningRefund ?? '-'} · ref. ${t.referensiRefund ?? '-'}`}{' '}
                  · {t.namaPenggunaTransfer}, {formatWaktu(t.waktuTransfer)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {pilih && <DialogKonfirmasi t={pilih} onTutup={() => setPilih(null)} />}
      {gantiCara && (
        <DialogAlasan
          judul={`Jadikan ${NAMA_CARA[lain(gantiCara.metodeRefund)]}: ${gantiCara.nomor}`}
          ket={`Pengembalian ${formatRupiah(gantiCara.nominalRefund)} untuk ${gantiCara.namaPelanggan ?? 'pembeli umum'} dipindah dari ${NAMA_CARA[gantiCara.metodeRefund]} ke ${NAMA_CARA[lain(gantiCara.metodeRefund)]}. Uang belum keluar sampai dikonfirmasi.`}
          label="Alasan ganti cara"
          saran={SARAN_ALASAN.gantiCaraPengembalian}
          tombol="Ganti cara"
          onTutup={() => setGantiCara(null)}
          onKirim={(alasan) =>
            ganti.mutateAsync({
              id: gantiCara.id,
              json: { metode: lain(gantiCara.metodeRefund), alasan },
            })
          }
        />
      )}
    </div>
  );
}
