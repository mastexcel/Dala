/**
 * Backend simulé : reproduit les règles métier de l'API (PIN > 50 000 FCFA, plafonds,
 * rétractation 48 h, scoring…) pour que l'application soit utilisable sans serveur.
 */
import {
  ADVISOR_HOURS,
  ADVISOR_TOPICS,
  CROWDFUND_REVIEW_DAYS,
  CROWDFUND_VALIDATOR,
  STRONG_AUTH_THRESHOLD,
  WITHDRAWAL_PERIOD_HOURS,
  addMonths,
  eligibleLoanAmount,
  equityForInvestment,
  isValidLoanAmount,
  loanSchedule,
  quoteLoan,
  simulateBond,
  validateCrowdfundTicket,
  vaultRate,
  type BalanceSummary,
  type PortfolioDTO,
  type TransactionDTO,
  type TransactionType,
  type AdvisorConversationDTO,
  type AdvisorMessageDTO,
  type AdvisorTopic,
} from '@dala/shared';
import { ApiError } from '../errors';
import { DEMO_OTP, DEMO_PIN, bonds, db, funds, projects, type MockConversation } from './db';

type Handler = (ctx: { params: string[]; body: any; query: URLSearchParams; headers: Record<string, string> }) => unknown;
type Account = keyof typeof db.balances;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let seq = 100;
/** PIN courant du compte démo (modifié à l'inscription). */
let currentPin = DEMO_PIN;
const id = (p: string) => `${p}${++seq}`;

function requirePin(headers: Record<string, string>, amount: number, always = false) {
  if (!always && amount <= STRONG_AUTH_THRESHOLD) return;
  const pin = headers['x-transaction-pin'];
  if (!pin) throw new ApiError(403, 'Confirmation par PIN requise', 'STRONG_AUTH_REQUIRED');
  if (pin !== currentPin) throw new ApiError(403, 'PIN incorrect', 'INVALID_PIN');
}

function post(type: TransactionType, amount: number, description: string, from: Account | null, to: Account | null): TransactionDTO {
  if (from) {
    if (db.balances[from] < amount) throw new ApiError(400, 'Solde insuffisant', 'INSUFFICIENT_FUNDS');
    db.balances[from] -= amount;
  }
  if (to) db.balances[to] += amount;
  const signed = to === 'MAIN' || from === null ? amount : -amount;
  const tx: TransactionDTO = { id: id('tx'), type, amount: signed, currency: 'XOF', description, reference: `DLA-DEMO-${seq}`, status: 'COMPLETED', createdAt: new Date().toISOString() };
  db.transactions.unshift(tx);
  return tx;
}

function notify(title: string, body: string, type: string) {
  db.notifications.unshift({ id: id('n'), title, body, type, isRead: false, createdAt: new Date().toISOString() });
}

const CATEGORY: Record<string, TransactionType[]> = {
  SAVINGS: ['SAVINGS_IN', 'SAVINGS_OUT'],
  INVEST: ['INVESTMENT_BUY', 'INVESTMENT_RETURN'],
  CROWDFUND: ['CROWDFUND_IN', 'CROWDFUND_RETURN'],
  CREDIT: ['LOAN_DISBURSEMENT', 'LOAN_REPAYMENT'],
  TRANSFER: ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER_IN', 'TRANSFER_OUT', 'FEE'],
};

function authResponse() {
  return { user: db.user, accessToken: 'demo-access', refreshToken: 'demo-refresh' };
}

function hasOpenLoan() {
  return db.loans.some((l) => ['PENDING', 'APPROVED', 'DISBURSED', 'OVERDUE'].includes(l.status));
}

