# Translation Contribution Guide

**Help make SmartMailSorter accessible to users worldwide by contributing translations!**

## Overview

SmartMailSorter uses **i18next** for internationalization (i18n), making it easy to add support for new languages. The application currently supports **German (de)** and **English (en)**, and we welcome community contributions for additional languages such as French, Spanish, Italian, Portuguese, Chinese, Japanese, Arabic, and more.

This guide will walk you through the process of adding a new language translation to SmartMailSorter, from setting up your development environment to submitting your contribution via a pull request.

## Why Contribute a Translation?

- **Expand Access**: Help users who speak your language benefit from SmartMailSorter's AI-powered email management
- **Support Privacy-First Tools**: Enable more people to use local-first, privacy-focused email solutions
- **Join the Community**: Become part of the open-source SmartMailSorter community
- **Simple Process**: Our translation system is designed to make contributions straightforward, even if you're new to open source

## Translation System Architecture

SmartMailSorter's i18n implementation is built on the following structure:

### Locale File Structure

```text
public/locales/
├── de/                          # German (default language)
│   ├── translation.json         # Main UI strings
│   └── categories.json          # Email category names
├── en/                          # English
│   ├── translation.json
│   └── categories.json
├── <your-language>/             # Your new language
│   ├── translation.json
│   └── categories.json
└── locale-template.json         # Translation template (reference)
```

### File Purposes

- **`translation.json`**: Contains all user-facing UI text (buttons, labels, messages, tooltips, etc.)
- **`categories.json`**: Contains email category names and descriptions (Inbox, Sent, Spam, Invoices, Newsletter, etc.)
- **`locale-template.json`**: A template file with all translation keys and helpful comments to guide translators

## How to Add a New Language

Follow these steps to contribute a translation for a new language:

### Step 1: Set Up Your Development Environment

1. **Fork the Repository**: Fork the SmartMailSorter repository on GitHub to your account

2. **Clone Your Fork**: Clone your forked repository to your local machine

   ```bash
   git clone https://github.com/YOUR-USERNAME/SmartMailSorter.git
   cd SmartMailSorter
   ```

3. **Install Dependencies**: Install the project dependencies

   ```bash
   npm install
   ```

4. **Create a Feature Branch**: Create a new branch for your translation

   ```bash
   git checkout -b translation/add-<language-code>
   ```

   Replace `<language-code>` with your language's ISO 639-1 code (e.g., `fr` for French, `es` for Spanish)

### Step 2: Create Language Directory

1. **Identify Your Language Code**: Use the ISO 639-1 two-letter language code for your language:
   - French: `fr`
   - Spanish: `es`
   - Italian: `it`
   - Portuguese: `pt`
   - Chinese (Simplified): `zh`
   - Japanese: `ja`
   - Arabic: `ar`
   - Russian: `ru`
   - Dutch: `nl`
   - Polish: `pl`
   - Turkish: `tr`
   - Korean: `ko`
   - [Find other codes here](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes)

2. **Create Language Directory**:

   ```bash
   mkdir -p public/locales/<language-code>
   ```

   For example, for French:

   ```bash
   mkdir -p public/locales/fr
   ```

### Step 3: Create Translation Files

#### 3.1 Main Translation File (`translation.json`)

1. **Copy the Template**:

   ```bash
   cp public/locales/locale-template.json public/locales/<language-code>/translation.json
   ```

2. **Translate All Strings**: Open `public/locales/<language-code>/translation.json` and translate all values while keeping keys unchanged

   **Example (French)**:

   ```json
   {
     "common": {
       "save": "Enregistrer",
       "cancel": "Annuler",
       "delete": "Supprimer",
       "rename": "Renommer",
       "ok": "OK",
       "close": "Fermer"
     },
     "sidebar": {
       "folders": "Dossiers",
       "aiCategories": "Catégories IA",
       "storage": "Stockage"
     }
   }
   ```

