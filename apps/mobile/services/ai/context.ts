import {
  ADVISOR_HOURS,
  CROWDFUND_VALIDATOR,
  PROJECT_SECTORS,
  formatFCFA,
  type BalanceSummary,
  type BondDTO,
  type CrowdfundHoldingDTO,
  type FundDTO,
  type PortfolioDTO,
  type ProjectDTO,
} from '@dala/shared';

/** Consignes permanentes de l'assistant (identiques à chaque requête). */
export const SYSTEM_PROMPT = `Tu es l'assistant IA de DALA Finance, application d'épargne, d'investissement, de micro-crédit et de crowdfunding en capital en Côte d'Ivoire (zone UEMOA). L'utilisateur t'a connecté avec sa propre clé d'API.

Ton rôle :
- Analyser le marché financier de l'UEMOA : titres publics (bons et obligations du Trésor émis via UMOA-Titres), BRVM, FCP, Sukuk et placements conformes à la finance islamique, contexte économique et monétaire (BCEAO).
- Discuter avec l'utilisateur des opportunités d'investissement disponibles sur DALA (titres et projets de crowdfunding) à partir des données fournies plus bas, en expliquant rendement, durée, risques, liquidité et diversification.
- Répondre aussi à toute autre question de l'utilisateur, sur n'importe quel sujet.

Règles :
- Réponds en français, sauf si l'utilisateur écrit dans une autre langue. Sois clair, structuré et concis ; adapte le niveau à l'utilisateur.
- Exprime toujours les montants en FCFA (XOF), jamais en euros ni en dollars, sauf demande explicite de conversion.
- Le crowdfunding sur DALA est uniquement du financement en capital (equity) : l'investisseur devient actionnaire. Il n'y a ni prêt participatif ni don. Chaque projet publié est validé par ${CROWDFUND_VALIDATOR}.
- Tu fournis de l'information et de l'analyse générales, pas un conseil en investissement personnalisé. Rappelle les risques (perte en capital, liquidité limitée des parts de PME) quand tu évoques un placement, sans le répéter à chaque phrase. Pour une recommandation adaptée, propose de contacter l'équipe commerciale DALA depuis l'application (${ADVISOR_HOURS}).
- Tu ne peux exécuter aucune opération : l'utilisateur investit lui-même depuis l'application, avec confirmation par PIN.
- Tu n'as accès à aucune information interne ou confidentielle de DALA Finance (stratégie, levées de fonds, données financières de l'entreprise). Si on te les demande, dis que tu ne peux pas les communiquer.
- Les données ci-dessous proviennent de l'application à la date indiquée. N'invente jamais de taux, de cours ou de projet : si une information manque, dis-le. Distingue clairement les données DALA de tes connaissances générales.`;

export interface MarketSnapshot {
  bonds: BondDTO[];
  funds: FundDTO[];
  projects: ProjectDTO[];
  summary?: BalanceSummary;
  portfolio?: PortfolioDTO;
  crowdfund?: { totalInvested: number; holdings: CrowdfundHoldingDTO[] };
}

const pct = (r: number) => `${(r * 100).toLocaleString('fr-FR', { maximumFractionDigits: 4 })} %`;
const INSTRUMENT: Record<BondDTO['type'], string> = { TREASURY_BOND: 'titre du Trésor', FCP: 'FCP', SUKUK: 'Sukuk' };
const RISK: Record<FundDTO['risk'], string> = { FAIBLE: 'faible', MOYEN: 'moyen', ELEVE: 'élevé' };
const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

/** Résumé texte des offres et, si l'utilisateur l'accepte, de sa situation, joint au prompt système. */
export function buildMarketContext(s: MarketSnapshot, now = new Date()): string {
  const lines: string[] = [`Données DALA Finance au ${date(now.toISOString())}.`];

  lines.push('', '## Titres publics et Sukuk disponibles');
  if (!s.bonds.length) lines.push('Aucune émission ouverte.');
  for (const b of s.bonds) {
    lines.push(
      `- ${b.issuerName} (${INSTRUMENT[b.type]}, ${b.issuerCountry}) : taux ${pct(b.rate)}, maturité ${b.maturityDays} jours, ticket minimum ${formatFCFA(b.minAmount)}, souscription jusqu'au ${date(b.closingDate)}${b.isHalal ? ', conforme à la finance islamique' : ''}. ${b.description}`,
    );
  }

  lines.push('', '## Fonds (FCP)');
  if (!s.funds.length) lines.push('Aucun fonds disponible.');
  for (const f of s.funds) {
    lines.push(
      `- ${f.name} (${f.manager}) : performance depuis le 1er janvier ${pct(f.ytdPerformance)}, risque ${RISK[f.risk]}, frais ${pct(f.fees)}, minimum ${formatFCFA(f.minAmount)}${f.isHalal ? ', conforme à la finance islamique' : ''}.`,
    );
  }

  lines.push('', `## Projets de crowdfunding en capital (validés par ${CROWDFUND_VALIDATOR})`);
  if (!s.projects.length) lines.push('Aucun projet ouvert.');
  for (const p of s.projects) {
    const raised = p.fundingGoal ? Math.round((p.fundingRaised / p.fundingGoal) * 100) : 0;
    lines.push(
      `- ${p.name} (${PROJECT_SECTORS[p.sector]?.label ?? p.sector}) : ${p.description} Marché : ${p.targetMarket}. Objectif ${formatFCFA(p.fundingGoal)}, collecté ${raised} %, valorisation ${formatFCFA(p.valuation)}, capital ouvert ${pct(p.equityMin)} à ${pct(p.equityMax)}, ${p.investorCount} investisseurs, clôture le ${date(p.deadline)}.`,
    );
  }

  if (s.summary || s.portfolio || s.crowdfund) {
    lines.push('', "## Situation de l'utilisateur (partagée avec son accord)");
    if (s.summary) {
      lines.push(
        `- Solde disponible ${formatFCFA(s.summary.main)}, épargne ${formatFCFA(s.summary.savings)}, coffre-fort ${formatFCFA(s.summary.vault)}, placements ${formatFCFA(s.summary.investments)}, crowdfunding ${formatFCFA(s.summary.crowdfund)}, crédit en cours ${formatFCFA(s.summary.creditOutstanding)}.`,
      );
    }
    for (const i of s.portfolio?.investments ?? []) {
      if (i.status !== 'ACTIVE') continue;
      lines.push(`- Placement : ${i.instrumentName}, ${formatFCFA(i.amount)} à ${pct(i.rate)}, échéance ${date(i.maturityDate)}.`);
    }
    for (const h of s.crowdfund?.holdings ?? []) {
      lines.push(`- Participation : ${h.projectName}, ${formatFCFA(h.amount)} pour ${pct(h.equityPct)} du capital.`);
    }
  }
  return lines.join('\n');
}
