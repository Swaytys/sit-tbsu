import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import forge from 'node-forge';

/*
 * K-229: sertifikat HTTPS milik toko untuk mode LAN. Komputer server membuat *CA toko* sendiri (berlaku 10 tahun),
 * lalu sertifikat server untuk alamat IP dan nama komputer (berlaku 397 hari, diperbarui otomatis 30 hari sebelum
 * habis atau bila alamat IP berubah). HP/tablet memasang CA toko sekali, sesudah itu alamat https di WiFi toko
 * dipercaya peramban (cookie aman dan PWA berfungsi). Kunci rahasia tidak pernah meninggalkan komputer server.
 */

export type BerkasLan = {
  /** PEM sertifikat + kunci server untuk https.createServer. */
  cert: string;
  key: string;
  /** PEM CA toko yang dipasang di perangkat. */
  caPem: string;
  /** Sidik jari SHA-256 CA (untuk dicocokkan pemilik di layar perangkat). */
  sidikJari: string;
  /** Alamat IP dan nama yang tercakup sertifikat server. */
  alamat: string[];
  berlakuSampai: string;
};

const HARI = 86_400_000;

/** Alamat IPv4 jaringan lokal komputer ini (tanpa loopback dan alamat otomatis 169.254.x.x). */
export function alamatLokal(): string[] {
  const hasil: string[] = [];
  for (const daftar of Object.values(os.networkInterfaces())) {
    for (const a of daftar ?? []) {
      if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.')) {
        hasil.push(a.address);
      }
    }
  }
  return [...new Set(hasil)].sort();
}

function nomorSeri(): string {
  // Bilangan positif (bit teratas 0) sesuai RFC 5280.
  const b = randomBytes(16);
  b[0] = b[0]! & 0x7f;
  return b.toString('hex');
}

export function sidikJariPem(pem: string): string {
  const der = forge.asn1
    .toDer(forge.pki.certificateToAsn1(forge.pki.certificateFromPem(pem)))
    .getBytes();
  const hex = createHash('sha256').update(Buffer.from(der, 'binary')).digest('hex').toUpperCase();
  return hex.match(/.{2}/g)!.join(':');
}

function buatCa(namaToko: string) {
  const kunci = forge.pki.rsa.generateKeyPair(2048);
  const c = forge.pki.createCertificate();
  c.publicKey = kunci.publicKey;
  c.serialNumber = nomorSeri();
  c.validity.notBefore = new Date(Date.now() - HARI);
  c.validity.notAfter = new Date(Date.now() + 3650 * HARI);
  const nama = [
    { name: 'commonName', value: `Sertifikat toko ${namaToko}`.slice(0, 64) },
    { name: 'organizationName', value: 'BonsaiUrip' },
  ];
  c.setSubject(nama);
  c.setIssuer(nama);
  c.setExtensions([
    { name: 'basicConstraints', cA: true, critical: true, pathLenConstraint: 0 },
    { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true },
    { name: 'subjectKeyIdentifier' },
  ]);
  c.sign(kunci.privateKey, forge.md.sha256.create());
  return {
    certPem: forge.pki.certificateToPem(c),
    keyPem: forge.pki.privateKeyToPem(kunci.privateKey),
  };
}

function buatServer(caCertPem: string, caKeyPem: string, alamat: string[]) {
  const ca = forge.pki.certificateFromPem(caCertPem);
  const caKey = forge.pki.privateKeyFromPem(caKeyPem);
  const kunci = forge.pki.rsa.generateKeyPair(2048);
  const c = forge.pki.createCertificate();
  c.publicKey = kunci.publicKey;
  c.serialNumber = nomorSeri();
  c.validity.notBefore = new Date(Date.now() - HARI);
  c.validity.notAfter = new Date(Date.now() + 397 * HARI);
  c.setSubject([{ name: 'commonName', value: alamat[0] ?? 'localhost' }]);
  c.setIssuer(ca.subject.attributes);
  const ip = alamat.filter((a) => /^\d+\.\d+\.\d+\.\d+$/.test(a));
  const dns = alamat.filter((a) => !/^\d+\.\d+\.\d+\.\d+$/.test(a));
  c.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, critical: true },
    { name: 'extKeyUsage', serverAuth: true },
    {
      name: 'subjectAltName',
      altNames: [
        ...dns.map((value) => ({ type: 2, value })),
        ...ip.map((value) => ({ type: 7, ip: value })),
      ],
    },
  ]);
  c.sign(caKey, forge.md.sha256.create());
  return {
    certPem: forge.pki.certificateToPem(c),
    keyPem: forge.pki.privateKeyToPem(kunci.privateKey),
    sampai: c.validity.notAfter,
  };
}

/**
 * Memastikan CA toko dan sertifikat server ada dan masih cocok dengan alamat komputer sekarang. Berkas disimpan di
 * `folder` (di dalam STORAGE_DIR/sistem, tidak ikut salinan data toko karena milik komputer ini).
 */
export function pastikanSertifikatLan(
  folder: string,
  namaToko: string,
  alamatIp: string[] = alamatLokal(),
): BerkasLan {
  mkdirSync(folder, { recursive: true });
  const f = (n: string) => path.join(folder, n);
  if (!existsSync(f('ca.crt')) || !existsSync(f('ca.key'))) {
    const ca = buatCa(namaToko || 'BonsaiUrip');
    writeFileSync(f('ca.key'), ca.keyPem, { mode: 0o600 });
    writeFileSync(f('ca.crt'), ca.certPem);
  }
  const caPem = readFileSync(f('ca.crt'), 'utf8');
  const nama = os.hostname().toLowerCase();
  const alamat = [...alamatIp, nama, `${nama}.local`, 'localhost'];
  let perluBaru = !existsSync(f('server.crt')) || !existsSync(f('server.key'));
  if (!perluBaru) {
    const lama = forge.pki.certificateFromPem(readFileSync(f('server.crt'), 'utf8'));
    const tercakup = new Set<string>(
      (
        (lama.getExtension('subjectAltName') as { altNames?: { value?: string; ip?: string }[] })
          ?.altNames ?? []
      ).map((a) => a.ip ?? a.value ?? ''),
    );
    perluBaru =
      lama.validity.notAfter.getTime() - Date.now() < 30 * HARI ||
      alamat.some((a) => !tercakup.has(a));
  }
  if (perluBaru) {
    const s = buatServer(caPem, readFileSync(f('ca.key'), 'utf8'), alamat);
    writeFileSync(f('server.key'), s.keyPem, { mode: 0o600 });
    writeFileSync(f('server.crt'), s.certPem);
  }
  const cert = readFileSync(f('server.crt'), 'utf8');
  return {
    cert: cert + caPem,
    key: readFileSync(f('server.key'), 'utf8'),
    caPem,
    sidikJari: sidikJariPem(caPem),
    alamat,
    berlakuSampai: forge.pki.certificateFromPem(cert).validity.notAfter.toISOString(),
  };
}
