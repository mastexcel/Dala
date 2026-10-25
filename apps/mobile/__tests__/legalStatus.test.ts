/**
 * Garde-fou : aucun texte affiché dans l'application ne doit présenter DALA comme un
 * « établissement de paiement » ; le statut affiché est la phase de test au sein du LIF-BCEAO.
 */
import fs from 'node:fs';
import path from 'node:path';
import { LEGAL_NOTICE, TEST_PHASE_NOTICE } from '@dala/shared';

const ROOTS = ['app', 'components', 'services', 'i18n', '../../packages/shared/src'].map((d) => path.join(__dirname, '..', d));

function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return sources(p);
    return /\.(ts|tsx|json)$/.test(e.name) && !/\.test\./.test(e.name) ? [p] : [];
  });
}

it('aucun texte ne présente DALA comme un établissement de paiement', () => {
  const offending = ROOTS.flatMap(sources).flatMap((file) =>
    fs
      .readFileSync(file, 'utf8')
      .split('\n')
      // Les commentaires ne sont pas affichés ; la consigne de l'assistant IA interdit justement cette formulation.
      .filter((line) => !/^\s*(\/\/|\/?\*)/.test(line))
      .filter((line) => /établissement de paiement|établissement agréé/i.test(line) && !/jamais/i.test(line))
      .map((line) => `${path.relative(path.join(__dirname, '..'), file)}: ${line.trim()}`),
  );
  expect(offending).toEqual([]);
});

it('la mention légale commune porte le statut de phase de test', () => {
  expect(LEGAL_NOTICE).toContain(TEST_PHASE_NOTICE);
});
