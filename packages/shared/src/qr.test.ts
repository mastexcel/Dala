import { describe, expect, it } from 'vitest';
import { crc16ccitt, extractPhone, parseScannedCode, parseTlv } from './qr';

/** Construit un QR EMVCo valide (CRC calculé), comme le ferait une application de paiement. */
function emv(fields: [string, string][]) {
  const body = fields.map(([t, v]) => `${t}${String(v.length).padStart(2, '0')}${v}`).join('') + '6304';
  return body + crc16ccitt(body);
}
const sub = (fields: [string, string][]) => fields.map(([t, v]) => `${t}${String(v.length).padStart(2, '0')}${v}`).join('');

describe('décodage des QR codes', () => {
  it('calcule le CRC16-CCITT de référence', () => {
    expect(crc16ccitt('123456789')).toBe('29B1');
  });

  it('reconnaît le QR DALA et les liens de demande de paiement', () => {
    expect(parseScannedCode('dala:pay?to=+2250707000001&amount=5000')).toEqual({ kind: 'dala-transfer', phone: '+2250707000001', amount: 5000 });
    expect(parseScannedCode('https://api.dala.ci/pay/QWBTVZBM')).toMatchObject({ kind: 'dala-request', code: 'QWBTVZBM' });
  });

  it('lit un QR EMVCo (paiement interopérable) : marchand, montant FCFA, numéro et opérateur', () => {
    const data = emv([
      ['00', '01'],
      ['01', '12'],
      ['26', sub([['00', 'ci.mtn.momo'], ['01', '+2250506070809']])],
      ['52', '5812'],
      ['53', '952'],
      ['54', '2500'],
      ['58', 'CI'],
      ['59', 'MAQUIS CHEZ TANTIE'],
      ['60', 'ABIDJAN'],
    ]);
    expect(parseTlv(data)).not.toBeNull();
    expect(parseScannedCode(data)).toEqual({
      kind: 'emv',
      merchantName: 'MAQUIS CHEZ TANTIE',
      city: 'ABIDJAN',
      amount: 2500,
      currency: '952',
      country: 'CI',
      phone: '+2250506070809',
      operator: 'MTN_MOMO',
      networks: ['ci.mtn.momo'],
      crcValid: true,
    });
  });

  it('signale un QR EMVCo altéré (CRC faux)', () => {
    const data = emv([['00', '01'], ['59', 'BOUTIQUE'], ['53', '952']]);
    const tampered = data.replace('BOUTIQUE', 'BOUTIQUX');
    expect(parseScannedCode(tampered)).toMatchObject({ kind: 'emv', crcValid: false });
  });

  it('reconnaît les numéros (tel:, carte de visite, texte) et en déduit l’opérateur', () => {
    expect(parseScannedCode('tel:+225 07 08 09 10 11')).toMatchObject({ kind: 'phone', phone: '+2250708091011', operator: 'ORANGE_MONEY' });
    expect(parseScannedCode('BEGIN:VCARD\nVERSION:3.0\nFN:Koffi Yao\nTEL:0102030405\nEND:VCARD')).toMatchObject({ kind: 'phone', phone: '+2250102030405', operator: 'MOOV_MONEY', name: 'Koffi Yao' });
    expect(extractPhone('Payez au 05 06 07 08 09 merci')).toBe('+2250506070809');
  });

  it('reconnaît les liens des opérateurs et laisse le reste inconnu', () => {
    expect(parseScannedCode('https://pay.wave.com/m/M_ci_abc123/c/ci/')).toMatchObject({ kind: 'operator-link', operator: 'WAVE' });
    expect(parseScannedCode('https://exemple.org/menu')).toEqual({ kind: 'unknown', raw: 'https://exemple.org/menu' });
  });
});
