import jwt from 'jsonwebtoken';
import type { AuthFactor } from '@dala/shared';
import { config } from '../config';

export interface AccessClaims {
  sub: string;
  /** Facteurs d'authentification utilisés (Art. 84). */
  amr: AuthFactor[];
  kyc: number;
}

export function signAccessToken(claims: AccessClaims): string {
  return jwt.sign(claims, config.JWT_SECRET, {
    expiresIn: config.JWT_ACCESS_TTL as jwt.SignOptions['expiresIn'],
    issuer: 'dala-finance',
  });
}

export function verifyAccessToken(token: string): AccessClaims {
  const payload = jwt.verify(token, config.JWT_SECRET, { issuer: 'dala-finance' });
  if (typeof payload === 'string' || !payload.sub) throw new Error('Jeton invalide');
  return payload as unknown as AccessClaims;
}
