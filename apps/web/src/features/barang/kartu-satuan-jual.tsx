import {
  faktorSatuan,
  formatRupiah,
  hargaSatuanJual,
  JENIS_DIMENSI_FISIK,
  skemaSimpanSatuanJual,
  type DetailBarang,
  type Satuan,
  type StatusAktif,
  type TingkatHarga,
} from '@sit/shared';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { usePengguna } from '@/api/auth';
import { pesanGalat } from '@/api/client';
import { useSimpanSatuanJual } from '@/api/barang';
import { InputRupiah } from '@/components/input-rupiah';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

/*
 * Satuan jual barang (Fase 12, K-091): satuan alternatif dengan faktor ke satuan dasar, barcode sendiri, satuan
 * bawaan saat dijual, dan harga per tier (otomatis = harga satuan dasar × faktor, atau tetap).
 */

const DIMENSI_FISIK: readonly string[] = JENIS_DIMENSI_FISIK;
/** Pembulatan harga untuk perkiraan di layar; nilai final dihitung API dengan konfigurasi toko. */
const KELIPATAN_PERKIRAAN = 100;

type Isian = {
  kunci: number;
  idSatuan: number | null;
  faktor: string;
  barcode: string;
  isDefaultJual: boolean;
  statusAktif: StatusAktif;
  hargaTetap: Record<number, number | null>;
};

let nomorKunci = 0;

function dariBarang(b: DetailBarang): Isian[] {
  return b.satuanJual.map((s) => ({
    kunci: ++nomorKunci,
    idSatuan: s.idSatuan,
    faktor: s.faktor,
    barcode: s.barcode ?? '',
    isDefaultJual: s.isDefaultJual,
    statusAktif: s.statusAktif,
    hargaTetap: Object.fromEntries(
      s.harga.filter((h) => h.tetap).map((h) => [h.idTingkatHarga, h.hargaJual]),
    ),
  }));
}

