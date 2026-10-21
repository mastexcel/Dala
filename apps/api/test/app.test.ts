import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { signAccessToken } from '../src/lib/jwt';

const app = createApp();

describe('API — routes publiques', () => {
  it('GET /health', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('404 en français sur route inconnue', async () => {
    const res = await request(app).get('/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Route introuvable');
  });

  it('rejette un numéro hors UEMOA à la demande OTP', async () => {
    const res = await request(app).post('/v1/auth/otp/request').send({ phone: '+33612345678' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejette un PIN non numérique à l\'inscription', async () => {
    const res = await request(app)
      .post('/v1/auth/register')
      .send({ phone: '+2250707000000', otp: '123456', firstName: 'Awa', lastName: 'Koné', pin: 'abcd' });
    expect(res.status).toBe(400);
  });

  it('JSON invalide → 400', async () => {
    const res = await request(app).post('/v1/auth/login').set('Content-Type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
  });
});

describe('API — authentification', () => {
  it('401 sans jeton', async () => {
    const res = await request(app).get('/v1/accounts/summary');
    expect(res.status).toBe(401);
  });

  it('401 avec jeton invalide', async () => {
    const res = await request(app).get('/v1/accounts/summary').set('Authorization', 'Bearer invalide');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_EXPIRED');
  });

  it('catalogue des titres accessible avec un jeton valide (sans base de données)', async () => {
    const token = signAccessToken({ sub: 'u1', amr: ['POSSESSION', 'KNOWLEDGE'], kyc: 1 });
    const res = await request(app).get('/v1/investments/bonds?halal=true').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((b: { isHalal: boolean }) => b.isHalal)).toBe(true);
  });

  it('simulation de rendement d\'un bon', async () => {
    const token = signAccessToken({ sub: 'u1', amr: ['POSSESSION'], kyc: 1 });
    const res = await request(app).get('/v1/investments/simulate?instrumentId=bt-ci-364&amount=100000').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.interest).toBe(6_067);
  });

  it('back-office refusé sans clé admin', async () => {
    const res = await request(app).get('/v1/compliance/admin/reconciliation');
    expect(res.status).toBe(403);
  });

  it('transfert refusé au KYC niveau 1', async () => {
    const token = signAccessToken({ sub: 'u1', amr: ['POSSESSION'], kyc: 1 });
    const res = await request(app).post('/v1/accounts/transfer').set('Authorization', `Bearer ${token}`).send({ toPhone: '+2250707000001', amount: 1000 });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('KYC_LEVEL');
  });
});
