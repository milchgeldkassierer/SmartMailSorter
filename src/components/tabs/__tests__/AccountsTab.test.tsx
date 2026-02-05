import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import AccountsTab from '../AccountsTab';
import { ImapAccount } from '../../../types';

describe('AccountsTab', () => {
  const mockAccounts: ImapAccount[] = [
    {
      id: 'acc-1',
      name: 'Work Account',
      email: 'work@example.com',
      username: 'work@example.com',
      password: 'password123',
      provider: 'gmx',
      imapHost: 'imap.gmx.net',
      imapPort: 993,
      color: 'blue',
    },
    {
      id: 'acc-2',
      name: 'Personal',
      email: 'personal@gmail.com',
      username: 'personal@gmail.com',
      password: 'secret',
      provider: 'gmail',
      imapHost: 'imap.gmail.com',
      imapPort: 993,
      color: 'green',
    },
  ];

  const defaultProps = {
    accounts: mockAccounts,
    onAddAccount: vi.fn(),
    onRemoveAccount: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset Date.now for consistent IDs in tests
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Rendering', () => {
    it('should render the accounts tab heading', () => {
      render(<AccountsTab {...defaultProps} />);
      expect(screen.getByText('Verbundene Konten')).toBeInTheDocument();
    });

    it('should render add account button', () => {
      render(<AccountsTab {...defaultProps} />);
      expect(screen.getByText('Konto hinzufügen')).toBeInTheDocument();
    });

    it('should render account list', () => {
      render(<AccountsTab {...defaultProps} />);
      expect(screen.getByText('Work Account')).toBeInTheDocument();
      expect(screen.getByText(/work@example\.com/)).toBeInTheDocument();
      expect(screen.getByText('Personal')).toBeInTheDocument();
      expect(screen.getByText(/personal@gmail\.com/)).toBeInTheDocument();
    });

    it('should render account initial correctly', () => {
      render(<AccountsTab {...defaultProps} />);
      expect(screen.getByText('W')).toBeInTheDocument(); // Work Account
      expect(screen.getByText('P')).toBeInTheDocument(); // Personal
    });

    it('should display IMAP host for accounts', () => {
      render(<AccountsTab {...defaultProps} />);
      expect(screen.getByText(/imap\.gmx\.net/)).toBeInTheDocument();
      expect(screen.getByText(/imap\.gmail\.com/)).toBeInTheDocument();
    });
  });

  describe('Add Account Button', () => {
    it('should show add account form when button is clicked', () => {
      render(<AccountsTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Konto hinzufügen'));

      expect(screen.getByText('Neues Konto verbinden')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('z.B. Arbeit')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('name@gmx.de')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Email Passwort')).toBeInTheDocument();
    });

    it('should hide add button when form is shown', () => {
      render(<AccountsTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Konto hinzufügen'));

      expect(screen.queryByText('Konto hinzufügen')).not.toBeInTheDocument();
    });
  });

  describe('Provider Selection', () => {
    it('should show provider selection buttons', () => {
      render(<AccountsTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Konto hinzufügen'));

      expect(screen.getByText('GMX')).toBeInTheDocument();
      expect(screen.getByText('Web.de')).toBeInTheDocument();
      expect(screen.getByText('Gmail')).toBeInTheDocument();
      expect(screen.getByText('Andere')).toBeInTheDocument();
    });

    it('should default to GMX provider', () => {
      render(<AccountsTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Konto hinzufügen'));

      const gmxButton = screen.getByText('GMX');
      expect(gmxButton).toHaveClass('bg-blue-50');
    });

    it('should update host/port when Web.de provider is selected', () => {
      render(<AccountsTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Konto hinzufügen'));
      fireEvent.click(screen.getByText('Web.de'));

      const webdeButton = screen.getByText('Web.de');
      expect(webdeButton).toHaveClass('bg-blue-50');
    });

    it('should update host/port when Gmail provider is selected', () => {
      render(<AccountsTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Konto hinzufügen'));
      fireEvent.click(screen.getByText('Gmail'));

      const gmailButton = screen.getByText('Gmail');
      expect(gmailButton).toHaveClass('bg-blue-50');
    });

    it('should show custom IMAP fields when "Andere" provider is selected', () => {
      render(<AccountsTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Konto hinzufügen'));
      fireEvent.click(screen.getByText('Andere'));

      expect(screen.getByPlaceholderText('imap.example.com')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('993')).toBeInTheDocument();
    });

    it('should not show custom IMAP fields for standard providers', () => {
      render(<AccountsTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Konto hinzufügen'));

      // GMX is default, no custom fields
      expect(screen.queryByPlaceholderText('imap.example.com')).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText('993')).not.toBeInTheDocument();
    });
  });

  describe('Form Input', () => {
    it('should update form fields when typing', () => {
      render(<AccountsTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Konto hinzufügen'));

      const nameInput = screen.getByPlaceholderText('z.B. Arbeit');
      const emailInput = screen.getByPlaceholderText('name@gmx.de');
      const passwordInput = screen.getByPlaceholderText('Email Passwort');

      fireEvent.change(nameInput, { target: { value: 'Test Account' } });
      fireEvent.change(emailInput, { target: { value: 'test@test.com' } });
      fireEvent.change(passwordInput, { target: { value: 'mypassword' } });

      expect(nameInput).toHaveValue('Test Account');
      expect(emailInput).toHaveValue('test@test.com');
      expect(passwordInput).toHaveValue('mypassword');
    });

    it('should update custom IMAP fields when typing', () => {
      render(<AccountsTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Konto hinzufügen'));
      fireEvent.click(screen.getByText('Andere'));

      const hostInput = screen.getByPlaceholderText('imap.example.com');
      const portInput = screen.getByPlaceholderText('993');

      fireEvent.change(hostInput, { target: { value: 'mail.custom.com' } });
      fireEvent.change(portInput, { target: { value: '143' } });

      expect(hostInput).toHaveValue('mail.custom.com');
      expect(portInput).toHaveValue(143);
    });
  });

  describe('Form Validation', () => {
    it('should disable save button when email is empty', () => {
      render(<AccountsTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Konto hinzufügen'));

      const nameInput = screen.getByPlaceholderText('z.B. Arbeit');
      const passwordInput = screen.getByPlaceholderText('Email Passwort');

      fireEvent.change(nameInput, { target: { value: 'Test' } });
      fireEvent.change(passwordInput, { target: { value: 'pass' } });

      const saveButton = screen.getByText('Speichern & Verbinden');
      expect(saveButton).toBeDisabled();
    });

    it('should disable save button when password is empty', () => {
      render(<AccountsTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Konto hinzufügen'));

      const nameInput = screen.getByPlaceholderText('z.B. Arbeit');
      const emailInput = screen.getByPlaceholderText('name@gmx.de');

      fireEvent.change(nameInput, { target: { value: 'Test' } });
      fireEvent.change(emailInput, { target: { value: 'test@test.com' } });

      const saveButton = screen.getByText('Speichern & Verbinden');
      expect(saveButton).toBeDisabled();
    });

    it('should enable save button when all required fields are filled', () => {
      render(<AccountsTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Konto hinzufügen'));

      const nameInput = screen.getByPlaceholderText('z.B. Arbeit');
      const emailInput = screen.getByPlaceholderText('name@gmx.de');
      const passwordInput = screen.getByPlaceholderText('Email Passwort');

      fireEvent.change(nameInput, { target: { value: 'Test' } });
      fireEvent.change(emailInput, { target: { value: 'test@test.com' } });
      fireEvent.change(passwordInput, { target: { value: 'mypassword' } });

      const saveButton = screen.getByText('Speichern & Verbinden');
      expect(saveButton).not.toBeDisabled();
    });
  });

  describe('Save Account', () => {
    it('should call onAddAccount with correct data when save is clicked', () => {
      const onAddAccount = vi.fn();
      render(<AccountsTab {...defaultProps} onAddAccount={onAddAccount} />);

      fireEvent.click(screen.getByText('Konto hinzufügen'));

      fireEvent.change(screen.getByPlaceholderText('z.B. Arbeit'), { target: { value: 'My Account' } });
      fireEvent.change(screen.getByPlaceholderText('name@gmx.de'), { target: { value: 'user@gmx.de' } });
      fireEvent.change(screen.getByPlaceholderText('Email Passwort'), { target: { value: 'secret123' } });

      fireEvent.click(screen.getByText('Speichern & Verbinden'));

      expect(onAddAccount).toHaveBeenCalledTimes(1);
      const calledWith = onAddAccount.mock.calls[0][0];
      expect(calledWith.name).toBe('My Account');
      expect(calledWith.email).toBe('user@gmx.de');
      expect(calledWith.username).toBe('user@gmx.de');
      expect(calledWith.password).toBe('secret123');
      expect(calledWith.provider).toBe('gmx');
      expect(calledWith.imapHost).toBe('imap.gmx.net');
      expect(calledWith.imapPort).toBe(993);
      expect(calledWith.id).toMatch(/^acc-/);
    });

    it('should use Web.de IMAP settings when Web.de provider is selected', () => {
      const onAddAccount = vi.fn();
      render(<AccountsTab {...defaultProps} onAddAccount={onAddAccount} />);

      fireEvent.click(screen.getByText('Konto hinzufügen'));
      fireEvent.click(screen.getByText('Web.de'));

      fireEvent.change(screen.getByPlaceholderText('z.B. Arbeit'), { target: { value: 'Web Account' } });
      fireEvent.change(screen.getByPlaceholderText('name@gmx.de'), { target: { value: 'user@web.de' } });
      fireEvent.change(screen.getByPlaceholderText('Email Passwort'), { target: { value: 'pass' } });

      fireEvent.click(screen.getByText('Speichern & Verbinden'));

      const calledWith = onAddAccount.mock.calls[0][0];
      expect(calledWith.imapHost).toBe('imap.web.de');
      expect(calledWith.provider).toBe('webde');
    });

    it('should use Gmail IMAP settings when Gmail provider is selected', () => {
      const onAddAccount = vi.fn();
      render(<AccountsTab {...defaultProps} onAddAccount={onAddAccount} />);

      fireEvent.click(screen.getByText('Konto hinzufügen'));
      fireEvent.click(screen.getByText('Gmail'));

      fireEvent.change(screen.getByPlaceholderText('z.B. Arbeit'), { target: { value: 'Gmail Account' } });
      fireEvent.change(screen.getByPlaceholderText('name@gmx.de'), { target: { value: 'user@gmail.com' } });
      fireEvent.change(screen.getByPlaceholderText('Email Passwort'), { target: { value: 'pass' } });

      fireEvent.click(screen.getByText('Speichern & Verbinden'));

      const calledWith = onAddAccount.mock.calls[0][0];
      expect(calledWith.imapHost).toBe('imap.gmail.com');
      expect(calledWith.provider).toBe('gmail');
    });

    it('should use custom IMAP settings when "Andere" provider is selected', () => {
      const onAddAccount = vi.fn();
      render(<AccountsTab {...defaultProps} onAddAccount={onAddAccount} />);

      fireEvent.click(screen.getByText('Konto hinzufügen'));
      fireEvent.click(screen.getByText('Andere'));

      fireEvent.change(screen.getByPlaceholderText('z.B. Arbeit'), { target: { value: 'Custom Account' } });
      fireEvent.change(screen.getByPlaceholderText('name@gmx.de'), { target: { value: 'user@custom.com' } });
      fireEvent.change(screen.getByPlaceholderText('Email Passwort'), { target: { value: 'pass' } });
      fireEvent.change(screen.getByPlaceholderText('imap.example.com'), { target: { value: 'mail.custom.com' } });
      fireEvent.change(screen.getByPlaceholderText('993'), { target: { value: '143' } });

      fireEvent.click(screen.getByText('Speichern & Verbinden'));

      const calledWith = onAddAccount.mock.calls[0][0];
      expect(calledWith.imapHost).toBe('mail.custom.com');
      expect(calledWith.imapPort).toBe(143);
      expect(calledWith.provider).toBe('other');
    });

    it('should hide form after successful save', () => {
      render(<AccountsTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Konto hinzufügen'));

      fireEvent.change(screen.getByPlaceholderText('z.B. Arbeit'), { target: { value: 'Test' } });
      fireEvent.change(screen.getByPlaceholderText('name@gmx.de'), { target: { value: 'test@test.com' } });
      fireEvent.change(screen.getByPlaceholderText('Email Passwort'), { target: { value: 'pass' } });

      fireEvent.click(screen.getByText('Speichern & Verbinden'));

      expect(screen.queryByText('Neues Konto verbinden')).not.toBeInTheDocument();
      expect(screen.getByText('Konto hinzufügen')).toBeInTheDocument();
    });

    it('should clear form fields after successful save', () => {
      render(<AccountsTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Konto hinzufügen'));

      fireEvent.change(screen.getByPlaceholderText('z.B. Arbeit'), { target: { value: 'Test' } });
      fireEvent.change(screen.getByPlaceholderText('name@gmx.de'), { target: { value: 'test@test.com' } });
      fireEvent.change(screen.getByPlaceholderText('Email Passwort'), { target: { value: 'pass' } });

      fireEvent.click(screen.getByText('Speichern & Verbinden'));

      // Open form again
      fireEvent.click(screen.getByText('Konto hinzufügen'));

      expect(screen.getByPlaceholderText('z.B. Arbeit')).toHaveValue('');
      expect(screen.getByPlaceholderText('name@gmx.de')).toHaveValue('');
      expect(screen.getByPlaceholderText('Email Passwort')).toHaveValue('');
    });

    it('should not call onAddAccount when name is empty', () => {
      const onAddAccount = vi.fn();
      render(<AccountsTab {...defaultProps} onAddAccount={onAddAccount} />);

      fireEvent.click(screen.getByText('Konto hinzufügen'));

      // Fill only email and password, not name
      fireEvent.change(screen.getByPlaceholderText('name@gmx.de'), { target: { value: 'test@test.com' } });
      fireEvent.change(screen.getByPlaceholderText('Email Passwort'), { target: { value: 'pass' } });

      fireEvent.click(screen.getByText('Speichern & Verbinden'));

      expect(onAddAccount).not.toHaveBeenCalled();
    });

    it('should assign a random color to new accounts', () => {
      const onAddAccount = vi.fn();
      render(<AccountsTab {...defaultProps} onAddAccount={onAddAccount} />);

      fireEvent.click(screen.getByText('Konto hinzufügen'));

      fireEvent.change(screen.getByPlaceholderText('z.B. Arbeit'), { target: { value: 'Test' } });
      fireEvent.change(screen.getByPlaceholderText('name@gmx.de'), { target: { value: 'test@test.com' } });
      fireEvent.change(screen.getByPlaceholderText('Email Passwort'), { target: { value: 'pass' } });

      fireEvent.click(screen.getByText('Speichern & Verbinden'));

      const calledWith = onAddAccount.mock.calls[0][0];
      expect(['blue', 'green', 'purple', 'amber', 'rose', 'indigo']).toContain(calledWith.color);
    });
  });

  describe('Cancel Account Form', () => {
    it('should hide form when cancel is clicked', () => {
      render(<AccountsTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Konto hinzufügen'));
      expect(screen.getByText('Neues Konto verbinden')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Abbrechen'));

      expect(screen.queryByText('Neues Konto verbinden')).not.toBeInTheDocument();
      expect(screen.getByText('Konto hinzufügen')).toBeInTheDocument();
    });

    it('should not call onAddAccount when cancel is clicked', () => {
      const onAddAccount = vi.fn();
      render(<AccountsTab {...defaultProps} onAddAccount={onAddAccount} />);

      fireEvent.click(screen.getByText('Konto hinzufügen'));

      fireEvent.change(screen.getByPlaceholderText('z.B. Arbeit'), { target: { value: 'Test' } });
      fireEvent.change(screen.getByPlaceholderText('name@gmx.de'), { target: { value: 'test@test.com' } });
      fireEvent.change(screen.getByPlaceholderText('Email Passwort'), { target: { value: 'pass' } });

      fireEvent.click(screen.getByText('Abbrechen'));

      expect(onAddAccount).not.toHaveBeenCalled();
    });
  });

  describe('Remove Account', () => {
    it('should show remove button when more than one account exists', () => {
      render(<AccountsTab {...defaultProps} />);

      const removeButtons = screen.getAllByTitle('Konto entfernen');
      expect(removeButtons.length).toBe(2);
    });

    it('should not show remove button when only one account exists', () => {
      render(<AccountsTab {...defaultProps} accounts={[mockAccounts[0]]} />);

      expect(screen.queryByTitle('Konto entfernen')).not.toBeInTheDocument();
    });

    it('should call onRemoveAccount when remove button is clicked', () => {
      const onRemoveAccount = vi.fn();
      render(<AccountsTab {...defaultProps} onRemoveAccount={onRemoveAccount} />);

      const removeButtons = screen.getAllByTitle('Konto entfernen');
      fireEvent.click(removeButtons[0]);

      expect(onRemoveAccount).toHaveBeenCalledWith('acc-1');
    });
  });

  describe('Connection Test', () => {
    it('should show test connection button in add account form', () => {
      render(<AccountsTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Konto hinzufügen'));

      expect(screen.getByText('Verbindung testen')).toBeInTheDocument();
    });

    it('should disable test button when email is empty', () => {
      render(<AccountsTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Konto hinzufügen'));

      fireEvent.change(screen.getByPlaceholderText('Email Passwort'), { target: { value: 'password' } });

      const testButton = screen.getByText('Verbindung testen');
      expect(testButton).toBeDisabled();
    });

    it('should disable test button when password is empty', () => {
      render(<AccountsTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Konto hinzufügen'));

      fireEvent.change(screen.getByPlaceholderText('name@gmx.de'), { target: { value: 'test@test.com' } });

      const testButton = screen.getByText('Verbindung testen');
      expect(testButton).toBeDisabled();
    });

    it('should enable test button when email and password are filled', () => {
      render(<AccountsTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Konto hinzufügen'));

      fireEvent.change(screen.getByPlaceholderText('name@gmx.de'), { target: { value: 'test@test.com' } });
      fireEvent.change(screen.getByPlaceholderText('Email Passwort'), { target: { value: 'password' } });

      const testButton = screen.getByText('Verbindung testen');
      expect(testButton).not.toBeDisabled();
    });

    it('should show error message when window.electron is not available', async () => {
      render(<AccountsTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Konto hinzufügen'));

      fireEvent.change(screen.getByPlaceholderText('name@gmx.de'), { target: { value: 'test@test.com' } });
      fireEvent.change(screen.getByPlaceholderText('Email Passwort'), { target: { value: 'password' } });

      await act(async () => {
        fireEvent.click(screen.getByText('Verbindung testen'));
      });

      // Should show web mode error
      expect(screen.getByText('Web Mode: Test nicht möglich')).toBeInTheDocument();
    });

    it('should show error status after failed test', async () => {
      render(<AccountsTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Konto hinzufügen'));

      fireEvent.change(screen.getByPlaceholderText('name@gmx.de'), { target: { value: 'test@test.com' } });
      fireEvent.change(screen.getByPlaceholderText('Email Passwort'), { target: { value: 'password' } });

      const testButton = screen.getByText('Verbindung testen');

      await act(async () => {
        fireEvent.click(testButton);
      });

      // After test completes with error (in web mode), error message should be visible
      expect(screen.getByText('Web Mode: Test nicht möglich')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty accounts array', () => {
      render(<AccountsTab {...defaultProps} accounts={[]} />);

      expect(screen.getByText('Verbundene Konten')).toBeInTheDocument();
      expect(screen.getByText('Konto hinzufügen')).toBeInTheDocument();
    });

    it('should handle account without imapHost', () => {
      const accountsWithoutHost: ImapAccount[] = [
        {
          id: 'acc-1',
          name: 'Test',
          email: 'test@test.com',
          username: 'test@test.com',
          password: 'pass',
          provider: 'gmx',
          imapHost: '',
          imapPort: 993,
          color: 'blue',
        },
      ];

      render(<AccountsTab {...defaultProps} accounts={accountsWithoutHost} />);

      // Should show default imap.gmx.net when host is empty
      expect(screen.getByText(/imap\.gmx\.net/)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible form inputs with labels', () => {
      render(<AccountsTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Konto hinzufügen'));

      expect(screen.getByText('Name (Anzeige)')).toBeInTheDocument();
      expect(screen.getByText('Email Adresse')).toBeInTheDocument();
      expect(screen.getByText('Passwort')).toBeInTheDocument();
      expect(screen.getByText('Anbieter')).toBeInTheDocument();
    });

    it('should have accessible custom IMAP labels', () => {
      render(<AccountsTab {...defaultProps} />);

      fireEvent.click(screen.getByText('Konto hinzufügen'));
      fireEvent.click(screen.getByText('Andere'));

      expect(screen.getByText('IMAP Server')).toBeInTheDocument();
      expect(screen.getByText('Port')).toBeInTheDocument();
    });

    it('should have title attribute on remove account button', () => {
      render(<AccountsTab {...defaultProps} />);

      const removeButtons = screen.getAllByTitle('Konto entfernen');
      expect(removeButtons[0]).toHaveAttribute('title', 'Konto entfernen');
    });
  });
});
