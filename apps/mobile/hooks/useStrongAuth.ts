import { useCallback } from 'react';
import { STRONG_AUTH_THRESHOLD, formatFCFA } from '@dala/shared';
import { useStrongAuthStore } from '@/stores/strongAuth';
import { ApiError } from '@/services/errors';

/**
 * Authentification forte (Instruction BCEAO, Art. 84) : au-delà de 50 000 FCFA, ou pour
 * toute opération sensible, l'utilisateur confirme avec son PIN (connaissance) depuis son
 * appareil enrôlé (possession). Renvoie null si l'utilisateur annule.
 */
export function useStrongAuth() {
  const askPin = useStrongAuthStore((s) => s.askPin);

  return useCallback(
    async <T>(
      run: (pin?: string) => Promise<T>,
      opts: { amount?: number; always?: boolean; title?: string } = {},
    ): Promise<T | null> => {
      const needsPin = opts.always || (opts.amount ?? 0) > STRONG_AUTH_THRESHOLD;
      const title = opts.title ?? (opts.amount ? `Confirmer ${formatFCFA(opts.amount)}` : "Confirmer l'opération");
      let pin: string | null | undefined;
      if (needsPin) {
        pin = await askPin(title, 'Saisissez votre code PIN DALA');
        if (!pin) return null;
      }
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          return await run(pin ?? undefined);
        } catch (e) {
          if (e instanceof ApiError && (e.code === 'STRONG_AUTH_REQUIRED' || e.code === 'INVALID_PIN')) {
            pin = await askPin(title, e.code === 'INVALID_PIN' ? 'PIN incorrect, réessayez' : 'Saisissez votre code PIN DALA');
            if (!pin) return null;
            continue;
          }
          throw e;
        }
      }
      return null;
    },
    [askPin],
  );
}
