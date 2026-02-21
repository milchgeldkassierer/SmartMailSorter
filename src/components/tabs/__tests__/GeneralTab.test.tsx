import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GeneralTab from '../GeneralTab';
import { DialogProvider } from '../../../contexts/DialogContext';

// Helper to render with DialogProvider
const renderWithDialog = (ui: React.ReactElement) => render(<DialogProvider>{ui}</DialogProvider>);

describe('GeneralTab', () => {
  let reloadMock: ReturnType<typeof vi.fn>;
  let mockElectron: { resetDb: ReturnType<typeof vi.fn> };
  let originalLocation: Location;

  beforeEach(() => {
    vi.clearAllMocks();

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).location = originalLocation;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).electron;
  });

  describe('Rendering', () => {
    it('should render the component title', () => {
      renderWithDialog(<GeneralTab />);
      expect(screen.getByText('Datenverwaltung')).toBeInTheDocument();
    });

    it('should render the reset button', () => {
      renderWithDialog(<GeneralTab />);
      const resetButton = screen.getByText('Datenbank komplett zurücksetzen & neu starten');
      expect(resetButton).toBeInTheDocument();
    });

    it('should render reset button with trash icon', () => {
      renderWithDialog(<GeneralTab />);
      const resetButton = screen.getByText('Datenbank komplett zurücksetzen & neu starten');
      const icon = resetButton.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should render title as h3 element', () => {
      renderWithDialog(<GeneralTab />);
      const title = screen.getByText('Datenverwaltung');
      expect(title.tagName).toBe('H3');
    });

    it('should render reset button with correct styling classes', () => {
      renderWithDialog(<GeneralTab />);
      const resetButton = screen.getByText('Datenbank komplett zurücksetzen & neu starten');
      expect(resetButton).toHaveClass('bg-red-50');
      expect(resetButton).toHaveClass('text-red-600');
      expect(resetButton).toHaveClass('border-red-200');
    });

    it('should render with proper layout spacing', () => {
      const { container } = renderWithDialog(<GeneralTab />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('space-y-6');
    });
  });

  describe('Reset Button Interaction', () => {
    it('should show confirmation dialog when reset button is clicked', async () => {
      renderWithDialog(<GeneralTab />);

      const resetButton = screen.getByText('Datenbank komplett zurücksetzen & neu starten');
      fireEvent.click(resetButton);

      // Dialog should be visible
      await waitFor(() => {
        expect(screen.getByText('Datenbank zurücksetzen')).toBeInTheDocument();
        expect(
          screen.getByText('Achtung: Dies löscht alle gespeicherten Emails und Konten! Fortfahren?')
        ).toBeInTheDocument();
      });
    });

    it('should not reset database when user cancels confirmation', async () => {
      renderWithDialog(<GeneralTab />);

      const resetButton = screen.getByText('Datenbank komplett zurücksetzen & neu starten');
      fireEvent.click(resetButton);

      // Wait for dialog to appear
      await waitFor(() => {
        expect(screen.getByText('Datenbank zurücksetzen')).toBeInTheDocument();
      });

      // Click cancel button
      const cancelButton = screen.getByText('Abbrechen');
      fireEvent.click(cancelButton);

      // Wait for dialog to close
      await waitFor(() => {
        expect(screen.queryByText('Datenbank zurücksetzen')).not.toBeInTheDocument();
      });

      expect(mockElectron.resetDb).not.toHaveBeenCalled();
      expect(reloadMock).not.toHaveBeenCalled();
    });

    it('should call resetDb when user confirms', async () => {
      renderWithDialog(<GeneralTab />);

      const resetButton = screen.getByText('Datenbank komplett zurücksetzen & neu starten');
      fireEvent.click(resetButton);

      // Wait for dialog to appear
      await waitFor(() => {
        expect(screen.getByText('Datenbank zurücksetzen')).toBeInTheDocument();
      });

      // Click confirm button
      const confirmButton = screen.getByText('Zurücksetzen');
      fireEvent.click(confirmButton);

      // Wait for async operation
      await waitFor(() => {
        expect(mockElectron.resetDb).toHaveBeenCalledTimes(1);
      });
    });

    it('should reload page after successful reset', async () => {
      renderWithDialog(<GeneralTab />);

      const resetButton = screen.getByText('Datenbank komplett zurücksetzen & neu starten');
      fireEvent.click(resetButton);

      // Wait for dialog to appear
      await waitFor(() => {
        expect(screen.getByText('Datenbank zurücksetzen')).toBeInTheDocument();
      });

      // Click confirm button
      const confirmButton = screen.getByText('Zurücksetzen');
      fireEvent.click(confirmButton);

      // Wait for async operation
      await waitFor(() => {
        expect(mockElectron.resetDb).toHaveBeenCalledTimes(1);
        expect(reloadMock).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle case when electron is not available', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).electron;
      renderWithDialog(<GeneralTab />);

      const resetButton = screen.getByText('Datenbank komplett zurücksetzen & neu starten');
      fireEvent.click(resetButton);

      // Wait for dialog to appear
      await waitFor(() => {
        expect(screen.getByText('Datenbank zurücksetzen')).toBeInTheDocument();
      });

      // Click confirm button
      const confirmButton = screen.getByText('Zurücksetzen');
      fireEvent.click(confirmButton);

      // Should still reload even without electron
      await waitFor(() => {
        expect(reloadMock).toHaveBeenCalledTimes(1);
      });
    });

    it('should call resetDb before reload', async () => {
      const callOrder: string[] = [];

      mockElectron.resetDb.mockImplementation(async () => {
        callOrder.push('resetDb');
      });

      reloadMock.mockImplementation(() => {
        callOrder.push('reload');
      });

      renderWithDialog(<GeneralTab />);

      const resetButton = screen.getByText('Datenbank komplett zurücksetzen & neu starten');
      fireEvent.click(resetButton);

      // Wait for dialog to appear
      await waitFor(() => {
        expect(screen.getByText('Datenbank zurücksetzen')).toBeInTheDocument();
      });

      // Click confirm button
      const confirmButton = screen.getByText('Zurücksetzen');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(callOrder).toEqual(['resetDb', 'reload']);
      });
    });
  });

  describe('Electron API Integration', () => {
    it('should work in browser environment without electron', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).electron;

      renderWithDialog(<GeneralTab />);

      const resetButton = screen.getByText('Datenbank komplett zurücksetzen & neu starten');
      fireEvent.click(resetButton);

      // Wait for dialog to appear
      await waitFor(() => {
        expect(screen.getByText('Datenbank zurücksetzen')).toBeInTheDocument();
      });

      // Click confirm button
      const confirmButton = screen.getByText('Zurücksetzen');
      fireEvent.click(confirmButton);

      // Should only reload without calling electron API
      await waitFor(() => {
        expect(reloadMock).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Button Behavior', () => {
    it('should be clickable', () => {
      renderWithDialog(<GeneralTab />);
      const resetButton = screen.getByText('Datenbank komplett zurücksetzen & neu starten');
      expect(resetButton).toBeEnabled();
    });

    it('should respond to multiple clicks correctly', async () => {
      renderWithDialog(<GeneralTab />);
      const resetButton = screen.getByText('Datenbank komplett zurücksetzen & neu starten');

      // First click - user cancels
      fireEvent.click(resetButton);

      // Wait for dialog to appear
      await waitFor(() => {
        expect(screen.getByText('Datenbank zurücksetzen')).toBeInTheDocument();
      });

      // Click cancel button
      const cancelButton = screen.getByText('Abbrechen');
      fireEvent.click(cancelButton);

      expect(mockElectron.resetDb).not.toHaveBeenCalled();

      // Second click - user confirms
      fireEvent.click(resetButton);

      // Wait for dialog to appear again
      await waitFor(() => {
        expect(screen.getByText('Datenbank zurücksetzen')).toBeInTheDocument();
      });

      // Click confirm button
      const confirmButton = screen.getByText('Zurücksetzen');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockElectron.resetDb).toHaveBeenCalledTimes(1);
      });
    });

    it('should maintain hover state classes', () => {
      renderWithDialog(<GeneralTab />);
      const resetButton = screen.getByText('Datenbank komplett zurücksetzen & neu starten');
      expect(resetButton).toHaveClass('hover:bg-red-100');
    });
  });

  describe('Accessibility', () => {
    it('should render button as button element', () => {
      renderWithDialog(<GeneralTab />);
      const resetButton = screen.getByText('Datenbank komplett zurücksetzen & neu starten');
      expect(resetButton.tagName).toBe('BUTTON');
    });

    it('should have proper text content for screen readers', () => {
      renderWithDialog(<GeneralTab />);
      const resetButton = screen.getByText('Datenbank komplett zurücksetzen & neu starten');
      expect(resetButton.textContent).toContain('Datenbank komplett zurücksetzen & neu starten');
    });

    it('should render with visible text', () => {
      renderWithDialog(<GeneralTab />);
      const title = screen.getByText('Datenverwaltung');
      expect(title).toBeVisible();
    });
  });
});
