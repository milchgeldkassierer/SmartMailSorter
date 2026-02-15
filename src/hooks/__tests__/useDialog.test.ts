import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDialog } from '../useDialog';

describe('useDialog', () => {
  beforeEach(() => {
    // Reset any state if needed
  });

  describe('Initial State', () => {
    it('should initialize with correct default values', () => {
      const { result } = renderHook(() => useDialog());

      expect(result.current.isOpen).toBe(false);
      expect(result.current.dialogState).toEqual({
        isOpen: false,
        title: '',
        message: '',
        type: 'confirm',
        variant: 'info',
      });
    });

    it('should return all required properties', () => {
      const { result } = renderHook(() => useDialog());

      expect(result.current).toHaveProperty('isOpen');
      expect(result.current).toHaveProperty('dialogState');
      expect(result.current).toHaveProperty('openDialog');
      expect(result.current).toHaveProperty('closeDialog');
      expect(result.current).toHaveProperty('confirm');
      expect(result.current).toHaveProperty('alert');
      expect(result.current).toHaveProperty('prompt');
      expect(result.current).toHaveProperty('handleConfirm');
      expect(result.current).toHaveProperty('handleClose');
    });

    it('should return functions for all methods', () => {
      const { result } = renderHook(() => useDialog());

      expect(typeof result.current.openDialog).toBe('function');
      expect(typeof result.current.closeDialog).toBe('function');
      expect(typeof result.current.confirm).toBe('function');
      expect(typeof result.current.alert).toBe('function');
      expect(typeof result.current.prompt).toBe('function');
      expect(typeof result.current.handleConfirm).toBe('function');
      expect(typeof result.current.handleClose).toBe('function');
    });
  });

  describe('openDialog', () => {
    it('should open dialog with provided config', () => {
      const { result } = renderHook(() => useDialog());

      act(() => {
        result.current.openDialog({
          title: 'Test Title',
          message: 'Test Message',
          type: 'confirm',
          variant: 'warning',
        });
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.dialogState).toEqual({
        isOpen: true,
        title: 'Test Title',
        message: 'Test Message',
        type: 'confirm',
        variant: 'warning',
        confirmText: undefined,
        cancelText: undefined,
        defaultValue: undefined,
        placeholder: undefined,
      });
    });

    it('should use default type and variant when not provided', () => {
      const { result } = renderHook(() => useDialog());

      act(() => {
        result.current.openDialog({
          title: 'Test',
          message: 'Message',
        });
      });

      expect(result.current.dialogState.type).toBe('confirm');
      expect(result.current.dialogState.variant).toBe('info');
    });

    it('should accept custom button text', () => {
      const { result } = renderHook(() => useDialog());

      act(() => {
        result.current.openDialog({
          title: 'Delete',
          message: 'Are you sure?',
          confirmText: 'Yes, delete',
          cancelText: 'No, keep it',
        });
      });

      expect(result.current.dialogState.confirmText).toBe('Yes, delete');
      expect(result.current.dialogState.cancelText).toBe('No, keep it');
    });

    it('should accept default value and placeholder for prompts', () => {
      const { result } = renderHook(() => useDialog());

      act(() => {
        result.current.openDialog({
          title: 'Enter Name',
          message: 'Please provide your name',
          type: 'prompt',
          defaultValue: 'John Doe',
          placeholder: 'Enter your name',
        });
      });

      expect(result.current.dialogState.defaultValue).toBe('John Doe');
      expect(result.current.dialogState.placeholder).toBe('Enter your name');
    });

    it('should support all dialog types', () => {
      const { result } = renderHook(() => useDialog());

      act(() => {
        result.current.openDialog({
          title: 'Alert',
          message: 'This is an alert',
          type: 'alert',
        });
      });
      expect(result.current.dialogState.type).toBe('alert');

      act(() => {
        result.current.openDialog({
          title: 'Confirm',
          message: 'Confirm this',
          type: 'confirm',
        });
      });
      expect(result.current.dialogState.type).toBe('confirm');

      act(() => {
        result.current.openDialog({
          title: 'Prompt',
          message: 'Enter value',
          type: 'prompt',
        });
      });
      expect(result.current.dialogState.type).toBe('prompt');
    });

    it('should support all dialog variants', () => {
      const { result } = renderHook(() => useDialog());

      act(() => {
        result.current.openDialog({
          title: 'Info',
          message: 'Info message',
          variant: 'info',
        });
      });
      expect(result.current.dialogState.variant).toBe('info');

      act(() => {
        result.current.openDialog({
          title: 'Warning',
          message: 'Warning message',
          variant: 'warning',
        });
      });
      expect(result.current.dialogState.variant).toBe('warning');

      act(() => {
        result.current.openDialog({
          title: 'Danger',
          message: 'Danger message',
          variant: 'danger',
        });
      });
      expect(result.current.dialogState.variant).toBe('danger');
    });
  });

  describe('closeDialog', () => {
    it('should close the dialog', () => {
      const { result } = renderHook(() => useDialog());

      act(() => {
        result.current.openDialog({
          title: 'Test',
          message: 'Message',
        });
      });
      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.closeDialog();
      });
      expect(result.current.isOpen).toBe(false);
    });

    it('should preserve other state when closing', () => {
      const { result } = renderHook(() => useDialog());

      act(() => {
        result.current.openDialog({
          title: 'Test Title',
          message: 'Test Message',
          variant: 'warning',
        });
      });

      act(() => {
        result.current.closeDialog();
      });

      expect(result.current.isOpen).toBe(false);
      expect(result.current.dialogState.title).toBe('Test Title');
      expect(result.current.dialogState.message).toBe('Test Message');
      expect(result.current.dialogState.variant).toBe('warning');
    });
  });

  describe('confirm', () => {
    it('should open a confirm dialog and resolve to true on confirm', async () => {
      const { result } = renderHook(() => useDialog());

      let resolvedValue: boolean | undefined;
      act(() => {
        result.current
          .confirm({
            title: 'Confirm Action',
            message: 'Are you sure?',
            variant: 'warning',
          })
          .then((value) => {
            resolvedValue = value;
          });
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.dialogState.type).toBe('confirm');
      expect(result.current.dialogState.title).toBe('Confirm Action');
      expect(result.current.dialogState.message).toBe('Are you sure?');

      act(() => {
        result.current.handleConfirm();
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(resolvedValue).toBe(true);
      expect(result.current.isOpen).toBe(false);
    });

    it('should resolve to false when dialog is closed without confirmation', async () => {
      const { result } = renderHook(() => useDialog());

      let resolvedValue: boolean | undefined;
      act(() => {
        result.current
          .confirm({
            title: 'Confirm',
            message: 'Proceed?',
          })
          .then((value) => {
            resolvedValue = value;
          });
      });

      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.closeDialog();
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(resolvedValue).toBe(false);
      expect(result.current.isOpen).toBe(false);
    });

    it('should resolve to false when handleClose is called', async () => {
      const { result } = renderHook(() => useDialog());

      let resolvedValue: boolean | undefined;
      act(() => {
        result.current
          .confirm({
            title: 'Confirm',
            message: 'Proceed?',
          })
          .then((value) => {
            resolvedValue = value;
          });
      });

      act(() => {
        result.current.handleClose();
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(resolvedValue).toBe(false);
      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('alert', () => {
    it('should open an alert dialog and resolve on confirm', async () => {
      const { result } = renderHook(() => useDialog());

      let resolved = false;
      act(() => {
        result.current
          .alert({
            title: 'Alert',
            message: 'Important message',
            variant: 'info',
          })
          .then(() => {
            resolved = true;
          });
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.dialogState.type).toBe('alert');
      expect(result.current.dialogState.title).toBe('Alert');
      expect(result.current.dialogState.message).toBe('Important message');

      act(() => {
        result.current.handleConfirm();
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(resolved).toBe(true);
      expect(result.current.isOpen).toBe(false);
    });

    it('should resolve when dialog is closed', async () => {
      const { result } = renderHook(() => useDialog());

      let resolved = false;
      act(() => {
        result.current
          .alert({
            title: 'Alert',
            message: 'Message',
          })
          .then(() => {
            resolved = true;
          });
      });

      act(() => {
        result.current.closeDialog();
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(resolved).toBe(true);
      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('prompt', () => {
    it('should open a prompt dialog and resolve with input value', async () => {
      const { result } = renderHook(() => useDialog());

      let resolvedValue: string | null | undefined;
      act(() => {
        result.current
          .prompt({
            title: 'Enter Name',
            message: 'Please enter your name',
            defaultValue: 'John',
            placeholder: 'Your name',
          })
          .then((value) => {
            resolvedValue = value;
          });
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.dialogState.type).toBe('prompt');
      expect(result.current.dialogState.title).toBe('Enter Name');
      expect(result.current.dialogState.defaultValue).toBe('John');
      expect(result.current.dialogState.placeholder).toBe('Your name');

      act(() => {
        result.current.handleConfirm('Jane Doe');
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(resolvedValue).toBe('Jane Doe');
      expect(result.current.isOpen).toBe(false);
    });

    it('should resolve to null when dialog is closed without input', async () => {
      const { result } = renderHook(() => useDialog());

      let resolvedValue: string | null | undefined;
      act(() => {
        result.current
          .prompt({
            title: 'Enter Value',
            message: 'Enter something',
          })
          .then((value) => {
            resolvedValue = value;
          });
      });

      act(() => {
        result.current.closeDialog();
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(resolvedValue).toBe(null);
      expect(result.current.isOpen).toBe(false);
    });

    it('should resolve to null when handleConfirm is called with empty value', async () => {
      const { result } = renderHook(() => useDialog());

      let resolvedValue: string | null | undefined;
      act(() => {
        result.current
          .prompt({
            title: 'Enter Value',
            message: 'Enter something',
          })
          .then((value) => {
            resolvedValue = value;
          });
      });

      act(() => {
        result.current.handleConfirm('');
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(resolvedValue).toBe(null);
      expect(result.current.isOpen).toBe(false);
    });

    it('should resolve to null when handleConfirm is called without value', async () => {
      const { result } = renderHook(() => useDialog());

      let resolvedValue: string | null | undefined;
      act(() => {
        result.current
          .prompt({
            title: 'Enter Value',
            message: 'Enter something',
          })
          .then((value) => {
            resolvedValue = value;
          });
      });

      act(() => {
        result.current.handleConfirm();
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(resolvedValue).toBe(null);
      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('handleConfirm', () => {
    it('should close dialog when called', () => {
      const { result } = renderHook(() => useDialog());

      act(() => {
        result.current.openDialog({
          title: 'Test',
          message: 'Message',
        });
      });
      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.handleConfirm();
      });
      expect(result.current.isOpen).toBe(false);
    });

    it('should work when called without active promise', () => {
      const { result } = renderHook(() => useDialog());

      act(() => {
        result.current.openDialog({
          title: 'Test',
          message: 'Message',
        });
      });

      expect(() => {
        act(() => {
          result.current.handleConfirm();
        });
      }).not.toThrow();

      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('handleClose', () => {
    it('should close dialog when called', () => {
      const { result } = renderHook(() => useDialog());

      act(() => {
        result.current.openDialog({
          title: 'Test',
          message: 'Message',
        });
      });
      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.handleClose();
      });
      expect(result.current.isOpen).toBe(false);
    });

    it('should work when called without active promise', () => {
      const { result } = renderHook(() => useDialog());

      act(() => {
        result.current.openDialog({
          title: 'Test',
          message: 'Message',
        });
      });

      expect(() => {
        act(() => {
          result.current.handleClose();
        });
      }).not.toThrow();

      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('Multiple Sequential Dialogs', () => {
    it('should handle multiple confirm dialogs in sequence', async () => {
      const { result } = renderHook(() => useDialog());

      let firstValue: boolean | undefined;
      let secondValue: boolean | undefined;

      act(() => {
        result.current
          .confirm({
            title: 'First',
            message: 'First confirm',
          })
          .then((value) => {
            firstValue = value;
          });
      });

      act(() => {
        result.current.handleConfirm();
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(firstValue).toBe(true);

      act(() => {
        result.current
          .confirm({
            title: 'Second',
            message: 'Second confirm',
          })
          .then((value) => {
            secondValue = value;
          });
      });

      act(() => {
        result.current.closeDialog();
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(secondValue).toBe(false);
    });

    it('should handle different dialog types in sequence', async () => {
      const { result } = renderHook(() => useDialog());

      let confirmValue: boolean | undefined;
      let promptValue: string | null | undefined;
      let alertResolved = false;

      act(() => {
        result.current
          .confirm({
            title: 'Confirm',
            message: 'Confirm this',
          })
          .then((value) => {
            confirmValue = value;
          });
      });

      act(() => {
        result.current.handleConfirm();
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(confirmValue).toBe(true);

      act(() => {
        result.current
          .prompt({
            title: 'Prompt',
            message: 'Enter value',
          })
          .then((value) => {
            promptValue = value;
          });
      });

      act(() => {
        result.current.handleConfirm('test value');
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(promptValue).toBe('test value');

      act(() => {
        result.current
          .alert({
            title: 'Alert',
            message: 'Done',
          })
          .then(() => {
            alertResolved = true;
          });
      });

      act(() => {
        result.current.handleConfirm();
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(alertResolved).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle calling closeDialog multiple times', () => {
      const { result } = renderHook(() => useDialog());

      act(() => {
        result.current.openDialog({
          title: 'Test',
          message: 'Message',
        });
      });

      expect(() => {
        act(() => {
          result.current.closeDialog();
          result.current.closeDialog();
          result.current.closeDialog();
        });
      }).not.toThrow();

      expect(result.current.isOpen).toBe(false);
    });

    it('should handle calling handleConfirm multiple times', () => {
      const { result } = renderHook(() => useDialog());

      act(() => {
        result.current.openDialog({
          title: 'Test',
          message: 'Message',
        });
      });

      expect(() => {
        act(() => {
          result.current.handleConfirm();
          result.current.handleConfirm();
        });
      }).not.toThrow();

      expect(result.current.isOpen).toBe(false);
    });

    it('should maintain state consistency across operations', () => {
      const { result } = renderHook(() => useDialog());

      act(() => {
        result.current.openDialog({
          title: 'Title 1',
          message: 'Message 1',
          variant: 'warning',
        });
      });

      expect(result.current.dialogState.title).toBe('Title 1');

      act(() => {
        result.current.openDialog({
          title: 'Title 2',
          message: 'Message 2',
          variant: 'danger',
        });
      });

      expect(result.current.dialogState.title).toBe('Title 2');
      expect(result.current.dialogState.variant).toBe('danger');

      act(() => {
        result.current.closeDialog();
      });

      expect(result.current.isOpen).toBe(false);
      expect(result.current.dialogState.title).toBe('Title 2');
    });
  });
});
