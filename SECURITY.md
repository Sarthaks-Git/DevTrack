# Security Policy

## Reporting a vulnerability

Please do not open a public issue for security problems.

Report privately through GitHub: **Security → Report a vulnerability** on this repository. Include what you found, how to reproduce it, and the impact you expect. You'll get a reply as soon as possible, and a fix will be released before any details are made public.

## Scope

In scope: the DevTrack client and API in this repository (authentication, sessions, access to other users' data, injection, secrets exposure).

Out of scope: denial-of-service volume testing, social engineering, and third-party services DevTrack connects to (report those to the provider).

## What DevTrack does to protect accounts

- Cookie-based sessions with short-lived access tokens, rotating refresh tokens and CSRF protection.
- Every record is scoped to its owner; another user's data returns "not found".
- Strict input validation and rate limits on every sensitive route.
- No secrets in the repository; CI scans every commit for credentials.
- Coding-platform accounts are verified by a one-time token on your own public profile; DevTrack never asks for platform passwords.
