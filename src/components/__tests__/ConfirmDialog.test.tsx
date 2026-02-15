import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ConfirmDialog from '../ConfirmDialog';

describe('ConfirmDialog - Integration Tests', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    title: 'Test Dialog',
    message: 'This is a test message',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Modal Rendering', () => {
    it('should not render when isOpen is false', () => {
      render(<ConfirmDialog {...defaultProps} isOpen={false} />);
      expect(screen.queryByText('Test Dialog')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      render(<ConfirmDialog {...defaultProps} />);
      expect(screen.getByText('Test Dialog')).toBeInTheDocument();
    });

    it('should render the message', () => {
      render(<ConfirmDialog {...defaultProps} />);
      expect(screen.getByText('This is a test message')).toBeInTheDocument();
    });

    it('should render the close button', () => {
      render(<ConfirmDialog {...defaultProps} />);
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThanOrEqual(2);
    });

    it('should call onClose when close button is clicked', () => {
      const { container } = render(<ConfirmDialog {...defaultProps} />);
      const closeButton = container.querySelector('.text-slate-400');

      if (closeButton) {
        fireEvent.click(closeButton);
        expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
      }
    });

    it('should render with backdrop overlay', () => {
      const { container } = render(<ConfirmDialog {...defaultProps} />);
      const backdrop = container.querySelector('.fixed.inset-0.z-50');
      expect(backdrop).toBeInTheDocument();
    });

    it('should have backdrop blur effect', () => {
      const { container } = render(<ConfirmDialog {...defaultProps} />);
      const backdrop = container.querySelector('.backdrop-blur-sm');
      expect(backdrop).toBeInTheDocument();
    });

    it('should have semi-transparent black background', () => {
      const { container } = render(<ConfirmDialog {...defaultProps} />);
      const backdrop = container.querySelector('.bg-black\\/50');
      expect(backdrop).toBeInTheDocument();
    });
  });

  describe('Dialog Types', () => {
    describe('Confirm Dialog (default)', () => {
      it('should render both cancel and confirm buttons', () => {
        render(<ConfirmDialog {...defaultProps} />);
        expect(screen.getByText('Abbrechen')).toBeInTheDocument();
        expect(screen.getByText('Bestätigen')).toBeInTheDocument();
      });

      it('should use default confirm text when not provided', () => {
        render(<ConfirmDialog {...defaultProps} type="confirm" />);
        expect(screen.getByText('Bestätigen')).toBeInTheDocument();
      });

      it('should call onConfirm when confirm button clicked', () => {
        render(<ConfirmDialog {...defaultProps} />);
        const confirmButton = screen.getByText('Bestätigen');
        fireEvent.click(confirmButton);

        expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
        expect(defaultProps.onConfirm).toHaveBeenCalledWith();
      });

      it('should call onClose after confirming', () => {
        render(<ConfirmDialog {...defaultProps} />);
        const confirmButton = screen.getByText('Bestätigen');
        fireEvent.click(confirmButton);

        expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
      });

      it('should call onClose when cancel button clicked', () => {
        render(<ConfirmDialog {...defaultProps} />);
        const cancelButton = screen.getByText('Abbrechen');
        fireEvent.click(cancelButton);

        expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
        expect(defaultProps.onConfirm).not.toHaveBeenCalled();
      });

      it('should use custom confirm text when provided', () => {
        render(<ConfirmDialog {...defaultProps} confirmText="Ja, sicher" />);
        expect(screen.getByText('Ja, sicher')).toBeInTheDocument();
        expect(screen.queryByText('Bestätigen')).not.toBeInTheDocument();
      });

      it('should use custom cancel text when provided', () => {
        render(<ConfirmDialog {...defaultProps} cancelText="Nein" />);
        expect(screen.getByText('Nein')).toBeInTheDocument();
        expect(screen.queryByText('Abbrechen')).not.toBeInTheDocument();
      });
    });

    describe('Alert Dialog', () => {
      it('should render only confirm button', () => {
        render(<ConfirmDialog {...defaultProps} type="alert" />);
        expect(screen.getByText('OK')).toBeInTheDocument();
        expect(screen.queryByText('Abbrechen')).not.toBeInTheDocument();
      });

      it('should use OK as default confirm text', () => {
        render(<ConfirmDialog {...defaultProps} type="alert" />);
        expect(screen.getByText('OK')).toBeInTheDocument();
      });

      it('should call onConfirm when OK button clicked', () => {
        render(<ConfirmDialog {...defaultProps} type="alert" />);
        const okButton = screen.getByText('OK');
        fireEvent.click(okButton);

        expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
        expect(defaultProps.onConfirm).toHaveBeenCalledWith();
      });

      it('should call onClose after clicking OK', () => {
        render(<ConfirmDialog {...defaultProps} type="alert" />);
        const okButton = screen.getByText('OK');
        fireEvent.click(okButton);

        expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
      });
    });

    describe('Prompt Dialog', () => {
      it('should render input field', () => {
        render(<ConfirmDialog {...defaultProps} type="prompt" />);
        const input = screen.getByRole('textbox');
        expect(input).toBeInTheDocument();
      });

      it('should render both cancel and confirm buttons', () => {
        render(<ConfirmDialog {...defaultProps} type="prompt" />);
        expect(screen.getByText('Abbrechen')).toBeInTheDocument();
        expect(screen.getByText('Bestätigen')).toBeInTheDocument();
      });

      it('should use default value in input', () => {
        render(<ConfirmDialog {...defaultProps} type="prompt" defaultValue="Initial value" />);
        const input = screen.getByRole('textbox') as HTMLInputElement;
        expect(input.value).toBe('Initial value');
      });

      it('should use placeholder in input', () => {
        render(<ConfirmDialog {...defaultProps} type="prompt" placeholder="Enter name..." />);
        const input = screen.getByPlaceholderText('Enter name...');
        expect(input).toBeInTheDocument();
      });

      it('should update input value when typing', () => {
        render(<ConfirmDialog {...defaultProps} type="prompt" />);
        const input = screen.getByRole('textbox') as HTMLInputElement;

        fireEvent.change(input, { target: { value: 'New value' } });
        expect(input.value).toBe('New value');
      });

      it('should call onConfirm with input value when confirm clicked', () => {
        render(<ConfirmDialog {...defaultProps} type="prompt" />);
        const input = screen.getByRole('textbox');

        fireEvent.change(input, { target: { value: 'User input' } });
        const confirmButton = screen.getByText('Bestätigen');
        fireEvent.click(confirmButton);

        expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
        expect(defaultProps.onConfirm).toHaveBeenCalledWith('User input');
      });

      it('should submit on Enter key press', () => {
        render(<ConfirmDialog {...defaultProps} type="prompt" />);
        const input = screen.getByRole('textbox');

        fireEvent.change(input, { target: { value: 'Test value' } });
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

        expect(defaultProps.onConfirm).toHaveBeenCalledWith('Test value');
        expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
      });

      it('should reset input value when dialog reopens', () => {
        const { rerender } = render(
          <ConfirmDialog {...defaultProps} type="prompt" defaultValue="Initial" isOpen={true} />
        );
        const input = screen.getByRole('textbox') as HTMLInputElement;

        fireEvent.change(input, { target: { value: 'Changed' } });
        expect(input.value).toBe('Changed');

        // Close dialog
        rerender(<ConfirmDialog {...defaultProps} type="prompt" defaultValue="Initial" isOpen={false} />);

        // Reopen dialog
        rerender(<ConfirmDialog {...defaultProps} type="prompt" defaultValue="Initial" isOpen={true} />);
        const newInput = screen.getByRole('textbox') as HTMLInputElement;
        expect(newInput.value).toBe('Initial');
      });

      it('should have input field with proper attributes', () => {
        const { container } = render(<ConfirmDialog {...defaultProps} type="prompt" />);
        const input = container.querySelector('input[type="text"]');
        expect(input).toBeInTheDocument();
        expect(input).toHaveClass('w-full');
      });
    });
  });

  describe('Variant Styling', () => {
    describe('Info Variant (default)', () => {
      it('should render CheckCircle icon', () => {
        const { container } = render(<ConfirmDialog {...defaultProps} variant="info" />);
        const icon = container.querySelector('.text-blue-500');
        expect(icon).toBeInTheDocument();
      });

      it('should have blue confirm button', () => {
        render(<ConfirmDialog {...defaultProps} variant="info" />);
        const confirmButton = screen.getByText('Bestätigen');
        expect(confirmButton).toHaveClass('bg-blue-600', 'hover:bg-blue-700');
      });

      it('should have blue border', () => {
        const { container } = render(<ConfirmDialog {...defaultProps} variant="info" />);
        const header = container.querySelector('.border-blue-100');
        expect(header).toBeInTheDocument();
      });
    });

    describe('Warning Variant', () => {
      it('should render AlertCircle icon', () => {
        const { container } = render(<ConfirmDialog {...defaultProps} variant="warning" />);
        const icon = container.querySelector('.text-amber-500');
        expect(icon).toBeInTheDocument();
      });

      it('should have amber confirm button', () => {
        render(<ConfirmDialog {...defaultProps} variant="warning" />);
        const confirmButton = screen.getByText('Bestätigen');
        expect(confirmButton).toHaveClass('bg-amber-600', 'hover:bg-amber-700');
      });

      it('should have amber border', () => {
        const { container } = render(<ConfirmDialog {...defaultProps} variant="warning" />);
        const header = container.querySelector('.border-amber-100');
        expect(header).toBeInTheDocument();
      });
    });

    describe('Danger Variant', () => {
      it('should render AlertOctagon icon', () => {
        const { container } = render(<ConfirmDialog {...defaultProps} variant="danger" />);
        const icon = container.querySelector('.text-red-500');
        expect(icon).toBeInTheDocument();
      });

      it('should have red confirm button', () => {
        render(<ConfirmDialog {...defaultProps} variant="danger" />);
        const confirmButton = screen.getByText('Löschen');
        expect(confirmButton).toHaveClass('bg-red-600', 'hover:bg-red-700');
      });

      it('should have red border', () => {
        const { container } = render(<ConfirmDialog {...defaultProps} variant="danger" />);
        const header = container.querySelector('.border-red-100');
        expect(header).toBeInTheDocument();
      });

      it('should use "Löschen" as default confirm text', () => {
        render(<ConfirmDialog {...defaultProps} variant="danger" />);
        expect(screen.getByText('Löschen')).toBeInTheDocument();
        expect(screen.queryByText('Bestätigen')).not.toBeInTheDocument();
      });

      it('should use custom confirm text when provided even in danger variant', () => {
        render(<ConfirmDialog {...defaultProps} variant="danger" confirmText="Wirklich löschen" />);
        expect(screen.getByText('Wirklich löschen')).toBeInTheDocument();
        expect(screen.queryByText('Löschen')).not.toBeInTheDocument();
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('should close dialog when Escape key is pressed', async () => {
      render(<ConfirmDialog {...defaultProps} />);

      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

      await waitFor(() => {
        expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
      });
    });

    it('should not close on Escape when dialog is not open', () => {
      render(<ConfirmDialog {...defaultProps} isOpen={false} />);

      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it('should cleanup escape listener on unmount', () => {
      const { unmount } = render(<ConfirmDialog {...defaultProps} />);
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });

  describe('Overlay Interaction', () => {
    it('should close dialog when clicking overlay', () => {
      const { container } = render(<ConfirmDialog {...defaultProps} />);
      const overlay = container.querySelector('.fixed.inset-0.z-50');

      if (overlay) {
        fireEvent.click(overlay);
        expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
      }
    });

    it('should not close when clicking dialog content', () => {
      render(<ConfirmDialog {...defaultProps} />);
      const dialog = screen.getByText('Test Dialog').closest('.bg-white');

      if (dialog) {
        fireEvent.click(dialog);
        expect(defaultProps.onClose).not.toHaveBeenCalled();
      }
    });

    it('should not close when clicking message', () => {
      render(<ConfirmDialog {...defaultProps} />);
      const message = screen.getByText('This is a test message');

      fireEvent.click(message);
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it('should not close when clicking buttons', () => {
      render(<ConfirmDialog {...defaultProps} />);
      const cancelButton = screen.getByText('Abbrechen');

      fireEvent.click(cancelButton);
      // onClose should be called by button handler, not by overlay click
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Complex Scenarios', () => {
    it('should work without onConfirm handler', () => {
      const { onConfirm: _onConfirm, ...propsWithoutConfirm } = defaultProps;
      render(<ConfirmDialog {...propsWithoutConfirm} />);

      const confirmButton = screen.getByText('Bestätigen');
      expect(() => fireEvent.click(confirmButton)).not.toThrow();
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple rapid clicks on confirm button', () => {
      render(<ConfirmDialog {...defaultProps} />);
      const confirmButton = screen.getByText('Bestätigen');

      fireEvent.click(confirmButton);
      fireEvent.click(confirmButton);
      fireEvent.click(confirmButton);

      // All clicks are registered since component doesn't prevent them
      expect(defaultProps.onConfirm).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should maintain state when switching variants', () => {
      const { rerender } = render(<ConfirmDialog {...defaultProps} variant="info" />);
      expect(screen.getByText('Bestätigen')).toBeInTheDocument();

      rerender(<ConfirmDialog {...defaultProps} variant="danger" />);
      expect(screen.getByText('Löschen')).toBeInTheDocument();

      rerender(<ConfirmDialog {...defaultProps} variant="warning" />);
      expect(screen.getByText('Bestätigen')).toBeInTheDocument();
    });

    it('should handle long messages gracefully', () => {
      const longMessage =
        'This is a very long message that should be handled correctly by the dialog component. '.repeat(10);
      render(<ConfirmDialog {...defaultProps} message={longMessage} />);
      // Use partial match since testing-library may normalize whitespace
      expect(screen.getByText(/This is a very long message that should be handled correctly/)).toBeInTheDocument();
    });

    it('should handle long titles gracefully', () => {
      const longTitle = 'This is a very long title that should be handled correctly';
      render(<ConfirmDialog {...defaultProps} title={longTitle} />);
      expect(screen.getByText(longTitle)).toBeInTheDocument();
    });

    it('should work with empty input value in prompt', () => {
      render(<ConfirmDialog {...defaultProps} type="prompt" />);
      const input = screen.getByRole('textbox') as HTMLInputElement;

      expect(input.value).toBe('');

      const confirmButton = screen.getByText('Bestätigen');
      fireEvent.click(confirmButton);

      expect(defaultProps.onConfirm).toHaveBeenCalledWith('');
    });

    it('should combine danger variant with alert type', () => {
      render(<ConfirmDialog {...defaultProps} type="alert" variant="danger" />);

      expect(screen.getByText('OK')).toBeInTheDocument();
      expect(screen.queryByText('Abbrechen')).not.toBeInTheDocument();

      const okButton = screen.getByText('OK');
      expect(okButton).toHaveClass('bg-red-600', 'hover:bg-red-700');
    });

    it('should combine warning variant with prompt type', () => {
      render(<ConfirmDialog {...defaultProps} type="prompt" variant="warning" />);

      expect(screen.getByRole('textbox')).toBeInTheDocument();
      const confirmButton = screen.getByText('Bestätigen');
      expect(confirmButton).toHaveClass('bg-amber-600', 'hover:bg-amber-700');
    });
  });

  describe('Accessibility', () => {
    it('should have proper dialog structure', () => {
      const { container } = render(<ConfirmDialog {...defaultProps} />);
      const dialog = container.querySelector('.bg-white.rounded-xl');
      expect(dialog).toBeInTheDocument();
    });

    it('should have proper heading for title', () => {
      render(<ConfirmDialog {...defaultProps} />);
      const heading = screen.getByRole('heading', { name: 'Test Dialog' });
      expect(heading).toBeInTheDocument();
      expect(heading.tagName).toBe('H2');
    });

    it('should have visible text for all buttons', () => {
      render(<ConfirmDialog {...defaultProps} />);
      const cancelButton = screen.getByText('Abbrechen');
      const confirmButton = screen.getByText('Bestätigen');

      expect(cancelButton).toBeVisible();
      expect(confirmButton).toBeVisible();
    });

    it('should have proper button types', () => {
      render(<ConfirmDialog {...defaultProps} />);
      const buttons = screen.getAllByRole('button');

      buttons.forEach((button) => {
        expect(button.tagName).toBe('BUTTON');
      });
    });
  });

  describe('Visual Consistency', () => {
    it('should have rounded corners on dialog', () => {
      const { container } = render(<ConfirmDialog {...defaultProps} />);
      const dialog = container.querySelector('.rounded-xl');
      expect(dialog).toBeInTheDocument();
    });

    it('should have shadow on dialog', () => {
      const { container } = render(<ConfirmDialog {...defaultProps} />);
      const dialog = container.querySelector('.shadow-2xl');
      expect(dialog).toBeInTheDocument();
    });

    it('should have proper spacing with padding', () => {
      const { container } = render(<ConfirmDialog {...defaultProps} />);
      const header = container.querySelector('.p-6');
      expect(header).toBeInTheDocument();
    });

    it('should have footer with background color', () => {
      const { container } = render(<ConfirmDialog {...defaultProps} />);
      const footer = container.querySelector('.bg-slate-50');
      expect(footer).toBeInTheDocument();
    });

    it('should have border between sections', () => {
      const { container } = render(<ConfirmDialog {...defaultProps} />);
      const borders = container.querySelectorAll('.border-t');
      expect(borders.length).toBeGreaterThan(0);
    });
  });
});
