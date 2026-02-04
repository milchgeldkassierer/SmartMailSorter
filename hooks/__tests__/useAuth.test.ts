import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuth } from '../useAuth';

describe('useAuth', () => {
    beforeEach(() => {
        // Reset any mocks if needed
    });

    describe('Initial State', () => {
        it('should initialize with isAuthenticated as false', () => {
            const { result } = renderHook(() => useAuth());
            expect(result.current.isAuthenticated).toBe(false);
        });

        it('should initialize with isConnecting as false', () => {
            const { result } = renderHook(() => useAuth());
            expect(result.current.isConnecting).toBe(false);
        });

        it('should provide all required properties', () => {
            const { result } = renderHook(() => useAuth());
            expect(result.current).toHaveProperty('isAuthenticated');
            expect(result.current).toHaveProperty('isConnecting');
            expect(result.current).toHaveProperty('setIsAuthenticated');
            expect(result.current).toHaveProperty('setIsConnecting');
        });
    });

    describe('setIsAuthenticated', () => {
        it('should update isAuthenticated to true', () => {
            const { result } = renderHook(() => useAuth());

            act(() => {
                result.current.setIsAuthenticated(true);
            });

            expect(result.current.isAuthenticated).toBe(true);
        });

        it('should update isAuthenticated to false', () => {
            const { result } = renderHook(() => useAuth());

            act(() => {
                result.current.setIsAuthenticated(true);
            });

            act(() => {
                result.current.setIsAuthenticated(false);
            });

            expect(result.current.isAuthenticated).toBe(false);
        });

        it('should allow multiple state changes', () => {
            const { result } = renderHook(() => useAuth());

            act(() => {
                result.current.setIsAuthenticated(true);
            });
            expect(result.current.isAuthenticated).toBe(true);

            act(() => {
                result.current.setIsAuthenticated(false);
            });
            expect(result.current.isAuthenticated).toBe(false);

            act(() => {
                result.current.setIsAuthenticated(true);
            });
            expect(result.current.isAuthenticated).toBe(true);
        });
    });

    describe('setIsConnecting', () => {
        it('should update isConnecting to true', () => {
            const { result } = renderHook(() => useAuth());

            act(() => {
                result.current.setIsConnecting(true);
            });

            expect(result.current.isConnecting).toBe(true);
        });

        it('should update isConnecting to false', () => {
            const { result } = renderHook(() => useAuth());

            act(() => {
                result.current.setIsConnecting(true);
            });

            act(() => {
                result.current.setIsConnecting(false);
            });

            expect(result.current.isConnecting).toBe(false);
        });

        it('should not affect isAuthenticated when changing isConnecting', () => {
            const { result } = renderHook(() => useAuth());

            act(() => {
                result.current.setIsAuthenticated(true);
                result.current.setIsConnecting(true);
            });

            expect(result.current.isAuthenticated).toBe(true);
            expect(result.current.isConnecting).toBe(true);

            act(() => {
                result.current.setIsConnecting(false);
            });

            expect(result.current.isAuthenticated).toBe(true);
            expect(result.current.isConnecting).toBe(false);
        });
    });

    describe('State Independence', () => {
        it('should manage both states independently', () => {
            const { result } = renderHook(() => useAuth());

            act(() => {
                result.current.setIsAuthenticated(true);
            });
            expect(result.current.isAuthenticated).toBe(true);
            expect(result.current.isConnecting).toBe(false);

            act(() => {
                result.current.setIsConnecting(true);
            });
            expect(result.current.isAuthenticated).toBe(true);
            expect(result.current.isConnecting).toBe(true);

            act(() => {
                result.current.setIsAuthenticated(false);
            });
            expect(result.current.isAuthenticated).toBe(false);
            expect(result.current.isConnecting).toBe(true);
        });
    });

    describe('Hook Stability', () => {
        it('should maintain setter function references across renders', () => {
            const { result, rerender } = renderHook(() => useAuth());

            const firstSetIsAuthenticated = result.current.setIsAuthenticated;
            const firstSetIsConnecting = result.current.setIsConnecting;

            rerender();

            expect(result.current.setIsAuthenticated).toBe(firstSetIsAuthenticated);
            expect(result.current.setIsConnecting).toBe(firstSetIsConnecting);
        });
    });
});
