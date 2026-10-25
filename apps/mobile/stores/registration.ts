import { create } from 'zustand';

/** Données d'inscription en attente de vérification OTP (gardées en mémoire uniquement). */
interface PendingRegistration {
  phone: string;
  firstName: string;
  lastName: string;
  pin: string;
  email?: string;
  referralCode?: string;
  /** Date de naissance AAAA-MM-JJ. */
  dateOfBirth: string;
  consent: { version: string; accepted: true };
}

/** Acceptation de l'avertissement de la phase de test (horodatée à l'écran, puis par le serveur). */
interface Consent {
  version: string;
  acceptedAt: string;
}

interface RegistrationState {
  pending: PendingRegistration | null;
  consent: Consent | null;
  set: (p: PendingRegistration | null) => void;
  acceptConsent: (version: string) => void;
}

export const useRegistrationStore = create<RegistrationState>((set) => ({
  pending: null,
  consent: null,
  set: (pending) => set({ pending }),
  acceptConsent: (version) => set({ consent: { version, acceptedAt: new Date().toISOString() } }),
}));
