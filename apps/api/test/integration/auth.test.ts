import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, bearer, PIN, prisma, register, resetDb } from './helpers';

beforeAll(resetDb);
afterAll(() => prisma.$disconnect());

describe('Inscription et connexion (art. 84)', () => {
  it('crée l’utilisateur, ses 5 comptes cantonnés et une entrée d’audit', async () => {
    const { userId, token } = await register();
    const accounts = await prisma.account.findMany({ where: { userId } });
    expect(accounts.map((a) => a.type).sort()).toEqual(['CROWDFUND', 'INVESTMENT', 'MAIN', 'SAVINGS', 'VAULT']);
    expect(await prisma.auditLog.count({ where: { userId, action: 'USER_REGISTERED' } })).toBe(1);
    const me = await api().get('/v1/users/me').set(bearer(token)).expect(200);
    expect(me.body.kycLevel).toBe(1);
  });

  it('refuse un second compte sur le même numéro', async () => {
    const { phone } = await register();
    const res = await api().post('/v1/auth/otp/request').send({ phone, purpose: 'REGISTER' });
    expect(res.status).toBe(409);
  });

  it('exige OTP + PIN et rejette un mauvais OTP', async () => {
    const { phone } = await register();
    await api().post('/v1/auth/otp/request').send({ phone }).expect(200);
    const bad = await api().post('/v1/auth/login').send({ phone, otp: '000000', pin: PIN });
    expect(bad.body.code).toBe('OTP_INVALID');
    const otp = (await api().post('/v1/auth/otp/request').send({ phone })).body.devCode;
    const ok = await api().post('/v1/auth/login').send({ phone, otp, pin: PIN }).expect(200);
    expect(ok.body.accessToken).toBeTruthy();
  });

  it('verrouille le PIN après 5 erreurs', async () => {
    const { phone } = await register();
    for (let i = 0; i < 5; i++) {
      const otp = (await api().post('/v1/auth/otp/request').send({ phone })).body.devCode;
      const r = await api().post('/v1/auth/login').send({ phone, otp, pin: '9999' });
      expect(r.status).toBe(401);
    }
    const otp = (await api().post('/v1/auth/otp/request').send({ phone })).body.devCode;
    const locked = await api().post('/v1/auth/login').send({ phone, otp, pin: PIN });
    expect(locked.body.code).toBe('PIN_LOCKED');
  });

  it('fait tourner le refresh token et révoque toute la famille en cas de réutilisation', async () => {
    const { refreshToken, userId } = await register();
    const r1 = await api().post('/v1/auth/refresh').send({ refreshToken, biometric: true }).expect(200);
    expect(r1.body.refreshToken).not.toBe(refreshToken);
    await api().post('/v1/auth/refresh').send({ refreshToken }).expect(401);
    await api().post('/v1/auth/refresh').send({ refreshToken: r1.body.refreshToken }).expect(401);
    expect(await prisma.refreshToken.count({ where: { userId, revokedAt: null } })).toBe(0);
  });

  it('exige le PIN pour modifier les données personnelles', async () => {
    const { token } = await register();
    const noPin = await api().patch('/v1/users/me').set(bearer(token)).send({ firstName: 'Aminata' });
    expect(noPin.body.code).toBe('STRONG_AUTH_REQUIRED');
    const ok = await api().patch('/v1/users/me').set(bearer(token)).set('x-transaction-pin', PIN).send({ firstName: 'Aminata' }).expect(200);
    expect(ok.body.firstName).toBe('Aminata');
  });
});
