import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SearchBar, { SearchConfig } from '../SearchBar';

describe('SearchBar', () => {
  const defaultConfig: SearchConfig = {
    searchSender: true,
    searchSubject: true,
    searchBody: true,
    logic: 'AND',
  };

  const defaultProps = {
    searchTerm: '',
    onSearchChange: vi.fn(),
    config: defaultConfig,
    onConfigChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the search input', () => {
      render(<SearchBar {...defaultProps} />);
      const input = screen.getByPlaceholderText('Suchen...');
      expect(input).toBeInTheDocument();
    });

    it('should render with the provided search term', () => {
      render(<SearchBar {...defaultProps} searchTerm="test query" />);
      const input = screen.getByPlaceholderText('Suchen...');
      expect(input).toHaveValue('test query');
    });

    it('should render the filter button', () => {
      render(<SearchBar {...defaultProps} />);
      const filterButton = screen.getByTitle('Suchfilter');
      expect(filterButton).toBeInTheDocument();
    });

    it('should not show clear button when search term is empty', () => {
      render(<SearchBar {...defaultProps} searchTerm="" />);
      // The clear button contains an X icon and is only shown when searchTerm is truthy
      const clearButtons = document.querySelectorAll('button');
      // Only the filter button should be present
      expect(clearButtons).toHaveLength(1);
    });

    it('should show clear button and AI button when search term is not empty', () => {
      render(<SearchBar {...defaultProps} searchTerm="test" />);
      // AI sparkles button, clear button, and filter button should be present
      const buttons = document.querySelectorAll('button');
      expect(buttons).toHaveLength(3);
    });

    it('should not show filter dropdown by default', () => {
      render(<SearchBar {...defaultProps} />);
      expect(screen.queryByText('Suchfelder')).not.toBeInTheDocument();
    });
  });

  describe('Search Input Interactions', () => {
    it('should call onSearchChange when typing in the input', async () => {
      const onSearchChange = vi.fn();
      render(<SearchBar {...defaultProps} onSearchChange={onSearchChange} />);

      const input = screen.getByPlaceholderText('Suchen...');
      fireEvent.change(input, { target: { value: 'new search' } });

      expect(onSearchChange).toHaveBeenCalledWith('new search');
    });

    it('should call onSearchChange with empty string when clear button is clicked', () => {
      const onSearchChange = vi.fn();
      render(<SearchBar {...defaultProps} searchTerm="test" onSearchChange={onSearchChange} />);

      const clearButton = screen.getByRole('button', { name: 'Clear search' });
      fireEvent.click(clearButton);

      expect(onSearchChange).toHaveBeenCalledWith('');
    });
  });

  describe('Filter Dropdown', () => {
    it('should show filter dropdown when filter button is clicked', () => {
      render(<SearchBar {...defaultProps} />);

      const filterButton = screen.getByTitle('Suchfilter');
      fireEvent.click(filterButton);

      expect(screen.getByText('Suchfelder')).toBeInTheDocument();
    });

    it('should hide filter dropdown when filter button is clicked again', () => {
      render(<SearchBar {...defaultProps} />);

      const filterButton = screen.getByTitle('Suchfilter');
      fireEvent.click(filterButton);
      expect(screen.getByText('Suchfelder')).toBeInTheDocument();

      fireEvent.click(filterButton);
      expect(screen.queryByText('Suchfelder')).not.toBeInTheDocument();
    });

    it('should display all filter checkboxes in dropdown', () => {
      render(<SearchBar {...defaultProps} />);

      const filterButton = screen.getByTitle('Suchfilter');
      fireEvent.click(filterButton);

      expect(screen.getByText('Absender')).toBeInTheDocument();
      expect(screen.getByText('Betreff')).toBeInTheDocument();
      expect(screen.getByText('Inhalt (Body)')).toBeInTheDocument();
    });

    it('should display logic toggle buttons in dropdown', () => {
      render(<SearchBar {...defaultProps} />);

      const filterButton = screen.getByTitle('Suchfilter');
      fireEvent.click(filterButton);

      expect(screen.getByText('UND (Alle)')).toBeInTheDocument();
      expect(screen.getByText('ODER')).toBeInTheDocument();
    });

    it('should close dropdown when clicking outside', () => {
      render(
        <div>
          <div data-testid="outside">Outside</div>
          <SearchBar {...defaultProps} />
        </div>
      );

      const filterButton = screen.getByTitle('Suchfilter');
      fireEvent.click(filterButton);
      expect(screen.getByText('Suchfelder')).toBeInTheDocument();

      // Click outside
      const outside = screen.getByTestId('outside');
      fireEvent.mouseDown(outside);

      expect(screen.queryByText('Suchfelder')).not.toBeInTheDocument();
    });
  });

  describe('Filter Checkbox Interactions', () => {
    it('should toggle searchSender when clicked', () => {
      const onConfigChange = vi.fn();
      const config = { ...defaultConfig, searchSender: true };
      render(<SearchBar {...defaultProps} config={config} onConfigChange={onConfigChange} />);

      const filterButton = screen.getByTitle('Suchfilter');
      fireEvent.click(filterButton);

      const absenderCheckbox = screen.getByRole('checkbox', { name: /Absender/i });
      fireEvent.click(absenderCheckbox);

      expect(onConfigChange).toHaveBeenCalledWith({
        ...config,
        searchSender: false,
      });
    });

    it('should toggle searchSubject when clicked', () => {
      const onConfigChange = vi.fn();
      const config = { ...defaultConfig, searchSubject: true };
      render(<SearchBar {...defaultProps} config={config} onConfigChange={onConfigChange} />);

      const filterButton = screen.getByTitle('Suchfilter');
      fireEvent.click(filterButton);

      const betreffCheckbox = screen.getByRole('checkbox', { name: /Betreff/i });
      fireEvent.click(betreffCheckbox);

      expect(onConfigChange).toHaveBeenCalledWith({
        ...config,
        searchSubject: false,
      });
    });

    it('should toggle searchBody when clicked', () => {
      const onConfigChange = vi.fn();
      const config = { ...defaultConfig, searchBody: true };
      render(<SearchBar {...defaultProps} config={config} onConfigChange={onConfigChange} />);

      const filterButton = screen.getByTitle('Suchfilter');
      fireEvent.click(filterButton);

      const bodyCheckbox = screen.getByRole('checkbox', { name: /Inhalt/i });
      fireEvent.click(bodyCheckbox);

      expect(onConfigChange).toHaveBeenCalledWith({
        ...config,
        searchBody: false,
      });
    });

    it('should prevent disabling the last active field', () => {
      const onConfigChange = vi.fn();
      // Only searchSender is active
      const config: SearchConfig = {
        searchSender: true,
        searchSubject: false,
        searchBody: false,
        logic: 'AND',
      };
      render(<SearchBar {...defaultProps} config={config} onConfigChange={onConfigChange} />);

      const filterButton = screen.getByTitle('Suchfilter');
      fireEvent.click(filterButton);

      const absenderCheckbox = screen.getByRole('checkbox', { name: /Absender/i });
      fireEvent.click(absenderCheckbox);

      // onConfigChange should NOT be called since this is the last active field
      expect(onConfigChange).not.toHaveBeenCalled();
    });

    it('should allow enabling a field when another is the only active one', () => {
      const onConfigChange = vi.fn();
      // Only searchSender is active
      const config: SearchConfig = {
        searchSender: true,
        searchSubject: false,
        searchBody: false,
        logic: 'AND',
      };
      render(<SearchBar {...defaultProps} config={config} onConfigChange={onConfigChange} />);

      const filterButton = screen.getByTitle('Suchfilter');
      fireEvent.click(filterButton);

      const betreffCheckbox = screen.getByRole('checkbox', { name: /Betreff/i });
      fireEvent.click(betreffCheckbox);

      expect(onConfigChange).toHaveBeenCalledWith({
        ...config,
        searchSubject: true,
      });
    });

    it('should reflect checkbox state from config prop', () => {
      const config: SearchConfig = {
        searchSender: true,
        searchSubject: false,
        searchBody: true,
        logic: 'AND',
      };
      render(<SearchBar {...defaultProps} config={config} />);

      const filterButton = screen.getByTitle('Suchfilter');
      fireEvent.click(filterButton);

      expect(screen.getByRole('checkbox', { name: /Absender/i })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: /Betreff/i })).not.toBeChecked();
      expect(screen.getByRole('checkbox', { name: /Inhalt/i })).toBeChecked();
    });
  });

  describe('Logic Toggle Interactions', () => {
    it('should call onConfigChange with OR logic when ODER button is clicked', () => {
      const onConfigChange = vi.fn();
      const config = { ...defaultConfig, logic: 'AND' as const };
      render(<SearchBar {...defaultProps} config={config} onConfigChange={onConfigChange} />);

      const filterButton = screen.getByTitle('Suchfilter');
      fireEvent.click(filterButton);

      const orButton = screen.getByText('ODER');
      fireEvent.click(orButton);

      expect(onConfigChange).toHaveBeenCalledWith({
        ...config,
        logic: 'OR',
      });
    });

    it('should call onConfigChange with AND logic when UND button is clicked', () => {
      const onConfigChange = vi.fn();
      const config = { ...defaultConfig, logic: 'OR' as const };
      render(<SearchBar {...defaultProps} config={config} onConfigChange={onConfigChange} />);

      const filterButton = screen.getByTitle('Suchfilter');
      fireEvent.click(filterButton);

      const andButton = screen.getByText('UND (Alle)');
      fireEvent.click(andButton);

      expect(onConfigChange).toHaveBeenCalledWith({
        ...config,
        logic: 'AND',
      });
    });

    it('should highlight AND button when logic is AND', () => {
      const config = { ...defaultConfig, logic: 'AND' as const };
      render(<SearchBar {...defaultProps} config={config} />);

      const filterButton = screen.getByTitle('Suchfilter');
      fireEvent.click(filterButton);

      const andButton = screen.getByText('UND (Alle)');
      expect(andButton).toHaveClass('text-blue-600');
    });

    it('should highlight OR button when logic is OR', () => {
      const config = { ...defaultConfig, logic: 'OR' as const };
      render(<SearchBar {...defaultProps} config={config} />);

      const filterButton = screen.getByTitle('Suchfilter');
      fireEvent.click(filterButton);

      const orButton = screen.getByText('ODER');
      expect(orButton).toHaveClass('text-blue-600');
    });
  });

  describe('Filter Button Styling', () => {
    it('should have active styling when dropdown is open', () => {
      render(<SearchBar {...defaultProps} />);

      const filterButton = screen.getByTitle('Suchfilter');
      fireEvent.click(filterButton);

      expect(filterButton).toHaveClass('bg-blue-100');
      expect(filterButton).toHaveClass('text-blue-600');
    });

    it('should not have active styling when dropdown is closed', () => {
      render(<SearchBar {...defaultProps} />);

      const filterButton = screen.getByTitle('Suchfilter');

      expect(filterButton).not.toHaveClass('bg-blue-100');
      expect(filterButton).toHaveClass('text-slate-400');
    });
  });

  describe('Accessibility', () => {
    it('should have accessible input with placeholder', () => {
      render(<SearchBar {...defaultProps} />);
      const input = screen.getByPlaceholderText('Suchen...');
      expect(input).toHaveAttribute('type', 'text');
    });

    it('should have accessible checkboxes in filter dropdown', () => {
      render(<SearchBar {...defaultProps} />);

      const filterButton = screen.getByTitle('Suchfilter');
      fireEvent.click(filterButton);

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(3);
    });

    it('should have title attribute on filter button', () => {
      render(<SearchBar {...defaultProps} />);
      const filterButton = screen.getByTitle('Suchfilter');
      expect(filterButton).toHaveAttribute('title', 'Suchfilter');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty search term correctly', () => {
      render(<SearchBar {...defaultProps} searchTerm="" />);
      const input = screen.getByPlaceholderText('Suchen...');
      expect(input).toHaveValue('');
    });

    it('should handle search term with special characters', () => {
      const onSearchChange = vi.fn();
      render(<SearchBar {...defaultProps} onSearchChange={onSearchChange} />);

      const input = screen.getByPlaceholderText('Suchen...');
      fireEvent.change(input, { target: { value: 'test@example.com <script>' } });

      expect(onSearchChange).toHaveBeenCalledWith('test@example.com <script>');
    });

    it('should handle rapid filter toggles', () => {
      const onConfigChange = vi.fn();
      render(<SearchBar {...defaultProps} onConfigChange={onConfigChange} />);

      const filterButton = screen.getByTitle('Suchfilter');

      // Rapid toggles
      fireEvent.click(filterButton);
      fireEvent.click(filterButton);
      fireEvent.click(filterButton);

      // Should toggle open -> closed -> open
      expect(screen.getByText('Suchfelder')).toBeInTheDocument();
    });

    it('should maintain dropdown state after config change', () => {
      const onConfigChange = vi.fn();
      render(<SearchBar {...defaultProps} onConfigChange={onConfigChange} />);

      const filterButton = screen.getByTitle('Suchfilter');
      fireEvent.click(filterButton);

      const betreffCheckbox = screen.getByRole('checkbox', { name: /Betreff/i });
      fireEvent.click(betreffCheckbox);

      // Dropdown should still be open after config change
      expect(screen.getByText('Suchfelder')).toBeInTheDocument();
    });
  });
});
