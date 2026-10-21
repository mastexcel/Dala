import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Trousseau sécurisé (Keychain / Keystore). Sur le web (aperçu de développement uniquement),
 * repli sur localStorage — ne jamais servir la version web en production avec des jetons réels.
 */
export const secureStorage = {
  getItem: (key: string) => (Platform.OS === 'web' ? Promise.resolve(globalThis.localStorage?.getItem(key) ?? null) : SecureStore.getItemAsync(key)),
  setItem: (key: string, value: string) => (Platform.OS === 'web' ? Promise.resolve(globalThis.localStorage?.setItem(key, value)) : SecureStore.setItemAsync(key, value)),
  deleteItem: (key: string) => (Platform.OS === 'web' ? Promise.resolve(globalThis.localStorage?.removeItem(key)) : SecureStore.deleteItemAsync(key)),
};
