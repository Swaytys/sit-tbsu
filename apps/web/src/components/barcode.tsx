import { bisaCode128, modulCode128 } from '@sit/shared';

/**
 * Barcode Code 128 sebagai SVG (K-090). Lebar mengikuti wadah; `tinggi` dalam satuan modul relatif.
 * Teks yang tidak bisa dikodekan tidak digambar (komponen mengembalikan null).
 */
export function Barcode({
  nilai,
  tinggi = 28,
  className,
}: {
  nilai: string;
  tinggi?: number;
  className?: string;
}) {
  if (!bisaCode128(nilai)) return null;
  const modul = modulCode128(nilai);
  const tepi = 10; // quiet zone minimal 10 modul di kiri-kanan
  const lebar = modul.reduce((a, b) => a + b, 0) + tepi * 2;
  const batang: { x: number; w: number }[] = [];
  let x = tepi;
  modul.forEach((w, i) => {
    if (i % 2 === 0) batang.push({ x, w });
    x += w;
  });
  return (
    <svg
      viewBox={`0 0 ${lebar} ${tinggi}`}
      preserveAspectRatio="none"
      className={className}
      role="img"
      aria-label={`Barcode ${nilai}`}
      shapeRendering="crispEdges"
    >
      <rect width={lebar} height={tinggi} fill="#fff" />
      {batang.map((b) => (
        <rect key={b.x} x={b.x} y={0} width={b.w} height={tinggi} fill="#000" />
      ))}
    </svg>
  );
}