3. **Important Translation Guidelines**:
   - **Keep keys unchanged**: Only translate the values, never the keys
   - **Preserve placeholders**: Keep dynamic placeholders like `{{count}}`, `{{category}}`, `{{field}}` exactly as they are

     ```json
     "deleteCategoryConfirm": "Êtes-vous sûr de vouloir supprimer la catégorie '{{category}}' ?"
     ```

   - **Maintain brand names**: Keep product names unchanged (GMX, Gmail, Google Gemini, etc.)
   - **Preserve technical terms**: Keep acronyms like IMAP, API, HTML, SSL as-is unless your language has established translations
   - **Use appropriate formality**: Choose the formality level (formal/informal "you") that matches your language's conventions for software UI
   - **Natural phrasing**: Translate for meaning and natural flow, not word-for-word
   - **Remove template comments**: Delete all `_meta`, `_comment`, and `_notes` fields from your final file

#### 3.2 Categories Translation File (`categories.json`)

1. **Copy the English Categories File**:

   ```bash
   cp public/locales/en/categories.json public/locales/<language-code>/categories.json
   ```

2. **Translate Category Names**: Translate the email category names to your language

   **Example Structure**:

   ```json
   {
     "categories": {
       "INBOX": "Inbox",
       "SENT": "Sent",
       "SPAM": "Spam",
       "TRASH": "Trash",
       "INVOICE": "Invoices",
       "NEWSLETTER": "Newsletter",
       "PRIVATE": "Private",
       "BUSINESS": "Business",
       "CANCELLATION": "Cancellations",
       "OTHER": "Other"
     }
   }
   ```

   **French Example**:

   ```json
   {
     "categories": {
       "INBOX": "Boîte de réception",
       "SENT": "Envoyés",
       "SPAM": "Spam",
       "TRASH": "Corbeille",
       "INVOICE": "Factures",
       "NEWSLETTER": "Newsletters",
       "PRIVATE": "Privé",
       "BUSINESS": "Professionnel",
       "CANCELLATION": "Résiliations",
       "OTHER": "Autre"
     }
   }
   ```

### Step 4: Register Your Language

SmartMailSorter uses `i18next-http-backend` to load translations dynamically from `public/locales/{{lng}}/{{ns}}.json`. You only need to register your language code in the configuration:

1. **Open** `src/i18n/config.ts`

2. **Add your language code** to the `SUPPORTED_LANGUAGES` array:

   ```typescript
   export const SUPPORTED_LANGUAGES = ['de', 'en', 'fr'] as const; // Add your language code
   ```

3. **Add a label** to the `LANGUAGE_LABELS` record:

   ```typescript
   export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
     de: 'Deutsch',
     en: 'English',
     fr: 'Français', // Add your language's native name
   };
   ```

   That's it! The `useLanguage` hook in `src/hooks/useLanguage.ts` reads from `SUPPORTED_LANGUAGES` and `LANGUAGE_LABELS` automatically, so no changes to the hook are needed. The HTTP backend will load your translation files from `public/locales/<language-code>/` at runtime.

### Step 5: Test Your Translation

Before submitting your translation, thoroughly test it in the application:

1. **Build the Application**:

   ```bash
   npm run build
   ```

   Verify there are no build errors.

2. **Start the Development Server**:

   ```bash
   npm run electron:dev
   ```

3. **Switch to Your Language**:
   - Open the application
   - Click the settings icon (gear) in the top-right corner
   - Navigate to the "General" tab
   - Select your language from the dropdown
   - Verify all UI text updates immediately

4. **Verification Checklist**:
   - [ ] Application loads without errors
   - [ ] All UI elements display translated text (no English/German showing)
   - [ ] Placeholders are correctly replaced (e.g., category names in confirmation dialogs)
   - [ ] No missing translation warnings in the browser console
   - [ ] Date and time formats are appropriate for your locale
   - [ ] Number formatting (if applicable) matches your locale conventions
   - [ ] Text fits within UI elements (no overflow or truncation)
   - [ ] Email categories display correct translations
   - [ ] All settings tabs show translated content
   - [ ] Search, filters, and dialogs work correctly
   - [ ] Language selection persists after application restart

