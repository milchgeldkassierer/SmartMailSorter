import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SavedFilterDialog from '../SavedFilterDialog';

describe('SavedFilterDialog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSave: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Modal Rendering', () => {
    it('should not render when isOpen is false', () => {
      render(<SavedFilterDialog {...defaultProps} isOpen={false} />);
      expect(screen.queryByText('Suchfilter speichern')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      render(<SavedFilterDialog {...defaultProps} />);
      expect(screen.getByText('Suchfilter speichern')).toBeInTheDocument();
    });

    it('should render edit title when mode is edit', () => {
      render(<SavedFilterDialog {...defaultProps} mode="edit" />);
      expect(screen.getByText('Suchfilter bearbeiten')).toBeInTheDocument();
    });

    it('should render the close button', () => {
      render(<SavedFilterDialog {...defaultProps} />);
      const closeButton = screen.getByTestId('close-button');
      expect(closeButton).toBeInTheDocument();
    });

    it('should call onClose when close button is clicked', () => {
      render(<SavedFilterDialog {...defaultProps} />);
      const closeButton = screen.getByTestId('close-button');

      fireEvent.click(closeButton);
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Form Inputs', () => {
    it('should render name input', () => {
      render(<SavedFilterDialog {...defaultProps} />);
      const nameInput = screen.getByLabelText('Filtername');
      expect(nameInput).toBeInTheDocument();
    });

    it('should render query input', () => {
      render(<SavedFilterDialog {...defaultProps} />);
      const queryInput = screen.getByLabelText('Suchanfrage');
      expect(queryInput).toBeInTheDocument();
    });

    it('should populate inputs with initial values', () => {
      render(<SavedFilterDialog {...defaultProps} initialName="Test Filter" initialQuery="from:amazon" />);
      const nameInput = screen.getByLabelText('Filtername') as HTMLInputElement;
      const queryInput = screen.getByLabelText('Suchanfrage') as HTMLInputElement;

      expect(nameInput.value).toBe('Test Filter');
      expect(queryInput.value).toBe('from:amazon');
    });

    it('should update name input value on change', () => {
      render(<SavedFilterDialog {...defaultProps} />);
      const nameInput = screen.getByLabelText('Filtername') as HTMLInputElement;

      fireEvent.change(nameInput, { target: { value: 'New Filter' } });
      expect(nameInput.value).toBe('New Filter');
    });

    it('should update query input value on change', () => {
      render(<SavedFilterDialog {...defaultProps} />);
      const queryInput = screen.getByLabelText('Suchanfrage') as HTMLInputElement;

      fireEvent.change(queryInput, { target: { value: 'category:Rechnungen' } });
      expect(queryInput.value).toBe('category:Rechnungen');
    });
  });

  describe('Form Validation', () => {
    it('should show error when name is empty and save is clicked', () => {
      render(<SavedFilterDialog {...defaultProps} />);
      const saveButton = screen.getByText('Filter speichern');

      fireEvent.click(saveButton);
      expect(screen.getByText('Filtername ist erforderlich')).toBeInTheDocument();
      expect(defaultProps.onSave).not.toHaveBeenCalled();
    });

    it('should show error when query is empty and save is clicked', () => {
      render(<SavedFilterDialog {...defaultProps} />);
      const nameInput = screen.getByLabelText('Filtername');
      const saveButton = screen.getByText('Filter speichern');

      fireEvent.change(nameInput, { target: { value: 'Test' } });
      fireEvent.click(saveButton);

      expect(screen.getByText('Suchanfrage ist erforderlich')).toBeInTheDocument();
      expect(defaultProps.onSave).not.toHaveBeenCalled();
    });

    it('should call onSave with trimmed values when form is valid', () => {
      render(<SavedFilterDialog {...defaultProps} />);
      const nameInput = screen.getByLabelText('Filtername');
      const queryInput = screen.getByLabelText('Suchanfrage');
      const saveButton = screen.getByText('Filter speichern');

      fireEvent.change(nameInput, { target: { value: '  Test Filter  ' } });
      fireEvent.change(queryInput, { target: { value: '  from:amazon  ' } });
      fireEvent.click(saveButton);

      expect(defaultProps.onSave).toHaveBeenCalledWith('Test Filter', 'from:amazon');
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('should clear error when user starts typing in name field', () => {
      render(<SavedFilterDialog {...defaultProps} />);
      const nameInput = screen.getByLabelText('Filtername');
      const saveButton = screen.getByText('Filter speichern');

      // Trigger validation error
      fireEvent.click(saveButton);
      expect(screen.getByText('Filtername ist erforderlich')).toBeInTheDocument();

      // Start typing
      fireEvent.change(nameInput, { target: { value: 'T' } });
      expect(screen.queryByText('Filtername ist erforderlich')).not.toBeInTheDocument();
    });

    it('should clear error when user starts typing in query field', () => {
      render(<SavedFilterDialog {...defaultProps} />);
      const nameInput = screen.getByLabelText('Filtername');
      const queryInput = screen.getByLabelText('Suchanfrage');
      const saveButton = screen.getByText('Filter speichern');

      // Fill name and trigger query validation error
      fireEvent.change(nameInput, { target: { value: 'Test' } });
      fireEvent.click(saveButton);
      expect(screen.getByText('Suchanfrage ist erforderlich')).toBeInTheDocument();

      // Start typing in query
      fireEvent.change(queryInput, { target: { value: 'f' } });
      expect(screen.queryByText('Suchanfrage ist erforderlich')).not.toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call onClose when cancel button is clicked', () => {
      render(<SavedFilterDialog {...defaultProps} />);
      const cancelButton = screen.getByText('Abbrechen');

      fireEvent.click(cancelButton);
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('should submit form when Enter is pressed in name input', () => {
      render(<SavedFilterDialog {...defaultProps} />);
      const nameInput = screen.getByLabelText('Filtername');
      const queryInput = screen.getByLabelText('Suchanfrage');

      fireEvent.change(nameInput, { target: { value: 'Test Filter' } });
      fireEvent.change(queryInput, { target: { value: 'from:test' } });
      fireEvent.keyDown(nameInput, { key: 'Enter', code: 'Enter' });

      expect(defaultProps.onSave).toHaveBeenCalledWith('Test Filter', 'from:test');
    });

    it('should submit form when Enter is pressed in query input', () => {
      render(<SavedFilterDialog {...defaultProps} />);
      const nameInput = screen.getByLabelText('Filtername');
      const queryInput = screen.getByLabelText('Suchanfrage');

      fireEvent.change(nameInput, { target: { value: 'Test Filter' } });
      fireEvent.change(queryInput, { target: { value: 'from:test' } });
      fireEvent.keyDown(queryInput, { key: 'Enter', code: 'Enter' });

      expect(defaultProps.onSave).toHaveBeenCalledWith('Test Filter', 'from:test');
    });
  });

  describe('Help Text', () => {
    it('should display help text about search operators', () => {
      render(<SavedFilterDialog {...defaultProps} />);
      expect(screen.getByText(/Verwenden Sie Suchoperatoren wie from:, to:, subject:/)).toBeInTheDocument();
    });
  });

  describe('Button Labels', () => {
    it('should show "Filter speichern" button in create mode', () => {
      render(<SavedFilterDialog {...defaultProps} mode="create" />);
      expect(screen.getByText('Filter speichern')).toBeInTheDocument();
    });

    it('should show "Filter aktualisieren" button in edit mode', () => {
      render(<SavedFilterDialog {...defaultProps} mode="edit" />);
      expect(screen.getByText('Filter aktualisieren')).toBeInTheDocument();
    });
  });
});
