'use client';

import { useEffect } from 'react';

export function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            console.log('🌸 PWA Service Worker registered:', reg.scope);
          })
          .catch((err) => {
            console.warn('PWA registration failed:', err);
          });
      });
    }
  }, []);

  return null;
}
