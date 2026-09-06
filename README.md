# Douly Release Control

Public production control plane for the private Douly application repository.

This repository intentionally contains **release infrastructure only**. It does not contain Douly application source code, Supabase data, child data, credentials, or private configuration.

## Production invariant

A parent-facing Douly release may deploy only when one exact commit SHA on `andrexgt2/Douly` has all four machine-readable PASS statuses:

- `douly/repository-validation`
- `douly/release-security`
- `douly/release-qa`
- `douly/release-po`

The canonical product workflow checks out that exact private-repository SHA and deploys it through the protected `production` environment. The internal Ops Control Center has a separate canonical deployment workflow and source marker; it never grants an alternate path to deploy the parent-facing application.

## Live operations observation

`Ops GitHub event ingestion` is a read/observe-only workflow that reports release-control CI and deployment lifecycle events to the private Douly Control Center.

It uses short-lived GitHub Actions OIDC tokens with audience `douly-ops-control-center`. It does **not** reference Cloudflare credentials, the private-repository read token, or a Supabase service key, and it does not run in the protected `production` environment.

The receiving Supabase Edge Function independently verifies GitHub OIDC signature/claims and immutable repository identity before accepting an event.

## Files

- `.github/release-control/release_gate.js` — deterministic exact-SHA gate logic and workflow allowlist
- `.github/workflows/validate-control-plane.yml` — public-repo CI and anti-bypass validation
- `.github/workflows/deploy-douly.yml` — canonical parent-facing production deploy path
- `.github/workflows/deploy-ops-control-center.yml` — canonical internal Control Center deploy path
- `.github/workflows/ops-github-ingestion.yml` — secretless OIDC operational event observer
- `deployments/ops-control-center.json` — immutable Ops deployment request marker
- `tests/release_gate.test.js` — fail-closed contract tests
- `rulesets/protect-main.json` — importable GitHub Free ruleset for public `main`
- `docs/SETUP.md` — one-time setup and incident #45 closure procedure

See [docs/SETUP.md](docs/SETUP.md) before adding any secret or enabling production deployment.
