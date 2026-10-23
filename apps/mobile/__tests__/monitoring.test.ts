jest.mock('@sentry/react-native', () => ({ init: jest.fn(), wrap: (c: unknown) => c, setUser: jest.fn(), captureException: jest.fn() }));

describe('analytique', () => {
  const fetchMock = jest.fn(() => Promise.resolve({ ok: true }));
  beforeEach(() => {
    jest.resetModules();
    fetchMock.mockClear();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('ne fait rien sans jeton Mixpanel', () => {
    const { track, configureMonitoring } = require('@/services/monitoring');
    configureMonitoring({ mixpanelToken: undefined });
    track('login');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('envoie l’événement avec l’identifiant interne et des tranches de montant', () => {
    const { track, identify, amountBucket, configureMonitoring } = require('@/services/monitoring');
    configureMonitoring({ mixpanelToken: 'tok' });
    identify('u_123');
    track('investment_made', { amount: amountBucket(60_000) });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, { body: string }];
    const [event] = JSON.parse(init.body);
    expect(event.event).toBe('investment_made');
    expect(event.properties).toMatchObject({ token: 'tok', distinct_id: 'u_123', amount: '50k-200k' });
  });

  it('classe les montants par tranche', () => {
    const { amountBucket } = require('@/services/monitoring');
    expect([5_000, 25_000, 100_000, 500_000, 2_000_000].map(amountBucket)).toEqual(['<10k', '10k-50k', '50k-200k', '200k-1M', '>1M']);
  });
});
