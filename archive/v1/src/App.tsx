import './App.scss';
import { useEffect, useState, useCallback } from 'react';
import { Header } from './components/Header';
import { FilterBar } from './components/FilterBar';
import { ProductCard } from './components/ProductCard';
import { ProductModal } from './components/ProductModal';
import { CheckoutModal } from './components/Checkout/CheckoutModal';
import { LoadingSkeleton } from './components/LoadingSkeleton';
import { Product, SystemCategory } from './types';
import { apiService } from './services/api';

export const App = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [systems, setSystems] = useState<SystemCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSystem, setActiveSystem] = useState<string | null>(null);
  const [activeBrand, setActiveBrand] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // Fetch systems on mount
  useEffect(() => {
    const loadSystems = async () => {
      try {
        const systemsData = await apiService.getSystems();
        // Convert API systems to SystemCategory format for FilterBar
        const formattedSystems: SystemCategory[] = systemsData.map((sys) => ({
          id: sys.id,
          type: sys.slug as string,
          name: sys.name,
        }));
        setSystems(formattedSystems);
      } catch (err) {
        console.error('Error loading systems:', err);
      }
    };
    loadSystems();
  }, []);

  const fetchProducts = useCallback(async (
    system: string | null,
    brand: string | null,
    search: string,
    pageNum: number,
    append: boolean = false
  ) => {
    try {
      if (!append) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      const response = await apiService.getProducts({
        system: system || undefined,
        brand: brand || undefined,
        search: search || undefined,
        page: pageNum,
        in_stock: true,
      });

      if (append) {
        setProducts((prev) => [...prev, ...response.data]);
      } else {
        setProducts(response.data);
      }

      setHasMore(response.pagination?.hasNext || false);
    } catch (err) {
      setError('Greška pri učitavanju proizvoda. Pokušajte ponovo.');
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
    fetchProducts(activeSystem, activeBrand, searchQuery, 1, false);
  }, [activeSystem, activeBrand, searchQuery, fetchProducts]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchProducts(activeSystem, activeBrand, searchQuery, nextPage, true);
  };

  const handleSystemChange = (system: string | null) => {
    setActiveSystem(system);
    setActiveBrand(null); // Reset brand when system changes
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBrandChange = (brand: string | null) => {
    setActiveBrand(brand);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
  };

  const handleCloseModal = () => {
    setSelectedProduct(null);
  };

  const handleCheckoutOpen = () => {
    setIsCheckoutOpen(true);
  };

  const handleCheckoutClose = () => {
    setIsCheckoutOpen(false);
  };

  return (
    <div className="app">
      <Header onCheckout={handleCheckoutOpen} />
      <FilterBar
        systems={systems}
        activeSystem={activeSystem}
        onSystemChange={handleSystemChange}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        activeBrand={activeBrand}
        onBrandChange={handleBrandChange}
      />

      <main className="app__main">
        <div className="container">
          {error && (
            <div className="app__error">
              <p>{error}</p>
              <button onClick={() => fetchProducts(activeSystem, activeBrand, searchQuery, 1, false)}>
                Pokušaj ponovo
              </button>
            </div>
          )}

          {loading ? (
            <LoadingSkeleton />
          ) : products.length === 0 ? (
            <div className="app__empty">
              <h2>Nema pronađenih proizvoda</h2>
              <p>Pokušajte sa drugačijim filterima ili pretragom.</p>
            </div>
          ) : (
            <>
              <div className="app__products">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} onClick={handleProductClick} />
                ))}
              </div>

              {hasMore && (
                <div className="app__load-more">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="load-more-btn"
                  >
                    {loadingMore ? 'Učitavanje...' : 'Učitaj još'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {selectedProduct && (
        <ProductModal product={selectedProduct} onClose={handleCloseModal} />
      )}

      <CheckoutModal isOpen={isCheckoutOpen} onClose={handleCheckoutClose} />

      <footer className="app__footer">
        <div className="container">
          <p>© 2024 Kafe za Vas - Najbolje kafe kapsule za vaš dom</p>
        </div>
      </footer>
    </div>
  );
};
