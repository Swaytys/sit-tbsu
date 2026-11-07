/* eslint-disable no-console -- alat baris perintah pengembang: hasilnya memang dibaca di terminal */
// K-232: alat pengembang untuk pemulihan akses Owner.
//   node alat-pengembang/kunci-pemulihan.mjs buat          → pasangan kunci baru (sekali; lalu buat Setup baru)
//   node alat-pengembang/kunci-pemulihan.mjs jawab <kode>  → kode jawaban untuk kode tantangan dari toko
// Kunci rahasia disimpan di .pengembang/kunci-pemulihan.pem (tidak di-commit). Simpan salinannya di tempat aman:
// tanpa kunci itu, pemulihan akses Owner di toko yang sudah terpasang tidak bisa dikerjakan.
import { createPrivateKey, generateKeyPairSync, sign } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const akar = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BERKAS_RAHASIA =
  process.env.BONSAIURIP_KUNCI_PEMULIHAN ?? path.join(akar, '.pengembang', 'kunci-pemulihan.pem');
const BERKAS_PUBLIK = path.join(akar, 'apps', 'api', 'src', 'kunci-pemulihan-publik.ts');

const [perintah, kode] = process.argv.slice(2);

if (perintah === 'buat') {
  if (existsSync(BERKAS_RAHASIA) && !process.argv.includes('--timpa')) {
    console.error(`Kunci sudah ada: ${BERKAS_RAHASIA}. Tambahkan --timpa untuk membuat yang baru.`);
    process.exit(1);
  }
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  mkdirSync(path.dirname(BERKAS_RAHASIA), { recursive: true });
  writeFileSync(BERKAS_RAHASIA, privateKey.export({ type: 'pkcs8', format: 'pem' }), {
    mode: 0o600,
  });
  const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString().trim();
  writeFileSync(
    BERKAS_PUBLIK,
    [
      '// K-232: kunci publik pemulihan akses Owner. Dibuat oleh alat-pengembang/kunci-pemulihan.mjs (perintah `buat`).',
      '// Pasangan rahasianya hanya ada di komputer pengembang; jangan pernah di-commit.',
      `export const KUNCI_PUBLIK_PEMULIHAN = \`${pem}\`;`,
      '',
    ].join('\n'),
  );
  console.log(`Kunci rahasia : ${BERKAS_RAHASIA}`);
  console.log(`Kunci publik  : ${BERKAS_PUBLIK}`);
  console.log('Simpan salinan kunci rahasia di flashdisk/tempat aman, lalu buat Setup baru.');
} else if (perintah === 'jawab' && kode) {
  const k = kode.trim().toUpperCase();
  if (!/^BU-[0-9A-F]{8}-[0-9A-F]{10}-\d{12}$/.test(k)) {
    console.error('Kode tantangan tidak dikenali. Bentuknya: BU-XXXXXXXX-XXXXXXXXXX-yyyyMMddHHmm');
    process.exit(1);
  }
  const rahasia = createPrivateKey(readFileSync(BERKAS_RAHASIA));
  const tanda = sign(null, Buffer.from(`bonsaiurip-pulih-owner:v1:${k}`), rahasia).toString(
    'base64url',
  );
  console.log(tanda);
} else {
  console.error(
    'Pemakaian: node alat-pengembang/kunci-pemulihan.mjs buat | jawab <kode-tantangan>',
  );
  process.exit(1);
}
