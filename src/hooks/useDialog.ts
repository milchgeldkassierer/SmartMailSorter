import { useState, useCallback, useRef } from 'react';
import { DialogType, DialogVariant } from '../components/ConfirmDialog';

interface DialogConfig {
  title: string;
  message: string;
  type?: DialogType;
  variant?: DialogVariant;
  confirmText?: string;
  cancelText?: string;
  defaultValue?: string;
  placeholder?: string;
}

interface DialogState extends DialogConfig {
  isOpen: boolean;
}

interface UseDialogReturn {
  isOpen: boolean;
  dialogState: DialogState;
  openDialog: (config: DialogConfig) => void;
  closeDialog: () => void;
  confirm: (config: Omit<DialogConfig, 'type'>) => Promise<boolean>;
  alert: (config: Omit<DialogConfig, 'type'>) => Promise<void>;
  prompt: (config: Omit<DialogConfig, 'type'>) => Promise<string | null>;
  handleConfirm: (value?: string) => void;
  handleClose: () => void;
}

export const useDialog = (): UseDialogReturn => {
  const [dialogState, setDialogState] = useState<DialogState>({
    isOpen: false,
    title: '',
    message: '',
    type: 'confirm',
    variant: 'info',
  });

  // Use ref to store resolve/reject functions for Promise-based API
  const resolveRef = useRef<((value: boolean | string | null | void) => void) | null>(null);

  const openDialog = useCallback((config: DialogConfig) => {
    setDialogState({
      isOpen: true,
      type: config.type || 'confirm',
      variant: config.variant || 'info',
      title: config.title,
      message: config.message,
      confirmText: config.confirmText,
      cancelText: config.cancelText,
      defaultValue: config.defaultValue,
      placeholder: config.placeholder,
    });
  }, []);

  const closeDialog = useCallback(() => {
    setDialogState((prev) => {
      // Reject/resolve with default value when closing without explicit action
      if (resolveRef.current) {
        if (prev.type === 'confirm') {
          resolveRef.current(false);
        } else if (prev.type === 'prompt') {
          resolveRef.current(null);
        } else {
          resolveRef.current(undefined);
        }
        resolveRef.current = null;
      }
      return { ...prev, isOpen: false };
    });
  }, []);

  const handleConfirm = useCallback((value?: string) => {
    setDialogState((prev) => {
      if (resolveRef.current) {
        if (prev.type === 'confirm') {
          resolveRef.current(true);
        } else if (prev.type === 'prompt') {
          resolveRef.current(value || null);
        } else {
          resolveRef.current(undefined);
        }
        resolveRef.current = null;
      }
      return { ...prev, isOpen: false };
    });
  }, []);

  const handleClose = useCallback(() => {
    closeDialog();
  }, [closeDialog]);

  const confirm = useCallback(
    (config: Omit<DialogConfig, 'type'>): Promise<boolean> => {
      return new Promise((resolve) => {
        resolveRef.current = resolve as (value: boolean | string | null | void) => void;
        openDialog({ ...config, type: 'confirm' });
      });
    },
    [openDialog]
  );

  const alert = useCallback(
    (config: Omit<DialogConfig, 'type'>): Promise<void> => {
      return new Promise((resolve) => {
        resolveRef.current = resolve as (value: boolean | string | null | void) => void;
        openDialog({ ...config, type: 'alert' });
      });
    },
    [openDialog]
  );

  const prompt = useCallback(
    (config: Omit<DialogConfig, 'type'>): Promise<string | null> => {
      return new Promise((resolve) => {
        resolveRef.current = resolve as (value: boolean | string | null | void) => void;
        openDialog({ ...config, type: 'prompt' });
      });
    },
    [openDialog]
  );

  return {
    isOpen: dialogState.isOpen,
    dialogState,
    openDialog,
    closeDialog,
    confirm,
    alert,
    prompt,
    handleConfirm,
    handleClose,
  };
};
