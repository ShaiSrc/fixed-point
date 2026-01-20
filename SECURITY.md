# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability (e.g., a way to break determinism or cause unexpected behavior), please report it privately:

- **Preferred**: Use GitHub's [private security advisory feature](https://github.com/ShaiSrc/fixed-point/security/advisories/new)
- **Alternative**: Open a draft issue and @mention me—I'll make it private

Please include:

- A description of the vulnerability
- Steps to reproduce
- Potential impact

I'll respond within 72 hours and work with you on a fix and coordinated disclosure.

## Out of Scope

This library is deterministic math—there's no network code, file I/O, or privilege escalation. If you find a logic bug that doesn't have security implications, please open a regular issue instead.
