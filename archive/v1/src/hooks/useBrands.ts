import { useState, useEffect } from 'react';
import { apiService } from '../services/api';

export interface Brand {
  id: string;
  name: string;
  slug: string;
  product_count: number;
  systems: string[];
}

/**
 * Hook to fetch and manage brands, optionally filtered by system
 */
export const useBrands = (system?: string | null) => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBrands = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await apiService.getBrands(system || undefined);
        // Sort brands by product_count in descending order
        const sortedBrands = data.sort((a, b) => b.product_count - a.product_count);
        setBrands(sortedBrands);
      } catch (err) {
        console.error('Error fetching brands:', err);
        setError('Failed to load brands');
      } finally {
        setLoading(false);
      }
    };

    fetchBrands();
  }, [system]);

  return { brands, loading, error };
};
