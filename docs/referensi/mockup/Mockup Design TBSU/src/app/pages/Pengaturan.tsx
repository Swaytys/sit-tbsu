import React, { useState } from 'react';
import { Save, Store, Settings2, FileText } from 'lucide-react';

type ProfilToko = {
  namaToko: string;
  alamat: string;
  telepon: string;
  email: string;
  footerStruk: string;
};

type PreferensiSistem = {
  prefixStruk: string;
  prefixInvoice: string;
  prefixSuratJalan: string;
  stokMinimumDefault: number;
};

const INITIAL_PROFIL: ProfilToko = {
  namaToko: 'UD. Sumber Urip',
  alamat: 'Jl. Raya Bangunan No. 45, Surabaya Timur',
  telepon: '(031) 555-1234',
  email: 'sumberurip@email.com',
  footerStruk: 'Terima kasih atas kepercayaan Anda.\nBarang yang sudah dibeli tidak dapat dikembalikan.',
};

const INITIAL_PREFERENSI: PreferensiSistem = {
  prefixStruk: 'STR',
  prefixInvoice: 'INV',
  prefixSuratJalan: 'SJ',
  stokMinimumDefault: 5,
};

function Section({ icon: Icon, title, children }: { icon: React.ComponentType<{className?: string}>; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-100 bg-slate-50">
        <Icon className="w-4 h-4 text-blue-600" />
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

export function Pengaturan() {
  const [profil, setProfil] = useState<ProfilToko>(INITIAL_PROFIL);
  const [pref, setPref] = useState<PreferensiSistem>(INITIAL_PREFERENSI);
  const [savedProfil, setSavedProfil] = useState(false);
  const [savedPref, setSavedPref] = useState(false);

  const setP = (k: keyof ProfilToko, v: string) => setProfil((prev) => ({ ...prev, [k]: v }));
  const setPr = (k: keyof PreferensiSistem, v: string | number) => setPref((prev) => ({ ...prev, [k]: v }));

  const handleSaveProfil = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedProfil(true);
    setTimeout(() => setSavedProfil(false), 2500);
  };

  const handleSavePref = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedPref(true);
    setTimeout(() => setSavedPref(false), 2500);
  };

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Pengaturan Sistem</h1>
        <p className="text-sm text-slate-500 mt-0.5">Konfigurasi profil toko dan preferensi operasional</p>
      </div>

      {/* Profil Toko */}
      <Section icon={Store} title="Profil Toko">
        <form onSubmit={handleSaveProfil} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Field label="Nama Toko" required>
                <input
                  value={profil.namaToko}
                  onChange={(e) => setP('namaToko', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Alamat">
                <input
                  value={profil.alamat}
                  onChange={(e) => setP('alamat', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </Field>
            </div>
            <div>
              <Field label="Telepon">
                <input
                  value={profil.telepon}
                  onChange={(e) => setP('telepon', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </Field>
            </div>
            <div>
              <Field label="Email">
                <input
                  type="email"
                  value={profil.email}
                  onChange={(e) => setP('email', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Teks Footer Struk">
                <textarea
                  value={profil.footerStruk}
                  onChange={(e) => setP('footerStruk', e.target.value)}
                  rows={3}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Teks yang tampil di bagian bawah struk / nota..."
                />
                <p className="text-xs text-slate-400 mt-1">Tampil di bawah setiap nota penjualan.</p>
              </Field>
            </div>
          </div>

          {/* Preview struk mini */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Preview Struk</p>
            <div className="bg-white border border-dashed border-slate-300 rounded p-4 font-mono text-xs text-slate-700 space-y-1 text-center">
              <p className="font-bold text-sm">{profil.namaToko}</p>
              <p className="text-slate-500">{profil.alamat}</p>
              <p className="text-slate-500">Telp: {profil.telepon}</p>
              <div className="border-t border-dashed border-slate-300 my-2" />
              <p>No: STR-2026-XXXX</p>
              <p>Tgl: 17/08/2026 10:00</p>
              <div className="border-t border-dashed border-slate-300 my-2" />
              <p className="text-left">Semen Gresik 50kg  x5</p>
              <p className="text-left">                   Rp 375.000</p>
              <div className="border-t border-dashed border-slate-300 my-2" />
              <p className="font-bold">TOTAL: Rp 375.000</p>
              <div className="border-t border-dashed border-slate-300 my-2" />
              {profil.footerStruk.split('\n').map((line, i) => (
                <p key={i} className="text-slate-500">{line}</p>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                savedProfil
                  ? 'bg-green-600 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <Save className="w-4 h-4" />
              {savedProfil ? 'Tersimpan!' : 'Simpan Profil Toko'}
            </button>
          </div>
        </form>
      </Section>

      {/* Preferensi Sistem */}
      <Section icon={Settings2} title="Preferensi Sistem">
        <form onSubmit={handleSavePref} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Field label="Prefix Struk">
                <input
                  value={pref.prefixStruk}
                  onChange={(e) => setPr('prefixStruk', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                  placeholder="STR"
                />
                <p className="text-xs text-slate-400 mt-1">Contoh: STR-2026-0001</p>
              </Field>
            </div>
            <div>
              <Field label="Prefix Invoice">
                <input
                  value={pref.prefixInvoice}
                  onChange={(e) => setPr('prefixInvoice', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                  placeholder="INV"
                />
                <p className="text-xs text-slate-400 mt-1">Contoh: INV-2026-0001</p>
              </Field>
            </div>
            <div>
              <Field label="Prefix Surat Jalan">
                <input
                  value={pref.prefixSuratJalan}
                  onChange={(e) => setPr('prefixSuratJalan', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                  placeholder="SJ"
                />
                <p className="text-xs text-slate-400 mt-1">Contoh: SJ-2026-0001</p>
              </Field>
            </div>
            <div>
              <Field label="Stok Minimum Default">
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={pref.stokMinimumDefault}
                    onChange={(e) => setPr('stokMinimumDefault', parseInt(e.target.value) || 0)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">Sistem akan memberi peringatan saat stok di bawah nilai ini.</p>
              </Field>
            </div>
          </div>

          {/* Nomor dokumen preview */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Preview Penomoran Dokumen</p>
            <div className="flex gap-6 text-sm text-slate-700">
              <span><span className="text-slate-400">Struk:</span> <code className="font-mono bg-slate-200 px-1.5 py-0.5 rounded text-xs">{pref.prefixStruk}-2026-0001</code></span>
              <span><span className="text-slate-400">Invoice:</span> <code className="font-mono bg-slate-200 px-1.5 py-0.5 rounded text-xs">{pref.prefixInvoice}-2026-0001</code></span>
              <span><span className="text-slate-400">SJ:</span> <code className="font-mono bg-slate-200 px-1.5 py-0.5 rounded text-xs">{pref.prefixSuratJalan}-2026-0001</code></span>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                savedPref
                  ? 'bg-green-600 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <Save className="w-4 h-4" />
              {savedPref ? 'Tersimpan!' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </Section>
    </div>
  );
}
