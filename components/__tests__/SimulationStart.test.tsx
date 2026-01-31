import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SimulationStart from '../SimulationStart';

describe('SimulationStart', () => {
    const defaultProps = {
        onStart: vi.fn(),
        isConnecting: false
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('should render the main title', () => {
            render(<SimulationStart {...defaultProps} />);
            expect(screen.getByText('GMX AI Sorter')).toBeInTheDocument();
        });

        it('should render the subtitle', () => {
            render(<SimulationStart {...defaultProps} />);
            expect(screen.getByText('Intelligent Email Categorization Prototype')).toBeInTheDocument();
        });

        it('should render the simulation mode warning', () => {
            render(<SimulationStart {...defaultProps} />);
            expect(screen.getByText(/Simulation Mode:/)).toBeInTheDocument();
            expect(screen.getByText(/Direct IMAP access is not possible from a browser/)).toBeInTheDocument();
        });

        it('should render the description text', () => {
            render(<SimulationStart {...defaultProps} />);
            expect(screen.getByText(/Klicken Sie auf "Verbinden"/)).toBeInTheDocument();
        });

        it('should render the powered by footer', () => {
            render(<SimulationStart {...defaultProps} />);
            expect(screen.getByText('Powered by Gemini 3 Flash Preview')).toBeInTheDocument();
        });

        it('should render Mail icon', () => {
            render(<SimulationStart {...defaultProps} />);
            const mailIcon = document.querySelector('.lucide-mail');
            expect(mailIcon).toBeInTheDocument();
        });

        it('should render ShieldAlert icon for warning', () => {
            render(<SimulationStart {...defaultProps} />);
            const shieldIcon = document.querySelector('.lucide-shield-alert');
            expect(shieldIcon).toBeInTheDocument();
        });
    });

    describe('Button State - Not Connecting', () => {
        it('should show connect button text when not connecting', () => {
            render(<SimulationStart {...defaultProps} isConnecting={false} />);
            expect(screen.getByText('Mit Demo-Postfach verbinden')).toBeInTheDocument();
        });

        it('should not show loading text when not connecting', () => {
            render(<SimulationStart {...defaultProps} isConnecting={false} />);
            expect(screen.queryByText('Generiere Postfach...')).not.toBeInTheDocument();
        });

        it('should have enabled button when not connecting', () => {
            render(<SimulationStart {...defaultProps} isConnecting={false} />);
            const button = screen.getByRole('button');
            expect(button).not.toBeDisabled();
        });

        it('should not show loading spinner when not connecting', () => {
            render(<SimulationStart {...defaultProps} isConnecting={false} />);
            // The spinner has animate-spin class
            const spinner = document.querySelector('.animate-spin');
            expect(spinner).not.toBeInTheDocument();
        });
    });

    describe('Button State - Connecting', () => {
        it('should show loading text when connecting', () => {
            render(<SimulationStart {...defaultProps} isConnecting={true} />);
            expect(screen.getByText('Generiere Postfach...')).toBeInTheDocument();
        });

        it('should not show connect button text when connecting', () => {
            render(<SimulationStart {...defaultProps} isConnecting={true} />);
            expect(screen.queryByText('Mit Demo-Postfach verbinden')).not.toBeInTheDocument();
        });

        it('should have disabled button when connecting', () => {
            render(<SimulationStart {...defaultProps} isConnecting={true} />);
            const button = screen.getByRole('button');
            expect(button).toBeDisabled();
        });

        it('should show loading spinner when connecting', () => {
            render(<SimulationStart {...defaultProps} isConnecting={true} />);
            const spinner = document.querySelector('.animate-spin');
            expect(spinner).toBeInTheDocument();
        });

        it('should apply disabled styling to button when connecting', () => {
            render(<SimulationStart {...defaultProps} isConnecting={true} />);
            const button = screen.getByRole('button');
            expect(button).toHaveClass('disabled:opacity-70');
            expect(button).toHaveClass('disabled:cursor-not-allowed');
        });
    });

    describe('Button Interactions', () => {
        it('should call onStart with empty string when button is clicked', () => {
            const onStart = vi.fn();
            render(<SimulationStart {...defaultProps} onStart={onStart} isConnecting={false} />);

            const button = screen.getByRole('button');
            fireEvent.click(button);

            expect(onStart).toHaveBeenCalledTimes(1);
            expect(onStart).toHaveBeenCalledWith('');
        });

        it('should not call onStart when button is clicked while connecting', () => {
            const onStart = vi.fn();
            render(<SimulationStart {...defaultProps} onStart={onStart} isConnecting={true} />);

            const button = screen.getByRole('button');
            fireEvent.click(button);

            // Disabled button click should not trigger handler
            expect(onStart).not.toHaveBeenCalled();
        });

        it('should call onStart only once per click', () => {
            const onStart = vi.fn();
            render(<SimulationStart {...defaultProps} onStart={onStart} isConnecting={false} />);

            const button = screen.getByRole('button');
            fireEvent.click(button);
            fireEvent.click(button);
            fireEvent.click(button);

            expect(onStart).toHaveBeenCalledTimes(3);
        });
    });

    describe('Layout and Styling', () => {
        it('should have correct container background color', () => {
            render(<SimulationStart {...defaultProps} />);
            const container = document.querySelector('.bg-slate-900');
            expect(container).toBeInTheDocument();
        });

        it('should have white card background', () => {
            render(<SimulationStart {...defaultProps} />);
            const card = document.querySelector('.bg-white');
            expect(card).toBeInTheDocument();
        });

        it('should have blue header section', () => {
            render(<SimulationStart {...defaultProps} />);
            const header = document.querySelector('.bg-blue-700');
            expect(header).toBeInTheDocument();
        });

        it('should have amber warning background', () => {
            render(<SimulationStart {...defaultProps} />);
            const warning = document.querySelector('.bg-amber-50');
            expect(warning).toBeInTheDocument();
        });

        it('should have amber left border on warning', () => {
            render(<SimulationStart {...defaultProps} />);
            const warning = document.querySelector('.border-amber-500');
            expect(warning).toBeInTheDocument();
        });

        it('should center content on page', () => {
            render(<SimulationStart {...defaultProps} />);
            const container = document.querySelector('.flex.items-center.justify-center');
            expect(container).toBeInTheDocument();
        });
    });

    describe('Edge Cases', () => {
        it('should handle rapid state changes from not connecting to connecting', () => {
            const { rerender } = render(<SimulationStart {...defaultProps} isConnecting={false} />);

            expect(screen.getByText('Mit Demo-Postfach verbinden')).toBeInTheDocument();

            rerender(<SimulationStart {...defaultProps} isConnecting={true} />);

            expect(screen.getByText('Generiere Postfach...')).toBeInTheDocument();
            expect(screen.queryByText('Mit Demo-Postfach verbinden')).not.toBeInTheDocument();
        });

        it('should handle state change from connecting back to not connecting', () => {
            const { rerender } = render(<SimulationStart {...defaultProps} isConnecting={true} />);

            expect(screen.getByText('Generiere Postfach...')).toBeInTheDocument();

            rerender(<SimulationStart {...defaultProps} isConnecting={false} />);

            expect(screen.getByText('Mit Demo-Postfach verbinden')).toBeInTheDocument();
            expect(screen.queryByText('Generiere Postfach...')).not.toBeInTheDocument();
        });

        it('should work with different onStart callback', () => {
            const onStart1 = vi.fn();
            const onStart2 = vi.fn();
            const { rerender } = render(<SimulationStart {...defaultProps} onStart={onStart1} />);

            const button = screen.getByRole('button');
            fireEvent.click(button);
            expect(onStart1).toHaveBeenCalledTimes(1);

            rerender(<SimulationStart {...defaultProps} onStart={onStart2} />);
            fireEvent.click(button);
            expect(onStart2).toHaveBeenCalledTimes(1);
            expect(onStart1).toHaveBeenCalledTimes(1); // Should not increase
        });
    });

    describe('Accessibility', () => {
        it('should have only one button', () => {
            render(<SimulationStart {...defaultProps} />);
            const buttons = screen.getAllByRole('button');
            expect(buttons).toHaveLength(1);
        });

        it('should have accessible button with visible text', () => {
            render(<SimulationStart {...defaultProps} isConnecting={false} />);
            const button = screen.getByRole('button', { name: 'Mit Demo-Postfach verbinden' });
            expect(button).toBeInTheDocument();
        });

        it('should have heading for main title', () => {
            render(<SimulationStart {...defaultProps} />);
            const heading = screen.getByRole('heading', { name: 'GMX AI Sorter' });
            expect(heading).toBeInTheDocument();
        });

        it('should have strong text for Simulation Mode label', () => {
            render(<SimulationStart {...defaultProps} />);
            const strongText = document.querySelector('strong');
            expect(strongText).toBeInTheDocument();
            expect(strongText).toHaveTextContent('Simulation Mode:');
        });
    });
});
