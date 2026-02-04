<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1MLJpHIpnT5wX2k-wh_Xj8og2kFNsePet

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## TypeScript Configuration

This project uses **TypeScript strict mode** for enhanced type safety and better error detection during development.

### What is Strict Mode?

TypeScript strict mode (`"strict": true` in `tsconfig.json`) enables a comprehensive set of type-checking rules that help catch common programming errors before runtime:

- **strictNullChecks**: Prevents `null` and `undefined` from being assigned where not explicitly allowed
- **strictFunctionTypes**: Ensures function parameter types are checked correctly
- **strictBindCallApply**: Validates that `bind`, `call`, and `apply` are used with correct arguments
- **strictPropertyInitialization**: Ensures class properties are properly initialized
- **noImplicitThis**: Requires explicit typing for `this` expressions
- **noImplicitAny**: Prevents variables from implicitly having the `any` type
- **alwaysStrict**: Emits `"use strict"` in generated JavaScript

### Benefits

Enabling strict mode provides several important advantages:

1. **Early Error Detection**: Catches entire classes of bugs during development instead of at runtime
2. **Better IDE Support**: Enables more accurate autocomplete and inline documentation
3. **Improved Code Quality**: Encourages explicit typing and reduces ambiguous code
4. **Easier Refactoring**: Type errors guide you through breaking changes when refactoring
5. **Reduced Technical Debt**: Prevents accumulation of type-unsafe patterns

### Type Checking

To run type checking manually:
```bash
npx tsc --noEmit
```

All tests include type checking to ensure type safety is maintained across the codebase.
