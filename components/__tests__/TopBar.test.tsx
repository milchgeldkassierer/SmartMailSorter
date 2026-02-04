import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TopBar from '../TopBar';
import { SearchConfig } from '../SearchBar';
import { DefaultEmailCategory } from '../../types';

describe('TopBar', () => {
    const defaultSearchConfig: SearchConfig = {
        searchSender: true,
        searchSubject: true,
        searchBody: true,
        logic: 'AND'
    };

    const defaultProps = {
        selectedCategory: DefaultEmailCategory.INBOX,
        filteredEmailsCount: 10,
        searchTerm: '',
        onSearchChange: vi.fn(),
        searchConfig: defaultSearchConfig,
        onSearchConfigChange: vi.fn(),
        showUnsortedOnly: false,
        onToggleUnsorted: vi.fn(),
        onSync: vi.fn(),
        isSorting: false
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('should render the category name and count', () => {
            render(<TopBar {...defaultProps} />);
            expect(screen.getByText(DefaultEmailCategory.INBOX)).toBeInTheDocument();
            expect(screen.getByText('(10)')).toBeInTheDocument();
        });

        it('should render with different category', () => {
            render(<TopBar {...defaultProps} selectedCategory="Sent" />);
            expect(screen.getByText("Sent")).toBeInTheDocument();
        });

        it('should render the sync button', () => {
            render(<TopBar {...defaultProps} />);
            const syncButton = screen.getByTitle('Emails abrufen');
            expect(syncButton).toBeInTheDocument();
        });

        it('should render the SearchBar component', () => {
            render(<TopBar {...defaultProps} />);
            expect(screen.getByPlaceholderText('Suchen...')).toBeInTheDocument();
        });

        it('should render "Nur unsortierte" button when category is INBOX', () => {
            render(<TopBar {...defaultProps} selectedCategory={DefaultEmailCategory.INBOX} />);
            expect(screen.getByText('Nur unsortierte')).toBeInTheDocument();
        });

        it('should not render "Nur unsortierte" button when category is not INBOX', () => {
            render(<TopBar {...defaultProps} selectedCategory="Sent" />);
            expect(screen.queryByText('Nur unsortierte')).not.toBeInTheDocument();
        });

        it('should show "Suchergebnisse" when search term is active', () => {
            render(<TopBar {...defaultProps} searchTerm="test" />);
            expect(screen.getByText('Suchergebnisse')).toBeInTheDocument();
            expect(screen.queryByText(DefaultEmailCategory.INBOX)).not.toBeInTheDocument();
        });

        it('should not show "Nur unsortierte" button when searching', () => {
            render(<TopBar {...defaultProps} searchTerm="test" />);
            expect(screen.queryByText('Nur unsortierte')).not.toBeInTheDocument();
        });
    });

    describe('Unsorted Filter Toggle', () => {
        it('should call onToggleUnsorted when "Nur unsortierte" button is clicked', () => {
            const onToggleUnsorted = vi.fn();
            render(<TopBar {...defaultProps} onToggleUnsorted={onToggleUnsorted} />);

            const button = screen.getByText('Nur unsortierte').closest('button');
            fireEvent.click(button!);

            expect(onToggleUnsorted).toHaveBeenCalledTimes(1);
        });

        it('should apply active styles when showUnsortedOnly is true', () => {
            render(<TopBar {...defaultProps} showUnsortedOnly={true} />);
            const button = screen.getByText('Nur unsortierte').closest('button');
            expect(button).toHaveClass('bg-blue-100', 'text-blue-700', 'border-blue-200');
        });

        it('should apply inactive styles when showUnsortedOnly is false', () => {
            render(<TopBar {...defaultProps} showUnsortedOnly={false} />);
            const button = screen.getByText('Nur unsortierte').closest('button');
            expect(button).toHaveClass('bg-white', 'text-slate-500', 'border-slate-200');
        });
    });

    describe('Sync Button', () => {
        it('should call onSync when sync button is clicked', () => {
            const onSync = vi.fn();
            render(<TopBar {...defaultProps} onSync={onSync} />);

            const syncButton = screen.getByTitle('Emails abrufen');
            fireEvent.click(syncButton);

            expect(onSync).toHaveBeenCalledTimes(1);
        });

        it('should be disabled when isSorting is true', () => {
            render(<TopBar {...defaultProps} isSorting={true} />);
            const syncButton = screen.getByTitle('Emails abrufen');
            expect(syncButton).toBeDisabled();
        });

        it('should not be disabled when isSorting is false', () => {
            render(<TopBar {...defaultProps} isSorting={false} />);
            const syncButton = screen.getByTitle('Emails abrufen');
            expect(syncButton).not.toBeDisabled();
        });

        it('should have animate-spin class when isSorting is true', () => {
            render(<TopBar {...defaultProps} isSorting={true} />);
            const syncButton = screen.getByTitle('Emails abrufen');
            const svg = syncButton.querySelector('svg');
            expect(svg).toHaveClass('animate-spin');
        });

        it('should not have animate-spin class when isSorting is false', () => {
            render(<TopBar {...defaultProps} isSorting={false} />);
            const syncButton = screen.getByTitle('Emails abrufen');
            const svg = syncButton.querySelector('svg');
            expect(svg).not.toHaveClass('animate-spin');
        });
    });

    describe('Search Integration', () => {
        it('should pass searchTerm to SearchBar', () => {
            render(<TopBar {...defaultProps} searchTerm="test query" />);
            const searchInput = screen.getByPlaceholderText('Suchen...');
            expect(searchInput).toHaveValue('test query');
        });

        it('should pass onSearchChange to SearchBar', () => {
            const onSearchChange = vi.fn();
            render(<TopBar {...defaultProps} onSearchChange={onSearchChange} />);

            const searchInput = screen.getByPlaceholderText('Suchen...');
            fireEvent.change(searchInput, { target: { value: 'new search' } });

            expect(onSearchChange).toHaveBeenCalledWith('new search');
        });

        it('should pass searchConfig to SearchBar', () => {
            const customConfig: SearchConfig = {
                searchSender: false,
                searchSubject: true,
                searchBody: false,
                logic: 'OR'
            };
            render(<TopBar {...defaultProps} searchConfig={customConfig} />);
            // SearchBar is rendered with the config
            expect(screen.getByPlaceholderText('Suchen...')).toBeInTheDocument();
        });

        it('should pass onSearchConfigChange to SearchBar', () => {
            const onSearchConfigChange = vi.fn();
            render(<TopBar {...defaultProps} onSearchConfigChange={onSearchConfigChange} />);

            // Open filter dropdown
            const filterButton = screen.getByTitle('Suchfilter');
            fireEvent.click(filterButton);

            // Toggle a checkbox
            const absenderCheckbox = screen.getByRole('checkbox', { name: /Absender/i });
            fireEvent.click(absenderCheckbox);

            expect(onSearchConfigChange).toHaveBeenCalled();
        });
    });

    describe('Dynamic Content', () => {
        it('should update email count display', () => {
            const { rerender } = render(<TopBar {...defaultProps} filteredEmailsCount={5} />);
            expect(screen.getByText('(5)')).toBeInTheDocument();

            rerender(<TopBar {...defaultProps} filteredEmailsCount={20} />);
            expect(screen.getByText('(20)')).toBeInTheDocument();
        });

        it('should switch between category view and search results view', () => {
            const { rerender } = render(<TopBar {...defaultProps} searchTerm="" />);
            expect(screen.getByText(DefaultEmailCategory.INBOX)).toBeInTheDocument();

            rerender(<TopBar {...defaultProps} searchTerm="test" />);
            expect(screen.getByText('Suchergebnisse')).toBeInTheDocument();
            expect(screen.queryByText(DefaultEmailCategory.INBOX)).not.toBeInTheDocument();
        });
    });
});
