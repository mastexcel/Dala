import { useEffect, useState } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';

export function useBiometrics() {
  const [available, setAvailable] = useState(false);
  const [label, setLabel] = useState('biométrie');

  useEffect(() => {
    (async () => {
      const [hasHardware, enrolled, types] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        LocalAuthentication.supportedAuthenticationTypesAsync(),
      ]);
      setAvailable(hasHardware && enrolled);
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) setLabel('Face ID');
      else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) setLabel('empreinte digitale');
    })().catch(() => setAvailable(false));
  }, []);

  const authenticate = async (promptMessage = 'Déverrouiller DALA') => {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage, cancelLabel: 'Annuler', disableDeviceFallback: true });
    return r.success;
  };

  return { available, label, authenticate };
}
