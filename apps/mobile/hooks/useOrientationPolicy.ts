import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as ScreenOrientation from 'expo-screen-orientation';

/**
 * Téléphone : portrait verrouillé. Tablette : rotation libre (portrait et paysage).
 * Sur le web, le navigateur gère l'orientation.
 */
export function useOrientationPolicy() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    (async () => {
      const type = await Device.getDeviceTypeAsync();
      if (type === Device.DeviceType.PHONE) {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      } else {
        await ScreenOrientation.unlockAsync();
      }
    })().catch(() => undefined);
  }, []);
}
