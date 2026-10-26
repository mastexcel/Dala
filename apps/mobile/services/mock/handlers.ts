/**
 * Backend simulé : reproduit les règles métier de l'API (PIN > 50 000 FCFA, plafonds,
 * rétractation 48 h, scoring…) pour que l'application soit utilisable sans serveur.
 */
import {
  PAYMENT_REQUEST_TTL_HOURS,
  operatorMatchesPhone,
  type MobileMoneyOperator,
  type PaymentRequestDTO,
  ADVISOR_OPEN_TOPICS,
  DATA_RETENTION_POLICY,
  MIN_AGE,
  RETENTION_YEARS_AFTER_CLOSURE,
  TEST_PHASE,
  VAULT_OPTIONS,
  ageOn,
  formatFCFA,
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
  TRUSTY,
  escrowActions,
  type EscrowActor,
  type EscrowDTO,
  type EscrowStatus,
} from '@dala/shared';
import { ApiError } from '../errors';
import { DEMO_OTP, DEMO_PIN, bonds, db, funds, projects, type MockConversation, type MockEscrow } from './db';

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
  TRANSFER: ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER_IN', 'TRANSFER_OUT', 'ESCROW_HOLD', 'ESCROW_RELEASE', 'ESCROW_REFUND', 'FEE'],
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
    if (body.consent?.version !== TEST_PHASE.consentVersion || body.consent?.accepted !== true) throw new ApiError(400, "Acceptation de l'avertissement requise", 'VALIDATION');
    const age = ageOn(body.dateOfBirth ?? '');
    if (Number.isNaN(age)) throw new ApiError(400, 'Date de naissance invalide', 'INVALID_BIRTH_DATE');
    if (age < MIN_AGE) throw new ApiError(403, `L'ouverture d'un compte est réservée aux personnes de ${MIN_AGE} ans ou plus.`, 'UNDERAGE');
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
  ['POST', /^\/users\/me\/kyc$/, ({ body }) => {
    if (body.targetLevel > TEST_PHASE.limits.maxKycLevel) throw new ApiError(403, `Le niveau KYC ${body.targetLevel} n'est pas ouvert pendant la phase de test`, 'TEST_LIMIT_REACHED');
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
    const total = b.MAIN + b.SAVINGS + b.VAULT + b.INVESTMENT + b.CROWDFUND + b.ESCROW;
    const outstanding = db.loans.filter((l) => l.status === 'DISBURSED' || l.status === 'OVERDUE').reduce((s, l) => s + l.totalDue - l.amountPaid, 0);
    const summary: BalanceSummary = {
      total,
      main: b.MAIN,
      savings: b.SAVINGS,
      savingsTarget: db.goals.reduce((s, g) => s + g.targetAmount, 0),
      vault: b.VAULT,
      investments: b.INVESTMENT,
      crowdfund: b.CROWDFUND,
      escrow: b.ESCROW,
      crowdfundActiveProjects: new Set(db.holdings.filter((h) => h.status !== 'CLOTURE').map((h) => h.projectId)).size,
      creditOutstanding: outstanding,
      creditEligible: hasOpenLoan() ? 0 : eligibleLoanAmount(db.user.creditScore),
      monthDelta: 12_500,
      monthDeltaPct: 0.053,
    };
    return summary;
  }],
  ['POST', /^\/accounts\/deposit$/, ({ body }) => {
    requireProvider(body.provider);
    requireOperator(body.provider, body.phone ?? db.user.phone);
    post('DEPOSIT', body.amount, `Dépôt ${providerName(body.provider)}`, null, 'MAIN');
    notify('Dépôt reçu', `${body.amount} FCFA via ${providerName(body.provider)}`, 'TRANSACTION');
    return { status: 'SUCCESS' };
  }],
  ['POST', /^\/accounts\/withdraw$/, ({ body, headers }) => {
    requireProvider(body.provider);
    requireOperator(body.provider, body.phone ?? db.user.phone);
    requirePin(headers, body.amount);
    post('WITHDRAWAL', body.amount, `Retrait ${providerName(body.provider)}`, 'MAIN', null);
    return { status: 'SUCCESS' };
  }],
  ['POST', /^\/accounts\/send-mobile-money$/, ({ body, headers }) => {
    if (db.user.kycLevel < 2) throw new ApiError(403, 'KYC de niveau 2 requis', 'KYC_LEVEL');
    requireProvider(body.provider);
    requireOperator(body.provider, body.phone);
    requirePin(headers, body.amount);
    const name = providerName(body.provider);
    post('TRANSFER_OUT', body.amount, `Envoi ${name} · ${body.phone.slice(0, 7)}…${body.phone.slice(-2)}`, 'MAIN', null);
    notify('Envoi effectué', `${body.amount} FCFA envoyés vers ${name}`, 'TRANSACTION');
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
    if (body.maxMembers > TEST_PHASE.limits.maxTontineMembers) throw new ApiError(400, `${TEST_PHASE.limits.maxTontineMembers} membres au maximum pendant la phase de test`, 'VALIDATION');
    const t = {
      id: id('t'), ...body, currentCycle: 1, totalCycles: body.maxMembers, status: 'PENDING', myPosition: 1,
      nextContributionDate: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      members: [{ id: id('m'), userId: db.user.id, name: `${db.user.firstName} ${db.user.lastName[0]}.`, position: 1, hasPaid: false, hasReceived: false }],
    };
    db.tontines.push(t);
    return t;
  }],
  ['GET', /^\/savings\/vaults$/, () => ({ options: VAULT_OPTIONS, vaults: db.vaults })],
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
    if (!(ADVISOR_OPEN_TOPICS as readonly string[]).includes(body.topic)) throw new ApiError(400, 'Sujet non disponible pendant la phase de test', 'VALIDATION');
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

  /* -------------------------- Demandes de paiement -------------------------- */
  ['GET', /^\/payment-requests$/, () => db.paymentRequests.map(requestView)],
  ['POST', /^\/payment-requests$/, ({ body }) => {
    const code = Math.random().toString(36).slice(2, 10).toUpperCase().padEnd(8, 'X');
    const r: PaymentRequestDTO = {
      id: id('pr'), code, amount: body.amount, note: body.note ?? null, status: 'OPEN',
      expiresAt: new Date(Date.now() + PAYMENT_REQUEST_TTL_HOURS * 3_600_000).toISOString(), paidAt: null,
      // Adresse réservée (.invalid) : en démo, aucun serveur ne sert la page de paiement.
      url: `https://demo.dala.invalid/pay/${code}`, createdAt: new Date().toISOString(),
    };
    db.paymentRequests.unshift(r);
    return r;
  }],
  ['POST', /^\/payment-requests\/([^/]+)\/cancel$/, ({ params }) => {
    const r = db.paymentRequests.find((x) => x.id === params[0]);
    if (!r || r.status !== 'OPEN') throw new ApiError(409, 'Cette demande ne peut plus être annulée', 'CONFLICT');
    r.status = 'CANCELLED';
    return undefined;
  }],
  ['GET', /^\/pay\/([^/]+)$/, ({ params }) => {
    const r = [...db.paymentRequests, ...db.otherRequests].find((x) => x.code === params[0]);
    if (!r) throw new ApiError(404, 'Demande de paiement introuvable');
    return { ...requestView(r), beneficiary: db.otherRequests.includes(r) ? 'Maquis Chez Tantie' : `${db.user.firstName} ${db.user.lastName[0]}.` };
  }],
  ['POST', /^\/payment-requests\/by-code\/([^/]+)\/pay$/, ({ params, body, headers }) => {
    if (db.user.kycLevel < 2) throw new ApiError(403, 'KYC de niveau 2 requis', 'KYC_LEVEL');
    const r = db.otherRequests.find((x) => x.code === params[0]);
    if (!r) throw new ApiError(400, 'Vous ne pouvez pas payer votre propre demande', 'VALIDATION');
    if (body.amount !== r.amount) throw new ApiError(400, 'Le montant ne correspond pas à la demande', 'AMOUNT_MISMATCH');
    requirePin(headers, r.amount);
    if (requestView(r).status !== 'OPEN') throw new ApiError(409, 'Cette demande n’est plus active', 'REQUEST_CLOSED');
    post('TRANSFER_OUT', r.amount, `Paiement à Maquis Chez Tantie${r.note ? ` · ${r.note}` : ''}`, 'MAIN', null);
    r.status = 'PAID';
    r.paidAt = new Date().toISOString();
    notify('Paiement effectué', `${r.amount} FCFA payés à Maquis Chez Tantie`, 'TRANSACTION');
    return { status: 'PAID' };
  }],
  ['POST', /^\/pay\/([^/]+)$/, ({ params, body }) => {
    const r = db.paymentRequests.find((x) => x.code === params[0]);
    if (!r) throw new ApiError(404, 'Demande de paiement introuvable');
    if (requestView(r).status !== 'OPEN') throw new ApiError(409, 'Cette demande n’est plus active', 'REQUEST_CLOSED');
    requireProvider(body.provider);
    requireOperator(body.provider, body.phone);
    r.status = 'PAID';
    r.paidAt = new Date().toISOString();
    post('TRANSFER_IN', r.amount, `Paiement reçu · ${providerName(body.provider)}${r.note ? ` · ${r.note}` : ''}`, null, 'MAIN');
    notify('Paiement reçu 💸', `${r.amount} FCFA reçus via ${providerName(body.provider)}`, 'TRANSACTION');
    return { status: 'PAID' };
  }],

  /* ------------------------- Droits des utilisateurs ------------------------- */
  ['GET', /^\/users\/me\/data\/retention$/, () => ({ policy: DATA_RETENTION_POLICY, yearsAfterClosure: RETENTION_YEARS_AFTER_CLOSURE })],
  ['GET', /^\/users\/me\/data\/export$/, () => ({
    exportedAt: new Date().toISOString(),
    retention: DATA_RETENTION_POLICY,
    user: db.user,
    balances: db.balances,
    transactions: db.transactions,
    savings: db.goals,
    vaults: db.vaults,
    tontines: db.tontines,
    loans: db.loans,
    notifications: db.notifications,
    conversations: db.advisor,
  })],
  ['POST', /^\/users\/me\/close$/, ({ headers }) => {
    requirePin(headers, 0, true);
    const total = Object.values(db.balances).reduce((a, b) => a + b, 0);
    if (total > 0) throw new ApiError(409, 'Retirez d’abord le solde de tous vos comptes (épargne et coffre-fort compris).', 'BALANCE_NOT_EMPTY');
    if (hasOpenLoan()) throw new ApiError(409, 'Remboursez votre prêt en cours avant de clôturer le compte.', 'LOAN_OPEN');
    return { status: 'CLOSED', retentionYears: RETENTION_YEARS_AFTER_CLOSURE };
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
    case 'PAYMENTS':
      return 'Vous pouvez déposer et retirer avec Orange Money, MTN MoMo et Moov Money. Au-delà de 50 000 FCFA, votre code PIN vous est demandé. Avez-vous rencontré un souci sur une opération ?';
    case 'SAVINGS':
      return "Pour démarrer, un objectif avec épargne automatique hebdomadaire fonctionne très bien. Le coffre-fort bloque votre épargne pour la durée choisie ; il n'est pas rémunéré pendant la phase de test.";
    case 'CREDIT':
      return `Pendant la phase de test, un prêt est limité à ${formatFCFA(TEST_PHASE.limits.loanMax)}. Votre montant éligible dépend de votre score DALA, qui progresse avec une épargne régulière et des remboursements à l’heure. Souhaitez-vous que je regarde votre dossier ?`;
    default:
      return 'Merci pour votre message. Pouvez-vous me donner quelques précisions pour que je vous oriente au mieux ?';
  }
}

