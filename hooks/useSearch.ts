import { useState, useMemo } from 'react';
import { Email } from '../types';
import { SearchConfig } from '../components/SearchBar';

interface UseSearchReturn {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  searchConfig: SearchConfig;
  setSearchConfig: (config: SearchConfig) => void;
  applySearch: (emails: Email[]) => Email[];
}

export const useSearch = (): UseSearchReturn => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchConfig, setSearchConfig] = useState<SearchConfig>({
    searchSender: true,
    searchSubject: true,
    searchBody: false,
    logic: 'AND'
  });

  const applySearch = useMemo(() => {
    return (emails: Email[]) => {
      if (!searchTerm.trim()) {
        return emails;
      }

      const terms = searchTerm.toLowerCase().split(' ').filter(t => t.length > 0);
      return emails.filter(email => {
        const checkTerm = (term: string) => {
          const inSender = searchConfig.searchSender && (
            email.sender.toLowerCase().includes(term) ||
            email.senderEmail.toLowerCase().includes(term)
          );
          const inSubject = searchConfig.searchSubject && email.subject.toLowerCase().includes(term);
          const inBody = searchConfig.searchBody && email.body.toLowerCase().includes(term);
          return inSender || inSubject || inBody;
        };
        return searchConfig.logic === 'AND' ? terms.every(checkTerm) : terms.some(checkTerm);
      });
    };
  }, [searchTerm, searchConfig]);

  return {
    searchTerm,
    setSearchTerm,
    searchConfig,
    setSearchConfig,
    applySearch
  };
};
