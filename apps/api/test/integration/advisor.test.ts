import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN, api, bearer, prisma, register, resetDb } from './helpers';

beforeAll(resetDb);
afterAll(() => prisma.$disconnect());

describe("Échanges avec l'équipe commerciale", () => {
  it('ouvre une conversation, reçoit la réponse du conseiller et la marque comme lue', async () => {
    const { token, userId } = await register();
    const created = await api()
      .post('/v1/advisor/conversations')
      .set(bearer(token))
      .send({ topic: 'SAVINGS', message: 'Bonjour, comment fonctionne le coffre-fort ?' })
      .expect(201);
    expect(created.body.subject).toBe('Épargne et tontines');
    expect(created.body.messages.map((m: { sender: string }) => m.sender)).toEqual(['USER', 'SYSTEM']);
    const id = created.body.id as string;

    const desk = await api().get('/v1/advisor-desk/conversations?status=OPEN').set(ADMIN).expect(200);
    const row = desk.body.find((c: { id: string }) => c.id === id);
    // L'accusé de réception automatique ne compte pas comme une réponse.
    expect(row.awaitingReply).toBe(true);
    expect(row.user.firstName).toBe('Awa');
    expect(row.lastMessage).toBe('Bonjour, comment fonctionne le coffre-fort ?');

    await api()
      .post(`/v1/advisor-desk/conversations/${id}/messages`)
      .set(ADMIN)
      .send({ authorName: 'Mariam (DALA)', body: 'Bonjour Awa, le coffre-fort bloque votre épargne pour la durée choisie.' })
      .expect(201);

    const answered = await api().get('/v1/advisor-desk/conversations').set(ADMIN).expect(200);
    expect(answered.body.find((c: { id: string }) => c.id === id).awaitingReply).toBe(false);

    const list = await api().get('/v1/advisor/conversations').set(bearer(token)).expect(200);
    expect(list.body[0]).toMatchObject({ id, unread: 1, advisorName: 'Mariam (DALA)' });
    expect(await prisma.notification.count({ where: { userId, title: 'Réponse de Mariam (DALA)' } })).toBe(1);

    const detail = await api().get(`/v1/advisor/conversations/${id}`).set(bearer(token)).expect(200);
    expect(detail.body.messages.at(-1)).toMatchObject({ sender: 'ADVISOR', authorName: 'Mariam (DALA)' });
    const after = await api().get('/v1/advisor/conversations').set(bearer(token)).expect(200);
    expect(after.body[0].unread).toBe(0);

    await api().post(`/v1/advisor/conversations/${id}/messages`).set(bearer(token)).send({ body: 'Merci !' }).expect(201);
    const awaiting = await api().get(`/v1/advisor-desk/conversations`).set(ADMIN).expect(200);
    expect(awaiting.body.find((c: { id: string }) => c.id === id).awaitingReply).toBe(true);
  });

  it("refuse les sujets d'investissement et de levée de fonds pendant la phase de test", async () => {
    const { token } = await register();
    for (const topic of ['INVEST', 'CROWDFUND', 'BUSINESS']) {
      await api().post('/v1/advisor/conversations').set(bearer(token)).send({ topic, message: 'Bonjour' }).expect(400);
    }
  });

  it("isole les conversations entre utilisateurs et protège le poste des conseillers", async () => {
    const a = await register('Awa', 'Koné');
    const b = await register('Fatou', 'Diallo');
    const c = await api().post('/v1/advisor/conversations').set(bearer(a.token)).send({ topic: 'PAYMENTS', message: 'Question sur les retraits' }).expect(201);
    await api().get(`/v1/advisor/conversations/${c.body.id}`).set(bearer(b.token)).expect(404);
    await api().post(`/v1/advisor/conversations/${c.body.id}/messages`).set(bearer(b.token)).send({ body: 'intrus' }).expect(404);
    await api().get('/v1/advisor-desk/conversations').expect(403);
    await api().get('/v1/advisor-desk/conversations').set(bearer(a.token)).expect(403);
  });

  it('clôture une conversation puis la rouvre quand le client réécrit', async () => {
    const { token } = await register();
    const c = await api().post('/v1/advisor/conversations').set(bearer(token)).send({ topic: 'CREDIT', message: 'Délai de réponse ?' }).expect(201);
    await api().post(`/v1/advisor-desk/conversations/${c.body.id}/close`).set(ADMIN).expect(204);
    await api().post(`/v1/advisor-desk/conversations/${c.body.id}/messages`).set(ADMIN).send({ authorName: 'Yao', body: 'x' }).expect(400);
    await api().post(`/v1/advisor/conversations/${c.body.id}/messages`).set(bearer(token)).send({ body: 'Encore une question' }).expect(201);
    const d = await api().get(`/v1/advisor/conversations/${c.body.id}`).set(bearer(token)).expect(200);
    expect(d.body.status).toBe('OPEN');
  });
});

describe('Poste des conseillers (page web)', () => {
  it('sert la page et son script depuis la même origine, sous CSP stricte', async () => {
    const page = await api().get('/desk/').expect(200);
    expect(page.headers['content-type']).toContain('text/html');
    expect(page.text).toContain('Poste des conseillers');
    expect(page.headers['content-security-policy']).toContain("script-src 'self'");
    const js = await api().get('/desk/desk.js').expect(200);
    expect(js.text).toContain('/v1/advisor-desk');
    // Le contenu client n'est jamais injecté comme HTML.
    expect(js.text).not.toContain('innerHTML =');
  });
});
