import type { DataAtasan } from '@sit/shared';
import { ShieldCheck } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Persetujuan di tempat (docs/04 §6, K-099): Admin/Owner mengetik akunnya sendiri di layar pengaju, tanpa
 * pengaju keluar. Dipakai retur, void, dan melampaui limit kredit (K-101). Password hanya dikirim sekali ke
 * API dan tidak disimpan di mana pun; isian dikosongkan setiap dialog dibuka. `children` = isian tambahan di
 * atas kolom akun (mis. pilihan refund). `onAjukanSaja` (opsional) = kirim tanpa atasan dan menunggu
 * persetujuan.
 */
export function DialogAtasan({
  judul,
  ringkasan,
  memproses,
  children,
  onSetujui,
  onAjukanSaja,
  onTutup,
}: {
  judul: string;
  ringkasan: ReactNode;
  memproses: boolean;
  children?: ReactNode;
  onSetujui: (atasan: DataAtasan) => void;
  onAjukanSaja?: () => void;
  onTutup: () => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const lengkap = username.trim() !== '' && password !== '';
  return (
    <Dialog open onOpenChange={(b) => !b && onTutup()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-blue-600" /> {judul}
          </DialogTitle>
          <DialogDescription>
            Butuh persetujuan Admin atau Owner. Atasan cukup mengetik akunnya sendiri di sini; Anda
            tidak perlu keluar, dan persetujuan tercatat atas nama atasan.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md bg-slate-50 p-2 text-sm">{ringkasan}</div>
        {children}
        <form
          className="grid grid-cols-2 gap-3"
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault();
            if (lengkap && !memproses) onSetujui({ username: username.trim(), password });
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="atasan-username">Nama pengguna atasan</Label>
            <Input
              id="atasan-username"
              autoFocus
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={username}
              maxLength={50}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="atasan-password">Password atasan</Label>
            <Input
              id="atasan-password"
              type="password"
              // Jangan ditawarkan untuk disimpan/diisi otomatis di peramban komputer kasir.
              autoComplete="new-password"
              value={password}
              maxLength={200}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <p className="col-span-2 text-xs text-slate-500">
            Password salah berkali-kali mengunci akun atasan, sama seperti di halaman masuk. Setiap
            percobaan tercatat di log.
          </p>
          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={onTutup}>
              Batal
            </Button>
            {onAjukanSaja && (
              <Button type="button" variant="outline" disabled={memproses} onClick={onAjukanSaja}>
                Ajukan saja, tunggu persetujuan
              </Button>
            )}
            <Button type="submit" disabled={!lengkap || memproses}>
              {memproses ? 'Memeriksa…' : 'Setujui sekarang'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
