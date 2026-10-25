import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config';
import { randomToken } from '../lib/crypto';

/**
 * URL de dépôt signée pour les pièces KYC, chez l'hébergeur d'Abidjan (stockage compatible S3) :
 * les pièces d'identité restent dans l'UEMOA. Sans configuration, renvoie un emplacement local
 * fictif utilisable en sandbox.
 */
let client: S3Client | null = null;
function s3() {
  client ??= new S3Client({
    endpoint: config.S3_ENDPOINT,
    region: config.S3_REGION,
    forcePathStyle: true,
    credentials: { accessKeyId: config.S3_ACCESS_KEY_ID!, secretAccessKey: config.S3_SECRET_ACCESS_KEY! },
  });
  return client;
}

export async function createUploadUrl(userId: string, fileName: string): Promise<{ uploadUrl: string; path: string }> {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${userId}/${Date.now()}-${randomToken(6)}-${safe}`;
  if (config.STORAGE_DRIVER !== 's3') {
    return { uploadUrl: `sandbox://storage/${config.STORAGE_BUCKET}/${path}`, path };
  }
  const uploadUrl = await getSignedUrl(s3(), new PutObjectCommand({ Bucket: config.STORAGE_BUCKET, Key: path }), { expiresIn: 600 });
  return { uploadUrl, path };
}
