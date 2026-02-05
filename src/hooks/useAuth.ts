import { useState } from 'react';

interface UseAuthReturn {
  isAuthenticated: boolean;
  isConnecting: boolean;
  setIsAuthenticated: (value: boolean) => void;
  setIsConnecting: (value: boolean) => void;
}

export const useAuth = (): UseAuthReturn => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  return {
    isAuthenticated,
    isConnecting,
    setIsAuthenticated,
    setIsConnecting,
  };
};
