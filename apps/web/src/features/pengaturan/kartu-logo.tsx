import { ImagePlus, Image as IkonGambar, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { pesanGalat } from '@/api/client';
import { useHapusLogo, useTampilanToko, useUnggahLogo } from '@/api/pengaturan';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

/** Logo toko (K-065): tampil di sidebar dan, bila diaktifkan, di kop struk. Disimpan langsung saat dipilih. */
export function KartuLogo() {
  const tampilan = useTampilanToko();
  const unggah = useUnggahLogo();
  const hapus = useHapusLogo();
  const logo = tampilan.data?.logo;

  async function pilih(berkas: File | undefined) {
    if (!berkas) return;
    try {
      await unggah.mutateAsync(berkas);
      toast.success('Logo toko disimpan.');
    } catch (err) {
      toast.error(pesanGalat(err));
    }
  }

  async function hapusLogo() {
    try {
      await hapus.mutateAsync();
      toast.success('Logo toko dihapus.');
    } catch (err) {
      toast.error(pesanGalat(err));
    }
  }

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex items-center gap-2.5 border-b bg-slate-50 px-6 py-4">
        <IkonGambar className="size-4 text-blue-600" />
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Logo toko</h2>
          <p className="text-xs text-slate-500">
            Tampil di sidebar dan kop struk. Gambar persegi (mis. 256 × 256) paling rapi.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-6 p-6">
        {logo ? (
          <img src={logo} alt="Logo toko" className="size-20 rounded-lg border object-contain" />
        ) : (
          <div className="flex size-20 items-center justify-center rounded-lg border border-dashed text-xs text-slate-400">
            Belum ada
          </div>
        )}
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild disabled={unggah.isPending}>
              <label className="relative cursor-pointer">
                <ImagePlus /> {logo ? 'Ganti logo' : 'Unggah logo'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  aria-label="Berkas logo"
                  onChange={(e) => {
                    void pilih(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
            </Button>
            {logo && (
              <Button
                variant="ghost"
                size="sm"
                disabled={hapus.isPending}
                onClick={() => void hapusLogo()}
              >
                <Trash2 /> Hapus
              </Button>
            )}
          </div>
          <p className="text-xs text-slate-500">JPG, PNG, atau WebP, maksimal 2 MB.</p>
        </div>
      </div>
    </Card>
  );
}
