import { AiError, type AiReply, type ChatTurn } from './types';

interface Options {
  apiKey: string;
  baseUrl: string;
  model: string;
  system: string;
  context: string;
  history: ChatTurn[];
}

/** Fournisseurs exposant l'API « chat completions » d'OpenAI (OpenAI, Mistral, Groq, OpenRouter, Ollama…). */
export async function askOpenAiCompatible({ apiKey, baseUrl, model, system, context, history }: Options): Promise<AiReply> {
  const root = baseUrl.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//.test(root)) throw new AiError("Adresse de l'API invalide (elle doit commencer par https://).", 'config');
  if (!model.trim()) throw new AiError('Indiquez le nom du modèle à utiliser.', 'config');

  let res: Response;
  try {
    res = await fetch(`${root}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
      body: JSON.stringify({
        model: model.trim(),
        messages: [{ role: 'system', content: `${system}\n\n${context}` }, ...history.map((t) => ({ role: t.role, content: t.content }))],
      }),
    });
  } catch {
    throw new AiError('Impossible de joindre le fournisseur. Vérifiez l’adresse et votre connexion.', 'network');
  }
  const data = (await res.json().catch(() => ({}))) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } };
  if (res.status === 401 || res.status === 403) throw new AiError('Clé API refusée par le fournisseur.', 'auth');
  if (res.status === 429) throw new AiError('Limite d’utilisation atteinte chez le fournisseur. Réessayez dans un instant.', 'rate_limit');
  if (!res.ok) throw new AiError(`Erreur du fournisseur (${res.status}) : ${data.error?.message ?? 'réponse inattendue'}`, 'provider');
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new AiError('Réponse vide du fournisseur.', 'provider');
  return { content, sources: [] };
}

/** Vérifie l'adresse et la clé via la liste des modèles (sans consommer de jetons). */
export async function verifyOpenAiCompatible(apiKey: string, baseUrl: string) {
  const root = baseUrl.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//.test(root)) throw new AiError("Adresse de l'API invalide (elle doit commencer par https://).", 'config');
  let res: Response;
  try {
    res = await fetch(`${root}/models`, { headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {} });
  } catch {
    throw new AiError('Impossible de joindre le fournisseur. Vérifiez l’adresse et votre connexion.', 'network');
  }
  if (res.status === 401 || res.status === 403) throw new AiError('Clé API refusée par le fournisseur.', 'auth');
  if (!res.ok) throw new AiError(`Le fournisseur a répondu ${res.status}.`, 'provider');
}