const routes: [string, RegExp, Handler][] = [
  /* --------------------------------- Auth --------------------------------- */
  ['POST', /^\/auth\/otp\/request$/, () => ({ sent: true, devCode: DEMO_OTP })],
  ['POST', /^\/auth\/login$/, ({ body }) => {
    if (body.otp !== DEMO_OTP) throw new ApiError(400, 'Code incorrect', 'OTP_INVALID');
    if (body.pin !== currentPin) throw new ApiError(401, 'PIN incorrect', 'INVALID_PIN');
    db.user.phone = body.phone;
    return authResponse();
  }],
  ['POST', /^\/auth\/register$/, ({ body }) => {
    if (body.otp !== DEMO_OTP) throw new ApiError(400, 'Code incorrect', 'OTP_INVALID');
    Object.assign(db.user, { phone: body.phone, firstName: body.firstName, lastName: body.lastName, kycLevel: 1 });
    currentPin = body.pin;
    return authResponse();
  }],
  ['POST', /^\/auth\/refresh$/, () => authResponse()],
  ['POST', /^\/auth\/pin\/verify$/, ({ body }) => {
    if (body.pin !== currentPin) throw new ApiError(403, 'PIN incorrect', 'INVALID_PIN');
    return { ok: true };
  }],

  /* -------------------------------- Users --------------------------------- */
  ['GET', /^\/users\/me$/, () => db.user],
  ['PATCH', /^\/users\/me$/, ({ body, headers }) => {
    requirePin(headers, 0, true);
    Object.assign(db.user, body);
    return db.user;
  }],
  ['GET', /^\/users\/me\/limits$/, () => ({
    kycLevel: db.user.kycLevel,
    regulatoryMonthlyLimit: db.user.kycLevel === 1 ? 200_000 : db.user.kycLevel === 2 ? 2_000_000 : null,
    transfersAllowed: db.user.kycLevel > 1,
    customMonthlyLimit: null,
    usedThisMonth: 160_000,
  })],
  ['PUT', /^\/users\/me\/limits$/, ({ body, headers }) => {
    requirePin(headers, 0, true);
    return body;
  }],
  ['POST', /^\/users\/me\/kyc\/upload-url$/, ({ body }) => ({ uploadUrl: `sandbox://storage/${body.fileName}`, path: `demo/${body.fileName}` })],
  ['POST', /^\/users\/me\/kyc$/, () => {
    notify('Documents reçus', 'Votre vérification est en cours (24 à 48 h).', 'KYC');
    return { status: 'PENDING_REVIEW' };
  }],
  ['GET', /^\/users\/me\/referrals$/, () => ({
    code: db.user.referralCode,
    link: `https://dala.finance/r/${db.user.referralCode}`,
    count: 3,
    referees: [{ firstName: 'Moussa' }, { firstName: 'Fatou' }, { firstName: 'Yao' }],
  })],

  /* ------------------------------- Accounts ------------------------------- */
  ['GET', /^\/accounts\/summary$/, () => {
    const b = db.balances;
    const total = b.MAIN + b.SAVINGS + b.VAULT + b.INVESTMENT + b.CROWDFUND;
    const outstanding = db.loans.filter((l) => l.status === 'DISBURSED' || l.status === 'OVERDUE').reduce((s, l) => s + l.totalDue - l.amountPaid, 0);
    const summary: BalanceSummary = {
      total,
      main: b.MAIN,
      savings: b.SAVINGS,
      savingsTarget: db.goals.reduce((s, g) => s + g.targetAmount, 0),
      vault: b.VAULT,
      investments: b.INVESTMENT,
      crowdfund: b.CROWDFUND,
      crowdfundActiveProjects: new Set(db.holdings.filter((h) => h.status !== 'CLOTURE').map((h) => h.projectId)).size,
      creditOutstanding: outstanding,
      creditEligible: hasOpenLoan() ? 0 : eligibleLoanAmount(db.user.creditScore),
      monthDelta: 12_500,
      monthDeltaPct: 0.053,
    };
    return summary;
  }],
  ['POST', /^\/accounts\/deposit$/, ({ body }) => {
    post('DEPOSIT', body.amount, `Dépôt ${providerName(body.provider)}`, null, 'MAIN');
    notify('Dépôt reçu', `${body.amount} FCFA via ${providerName(body.provider)}`, 'TRANSACTION');
    return { status: 'SUCCESS' };
  }],
  ['POST', /^\/accounts\/withdraw$/, ({ body, headers }) => {
    requirePin(headers, body.amount);
    post('WITHDRAWAL', body.amount, `Retrait ${providerName(body.provider)}`, 'MAIN', null);
    return { status: 'SUCCESS' };
  }],
  ['POST', /^\/accounts\/transfer$/, ({ body, headers }) => {
    if (db.user.kycLevel < 2) throw new ApiError(403, 'KYC de niveau 2 requis', 'KYC_LEVEL');
    requirePin(headers, body.amount);
    post('TRANSFER_OUT', body.amount, `Envoi à ${body.toPhone}`, 'MAIN', null);
    return { ok: true };
  }],

  /* -------------------------------- Savings ------------------------------- */
  ['GET', /^\/savings\/goals$/, () => db.goals],
  ['POST', /^\/savings\/goals$/, ({ body }) => {
    const g = { id: id('g'), currentAmount: 0, icon: 'target', deadline: null, frequency: null, autoAmount: null, ...body };
    db.goals.unshift(g);
    return g;
  }],
  ['POST', /^\/savings\/goals\/([^/]+)\/deposit$/, ({ params, body, headers }) => {
    const g = db.goals.find((x) => x.id === params[0]);
    if (!g) throw new ApiError(404, 'Objectif introuvable');
    requirePin(headers, body.amount);
    post('SAVINGS_IN', body.amount, `Épargne · ${g.name}`, 'MAIN', 'SAVINGS');
    g.currentAmount += body.amount;
    return g;
  }],
  ['GET', /^\/savings\/tontines$/, () => db.tontines],
  ['GET', /^\/savings\/tontines\/([^/]+)$/, ({ params }) => {
    const t = db.tontines.find((x) => x.id === params[0]);
    if (!t) throw new ApiError(404, 'Tontine introuvable');
    return t;
  }],
  ['POST', /^\/savings\/tontines\/([^/]+)\/contribute$/, ({ params, headers }) => {
    const t = db.tontines.find((x) => x.id === params[0]);
    if (!t) throw new ApiError(404, 'Tontine introuvable');
    requirePin(headers, 0, true);
    const me = t.members.find((m) => m.userId === db.user.id || m.userId === 'u_awa');
    if (!me) throw new ApiError(403, "Vous n'êtes pas membre");
    if (me.hasPaid) throw new ApiError(409, 'Cotisation déjà versée pour ce tour');
    post('SAVINGS_IN', t.amount, `Cotisation tontine · ${t.name}`, 'MAIN', null);
    me.hasPaid = true;
    return t;
  }],
  ['POST', /^\/savings\/tontines$/, ({ body }) => {
    const t = {
      id: id('t'), ...body, currentCycle: 1, totalCycles: body.maxMembers, status: 'PENDING', myPosition: 1,
      nextContributionDate: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      members: [{ id: id('m'), userId: db.user.id, name: `${db.user.firstName} ${db.user.lastName[0]}.`, position: 1, hasPaid: false, hasReceived: false }],
    };
    db.tontines.push(t);
    return t;
  }],
  ['GET', /^\/savings\/vaults$/, () => ({ options: [{ months: 3, rate: 0.035 }, { months: 6, rate: 0.045 }, { months: 12, rate: 0.06 }], vaults: db.vaults })],
  ['POST', /^\/savings\/vaults$/, ({ body, headers }) => {
    requirePin(headers, body.amount);
    post('SAVINGS_IN', body.amount, `Coffre-fort ${body.months} mois`, 'MAIN', 'VAULT');
    const v = { id: id('v'), amount: body.amount, rate: vaultRate(body.months), months: body.months, createdAt: new Date().toISOString(), unlockDate: addMonths(new Date(), body.months).toISOString(), accruedInterest: 0 };
    db.vaults.push(v);
    return v;
  }],

  /* ------------------------------ Investments ----------------------------- */
  ['GET', /^\/investments\/bonds$/, ({ query }) => (query.get('halal') === 'true' ? bonds.filter((b) => b.isHalal) : bonds)],
  ['GET', /^\/investments\/bonds\/([^/]+)$/, ({ params }) => {
    const b = bonds.find((x) => x.id === params[0]);
    if (!b) throw new ApiError(404, 'Titre introuvable');
    return b;
  }],
  ['GET', /^\/investments\/funds$/, ({ query }) => (query.get('halal') === 'true' ? funds.filter((f) => f.isHalal) : funds)],
  ['GET', /^\/investments\/simulate$/, ({ query }) => {
    const b = bonds.find((x) => x.id === query.get('instrumentId'));
    const amount = Number(query.get('amount'));
    return b ? simulateBond(amount, b.rate, b.maturityDays) : { amount, interest: 0, total: amount, effectiveYield: 0 };
  }],
  ['GET', /^\/investments\/portfolio$/, () => {
    const active = db.investments.filter((i) => i.status === 'ACTIVE');
    const valueAt = (t: number) => active.filter((i) => new Date(i.createdAt).getTime() <= t).reduce((s, i) => s + i.amount * (1 + (i.rate * (t - new Date(i.createdAt).getTime())) / (365 * 86_400_000)), 0);
    const invested = active.reduce((s, i) => s + i.amount, 0);
    const now = Date.now();
    const totalValue = Math.round(valueAt(now));
    const p: PortfolioDTO = {
      totalValue,
      invested,
      ytdReturn: totalValue - invested,
      ytdReturnPct: invested ? (totalValue - invested) / invested : 0,
      history: Array.from({ length: 30 }, (_, k) => {
        const t = now - (29 - k) * 86_400_000;
        return { date: new Date(t).toISOString().slice(0, 10), value: Math.round(valueAt(t)) };
      }),
      investments: db.investments,
    };
    return p;
  }],
  ['POST', /^\/investments$/, ({ body, headers }) => {
    const bond = bonds.find((b) => b.id === body.instrumentId);
    const fund = funds.find((f) => f.id === body.instrumentId);
    const inst = bond ?? fund;
    if (!inst) throw new ApiError(404, 'Titre introuvable');
    if (body.amount < inst.minAmount) throw new ApiError(400, `Montant minimum : ${inst.minAmount} FCFA`);
    requirePin(headers, body.amount);
    const name = bond ? `${bond.type === 'SUKUK' ? 'Sukuk' : 'Bon du Trésor'} ${bond.issuerCountry} ${bond.maturityDays} j` : fund!.name;
    post('INVESTMENT_BUY', body.amount, name, 'MAIN', 'INVESTMENT');
    const inv = {
      id: id('i'), type: bond ? bond.type : 'FCP', instrumentId: inst.id, instrumentName: name, amount: body.amount,
      rate: bond ? bond.rate : fund!.ytdPerformance, maturityDate: new Date(Date.now() + (bond?.maturityDays ?? 365) * 86_400_000).toISOString(),
      status: 'ACTIVE', isHalal: inst.isHalal, createdAt: new Date().toISOString(),
    } as const;
    db.investments.unshift({ ...inv });
    notify('Investissement confirmé 📈', `Rétractation possible pendant ${WITHDRAWAL_PERIOD_HOURS} h.`, 'INVEST');
    return inv;
  }],

  /* ------------------------------- Crowdfund ------------------------------ */
  ['GET', /^\/crowdfund\/projects$/, ({ query }) => {
    const sector = query.get('sector');
    return sector ? projects.filter((p) => p.sector === sector) : projects;
  }],
  ['GET', /^\/crowdfund\/projects\/([^/]+)$/, ({ params }) => {
    const p = projects.find((x) => x.id === params[0]);
    if (!p) throw new ApiError(404, 'Projet introuvable');
    return p;
  }],
  ['POST', /^\/crowdfund\/projects\/([^/]+)\/invest$/, ({ params, body, headers }) => {
    const p = projects.find((x) => x.id === params[0]);
    if (!p) throw new ApiError(404, 'Projet introuvable');
    const err = validateCrowdfundTicket(body.amount, p.fundingGoal, p.fundingRaised);
    if (err) throw new ApiError(400, err);
    requirePin(headers, body.amount);
    post('CROWDFUND_IN', body.amount, `Crowdfund · ${p.name}`, 'MAIN', 'CROWDFUND');
    p.fundingRaised += body.amount;
    p.investorCount += 1;
    const equityPct = equityForInvestment(body.amount, p.valuation);
    db.holdings.unshift({ id: id('h'), projectId: p.id, projectName: p.name, sector: p.sector, amount: body.amount, equityPct, estimatedValue: body.amount, status: 'EN_COURS', createdAt: new Date().toISOString() });
    return { id: id('ci'), equityPct, status: 'PENDING' };
  }],
  ['GET', /^\/crowdfund\/portfolio$/, () => ({ totalInvested: db.holdings.reduce((s, h) => s + h.amount, 0), holdings: db.holdings })],
  ['POST', /^\/crowdfund\/projects$/, () => ({ id: id('p'), status: 'SUBMITTED' })],

  /* --------------------------------- Loans -------------------------------- */
  ['GET', /^\/loans$/, () => ({ score: db.user.creditScore, eligibleAmount: hasOpenLoan() ? 0 : eligibleLoanAmount(db.user.creditScore), loans: db.loans })],
  ['GET', /^\/loans\/quote$/, ({ query }) => quoteLoan(Number(query.get('amount')), Number(query.get('duration')), db.user.creditScore)],
  ['POST', /^\/loans$/, ({ body, headers }) => {
    if (!isValidLoanAmount(body.amount)) throw new ApiError(400, 'Montant hors grille');
    if (hasOpenLoan()) throw new ApiError(409, 'Vous avez déjà un prêt en cours');
    requirePin(headers, body.amount);
    const quote = quoteLoan(body.amount, body.duration, db.user.creditScore);
    const eligible = eligibleLoanAmount(db.user.creditScore);
    const decision = body.amount <= eligible ? 'APPROVED' : body.amount <= eligible * 1.5 ? 'MANUAL_REVIEW' : 'REJECTED';
    const loan = {
      id: id('l'), amount: body.amount, interestRate: quote.annualRate, fees: quote.fees, totalDue: quote.totalDue, duration: body.duration,
      dueDate: quote.dueDate, amountPaid: 0, status: decision === 'APPROVED' ? 'DISBURSED' : decision === 'REJECTED' ? 'REJECTED' : 'PENDING',
      createdAt: new Date().toISOString(), disbursedAt: decision === 'APPROVED' ? new Date().toISOString() : null,
    } as const;
    db.loans.unshift({ ...loan });
    if (decision === 'APPROVED') post('LOAN_DISBURSEMENT', body.amount, `Prêt DALA ${body.duration} j`, null, 'MAIN');
    return { decision, score: db.user.creditScore, loan, quote };
  }],
  ['GET', /^\/loans\/([^/]+)$/, ({ params }) => {
    const l = db.loans.find((x) => x.id === params[0]);
    if (!l) throw new ApiError(404, 'Prêt introuvable');
    return {
      ...l,
      schedule: loanSchedule(l.totalDue, l.duration, new Date(l.disbursedAt ?? l.createdAt), l.amountPaid),
      repayments: l.amountPaid ? [{ id: 'r1', amount: l.amountPaid, paidAt: l.dueDate }] : [],
      daysLeft: Math.ceil((new Date(l.dueDate).getTime() - Date.now()) / 86_400_000),
    };
  }],
  ['POST', /^\/loans\/([^/]+)\/repay$/, ({ params, body, headers }) => {
    const l = db.loans.find((x) => x.id === params[0]);
    if (!l) throw new ApiError(404, 'Prêt introuvable');
    requirePin(headers, body.amount);
    const pay = Math.min(body.amount, l.totalDue - l.amountPaid);
    post('LOAN_REPAYMENT', pay, 'Remboursement prêt DALA', 'MAIN', null);
    l.amountPaid += pay;
    if (l.amountPaid >= l.totalDue) {
      l.status = 'REPAID';
      db.user.creditScore = Math.min(100, db.user.creditScore + 3);
    }
    return l;
  }],

  /* ----------------------------- Transactions ----------------------------- */
  ['GET', /^\/transactions$/, ({ query }) => {
    const cat = query.get('category') ?? 'ALL';
    const q = (query.get('q') ?? '').toLowerCase();
    const limit = Number(query.get('limit') ?? 30);
    const items = db.transactions.filter((t) => (cat === 'ALL' || CATEGORY[cat]?.includes(t.type)) && (!q || t.description.toLowerCase().includes(q)));
    return { items: items.slice(0, limit), nextCursor: null };
  }],

  /* ---------------------------- Notifications ----------------------------- */
  ['GET', /^\/notifications$/, () => ({ items: db.notifications, unread: db.notifications.filter((n) => !n.isRead).length })],
  ['POST', /^\/notifications\/read-all$/, () => {
    db.notifications.forEach((n) => (n.isRead = true));
    return undefined;
  }],

  /* ------------------------- Équipe commerciale ------------------------- */
  ['GET', /^\/advisor\/conversations$/, () =>
    [...db.advisor].sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt)).map(advisorSummary)],
  ['POST', /^\/advisor\/conversations$/, ({ body }) => {
    const now = Date.now();
    const c: MockConversation = {
      id: id('conv'),
      topic: body.topic,
      subject: body.subject || ADVISOR_TOPICS[body.topic as AdvisorTopic],
      status: 'OPEN',
      advisorName: null,
      createdAt: new Date(now).toISOString(),
      lastMessageAt: new Date(now).toISOString(),
      readAt: new Date(now + 1).toISOString(),
      messages: [
        advisorMsg('USER', body.message, null, now),
        advisorMsg('SYSTEM', `Votre demande a bien été transmise à l'équipe commerciale DALA. Un conseiller vous répond ici ${ADVISOR_HOURS}.`, null, now + 1),
      ],
    };
    db.advisor.push(c);
    scheduleAdvisorReply(c, body.message);
    return { ...advisorSummary(c), messages: c.messages };
  }],
  ['GET', /^\/advisor\/conversations\/([^/]+)$/, ({ params }) => {
    const c = findConversation(params[0]);
    c.readAt = new Date().toISOString();
    return { ...advisorSummary(c), messages: c.messages };
  }],
  ['POST', /^\/advisor\/conversations\/([^/]+)\/messages$/, ({ params, body }) => {
    const c = findConversation(params[0]);
    const m = advisorMsg('USER', body.body, null);
    c.messages.push(m);
    c.status = 'OPEN';
    c.lastMessageAt = c.readAt = m.createdAt;
    scheduleAdvisorReply(c, body.body);
    return m;
  }],

  /* ------------------------------ Compliance ------------------------------ */
  ['POST', /^\/compliance\/complaints$/, ({ body }) => {
    notify('Réclamation enregistrée', 'Réponse garantie sous 15 jours ouvrés.', 'SYSTEM');
    return { id: id('c'), ...body, status: 'OPEN' };
  }],
];

