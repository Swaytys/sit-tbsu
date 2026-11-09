import { POLA_QTY, type DetailBarang } from '@sit/shared';
import { Scale } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { pesanGalat } from '@/api/client';
import { useAturTimbang } from '@/api/persediaan';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatDesimal } from '@/lib/format';

const angka = (v: string) => v.trim().replace(',', '.');
const isian = (v: string | undefined) => (v ? formatDesimal(v).replace(/\./g, '') : '');

/**
 * K-227: data timbang untuk menghitung barang kecil (baut, paku, sekrup) dengan menimbang saat opname. Timbang
 * sekian buah (mis. 50), catat beratnya; saat opname berat bersih ÷ berat per buah = jumlah buah.
 */
export function KartuHitungTimbang({ barang }: { barang: DetailBarang }) {
  const atur = useAturTimbang();
  const [sampel, setSampel] = useState(isian(barang.timbang?.jumlahSampel));
  const [berat, setBerat] = useState(isian(barang.timbang?.beratSampelGram));
  const s = angka(sampel);
  const b = angka(berat);
  const sah =
    (s === '' && b === '') ||
    (POLA_QTY.test(s) && Number(s) > 0 && POLA_QTY.test(b) && Number(b) > 0);
  const perBuah = sah && s !== '' ? (Number(b) / Number(s)).toLocaleString('id-ID') : null;

  function simpan(kosongkan = false) {
    void atur
      .mutateAsync({
        idBarang: barang.id,
        json: kosongkan
          ? { jumlahSampel: null, beratSampelGram: null }
          : { jumlahSampel: s || null, beratSampelGram: b || null },
      })
      .then((t) => {
        if (kosongkan) {
          setSampel('');
          setBerat('');
        }
        toast.success(
          t
            ? `Data timbang disimpan: ${formatDesimal(t.jumlahSampel)} ${barang.kodeSatuan} = ${formatDesimal(t.beratSampelGram)} g.`
            : 'Data timbang dihapus.',
        );
      })
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="size-4" /> Hitung dengan timbangan (opname)
        </CardTitle>
        <CardDescription>
          Untuk barang kecil yang jumlahnya ribuan (baut, paku, sekrup). Timbang sekian buah
          sekaligus (mis. 50 buah), lalu isi jumlah dan beratnya. Saat opname, penghitung cukup
          menimbang semua barang ini: jumlahnya dihitung otomatis (berat bersih × jumlah sampel ÷
          berat sampel).
        </CardDescription>
      </CardHeader>
      <CardContent
        className="flex flex-wrap items-end gap-3"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && sah) {
            e.preventDefault();
            simpan();
          }
        }}
      >
        <label className="grid gap-1 text-sm">
          Jumlah sampel ({barang.kodeSatuan})
          <Input
            className="w-32"
            inputMode="decimal"
            value={sampel}
            onChange={(e) => setSampel(e.target.value)}
            placeholder="mis. 50"
            aria-label="Jumlah sampel timbang"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Beratnya (gram)
          <Input
            className="w-32"
            inputMode="decimal"
            value={berat}
            onChange={(e) => setBerat(e.target.value)}
            placeholder="mis. 125"
            aria-label="Berat sampel gram"
          />
        </label>
        <Button type="button" disabled={!sah || atur.isPending} onClick={() => simpan()}>
          Simpan data timbang
        </Button>
        {barang.timbang && (
          <Button
            type="button"
            variant="ghost"
            disabled={atur.isPending}
            onClick={() => simpan(true)}
          >
            Hapus
          </Button>
        )}
        <p className="basis-full text-xs text-slate-500">
          {!sah
            ? 'Isi keduanya dengan angka lebih dari 0, atau kosongkan keduanya.'
            : perBuah
              ? `≈ ${perBuah} g per ${barang.kodeSatuan}. Makin banyak sampel yang ditimbang, makin tepat hasilnya.`
              : 'Belum ada data timbang: barang ini dihitung manual saat opname.'}
        </p>
      </CardContent>
    </Card>
  );
}
