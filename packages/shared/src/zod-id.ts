import { z } from 'zod';

// Pesan bawaan Zod dalam Bahasa Indonesia, sama di API dan web (CLAUDE.md § UI: pesan klien = pesan API).
// Diimpor sekali oleh index.ts sehingga berlaku bagi siapa pun yang memakai packages/shared.
z.config(z.locales.id());
