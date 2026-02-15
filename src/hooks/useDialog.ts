import { useState, useCallback, useRef } from 'react';
import { DialogType, DialogVariant } from '../components/ConfirmDialog';

export interface DialogConfig {
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

export interface UseDialogReturn {
  isOpen: boolean;
  dialogState: DialogState;
  openDialog: (config: DialogConfig) => void;
  closeDialog: () => void;
  confirm: (config: Omit<DialogConfig, 'type'>) => Promise<boolean>;
  alert: (config: Omit<DialogConfig, 'type'>) => Promise<void>;
  prompt: (config: Omit<DialogConfig, 'type'>) => Promise<string | null>;
  handleConfirm: (value?: string) => void;
}

export const useDialog = (): UseDialogReturn => {
  const [dialogState, setDialogState] = useState<DialogState>({
    isOpen: false,
    title: '',
    message: '',
    type: 'confirm',
    variant: 'info',
  });

  const resolveRef = useRef<((value: boolean | string | null | void) => void) | null>(null);
  const dialogTypeRef = useRef<DialogType>('confirm');

  const cancelPendingDialog = useCallback(() => {
    if (resolveRef.current) {
      const prevType = dialogTypeRef.current;
      if (prevType === 'confirm') {
        resolveRef.current(false);
      } else if (prevType === 'prompt') {
        resolveRef.current(null);
      } else {
        resolveRef.current(undefined);
      }
      resolveRef.current = null;
    }
  }, []);

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

  // Skips redundant state update if already closed (e.g., after handleConfirm)
  const closeDialog = useCallback(() => {
    cancelPendingDialog();
    setDialogState((prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev));
  }, [cancelPendingDialog]);

  const handleConfirm = useCallback((value?: string) => {
    if (resolveRef.current) {
      const type = dialogTypeRef.current;
      if (type === 'confirm') {
        resolveRef.current(true);
      } else if (type === 'prompt') {
        resolveRef.current(value || null);
      } else {
        resolveRef.current(undefined);
      }
      resolveRef.current = null;
    }
    setDialogState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const confirm = useCallback(
    (config: Omit<DialogConfig, 'type'>): Promise<boolean> => {
      cancelPendingDialog();
      return new Promise((resolve) => {
        resolveRef.current = resolve as (value: boolean | string | null | void) => void;
        dialogTypeRef.current = 'confirm';
        openDialog({ ...config, type: 'confirm' });
      });
    },
    [openDialog, cancelPendingDialog]
  );

  const alert = useCallback(
    (config: Omit<DialogConfig, 'type'>): Promise<void> => {
      cancelPendingDialog();
      return new Promise((resolve) => {
        resolveRef.current = resolve as (value: boolean | string | null | void) => void;
        dialogTypeRef.current = 'alert';
        openDialog({ ...config, type: 'alert' });
      });
    },
    [openDialog, cancelPendingDialog]
  );

  const prompt = useCallback(
    (config: Omit<DialogConfig, 'type'>): Promise<string | null> => {
      cancelPendingDialog();
      return new Promise((resolve) => {
        resolveRef.current = resolve as (value: boolean | string | null | void) => void;
        dialogTypeRef.current = 'prompt';
        openDialog({ ...config, type: 'prompt' });
      });
    },
    [openDialog, cancelPendingDialog]
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
  };
};
