import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import type { HasilMintaKodeEmail } from '@sit/shared';
import { db } from '../../db/client';
import { AppError } from '../../lib/errors';
import type { AsalRequest } from '../../lib/konteks';
import { hashPassword } from '../../lib/password';
import { dalamTransaksi } from '../../lib/transaksi';
import { sekarang, selisihDetik, tambahMenit } from '../../lib/waktu';
import { catatLog } from '../sistem/log-aktivitas';
import { emailTokoSiap, kirimKePengguna } from '../sistem/saluran/service';
import * as repo from './repo';
import { normalisasiUsername, pastikanPanjangPassword } from './service';

/*
 * K-209: lupa password dengan kode verifikasi email. Kode 6 angka acak, disimpan sebagai hash SHA-256 (terikat id
 * pengguna), berlaku 10 menit, sekali pakai, gugur setelah 5 kali salah. Jawaban permintaan kode selalu sama
 * sehingga tidak membocorkan username mana yang terdaftar atau punya email. Kode pemulihan kertas (K-191) tetap ada.
 */

export const BERLAKU_MENIT = 10;
const MAKS_SALAH = 5;
const JEDA_KIRIM_DETIK = 60;
const PESAN_TERKIRIM = `Bila username itu terdaftar dan punya email, kode 6 angka sudah dikirim ke email tersebut (berlaku ${BERLAKU_MENIT} menit). Tidak menerima? Periksa folder Spam, tunggu 1 menit lalu minta lagi, atau pakai kode pemulihan.`;
const PESAN_SALAH = 'Kode verifikasi salah atau sudah tidak berlaku. Minta kode baru.';

function hashKode(idPengguna: number, kode: string): string {
  return createHash('sha256').update(`reset:${idPengguna}:${kode}`).digest('hex');
}

export async function mintaKodeEmail(
  usernameMentah: string,
  asal: AsalRequest,
): Promise<HasilMintaKodeEmail> {
  if (!(await emailTokoSiap())) {
    throw new AppError(
      'STATUS_TIDAK_VALID',
      'Email toko belum diatur, jadi kode tidak bisa dikirim. Pakai kode pemulihan, atau minta Owner/Admin me-reset password di Data Pengguna.',
      409,
    );
  }
  const hasil = { pesan: PESAN_TERKIRIM, berlakuMenit: BERLAKU_MENIT };
  const target = await repo.penggunaUntukResetEmail(db, normalisasiUsername(usernameMentah));
  if (!target?.email || target.statusAktif !== 'AKTIF') return hasil;

  const waktu = sekarang();
  const lama = await repo.kodeResetAktif(db, target.id);
  if (lama && selisihDetik(waktu, lama.dibuatPada) < JEDA_KIRIM_DETIK) return hasil;

  const kode = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await dalamTransaksi(async (tx) => {
    await repo.gugurkanKodeReset(tx, target.id, waktu);
    await repo.simpanKodeReset(tx, {
      idPengguna: target.id,
      kodeHash: hashKode(target.id, kode),
      kedaluwarsa: tambahMenit(waktu, BERLAKU_MENIT),
    });
  });
  const kirim = await kirimKePengguna(
    { id: target.id, namaPengguna: target.namaPengguna, email: target.email, telegramChatId: null },
    'Kode ganti password BonsaiUrip',
    [
      `Halo ${target.namaPengguna},`,
      '',
      `Kode untuk mengganti password Anda: ${kode}`,
      `Berlaku ${BERLAKU_MENIT} menit dan hanya sekali pakai.`,
      '',
      'Bila Anda tidak meminta kode ini, abaikan email ini; password Anda tidak berubah.',
    ].join('\n'),
  );
  await catatLog(db, {
    aksi: 'PENGGUNA_KODE_EMAIL',
    idPengguna: target.id,
    entitas: 'pengguna',
    idEntitas: target.id,
    ringkasan:
      kirim.terkirim.length > 0
        ? 'Kode ganti password dikirim ke email'
        : `Kode ganti password gagal dikirim: ${kirim.galat.join('; ')}`,
    ip: asal.ip,
  });
  return hasil;
}

export async function resetLewatEmail(
  input: { username: string; kode: string; passwordBaru: string },
  asal: AsalRequest,
): Promise<{ pesan: string }> {
  const target = await repo.penggunaUntukResetEmail(db, normalisasiUsername(input.username));
  const waktu = sekarang();
  const aktif = target ? await repo.kodeResetAktif(db, target.id) : undefined;
  const cocok =
    target !== undefined &&
    aktif !== undefined &&
    aktif.kedaluwarsa > waktu &&
    timingSafeEqual(
      Buffer.from(aktif.kodeHash, 'hex'),
      Buffer.from(hashKode(target.id, input.kode), 'hex'),
    );
  if (!target || !aktif || !cocok) {
    if (target && aktif) {
      const salah = await repo.tambahSalahKodeReset(db, aktif.id);
      if (salah >= MAKS_SALAH || aktif.kedaluwarsa <= waktu) {
        await repo.tandaiKodeReset(db, aktif.id, 'gugur', waktu);
      }
    }
    await catatLog(db, {
      aksi: 'PENGGUNA_RESET_EMAIL_GAGAL',
      idPengguna: target?.id ?? null,
      ...(target
        ? { entitas: 'pengguna', idEntitas: target.id }
        : { usernamePercobaan: input.username }),
      ringkasan: target ? 'Kode verifikasi email salah/kedaluwarsa' : 'Username tidak dikenal',
      ip: asal.ip,
    });
    throw new AppError('BELUM_LOGIN', PESAN_SALAH, 401);
  }
  if (target.statusAktif !== 'AKTIF') {
    throw new AppError('STATUS_TIDAK_VALID', 'Akun ini nonaktif. Hubungi Owner.', 409);
  }
  await pastikanPanjangPassword(input.passwordBaru, 'passwordBaru');
  const passwordHash = await hashPassword(input.passwordBaru);
  await dalamTransaksi(async (tx) => {
    await repo.tandaiKodeReset(tx, aktif.id, 'dipakai', waktu);
    await repo.ubahPassword(tx, target.id, passwordHash, false, waktu);
    await repo.bukaKunciAkun(tx, target.id);
    const dicabut = await repo.cabutSesiPengguna(tx, target.id, 'PEMULIHAN', waktu);
    await catatLog(tx, {
      aksi: 'PENGGUNA_RESET_EMAIL',
      idPengguna: target.id,
      entitas: 'pengguna',
      idEntitas: target.id,
      ringkasan: `Password diganti dengan kode verifikasi email; ${dicabut} sesi dicabut`,
      ip: asal.ip,
    });
  });
  return { pesan: 'Password sudah diganti. Silakan masuk dengan password baru.' };
}