5. **Browser Console Check**:
   - Open Developer Tools (F12 or Cmd+Option+I)
   - Look for any i18next warnings about missing keys
   - Fix any missing translations before proceeding

### Step 6: Submit Your Translation

Once you've tested your translation and verified it works correctly:

1. **Add Your Files to Git**:

   ```bash
   git add public/locales/<language-code>/
   git add src/i18n/config.ts
   ```

2. **Commit Your Changes**:

   ```bash
   git commit -m "feat: Add <Language Name> translation (<language-code>)

   - Added complete translation.json with all UI strings
   - Added categories.json with email category translations
   - Registered language in i18n configuration
   - Tested all UI elements for translation accuracy"
   ```

3. **Push to Your Fork**:

   ```bash
   git push origin translation/add-<language-code>
   ```

4. **Create a Pull Request**:
   - Go to your fork on GitHub
   - Click "Pull Request" → "New Pull Request"
   - Set base repository to the original SmartMailSorter repo
   - Set base branch to `master`
   - Set compare branch to your `translation/add-<language-code>` branch
   - Fill in the PR template with:
     - **Title**: `feat: Add <Language Name> translation (<language-code>)`
     - **Description**: Mention the language added, completion status, and any notes about cultural/regional variations
   - Submit the pull request

5. **PR Review Process**:
   - A maintainer will review your translation
   - They may request changes or ask questions about specific translations
   - Be responsive to feedback and make requested adjustments
   - Once approved, your translation will be merged!

## Translation Best Practices

### 1. Maintain Consistency

- **Terminology**: Use consistent terms throughout the translation (e.g., always translate "email" the same way)
- **Tone**: Maintain a professional yet friendly tone throughout
- **Formatting**: Follow the same capitalization and punctuation conventions

### 2. Consider Context

