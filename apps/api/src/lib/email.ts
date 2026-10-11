import nodemailer from 'nodemailer';

/*
 * Kirim email lewat SMTP (mis. Gmail dengan sandi aplikasi). Dipakai untuk kode persetujuan sekali pakai
 * (K-102); isi selalu teks biasa.
 */

export type PengaturanSmtp = {
  host: string;
  port: number;
  pengguna: string;
  sandi: string;
  /** Alamat pengirim, mis. `BonsaiUrip <toko@gmail.com>`. */
  pengirim: string;
};

/** Gagal menyambung atau ditolak server email; `message` aman ditampilkan (tanpa sandi). */
export class GalatEmail extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GalatEmail';
  }
}

export async function kirimEmail(
  smtp: PengaturanSmtp,
  pesan: { kepada: string; judul: string; isi: string },
): Promise<void> {
  const pengangkut = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    // 465 = TLS sejak awal; port lain (587) naik ke TLS lewat STARTTLS dan wajib berhasil.
    secure: smtp.port === 465,
    requireTLS: smtp.port !== 465,
    auth: { user: smtp.pengguna, pass: smtp.sandi },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
  });
  try {
    await pengangkut.sendMail({
      from: smtp.pengirim,
      to: pesan.kepada,
      subject: pesan.judul,
      text: pesan.isi,
    });
  } catch (err) {
    const kode = (err as { code?: unknown }).code;
    throw new GalatEmail(
      kode === 'EAUTH'
        ? 'Server email menolak nama pengguna atau sandi. Untuk Gmail yang dipakai harus Sandi aplikasi 16 huruf (bukan password Gmail biasa), dan Verifikasi 2 Langkah harus aktif di akun itu.'
        : kode === 'ESOCKET' || kode === 'ECONNECTION' || kode === 'ETIMEDOUT' || kode === 'EDNS'
          ? 'Server email tidak bisa dihubungi. Periksa internet komputer server, alamat server, dan port (Gmail: smtp.gmail.com, port 465).'
          : `Email tidak terkirim (${typeof kode === 'string' ? kode : 'sebab tidak diketahui'}). Periksa isian akun email.`,
    );
  } finally {
    pengangkut.close();
  }
}
