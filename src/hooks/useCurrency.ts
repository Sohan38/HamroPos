import { useApp } from '../contexts/AppContext';

export function useCurrency() {
  const { settings } = useApp();

  const format = (amount: number) => {
    return new Intl.NumberFormat(settings.language || 'en-US', {
      style: 'currency',
      currency: settings.currency || 'NPR',
      currencyDisplay: 'symbol'
    }).format(amount);
  };

  return {
    format,
    symbol: settings.currencySymbol || 'Rs'
  };
}
