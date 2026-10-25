/* Données de démonstration — `npm run db:seed` (compte : +2250707000000, PIN 1234). */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { CROWDFUND_VALIDATOR, TEST_PHASE, addMonths } from '@dala/shared';

const prisma = new PrismaClient();
const day = 86_400_000;
const ago = (d: number) => new Date(Date.now() - d * day);
const inDays = (d: number) => new Date(Date.now() + d * day);

async function main() {
  const pin = await bcrypt.hash('1234', 10);
  const mkUser = (phone: string, firstName: string, lastName: string, creditScore = 50, kycLevel = 1) =>
    prisma.user.upsert({
      where: { phone },
      update: {},
      create: {
        phone, firstName, lastName, pin, creditScore, kycLevel, createdAt: ago(240),
        dateOfBirth: new Date('1992-04-18T00:00:00Z'), consentVersion: TEST_PHASE.consentVersion, consentAcceptedAt: ago(240),
      },
    });

  const awa = await mkUser('+2250707000000', 'Awa', 'Koné', 72, 2);
  const others = await Promise.all([
    mkUser('+2250707000001', 'Moussa', 'Traoré'),
    mkUser('+2250707000002', 'Fatou', 'Diallo'),
    mkUser('+2250707000003', 'Yao', 'Kouassi'),
    mkUser('+2250707000004', 'Aminata', 'Coulibaly'),
    mkUser('+2250707000005', 'Ibrahim', 'Ouédraogo'),
  ]);
  const bip = await mkUser('+2250707009999', 'Comité', 'Bridge IP');

  for (const u of [awa, ...others, bip]) {
    const balances = u.id === awa.id ? { MAIN: 247_500, SAVINGS: 850_000, VAULT: 100_000, INVESTMENT: 125_000, CROWDFUND: 75_000 } : { MAIN: 50_000, SAVINGS: 0, VAULT: 0, INVESTMENT: 0, CROWDFUND: 0 };
    for (const [type, balance] of Object.entries(balances)) {
      const existing = await prisma.account.findFirst({ where: { userId: u.id, type: type as never } });
      if (!existing) await prisma.account.create({ data: { userId: u.id, type: type as never, balance } });
    }
  }

  if ((await prisma.savingsGoal.count({ where: { userId: awa.id } })) === 0) {
    await prisma.savingsGoal.createMany({
      data: [
        { userId: awa.id, name: 'Mariage', targetAmount: 750_000, currentAmount: 520_000, deadline: inDays(180), autoSave: true, frequency: 'WEEKLY', autoAmount: 15_000, icon: 'heart' },
        { userId: awa.id, name: 'Études de Kadi', targetAmount: 400_000, currentAmount: 210_000, deadline: inDays(300), autoSave: true, frequency: 'MONTHLY', autoAmount: 25_000, icon: 'graduation' },
        { userId: awa.id, name: 'Commerce de pagnes', targetAmount: 150_000, currentAmount: 120_000, icon: 'storefront' },
      ],
    });
  }

  if ((await prisma.tontineMember.count({ where: { userId: awa.id } })) === 0) {
    const members = [others[0], awa, others[1], others[2], others[3]];
    await prisma.tontine.create({
      data: {
        name: 'Tontine des Commerçantes de Treichville',
        amount: 20_000,
        frequency: 'WEEKLY',
        maxMembers: 5,
        totalCycles: 5,
        currentCycle: 2,
        status: 'ACTIVE',
        createdAt: ago(8),
        members: { create: members.map((m, i) => ({ userId: m.id, position: i + 1, hasReceived: i === 0, hasPaid: i === 0 || i === 2 })) },
      },
    });
  }

  if ((await prisma.vault.count({ where: { userId: awa.id } })) === 0) {
    const created = ago(45);
    await prisma.vault.create({ data: { userId: awa.id, amount: 100_000, rate: 0.045, months: 6, createdAt: created, unlockDate: addMonths(created, 6) } });
  }

  if ((await prisma.investment.count({ where: { userId: awa.id } })) === 0) {
    await prisma.investment.createMany({
      data: [
        { userId: awa.id, type: 'TREASURY_BOND', instrumentId: 'bt-ci-364', amount: 100_000, rate: 0.06, maturityDate: inDays(300), createdAt: ago(64) },
        { userId: awa.id, type: 'SUKUK', instrumentId: 'sk-ci-364', amount: 25_000, rate: 0.0585, maturityDate: inDays(330), isHalal: true, createdAt: ago(34) },
      ],
    });
  }

  if ((await prisma.project.count()) === 0) {
    const team = (a: string, b: string) => [
      { name: a, role: 'Fondatrice & CEO' },
      { name: b, role: 'Directeur des opérations' },
    ];
    const docs = [
      { name: 'Business plan', url: 'https://example.com/bp.pdf', kind: 'BUSINESS_PLAN' },
      { name: `Rapport de validation ${CROWDFUND_VALIDATOR}`, url: 'https://example.com/validation.pdf', kind: 'VALIDATION' },
      { name: 'Projections financières 5 ans', url: 'https://example.com/proj.pdf', kind: 'PROJECTIONS' },
    ];
    const projects = [
      { name: 'AgriTech CI', sector: 'AGRITECH', description: 'Coopérative de cacao bio certifiée qui équipe 1 200 producteurs de Soubré en capteurs et en traçabilité. La plateforme connecte directement les planteurs aux chocolatiers européens.', problem: "Les planteurs perçoivent moins de 10 % de la valeur finale et la traçabilité exigée par les nouvelles réglementations à l'export est inexistante.", solution: 'Traçabilité par parcelle, prime bio négociée collectivement, préfinancement des intrants.', targetMarket: 'Producteurs de cacao de Côte d\'Ivoire', fundingGoal: 50_000_000, fundingRaised: 39_000_000, valuation: 250_000_000, equityMin: 0.15, equityMax: 0.25, deadline: inDays(18), image: 'https://images.unsplash.com/photo-1606312619070-d48b4c652a52?w=1200' },
      { name: 'SolarKit Sahel', sector: 'SOLARTECH', description: 'Kits solaires en paiement à l\'usage pour les boutiques rurales. Paiement par mobile money, maintenance assurée par des techniciennes formées localement.', problem: '60 % des commerces ruraux n\'ont pas d\'électricité fiable après 18 h.', solution: 'Kits 200 W financés par micro-paiements journaliers via mobile money.', targetMarket: 'Commerces ruraux UEMOA', fundingGoal: 30_000_000, fundingRaised: 12_600_000, valuation: 150_000_000, equityMin: 0.1, equityMax: 0.2, deadline: inDays(32), image: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=1200' },
      { name: 'Garba Express', sector: 'FOODTECH', description: 'Réseau de cuisines centrales qui livre 4 000 repas par jour aux bureaux du Plateau et de Cocody. Commande WhatsApp et paiement mobile.', problem: 'Les salariés manquent d\'options de repas abordables, hygiéniques et rapides.', solution: 'Cuisines centrales certifiées et livraison à moto en moins de 30 minutes.', targetMarket: 'Salariés d\'Abidjan', fundingGoal: 20_000_000, fundingRaised: 17_800_000, valuation: 100_000_000, equityMin: 0.12, equityMax: 0.2, deadline: inDays(6), image: 'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=1200' },
      { name: 'SantéPlus Pharma', sector: 'HEALTHTECH', description: 'Plateforme de télé-pharmacie qui vérifie l\'authenticité des médicaments et livre les officines partenaires de Bouaké à Korhogo.', problem: 'Les médicaments contrefaits représentent une part importante du marché informel.', solution: 'Chaîne d\'approvisionnement vérifiée par QR code et livraison aux officines.', targetMarket: 'Pharmacies du centre et du nord', fundingGoal: 75_000_000, fundingRaised: 21_000_000, valuation: 400_000_000, equityMin: 0.1, equityMax: 0.2, deadline: inDays(45), image: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=1200' },
      { name: 'École Numérique 225', sector: 'EDUTECH', description: 'Cours de soutien scolaire en audio et par SMS, accessibles sur téléphone basique. Contenus alignés sur les programmes officiels.', problem: 'Plus d\'un élève sur deux n\'a ni smartphone ni connexion stable.', solution: 'Leçons audio via serveur vocal interactif et quiz par SMS.', targetMarket: 'Élèves du primaire et du collège', fundingGoal: 15_000_000, fundingRaised: 4_500_000, valuation: 75_000_000, equityMin: 0.1, equityMax: 0.2, deadline: inDays(60), image: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=1200' },
    ] as const;
    for (const p of projects) {
      await prisma.project.create({
        data: {
          submittedBy: bip.id,
          name: p.name,
          sector: p.sector,
          description: p.description,
          problem: p.problem,
          solution: p.solution,
          targetMarket: p.targetMarket,
          fundingGoal: p.fundingGoal,
          fundingRaised: p.fundingRaised,
          equityOffered: p.fundingGoal / p.valuation,
          equityMin: p.equityMin,
          equityMax: p.equityMax,
          valuation: p.valuation,
          deadline: p.deadline,
          status: 'ACTIVE',
          validatedBy: CROWDFUND_VALIDATOR,
          imageUrl: p.image,
          galleryUrls: [p.image],
          documents: docs,
          teamMembers: team('Mariam Bamba', 'Jean-Marc Aka'),
        },
      });
    }
    const [agri, solar] = await prisma.project.findMany({ orderBy: { createdAt: 'asc' }, take: 2 });
    await prisma.crowdfundInvestment.createMany({
      data: [
        { userId: awa.id, projectId: agri.id, amount: 50_000, equityPct: 50_000 / 250_000_000, status: 'CONFIRMED', createdAt: ago(20) },
        { userId: awa.id, projectId: solar.id, amount: 25_000, equityPct: 25_000 / 150_000_000, status: 'CONFIRMED', createdAt: ago(4) },
      ],
    });
  }

  if ((await prisma.loan.count({ where: { userId: awa.id } })) === 0) {
    await prisma.loan.create({
      data: { userId: awa.id, amount: 50_000, interestRate: 0.14, fees: 500, totalDue: 51_075, duration: 30, dueDate: ago(60), amountPaid: 51_075, status: 'REPAID', disbursedAt: ago(90), createdAt: ago(90) },
    });
  }

  if ((await prisma.transaction.count({ where: { userId: awa.id } })) === 0) {
    const tx = (hoursAgo: number, type: string, amount: number, description: string) => ({
      userId: awa.id, type: type as never, amount, description, reference: `DLA-SEED-${Math.abs(hoursAgo)}`, createdAt: new Date(Date.now() - hoursAgo * 3_600_000),
    });
    await prisma.transaction.createMany({
      data: [
        tx(2, 'SAVINGS_IN', -15_000, 'Épargne auto · Mariage'),
        tx(26, 'INVESTMENT_RETURN', 3_125, 'Coupon Bon du Trésor CI'),
        tx(96, 'CROWDFUND_IN', -25_000, 'Crowdfund · SolarKit Sahel'),
        tx(120, 'DEPOSIT', 100_000, 'Dépôt Orange Money'),
        tx(170, 'TRANSFER_IN', 12_500, 'Reçu de Moussa T.'),
        tx(200, 'SAVINGS_IN', -20_000, 'Cotisation tontine · Treichville'),
        tx(480, 'CROWDFUND_IN', -50_000, 'Crowdfund · AgriTech CI'),
        tx(820, 'INVESTMENT_BUY', -25_000, 'Sukuk CI 364 j'),
      ],
    });
  }

  await prisma.notification.createMany({
    data: [
      { userId: awa.id, title: 'Bienvenue sur DALA 👋', body: 'Faire grandir vos ambitions.', type: 'SYSTEM' },
      { userId: awa.id, title: 'Coupon reçu', body: '3 125 FCFA de votre Bon du Trésor CI.', type: 'INVEST' },
    ],
  });
  console.log('Seed terminé : +2250707000000 / PIN 1234');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
