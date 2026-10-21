import { create } from 'zustand';

/** Données d'inscription en attente de vérification OTP (gardées en mémoire uniquement). */
interface PendingRegistration {
  phone: string;
  firstName: string;
  lastName: string;
  pin: string;
  email?: string;
  referralCode?: string;
}

export const useRegistrationStore = create<{ pending: PendingRegistration | null; set: (p: PendingRegistration | null) => void }>((set) => ({
  pending: null,
  set: (pending) => set({ pending }),
}));
