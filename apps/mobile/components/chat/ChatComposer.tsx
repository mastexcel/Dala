import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { PaperPlaneRight } from 'phosphor-react-native';
import { COLORS, FONTS, RADIUS, SIZES, SPACING } from '@/theme';

interface Props {
  placeholder?: string;
  sending?: boolean;
  disabled?: boolean;
  onSend: (text: string) => void | Promise<void>;
  /** Texte proposé, que l'utilisateur relit avant d'envoyer. */
  initialText?: string;
}

/** Zone de saisie d'un fil de discussion. */
export function ChatComposer({ placeholder = 'Votre message…', sending, disabled, onSend, initialText = '' }: Props) {
  const [text, setText] = useState(initialText);
  const canSend = !!text.trim() && !sending && !disabled;
  const submit = () => {
    if (!canSend) return;
    const value = text.trim();
    setText('');
    void onSend(value);
  };
  return (
    <View style={styles.row}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.midGray}
        multiline
        maxLength={4000}
        editable={!disabled}
        accessibilityLabel="Message"
        style={styles.input}
        onKeyPress={(e) => {
          // Web : Entrée envoie, Maj+Entrée passe à la ligne.
          const ev = e.nativeEvent as { key: string; shiftKey?: boolean };
          if (ev.key === 'Enter' && !ev.shiftKey && 'shiftKey' in ev) {
            (e as unknown as { preventDefault?: () => void }).preventDefault?.();
            submit();
          }
        }}
      />
      <Pressable onPress={submit} disabled={!canSend} accessibilityRole="button" accessibilityLabel="Envoyer" style={[styles.send, !canSend && { opacity: 0.4 }]}>
        {sending ? <ActivityIndicator color={COLORS.navy} /> : <PaperPlaneRight size={22} color={COLORS.navy} weight="fill" />}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.sm },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 140,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    backgroundColor: COLORS.offWhite,
    fontFamily: FONTS.body,
    fontSize: SIZES.body,
    color: COLORS.black,
  },
  send: { width: 44, height: 44, borderRadius: RADIUS.full, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center' },
});
