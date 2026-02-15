# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in SmartMailSorter, please report it responsibly:

1. **DO NOT** open a public GitHub issue
2. Instead, report it privately via GitHub Security Advisories:
   - Go to: https://github.com/milchgeldkassierer/SmartMailSorter/security/advisories/new
   - Or email: [Your contact email if you want to add one]

## Security Measures

This repository implements the following security measures:

- ✅ Secret scanning enabled (GitHub automatically scans for leaked credentials)
- ✅ Push protection enabled (prevents accidental secret commits)
- ✅ Branch protection on `master` branch
- ✅ Required status checks (CI/Lint must pass)
- ✅ Required code reviews before merging
- ✅ Auto-delete branches after merge

## What We Protect Against

- Leaked API keys, tokens, and credentials
- Malicious code injection
- Unauthorized access to the codebase
- Compromised dependencies (via Dependabot alerts)

## Best Practices for Contributors

- Never commit `.env` files or credentials
- Use environment variables for sensitive data
- Keep dependencies up to date
- Follow secure coding practices (no XSS, SQL injection, etc.)
