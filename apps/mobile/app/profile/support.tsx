import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { CaretDown, CaretUp, ChatCircleText, Phone } from 'phosphor-react-native';
import { COMPLAINT_RESPONSE_DAYS, REGULATORY_FRAMEWORK, TEST_PHASE_NOTICE } from '@dala/shared';
import { AppText, Button, Card, Chip, DalaIcon, Header, Input, Screen, SectionTitle } from '@/components/ui';
import { complianceApi } from '@/services/api';
import { errorMessage } from '@/services/errors';
import { COLORS, SPACING, TEXT_ON_WHITE } from '@/theme';

const FAQ = [
  { q: 'Quel est le statut de DALA ?', a: `${TEST_PHASE_NOTICE}. ${REGULATORY_FRAMEWORK} Ce cadre prévoit le cantonnement des fonds des utilisateurs sur des comptes dédiés, séparés des fonds propres de DALA.` },
  { q: 'Comment recharger mon compte ?', a: 'Depuis l’accueil, touchez « Recevoir » puis choisissez Orange Money, MTN MoMo, Wave ou Moov Money.' },
  { q: 'Puis-je annuler un investissement ?', a: 'Oui, vous disposez d’un droit de rétractation de 48 h sur les placements et les investissements en capital.' },
  { q: 'Comment est calculé mon score DALA ?', a: 'Il tient compte de la régularité de votre épargne, de l’ancienneté de votre compte, de vos remboursements et de votre ponctualité en tontine.' },
  { q: 'Qui valide les projets de crowdfunding ?', a: 'Chaque projet est étudié et validé par le comité Bridge Investment Partners avant publication.' },
];

const CATEGORIES = [
  { key: 'TRANSACTION', label: 'Opération' },
  { key: 'CREDIT', label: 'Crédit' },
  { key: 'INVEST', label: 'Placement' },
  { key: 'CROWDFUND', label: 'Crowdfund' },
  { key: 'ACCOUNT', label: 'Compte' },
  { key: 'OTHER', label: 'Autre' },
];

export default function Support() {
  const [open, setOpen] = useState<number | null>(0);
  const [category, setCategory] = useState('TRANSACTION');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();

  const send = async () => {
    setSending(true);
    setMsg(undefined);
    try {
      await complianceApi.complaint({ subject, message, category });
      setSubject('');
      setMessage('');
      setMsg({ ok: true, text: `Réclamation enregistrée. Réponse garantie sous ${COMPLAINT_RESPONSE_DAYS} jours ouvrés.` });
    } catch (e) {
      setMsg({ ok: false, text: errorMessage(e) });
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen wallpaper="profile" header={<Header title="Support" />}>
      <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
        <Button title="Appeler" variant="outline" fullWidth={false} style={{ flex: 1 }} icon={<Phone size={18} color={COLORS.navy} />} onPress={() => void Linking.openURL('tel:+2250000000000')} />
        <Button title="WhatsApp" variant="outline" fullWidth={false} style={{ flex: 1 }} icon={<ChatCircleText size={18} color={COLORS.navy} />} onPress={() => void Linking.openURL('https://wa.me/2250000000000')} />
      </View>
      <Button title="Écrire à un conseiller" variant="secondary" style={{ marginTop: SPACING.sm }} icon={<ChatCircleText size={18} color={COLORS.navy} />} onPress={() => router.push('/advisor')} />

      <SectionTitle title="Questions fréquentes" icon="info" />
      <Card padded={false}>
        {FAQ.map((f, i) => (
          <Pressable key={f.q} onPress={() => setOpen(open === i ? null : i)} accessibilityRole="button" accessibilityState={{ expanded: open === i }} style={{ padding: SPACING.md, borderBottomWidth: 0.5, borderBottomColor: COLORS.lightGray, gap: SPACING.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
              <AppText weight="semibold" style={{ flex: 1 }}>{f.q}</AppText>
              {open === i ? <CaretUp size={16} color={COLORS.midGray} /> : <CaretDown size={16} color={COLORS.midGray} />}
            </View>
            {open === i ? <AppText variant="caption" color={COLORS.darkGray}>{f.a}</AppText> : null}
          </Pressable>
        ))}
      </Card>

      <SectionTitle title="Déposer une réclamation" icon="warning" />
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md }}>
          {CATEGORIES.map((c) => <Chip key={c.key} label={c.label} active={category === c.key} onPress={() => setCategory(c.key)} />)}
        </View>
        <Input label="Objet" value={subject} onChangeText={setSubject} />
        <Input label="Message" value={message} onChangeText={setMessage} multiline style={{ minHeight: 100, textAlignVertical: 'top' }} />
        <Button title="Envoyer" variant="secondary" disabled={subject.length < 3 || message.length < 10} loading={sending} onPress={send} />
        <AppText variant="small" color={TEXT_ON_WHITE.muted} style={{ marginTop: SPACING.sm }}>
          Nous nous engageons à répondre sous {COMPLAINT_RESPONSE_DAYS} jours ouvrés. Sans réponse satisfaisante, vous pouvez saisir l'Observatoire de la qualité des services financiers ou la BCEAO.
        </AppText>
      </Card>
      {msg ? <AppText color={msg.ok ? TEXT_ON_WHITE.green : TEXT_ON_WHITE.red} style={{ marginTop: SPACING.sm }}>{msg.text}</AppText> : null}
    </Screen>
  );
}
