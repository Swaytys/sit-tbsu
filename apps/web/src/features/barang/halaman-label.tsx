import { formatRupiah, type BarisBarang } from '@sit/shared';
import { ArrowLeft, Minus, Plus, Printer, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { useDaftarTingkatHarga } from '@/api/mitra';
import { AreaCetak } from '@/components/area-cetak';
import { Barcode } from '@/components/barcode';
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
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

/*
 * Cetak label barang (Fase 12, K-090): label harga rak atau stiker barcode di kertas label A4. Barcode = barcode
 * pabrik bila ada, selain itu kode barang (keduanya bisa dicari di layar kasir).
 */

type TataLetak = {
  nama: string;
  kolom: number;
  baris: number;
  lebarMm: number;
  tinggiMm: number;
  margin: string;
};

const TATA_LETAK = {
  RAK: {
    nama: 'Label harga rak — 3 × 8 per A4 (63,5 × 33,9 mm)',
    kolom: 3,
    baris: 8,
    lebarMm: 63.5,
    tinggiMm: 33.9,
    margin: '13mm 7mm',
  },
  STIKER: {
    nama: 'Stiker barcode — 4 × 10 per A4 (48,5 × 25,4 mm)',
    kolom: 4,
    baris: 10,
    lebarMm: 48.5,
    tinggiMm: 25.4,
    margin: '21mm 8mm',
  },
} as const satisfies Record<string, TataLetak>;
type KodeTataLetak = keyof typeof TATA_LETAK;

type Isi = { barang: BarisBarang; jumlah: number };

function kodeBarcode(b: BarisBarang): string {
  return b.barcode?.trim() || b.kode;
}

function SatuLabel({
  b,
  harga,
  t,
  tampilHarga,
}: {
  b: BarisBarang;
  harga: number | null;
  t: TataLetak;
  tampilHarga: boolean;
}) {
  const kecil = t.tinggiMm < 30;
  return (
    <div
      className="flex flex-col overflow-hidden border border-dashed border-slate-300 bg-white px-[2mm] py-[1.5mm] text-black print:border-0"
      style={{ width: `${t.lebarMm}mm`, height: `${t.tinggiMm}mm` }}
    >
      <div
        className={`line-clamp-2 leading-tight font-semibold ${kecil ? 'text-[7pt]' : 'text-[8.5pt]'}`}
      >
        {b.namaBarang}
      </div>
      {tampilHarga && harga !== null && (
        <div className={`leading-tight font-bold ${kecil ? 'text-[10pt]' : 'text-[14pt]'}`}>
          {formatRupiah(harga)}
          <span className="text-[7pt] font-normal"> /{b.kodeSatuan}</span>
        </div>
      )}
      <div className="mt-auto">
        <Barcode nilai={kodeBarcode(b)} className="block h-[7mm] w-full" />
        <div className="text-center font-mono text-[6.5pt] leading-none">{kodeBarcode(b)}</div>
      </div>
    </div>
  );
}

function Lembar({
  label,
  t,
  tampilHarga,
}: {
  label: ({ b: BarisBarang; harga: number | null } | null)[];
  t: TataLetak;
  tampilHarga: boolean;
}) {
  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${t.kolom}, ${t.lebarMm}mm)`,
        gridAutoRows: `${t.tinggiMm}mm`,
      }}
    >
      {label.map((l, i) =>
        l ? (
          <SatuLabel key={i} b={l.b} harga={l.harga} t={t} tampilHarga={tampilHarga} />
        ) : (
          <div key={i} style={{ width: `${t.lebarMm}mm`, height: `${t.tinggiMm}mm` }} />
        ),
      )}
    </div>
  );
}

/** Data Barang › Cetak label. */
export function HalamanLabel() {
  const tier = (useDaftarTingkatHarga().data ?? []).filter((x) => x.statusAktif === 'AKTIF');
  const [idTier, setIdTier] = useState<number | null>(null);
  const tierDipakai = idTier ?? tier.find((x) => x.isDefault)?.id ?? null;
  const [kode, setKode] = useState<KodeTataLetak>('RAK');
  const [tampilHarga, setTampilHarga] = useState(true);
  const [mulai, setMulai] = useState(1);
  const [isi, setIsi] = useState<Isi[]>([]);
  const [cetak, setCetak] = useState(false);
  const t = TATA_LETAK[kode];
  const perLembar = t.kolom * t.baris;

  useEffect(() => {
    if (!cetak) return;
    const h = setTimeout(() => {
      window.print();
      setCetak(false);
    }, 200);
    return () => clearTimeout(h);
  }, [cetak]);

  function tambah(b: BarisBarang) {
    setIsi((lama) =>
      lama.some((x) => x.barang.id === b.id)
        ? lama.map((x) => (x.barang.id === b.id ? { ...x, jumlah: x.jumlah + 1 } : x))
        : [...lama, { barang: b, jumlah: 1 }],
    );
  }

  const harga = (b: BarisBarang) =>
    b.harga.find((h) => h.idTingkatHarga === tierDipakai)?.hargaJual ?? null;
  const awal = Math.min(Math.max(1, mulai), perLembar) - 1;
  const semua: ({ b: BarisBarang; harga: number | null } | null)[] = [
    ...Array<null>(awal).fill(null),
    ...isi.flatMap((x) =>
      Array.from({ length: x.jumlah }, () => ({ b: x.barang, harga: harga(x.barang) })),
    ),
  ];
  const lembar: (typeof semua)[] = [];
  for (let i = 0; i < semua.length; i += perLembar) lembar.push(semua.slice(i, i + perLembar));
  const jumlahLabel = isi.reduce((a, x) => a + x.jumlah, 0);

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link to="/barang" aria-label="Kembali ke data barang">
              <ArrowLeft />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Cetak label barang</h1>
            <p className="text-sm text-slate-500">
              Label harga rak atau stiker barcode di kertas label A4. Barcode memakai barcode pabrik
              bila ada, selain itu kode barang; keduanya bisa dipindai di layar kasir.
            </p>
          </div>
        </div>
        <Button
          onClick={() =>
            jumlahLabel === 0 ? toast.error('Tambahkan barang dulu.') : setCetak(true)
          }
        >
          <Printer /> Cetak {jumlahLabel} label
        </Button>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4">
        <div className="space-y-4">
          <Card className="grid grid-cols-3 gap-4 p-4">
            <div className="col-span-3 space-y-1.5">
              <Label>Jenis label</Label>
              <Select value={kode} onValueChange={(v) => setKode(v as KodeTataLetak)}>
                <SelectTrigger className="w-full" aria-label="Jenis label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TATA_LETAK) as KodeTataLetak[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {TATA_LETAK[k].nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Harga tier</Label>
              <Select
                value={tierDipakai ? String(tierDipakai) : ''}
                onValueChange={(v) => setIdTier(Number(v))}
              >
                <SelectTrigger className="w-full" aria-label="Harga tier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tier.map((x) => (
                    <SelectItem key={x.id} value={String(x.id)}>
                      {x.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="label-mulai">Mulai dari label ke-</Label>
              <Input
                id="label-mulai"
                type="number"
                min={1}
                max={perLembar}
                value={mulai}
                onChange={(e) => setMulai(Number(e.target.value) || 1)}
              />
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <Switch
                checked={tampilHarga}
                onCheckedChange={setTampilHarga}
                aria-label="Tampilkan harga"
              />
              Tampilkan harga
            </label>
          </Card>

          <Card className="gap-0 py-0">
            <div className="border-b p-4">
              <PilihBarang
                onPilih={tambah}
                placeholder="Cari barang untuk dibuatkan label… lalu Enter"
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Barang</TableHead>
                  <TableHead>Barcode</TableHead>
                  <TableHead className="text-right">Harga</TableHead>
                  <TableHead className="w-40 text-center">Jumlah label</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isi.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-slate-500">
                      Belum ada barang. Cari barang di atas.
                    </TableCell>
                  </TableRow>
                )}
                {isi.map((x) => (
                  <TableRow key={x.barang.id}>
                    <TableCell>
                      <div className="font-medium">{x.barang.namaBarang}</div>
                      <div className="font-mono text-xs text-slate-500">{x.barang.kode}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{kodeBarcode(x.barang)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {harga(x.barang) === null ? '—' : formatRupiah(harga(x.barang) ?? 0)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="outline"
                          size="icon-sm"
                          aria-label={`Kurangi label ${x.barang.namaBarang}`}
                          onClick={() =>
                            setIsi((l) =>
                              l.map((y) =>
                                y.barang.id === x.barang.id
                                  ? { ...y, jumlah: Math.max(1, y.jumlah - 1) }
                                  : y,
                              ),
                            )
                          }
                        >
                          <Minus />
                        </Button>
                        <Input
                          className="w-16 text-center"
                          inputMode="numeric"
                          aria-label={`Jumlah label ${x.barang.namaBarang}`}
                          value={x.jumlah}
                          onChange={(e) => {
                            const n = Math.min(500, Math.max(1, Number(e.target.value) || 1));
                            setIsi((l) =>
                              l.map((y) => (y.barang.id === x.barang.id ? { ...y, jumlah: n } : y)),
                            );
                          }}
                        />
                        <Button
                          variant="outline"
                          size="icon-sm"
                          aria-label={`Tambah label ${x.barang.namaBarang}`}
                          onClick={() =>
                            setIsi((l) =>
                              l.map((y) =>
                                y.barang.id === x.barang.id
                                  ? { ...y, jumlah: Math.min(500, y.jumlah + 1) }
                                  : y,
                              ),
                            )
                          }
                        >
                          <Plus />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Hapus ${x.barang.namaBarang}`}
                        onClick={() => setIsi((l) => l.filter((y) => y.barang.id !== x.barang.id))}
                      >
                        <Trash2 className="text-slate-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>

        <Card className="w-[340px] gap-2 self-start p-3">
          <div className="text-sm font-semibold text-slate-700">
            Pratinjau lembar 1 dari {Math.max(1, lembar.length)}
          </div>
          <div className="h-[460px] overflow-hidden rounded border bg-slate-50">
            <div className="origin-top-left scale-[0.4] p-[8mm]" style={{ width: '210mm' }}>
              <Lembar label={lembar[0] ?? []} t={t} tampilHarga={tampilHarga} />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Garis putus-putus hanya di layar. Cetak dengan skala 100% (tanpa "fit to page").
          </p>
        </Card>
      </div>

      {cetak && (
        <AreaCetak
          ukuranKertas="A4"
          css={`
            @page {
              size: A4;
              margin: ${t.margin};
            }
          `}
        >
          {lembar.map((l, i) => (
            <div key={i} style={{ breakAfter: i < lembar.length - 1 ? 'page' : 'auto' }}>
              <Lembar label={l} t={t} tampilHarga={tampilHarga} />
            </div>
          ))}
        </AreaCetak>
      )}
    </div>
  );
}
