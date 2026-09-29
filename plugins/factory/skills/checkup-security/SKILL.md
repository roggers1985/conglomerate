---
name: checkup-security
description: Security checkup. Looks for vulnerable dependencies, committed or exposed secrets, missing authentication, authorisation and input parsing on entry points, unsafe rendering, weak headers, and prompt-injection risks. Use for "security checkup", "security audit", or when the checkup runner dispatches it.
metadata:
  task: checkup
---

# Checkup: security

Follow the protocol in `${CLAUDE_PLUGIN_ROOT}/checkups/protocol.md` (branch, hard rules, report, commit). This file only defines the scope.

Finds security problems before someone else does. Plain version updates are the **outdated-packages** checkup's job; only updates that fix a security issue belong here.

## In scope

1. **Vulnerable dependencies**: run the ecosystem's advisory check (`bun audit`, `npm audit`, `pnpm audit`, `pip-audit`, `govulncheck`, `cargo audit`). For each advisory: is the vulnerable code reachable from this project?
2. **Secrets**:
   - nothing secret is committed (`git grep` for keys, tokens, private keys and connection strings; check that `.env*` files are ignored);
   - no server-side secret reaches client code or public env vars (`NEXT_PUBLIC_*`, `VITE_*`, `PUBLIC_*`).
3. **Entry points**: every HTTP route, server action, webhook, queue consumer and CLI that accepts input:
   - authentication, and authorisation that checks the caller *owns* the resource;
   - input parsed with a schema (see `code-parsing`);
   - no SQL, shell commands, file paths or URLs built from raw input (injection, path traversal, SSRF);
   - rate limiting or abuse protection on public write endpoints.
4. **Webhooks and tokens**: signatures verified, secrets compared in constant time, replay protection where the provider supports it.
5. **Rendering**: raw HTML injection (`dangerouslySetInnerHTML`, `v-html`, `innerHTML`) only with sanitised or trusted content; JSON embedded in pages is escaped.
6. **Headers and cookies**: Content-Security-Policy, HSTS, `frame-ancestors`, referrer policy; cookies `Secure`, `HttpOnly` and `SameSite` where they apply.
7. **LLM and agent features**: untrusted content (web pages, emails, user text) that reaches a model with tools or privileges (prompt injection), and model output that is used without being parsed (see `code-parsing`).

## Fixes you may make yourself

- Patch and minor updates that fix an advisory, with the full checks.
- Missing authentication, authorisation or input parsing, with tests that prove the fix.

## Allowed production access

None.

## Always "Needs a human"

- A leaked secret: flag it as **high** at the top of the report. Rotating it is the owner's job; removing it from git history is too.
- Major upgrades, CSP changes that could break third-party scripts, and anything that changes how authentication works.
