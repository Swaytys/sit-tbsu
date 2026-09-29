import type { KodeError } from '@sit/shared';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/**
 * Kesalahan yang disengaja (aturan bisnis, validasi, izin). `message` ditampilkan ke pengguna,
 * jadi ditulis dalam Bahasa Indonesia. Kesalahan lain dianggap INTERNAL oleh error handler.
 */
export class AppError extends Error {
  constructor(
    public readonly kode: KodeError,
    message: string,
    public readonly status: ContentfulStatusCode = 400,
    public readonly detail?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
