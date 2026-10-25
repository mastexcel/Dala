import { isNewer } from '@/hooks/useAppUpdate';

const manifest = { versionCode: 14, commit: 'abc1234', publishedAt: '2026-10-25T08:00:00Z', url: 'https://example.org/DALA-Finance.apk' };

it('propose la mise à jour seulement si la version publiée est plus récente', () => {
  expect(isNewer(manifest, 13)).toBe(true);
  expect(isNewer(manifest, 14)).toBe(false);
  expect(isNewer(manifest, 15)).toBe(false);
  // Version de développement (sans numéro) ou fiche indisponible : rien n'est proposé.
  expect(isNewer(manifest, null)).toBe(false);
  expect(isNewer(undefined, 13)).toBe(false);
});
