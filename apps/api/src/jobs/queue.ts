import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { config, isTest } from '../config';
import { logger } from '../lib/logger';
import * as tasks from './tasks';

/**
 * Tâches asynchrones (BullMQ / Redis). Sans REDIS_URL, repli sur des timers en mémoire
 * — suffisant en développement, pas en production multi-instance.
 */

type JobName = 'autoSave' | 'releaseVaults' | 'confirmCrowdfund' | 'settleInvestments' | 'markOverdue' | 'complaintSla' | 'reconcile' | 'rescore';

const handlers: Record<JobName, (data: Record<string, string>) => Promise<unknown>> = {
  autoSave: () => tasks.runAutoSave(),
  releaseVaults: () => tasks.releaseVaults(),
  confirmCrowdfund: () => tasks.confirmCrowdfundInvestments(),
  settleInvestments: () => tasks.settleMaturedInvestments(),
  markOverdue: () => tasks.markOverdueLoans(),
  complaintSla: () => tasks.complaintSlaWatch(),
  reconcile: () => tasks.dailyReconciliation(),
  rescore: (d) => tasks.rescoreUser(d.userId),
};

const SCHEDULE: { name: JobName; every: number }[] = [
  { name: 'autoSave', every: 60 * 60_000 },
  { name: 'releaseVaults', every: 60 * 60_000 },
  { name: 'confirmCrowdfund', every: 15 * 60_000 },
  { name: 'settleInvestments', every: 60 * 60_000 },
  { name: 'markOverdue', every: 60 * 60_000 },
  { name: 'complaintSla', every: 6 * 60 * 60_000 },
  { name: 'reconcile', every: 24 * 60 * 60_000 },
];

let queue: Queue | null = null;
const timers: NodeJS.Timeout[] = [];

async function run(name: JobName, data: Record<string, string> = {}) {
  try {
    const result = await handlers[name](data);
    logger.debug({ name, result }, 'Tâche exécutée');
  } catch (err) {
    logger.error({ err, name }, 'Échec de tâche');
  }
}

export async function startJobs() {
  if (isTest) return;
  if (config.REDIS_URL) {
    const connection = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });
    queue = new Queue('dala', { connection });
    new Worker('dala', async (job) => handlers[job.name as JobName](job.data), { connection });
    for (const s of SCHEDULE) {
      await queue.add(s.name, {}, { repeat: { every: s.every }, jobId: s.name, removeOnComplete: 100 });
    }
    logger.info('Tâches planifiées via BullMQ');
  } else {
    for (const s of SCHEDULE) timers.push(setInterval(() => void run(s.name), s.every));
    logger.info('Tâches planifiées en mémoire (REDIS_URL absent)');
  }
}

/** Mise en file d'un job ponctuel (ex. re-scoring après remboursement). */
export async function enqueue(name: JobName, data: Record<string, string> = {}) {
  if (queue) await queue.add(name, data, { removeOnComplete: 100, attempts: 3 });
  else if (!isTest) setImmediate(() => void run(name, data));
}

export async function stopJobs() {
  timers.forEach(clearInterval);
  await queue?.close();
}
