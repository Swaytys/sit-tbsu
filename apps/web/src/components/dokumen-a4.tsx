import {
  formatRupiah,
  LABEL_PENYELESAIAN_RETUR_PEMASOK,
  type BarisSuratJalan,
  type DetailPenjualan,
  type DetailReturPemasok,
  type TampilanToko,
} from '@sit/shared';
import type { ReactNode } from 'react';
import { formatDesimal, formatTanggal, formatWaktu } from '@/lib/format';
import { LABEL_STATUS_PEMBAYARAN } from '@/lib/label';

function Kop({ toko, judul, nomor }: { toko: TampilanToko; judul: string; nomor: string }) {
  return (
    <div className="mb-4 flex items-start justify-between border-b-2 border-black pb-3">
      <div className="flex items-center gap-3">
        {toko.logo && <img src={toko.logo} alt="" className="h-14 w-14 object-contain" />}
        <div>
          <div className="text-lg font-bold">{toko.namaToko}</div>
          <div>{toko.namaBadanUsaha}</div>
          {toko.alamatToko && <div className="text-xs">{toko.alamatToko}</div>}
          {toko.telpToko && <div className="text-xs">Telp. {toko.telpToko}</div>}
        </div>
      </div>
      <div className="text-right">
        <div className="text-xl font-bold tracking-wide">{judul}</div>
        <div className="font-mono">{nomor}</div>
      </div>
    </div>
  );
}

function Pasangan({ kiri, kanan }: { kiri: ReactNode; kanan: ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="w-32 shrink-0 text-slate-600">{kiri}</span>
      <span>{kanan}</span>
    </div>
  );
}

