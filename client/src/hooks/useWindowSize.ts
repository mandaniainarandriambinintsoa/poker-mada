import { useState, useEffect } from 'react';

interface WindowSize {
  width: number;
  height: number;
}

export function useWindowSize(): WindowSize {
  const [windowSize, setWindowSize] = useState<WindowSize>({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  });

  useEffect(() => {
    function handleResize() {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    // Ajouter l'écouteur d'événements
    window.addEventListener('resize', handleResize);

    // Appeler immédiatement pour avoir la taille initiale
    handleResize();

    // Nettoyer
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowSize;
}
