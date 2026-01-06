/**
 * Storage Provider Genérico
 * Suporta diferentes implementações (S3, local, Supabase, etc.)
 * Para manter flexibilidade futura
 */

import { logger } from '@/utils/logger';

export interface StorageProvider {
  upload(
    bucket: string,
    path: string,
    file: Buffer,
    options?: { contentType?: string },
  ): Promise<void>;
  getPublicUrl(bucket: string, path: string): string;
  delete(bucket: string, path: string): Promise<void>;
}

/**
 * Storage Provider genérico
 *
 * NOTA: Este storage não é mais usado - o frontend envia links diretamente.
 * Mantido apenas para compatibilidade durante migração.
 *
 * @deprecated O frontend envia URLs de imagens diretamente
 */
class NoOpStorageProvider implements StorageProvider {
  async upload(
    bucket: string,
    path: string,
    file: Buffer,
    options?: { contentType?: string },
  ): Promise<void> {
    throw new Error(
      'Storage não está mais disponível. O frontend deve enviar URLs de imagens diretamente nos requests.',
    );
  }

  getPublicUrl(bucket: string, path: string): string {
    throw new Error(
      'Storage não está mais disponível. O frontend deve enviar URLs de imagens diretamente nos requests.',
    );
  }

  async delete(bucket: string, path: string): Promise<void> {
    throw new Error(
      'Storage não está mais disponível. O frontend deve enviar URLs de imagens diretamente nos requests.',
    );
  }
}

/**
 * Instância única do storage provider
 *
 * @deprecated Storage não é mais usado - frontend envia links diretamente
 */
export const storage: StorageProvider = new NoOpStorageProvider();

/**
 * Helper para upload de imagens
 */
export async function uploadImage(
  bucket: string,
  folder: string,
  file: Express.Multer.File,
): Promise<string> {
  const fileExt = file.originalname.split('.').pop() || '';
  const fileName = `${folder}-${Date.now()}.${fileExt}`;
  const path = `${folder}/${fileName}`;

  await storage.upload(bucket, path, file.buffer, {
    contentType: file.mimetype,
  });

  return storage.getPublicUrl(bucket, path);
}
