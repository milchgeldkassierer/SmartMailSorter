import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GeneralTab from '../GeneralTab';

describe('GeneralTab', () => {
  let confirmSpy: ReturnType<typeof vi.spyOn>;
  let reloadMock: ReturnType<typeof vi.fn>;
  let mockElectron: { resetDb: ReturnType<typeof vi.fn> };
  let originalLocation: Location;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock window.confirm
    confirmSpy = vi.spyOn(window, 'confirm');

    // Mock window.location.reload
    reloadMock = vi.fn();
    originalLocation = window.location;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).location;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).location = { ...originalLocation, reload: reloadMock };

    // Mock window.electron (create fresh mock each time, after clearAllMocks)
    mockElectron = {
      resetDb: vi.fn().mockResolvedValue(undefined),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).electron = mockElectron;
  });

  afterEach(() => {
    confirmSpy.mockRestore();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).location = originalLocation;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).electron;
  });

  describe('Rendering', () => {
    it('should render the component title', () => {
      render(<GeneralTab />);
      expect(screen.getByText('Datenverwaltung')).toBeInTheDocument();
    });

    it('should render the reset button', () => {
      render(<GeneralTab />);
      const resetButton = screen.getByText('Datenbank komplett zurücksetzen & neu starten');
      expect(resetButton).toBeInTheDocument();
    });

    it('should render reset button with trash icon', () => {
      render(<GeneralTab />);
      const resetButton = screen.getByText('Datenbank komplett zurücksetzen & neu starten');
      const icon = resetButton.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should render title as h3 element', () => {
      render(<GeneralTab />);
      const title = screen.getByText('Datenverwaltung');
      expect(title.tagName).toBe('H3');
    });

    it('should render reset button with correct styling classes', () => {
      render(<GeneralTab />);
      const resetButton = screen.getByText('Datenbank komplett zurücksetzen & neu starten');
      expect(resetButton).toHaveClass('bg-red-50');
      expect(resetButton).toHaveClass('text-red-600');
      expect(resetButton).toHaveClass('border-red-200');
    });

    it('should render with center alignment', () => {
      const { container } = render(<GeneralTab />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('text-center');
    });
  });

  describe('Reset Button Interaction', () => {
    it('should show confirmation dialog when reset button is clicked', () => {
      confirmSpy.mockReturnValue(false);
      render(<GeneralTab />);

      const resetButton = screen.getByText('Datenbank komplett zurücksetzen & neu starten');
      fireEvent.click(resetButton);

      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(confirmSpy).toHaveBeenCalledWith('Achtung: Dies löscht alle gespeicherten Emails und Konten! Fortfahren?');
    });

    it('should not reset database when user cancels confirmation', async () => {
      confirmSpy.mockReturnValue(false);
      render(<GeneralTab />);

      const resetButton = screen.getByText('Datenbank komplett zurücksetzen & neu starten');
      fireEvent.click(resetButton);

      expect(mockElectron.resetDb).not.toHaveBeenCalled();
      expect(reloadMock).not.toHaveBeenCalled();
    });

    it('should call resetDb when user confirms', async () => {
      confirmSpy.mockReturnValue(true);
      render(<GeneralTab />);

      const resetButton = screen.getByText('Datenbank komplett zurücksetzen & neu starten');
      fireEvent.click(resetButton);

      // Wait for async operation
      await vi.waitFor(() => {
        expect(mockElectron.resetDb).toHaveBeenCalledTimes(1);
      });
    });

    it('should reload page after successful reset', async () => {
      confirmSpy.mockReturnValue(true);
      render(<GeneralTab />);

      const resetButton = screen.getByText('Datenbank komplett zurücksetzen & neu starten');
      fireEvent.click(resetButton);

      // Wait for async operation
      await vi.waitFor(() => {
        expect(mockElectron.resetDb).toHaveBeenCalledTimes(1);
        expect(reloadMock).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle case when electron is not available', async () => {
      confirmSpy.mockReturnValue(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).electron;
      render(<GeneralTab />);

      const resetButton = screen.getByText('Datenbank komplett zurücksetzen & neu starten');
      fireEvent.click(resetButton);

      // Should still reload even without electron
      await vi.waitFor(() => {
        expect(reloadMock).toHaveBeenCalledTimes(1);
      });
    });

    it('should call resetDb before reload', async () => {
      confirmSpy.mockReturnValue(true);
      const callOrder: string[] = [];

      mockElectron.resetDb.mockImplementation(async () => {
        callOrder.push('resetDb');
      });

      reloadMock.mockImplementation(() => {
        callOrder.push('reload');
      });

      render(<GeneralTab />);

      const resetButton = screen.getByText('Datenbank komplett zurücksetzen & neu starten');
      fireEvent.click(resetButton);

      await vi.waitFor(() => {
        expect(callOrder).toEqual(['resetDb', 'reload']);
      });
    });
  });

  describe('Electron API Integration', () => {
    it('should work in browser environment without electron', async () => {
      confirmSpy.mockReturnValue(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).electron;

      render(<GeneralTab />);

      const resetButton = screen.getByText('Datenbank komplett zurücksetzen & neu starten');
      fireEvent.click(resetButton);

      // Should only reload without calling electron API
      await vi.waitFor(() => {
        expect(reloadMock).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Button Behavior', () => {
    it('should be clickable', () => {
      render(<GeneralTab />);
      const resetButton = screen.getByText('Datenbank komplett zurücksetzen & neu starten');
      expect(resetButton).toBeEnabled();
    });

    it('should respond to multiple clicks correctly', async () => {
      confirmSpy.mockReturnValueOnce(false).mockReturnValueOnce(true);

      render(<GeneralTab />);
      const resetButton = screen.getByText('Datenbank komplett zurücksetzen & neu starten');

      // First click - user cancels
      fireEvent.click(resetButton);
      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(mockElectron.resetDb).not.toHaveBeenCalled();

      // Second click - user confirms
      fireEvent.click(resetButton);
      expect(confirmSpy).toHaveBeenCalledTimes(2);

      await vi.waitFor(() => {
        expect(mockElectron.resetDb).toHaveBeenCalledTimes(1);
      });
    });

    it('should maintain hover state classes', () => {
      render(<GeneralTab />);
      const resetButton = screen.getByText('Datenbank komplett zurücksetzen & neu starten');
      expect(resetButton).toHaveClass('hover:bg-red-100');
    });
  });

  describe('Accessibility', () => {
    it('should render button as button element', () => {
      render(<GeneralTab />);
      const resetButton = screen.getByText('Datenbank komplett zurücksetzen & neu starten');
      expect(resetButton.tagName).toBe('BUTTON');
    });

    it('should have proper text content for screen readers', () => {
      render(<GeneralTab />);
      const resetButton = screen.getByText('Datenbank komplett zurücksetzen & neu starten');
      expect(resetButton.textContent).toContain('Datenbank komplett zurücksetzen & neu starten');
    });

    it('should render with visible text', () => {
      render(<GeneralTab />);
      const title = screen.getByText('Datenverwaltung');
      expect(title).toBeVisible();
    });
  });
});