- **UI Space Constraints**: Some translations may be longer than the original; test that text fits in buttons, labels, and menus
- **Cultural Appropriateness**: Adapt idioms and expressions to be culturally appropriate for your language
- **Technical Accuracy**: Ensure technical terms are translated correctly (or left in English if that's the convention)

### 3. Placeholder Handling

Placeholders are dynamic values that are replaced at runtime. They must remain unchanged:

- ✅ **Correct**: `"Êtes-vous sûr de vouloir supprimer '{{category}}' ?"` (French)
- ❌ **Incorrect**: `"Êtes-vous sûr de vouloir supprimer '{{catégorie}}' ?"` (placeholder changed)

Common placeholders:

- `{{count}}` - Numbers (e.g., email count, storage amounts)
- `{{category}}` - Category names
- `{{field}}` - Field names
- `{{email}}` - Email addresses
- `{{name}}` - User or account names

### 4. Brand Names and Technical Terms

**Keep these unchanged** unless your language has an official localization:

- **Brand names**: GMX, Web.de, Gmail, Google Gemini, Electron, React
- **Technical acronyms**: IMAP, SMTP, API, HTML, CSS, JSON, SSL/TLS
- **File formats**: .json, .md, .txt

### 5. Date and Time Formatting

i18next will automatically format dates and times based on your locale, but ensure the relative time strings match your language's conventions:

- English: "2 hours ago", "Yesterday"
- German: "vor 2 Stunden", "Gestern"
- French: "il y a 2 heures", "Hier"
- Spanish: "hace 2 horas", "Ayer"

### 6. Number Formatting

Different locales use different decimal and thousands separators:

- English: `1,234.56`
- German: `1.234,56`
- French: `1 234,56`

The app uses `Intl.NumberFormat` for automatic formatting, but verify numbers display correctly in your language.

## Locale-Specific Considerations

### Right-to-Left (RTL) Languages

If you're adding an RTL language (Arabic, Hebrew, Persian, Urdu):

1. **Translation files work the same way** - just translate the strings
2. **RTL layout support** is architecturally possible but not yet implemented
3. **Note in your PR** that this is an RTL language so maintainers can plan UI layout adjustments
4. **Text direction** will need CSS updates (future work)

### Regional Variations

If your language has significant regional differences (e.g., Brazilian Portuguese vs European Portuguese, Latin American Spanish vs European Spanish):

1. **Use the most widely understood variant** for the base translation
2. **Optionally create regional variants** using language codes like:
   - `pt-BR` (Brazilian Portuguese)
   - `pt-PT` (European Portuguese)
   - `es-ES` (European Spanish)
   - `es-MX` (Mexican Spanish)

### Formality Levels

Choose the appropriate formality level for your language:

- **Formal "you"**: German (Sie), French (vous), Spanish (usted) - often used in professional software
- **Informal "you"**: German (du), French (tu), Spanish (tú) - often used in casual apps

**Recommendation**: Use the formality level that's most common in software interfaces in your language/culture.

## Common Translation Pitfalls

### ❌ Don't Do This

1. **Changing JSON structure**:

   ```json
   // Wrong - changed key names
   {
     "commun": {
       // Should be "common"
       "sauvegarder": "Enregistrer" // Should be "save"
     }
   }
   ```

2. **Breaking placeholders**:

   ```json
   // Wrong - placeholder modified
   "message": "Voulez-vous supprimer {{catégorie}} ?"  // Should be {{category}}
   ```

3. **Adding/removing keys**:

   ```json
   // Wrong - added a key that doesn't exist in original
   {
     "common": {
       "save": "Enregistrer",
       "myNewKey": "Some value" // Don't add new keys
     }
   }
   ```

4. **Leaving strings untranslated**:

   ```json
   // Wrong - left in English
   {
     "common": {
       "save": "Save", // Should be translated
       "cancel": "Annuler"
     }
   }
   ```

5. **Machine translating without review**:
   - Machine translation (Google Translate, DeepL) is a good starting point
   - But **always review and refine** for natural phrasing and accuracy
   - Automated translations often miss context and produce awkward results

### ✅ Do This Instead

1. **Maintain exact JSON structure**:

   ```json
   {
     "common": {
       "save": "Enregistrer",
       "cancel": "Annuler"
     }
   }
   ```

2. **Preserve all placeholders**:

   ```json
   "message": "Voulez-vous supprimer {{category}} ?"
   ```

3. **Translate all values**:

   ```json
   {
     "common": {
       "save": "Enregistrer",
       "cancel": "Annuler",
       "delete": "Supprimer"
     }
   }
   ```

4. **Review machine translations**:
   - Use DeepL or Google Translate for a first pass
   - Then manually review every string for accuracy and natural flow
   - Test in the actual UI to see how translations look in context

## Getting Help

### Questions or Issues?

If you encounter problems or have questions:

1. **Check existing translations**: Look at `public/locales/de/` and `public/locales/en/` for reference
2. **Read the template comments**: `public/locales/locale-template.json` has helpful notes
3. **Open a GitHub issue**: Create an issue with the "translation" label to ask questions
4. **Join the discussion**: Comment on existing translation-related issues or PRs

### Need Clarification on a String?

If you're unsure how to translate a specific string:

1. **Test it in the app**: Run the English version and see where/how the string is used
2. **Ask in your PR**: Submit your translation with a note asking for clarification on specific strings
3. **Propose alternatives**: If multiple translations seem valid, propose both and ask for feedback

## Translation Credits

Contributors who submit translations will be credited in:

- The project README.md in a "Contributors" section
- The CHANGELOG.md for the release that includes your translation
- Git commit history (make sure to use your real name and email)

Thank you for helping make SmartMailSorter accessible to users worldwide! 🌍

## Reference Links

- **i18next Documentation**: https://www.i18next.com/
- **ISO 639-1 Language Codes**: https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes
- **Intl.NumberFormat**: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat
- **Intl.DateTimeFormat**: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat

---

**Thank you for contributing to SmartMailSorter!** Your translation will help users around the world benefit from local-first, AI-powered email management. 🚀
