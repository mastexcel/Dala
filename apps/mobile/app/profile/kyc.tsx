import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import { KYC_LIMITS, KYC_REQUIREMENTS, formatFCFA, type KycLevel } from '@dala/shared';
import { AppText, Badge, Button, Card, Chip, DalaIcon, Header, Input, LegalNotice, Screen } from '@/components/ui';
import { useMe, qk } from '@/hooks/queries';
import { userApi } from '@/services/api';
import { errorMessage } from '@/services/errors';
import { COLORS, SPACING, TEXT_ON_WHITE } from '@/theme';

type DocKey = 'idDocumentPath' | 'selfiePath' | 'proofOfAddressPath' | 'incomeProofPath' | 'videoPath';

export default function Kyc() {
  const me = useMe();
  const qc = useQueryClient();
  const level = (me.data?.kycLevel ?? 1) as KycLevel;
  const target = Math.min(3, level + 1) as KycLevel;
  const [idType, setIdType] = useState<'CNI' | 'PASSEPORT'>('CNI');
  const [idNumber, setIdNumber] = useState('');
  const [address, setAddress] = useState('');
  const [files, setFiles] = useState<Partial<Record<DocKey, string>>>({});
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  const capture = async (key: DocKey, opts: { camera?: boolean; video?: boolean } = {}) => {
    setError(undefined);
    const perm = opts.camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setError("Autorisez l'accès pour continuer.");
    const pickerOpts: ImagePicker.ImagePickerOptions = { mediaTypes: opts.video ? ImagePicker.MediaTypeOptions.Videos : ImagePicker.MediaTypeOptions.Images, quality: 0.7, videoMaxDuration: 15, cameraType: key === 'selfiePath' || opts.video ? ImagePicker.CameraType.front : ImagePicker.CameraType.back };
    const r = opts.camera ? await ImagePicker.launchCameraAsync(pickerOpts) : await ImagePicker.launchImageLibraryAsync(pickerOpts);
    if (r.canceled) return;
    const asset = r.assets[0];
    const { uploadUrl, path } = await userApi.uploadUrl(asset.fileName ?? `${key}.${opts.video ? 'mp4' : 'jpg'}`);
    if (!uploadUrl.startsWith('sandbox://')) {
      const blob = await (await fetch(asset.uri)).blob();
      await fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': asset.mimeType ?? 'application/octet-stream' } });
    }
    setFiles((f) => ({ ...f, [key]: path }));
  };

  const submit = async () => {
    setLoading(true);
    setError(undefined);
    try {
      const body =
        target === 2
          ? { targetLevel: 2, idType, idNumber, address, idDocumentPath: files.idDocumentPath, selfiePath: files.selfiePath, proofOfAddressPath: files.proofOfAddressPath }
          : { targetLevel: 3, incomeProofPath: files.incomeProofPath, videoPath: files.videoPath };
      const r = await userApi.submitKyc(body);
      setStatus(r.status);
      await qc.invalidateQueries({ queryKey: qk.me });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const ready = target === 2 ? !!(files.idDocumentPath && files.selfiePath && idNumber.length >= 5 && address.length >= 5) : !!(files.incomeProofPath && files.videoPath);

  const DocButton = ({ k, label, camera, video }: { k: DocKey; label: string; camera?: boolean; video?: boolean }) => (
    <Card onPress={() => void capture(k, { camera, video }).catch((e) => setError(errorMessage(e)))} style={{ marginBottom: SPACING.sm }} accessibilityLabel={label}>
      <View style={styles.row}>
        <DalaIcon name={files[k] ? 'success' : camera ? 'scan' : 'deposit'} size={30} />
        <AppText weight="semibold" style={{ flex: 1 }}>{label}</AppText>
        <AppText variant="small" color={files[k] ? TEXT_ON_WHITE.green : TEXT_ON_WHITE.muted}>{files[k] ? 'Ajouté' : 'Ajouter'}</AppText>
      </View>
    </Card>
  );

  return (
    <Screen header={<Header title="Vérification d'identité" />} footer={level < 3 && !status ? <Button title={`Valider le niveau ${target}`} disabled={!ready} loading={loading} onPress={submit} /> : undefined}>
      <View style={{ alignItems: 'center', marginBottom: SPACING.md }}>
        <DalaIcon name="kyc" size={88} />
      </View>
      {([1, 2, 3] as KycLevel[]).map((l) => {
        const lim = KYC_LIMITS[l];
        const done = l <= level;
        return (
          <Card key={l} style={[{ marginBottom: SPACING.sm, gap: 4 }, l === target && !done ? { borderWidth: 2, borderColor: COLORS.gold } : {}]}>
            <View style={styles.row}>
              <DalaIcon name={done ? 'success' : 'kyc'} size={28} dimmed={!done && l !== target} />
              <AppText weight="bold" style={{ flex: 1 }}>Niveau {l} · {lim.label}</AppText>
              <Badge label={lim.monthlyLimit ? `${formatFCFA(lim.monthlyLimit, { compact: true })}/mois` : 'Sans plafond'} color={TEXT_ON_WHITE.blue} />
            </View>
            {KYC_REQUIREMENTS[l].map((r) => (
              <AppText key={r} variant="small" color={TEXT_ON_WHITE.muted}>• {r}</AppText>
            ))}
            {!lim.transfersAllowed ? <AppText variant="small" color={TEXT_ON_WHITE.orange}>Transferts non autorisés</AppText> : null}
          </Card>
        );
      })}

      {status ? (
        <Card style={{ marginTop: SPACING.md, backgroundColor: `${COLORS.green}1A` }}>
          <AppText weight="bold" color={TEXT_ON_WHITE.green}>Documents reçus ✓</AppText>
          <AppText variant="caption">Notre équipe conformité vérifie votre dossier (24 à 48 h). Vous serez notifié·e.</AppText>
        </Card>
      ) : level < 3 ? (
        <View style={{ marginTop: SPACING.lg }}>
          <AppText variant="h4" weight="bold" style={{ marginBottom: SPACING.sm }}>Passer au niveau {target}</AppText>
          {target === 2 ? (
            <>
              <View style={{ flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md }}>
                <Chip label="CNI" active={idType === 'CNI'} onPress={() => setIdType('CNI')} />
                <Chip label="Passeport" active={idType === 'PASSEPORT'} onPress={() => setIdType('PASSEPORT')} />
              </View>
              <Input label="Numéro de la pièce" value={idNumber} onChangeText={setIdNumber} autoCapitalize="characters" />
              <Input label="Adresse de résidence" value={address} onChangeText={setAddress} placeholder="Quartier, commune, ville" />
              <DocButton k="idDocumentPath" label="Photo de la pièce d'identité" camera />
              <DocButton k="selfiePath" label="Selfie de vérification" camera />
              <DocButton k="proofOfAddressPath" label="Justificatif de domicile (facultatif)" />
            </>
          ) : (
            <>
              <DocButton k="incomeProofPath" label="Justificatif de revenus" />
              <DocButton k="videoPath" label="Vidéo de vérification (15 s)" camera video />
            </>
          )}
        </View>
      ) : null}
      {error ? <AppText color={TEXT_ON_WHITE.red}>{error}</AppText> : null}
      <LegalNotice text="Vérification d'identité requise au titre de la lutte contre le blanchiment de capitaux et le financement du terrorisme (LBC/FT)." />
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md } });
