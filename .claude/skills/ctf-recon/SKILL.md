---
name: ctf-recon
description: Use when starting a CTF-style security audit. Prepares the codebase zip (stripping noise), then runs the reconnaissance prompt to confirm scope, tech stack, and security-relevant files before any analysis begins.
---

# CTF Security Audit — Phase 1 & 2: Recon

Run these two steps before any security analysis. Confirm scope first.

## Step 1 — Prepare the Codebase

Run this in your repo root before uploading. Strips noise, keeps security-relevant files only.

```bash
find . \
  -not \( -path "*/node_modules/*" -o -path "*/.git/*" \
           -o -path "*/dist/*" -o -path "*/build/*" \
           -o -path "*/coverage/*" -o -path "*/public/*" \) \
  -type f \( \
    -name "*.java" -o -name "*.js" -o -name "*.jsx" \
    -o -name "*.ts" -o -name "*.tsx" -o -name "*.json" \
    -o -name "*.yaml" -o -name "*.yml" -o -name "*.env*" \
    -o -name "Dockerfile*" -o -name "docker-compose*" \
    -o -name "*.gradle" -o -name "*.properties" -o -name "*.sh" \
    -o -name "*.xml" -o -name "*.mjs" -o -name "*.hbs" \
  \) \
  | zip audit_slim.zip -@
```

**Target size: under 50MB.** Upload `audit_slim.zip`.

---

## Step 2 — Reconnaissance Prompt

Copy and send this prompt after uploading the zip. Do not begin security analysis until recon is confirmed.

---

We are working a CTF. I have uploaded the source code as a zip. Before any security analysis, give me:

1. File count by type (.java, .js, .ts, .json, .yaml, .sh, .env, etc.)
2. Top-level module / directory structure
3. Tech stack: framework, language, key dependencies, version flags
4. Security-relevant files found — list each:
   - Authentication / session management
   - Security configuration (Spring Security, nginx, CSP, AOP configs)
   - CI/CD pipeline configs (.gitlab-ci.yml, Dockerfile, Helm charts)
   - Environment / secrets files (.env, *.properties, *.yaml)
   - Dependency manifests (package.json, pom.xml, build.gradle)

Do not begin security analysis yet. I want to confirm scope and identify gaps before we proceed.

---

## What to do with the output

- Confirm all security-relevant files are present before proceeding
- Identify any gaps (missing CI config, no Helm charts, no .env files)
- Flag gaps to the AI before running the discovery prompt
- Then proceed to `ctf-discovery` skill