export function KartuSatuanJual({
  barang,
  satuan,
  tier,
}: {
  barang: DetailBarang;
  satuan: Satuan[];
  tier: TingkatHarga[];
}) {
  const simpan = useSimpanSatuanJual();
  const bolehHarga = usePengguna().izin.includes('master.harga.kelola');
  const [isi, setIsi] = useState<Isian[]>(() => dariBarang(barang));
  const [galat, setGalat] = useState<string | null>(null);
  const dasar = satuan.find((s) => s.id === barang.idSatuanDasar);
  const tierAktif = tier.filter((t) => t.statusAktif === 'AKTIF');
  const pilihan = satuan.filter(
    (s) =>
      s.id !== barang.idSatuanDasar &&
      (s.statusAktif === 'AKTIF' || isi.some((x) => x.idSatuan === s.id)),
  );

  /** Faktor otomatis untuk satuan fisik berdimensi sama dengan satuan dasar (mis. cm terhadap m). */
  function faktorOtomatis(idSatuan: number | null): string | null {
    const s = satuan.find((x) => x.id === idSatuan);
    if (!s || !dasar) return null;
    if (s.jenisDimensi !== dasar.jenisDimensi || !DIMENSI_FISIK.includes(s.jenisDimensi))
      return null;
    return faktorSatuan(s.faktorKeBasis, dasar.faktorKeBasis);
  }

  function ubah(kunci: number, perubahan: Partial<Isian>) {
    setIsi((lama) =>
      lama.map((x) => {
        if (x.kunci !== kunci) {
          // Hanya satu satuan bawaan.
          return perubahan.isDefaultJual ? { ...x, isDefaultJual: false } : x;
        }
        const baru = { ...x, ...perubahan };
        const otomatis = faktorOtomatis(baru.idSatuan);
        return otomatis ? { ...baru, faktor: otomatis } : baru;
      }),
    );
  }

  async function kirim() {
    setGalat(null);
    const data = skemaSimpanSatuanJual.safeParse({
      baris: isi.map((x) => ({
        idSatuan: x.idSatuan,
        faktor: x.faktor,
        barcode: x.barcode,
        isDefaultJual: x.isDefaultJual,
        statusAktif: x.statusAktif,
        hargaTetap: bolehHarga
          ? tierAktif.map((t) => ({ idTingkatHarga: t.id, harga: x.hargaTetap[t.id] ?? null }))
          : [],
      })),
    });
    if (!data.success) {
      const i = data.error.issues[0];
      const baris = typeof i?.path[1] === 'number' ? `Satuan jual ${i.path[1] + 1}: ` : '';
      setGalat(`${baris}${i?.message ?? 'Isian belum lengkap.'}`);
      return;
    }
    try {
      const hasil = await simpan.mutateAsync({ id: barang.id, json: data.data });
      setIsi(dariBarang(hasil));
      toast.success('Satuan jual disimpan.');
    } catch (err) {
      setGalat(pesanGalat(err));
    }
  }

  const hargaDasar = (idTier: number) =>
    barang.harga.find((h) => h.idTingkatHarga === idTier)?.hargaJual ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Satuan jual</CardTitle>
        <CardDescription>
          Jual barang ini dalam satuan lain (mis. dus isi 12, roll 50 m). Stok tetap dihitung dalam
          satuan dasar <b>{barang.kodeSatuan}</b>. Harga kosong = otomatis (harga{' '}
          {barang.kodeSatuan} × faktor).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isi.length === 0 && (
          <p className="rounded-md border border-dashed p-4 text-center text-sm text-slate-500">
            Belum ada satuan jual; barang dijual per {barang.kodeSatuan}.
          </p>
        )}
        {isi.map((x, i) => {
          const otomatis = faktorOtomatis(x.idSatuan);
          const kode = satuan.find((s) => s.id === x.idSatuan)?.kode ?? 'satuan';
          return (
            <div
              key={x.kunci}
              className="space-y-3 rounded-lg border p-3"
              data-testid="baris-satuan-jual"
            >
              <div className="grid grid-cols-[1fr_120px_1fr_auto] items-end gap-3">
                <div className="space-y-1.5">
                  <span className="text-sm font-medium">Satuan</span>
                  <Select
                    value={x.idSatuan ? String(x.idSatuan) : ''}
                    onValueChange={(v) => ubah(x.kunci, { idSatuan: Number(v) })}
                  >
                    <SelectTrigger className="w-full" aria-label={`Satuan jual ${i + 1}`}>
                      <SelectValue placeholder="Pilih satuan" />
                    </SelectTrigger>
                    <SelectContent>
                      {pilihan.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.nama} ({s.kode})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <span className="text-sm font-medium">Isi ({barang.kodeSatuan})</span>
                  <Input
                    inputMode="decimal"
                    aria-label={`Faktor satuan jual ${i + 1}`}
                    value={x.faktor}
                    disabled={otomatis !== null}
                    onChange={(e) => ubah(x.kunci, { faktor: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="text-sm font-medium">Barcode (opsional)</span>
                  <Input
                    aria-label={`Barcode satuan jual ${i + 1}`}
                    value={x.barcode}
                    onChange={(e) => ubah(x.kunci, { barcode: e.target.value })}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Hapus satuan jual ${i + 1}`}
                  title="Satuan yang sudah dipakai transaksi menjadi nonaktif"
                  onClick={() => setIsi((l) => l.filter((y) => y.kunci !== x.kunci))}
                >
                  <Trash2 className="text-slate-500" />
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-5 text-sm">
                <label className="flex items-center gap-2">
                  <Switch
                    checked={x.isDefaultJual}
                    onCheckedChange={(v) => ubah(x.kunci, { isDefaultJual: v })}
                    aria-label={`Satuan bawaan saat dijual ${i + 1}`}
                  />
                  Satuan bawaan saat dijual
                </label>
                <label className="flex items-center gap-2">
                  <Switch
                    checked={x.statusAktif === 'AKTIF'}
                    onCheckedChange={(v) =>
                      ubah(x.kunci, { statusAktif: v ? 'AKTIF' : 'NONAKTIF' })
                    }
                    aria-label={`Satuan jual aktif ${i + 1}`}
                  />
                  Aktif
                </label>
                {otomatis !== null && (
                  <span className="text-xs text-slate-500">
                    Faktor mengikuti tabel satuan (1 {kode} = {otomatis} {barang.kodeSatuan}).
                  </span>
                )}
              </div>
              {bolehHarga && (
                <div className="grid grid-cols-3 gap-3">
                  {tierAktif.map((t) => {
                    const d = hargaDasar(t.id);
                    const sah = /^\d+(\.\d+)?$/.test(x.faktor.replace(',', '.'));
                    const kiraan =
                      d !== null && sah
                        ? hargaSatuanJual(d, x.faktor.replace(',', '.'), KELIPATAN_PERKIRAAN)
                        : null;
                    return (
                      <div key={t.id} className="space-y-1">
                        <span className="text-xs font-medium text-slate-600">
                          Harga {t.nama} / {kode}
                        </span>
                        <InputRupiah
                          aria-label={`Harga ${t.nama} satuan jual ${i + 1}`}
                          value={x.hargaTetap[t.id] ?? null}
                          placeholder={
                            kiraan === null ? 'Otomatis' : `Otomatis ≈ ${formatRupiah(kiraan)}`
                          }
                          onChange={(v) =>
                            ubah(x.kunci, { hargaTetap: { ...x.hargaTetap, [t.id]: v } })
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {galat && <p className="text-sm text-red-600">{galat}</p>}
        <div className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isi.length >= 10}
            onClick={() =>
              setIsi((l) => [
                ...l,
                {
                  kunci: ++nomorKunci,
                  idSatuan: null,
                  faktor: '',
                  barcode: '',
                  isDefaultJual: false,
                  statusAktif: 'AKTIF',
                  hargaTetap: {},
                },
              ])
            }
          >
            <Plus /> Tambah satuan jual
          </Button>
          <Button type="button" size="sm" disabled={simpan.isPending} onClick={() => void kirim()}>
            {simpan.isPending ? 'Menyimpan…' : 'Simpan satuan jual'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