/** Numéros ivoiriens : le préfixe doit correspondre à l'opérateur (07 Orange, 05 MTN, 01 Moov). */
function requireOperator(provider: MobileMoneyOperator, phone: string) {
  if (phone?.startsWith('+225') && !operatorMatchesPhone(provider, phone)) {
    throw new ApiError(400, `Ce numéro n'est pas un numéro ${providerName(provider)}.`, 'OPERATOR_MISMATCH');
  }
}

function requestView(r: PaymentRequestDTO): PaymentRequestDTO {
  return r.status === 'OPEN' && r.expiresAt < new Date().toISOString() ? { ...r, status: 'EXPIRED' } : r;
}

function requireProvider(provider: string) {
  if (TEST_PHASE.disabledProviders.includes(provider)) throw new ApiError(400, 'Opérateur non disponible pendant la phase de test', 'VALIDATION');
}

/** Modules fermés pendant la phase de test : mêmes réponses que l'API. */
const CLOSED_PREFIXES = [
  ...(TEST_PHASE.modules.invest ? [] : ['/investments']),
  ...(TEST_PHASE.modules.crowdfund ? [] : ['/crowdfund']),
];

function providerName(p: string) {
  return { ORANGE_MONEY: 'Orange Money', MTN_MOMO: 'MTN MoMo', WAVE: 'Wave', MOOV_MONEY: 'Moov Money' }[p] ?? p;
}

