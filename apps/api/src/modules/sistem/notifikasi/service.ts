import type { Notifikasi } from '@sit/shared';
import type { PenggunaAktif } from '../../../lib/konteks';
import { hutangJatuhTempo } from '../../hutang/service';
import { hitungNonTunai } from '../../kas/nontunai/service';
import { shiftAktifToko } from '../../kas/shift/service';
import { jumlahReturMenunggu } from '../../koreksi/retur/service';
import { jumlahVoidMenunggu } from '../../koreksi/void/service';
import { jumlahDisimpanLewat, jumlahOrderBasi } from '../../penjualan/order/service';
import { piutangJatuhTempo } from '../../penjualan/piutang/service';
import { jumlahPerluDipesan } from '../../persediaan/saran-pesan/service';
import { peringatanStok } from '../../persediaan/stok/service';
import { pengingatArmada } from '../../master/armada/service';
import { peringatanCadangan } from '../cadangan/service';

/** Notifikasi topbar per pengguna (docs/05 ST2), disaring menurut izin. */
export async function notifikasiPengguna(pelaku: PenggunaAktif): Promise<Notifikasi[]> {
  const { izin } = pelaku;
  const hasil: Notifikasi[] = [];
  // K-109 + K-132: shift toko yang lewat hari (pencatatan terkunci) atau lewat jam tutup tampil paling atas.
  if (izin.has('kas.shift.kelola_sendiri')) {
    const s = await shiftAktifToko();
    if (s && (s.terlewat || s.lewatJadwal || s.lainTerbuka.length > 0)) {
      hasil.push({
        jenis: 'SHIFT_SAYA_PERLU_DITUTUP',
        judul:
          s.lainTerbuka.length > 0
            ? 'Shift ganda perlu ditutup'
            : s.terlewat
              ? 'Shift kemarin belum ditutup'
              : 'Sudah lewat jam tutup shift',
        keterangan:
          s.lainTerbuka.length > 0
            ? `${s.lainTerbuka.length + 1} shift terbuka dari aturan lama. Tutup semuanya, lalu buka satu shift toko.`
            : s.terlewat
              ? `Shift ${s.nomor} dari hari sebelumnya masih terbuka. Penjualan tunai terkunci sampai ditutup.`
              : `Shift ${s.nomor} dijadwalkan tutup pukul ${s.jadwalTutup ?? ''}.`,
        jumlah: 1 + s.lainTerbuka.length,
        tautan: '/shift',
      });
    }
    // K-121: shift dibuka dengan "hitung nanti" dan hitungan susulannya belum disimpan.
    if (s?.batasHitungBuka) {
      const lewat = new Date(s.batasHitungBuka) <= new Date();
      hasil.push({
        jenis: 'SHIFT_HITUNG_BUKA',
        judul: lewat ? 'Hitung uang shift lewat batas' : 'Hitung uang shift belum selesai',
        keterangan: `Shift ${s.nomor} dibuka "hitung nanti". Hitung semua uang shift di menu Shift.`,
        jumlah: 1,
        tautan: '/shift',
      });
    }
  }
  // K-111: uang non-tunai yang belum dicocokkan dengan mutasi, dan yang ditandai tidak masuk.
  if (izin.has('kas.nontunai.verifikasi')) {
    const n = await hitungNonTunai();
    if (n.tidakMasuk > 0) {
      hasil.push({
        jenis: 'NONTUNAI_TIDAK_MASUK',
        judul: 'Pembayaran non-tunai tidak masuk',
        keterangan: `${n.tidakMasuk} pembayaran transfer/EDC/QRIS ditandai tidak masuk dan perlu ditindaklanjuti.`,
        jumlah: n.tidakMasuk,
        tautan: '/shift?tab=nontunai&status=TIDAK_MASUK',
      });
    }
    if (n.belumDicek > 0) {
      hasil.push({
        jenis: 'NONTUNAI_BELUM_DICEK',
        judul: 'Uang non-tunai belum dicek',
        keterangan: `${n.belumDicek} pembayaran transfer/EDC/QRIS belum dicocokkan dengan mutasi rekening.`,
        jumlah: n.belumDicek,
        tautan: '/shift?tab=nontunai',
      });
    }
  }
  if (izin.has('penjualan.order.buat')) {
    // K-122: order disimpan yang lewat tanggal ambil; pemegang lihat_semua melihat semuanya.
    const semua = izin.has('penjualan.order.lihat_semua');
    const lewat = await jumlahDisimpanLewat(semua ? undefined : pelaku.id);
    if (lewat > 0) {
      hasil.push({
        jenis: 'ORDER_DISIMPAN_LEWAT',
        judul: 'Order disimpan lewat tanggal ambil',
        keterangan: `${lewat} order disimpan belum diambil padahal tanggal ambilnya sudah lewat. Hubungi pembelinya; stoknya masih ditahan.`,
        jumlah: lewat,
        tautan: '/order?status=DISIMPAN',
      });
    }
  }
  if (izin.has('penjualan.order.lihat_semua')) {
    const basi = await jumlahOrderBasi();
    if (basi > 0) {
      hasil.push({
        jenis: 'ORDER_BASI',
        judul: 'Order basi',
        keterangan: `${basi} order menunggu terlalu lama dan masih menahan stok.`,
        jumlah: basi,
        tautan: '/order?status=MENUNGGU',
      });
    }
  }
  // K-162: STNK/KIR dan servis berkala kendaraan aktif.
  if (izin.has('master.armada.kelola')) {
    const p = await pengingatArmada();
    if (p.surat.length > 0) {
      hasil.push({
        jenis: 'ARMADA_SURAT',
        judul:
          p.suratLewat > 0 ? 'STNK/KIR kendaraan sudah habis' : 'STNK/KIR kendaraan hampir habis',
        keterangan: p.surat.slice(0, 3).join('; ') + (p.surat.length > 3 ? '; …' : ''),
        jumlah: p.surat.length,
        tautan: '/armada',
      });
    }
    if (p.servis.length > 0) {
      hasil.push({
        jenis: 'ARMADA_SERVIS',
        judul: p.servisLewat > 0 ? 'Servis kendaraan terlewat' : 'Servis kendaraan sudah dekat',
        keterangan: p.servis.slice(0, 3).join('; ') + (p.servis.length > 3 ? '; …' : ''),
        jumlah: p.servis.length,
        tautan: '/armada',
      });
    }
  }
  if (izin.has('sistem.cadangan.kelola')) {
    const p = await peringatanCadangan();
    if (p.length > 0) {
      hasil.push({
        jenis: 'CADANGAN_BERMASALAH',
        judul: 'Cadangan data perlu diperiksa',
        keterangan: p[0]!,
        jumlah: p.length,
        tautan: '/pengaturan?tab=cadangan',
      });
    }
  }
  if (izin.has('void.setujui')) {
    const n = await jumlahVoidMenunggu();
    if (n > 0) {
      hasil.push({
        jenis: 'VOID_MENUNGGU',
        judul: 'Void menunggu persetujuan',
        keterangan: `${n} pengajuan void perlu diputuskan.`,
        jumlah: n,
        tautan: '/void?tab=persetujuan',
      });
    }
  }
  if (izin.has('retur.setujui')) {
    const n = await jumlahReturMenunggu();
    if (n > 0) {
      hasil.push({
        jenis: 'RETUR_MENUNGGU',
        judul: 'Retur menunggu persetujuan',
        keterangan: `${n} pengajuan retur perlu diputuskan.`,
        jumlah: n,
        tautan: '/retur?tab=persetujuan',
      });
    }
  }
  if (izin.has('penjualan.piutang.lihat')) {
    const p = await piutangJatuhTempo();
    if (p.terlambat > 0) {
      hasil.push({
        jenis: 'PIUTANG_TERLAMBAT',
        judul: 'Piutang terlambat',
        keterangan: `${p.terlambat} piutang melewati jatuh tempo.`,
        jumlah: p.terlambat,
        tautan: '/piutang?terlambat=true',
      });
    }
    if (p.segera > 0) {
      hasil.push({
        jenis: 'PIUTANG_JATUH_TEMPO',
        judul: 'Piutang segera jatuh tempo',
        keterangan: `${p.segera} piutang jatuh tempo dalam 3 hari.`,
        jumlah: p.segera,
        tautan: '/piutang',
      });
    }
  }
  if (izin.has('hutang.lihat')) {
    // HT4: hutang pemasok terlambat dan jatuh tempo dalam 3 hari.
    const h = await hutangJatuhTempo();
    if (h.terlambat > 0) {
      hasil.push({
        jenis: 'HUTANG_TERLAMBAT',
        judul: 'Hutang pemasok terlambat',
        keterangan: `${h.terlambat} hutang ke pemasok melewati jatuh tempo.`,
        jumlah: h.terlambat,
        tautan: '/hutang?terlambat=true',
      });
    }
    if (h.segera > 0) {
      hasil.push({
        jenis: 'HUTANG_JATUH_TEMPO',
        judul: 'Hutang pemasok segera jatuh tempo',
        keterangan: `${h.segera} hutang ke pemasok jatuh tempo dalam 3 hari.`,
        jumlah: h.segera,
        tautan: '/hutang',
      });
    }
  }
  if (izin.has('persediaan.stok.lihat')) {
    const s = await peringatanStok(0);
    if (s.habis > 0) {
      hasil.push({
        jenis: 'STOK_HABIS',
        judul: 'Stok habis',
        keterangan: `${s.habis} barang aktif stoknya 0.`,
        jumlah: s.habis,
        tautan: '/persediaan?tab=posisi&status=HABIS',
      });
    }
    if (s.kritis > 0) {
      hasil.push({
        jenis: 'STOK_KRITIS',
        judul: 'Stok kritis',
        keterangan: `${s.kritis} barang di bawah stok minimum.`,
        jumlah: s.kritis,
        tautan: '/persediaan?tab=posisi&status=KRITIS',
      });
    }
    // K-113 RO6: barang yang stok tersedianya sudah di titik pesan ulang.
    const pesan = await jumlahPerluDipesan();
    if (pesan > 0) {
      hasil.push({
        jenis: 'PERLU_DIPESAN',
        judul: 'Barang perlu dipesan',
        keterangan: `${pesan} barang sudah di titik pesan ulang; lihat saran jumlah pesannya.`,
        jumlah: pesan,
        tautan: '/persediaan?tab=saran-pesan',
      });
    }
  }
  return hasil;
}
