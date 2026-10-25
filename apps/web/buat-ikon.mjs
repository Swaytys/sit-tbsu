// Membuat installer/bonsaiurip.ico dari apps/web/public/favicon.svg (PNG 256 px di dalam berkas .ico).
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
const svg = readFileSync(new URL('./public/favicon.svg', import.meta.url), 'utf8');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 256, height: 256 } });
await p.setContent(
  `<body style="margin:0;background:transparent"><div style="width:256px;height:256px">${svg.replace('<svg ', '<svg width="256" height="256" ')}</div></body>`,
);
const png = await p.screenshot({
  omitBackground: true,
  clip: { x: 0, y: 0, width: 256, height: 256 },
});
await b.close();
const h = Buffer.alloc(22);
h.writeUInt16LE(0, 0);
h.writeUInt16LE(1, 2);
h.writeUInt16LE(1, 4);
h[6] = 0;
h[7] = 0;
h[8] = 0;
h[9] = 0;
h.writeUInt16LE(1, 10);
h.writeUInt16LE(32, 12);
h.writeUInt32LE(png.length, 14);
h.writeUInt32LE(22, 18);
writeFileSync(new URL('../../installer/bonsaiurip.ico', import.meta.url), Buffer.concat([h, png]));
process.stdout.write(`ikon ${png.length} byte
`);
