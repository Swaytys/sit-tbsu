import { lebarKarakterStruk } from '@sit/shared';
import { Printer } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useTampilanToko } from '@/api/pengaturan';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  bacaPengaturanPrinter,
  dukungCetakLangsung,
  namaPort,
  PILIHAN_BAUD,
  pilihPrinter,
  simpanPengaturanPrinter,
  type PengaturanPrinter,
} from '@/lib/printer-thermal';
import { cetakUjiLangsung } from '@/lib/struk-escpos';

const OTOMATIS = 'OTOMATIS';
const PILIHAN_LEBAR = [30, 32, 42, 48] as const;

function Saklar({
  label,
  ket,
  nilai,
  onUbah,
  nonaktif,
}: {
  label: string;
  ket: string;
  nilai: boolean;
  onUbah: (v: boolean) => void;
  nonaktif?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-muted-foreground text-sm">{ket}</p>
      </div>
      <Switch checked={nilai} onCheckedChange={onUbah} disabled={nonaktif} aria-label={label} />
    </div>
  );
}

/**
 * Printer struk komputer ini (K-103): cetak langsung ke printer thermal tanpa jendela cetak. Berlaku per
 * komputer (disimpan di peramban), karena printer tersambung ke komputer kasir, bukan ke server.
 */
export function KartuPrinterStruk() {
  const toko = useTampilanToko().data;
  const dukung = dukungCetakLangsung();
  const [p, setP] = useState<PengaturanPrinter>(bacaPengaturanPrinter);
  const [sibuk, setSibuk] = useState(false);

  function ubah(ubahan: Partial<PengaturanPrinter>) {
    const baru = { ...p, ...ubahan };
    setP(baru);
    simpanPengaturanPrinter(baru);
  }

  const galat = (err: unknown) =>
    toast.error(err instanceof Error ? err.message : 'Printer tidak bisa dipakai.');

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex items-center gap-2.5 border-b bg-slate-50 px-6 py-4">
        <Printer className="size-4 text-blue-600" />
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Printer struk komputer ini</h2>
          <p className="text-xs text-slate-500">
            Berlaku untuk komputer dan peramban yang sedang dipakai. Tiap komputer kasir diatur
            sendiri.
          </p>
        </div>
      </div>
      <div className="space-y-4 p-6">
        {!dukung && (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Peramban ini tidak bisa mencetak langsung ke printer. Buka aplikasi dengan{' '}
            <b>Google Chrome</b> atau <b>Microsoft Edge</b> di komputer kasir. Di peramban lain
            struk tetap bisa dicetak, tetapi lewat jendela cetak.
          </p>
        )}
        <Saklar
          label="Cetak struk langsung ke printer thermal"
          ket="Struk keluar seketika tanpa jendela cetak dan tanpa mengatur kertas. Mati = struk dicetak lewat jendela cetak peramban."
          nilai={p.langsung && dukung}
          nonaktif={!dukung}
          onUbah={(v) => ubah({ langsung: v })}
        />

        <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
          <div className="min-w-48 flex-1">
            <p className="text-sm font-medium">Printer</p>
            <p className="text-muted-foreground text-sm" data-testid="printer-terpilih">
              {namaPort(p.info)}
            </p>
          </div>
          <Button
            variant="outline"
            disabled={!dukung || sibuk}
            onClick={() =>
              void pilihPrinter()
                .then((info) => {
                  setP((x) => ({ ...x, info }));
                  toast.success('Printer dipilih. Coba "Uji cetak".');
                })
                .catch(galat)
            }
          >
            Pilih printer…
          </Button>
          <Button
            disabled={!dukung || !toko || sibuk}
            onClick={() => {
              if (!toko) return;
              setSibuk(true);
              void cetakUjiLangsung(toko)
                .then(() => toast.success('Halaman uji dikirim ke printer.'))
                .catch(galat)
                .finally(() => setSibuk(false));
            }}
          >
            {sibuk ? 'Mencetak…' : 'Uji cetak'}
          </Button>
          <p className="w-full text-xs text-slate-500">
            Printer Bluetooth: pasangkan dulu di Windows (Bluetooth &amp; perangkat). Di daftar
            pilihan ia tampil sebagai <i>Standard Serial over Bluetooth (COM…)</i>; bila ada dua,
            coba satu per satu dengan Uji cetak. Printer USB biasa yang tidak muncul di daftar tetap
            bisa dipakai lewat jendela cetak.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="lebar-karakter">Karakter per baris</Label>
            <Select
              value={p.lebarKarakter === null ? OTOMATIS : String(p.lebarKarakter)}
              onValueChange={(v) => ubah({ lebarKarakter: v === OTOMATIS ? null : Number(v) })}
            >
              <SelectTrigger id="lebar-karakter" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={OTOMATIS}>
                  Otomatis ({toko ? lebarKarakterStruk(toko.lebarStrukMm) : 32}, dari lebar kertas)
                </SelectItem>
                {PILIHAN_LEBAR.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} karakter
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">
              Ubah bila baris angka pada uji cetak turun ke baris berikutnya atau menyisakan ruang.
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="baud-printer">Kecepatan port (baud)</Label>
            <Select value={String(p.baud)} onValueChange={(v) => ubah({ baud: Number(v) })}>
              <SelectTrigger id="baud-printer" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PILIHAN_BAUD.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">
              Biarkan 9600 untuk printer Bluetooth. Untuk printer USB-serial, ikuti buku petunjuknya
              bila hasil cetak berupa huruf acak.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Saklar
            label="Potong kertas otomatis"
            ket="Printer tanpa pemotong mengabaikannya."
            nilai={p.potong}
            onUbah={(v) => ubah({ potong: v })}
          />
          <Saklar
            label="Buka laci uang"
            ket="Saat struk penjualan tunai dicetak (laci tersambung ke printer)."
            nilai={p.bukaLaci}
            onUbah={(v) => ubah({ bukaLaci: v })}
          />
        </div>
      </div>
    </Card>
  );
}