/* --------------------------------- Trusty --------------------------------- */

/** Réactions simulées de l'autre participant (acceptation, livraison, confirmation). */
export const trustyDemo = { delayMs: 3_000 };
const HOUR = 3_600_000;

function escrowView(e: MockEscrow): EscrowDTO {
  const { code6, codeAttempts, ...rest } = e;
  const state = { status: e.status, initiator: e.initiator, deliveryDeadline: e.deliveryDeadline, inspectionEndsAt: e.inspectionEndsAt, codeAttempts };
  return {
    ...rest,
    releaseCode: e.role === 'BUYER' && (e.status === 'FUNDED' || e.status === 'DELIVERED') ? code6 : null,
    codeAttemptsLeft: Math.max(0, TRUSTY.maxCodeAttempts - codeAttempts),
    actions: escrowActions(state, e.role),
  };
}

function findEscrow(escrowId: string) {
  const e = db.escrows.find((x) => x.id === escrowId);
  if (!e) throw new ApiError(404, 'Transaction Trusty introuvable', 'NOT_FOUND');
  return e;
}

function escrowEvent(e: MockEscrow, actor: EscrowActor, type: string, message: string) {
  e.events.push({ id: id('ev'), actor, type, message, createdAt: new Date().toISOString() });
}

function allowEscrow(e: MockEscrow, action: ReturnType<typeof escrowActions>[number]) {
  if (!escrowView(e).actions.includes(action)) throw new ApiError(409, 'Action impossible à cette étape de la transaction', 'ESCROW_STATE');
}

