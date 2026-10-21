export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error && /network|fetch/i.test(e.message)) return 'Connexion impossible. Vérifiez votre réseau.';
  return 'Une erreur est survenue. Réessayez.';
}
