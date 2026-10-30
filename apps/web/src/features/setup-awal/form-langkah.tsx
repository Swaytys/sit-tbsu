import {
  JENIS_USAHA,
  LABEL_JENIS_USAHA,
  LABEL_LAYANAN_TOKO,
  LAYANAN_TOKO,
  type InputDataUsaha,
  type InputOperasionalAwal,
  type InputOwnerAwal,
  type LayananToko,
} from '@sit/shared';
import { Eye, EyeOff } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Galat } from './galat';

/*
 * K-205: isian langkah inti setup awal (data usaha, operasional, akun Owner). Validasi memakai skema Zod yang sama
 * dengan API (packages/shared); pesan galat per kolom diberikan halaman setup.
 */

export function Isian({
  label,
  wajib = false,
  ket,
  galat,
  children,
}: {
  label: string;
  wajib?: boolean;
  ket?: ReactNode;
  galat?: string | undefined;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium text-slate-700">
        {label}
        {wajib ? (
          <span className="text-red-600"> *</span>
        ) : (
          <span className="text-slate-400"> (boleh kosong)</span>
        )}
      </span>
      {children}
      {ket && !galat && <span className="text-xs text-slate-500">{ket}</span>}
      {galat && (
        <span role="alert" className="text-xs text-red-600">
          {galat}
        </span>
      )}
    </label>
  );
}

type Ubah<T> = (k: keyof T, v: T[keyof T]) => void;

export function FormUsaha({
  isi,
  ubah,
  galat,
}: {
  isi: InputDataUsaha;
  ubah: Ubah<InputDataUsaha>;
  galat: Galat;
}) {
  const teks = (k: keyof InputDataUsaha) => (e: { target: { value: string } }) =>
    ubah(k, e.target.value);
  return (
    <div className="grid gap-4">
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium text-slate-700">
          Jenis usaha <span className="text-red-600">*</span>
        </legend>
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
          {JENIS_USAHA.map((j, i) => (
            <label
              key={j}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm',
                isi.jenisUsaha === j
                  ? 'border-blue-600 bg-blue-50 font-medium'
                  : 'hover:bg-slate-50',
              )}
            >
              <input
                type="radio"
                name="jenisUsaha"
                value={j}
                checked={isi.jenisUsaha === j}
                onChange={() => ubah('jenisUsaha', j)}
                autoFocus={i === 0}
                className="accent-blue-600"
              />
              {LABEL_JENIS_USAHA[j]}
            </label>
          ))}
        </div>
        {isi.jenisUsaha === 'LAINNYA' && (
          <Isian label="Tulis jenis usaha Anda" wajib galat={galat.jenisUsahaLain}>
            <Input
              value={isi.jenisUsahaLain ?? ''}
              onChange={teks('jenisUsahaLain')}
              placeholder="mis. toko keramik"
            />
          </Isian>
        )}
      </fieldset>
      <div className="grid gap-4 xl:grid-cols-2">
        <Isian
          label="Nama usaha"
          wajib
          ket="Tampil di halaman masuk, struk, invoice, dan laporan."
          galat={galat.namaToko}
        >
          <Input
            value={isi.namaToko}
            onChange={teks('namaToko')}
            placeholder="mis. Toko Maju Jaya"
          />
        </Isian>
        <Isian
          label="Nama badan usaha"
          ket="Baris kedua kop dokumen, mis. UD. Maju Jaya atau CV. Maju Jaya."
          galat={galat.namaBadanUsaha}
        >
          <Input value={isi.namaBadanUsaha ?? ''} onChange={teks('namaBadanUsaha')} />
        </Isian>
      </div>
      <Isian
        label="Slogan"
        ket="Kalimat pendek yang menggambarkan usaha Anda; tampil di halaman masuk."
        galat={galat.sloganToko}
      >
        <Input
          value={isi.sloganToko ?? ''}
          onChange={teks('sloganToko')}
          placeholder="mis. Bahan bangunan lengkap, harga bersahabat"
        />
      </Isian>
      <Isian label="Alamat" wajib ket="Jalan, nomor, desa/kelurahan." galat={galat.alamatToko}>
        <Input value={isi.alamatToko} onChange={teks('alamatToko')} />
      </Isian>
      <div className="grid gap-4 xl:grid-cols-3">
        <Isian label="Kota/kabupaten" wajib galat={galat.kotaToko}>
          <Input value={isi.kotaToko} onChange={teks('kotaToko')} placeholder="mis. Jombang" />
        </Isian>
        <Isian label="Telepon usaha" wajib galat={galat.telpToko}>
          <Input value={isi.telpToko} onChange={teks('telpToko')} placeholder="mis. 0321 123456" />
        </Isian>
        <Isian label="Email usaha" galat={galat.emailToko}>
          <Input type="email" value={isi.emailToko ?? ''} onChange={teks('emailToko')} />
        </Isian>
      </div>
    </div>
  );
}