/** Dénouement vu par Awa : acheteuse (fonds bloqués chez elle) ou vendeuse (paiement reçu). */
function settleEscrow(e: MockEscrow, status: EscrowStatus, actor: EscrowActor, message: string) {
  const toSeller = status === 'RELEASED';
  if (e.role === 'BUYER') {
    if (toSeller) db.balances.ESCROW -= e.amount;
    else post('ESCROW_REFUND', e.amount, `Remboursement Trusty · ${e.title}`, 'ESCROW', 'MAIN');
  } else if (toSeller) {
    post('ESCROW_RELEASE', e.amount, `Trusty · ${e.title}`, null, 'MAIN');
  }
  e.status = status;
  e.closedAt = new Date().toISOString();
  escrowEvent(e, actor, status, message);
  notify(toSeller ? (e.role === 'SELLER' ? 'Paiement Trusty reçu 💸' : 'Transaction Trusty terminée') : 'Remboursement Trusty', `« ${e.title} » : ${formatFCFA(e.amount)} ${toSeller ? 'versés au vendeur' : "rendus à l'acheteur"}.`, 'TRANSACTION');
}

function later(e: MockEscrow, from: EscrowStatus, run: () => void) {
  setTimeout(() => {
    if (e.status === from) run();
  }, trustyDemo.delayMs);
}

function fundEscrow(e: MockEscrow, actor: EscrowActor) {
  e.status = 'FUNDED';
  e.fundedAt = new Date().toISOString();
  e.deliveryDeadline = new Date(Date.now() + e.deliveryDays * 24 * HOUR).toISOString();
  escrowEvent(e, actor, 'FUNDED', `${formatFCFA(e.amount)} bloqués chez DALA. Le vendeur peut livrer en toute confiance.`);
}

