// React Testing Library setup file for component tests
// This file is automatically loaded before each test via vitest.config.components.ts

import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll } from 'vitest';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Extend Vitest's expect with jest-dom matchers
import '@testing-library/jest-dom/vitest';

// Initialize i18next for testing with inline resources
// This avoids the need to load translation files during tests
beforeAll(async () => {
  await i18n
    .use(initReactI18next)
    .init({
      lng: 'de', // Default to German for tests
      fallbackLng: 'de',
      defaultNS: 'translation',
      ns: ['translation', 'categories'],

      // Inline resources for testing - minimal set of commonly used translations
      resources: {
        de: {
          translation: {
            common: {
              save: 'Speichern',
              cancel: 'Abbrechen',
              delete: 'Löschen',
              rename: 'Umbenennen',
              ok: 'OK',
              close: 'Schließen',
              add: 'Hinzufügen',
              edit: 'Bearbeiten',
              remove: 'Entfernen',
              test: 'Testen',
              connect: 'Verbinden',
              connected: 'Verbunden',
              unknown: 'Unbekannt',
              error: 'Fehler',
              settings: 'Einstellungen',
              logout: 'Logout',
            },
            sidebar: {
              noAccount: 'Kein Konto',
              pleaseSetup: 'Bitte einrichten',
              neverSynced: 'Noch nie synchronisiert',
              manageAccounts: 'Konten verwalten',
              folders: 'Ordner',
              markings: 'Markierungen',
              starred: 'Markierte',
              smartMailbox: 'Intelligentes Postfach',
              createNewFolder: 'Neuen Ordner erstellen',
              aiCategories: 'KI Kategorien',
              other: 'Sonstiges',
              storage: 'Speicher',
            },
            settingsModal: {
              title: 'Einstellungen',
              tabs: {
                accounts: 'IMAP Konten',
                smartSort: 'Smart Sort',
                general: 'Allgemein',
              },
            },
            topBar: {
              searchPlaceholder: 'Suchen...',
              sort: {
                newest: 'Neueste zuerst',
                oldest: 'Älteste zuerst',
                sender: 'Nach Absender',
              },
            },
            search: {
              placeholder: 'Suchen...',
              noResults: 'Keine Ergebnisse gefunden',
            },
            emailList: {
              noEmails: 'Keine E-Mails',
              selectAll: 'Alle auswählen',
              deselectAll: 'Alle abwählen',
            },
            emailView: {
              from: 'Von',
              to: 'An',
              cc: 'CC',
              date: 'Datum',
              attachments: 'Anhänge',
              noEmailSelected: 'Keine E-Mail ausgewählt',
            },
            batchActions: {
              selectedCount_one: '{{count}} ausgewählt',
              selectedCount_other: '{{count}} ausgewählt',
              markAsRead: 'Als gelesen markieren',
              markAsUnread: 'Als ungelesen markieren',
              delete: 'Löschen',
              archive: 'Archivieren',
            },
            dialogs: {
              confirmDelete: 'Löschen bestätigen',
              confirmDeleteMessage: 'Möchten Sie wirklich {{count}} E-Mail(s) löschen?',
            },
          },
          categories: {
            categories: {
              INBOX: 'Posteingang',
              SENT: 'Gesendet',
              SPAM: 'Spam',
              TRASH: 'Papierkorb',
              INVOICE: 'Rechnungen',
              NEWSLETTER: 'Newsletter',
              PRIVATE: 'Privat',
              BUSINESS: 'Geschäftlich',
              CANCELLATION: 'Kündigungen',
              OTHER: 'Sonstiges',
            },
          },
        },
        en: {
          translation: {
            common: {
              save: 'Save',
              cancel: 'Cancel',
              delete: 'Delete',
              rename: 'Rename',
              ok: 'OK',
              close: 'Close',
              add: 'Add',
              edit: 'Edit',
              remove: 'Remove',
              test: 'Test',
              connect: 'Connect',
              connected: 'Connected',
              unknown: 'Unknown',
              error: 'Error',
              settings: 'Settings',
              logout: 'Logout',
            },
            sidebar: {
              noAccount: 'No Account',
              pleaseSetup: 'Please set up',
              neverSynced: 'Never synced',
              manageAccounts: 'Manage Accounts',
              folders: 'Folders',
              markings: 'Labels',
              starred: 'Starred',
              smartMailbox: 'Smart Mailbox',
              createNewFolder: 'Create New Folder',
              aiCategories: 'AI Categories',
              other: 'Other',
              storage: 'Storage',
            },
            settingsModal: {
              title: 'Settings',
              tabs: {
                accounts: 'IMAP Accounts',
                smartSort: 'Smart Sort',
                general: 'General',
              },
            },
            topBar: {
              searchPlaceholder: 'Search...',
              sort: {
                newest: 'Newest first',
                oldest: 'Oldest first',
                sender: 'By sender',
              },
            },
            search: {
              placeholder: 'Search...',
              noResults: 'No results found',
            },
            emailList: {
              noEmails: 'No emails',
              selectAll: 'Select all',
              deselectAll: 'Deselect all',
            },
            emailView: {
              from: 'From',
              to: 'To',
              cc: 'CC',
              date: 'Date',
              attachments: 'Attachments',
              noEmailSelected: 'No email selected',
            },
            batchActions: {
              selectedCount_one: '{{count}} selected',
              selectedCount_other: '{{count}} selected',
              markAsRead: 'Mark as read',
              markAsUnread: 'Mark as unread',
              delete: 'Delete',
              archive: 'Archive',
            },
            dialogs: {
              confirmDelete: 'Confirm Delete',
              confirmDeleteMessage: 'Are you sure you want to delete {{count}} email(s)?',
            },
          },
          categories: {
            categories: {
              INBOX: 'Inbox',
              SENT: 'Sent',
              SPAM: 'Spam',
              TRASH: 'Trash',
              INVOICE: 'Invoices',
              NEWSLETTER: 'Newsletter',
              PRIVATE: 'Private',
              BUSINESS: 'Business',
              CANCELLATION: 'Cancellations',
              OTHER: 'Other',
            },
          },
        },
      },

      // React-specific options
      react: {
        useSuspense: false, // Disable suspense for synchronous testing
      },

      // Interpolation options
      interpolation: {
        escapeValue: false, // React already escapes values
      },

      // Debug mode off for tests
      debug: false,
    });
});

// Automatic cleanup after each test to prevent memory leaks
// and ensure test isolation
afterEach(() => {
  cleanup();
});