export function FormOperasional({
  isi,
  ubah,
  galat,
}: {
  isi: InputOperasionalAwal;
  ubah: Ubah<InputOperasionalAwal>;
  galat: Galat;
}) {
  const layanan = isi.layanan;
  function alihkan(l: LayananToko, pilih: boolean) {
    ubah('layanan', pilih ? [...layanan, l] : layanan.filter((x) => x !== l));
  }
  return (
    <div className="grid gap-5">
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium text-slate-700">
          Cara toko melayani pembeli <span className="text-red-600">*</span>
        </legend>
        <p className="text-xs text-slate-500">
          Centang semua yang dipakai. Pilihan ini menyesuaikan langkah penyiapan dan tur; semua menu
          tetap tersedia dan bisa dipakai kapan saja.
        </p>
        {LAYANAN_TOKO.map((l, i) => (
          <label
            key={l}
            className="flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 text-sm hover:bg-slate-50"
          >
            <Checkbox
              checked={layanan.includes(l)}
              onCheckedChange={(v) => alihkan(l, v === true)}
              autoFocus={i === 0}
              className="mt-0.5"
            />
            <span>{LABEL_LAYANAN_TOKO[l]}</span>
          </label>
        ))}
        {galat.layanan && (
          <span role="alert" className="text-xs text-red-600">
            {galat.layanan}
          </span>
        )}
      </fieldset>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium text-slate-700">Jam buka toko</legend>
        <p className="text-xs text-slate-500">
          Dipakai untuk pengingat buka dan tutup shift kasir. Boleh dikosongkan dan diatur nanti di
          Pengaturan › Operasional.
        </p>
        <div className="grid max-w-md grid-cols-2 gap-4">
          <Isian label="Buka" galat={galat.shiftJamBuka}>
            <Input
              type="time"
              value={isi.shiftJamBuka}
              onChange={(e) => ubah('shiftJamBuka', e.target.value)}
            />
          </Isian>
          <Isian label="Tutup" galat={galat.shiftJamTutup}>
            <Input
              type="time"
              value={isi.shiftJamTutup}
              onChange={(e) => ubah('shiftJamTutup', e.target.value)}
            />
          </Isian>
        </div>
      </fieldset>
    </div>
  );
}

function InputSandi(props: { value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [tampil, setTampil] = useState(false);
  return (
    <div className="relative">
      <Input
        type={tampil ? 'text' : 'password'}
        autoComplete={props.autoComplete}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="pr-9"
      />
      <button
        type="button"
        onClick={() => setTampil((t) => !t)}
        className="absolute top-1/2 right-2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
        aria-label={tampil ? 'Sembunyikan password' : 'Tampilkan password'}
      >
        {tampil ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function FormOwner({
  isi,
  ubah,
  galat,
}: {
  isi: InputOwnerAwal;
  ubah: Ubah<InputOwnerAwal>;
  galat: Galat;
}) {
  const teks = (k: keyof InputOwnerAwal) => (e: { target: { value: string } }) =>
    ubah(k, e.target.value);
  return (
    <div className="grid gap-4">
      <p className="rounded-md bg-blue-50 p-3 text-sm text-blue-900">
        Akun ini adalah <b>Owner</b> (pemilik): bisa melihat dan mengatur semua hal, termasuk
        membuat akun karyawan. Karyawan nanti punya akun sendiri dengan hak terbatas.
      </p>
      <div className="grid gap-4 xl:grid-cols-2">
        <Isian label="Nama lengkap" wajib galat={galat.namaPengguna}>
          <Input autoFocus value={isi.namaPengguna} onChange={teks('namaPengguna')} />
        </Isian>
        <Isian
          label="Username (untuk masuk)"
          wajib
          ket="Huruf kecil/angka tanpa spasi, mis. budi atau pemilik."
          galat={galat.username}
        >
          <Input autoComplete="username" value={isi.username} onChange={teks('username')} />
        </Isian>
        <Isian
          label="Email Owner"
          ket="Disarankan: untuk menerima kode bila lupa password."
          galat={galat.email}
        >
          <Input type="email" value={isi.email} onChange={teks('email')} />
        </Isian>
        <Isian label="No. HP" galat={galat.noHp}>
          <Input value={isi.noHp ?? ''} onChange={teks('noHp')} placeholder="mis. 0812…" />
        </Isian>
        <Isian
          label="Password"
          wajib
          ket="Minimal 8 karakter; campur huruf dan angka."
          galat={galat.password}
        >
          <InputSandi
            autoComplete="new-password"
            value={isi.password}
            onChange={(v) => ubah('password', v)}
          />
        </Isian>
        <Isian label="Ulangi password" wajib galat={galat.konfirmasi}>
          <InputSandi
            autoComplete="new-password"
            value={isi.konfirmasi}
            onChange={(v) => ubah('konfirmasi', v)}
          />
        </Isian>
      </div>
    </div>
  );
}
