/**
 * Sur Android/iOS, `URL` est l'implémentation réduite de React Native : sans polyfill,
 * le SDK Anthropic construit une adresse erronée (`toString` et `search` y sont incomplets).
 */
import { askClaude } from '@/services/ai/anthropic';

const NodeURL = global.URL;
const call = () =>
  askClaude({ apiKey: 'k', model: 'claude-opus-5-5', system: 's', context: 'c', history: [{ id: '1', role: 'user', content: 'Bonjour', createdAt: '' }], webSearch: false });

beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify({ id: 'm', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [{ type: 'text', text: 'Bonjour !' }], stop_reason: 'end_turn', usage: {} }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  ) as never;
});
afterAll(() => {
  global.URL = NodeURL;
});

it("corrompt l'adresse avec l'URL de React Native, puis la construit correctement avec le polyfill chargé par l'app", async () => {
  global.URL = jest.requireActual('react-native/Libraries/Blob/URL').URL;
  const lastUrl = () => String((global.fetch as jest.Mock).mock.calls.at(-1)[0]);
  await call();
  // Adresse corrompue (« /messages/? ») : l'API ne la reconnaît pas.
  expect(lastUrl()).toBe('https://api.anthropic.com/v1/messages/?');

  jest.requireActual('react-native-url-polyfill/auto');
  await expect(call()).resolves.toMatchObject({ content: 'Bonjour !' });
  expect(lastUrl()).toBe('https://api.anthropic.com/v1/messages');
});
