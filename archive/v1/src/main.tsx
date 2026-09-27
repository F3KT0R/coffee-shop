import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.tsx';
import { CartProvider } from './context/CartContext';
import './styles/globals.scss';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CartProvider>
      <App />
    </CartProvider>
  </React.StrictMode>
);
