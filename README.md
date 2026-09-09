# Douly Release Control

Public production control plane for the private Douly application repository.

This repository contains **release infrastructure only**. It does not contain Douly application source code, Supabase data, child data, credentials, or private configuration.

## Production invariant

A parent-facing Douly release may deploy only when the exact `andrexgt2/Douly` commit SHA has automated PASS evidence for:

- `douly/repository-validation`
- `douly/release-security`
- `douly/release-qa`

Production credentials remain scoped to the GitHub `production` environment. The application repository never receives Cloudflare production credentials.

## Normal release flow

The preferred path is chat-controlled and versioned:

1. automated exact-SHA repository/security/QA checks are green;
2. the Product Owner explicitly authorizes the concrete release in the active chat/workstream;
3. the assistant writes `deployments/douly-production.json` with the authorized exact SHA, `confirm: DEPLOY`, a unique request id and `authorized_via: chat-product-owner`;
4. when that marker reaches `main`, `Deploy Douly production` starts automatically;
5. a secretless request job validates the marker before the protected production job can run;
6. the production job re-checks exact-SHA evidence, checks out the immutable Douly commit, deploys it and confirms Cloudflare deployment state.

`workflow_dispatch` remains available as an operational fallback, but it is no longer required for the normal chat-controlled path.

The protected GitHub `production` environment remains the final credential boundary. If that environment is configured with a required reviewer, GitHub will still pause there until that reviewer action is satisfied; removing or automating that account-level protection is a separate authority decision and is intentionally not bypassed by repository code.

The internal Ops Control Center has a separate canonical deployment workflow and source marker; it never grants an alternate path to deploy the parent-facing application.

## Live operations observation

`Ops GitHub event ingestion` is a read/observe-only workflow that reports release-control CI and deployment lifecycle events to the private Douly Control Center.

It uses short-lived GitHub Actions OIDC tokens with audience `douly-ops-control-center`. It does **not** reference Cloudflare credentials, the private-repository read token, or a Supabase service key, and it does not run in the protected `production` environment.

The receiving Supabase Edge Function independently verifies GitHub OIDC signature/claims and immutable repository identity before accepting an event.

## Files

- `.github/release-control/release_gate.js` — deterministic exact-SHA automated-evidence gate logic and workflow allowlist
- `.github/workflows/validate-control-plane.yml` — public-repo CI and anti-bypass validation
- `.github/workflows/deploy-douly.yml` — canonical parent-facing production deploy path
- `.github/workflows/deploy-ops-control-center.yml` — canonical internal Control Center deploy path
- `.github/workflows/ops-github-ingestion.yml` — secretless OIDC operational event observer
- `deployments/douly-production.json` — canonical versioned parent-facing production request marker
- `deployments/ops-control-center.json` — immutable Ops deployment request marker
- `tests/release_gate.test.js` — fail-closed contract tests
- `rulesets/protect-main.json` — importable GitHub Free ruleset for public `main`
- `docs/SETUP.md` — one-time setup and incident closure procedure

See [docs/SETUP.md](docs/SETUP.md) before adding any secret or enabling production deployment.
