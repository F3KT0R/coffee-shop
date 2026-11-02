import './styles.css';
import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { queryClient, startCatalogCopy } from './lib/queries';
import { router } from './router';

// Wake the API right away and keep the browser's catalog copy current (see lib/catalogCopy.ts).
startCatalogCopy();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
