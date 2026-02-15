import React, { createContext, useContext } from 'react';
import { useDialog, UseDialogReturn } from '../hooks/useDialog';
import ConfirmDialog from '../components/ConfirmDialog';

const DialogContext = createContext<UseDialogReturn | null>(null);

export const useDialogContext = (): UseDialogReturn => {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error('useDialogContext must be used within a DialogProvider');
  }
  return ctx;
};

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dialog = useDialog();

  return (
    <DialogContext.Provider value={dialog}>
      {children}
      <ConfirmDialog
        isOpen={dialog.isOpen}
        onClose={dialog.closeDialog}
        onConfirm={dialog.handleConfirm}
        title={dialog.dialogState.title}
        message={dialog.dialogState.message}
        type={dialog.dialogState.type}
        variant={dialog.dialogState.variant}
        confirmText={dialog.dialogState.confirmText}
        cancelText={dialog.dialogState.cancelText}
        defaultValue={dialog.dialogState.defaultValue}
        placeholder={dialog.dialogState.placeholder}
      />
    </DialogContext.Provider>
  );
};
