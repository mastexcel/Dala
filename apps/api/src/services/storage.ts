import { config } from '../config';
import { randomToken } from '../lib/crypto';

/**
 * URL de dépôt signée pour les pièces KYC (Supabase Storage).
 * Sans configuration, renvoie un emplacement local fictif utilisable en sandbox.
 */
export async function createUploadUrl(userId: string, fileName: string): Promise<{ uploadUrl: string; path: string }> {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${userId}/${Date.now()}-${randomToken(6)}-${safe}`;
  if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_ROLE_KEY) {
    return { uploadUrl: `sandbox://storage/${config.STORAGE_BUCKET}/${path}`, path };
  }
  const res = await fetch(`${config.SUPABASE_URL}/storage/v1/object/upload/sign/${config.STORAGE_BUCKET}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: 600 }),
  });
  if (!res.ok) throw new Error(`Storage ${res.status}`);
  const { url } = (await res.json()) as { url: string };
  return { uploadUrl: `${config.SUPABASE_URL}/storage/v1${url}`, path };
}
