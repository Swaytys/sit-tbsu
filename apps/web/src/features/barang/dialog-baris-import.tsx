import type { BarisImportMentah, KolomImportBarang } from '@sit/shared';
import { useState } from 'react';
import { useDaftarPemasok } from '@/api/mitra';
import { useDaftarKategori, useDaftarMerk, useDaftarSatuan } from '@/api/referensi';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const KOSONG = '__kosong__';

/** Pilihan teks untuk kolom berdaftar; nilai berkas yang tidak ada di daftar tetap ditampilkan. */
function PilihTeks({
  id,
  nilai,
  pilihan,
  bolehKosong,
  onUbah,
}: {
  id: string;
  nilai: string;
  pilihan: { nilai: string; label: string }[];
  bolehKosong: boolean;
  onUbah: (v: string) => void;
}) {
  const ada = nilai === '' || pilihan.some((p) => p.nilai.toLowerCase() === nilai.toLowerCase());
  const terpilih =
    pilihan.find((p) => p.nilai.toLowerCase() === nilai.toLowerCase())?.nilai ?? nilai;
  return (
    <Select
      value={nilai === '' ? KOSONG : terpilih}
      onValueChange={(v) => onUbah(v === KOSONG ? '' : v)}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={KOSONG}>{bolehKosong ? '(kosong)' : '(pilih)'}</SelectItem>
        {!ada && <SelectItem value={nilai}>{nilai} (tidak ditemukan)</SelectItem>}
        {pilihan.map((p) => (
          <SelectItem key={p.nilai} value={p.nilai}>
            {p.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Sunting satu baris import langsung di layar (tanpa kembali ke Excel). Isian tetap berupa teks seperti
 * di berkas; validasi dilakukan server saat baris diperiksa ulang (aturan sama dengan form barang).
 */
export function DialogBarisImport({
  baris,
  kolom,
  pesan,
  onSimpan,
  onTutup,
}: {
  baris: BarisImportMentah;
  kolom: KolomImportBarang[];
  pesan: string[];
  onSimpan: (nilai: Record<string, string>) => void;
  onTutup: () => void;
}) {
  const [nilai, setNilai] = useState<Record<string, string>>(baris.nilai);
  const kategori = useDaftarKategori('AKTIF');
  const merk = useDaftarMerk('AKTIF');
  const satuan = useDaftarSatuan('AKTIF');
  const pemasok = useDaftarPemasok({ cari: '', status: 'AKTIF', halaman: 1, perHalaman: 100 });

  const pilihanUntuk = (k: KolomImportBarang): { nilai: string; label: string }[] | null => {
    switch (k.jenis) {
      case 'KATEGORI':
        return (kategori.data ?? []).map((x) => ({ nilai: x.nama, label: x.nama }));
      case 'MERK':
        return (merk.data ?? []).map((x) => ({ nilai: x.nama, label: x.nama }));
      case 'SATUAN':
        return (satuan.data ?? []).map((x) => ({ nilai: x.kode, label: `${x.kode} — ${x.nama}` }));
      case 'PEMASOK':
        return (pemasok.data?.data ?? []).map((x) => ({
          nilai: x.kode,
          label: `${x.kode} — ${x.namaPemasok}`,
        }));
      case 'KEPEMILIKAN':
        return [
          { nilai: 'MILIK_SENDIRI', label: 'Milik sendiri' },
          { nilai: 'KONSINYASI', label: 'Konsinyasi' },
        ];
      case 'STATUS':
        return [
          { nilai: 'AKTIF', label: 'Aktif' },
          { nilai: 'NONAKTIF', label: 'Nonaktif' },
        ];
      default:
        return null;
    }
  };

  const ubah = (kunci: string, v: string) => setNilai((lama) => ({ ...lama, [kunci]: v }));

  return (
    <Dialog open onOpenChange={(buka) => !buka && onTutup()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ubah baris {baris.nomorBaris}</DialogTitle>
          {pesan.length > 0 && (
            <DialogDescription asChild>
              <ul className="list-disc space-y-0.5 pl-4 text-red-600">
                {pesan.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {kolom.map((k) => {
            const id = `kolom-${k.kunci}`;
            const pilihan = pilihanUntuk(k);
            const v = nilai[k.kunci] ?? '';
            return (
              <div key={k.kunci} className="space-y-1">
                <Label htmlFor={id}>
                  {k.label}
                  {k.wajib && <span className="text-red-500">*</span>}
                </Label>
                {pilihan ? (
                  <PilihTeks
                    id={id}
                    nilai={v}
                    pilihan={pilihan}
                    bolehKosong={!k.wajib}
                    onUbah={(x) => ubah(k.kunci, x)}
                  />
                ) : (
                  <Input
                    id={id}
                    value={v}
                    inputMode={
                      k.jenis === 'RUPIAH' ? 'numeric' : k.jenis === 'QTY' ? 'decimal' : 'text'
                    }
                    placeholder={k.petunjuk}
                    onChange={(e) => ubah(k.kunci, e.target.value)}
                  />
                )}
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onTutup}>
            Batal
          </Button>
          <Button
            onClick={() =>
              onSimpan(
                Object.fromEntries(
                  Object.entries(nilai)
                    .map(([k, x]) => [k, x.trim()] as const)
                    .filter(([, x]) => x !== ''),
                ),
              )
            }
          >
            Simpan & periksa ulang
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
