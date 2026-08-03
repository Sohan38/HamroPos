import { useApp } from '@/contexts/AppContext';
import { FeatureConfig } from '@/types';
import { useLicense } from '@/license/LicenseContext';

type FeatureDomain = keyof FeatureConfig;
type FeatureKey<D extends FeatureDomain> = keyof FeatureConfig[D];

/**
 * Hook to verify if a feature module or sub-feature option is active.
 *
 * @param domain - The domain grouping (e.g., 'inventory', 'sales', 'hospitality')
 * @param feature - The specific flag toggle (e.g., 'batches', 'returns', 'hotelGrid')
 */
export function useFeature<D extends FeatureDomain>(domain: D, feature: FeatureKey<D>): boolean {
  const { settings } = useApp();
  const { checkFeature } = useLicense();
  
  const adminEnabled = !!settings.features?.[domain]?.[feature];
  const licenseAllows = checkFeature(String(domain), String(feature));
  
  return adminEnabled && licenseAllows;
}

