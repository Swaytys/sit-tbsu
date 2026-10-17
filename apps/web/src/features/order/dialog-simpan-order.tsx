import { MAKS_HARI_SIMPAN_ORDER, skemaSimpanOrder, type DetailOrder } from '@sit/shared';
import { addDays, format, parseISO } from 'date-fns';
import { CalendarClock } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { pesanGalat } from '@/api/client';
import { useSimpanUntukNanti } from '@/api/penjualan';
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
import { Label } from '@/components/ui/label';
import { formatTanggal, tanggalHariIni } from '@/lib/format';
import { cn } from '@/lib/utils';

const geser = (hari: number) => format(addDays(parseISO(tanggalHariIni()), hari), 'yyyy-MM-dd');

const PILIHAN_TANGGAL: { label: string; hari: number }[] = [
  { label: 'Hari ini', hari: 0 },
  { label: 'Besok', hari: 1 },
  { label: '3 hari', hari: 3 },
  { label: '7 hari', hari: 7 },
  { label: `${MAKS_HARI_SIMPAN_ORDER} hari`, hari: MAKS_HARI_SIMPAN_ORDER },
];

export type OrderUntukDisimpan = {
  nomor?: string;
  /** Nama pelanggan terdaftar (bila ada); nama pembeli tidak perlu diisi lagi. */
  namaPelanggan: string | null;
  namaPembeli: string | null;
  noHp: string | null;
};

/**
 * Simpan order untuk diambil/dibayar nanti (K-122, docs/05 R11). `siapkan` mengembalikan id order yang akan
 * disimpan: order yang sudah ada langsung, isian layar order disimpan dulu sebagai draf.
 */
export function DialogSimpanOrder({
  order,
  siapkan,
  onTersimpan,
  onTutup,
  fokusSesudah,
}: {
  order: OrderUntukDisimpan;
  siapkan: () => Promise<number>;
  onTersimpan: (d: DetailOrder) => void;
  onTutup: () => void;
  /** Id elemen yang difokus setelah dialog tertutup (mis. kotak cari barang). */
  fokusSesudah?: string;
}) {
  const simpan = useSimpanUntukNanti();
  const [nama, setNama] = useState(order.namaPembeli ?? '');
  const [hp, setHp] = useState(order.noHp ?? '');
  const [tanggal, setTanggal] = useState(geser(1));
  const [galat, setGalat] = useState<Record<string, string>>({});
  const [memproses, setMemproses] = useState(false);
  const hariIni = tanggalHariIni();
  const batas = geser(MAKS_HARI_SIMPAN_ORDER);

  function periksa(): boolean {
    const g: Record<string, string> = {};
    const hasil = skemaSimpanOrder.safeParse({
      namaPembeli: order.namaPelanggan ? null : nama,
      noHp: hp,
      tanggalAmbil: tanggal,
    });
    if (!hasil.success) {
      for (const i of hasil.error.issues) g[String(i.path[0])] ??= i.message;
    }
    if (!order.namaPelanggan && !nama.trim()) {
      g.namaPembeli = 'Nama pembeli wajib diisi untuk order yang disimpan.';
    }
    if (!g.tanggalAmbil && tanggal < hariIni) {
      g.tanggalAmbil = 'Tanggal ambil tidak boleh sebelum hari ini.';
    }
    if (!g.tanggalAmbil && tanggal > batas) {
      g.tanggalAmbil = `Order disimpan paling lama ${MAKS_HARI_SIMPAN_ORDER} hari (sampai ${formatTanggal(batas)}).`;
    }
    setGalat(g);
    return Object.keys(g).length === 0;
  }

  async function kirim() {
    if (memproses || !periksa()) return;
    setMemproses(true);
    try {
      const id = await siapkan();
      const d = await simpan.mutateAsync({
        id,
        json: {
          namaPembeli: order.namaPelanggan ? null : nama.trim(),
          noHp: hp.trim(),
          tanggalAmbil: tanggal,
        },
      });
      toast.success(
        `Order ${d.nomor} disimpan untuk ${d.namaPelanggan ?? d.namaPembeli ?? ''}, diambil ${formatTanggal(tanggal)}. Stok ditahan.`,
      );
      onTersimpan(d);
    } catch (err) {
      toast.error(pesanGalat(err));
    } finally {
      setMemproses(false);
    }
  }

  return (
    <Dialog open onOpenChange={(b) => !b && !memproses && onTutup()}>
      <DialogContent
        className="sm:max-w-md"
        onCloseAutoFocus={(e) => {
          if (!fokusSesudah) return;
          e.preventDefault();
          document.getElementById(fokusSesudah)?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="size-5" /> Simpan untuk diambil nanti
            {order.nomor ? ` (${order.nomor})` : ''}
          </DialogTitle>
          <DialogDescription>
            Untuk pembeli yang pesan sekarang dan datang mengambil/membayar nanti. Barangnya{' '}
            <b>ditahan</b> (tidak bisa dijual ke pembeli lain) sampai order dibayar atau dibatalkan.
            Order tidak masuk antrean kasir; tampil di <b>Order › Disimpan</b>.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void kirim();
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="simpan-nama">Nama pembeli</Label>
            {order.namaPelanggan ? (
              <p className="rounded-md border bg-slate-50 px-3 py-2 text-sm">
                {order.namaPelanggan} <span className="text-slate-500">(pelanggan terdaftar)</span>
              </p>
            ) : (
              <Input
                id="simpan-nama"
                value={nama}
                maxLength={100}
                autoFocus
                onChange={(e) => setNama(e.target.value)}
                aria-invalid={!!galat.namaPembeli}
              />
            )}
            {galat.namaPembeli && <p className="text-xs text-red-600">{galat.namaPembeli}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="simpan-hp">No. HP pembeli</Label>
            <Input
              id="simpan-hp"
              value={hp}
              maxLength={20}
              inputMode="tel"
              autoFocus={!!order.namaPelanggan}
              onChange={(e) => setHp(e.target.value)}
              placeholder="mis. 0812 3456 7890"
              aria-invalid={!!galat.noHp}
            />
            {galat.noHp && <p className="text-xs text-red-600">{galat.noHp}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="simpan-tanggal">Rencana tanggal ambil</Label>
            <div className="flex flex-wrap gap-1">
              {PILIHAN_TANGGAL.map((p) => {
                const t = geser(p.hari);
                return (
                  <button
                    key={p.hari}
                    type="button"
                    onClick={() => setTanggal(t)}
                    className={cn(
                      'rounded border px-2 py-0.5 text-xs',
                      tanggal === t
                        ? 'border-blue-500 bg-blue-50 font-semibold text-blue-800'
                        : 'border-slate-300 text-slate-600 hover:bg-slate-50',
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            <Input
              id="simpan-tanggal"
              type="date"
              value={tanggal}
              min={hariIni}
              max={batas}
              onChange={(e) => setTanggal(e.target.value)}
              aria-invalid={!!galat.tanggalAmbil}
            />
            {galat.tanggalAmbil ? (
              <p className="text-xs text-red-600">{galat.tanggalAmbil}</p>
            ) : (
              <p className="text-xs text-slate-500">
                Paling lama {MAKS_HARI_SIMPAN_ORDER} hari. Bila lewat, lonceng mengingatkan untuk
                menghubungi pembeli; order <b>tidak</b> dibatalkan otomatis.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onTutup} disabled={memproses}>
              Batal (Esc)
            </Button>
            <Button type="submit" disabled={memproses}>
              {memproses ? 'Menyimpan…' : 'Simpan order (Enter)'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
