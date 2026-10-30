import {
  dariSatuanSimpan,
  keSatuanSimpan,
  SATUAN_BERAT,
  SATUAN_PANJANG,
  SATUAN_VOLUME,
  type DataBarang,
  type InputBarang,
} from '@sit/shared';
import { Truck } from 'lucide-react';
import { useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type Kunci = 'beratKg' | 'panjangCm' | 'lebarCm' | 'tinggiCm' | 'volumeM3';

const kelasPilih = 'h-9 rounded-md border bg-white px-1.5 text-sm';

/**
 * K-161: data muatan barang (per satuan dasar) untuk menghitung muatan kendaraan. Isian boleh dalam satuan apa
 * pun yang sejenis (g/kg/ton, mm/cm/dm/m, L/m³); yang dikirim ke API selalu kg, cm, dan m³.
 */
export function KartuMuatan({
  kodeSatuan,
  onSelesai,
}: {
  kodeSatuan: string;
  /** K-201: isian selesai (pindah kotak/Enter) → atribut ikut diselaraskan. */
  onSelesai?: (k: Kunci) => void;
}) {
  const form = useFormContext<InputBarang, unknown, DataBarang>();
  const awal = form.getValues('muatan');
  const dariForm = useWatch({ control: form.control, name: 'muatan' });
  const curah = useWatch({ control: form.control, name: 'muatan.curah' }) ?? false;
  const [satBerat, setSatBerat] = useState<keyof typeof SATUAN_BERAT>('kg');
  const [satUkuran, setSatUkuran] = useState<keyof typeof SATUAN_PANJANG>('cm');
  const [satVolume, setSatVolume] = useState<keyof typeof SATUAN_VOLUME>('m3');
  const nilaiAwal = (k: Kunci) => {
    const v = awal?.[k];
    return typeof v === 'string' || typeof v === 'number' ? String(v).replace('.', ',') : '';
  };
  const [teks, setTeks] = useState<Record<Kunci, string>>({
    beratKg: nilaiAwal('beratKg'),
    panjangCm: nilaiAwal('panjangCm'),
    lebarCm: nilaiAwal('lebarCm'),
    tinggiCm: nilaiAwal('tinggiCm'),
    volumeM3: nilaiAwal('volumeM3'),
  });
  const galat = form.formState.errors.muatan;
  // K-201: nilai muatan diubah dari luar (atribut) → angka di layar ikut, dalam satuan isian yang dipilih.
  const [terakhir, setTerakhir] = useState(dariForm);
  if (dariForm !== terakhir) {
    setTerakhir(dariForm);
    const baru = { ...teks };
    let beda = false;
    for (const k of ['beratKg', 'panjangCm', 'lebarCm', 'tinggiCm', 'volumeM3'] as Kunci[]) {
      const v = dariForm?.[k];
      const simpan = typeof v === 'string' || typeof v === 'number' ? String(v) : null;
      if (simpan !== keSatuanSimpan(teks[k], faktor(k)) && simpan !== null) {
        baru[k] = dariSatuanSimpan(simpan, faktor(k));
        beda = true;
      }
    }
    if (beda) setTeks(baru);
  }

  function faktor(k: Kunci, sat?: string): string {
    if (k === 'beratKg') return SATUAN_BERAT[(sat ?? satBerat) as keyof typeof SATUAN_BERAT];
    if (k === 'volumeM3') return SATUAN_VOLUME[(sat ?? satVolume) as keyof typeof SATUAN_VOLUME];
    return SATUAN_PANJANG[(sat ?? satUkuran) as keyof typeof SATUAN_PANJANG];
  }

  function ubah(k: Kunci, v: string) {
    setTeks((t) => ({ ...t, [k]: v }));
    form.setValue(`muatan.${k}`, keSatuanSimpan(v, faktor(k)), {
      shouldDirty: true,
      shouldValidate: form.formState.isSubmitted,
    });
  }

  /** Ganti satuan: angka di layar dikonversi, nilai simpan tetap. */
  function gantiSatuan(kunci: Kunci[], baru: string) {
    setTeks((t) => {
      const n = { ...t };
      for (const k of kunci) {
        const simpan = keSatuanSimpan(t[k], faktor(k));
        // Hanya angka sah yang dikonversi; isian salah dibiarkan agar pesannya tetap tampil.
        if (simpan !== null && /^\d+(\.\d+)?$/.test(simpan)) {
          n[k] = dariSatuanSimpan(simpan, faktor(k, baru));
        }
      }
      return n;
    });
  }

  const isian = (k: Kunci, label: string) => (
    <label className="grid min-w-0 gap-1 text-sm">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <Input
        inputMode="decimal"
        value={teks[k]}
        onChange={(e) => ubah(k, e.target.value)}
        onBlur={() => onSelesai?.(k)}
        aria-label={label}
        className={cn('text-right', galat?.[k] && 'border-red-500')}
      />
    </label>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Truck className="size-4 text-slate-500" /> Data muatan (untuk pengiriman)
        </CardTitle>
        <p className="text-xs text-slate-500">
          Berat dan ukuran kemasan untuk <b>1 {kodeSatuan}</b>. Dipakai menghitung apakah barang
          muat di kendaraan (berat ≤ daya angkut, volume ≤ bak). Boleh diisi dalam satuan apa pun;
          disimpan dalam kg, cm, dan m³.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-40">{isian('beratKg', 'Berat')}</div>
          <select
            className={kelasPilih}
            value={satBerat}
            onChange={(e) => {
              const v = e.target.value as keyof typeof SATUAN_BERAT;
              gantiSatuan(['beratKg'], v);
              setSatBerat(v);
            }}
            aria-label="Satuan berat"
          >
            {Object.keys(SATUAN_BERAT).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <label className="ml-4 flex items-center gap-1.5 pb-2 text-sm">
            <input
              type="checkbox"
              checked={curah}
              onChange={(e) =>
                form.setValue('muatan.curah', e.target.checked, { shouldDirty: true })
              }
            />
            Barang curah (pasir, batu, tanah: tanpa ukuran per buah)
          </label>
        </div>
        {curah ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-40">{isian('volumeM3', `Volume per ${kodeSatuan}`)}</div>
            <select
              className={kelasPilih}
              value={satVolume}
              onChange={(e) => {
                const v = e.target.value as keyof typeof SATUAN_VOLUME;
                gantiSatuan(['volumeM3'], v);
                setSatVolume(v);
              }}
              aria-label="Satuan volume"
            >
              <option value="m3">m³</option>
              <option value="L">L</option>
            </select>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid w-full max-w-md grid-cols-3 gap-2">
              {isian('panjangCm', 'Panjang')}
              {isian('lebarCm', 'Lebar')}
              {isian('tinggiCm', 'Tinggi')}
            </div>
            <select
              className={kelasPilih}
              value={satUkuran}
              onChange={(e) => {
                const v = e.target.value as keyof typeof SATUAN_PANJANG;
                gantiSatuan(['panjangCm', 'lebarCm', 'tinggiCm'], v);
                setSatUkuran(v);
              }}
              aria-label="Satuan ukuran"
            >
              {Object.keys(SATUAN_PANJANG).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        )}
        {galat && (
          <p className="text-sm text-red-600">
            {Object.values(galat)
              .map((x) => (x && typeof x === 'object' && 'message' in x ? String(x.message) : ''))
              .filter(Boolean)
              .join(' ')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
