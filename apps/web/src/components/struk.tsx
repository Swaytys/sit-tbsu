import { formatRupiah, type DetailPenjualan, type TampilanToko } from '@sit/shared';
import { formatDesimal, formatTanggal, formatWaktu } from '@/lib/format';

const LABEL_METODE = { TUNAI: 'Tunai', TRANSFER: 'Transfer', EDC: 'EDC' } as const;

function Baris({ kiri, kanan, tebal }: { kiri: string; kanan: string; tebal?: boolean }) {
  return (
    <div className={`flex justify-between gap-2 ${tebal ? 'font-bold' : ''}`}>
      <span>{kiri}</span>
      <span className="tabular-nums">{kanan}</span>
    </div>
  );
}

const Garis = () => <div className="my-1 border-t border-dashed border-black" />;

/** Struk thermal penjualan langsung (docs/05 P14): lebar 58/80 mm sesuai pengaturan. */
export function Struk({ p, toko }: { p: DetailPenjualan; toko: TampilanToko }) {
  const kembalian = p.pembayaran.reduce((t, b) => t + b.kembalian, 0);
  return (
    <div
      className="bg-white p-2 font-mono text-[11px] leading-tight text-black"
      style={{ width: `${toko.lebarStrukMm}mm` }}
      data-testid="struk"
    >
      <div className="text-center">
        {toko.strukTampilkanLogo && toko.logo && (
          <img src={toko.logo} alt="" className="mx-auto mb-1 h-10 object-contain" />
        )}
        {toko.strukTampilkanNama && <div className="text-sm font-bold">{toko.namaToko}</div>}
        <div>{toko.namaBadanUsaha}</div>
        {toko.alamatToko && <div>{toko.alamatToko}</div>}
        {toko.telpToko && <div>Telp. {toko.telpToko}</div>}
      </div>
      <Garis />
      <Baris kiri={p.nomor} kanan={formatWaktu(p.tanggal)} />
      <Baris kiri="Kasir" kanan={p.namaKasir} />
      {(p.namaPelanggan ?? p.namaPembeli) && (
        <Baris kiri="Pembeli" kanan={p.namaPelanggan ?? p.namaPembeli ?? ''} />
      )}
      <Garis />
      {p.baris.map((b) => (
        <div key={b.id} className="mb-0.5">
          <div>{b.namaBarang}</div>
          <Baris
            kiri={`  ${formatDesimal(b.qty)} ${b.kodeSatuan} x ${formatRupiah(b.hargaSatuan).replace('Rp ', '')}`}
            kanan={formatRupiah(b.subtotal + b.diskonBaris).replace('Rp ', '')}
          />
          {b.diskonBaris > 0 && (
            <Baris kiri="  Disc" kanan={`-${formatRupiah(b.diskonBaris).replace('Rp ', '')}`} />
          )}
        </div>
      ))}
      <Garis />
      <Baris
        kiri="Subtotal"
        kanan={formatRupiah(p.totalBruto - (p.totalDiskon - p.diskonTransaksi))}
      />
      {p.diskonTransaksi > 0 && (
        <Baris kiri="Diskon" kanan={`-${formatRupiah(p.diskonTransaksi)}`} />
      )}
      {p.ongkir > 0 && <Baris kiri="Ongkir" kanan={formatRupiah(p.ongkir)} />}
      <Baris kiri="TOTAL" kanan={formatRupiah(p.totalNeto)} tebal />
      {p.pembayaran.map((b) => (
        <Baris
          key={b.id}
          kiri={LABEL_METODE[b.metode]}
          kanan={formatRupiah(b.uangDiterima ?? b.nominal)}
        />
      ))}
      {kembalian > 0 && <Baris kiri="Kembali" kanan={formatRupiah(kembalian)} />}
      {p.sisaTagihan > 0 && (
        <>
          <Baris kiri="Sisa tagihan" kanan={formatRupiah(p.sisaTagihan)} tebal />
          {p.tanggalJatuhTempo && (
            <Baris kiri="Jatuh tempo" kanan={formatTanggal(p.tanggalJatuhTempo)} />
          )}
        </>
      )}
      {p.statusPengambilan === 'BELUM_DIAMBIL' && (
        <>
          <Garis />
          <div className="text-center font-bold">BARANG BELUM DIAMBIL</div>
        </>
      )}
      {toko.footerStruk && (
        <>
          <Garis />
          <div className="text-center whitespace-pre-line">{toko.footerStruk}</div>
        </>
      )}
    </div>
  );
}