/** Invoice A4 penjualan pengantaran (docs/05 P14). */
export function InvoiceA4({ p, toko }: { p: DetailPenjualan; toko: TampilanToko }) {
  return (
    <div className="bg-white p-2 text-sm text-black" data-testid="invoice">
      <Kop toko={toko} judul="INVOICE" nomor={p.nomor} />
      <div className="mb-4 grid grid-cols-2 gap-4">
        <div>
          <Pasangan kiri="Kepada" kanan={<b>{p.namaPelanggan}</b>} />
          {p.noHpPelanggan && <Pasangan kiri="No. HP" kanan={p.noHpPelanggan} />}
          <Pasangan kiri="Alamat kirim" kanan={p.alamatKirim} />
        </div>
        <div>
          <Pasangan kiri="Tanggal" kanan={formatWaktu(p.tanggal)} />
          <Pasangan kiri="Status bayar" kanan={LABEL_STATUS_PEMBAYARAN[p.statusPembayaran]} />
          {p.tanggalJatuhTempo && (
            <Pasangan kiri="Jatuh tempo" kanan={formatTanggal(p.tanggalJatuhTempo)} />
          )}
          {p.bayarSaatTerima && <Pasangan kiri="Pembayaran" kanan="Bayar saat barang diterima" />}
        </div>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-y border-black">
            <th className="py-1 text-left">No</th>
            <th className="py-1 text-left">Barang</th>
            <th className="py-1 text-right">Qty</th>
            <th className="py-1 text-right">Harga</th>
            <th className="py-1 text-right">Diskon</th>
            <th className="py-1 text-right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {p.baris.map((b, i) => (
            <tr key={b.id} className="border-b border-slate-300">
              <td className="py-1">{i + 1}</td>
              <td className="py-1">
                {b.namaBarang}
                {b.diskonPromo > 0 && (
                  <div className="text-[10px] text-slate-600">
                    Promo {b.namaPromo}: - {formatRupiah(b.diskonPromo)}
                  </div>
                )}
              </td>
              <td className="py-1 text-right">
                {formatDesimal(b.qty)} {b.kodeSatuan}
              </td>
              <td className="py-1 text-right">{formatRupiah(b.hargaSatuan)}</td>
              <td className="py-1 text-right">
                {b.diskonBaris + b.diskonPromo > 0
                  ? formatRupiah(b.diskonBaris + b.diskonPromo)
                  : '-'}
              </td>
              <td className="py-1 text-right">{formatRupiah(b.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 ml-auto w-72 space-y-0.5">
        {p.diskonTransaksi > 0 && (
          <Pasangan kiri="Diskon" kanan={`- ${formatRupiah(p.diskonTransaksi)}`} />
        )}
        {p.ongkir > 0 && <Pasangan kiri="Ongkos kirim" kanan={formatRupiah(p.ongkir)} />}
        <Pasangan kiri={<b>Total</b>} kanan={<b>{formatRupiah(p.totalNeto)}</b>} />
        <Pasangan kiri="Dibayar" kanan={formatRupiah(p.totalDibayar)} />
        <Pasangan kiri={<b>Sisa tagihan</b>} kanan={<b>{formatRupiah(p.sisaTagihan)}</b>} />
      </div>
      <div className="mt-12 grid grid-cols-2 gap-8 text-center">
        <div>
          Penerima
          <div className="mt-16 border-t border-black" />
        </div>
        <div>
          Hormat kami
          <div className="mt-16 border-t border-black" />
        </div>
      </div>
    </div>
  );
}

/** Surat jalan A4 (docs/05 P14): referensi invoice, penerima, barang & qty kirim, sopir, tanda tangan. */
export function SuratJalanA4({ sj, toko }: { sj: BarisSuratJalan; toko: TampilanToko }) {
  return (
    <div className="bg-white p-2 text-sm text-black" data-testid="surat-jalan">
      <Kop toko={toko} judul="SURAT JALAN" nomor={sj.nomor} />
      <div className="mb-4 grid grid-cols-2 gap-4">
        <div>
          <Pasangan kiri="Kepada" kanan={<b>{sj.namaPenerima ?? sj.namaPelanggan}</b>} />
          {sj.noHpPenerima && <Pasangan kiri="No. HP" kanan={sj.noHpPenerima} />}
          <Pasangan kiri="Alamat" kanan={sj.alamatKirim} />
        </div>
        <div>
          <Pasangan kiri="Tanggal" kanan={formatWaktu(sj.tanggal)} />
          <Pasangan kiri="Invoice" kanan={sj.nomorPenjualan} />
          <Pasangan kiri="Sopir" kanan={sj.sopir ?? '................'} />
          <Pasangan kiri="Kendaraan" kanan={sj.kendaraan ?? '................'} />
        </div>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-y border-black">
            <th className="py-1 text-left">No</th>
            <th className="py-1 text-left">Kode</th>
            <th className="py-1 text-left">Barang</th>
            <th className="py-1 text-right">Qty kirim</th>
            <th className="py-1 text-left pl-2">Satuan</th>
          </tr>
        </thead>
        <tbody>
          {sj.baris.map((b, i) => (
            <tr key={b.idPenjualanDetail} className="border-b border-slate-300">
              <td className="py-1.5">{i + 1}</td>
              <td className="py-1.5 font-mono text-xs">{b.kodeBarang}</td>
              <td className="py-1.5">{b.namaBarang}</td>
              <td className="py-1.5 text-right">{formatDesimal(b.qtyKirim)}</td>
              <td className="py-1.5 pl-2">{b.kodeSatuan}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {sj.catatan && <p className="mt-2">Catatan: {sj.catatan}</p>}
      <div className="mt-12 grid grid-cols-3 gap-8 text-center">
        {['Penerima', 'Sopir', 'Hormat kami'].map((t) => (
          <div key={t}>
            {t}
            <div className="mt-16 border-t border-black" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Nota retur ke pemasok A4 (docs/06 RP1–RP7): diserahkan bersama barang, ditandatangani kedua pihak. */
export function NotaReturPemasokA4({ r, toko }: { r: DetailReturPemasok; toko: TampilanToko }) {
  return (
    <div className="bg-white p-2 text-sm text-black" data-testid="nota-retur-pemasok">
      <Kop toko={toko} judul="NOTA RETUR PEMBELIAN" nomor={r.nomor} />
      <div className="mb-4 grid grid-cols-2 gap-4">
        <div>
          <Pasangan kiri="Kepada" kanan={<b>{r.namaPemasok}</b>} />
          <Pasangan kiri="Alasan" kanan={r.alasan} />
          {r.catatan && <Pasangan kiri="Catatan" kanan={r.catatan} />}
        </div>
        <div>
          <Pasangan kiri="Tanggal" kanan={formatWaktu(r.tanggal)} />
          <Pasangan kiri="Penyelesaian" kanan={LABEL_PENYELESAIAN_RETUR_PEMASOK[r.penyelesaian]} />
          {r.nomorPenerimaan && <Pasangan kiri="Penerimaan asal" kanan={r.nomorPenerimaan} />}
          {r.nomorPenerimaanPengganti && (
            <Pasangan kiri="Barang pengganti" kanan={r.nomorPenerimaanPengganti} />
          )}
        </div>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-y border-black">
            <th className="py-1 text-left">No</th>
            <th className="py-1 text-left">Kode</th>
            <th className="py-1 text-left">Barang</th>
            <th className="py-1 text-left">Kondisi</th>
            <th className="py-1 text-right">Qty</th>
            <th className="py-1 pl-2 text-left">Satuan</th>
            <th className="py-1 text-left">Keterangan</th>
          </tr>
        </thead>
        <tbody>
          {r.baris.map((b, i) => (
            <tr key={b.id} className="border-b border-slate-300">
              <td className="py-1.5">{i + 1}</td>
              <td className="py-1.5 font-mono text-xs">{b.kodeBarang}</td>
              <td className="py-1.5">{b.namaBarang}</td>
              <td className="py-1.5">{b.kondisiAsal === 'RUSAK' ? 'Rusak' : 'Baik'}</td>
              <td className="py-1.5 text-right">{formatDesimal(b.qty)}</td>
              <td className="py-1.5 pl-2">{b.kodeSatuan}</td>
              <td className="py-1.5">{b.keterangan ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-12 grid grid-cols-2 gap-16 text-center">
        {['Diterima pemasok', 'Hormat kami'].map((t) => (
          <div key={t}>
            {t}
            <div className="mt-16 border-t border-black" />
          </div>
        ))}
      </div>
    </div>
  );
}
