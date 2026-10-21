import type { AmlAlert as SharedAlert, AmlSeverity } from '@dala/shared';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { appendAudit } from './audit';
import { notify } from './notifications';

/** Enregistre une alerte LBC/FT ; en rouge : gel du compte + déclaration de soupçon CENTIF. */
export async function recordAmlAlert(
  userId: string,
  amount: number,
  result: { severity: AmlSeverity; alerts: SharedAlert[] },
  context: Record<string, unknown>,
) {
  const red = result.severity === 'RED';
  const alert = await prisma.$transaction(async (tx) => {
    const a = await tx.amlAlert.create({
      data: {
        userId,
        severity: result.severity,
        rules: result.alerts.map((x) => ({ rule: x.rule, severity: x.severity, message: x.message })),
        amount,
        context: context as object,
        reportedToCentif: red,
        reportedAt: red ? new Date() : null,
      },
    });
    if (red) {
      await tx.user.update({ where: { id: userId }, data: { status: 'FROZEN' } });
    }
    await appendAudit(tx, { userId, action: red ? 'AML_FREEZE' : 'AML_ALERT', entity: 'AmlAlert', entityId: a.id });
    return a;
  });
  if (red) {
    await submitCentifReport(alert.id);
    await notify(userId, {
      title: 'Compte temporairement suspendu',
      body: 'Une vérification de conformité est en cours. Notre équipe vous contactera sous 48 h.',
      type: 'SECURITY',
    });
  }
  return alert;
}

/**
 * Déclaration de soupçon automatique au CENTIF.
 * Le format et le canal de transmission dépendent de la CENTIF du pays (ici : journalisation
 * + file pour traitement par le responsable conformité).
 */
export async function submitCentifReport(alertId: string) {
  logger.warn({ alertId }, 'Déclaration de soupçon CENTIF générée');
}
