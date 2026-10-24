import { useRef, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { COLORS, SPACING } from '@/theme';

interface Props {
  children: ReactNode;
  composer: ReactNode;
  /** Contenu fixe au-dessus des messages (avertissement…). */
  top?: ReactNode;
}

/** Fil de discussion qui défile jusqu'au dernier message, avec la saisie collée en bas. */
export function ChatThread({ children, composer, top }: Props) {
  const scroll = useRef<ScrollView>(null);
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      {top}
      <ScrollView
        ref={scroll}
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
      >
        {children}
      </ScrollView>
      <View style={styles.composer}>{composer}</View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingVertical: SPACING.sm },
  composer: { padding: SPACING.sm, marginBottom: SPACING.sm, borderRadius: 20, backgroundColor: COLORS.white, borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.lightGray },
});
