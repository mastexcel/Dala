import { render, screen } from '@testing-library/react-native';
import { Amount } from '@/components/ui/Amount';
import { useUiStore } from '@/stores/ui';

describe('<Amount />', () => {
  beforeEach(() => useUiStore.setState({ balanceHidden: false }));

  it('affiche le montant en FCFA avec signe', () => {
    render(<Amount value={12_500} sign />);
    expect(screen.getByText('+12 500 FCFA')).toBeTruthy();
  });

  it('masque le montant quand le solde est caché', () => {
    useUiStore.setState({ balanceHidden: true });
    render(<Amount value={247_500} maskable />);
    expect(screen.getByText('•••••• FCFA')).toBeTruthy();
  });
});