function advisorMsg(sender: AdvisorMessageDTO['sender'], body: string, authorName: string | null, at = Date.now()): AdvisorMessageDTO {
  return { id: id('m'), sender, authorName, body, createdAt: new Date(at).toISOString() };
}

function advisorSummary(c: MockConversation): AdvisorConversationDTO {
  const { messages, readAt, ...rest } = c;
  return {
    ...rest,
    lastMessage: messages.at(-1)?.body ?? null,
    unread: messages.filter((m) => m.sender !== 'USER' && m.createdAt > readAt).length,
  };
}

function findConversation(convId: string) {
  const c = db.advisor.find((x) => x.id === convId);
  if (!c) throw new ApiError(404, 'Conversation introuvable');
  return c;
}

/** Délai de réponse du conseiller simulé (raccourci par les tests). */
export const advisorDemo = { delayMs: 4_000 };
const DEMO_ADVISOR = 'Mariam Traoré · Conseillère DALA';

/** En mode démo, une conseillère répond automatiquement après quelques secondes. */
function scheduleAdvisorReply(c: MockConversation, question: string) {
  setTimeout(() => {
    const first = !c.advisorName;
    c.advisorName = DEMO_ADVISOR;
    const intro = first ? `Bonjour ${db.user.firstName}, je suis Mariam, votre conseillère. ` : '';
    const m = advisorMsg('ADVISOR', intro + demoAdvisorAnswer(c.topic, question), DEMO_ADVISOR);
    c.messages.push(m);
    c.lastMessageAt = m.createdAt;
    notify(`Réponse de Mariam Traoré`, m.body.length > 120 ? `${m.body.slice(0, 117)}…` : m.body, 'SYSTEM');
  }, advisorDemo.delayMs);
}

