import { LABEL_MUTASI_SEGEL, type DetailBarang } from '@sit/shared';
import { Package, PackageOpen } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { usePengguna } from '@/api/auth';
import { pesanGalat } from '@/api/client';
import { useAturKemasanSegel, useBukaSegel, useSegelBarang } from '@/api/persediaan';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDesimal, formatWaktu } from '@/lib/format';

const TANPA = 'TANPA';

/**
 * K-227: kemasan tersegel. Stok barang kecil (baut, paku) dicatat dua lapis: box utuh tersegel + ecer. Box masuk dari
 * penerimaan, keluar bila dijual per box, dan dibuka (manual di sini, atau otomatis saat ecer kurang di kasir).
 */
export function KartuKemasanSegel({ barang }: { barang: DetailBarang }) {
  const izin = usePengguna().izin;
  const bolehBuka = izin.includes('persediaan.segel.buka');
  const segel = useSegelBarang(barang.id).data;
  const atur = useAturKemasanSegel();
  const [buka, setBuka] = useState(false);
  // Kemasan yang boleh tersegel: satuan jual aktif berisi bilangan bulat ≥ 2.
  const pilihan = barang.satuanJual.filter(
    (s) => s.statusAktif === 'AKTIF' && /^\d+$/.test(s.faktor) && Number(s.faktor) >= 2,
  );
  const terpilih = barang.satuanJual.find((s) => s.kemasanSegel && s.statusAktif === 'AKTIF');

  function ganti(v: string) {
    const id = v === TANPA ? null : Number(v);
    void atur
      .mutateAsync({ idBarang: barang.id, idSatuanJual: id })
      .then((s) =>
        toast.success(
          s
            ? `${s.kodeSatuan} isi ${formatDesimal(s.isi)} ${barang.kodeSatuan} kini dicatat tersegel.`
            : 'Kemasan tidak lagi dicatat tersegel; semua stok dihitung ecer.',
        ),
      )
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="size-4" /> Kemasan tersegel
        </CardTitle>
        <CardDescription>
          Untuk barang yang disimpan dalam box/dus tersegel tetapi juga dijual ecer (baut, paku,
          sekrup). Stok dicatat dua lapis: <b>box utuh tersegel</b> + <b>ecer</b>. Saat opname, box
          cukup dihitung per box; sebagian box dibuka acak untuk diperiksa isinya (uji petik). Bila
          ecer kurang saat kasir menjual, satu box dibuka otomatis dan tercatat.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span>Kemasan tersegel:</span>
          <Select
            value={terpilih ? String(terpilih.id) : TANPA}
            onValueChange={ganti}
            disabled={atur.isPending}
          >
            <SelectTrigger className="w-64" aria-label="Kemasan tersegel">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TANPA}>Tidak ada (semua ecer)</SelectItem>
              {pilihan.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.kodeSatuan} isi {formatDesimal(s.faktor)} {barang.kodeSatuan}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {pilihan.length === 0 && (
            <span className="text-xs text-slate-500">
              Tambah dulu kemasan (satuan jual) berisi bilangan bulat ≥ 2 di kartu Kemasan di atas.
            </span>
          )}
        </div>
        {segel && (
          <>
            <p className="text-sm" data-testid="lapisan-segel">
              Stok: <b>{formatDesimal(segel.qtySegel)}</b> {segel.kodeSatuan} segel (
              {formatDesimal(segel.isi)} {barang.kodeSatuan}/{segel.kodeSatuan}) +{' '}
              <b>{formatDesimal(segel.ecer)}</b> {barang.kodeSatuan} ecer
            </p>
            {bolehBuka && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!/[1-9]/.test(segel.qtySegel)}
                onClick={() => setBuka(true)}
              >
                <PackageOpen /> Buka kemasan…
              </Button>
            )}
            {segel.riwayat.length > 0 && (
              <div className="max-h-56 overflow-y-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="px-2 py-1">Waktu</th>
                      <th className="px-2 py-1">Jenis</th>
                      <th className="px-2 py-1 text-right">Box</th>
                      <th className="px-2 py-1 text-right">Saldo</th>
                      <th className="px-2 py-1">Oleh / keterangan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {segel.riwayat.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="px-2 py-1 whitespace-nowrap">{formatWaktu(r.waktu)}</td>
                        <td className="px-2 py-1">{LABEL_MUTASI_SEGEL[r.jenis]}</td>
                        <td className="px-2 py-1 text-right tabular-nums">
                          {/[1-9]/.test(r.qtyMasuk)
                            ? `+${formatDesimal(r.qtyMasuk)}`
                            : `−${formatDesimal(r.qtyKeluar)}`}
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums">
                          {formatDesimal(r.saldoSetelah)}
                        </td>
                        <td className="px-2 py-1 text-slate-600">
                          {r.namaPengguna}
                          {r.keterangan ? ` · ${r.keterangan}` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </CardContent>
      {buka && segel && (
        <DialogBuka
          idBarang={barang.id}
          nama={barang.namaBarang}
          kode={segel.kodeSatuan}
          ada={Number(segel.qtySegel)}
          onTutup={() => setBuka(false)}
        />
      )}
    </Card>
  );
}

function DialogBuka({
  idBarang,
  nama,
  kode,
  ada,
  onTutup,
}: {
  idBarang: number;
  nama: string;
  kode: string;
  ada: number;
  onTutup: () => void;
}) {
  const buka = useBukaSegel();
  const [jumlah, setJumlah] = useState('1');
  const [alasan, setAlasan] = useState('');
  const n = Number(jumlah);
  const sah = Number.isInteger(n) && n >= 1 && n <= ada && alasan.trim().length >= 3;
  function kirim() {
    if (!sah) return;
    void buka
      .mutateAsync({ idBarang, json: { jumlah: n, alasan: alasan.trim() } })
      .then(() => {
        toast.success(`${n} ${kode} ${nama} dibuka menjadi ecer.`);
        onTutup();
      })
      .catch((err: unknown) => toast.error(pesanGalat(err)));
  }
  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Buka kemasan {nama}</DialogTitle>
          <DialogDescription>
            Box yang dibuka pindah menjadi ecer (stok total tetap). Tercatat siapa, kapan, dan
            alasannya. Ada {ada} {kode} segel.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            kirim();
          }}
        >
          <label className="grid gap-1 text-sm">
            Jumlah {kode} dibuka
            <Input
              inputMode="numeric"
              value={jumlah}
              onChange={(e) => setJumlah(e.target.value.replace(/\D/g, ''))}
              autoFocus
            />
          </label>
          <label className="grid gap-1 text-sm">
            Alasan
            <Input
              value={alasan}
              maxLength={150}
              onChange={(e) => setAlasan(e.target.value)}
              placeholder="mis. menyiapkan ecer di rak toko"
            />
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onTutup}>
              Batal
            </Button>
            <Button type="submit" disabled={!sah || buka.isPending}>
              Buka {Number.isInteger(n) && n > 0 ? n : ''} {kode}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
