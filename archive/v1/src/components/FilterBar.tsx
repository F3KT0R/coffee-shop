import React from 'react';
import { SystemCategory } from '../types';
import { useBrands } from '../hooks/useBrands';
import './FilterBar.scss';

interface FilterBarProps {
  systems: SystemCategory[];
  activeSystem: string | null;
  onSystemChange: (system: string | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeBrand?: string | null;
  onBrandChange?: (brand: string | null) => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  systems,
  activeSystem,
  onSystemChange,
  searchQuery,
  onSearchChange,
  activeBrand,
  onBrandChange,
}) => {
  const { brands, loading: brandsLoading } = useBrands(activeSystem);

  return (
    <div className="filter-bar">
      <div className="filter-bar__container">
        {/* Search */}
        <div className="filter-bar__search">
          <input
            type="text"
            placeholder="Pretraži proizvode..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="search-input"
          />
          <span className="search-icon">🔍</span>
        </div>

        {/* System Filters */}
        <div className="filter-bar__systems">
          <button
            className={`system-btn ${activeSystem === null ? 'active' : ''}`}
            onClick={() => onSystemChange(null)}
          >
            Sve
          </button>
          {systems.map((system) => (
            <button
              key={system.id}
              className={`system-btn ${activeSystem === system.type ? 'active' : ''}`}
              onClick={() => onSystemChange(system.type)}
            >
              {system.name}
            </button>
          ))}
        </div>

        {/* Brand Filters - Show when brands are available */}
        {onBrandChange && brands.length > 0 && (
          <div className="filter-bar__brands">
            <label className="filter-label">Brendovi:</label>
            <div className="brands-scroll">
              <button
                className={`brand-btn ${activeBrand === null ? 'active' : ''}`}
                onClick={() => onBrandChange(null)}
                disabled={brandsLoading}
              >
                Svi
              </button>
              {brands.map((brand) => (
                <button
                  key={brand.id}
                  className={`brand-btn ${activeBrand === brand.name ? 'active' : ''}`}
                  onClick={() => onBrandChange(brand.name)}
                  disabled={brandsLoading}
                  title={`${brand.product_count} proizvoda`}
                >
                  {brand.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
