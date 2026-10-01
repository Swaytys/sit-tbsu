import { formatRupiah, type DataPembayaran, type MetodePembayaran } from '@sit/shared';
import { Banknote, CreditCard, Landmark, Plus, Printer, X } from 'lucide-react';
import { useState } from 'react';
import { InputRupiah } from '@/components/input-rupiah';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const METODE: { kode: MetodePembayaran; label: string; ikon: typeof Banknote }[] = [
  { kode: 'TUNAI', label: 'Tunai', ikon: Banknote },
  { kode: 'TRANSFER', label: 'Transfer', ikon: Landmark },
  { kode: 'EDC', label: 'EDC', ikon: CreditCard },
];

const NOMINAL_CEPAT = [20_000, 50_000, 100_000, 200_000];

/**
 * Panel pembayaran kasir (docs/05 P8): tunai dengan uang diterima & kembalian, transfer/EDC dengan rekening,
 * dan bayar campuran. `bolehKurang` = pelanggan terdata (boleh DP/piutang, P6). Nilai final dihitung server.
 */
export function PanelPembayaran({
  total,
  bolehKurang,
  memproses,
  nonaktif = false,
  labelBayar = 'Bayar & cetak',
  onBayar,
}: {
  total: number;
  bolehKurang: boolean;
  memproses: boolean;
  nonaktif?: boolean;
  labelBayar?: string;
  onBayar: (pembayaran: DataPembayaran[]) => void;
}) {
  const [daftar, setDaftar] = useState<DataPembayaran[]>([]);
  const [metode, setMetode] = useState<MetodePembayaran>('TUNAI');
  const [uang, setUang] = useState<number | null>(null);
  const [nominal, setNominal] = useState<number | null>(null);
  const [rekening, setRekening] = useState('');
  const [referensi, setReferensi] = useState('');

  const sudah = daftar.reduce((t, p) => t + p.nominal, 0);
  const sisa = Math.max(0, total - sudah);
  const tunai = metode === 'TUNAI';
  // Tunai: nominal yang diakui = min(uang diterima, sisa); kelebihan = kembalian.
  const nominalKini = tunai ? Math.min(uang ?? 0, sisa) : (nominal ?? sisa);
  const kembalian = tunai && uang !== null ? Math.max(0, uang - sisa) : 0;
  const totalBayar = sudah + nominalKini;
  const kurang = total - totalBayar;
  const lengkap = !tunai ? rekening.trim() !== '' : true;
  const bolehBayar =
    !memproses &&
    !nonaktif &&
    lengkap &&
    (kurang <= 0 || bolehKurang) &&
    (totalBayar > 0 || bolehKurang);

  function entriKini(): DataPembayaran | null {
    if (nominalKini <= 0) return null;
    return tunai
      ? {
          metode,
          nominal: nominalKini,
          uangDiterima: uang,
          rekening: null,
          referensi: null,
          catatan: null,
        }
      : {
          metode,
          nominal: nominalKini,
          uangDiterima: null,
          rekening: rekening.trim(),
          referensi: referensi.trim() || null,
          catatan: null,
        };
  }

  function tambahMetode() {
    const e = entriKini();
    if (!e) return;
    setDaftar((d) => [...d, e]);
    setUang(null);
    setNominal(null);
    setRekening('');
    setReferensi('');
    setMetode(metode === 'TUNAI' ? 'TRANSFER' : 'TUNAI');
  }

  function bayar() {
    const e = entriKini();
    onBayar(e ? [...daftar, e] : daftar);
  }

  return (
    <form
      className="flex flex-1 flex-col"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (bolehBayar) bayar();
      }}
      aria-label="Pembayaran"
    >
      <div className="mb-3 grid grid-cols-3 gap-2">
        {METODE.map((m) => (
          <button
            key={m.kode}
            type="button"
            onClick={() => setMetode(m.kode)}
            aria-pressed={metode === m.kode}
            className={cn(
              'flex flex-col items-center rounded-lg border-2 p-2 text-sm font-medium transition-all',
              metode === m.kode
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-slate-200 text-slate-600 hover:border-blue-300',
            )}
          >
            <m.ikon className="mb-0.5 size-5" /> {m.label}
          </button>
        ))}
      </div>

      {daftar.length > 0 && (
        <ul className="mb-3 space-y-1 rounded-md bg-slate-50 p-2 text-sm">
          {daftar.map((p, i) => (
            <li key={i} className="flex items-center justify-between">
              <span>{p.metode === 'TUNAI' ? 'Tunai' : `${p.metode} · ${p.rekening}`}</span>
              <span className="flex items-center gap-2 tabular-nums">
                {formatRupiah(p.nominal)}
                <button
                  type="button"
                  aria-label="Hapus pembayaran"
                  onClick={() => setDaftar((d) => d.filter((_, j) => j !== i))}
                >
                  <X className="size-3.5 text-slate-400" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {tunai ? (
        <div className="space-y-2">
          <label htmlFor="uang-diterima" className="text-sm font-bold text-slate-700">
            Uang diterima
          </label>
          <InputRupiah
            id="uang-diterima"
            value={uang}
            onChange={setUang}
            className="h-12 text-2xl font-bold"
            aria-label="Uang diterima"
          />
          <div className="grid grid-cols-5 gap-1.5">
            <button
              type="button"
              className="rounded-md border bg-white py-1.5 text-xs font-bold hover:border-blue-300"
              onClick={() => setUang(sisa)}
            >
              Uang pas
            </button>
            {NOMINAL_CEPAT.map((n) => (
              <button
                key={n}
                type="button"
                className="rounded-md border bg-white py-1.5 text-xs font-bold hover:border-blue-300"
                onClick={() => setUang(n)}
              >
                {n / 1000}rb
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-700" htmlFor="nominal-bayar">
            Nominal
          </label>
          <InputRupiah
            id="nominal-bayar"
            value={nominal ?? sisa}
            onChange={setNominal}
            aria-label="Nominal non tunai"
          />
          <Input
            value={rekening}
            onChange={(e) => setRekening(e.target.value)}
            placeholder={
              metode === 'EDC' ? 'Mesin EDC (mis. EDC BRI)' : 'Rekening tujuan (mis. BCA 123)'
            }
            aria-label="Rekening tujuan"
            maxLength={60}
          />
          <Input
            value={referensi}
            onChange={(e) => setReferensi(e.target.value)}
            placeholder="No. referensi (opsional)"
            aria-label="Nomor referensi"
            maxLength={60}
          />
        </div>
      )}

      {nominalKini > 0 && nominalKini < sisa && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2 self-start"
          onClick={tambahMetode}
        >
          <Plus /> Tambah metode lain (bayar campuran)
        </Button>
      )}

      <div className="mt-auto space-y-1 border-t pt-3">
        <div className="flex items-end justify-between">
          <span className="text-slate-500">Kembalian</span>
          <span className="text-2xl font-black text-blue-600 tabular-nums" data-testid="kembalian">
            {formatRupiah(kembalian)}
          </span>
        </div>
        {kurang > 0 && (
          <div className="flex justify-between text-sm">
            <span className={bolehKurang ? 'text-amber-700' : 'text-red-600'}>
              {bolehKurang ? 'Sisa jadi piutang' : 'Kurang bayar'}
            </span>
            <span className="font-semibold tabular-nums">{formatRupiah(kurang)}</span>
          </div>
        )}
        <Button
          type="submit"
          className="mt-2 h-12 w-full bg-emerald-600 text-base font-black hover:bg-emerald-700"
          disabled={!bolehBayar}
        >
          <Printer /> {memproses ? 'Memproses…' : `${labelBayar} (Enter)`}
        </Button>
      </div>
    </form>
  );
}