const trustyRoutes: [string, RegExp, Handler][] = [
  ['GET', /^\/trusty$/, () => db.escrows.map(escrowView)],
  ['GET', /^\/trusty\/([^/]+)$/, ({ params }) => escrowView(findEscrow(params[0]))],
  ['POST', /^\/trusty$/, ({ body }) => {
    if (db.user.kycLevel < 2) throw new ApiError(403, 'KYC de niveau 2 requis', 'KYC_LEVEL', { requiredLevel: 2 });
    if (body.amount < TRUSTY.minAmount || body.amount > TRUSTY.maxAmount) throw new ApiError(400, `Montant entre ${formatFCFA(TRUSTY.minAmount)} et ${formatFCFA(TRUSTY.maxAmount)} pendant la phase de test`, 'VALIDATION');
    if (body.counterpartyPhone === db.user.phone) throw new ApiError(400, 'Vous ne pouvez pas traiter avec vous-même', 'VALIDATION');
    const now = new Date().toISOString();
    const e: MockEscrow = {
      id: id('esc'), code: `T${seq}DEMO`, title: body.title, description: body.description || null, amount: body.amount,
      role: body.role, initiator: body.role, status: 'PROPOSED',
      counterparty: { name: body.role === 'BUYER' ? 'Koffi B.' : 'Aïcha T.', phone: body.counterpartyPhone, completedDeals: 7 },
      deliveryDays: body.deliveryDays, inspectionHours: body.inspectionHours, deliveryDeadline: null, inspectionEndsAt: null,
      fundedAt: null, deliveredAt: null, closedAt: null, deliveryNote: null, resolution: null, createdAt: now, code6: '135790', codeAttempts: 0, events: [],
    };
    escrowEvent(e, body.role, 'PROPOSED', `${db.user.firstName} propose la transaction : ${formatFCFA(body.amount)}, livraison sous ${body.deliveryDays} j, vérification ${body.inspectionHours} h.`);
    db.escrows.unshift(e);
    // Démo : l'autre participant accepte (et, s'il achète, bloque aussitôt les fonds).
    later(e, 'PROPOSED', () => {
      e.status = 'ACCEPTED';
      escrowEvent(e, body.role === 'BUYER' ? 'SELLER' : 'BUYER', 'ACCEPTED', `${body.role === 'BUYER' ? 'Le vendeur' : 'L’acheteur'} accepte les conditions.`);
      if (body.role === 'SELLER') fundEscrow(e, 'BUYER');
      notify('Transaction Trusty acceptée', `« ${e.title} » : ${body.role === 'BUYER' ? 'bloquez les fonds pour lancer la livraison.' : 'les fonds sont bloqués, vous pouvez livrer.'}`, 'TRANSACTION');
    });
    return escrowView(e);
  }],
  ['POST', /^\/trusty\/([^/]+)\/accept$/, ({ params }) => {
    const e = findEscrow(params[0]);
    allowEscrow(e, 'accept');
    e.status = 'ACCEPTED';
    escrowEvent(e, e.role, 'ACCEPTED', `${e.role === 'BUYER' ? 'L’acheteur' : 'Le vendeur'} accepte les conditions.`);
    return escrowView(e);
  }],
  ['POST', /^\/trusty\/([^/]+)\/cancel$/, ({ params }) => {
    const e = findEscrow(params[0]);
    allowEscrow(e, 'cancel');
    e.status = 'CANCELLED';
    e.closedAt = new Date().toISOString();
    escrowEvent(e, e.role, 'CANCELLED', `${e.role === 'BUYER' ? 'L’acheteur' : 'Le vendeur'} annule la transaction (aucun fonds bloqué).`);
    return escrowView(e);
  }],
  ['POST', /^\/trusty\/([^/]+)\/fund$/, ({ params, body, headers }) => {
    const e = findEscrow(params[0]);
    allowEscrow(e, 'fund');
    if (body.amount !== e.amount) throw new ApiError(400, 'Le montant ne correspond pas à la transaction', 'AMOUNT_MISMATCH');
    requirePin(headers, e.amount);
    post('ESCROW_HOLD', e.amount, `Fonds bloqués Trusty · ${e.title}`, 'MAIN', 'ESCROW');
    fundEscrow(e, 'BUYER');
    // Démo : le vendeur expédie et déclare la livraison.
    later(e, 'FUNDED', () => {
      e.status = 'DELIVERED';
      e.deliveredAt = new Date().toISOString();
      e.deliveryNote = 'Colis remis au livreur, arrivée prévue aujourd’hui.';
      e.inspectionEndsAt = new Date(Date.now() + e.inspectionHours * HOUR).toISOString();
      escrowEvent(e, 'SELLER', 'DELIVERED', `Le vendeur déclare la livraison : ${e.deliveryNote} L'acheteur a ${e.inspectionHours} h pour vérifier.`);
      notify('Livraison déclarée 📦', `« ${e.title} » : vérifiez puis confirmez la réception.`, 'TRANSACTION');
    });
    return escrowView(e);
  }],
  ['POST', /^\/trusty\/([^/]+)\/deliver$/, ({ params, body }) => {
    const e = findEscrow(params[0]);
    allowEscrow(e, 'deliver');
    e.status = 'DELIVERED';
    e.deliveredAt = new Date().toISOString();
    e.deliveryNote = body.note || null;
    e.inspectionEndsAt = new Date(Date.now() + e.inspectionHours * HOUR).toISOString();
    escrowEvent(e, 'SELLER', 'DELIVERED', `Le vendeur déclare la livraison${body.note ? ` : ${body.note}` : '.'} L'acheteur a ${e.inspectionHours} h pour vérifier.`);
    // Démo : l'acheteur vérifie et confirme.
    later(e, 'DELIVERED', () => settleEscrow(e, 'RELEASED', 'BUYER', "L'acheteur confirme la réception : fonds versés au vendeur."));
    return escrowView(e);
  }],
  ['POST', /^\/trusty\/([^/]+)\/redeem$/, ({ params, body }) => {
    const e = findEscrow(params[0]);
    allowEscrow(e, 'redeem');
    if (body.code !== e.code6) {
      e.codeAttempts++;
      const left = Math.max(0, TRUSTY.maxCodeAttempts - e.codeAttempts);
      throw new ApiError(400, left ? `Code incorrect. ${left} essai${left > 1 ? 's' : ''} restant${left > 1 ? 's' : ''}.` : 'Code incorrect. La saisie est bloquée.', 'INVALID_CODE', { attemptsLeft: left });
    }
    settleEscrow(e, 'RELEASED', 'SELLER', 'Code de remise validé à la livraison : fonds versés au vendeur.');
    return escrowView(e);
  }],
  ['POST', /^\/trusty\/([^/]+)\/release$/, ({ params, headers }) => {
    const e = findEscrow(params[0]);
    allowEscrow(e, 'release');
    requirePin(headers, 0, true);
    settleEscrow(e, 'RELEASED', 'BUYER', "L'acheteur confirme la réception : fonds versés au vendeur.");
    return escrowView(e);
  }],
  ['POST', /^\/trusty\/([^/]+)\/dispute$/, ({ params, body }) => {
    const e = findEscrow(params[0]);
    allowEscrow(e, 'dispute');
    if (!body.reason || body.reason.trim().length < 10) throw new ApiError(400, 'Décrivez le problème en quelques mots (10 caractères minimum).', 'VALIDATION');
    e.status = 'DISPUTED';
    escrowEvent(e, 'BUYER', 'DISPUTED', `Litige ouvert par l'acheteur : ${body.reason.trim()}`);
    escrowEvent(e, 'SYSTEM', 'MEDIATION', 'Les fonds restent bloqués. Un médiateur DALA examine les échanges et vous répond ici sous 48 h ouvrées. Ajoutez vos explications et preuves (numéro de suivi, description…).');
    later(e, 'DISPUTED', () => escrowEvent(e, 'MEDIATOR', 'MESSAGE', 'Mariam (médiation DALA) : bonjour, nous avons bien reçu votre signalement. Pouvez-vous décrire ce qui ne correspond pas à la commande ?'));
    return escrowView(e);
  }],
  ['POST', /^\/trusty\/([^/]+)\/refund$/, ({ params }) => {
    const e = findEscrow(params[0]);
    allowEscrow(e, 'refund');
    settleEscrow(e, 'REFUNDED', 'SELLER', "Le vendeur rembourse l'acheteur.");
    return escrowView(e);
  }],
  ['POST', /^\/trusty\/([^/]+)\/reclaim$/, ({ params }) => {
    const e = findEscrow(params[0]);
    allowEscrow(e, 'reclaim');
    settleEscrow(e, 'REFUNDED', 'BUYER', "Délai de livraison dépassé : l'acheteur récupère ses fonds.");
    return escrowView(e);
  }],
  ['POST', /^\/trusty\/([^/]+)\/messages$/, ({ params, body }) => {
    const e = findEscrow(params[0]);
    allowEscrow(e, 'message');
    escrowEvent(e, e.role, 'MESSAGE', String(body.message ?? '').trim());
    return escrowView(e);
  }],
];

export async function mockRequest<T>(method: string, fullPath: string, body: unknown, headers: Record<string, string>): Promise<T> {
  await sleep(250);
  const [path, qs = ''] = fullPath.split('?');
  if (CLOSED_PREFIXES.some((p) => path.startsWith(p))) throw new ApiError(404, 'Service non disponible pendant la phase de test', 'MODULE_DISABLED');
  for (const [m, re, handler] of [...routes, ...trustyRoutes]) {
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

