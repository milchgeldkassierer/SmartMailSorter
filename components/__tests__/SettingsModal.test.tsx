import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsModal from '../SettingsModal';
import { ImapAccount, AISettings, LLMProvider, AVAILABLE_MODELS } from '../../types';

describe('SettingsModal', () => {
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
            color: 'blue'
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
            color: 'green'
        }
    ];

    const mockAISettings: AISettings = {
        provider: LLMProvider.GEMINI,
        model: 'gemini-3-flash-preview',
        apiKey: ''
    };

    const defaultProps = {
        isOpen: true,
        onClose: vi.fn(),
        accounts: mockAccounts,
        onAddAccount: vi.fn(),
        onRemoveAccount: vi.fn(),
        aiSettings: mockAISettings,
        onSaveAISettings: vi.fn()
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
        it('should not render when isOpen is false', () => {
            render(<SettingsModal {...defaultProps} isOpen={false} />);
            expect(screen.queryByText('Einstellungen')).not.toBeInTheDocument();
        });

        it('should render when isOpen is true', () => {
            render(<SettingsModal {...defaultProps} />);
            expect(screen.getByText('Einstellungen')).toBeInTheDocument();
        });

        it('should render the close button', () => {
            render(<SettingsModal {...defaultProps} />);
            // The X icon button in the header
            const header = screen.getByText('Einstellungen').parentElement;
            const closeButton = header?.querySelector('button');
            expect(closeButton).toBeInTheDocument();
        });

        it('should render all three tab buttons', () => {
            render(<SettingsModal {...defaultProps} />);
            expect(screen.getByText('IMAP Konten')).toBeInTheDocument();
            expect(screen.getByText('Smart Sort')).toBeInTheDocument();
            expect(screen.getByText('Allgemein')).toBeInTheDocument();
        });

        it('should default to accounts tab', () => {
            render(<SettingsModal {...defaultProps} />);
            expect(screen.getByText('Verbundene Konten')).toBeInTheDocument();
        });

        it('should render account list in accounts tab', () => {
            render(<SettingsModal {...defaultProps} />);
            expect(screen.getByText('Work Account')).toBeInTheDocument();
            expect(screen.getByText(/work@example\.com/)).toBeInTheDocument();
            expect(screen.getByText('Personal')).toBeInTheDocument();
            expect(screen.getByText(/personal@gmail\.com/)).toBeInTheDocument();
        });

        it('should render add account button', () => {
            render(<SettingsModal {...defaultProps} />);
            expect(screen.getByText('Konto hinzufügen')).toBeInTheDocument();
        });
    });

    describe('Tab Switching', () => {
        it('should switch to Smart Sort tab when clicked', () => {
            render(<SettingsModal {...defaultProps} />);

            const smartSortTab = screen.getByText('Smart Sort');
            fireEvent.click(smartSortTab);

            expect(screen.getByText('Smart Sort Konfiguration')).toBeInTheDocument();
            expect(screen.getByText('LLM Anbieter')).toBeInTheDocument();
        });

        it('should switch to Allgemein tab when clicked', () => {
            render(<SettingsModal {...defaultProps} />);

            const generalTab = screen.getByText('Allgemein');
            fireEvent.click(generalTab);

            expect(screen.getByText('Datenverwaltung')).toBeInTheDocument();
        });

        it('should switch back to accounts tab when clicked', () => {
            render(<SettingsModal {...defaultProps} />);

            // Switch to general
            fireEvent.click(screen.getByText('Allgemein'));
            expect(screen.getByText('Datenverwaltung')).toBeInTheDocument();

            // Switch back to accounts
            fireEvent.click(screen.getByText('IMAP Konten'));
            expect(screen.getByText('Verbundene Konten')).toBeInTheDocument();
        });

        it('should highlight active tab', () => {
            render(<SettingsModal {...defaultProps} />);

            const accountsTab = screen.getByText('IMAP Konten');
            expect(accountsTab).toHaveClass('bg-blue-100');

            // Switch to Smart Sort
            fireEvent.click(screen.getByText('Smart Sort'));
            const smartSortTab = screen.getByText('Smart Sort');
            expect(smartSortTab).toHaveClass('bg-blue-100');
        });
    });

    describe('Add Account Form', () => {
        it('should show add account form when button is clicked', () => {
            render(<SettingsModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Konto hinzufügen'));

            expect(screen.getByText('Neues Konto verbinden')).toBeInTheDocument();
            expect(screen.getByPlaceholderText('z.B. Arbeit')).toBeInTheDocument();
            expect(screen.getByPlaceholderText('name@gmx.de')).toBeInTheDocument();
            expect(screen.getByPlaceholderText('Email Passwort')).toBeInTheDocument();
        });

        it('should hide add button when form is shown', () => {
            render(<SettingsModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Konto hinzufügen'));

            expect(screen.queryByText('Konto hinzufügen')).not.toBeInTheDocument();
        });

        it('should show provider selection buttons', () => {
            render(<SettingsModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Konto hinzufügen'));

            expect(screen.getByText('GMX')).toBeInTheDocument();
            expect(screen.getByText('Web.de')).toBeInTheDocument();
            expect(screen.getByText('Gmail')).toBeInTheDocument();
            expect(screen.getByText('Andere')).toBeInTheDocument();
        });

        it('should default to GMX provider', () => {
            render(<SettingsModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Konto hinzufügen'));

            const gmxButton = screen.getByText('GMX');
            expect(gmxButton).toHaveClass('bg-blue-50');
        });

        it('should update host/port when Web.de provider is selected', () => {
            render(<SettingsModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Konto hinzufügen'));
            fireEvent.click(screen.getByText('Web.de'));

            const webdeButton = screen.getByText('Web.de');
            expect(webdeButton).toHaveClass('bg-blue-50');
        });

        it('should update host/port when Gmail provider is selected', () => {
            render(<SettingsModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Konto hinzufügen'));
            fireEvent.click(screen.getByText('Gmail'));

            const gmailButton = screen.getByText('Gmail');
            expect(gmailButton).toHaveClass('bg-blue-50');
        });

        it('should show custom IMAP fields when "Andere" provider is selected', () => {
            render(<SettingsModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Konto hinzufügen'));
            fireEvent.click(screen.getByText('Andere'));

            expect(screen.getByPlaceholderText('imap.example.com')).toBeInTheDocument();
            expect(screen.getByPlaceholderText('993')).toBeInTheDocument();
        });

        it('should not show custom IMAP fields for standard providers', () => {
            render(<SettingsModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Konto hinzufügen'));

            // GMX is default, no custom fields
            expect(screen.queryByPlaceholderText('imap.example.com')).not.toBeInTheDocument();
            expect(screen.queryByPlaceholderText('993')).not.toBeInTheDocument();
        });

        it('should update form fields when typing', () => {
            render(<SettingsModal {...defaultProps} />);

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
            render(<SettingsModal {...defaultProps} />);

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

    describe('Account Form Validation', () => {
        it('should disable save button when email is empty', () => {
            render(<SettingsModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Konto hinzufügen'));

            const nameInput = screen.getByPlaceholderText('z.B. Arbeit');
            const passwordInput = screen.getByPlaceholderText('Email Passwort');

            fireEvent.change(nameInput, { target: { value: 'Test' } });
            fireEvent.change(passwordInput, { target: { value: 'pass' } });

            const saveButton = screen.getByText('Speichern & Verbinden');
            expect(saveButton).toBeDisabled();
        });

        it('should disable save button when password is empty', () => {
            render(<SettingsModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Konto hinzufügen'));

            const nameInput = screen.getByPlaceholderText('z.B. Arbeit');
            const emailInput = screen.getByPlaceholderText('name@gmx.de');

            fireEvent.change(nameInput, { target: { value: 'Test' } });
            fireEvent.change(emailInput, { target: { value: 'test@test.com' } });

            const saveButton = screen.getByText('Speichern & Verbinden');
            expect(saveButton).toBeDisabled();
        });

        it('should enable save button when all required fields are filled', () => {
            render(<SettingsModal {...defaultProps} />);

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
            render(<SettingsModal {...defaultProps} onAddAccount={onAddAccount} />);

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
            render(<SettingsModal {...defaultProps} onAddAccount={onAddAccount} />);

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
            render(<SettingsModal {...defaultProps} onAddAccount={onAddAccount} />);

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
            render(<SettingsModal {...defaultProps} onAddAccount={onAddAccount} />);

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
            render(<SettingsModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Konto hinzufügen'));

            fireEvent.change(screen.getByPlaceholderText('z.B. Arbeit'), { target: { value: 'Test' } });
            fireEvent.change(screen.getByPlaceholderText('name@gmx.de'), { target: { value: 'test@test.com' } });
            fireEvent.change(screen.getByPlaceholderText('Email Passwort'), { target: { value: 'pass' } });

            fireEvent.click(screen.getByText('Speichern & Verbinden'));

            expect(screen.queryByText('Neues Konto verbinden')).not.toBeInTheDocument();
            expect(screen.getByText('Konto hinzufügen')).toBeInTheDocument();
        });

        it('should clear form fields after successful save', () => {
            render(<SettingsModal {...defaultProps} />);

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
            render(<SettingsModal {...defaultProps} onAddAccount={onAddAccount} />);

            fireEvent.click(screen.getByText('Konto hinzufügen'));

            // Fill only email and password, not name
            fireEvent.change(screen.getByPlaceholderText('name@gmx.de'), { target: { value: 'test@test.com' } });
            fireEvent.change(screen.getByPlaceholderText('Email Passwort'), { target: { value: 'pass' } });

            fireEvent.click(screen.getByText('Speichern & Verbinden'));

            expect(onAddAccount).not.toHaveBeenCalled();
        });
    });

    describe('Cancel Account Form', () => {
        it('should hide form when cancel is clicked', () => {
            render(<SettingsModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Konto hinzufügen'));
            expect(screen.getByText('Neues Konto verbinden')).toBeInTheDocument();

            fireEvent.click(screen.getByText('Abbrechen'));

            expect(screen.queryByText('Neues Konto verbinden')).not.toBeInTheDocument();
            expect(screen.getByText('Konto hinzufügen')).toBeInTheDocument();
        });

        it('should not call onAddAccount when cancel is clicked', () => {
            const onAddAccount = vi.fn();
            render(<SettingsModal {...defaultProps} onAddAccount={onAddAccount} />);

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
            render(<SettingsModal {...defaultProps} />);

            const removeButtons = screen.getAllByTitle('Konto entfernen');
            expect(removeButtons.length).toBe(2);
        });

        it('should not show remove button when only one account exists', () => {
            render(<SettingsModal {...defaultProps} accounts={[mockAccounts[0]]} />);

            expect(screen.queryByTitle('Konto entfernen')).not.toBeInTheDocument();
        });

        it('should call onRemoveAccount when remove button is clicked', () => {
            const onRemoveAccount = vi.fn();
            render(<SettingsModal {...defaultProps} onRemoveAccount={onRemoveAccount} />);

            const removeButtons = screen.getAllByTitle('Konto entfernen');
            fireEvent.click(removeButtons[0]);

            expect(onRemoveAccount).toHaveBeenCalledWith('acc-1');
        });
    });

    describe('Close Modal', () => {
        it('should call onClose when close button is clicked', () => {
            const onClose = vi.fn();
            render(<SettingsModal {...defaultProps} onClose={onClose} />);

            const header = screen.getByText('Einstellungen').parentElement;
            const closeButton = header?.querySelector('button');
            fireEvent.click(closeButton!);

            expect(onClose).toHaveBeenCalled();
        });
    });

    describe('AI Settings Tab', () => {
        it('should display current AI provider', () => {
            render(<SettingsModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Smart Sort'));

            // First combobox is provider select
            const selects = screen.getAllByRole('combobox');
            const providerSelect = selects[0];
            expect(providerSelect).toHaveValue(LLMProvider.GEMINI);
        });

        it('should display current model', () => {
            render(<SettingsModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Smart Sort'));

            // Find the model select (second combobox)
            const selects = screen.getAllByRole('combobox');
            const modelSelect = selects[1];
            expect(modelSelect).toHaveValue('gemini-3-flash-preview');
        });

        it('should display all provider options', () => {
            render(<SettingsModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Smart Sort'));

            const selects = screen.getAllByRole('combobox');
            const providerSelect = selects[0];

            expect(providerSelect.querySelector(`option[value="${LLMProvider.GEMINI}"]`)).toBeInTheDocument();
            expect(providerSelect.querySelector(`option[value="${LLMProvider.OPENAI}"]`)).toBeInTheDocument();
            expect(providerSelect.querySelector(`option[value="${LLMProvider.ANTHROPIC}"]`)).toBeInTheDocument();
        });

        it('should display all model options for selected provider', () => {
            render(<SettingsModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Smart Sort'));

            // Gemini models should be shown
            const selects = screen.getAllByRole('combobox');
            const modelSelect = selects[1];

            AVAILABLE_MODELS[LLMProvider.GEMINI].forEach(model => {
                expect(modelSelect.querySelector(`option[value="${model}"]`)).toBeInTheDocument();
            });
        });

        it('should change model options when provider changes', () => {
            render(<SettingsModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Smart Sort'));

            const selects = screen.getAllByRole('combobox');
            const providerSelect = selects[0];
            fireEvent.change(providerSelect, { target: { value: LLMProvider.OPENAI } });

            // OpenAI models should now be shown - re-query selects after state change
            const updatedSelects = screen.getAllByRole('combobox');
            const modelSelect = updatedSelects[1];

            AVAILABLE_MODELS[LLMProvider.OPENAI].forEach(model => {
                expect(modelSelect.querySelector(`option[value="${model}"]`)).toBeInTheDocument();
            });
        });

        it('should reset model to first available when provider changes', () => {
            render(<SettingsModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Smart Sort'));

            const selects = screen.getAllByRole('combobox');
            const providerSelect = selects[0];
            fireEvent.change(providerSelect, { target: { value: LLMProvider.OPENAI } });

            const updatedSelects = screen.getAllByRole('combobox');
            const modelSelect = updatedSelects[1];
            expect(modelSelect).toHaveValue(AVAILABLE_MODELS[LLMProvider.OPENAI][0]);
        });

        it('should update model when model select changes', () => {
            render(<SettingsModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Smart Sort'));

            const selects = screen.getAllByRole('combobox');
            const modelSelect = selects[1];
            fireEvent.change(modelSelect, { target: { value: 'gemini-3-pro-preview' } });

            expect(modelSelect).toHaveValue('gemini-3-pro-preview');
        });

        it('should update API key when typing', () => {
            render(<SettingsModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Smart Sort'));

            const apiKeyInput = screen.getByPlaceholderText(/Optional|sk-/);
            fireEvent.change(apiKeyInput, { target: { value: 'my-api-key-123' } });

            expect(apiKeyInput).toHaveValue('my-api-key-123');
        });

        it('should show special placeholder for Gemini provider', () => {
            render(<SettingsModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Smart Sort'));

            const apiKeyInput = screen.getByPlaceholderText('Optional (verwendet Standard-Key)');
            expect(apiKeyInput).toBeInTheDocument();
        });

        it('should show standard placeholder for OpenAI provider', () => {
            render(<SettingsModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Smart Sort'));

            const selects = screen.getAllByRole('combobox');
            const providerSelect = selects[0];
            fireEvent.change(providerSelect, { target: { value: LLMProvider.OPENAI } });

            const apiKeyInput = screen.getByPlaceholderText('sk-...');
            expect(apiKeyInput).toBeInTheDocument();
        });
    });

    describe('Save AI Settings', () => {
        it('should call onSaveAISettings when save button is clicked', () => {
            const onSaveAISettings = vi.fn();
            render(<SettingsModal {...defaultProps} onSaveAISettings={onSaveAISettings} />);

            fireEvent.click(screen.getByText('Smart Sort'));
            fireEvent.click(screen.getByText('Einstellungen speichern'));

            expect(onSaveAISettings).toHaveBeenCalled();
        });

        it('should call onSaveAISettings with updated provider', () => {
            const onSaveAISettings = vi.fn();
            render(<SettingsModal {...defaultProps} onSaveAISettings={onSaveAISettings} />);

            fireEvent.click(screen.getByText('Smart Sort'));

            const selects = screen.getAllByRole('combobox');
            const providerSelect = selects[0];
            fireEvent.change(providerSelect, { target: { value: LLMProvider.OPENAI } });

            fireEvent.click(screen.getByText('Einstellungen speichern'));

            expect(onSaveAISettings).toHaveBeenCalledWith(expect.objectContaining({
                provider: LLMProvider.OPENAI,
                model: AVAILABLE_MODELS[LLMProvider.OPENAI][0],
                apiKey: '' // Reset on provider change
            }));
        });

        it('should call onSaveAISettings with updated model', () => {
            const onSaveAISettings = vi.fn();
            render(<SettingsModal {...defaultProps} onSaveAISettings={onSaveAISettings} />);

            fireEvent.click(screen.getByText('Smart Sort'));

            const selects = screen.getAllByRole('combobox');
            const modelSelect = selects[1];
            fireEvent.change(modelSelect, { target: { value: 'gemini-3-pro-preview' } });

            fireEvent.click(screen.getByText('Einstellungen speichern'));

            expect(onSaveAISettings).toHaveBeenCalledWith(expect.objectContaining({
                provider: LLMProvider.GEMINI,
                model: 'gemini-3-pro-preview'
            }));
        });

        it('should call onSaveAISettings with updated API key', () => {
            const onSaveAISettings = vi.fn();
            render(<SettingsModal {...defaultProps} onSaveAISettings={onSaveAISettings} />);

            fireEvent.click(screen.getByText('Smart Sort'));

            const apiKeyInput = screen.getByPlaceholderText(/Optional|sk-/);
            fireEvent.change(apiKeyInput, { target: { value: 'test-api-key' } });

            fireEvent.click(screen.getByText('Einstellungen speichern'));

            expect(onSaveAISettings).toHaveBeenCalledWith(expect.objectContaining({
                apiKey: 'test-api-key'
            }));
        });
    });

    describe('Connection Test', () => {
        it('should show test connection button in add account form', () => {
            render(<SettingsModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Konto hinzufügen'));

            expect(screen.getByText('Verbindung testen')).toBeInTheDocument();
        });

        it('should disable test button when email is empty', () => {
            render(<SettingsModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Konto hinzufügen'));

            fireEvent.change(screen.getByPlaceholderText('Email Passwort'), { target: { value: 'password' } });

            const testButton = screen.getByText('Verbindung testen');
            expect(testButton).toBeDisabled();
        });

        it('should disable test button when password is empty', () => {
            render(<SettingsModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Konto hinzufügen'));

            fireEvent.change(screen.getByPlaceholderText('name@gmx.de'), { target: { value: 'test@test.com' } });

            const testButton = screen.getByText('Verbindung testen');
            expect(testButton).toBeDisabled();
        });

        it('should enable test button when email and password are filled', () => {
            render(<SettingsModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Konto hinzufügen'));

            fireEvent.change(screen.getByPlaceholderText('name@gmx.de'), { target: { value: 'test@test.com' } });
            fireEvent.change(screen.getByPlaceholderText('Email Passwort'), { target: { value: 'password' } });

            const testButton = screen.getByText('Verbindung testen');
            expect(testButton).not.toBeDisabled();
        });

        it('should show error message when window.electron is not available', async () => {
            render(<SettingsModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Konto hinzufügen'));

            fireEvent.change(screen.getByPlaceholderText('name@gmx.de'), { target: { value: 'test@test.com' } });
            fireEvent.change(screen.getByPlaceholderText('Email Passwort'), { target: { value: 'password' } });

            await act(async () => {
                fireEvent.click(screen.getByText('Verbindung testen'));
            });

            // Should show web mode error
            expect(screen.getByText('Web Mode: Test nicht möglich')).toBeInTheDocument();
        });
    });

    describe('General Tab', () => {
        it('should show reset database button', () => {
            render(<SettingsModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Allgemein'));

            expect(screen.getByText('Datenbank komplett zurücksetzen & neu starten')).toBeInTheDocument();
        });

        it('should show data management heading', () => {
            render(<SettingsModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Allgemein'));

            expect(screen.getByText('Datenverwaltung')).toBeInTheDocument();
        });
    });

    describe('State Reset on Modal Open', () => {
        it('should sync AI settings from props when modal opens', () => {
            const newAISettings: AISettings = {
                provider: LLMProvider.OPENAI,
                model: 'gpt-4o',
                apiKey: 'some-key'
            };

            const { rerender } = render(<SettingsModal {...defaultProps} isOpen={false} aiSettings={newAISettings} />);

            // Open the modal
            rerender(<SettingsModal {...defaultProps} isOpen={true} aiSettings={newAISettings} />);

            fireEvent.click(screen.getByText('Smart Sort'));

            const selects = screen.getAllByRole('combobox');
            const providerSelect = selects[0];
            expect(providerSelect).toHaveValue(LLMProvider.OPENAI);
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty accounts array', () => {
            render(<SettingsModal {...defaultProps} accounts={[]} />);

            expect(screen.getByText('Verbundene Konten')).toBeInTheDocument();
            expect(screen.getByText('Konto hinzufügen')).toBeInTheDocument();
        });

        it('should display account initial correctly', () => {
            render(<SettingsModal {...defaultProps} />);

            expect(screen.getByText('W')).toBeInTheDocument(); // Work Account
            expect(screen.getByText('P')).toBeInTheDocument(); // Personal
        });

        it('should display IMAP host for accounts', () => {
            render(<SettingsModal {...defaultProps} />);

            expect(screen.getByText(/imap\.gmx\.net/)).toBeInTheDocument();
            expect(screen.getByText(/imap\.gmail\.com/)).toBeInTheDocument();
        });

        it('should assign a random color to new accounts', () => {
            const onAddAccount = vi.fn();
            render(<SettingsModal {...defaultProps} onAddAccount={onAddAccount} />);

            fireEvent.click(screen.getByText('Konto hinzufügen'));

            fireEvent.change(screen.getByPlaceholderText('z.B. Arbeit'), { target: { value: 'Test' } });
            fireEvent.change(screen.getByPlaceholderText('name@gmx.de'), { target: { value: 'test@test.com' } });
            fireEvent.change(screen.getByPlaceholderText('Email Passwort'), { target: { value: 'pass' } });

            fireEvent.click(screen.getByText('Speichern & Verbinden'));

            const calledWith = onAddAccount.mock.calls[0][0];
            expect(['blue', 'green', 'purple', 'amber', 'rose', 'indigo']).toContain(calledWith.color);
        });
    });

    describe('Accessibility', () => {
        it('should have accessible form inputs with labels', () => {
            render(<SettingsModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Konto hinzufügen'));

            expect(screen.getByText('Name (Anzeige)')).toBeInTheDocument();
            expect(screen.getByText('Email Adresse')).toBeInTheDocument();
            expect(screen.getByText('Passwort')).toBeInTheDocument();
        });

        it('should have accessible labels in AI settings', () => {
            render(<SettingsModal {...defaultProps} />);

            fireEvent.click(screen.getByText('Smart Sort'));

            expect(screen.getByText('LLM Anbieter')).toBeInTheDocument();
            expect(screen.getByText('Modell')).toBeInTheDocument();
            expect(screen.getByText('API Key')).toBeInTheDocument();
        });

        it('should have title attribute on remove account button', () => {
            render(<SettingsModal {...defaultProps} />);

            const removeButtons = screen.getAllByTitle('Konto entfernen');
            expect(removeButtons[0]).toHaveAttribute('title', 'Konto entfernen');
        });
    });
});
