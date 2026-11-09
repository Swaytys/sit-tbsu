import {
  kaliQty,
  LABEL_CARA_HITUNG,
  POLA_QTY,
  qtyDariTimbang,
  tambahQty,
  type BarisLembarHitung,
  type CaraHitung,
} from '@sit/shared';
import { ArrowLeft, Check, ClipboardList, Package, Play, Scale, Search } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import { pesanGalat } from '@/api/client';
import { useCatatHitung, useLembarHitung, useMulaiHitung } from '@/api/persediaan';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatDesimal, formatWaktu } from '@/lib/format';
import { cn } from '@/lib/utils';

type Saring = 'perlu' | 'semua' | 'saya';

const angka = (v: string) => v.trim().replace(',', '.');

/**
 * K-227: lembar hitung opname untuk penghitung (HP/tablet/komputer). Hitung buta: stok sistem dan hitungan orang lain
 * tidak tampil. Satu barang satu isian; Enter menyimpan dan pindah ke barang berikutnya yang perlu dihitung. Barang
 * yang punya data timbang bisa dihitung dengan menimbang (T).
 */
export function HalamanHitungOpname() {
  const id = Number(useParams().id);
  const lembar = useLembarHitung(Number.isFinite(id) ? id : null);
  const mulai = useMulaiHitung();
  const [saring, setSaring] = useState<Saring>('perlu');
  const [cari, setCari] = useState('');
  const l = lembar.data;

  if (lembar.error) return <p className="p-6 text-sm text-red-600">{pesanGalat(lembar.error)}</p>;
  if (!l) return <p className="p-6 text-sm text-slate-500">Memuat…</p>;

  const judul = (
    <div className="flex items-start gap-3">
      <Button variant="ghost" size="icon-sm" asChild>
        <Link to="/opname" aria-label="Kembali ke Stok Opname">
          <ArrowLeft />
        </Link>
      </Button>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-slate-900">Lembar hitung {l.nomor}</h1>
        <p className="text-sm text-slate-500">
          {l.catatan ?? 'Stok opname'}
          {l.waktuMulaiHitung ? ` · mulai ${formatWaktu(l.waktuMulaiHitung)}` : ''}
        </p>
      </div>
    </div>
  );

  if (l.status !== 'DRAFT') {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        {judul}
        <Card className="p-6 text-sm text-slate-600">
          Opname ini sudah {l.status === 'SELESAI' ? 'diselesaikan' : 'dibatalkan'}; tidak bisa
          dihitung lagi.
        </Card>
      </div>
    );
  }

  if (l.belumMulai) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        {judul}
        <Card className="max-w-xl gap-3 p-6">
          <p className="flex items-center gap-2 font-medium text-slate-800">
            <ClipboardList className="size-5 text-blue-600" /> Daftar ini ditugaskan ke Anda:{' '}
            {l.jumlahBaris} barang
          </p>
          <p className="text-sm text-slate-600">
            Daftar barang baru tampil setelah Anda menekan <b>Mulai hitung</b>, dan waktunya
            dicatat. Tekan saat Anda sudah siap di gudang/toko. Stok sistem tidak ditampilkan:
            hitung apa adanya.
          </p>
          <Button
            className="self-start"
            autoFocus
            disabled={mulai.isPending}
            onClick={() =>
              void mulai.mutateAsync(l.id).catch((err: unknown) => toast.error(pesanGalat(err)))
            }
          >
            <Play /> Mulai hitung
          </Button>
        </Card>
      </div>
    );
  }

  const aktif = l.baris.filter((b) => !b.dikecualikan);
  const sudahSaya = aktif.filter((b) => b.hitunganSaya !== null).length;
  const perlu = aktif.filter((b) => b.perluDihitung).length;
  const kata = cari.trim().toLowerCase();
  const tampil = l.baris.filter(
    (b) =>
      (saring === 'semua' || (saring === 'perlu' ? b.perluDihitung : b.hitunganSaya !== null)) &&
      (!kata ||
        b.namaBarang.toLowerCase().includes(kata) ||
        b.kodeBarang.toLowerCase().includes(kata)),
  );

  return (
    <div className="space-y-3 p-4 sm:p-6">
      {judul}
      <Card className="gap-2 p-3">
        <p className="text-sm text-slate-700" data-testid="kemajuan-hitung">
          <b>{sudahSaya}</b> dari {aktif.length} barang sudah Anda hitung ·{' '}
          <span className={perlu > 0 ? 'text-amber-700' : 'text-emerald-700'}>
            {perlu} perlu dihitung
          </span>
        </p>
        <p className="text-xs text-slate-500">
          Hitung buta: stok sistem tidak ditampilkan. Isi jumlah lalu <kbd>Enter</kbd> (simpan dan
          lanjut). Barang bertanda timbangan bisa ditimbang: tekan <kbd>T</kbd> atau tombol{' '}
          <b>Timbang</b>, isi berat bersih (gram, wadah sudah dinolkan). Barang bertanda kemasan
          segel: isi dulu jumlah box/dus segel utuh, Enter, lalu ecer; bila diminta uji petik, buka
          1 box acak dan isi jumlah isinya.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ['perlu', `Perlu dihitung (${perlu})`],
              ['saya', `Sudah saya hitung (${sudahSaya})`],
              ['semua', `Semua (${l.baris.length})`],
            ] as const
          ).map(([k, label]) => (
            <Button
              key={k}
              size="sm"
              variant={saring === k ? 'default' : 'outline'}
              onClick={() => setSaring(k)}
            >
              {label}
            </Button>
          ))}
          <div className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              id="cari-lembar-hitung"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari barang di lembar ini (F2)…"
              className="h-8 pl-8"
              aria-label="Cari barang di lembar hitung"
            />
          </div>
        </div>
      </Card>

      {tampil.length === 0 ? (
        <Card className="p-6 text-center text-sm text-slate-500">
          {saring === 'perlu'
            ? 'Semua barang yang perlu sudah Anda hitung. Terima kasih; laporkan ke Kepala Toko.'
            : 'Tidak ada barang yang cocok.'}
        </Card>
      ) : (
        <ul className="space-y-2" data-testid="lembar-hitung">
          {tampil.map((b, i) => (
            <BarisHitung
              key={b.idBarang}
              idLembar={l.id}
              b={b}
              urutan={i}
              // Saringan "perlu": baris yang baru dihitung hilang dari daftar, jadi barang berikutnya naik ke urutan ini.
              onLanjut={() => setTimeout(() => fokusBaris(saring === 'perlu' ? i : i + 1), 50)}
              onKembali={() => fokusBaris(i - 1)}
            />
          ))}
        </ul>
      )}
      <PintasanCari />
    </div>
  );
}