function demoAdvisorAnswer(topic: AdvisorTopic, question: string) {
  if (/rendez-vous|rdv|appel|rappel/i.test(question)) return 'Je peux vous rappeler demain entre 9 h et 12 h. Cela vous convient-il ?';
  switch (topic) {
    case 'INVEST':
      return "Les bons du Trésor UEMOA conviennent bien à un horizon court et à un objectif de revenu régulier. Je peux vous présenter les émissions ouvertes et simuler votre rendement selon votre montant.";
    case 'CROWDFUND':
      return `Sur DALA, le crowdfunding est uniquement en capital : vous devenez actionnaire. Chaque projet est validé par ${CROWDFUND_VALIDATOR}. Quel secteur vous intéresse ?`;
    case 'SAVINGS':
      return "Pour démarrer, un objectif avec épargne automatique hebdomadaire fonctionne très bien. Le coffre-fort à 6 ou 12 mois offre un meilleur taux si vous n'avez pas besoin des fonds.";
    case 'CREDIT':
      return 'Votre montant éligible dépend de votre score DALA. Régularité de l’épargne et remboursements ponctuels le font progresser. Souhaitez-vous que je regarde votre dossier ?';
    case 'BUSINESS':
      return `Pour lever des fonds, déposez votre projet depuis l'onglet Crowdfunding. Le comité ${CROWDFUND_VALIDATOR} l'étudie sous ${CROWDFUND_REVIEW_DAYS} jours. Je peux vous aider à préparer le dossier.`;
    default:
      return 'Merci pour votre message. Pouvez-vous me donner quelques précisions pour que je vous oriente au mieux ?';
  }
}

function providerName(p: string) {
  return { ORANGE_MONEY: 'Orange Money', MTN_MOMO: 'MTN MoMo', WAVE: 'Wave', MOOV_MONEY: 'Moov Money' }[p] ?? p;
}

export async function mockRequest<T>(method: string, fullPath: string, body: unknown, headers: Record<string, string>): Promise<T> {
  await sleep(250);
  const [path, qs = ''] = fullPath.split('?');
  for (const [m, re, handler] of routes) {
    if (m !== method) continue;
    const match = path.match(re);
    if (match) {
      // Copie profonde : évite que React Query partage des références mutées par le mock.
      const result = handler({ params: match.slice(1), body: body ?? {}, query: new URLSearchParams(qs), headers });
      return (result === undefined ? undefined : JSON.parse(JSON.stringify(result))) as T;
    }
  }
  throw new ApiError(404, `Route simulée introuvable : ${method} ${path}`);
}

