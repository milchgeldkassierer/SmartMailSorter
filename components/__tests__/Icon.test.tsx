import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CategoryIcon } from '../Icon';
import { DefaultEmailCategory } from '../../types';

describe('CategoryIcon', () => {
    describe('Default Email Categories', () => {
        it('should render Inbox icon for INBOX category', () => {
            render(<CategoryIcon category={DefaultEmailCategory.INBOX} />);
            const svg = document.querySelector('svg');
            expect(svg).toBeInTheDocument();
            expect(svg).toHaveClass('lucide-inbox');
        });

        it('should render ShieldAlert icon for SPAM category', () => {
            render(<CategoryIcon category={DefaultEmailCategory.SPAM} />);
            const svg = document.querySelector('svg');
            expect(svg).toBeInTheDocument();
            expect(svg).toHaveClass('lucide-shield-alert');
        });

        it('should render FileText icon for INVOICE category', () => {
            render(<CategoryIcon category={DefaultEmailCategory.INVOICE} />);
            const svg = document.querySelector('svg');
            expect(svg).toBeInTheDocument();
            expect(svg).toHaveClass('lucide-file-text');
        });

        it('should render Mail icon for NEWSLETTER category', () => {
            render(<CategoryIcon category={DefaultEmailCategory.NEWSLETTER} />);
            const svg = document.querySelector('svg');
            expect(svg).toBeInTheDocument();
            expect(svg).toHaveClass('lucide-mail');
        });

        it('should render User icon for PRIVATE category', () => {
            render(<CategoryIcon category={DefaultEmailCategory.PRIVATE} />);
            const svg = document.querySelector('svg');
            expect(svg).toBeInTheDocument();
            expect(svg).toHaveClass('lucide-user');
        });

        it('should render Briefcase icon for BUSINESS category', () => {
            render(<CategoryIcon category={DefaultEmailCategory.BUSINESS} />);
            const svg = document.querySelector('svg');
            expect(svg).toBeInTheDocument();
            expect(svg).toHaveClass('lucide-briefcase');
        });

        it('should render XOctagon icon for CANCELLATION category', () => {
            render(<CategoryIcon category={DefaultEmailCategory.CANCELLATION} />);
            const svg = document.querySelector('svg');
            expect(svg).toBeInTheDocument();
            expect(svg).toHaveClass('lucide-octagon-x');
        });

        it('should render Archive icon for OTHER category', () => {
            render(<CategoryIcon category={DefaultEmailCategory.OTHER} />);
            const svg = document.querySelector('svg');
            expect(svg).toBeInTheDocument();
            expect(svg).toHaveClass('lucide-archive');
        });
    });

    describe('German Folder Names', () => {
        it('should render Send icon for Gesendet folder', () => {
            render(<CategoryIcon category="Gesendet" />);
            const svg = document.querySelector('svg');
            expect(svg).toBeInTheDocument();
            expect(svg).toHaveClass('lucide-send');
        });

        it('should render Trash2 icon for Papierkorb folder', () => {
            render(<CategoryIcon category="Papierkorb" />);
            const svg = document.querySelector('svg');
            expect(svg).toBeInTheDocument();
            expect(svg).toHaveClass('lucide-trash-2');
        });

        it('should render ShieldAlert icon for Spam folder', () => {
            render(<CategoryIcon category="Spam" />);
            const svg = document.querySelector('svg');
            expect(svg).toBeInTheDocument();
            expect(svg).toHaveClass('lucide-shield-alert');
        });
    });

    describe('Dynamic Travel Categories', () => {
        it('should render Plane icon for Reise category', () => {
            render(<CategoryIcon category="Reise" />);
            const svg = document.querySelector('svg');
            expect(svg).toBeInTheDocument();
            expect(svg).toHaveClass('lucide-plane');
        });

        it('should render Plane icon for Reisen category', () => {
            render(<CategoryIcon category="Reisen" />);
            const svg = document.querySelector('svg');
            expect(svg).toBeInTheDocument();
            expect(svg).toHaveClass('lucide-plane');
        });
    });

    describe('Dynamic Education Categories', () => {
        it('should render GraduationCap icon for Schule category', () => {
            render(<CategoryIcon category="Schule" />);
            const svg = document.querySelector('svg');
            expect(svg).toBeInTheDocument();
            expect(svg).toHaveClass('lucide-graduation-cap');
        });

        it('should render GraduationCap icon for Bildung category', () => {
            render(<CategoryIcon category="Bildung" />);
            const svg = document.querySelector('svg');
            expect(svg).toBeInTheDocument();
            expect(svg).toHaveClass('lucide-graduation-cap');
        });
    });

    describe('Dynamic Shopping Categories', () => {
        it('should render ShoppingBag icon for Bestellungen category', () => {
            render(<CategoryIcon category="Bestellungen" />);
            const svg = document.querySelector('svg');
            expect(svg).toBeInTheDocument();
            expect(svg).toHaveClass('lucide-shopping-bag');
        });

        it('should render ShoppingBag icon for Shopping category', () => {
            render(<CategoryIcon category="Shopping" />);
            const svg = document.querySelector('svg');
            expect(svg).toBeInTheDocument();
            expect(svg).toHaveClass('lucide-shopping-bag');
        });
    });

    describe('Fallback Behavior', () => {
        it('should render FolderPlus icon for unknown categories', () => {
            render(<CategoryIcon category="UnknownCategory123" />);
            const svg = document.querySelector('svg');
            expect(svg).toBeInTheDocument();
            expect(svg).toHaveClass('lucide-folder-plus');
        });

        it('should render FolderPlus icon for empty string', () => {
            render(<CategoryIcon category="" />);
            const svg = document.querySelector('svg');
            expect(svg).toBeInTheDocument();
            expect(svg).toHaveClass('lucide-folder-plus');
        });

        it('should render FolderPlus icon for custom dynamic category', () => {
            render(<CategoryIcon category="NeueKategorie" />);
            const svg = document.querySelector('svg');
            expect(svg).toBeInTheDocument();
            expect(svg).toHaveClass('lucide-folder-plus');
        });
    });

    describe('className Prop', () => {
        it('should apply className to the icon', () => {
            render(<CategoryIcon category={DefaultEmailCategory.INBOX} className="w-4 h-4 text-blue-500" />);
            const svg = document.querySelector('svg');
            expect(svg).toBeInTheDocument();
            expect(svg).toHaveClass('w-4');
            expect(svg).toHaveClass('h-4');
            expect(svg).toHaveClass('text-blue-500');
        });

        it('should work without className prop', () => {
            render(<CategoryIcon category={DefaultEmailCategory.INBOX} />);
            const svg = document.querySelector('svg');
            expect(svg).toBeInTheDocument();
            // Should render without errors
        });

        it('should apply className to fallback icon', () => {
            render(<CategoryIcon category="SomeNewCategory" className="custom-class" />);
            const svg = document.querySelector('svg');
            expect(svg).toBeInTheDocument();
            expect(svg).toHaveClass('custom-class');
        });

        it('should apply className to German folder icons', () => {
            render(<CategoryIcon category="Gesendet" className="icon-style" />);
            const svg = document.querySelector('svg');
            expect(svg).toBeInTheDocument();
            expect(svg).toHaveClass('icon-style');
        });

        it('should apply className to dynamic category icons', () => {
            render(<CategoryIcon category="Reisen" className="travel-icon" />);
            const svg = document.querySelector('svg');
            expect(svg).toBeInTheDocument();
            expect(svg).toHaveClass('travel-icon');
        });
    });

    describe('All Categories Coverage', () => {
        const allCategories = [
            { category: DefaultEmailCategory.INBOX, expectedClass: 'lucide-inbox' },
            { category: DefaultEmailCategory.SPAM, expectedClass: 'lucide-shield-alert' },
            { category: DefaultEmailCategory.INVOICE, expectedClass: 'lucide-file-text' },
            { category: DefaultEmailCategory.NEWSLETTER, expectedClass: 'lucide-mail' },
            { category: DefaultEmailCategory.PRIVATE, expectedClass: 'lucide-user' },
            { category: DefaultEmailCategory.BUSINESS, expectedClass: 'lucide-briefcase' },
            { category: DefaultEmailCategory.CANCELLATION, expectedClass: 'lucide-octagon-x' },
            { category: DefaultEmailCategory.OTHER, expectedClass: 'lucide-archive' },
            { category: 'Gesendet', expectedClass: 'lucide-send' },
            { category: 'Papierkorb', expectedClass: 'lucide-trash-2' },
            { category: 'Spam', expectedClass: 'lucide-shield-alert' },
            { category: 'Reise', expectedClass: 'lucide-plane' },
            { category: 'Reisen', expectedClass: 'lucide-plane' },
            { category: 'Schule', expectedClass: 'lucide-graduation-cap' },
            { category: 'Bildung', expectedClass: 'lucide-graduation-cap' },
            { category: 'Bestellungen', expectedClass: 'lucide-shopping-bag' },
            { category: 'Shopping', expectedClass: 'lucide-shopping-bag' },
        ];

        it.each(allCategories)(
            'should render correct icon for "$category"',
            ({ category, expectedClass }) => {
                render(<CategoryIcon category={category} />);
                const svg = document.querySelector('svg');
                expect(svg).toBeInTheDocument();
                expect(svg).toHaveClass(expectedClass);
            }
        );
    });
});