function fokusBaris(i: number) {
  document.querySelector<HTMLInputElement>(`[data-baris-hitung="${i}"]`)?.focus();
}

/** F2: kembali ke kotak cari. */
function PintasanCari() {
  useEffect(() => {
    const tekan = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'F2') return;
      e.preventDefault();
      document.getElementById('cari-lembar-hitung')?.focus();
    };
    window.addEventListener('keydown', tekan);
    return () => window.removeEventListener('keydown', tekan);
  }, []);
  return null;
}

function BarisHitung({
  idLembar,
  b,
  urutan,
  onLanjut,
  onKembali,
}: {
  idLembar: number;
  b: BarisLembarHitung;
  urutan: number;
  onLanjut: () => void;
  onKembali: () => void;
}) {
  const catat = useCatatHitung();
  const [cara, setCara] = useState<CaraHitung>('HITUNG');
  const [isian, setIsian] = useState('');
  const [isianSegel, setIsianSegel] = useState('');
  const [isianUji, setIsianUji] = useState('');
  const refEcer = useRef<HTMLInputElement>(null);
  const refUji = useRef<HTMLInputElement>(null);
  const segel = b.segel;
  const bisaTimbang = b.timbang !== null;
  // K-227 barang tersegel: box utuh dihitung terpisah; ecer kosong dianggap 0.
  const nilaiSegel = isianSegel.trim();
  const sahSegel = !segel || /^\d{1,9}$/.test(nilaiSegel);
  const ecerKosong = !!segel && isian.trim() === '';
  const nilai = ecerKosong ? '0' : angka(isian);
  const sahEcer = POLA_QTY.test(nilai) && (cara === 'HITUNG' || ecerKosong || Number(nilai) > 0);
  const perluUji = b.ujiPetik && !!segel && sahSegel && Number(nilaiSegel) >= 1;
  const nilaiUji = angka(isianUji);
  const sahUji = !perluUji || POLA_QTY.test(nilaiUji);
  const sah = sahSegel && sahEcer && sahUji;
  const ecer =
    cara === 'TIMBANG' && b.timbang && sahEcer && !ecerKosong
      ? qtyDariTimbang(nilai, b.timbang.jumlahSampel, b.timbang.beratSampelGram, b.satuanBulat)
      : sahEcer
        ? nilai
        : null;
  // Tampilan saja: jumlah akhir dihitung server (box utuh × isi + isi box uji petik + ecer).
  const total =
    segel && sah && ecer !== null
      ? tambahQty(
          tambahQty(
            kaliQty(Number(nilaiSegel) - (perluUji ? 1 : 0), segel.isi),
            perluUji ? nilaiUji : '0',
          ),
          ecer,
        )
      : null;

  async function simpan() {
    if (!sah || catat.isPending) return;
    try {
      const baru = await catat.mutateAsync({
        id: idLembar,
        json: {
          idBarang: b.idBarang,
          cara: ecerKosong ? 'HITUNG' : cara,
          qty: cara === 'HITUNG' || ecerKosong ? nilai : null,
          beratGram: cara === 'TIMBANG' && !ecerKosong ? nilai : null,
          qtySegel: segel ? nilaiSegel : null,
          isiUjiPetik: perluUji ? nilaiUji : null,
        },
      });
      setIsian('');
      setIsianSegel('');
      setIsianUji('');
      toast.success(
        `${b.namaBarang}: ${formatDesimal(baru.hitunganSaya?.qty ?? '0')} ${b.kodeSatuan} tersimpan.`,
        { duration: 2000 },
      );
      onLanjut();
    } catch (err) {
      toast.error(pesanGalat(err));
    }
  }

  function gantiCara() {
    if (!bisaTimbang) return;
    setCara((c) => (c === 'HITUNG' ? 'TIMBANG' : 'HITUNG'));
    setIsian('');
    refEcer.current?.focus();
  }

  /** Enter: box segel → ecer → isi uji petik → simpan. */
  function tekan(e: KeyboardEvent<HTMLInputElement>, posisi: 'segel' | 'ecer' | 'uji') {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (posisi === 'segel') refEcer.current?.focus();
      else if (posisi === 'ecer' && perluUji) refUji.current?.focus();
      else void simpan();
    } else if ((e.key === 't' || e.key === 'T') && posisi === 'ecer') {
      e.preventDefault();
      gantiCara();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      fokusBaris(urutan + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      onKembali();
    }
  }

  const saya = b.hitunganSaya;
  return (
    <li
      className={cn(
        'rounded-lg border bg-white p-3',
        b.perluDihitung && 'border-amber-300',
        b.dikecualikan && 'bg-slate-50 opacity-70',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <p className="font-medium text-slate-900">{b.namaBarang}</p>
          <p className="text-xs text-slate-500">
            <span className="font-mono">{b.kodeBarang}</span> · {b.namaKategori} · satuan{' '}
            {b.kodeSatuan}
            {segel && (
              <>
                {' '}
                · <Package className="inline size-3" /> {segel.kodeSatuan} segel isi{' '}
                {formatDesimal(segel.isi)} {b.kodeSatuan}
              </>
            )}
            {b.timbang && (
              <>
                {' '}
                · <Scale className="inline size-3" /> {formatDesimal(b.timbang.jumlahSampel)}{' '}
                {b.kodeSatuan} = {formatDesimal(b.timbang.beratSampelGram)} g
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {b.dikecualikan ? (
            <Badge variant="outline">Dikecualikan</Badge>
          ) : saya ? (
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
              <Check /> Anda: {formatDesimal(saya.qty)} {b.kodeSatuan}
              {saya.qtySegel !== null && segel
                ? ` (${formatDesimal(saya.qtySegel)} ${segel.kodeSatuan} segel)`
                : ''}
              {saya.cara === 'TIMBANG' ? ` (${LABEL_CARA_HITUNG.TIMBANG.toLowerCase()})` : ''} ·{' '}
              {formatWaktu(saya.waktu).slice(-5)}
            </Badge>
          ) : b.perluDihitung ? (
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
              Perlu dihitung
            </Badge>
          ) : null}
          {b.dihitungOrangLain && !b.dikecualikan && (
            <Badge variant="outline" className="text-slate-500">
              Sudah dihitung orang lain
            </Badge>
          )}
        </div>
      </div>
      {!b.dikecualikan && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {segel && (
            <>
              <Input
                data-baris-hitung={urutan}
                inputMode="numeric"
                className="w-24"
                value={isianSegel}
                onChange={(e) => setIsianSegel(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => tekan(e, 'segel')}
                placeholder={`${segel.kodeSatuan} utuh`}
                aria-label={`Jumlah ${segel.kodeSatuan} segel utuh ${b.namaBarang}`}
              />
              <span className="text-sm text-slate-500">{segel.kodeSatuan} segel +</span>
            </>
          )}
          <Input
            ref={refEcer}
            {...(segel ? {} : { 'data-baris-hitung': urutan })}
            inputMode="decimal"
            className="w-32"
            value={isian}
            onChange={(e) => setIsian(e.target.value)}
            onKeyDown={(e) => tekan(e, 'ecer')}
            placeholder={
              cara === 'TIMBANG'
                ? 'Berat (gram)'
                : segel
                  ? `Ecer (${b.kodeSatuan})`
                  : `Jumlah (${b.kodeSatuan})`
            }
            aria-label={`${cara === 'TIMBANG' ? 'Berat bersih gram' : segel ? 'Jumlah ecer' : 'Jumlah dihitung'} ${b.namaBarang}`}
          />
          <span className="text-sm text-slate-500">
            {cara === 'TIMBANG' ? 'g' : segel ? `${b.kodeSatuan} ecer` : b.kodeSatuan}
          </span>
          {bisaTimbang && (
            <Button
              type="button"
              size="sm"
              variant={cara === 'TIMBANG' ? 'default' : 'outline'}
              onClick={gantiCara}
              title="Hitung dengan timbangan (T)"
            >
              <Scale /> Timbang <kbd className="text-[10px] opacity-70">T</kbd>
            </Button>
          )}
          {perluUji && segel && (
            <span className="flex basis-full flex-wrap items-center gap-2 rounded-md bg-amber-50 px-2 py-1.5 text-sm text-amber-900">
              Uji petik: buka 1 {segel.kodeSatuan} segel acak, hitung isinya →
              <Input
                ref={refUji}
                inputMode="decimal"
                className="h-8 w-24 bg-white"
                value={isianUji}
                onChange={(e) => setIsianUji(e.target.value)}
                onKeyDown={(e) => tekan(e, 'uji')}
                placeholder={`isi (${b.kodeSatuan})`}
                aria-label={`Isi ${segel.kodeSatuan} yang dibuka ${b.namaBarang}`}
              />
              <span className="text-xs">
                seharusnya {formatDesimal(segel.isi)}; {segel.kodeSatuan} itu tetap dihitung di
                jumlah {segel.kodeSatuan} segel
              </span>
            </span>
          )}
          <Button
            type="button"
            size="sm"
            disabled={!sah || catat.isPending}
            onClick={() => void simpan()}
          >
            Simpan <kbd className="text-[10px] opacity-70">Enter</kbd>
          </Button>
          {cara === 'TIMBANG' && ecer !== null && !ecerKosong && (
            <span className="text-sm text-slate-600" data-testid="perkiraan-timbang">
              ≈ {formatDesimal(ecer)} {b.kodeSatuan}
              {segel ? ' ecer' : ''}
            </span>
          )}
          {total !== null && (
            <span className="text-sm text-slate-600" data-testid="perkiraan-total">
              = {formatDesimal(total)} {b.kodeSatuan}
            </span>
          )}
          {((isian !== '' && !sahEcer) || (isianSegel !== '' && !sahSegel)) && (
            <span className="text-xs text-red-600">
              {cara === 'TIMBANG' ? 'Berat harus angka > 0.' : 'Jumlah harus angka ≥ 0.'}
            </span>
          )}
        </div>
      )}
    </li>
  );
}
