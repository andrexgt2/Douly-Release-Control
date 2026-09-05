# Douly Release Control

Public production control plane for the private Douly application repository.

This repository intentionally contains **release infrastructure only**. It does not contain Douly application source code, Supabase data, child data, credentials, or private configuration.

## Production invariant

A Douly release may deploy only when one exact commit SHA on `andrexgt2/Douly` has all four machine-readable PASS statuses:

- `douly/repository-validation`
- `douly/release-security`
- `douly/release-qa`
- `douly/release-po`

The canonical workflow then checks out that exact private-repository SHA and deploys it through the protected `production` environment.

## Files

- `.github/release-control/release_gate.js` — deterministic exact-SHA gate logic
- `.github/workflows/validate-control-plane.yml` — public-repo CI and anti-bypass validation
- `.github/workflows/deploy-douly.yml` — only authorized production deploy path
- `tests/release_gate.test.js` — fail-closed contract tests
- `rulesets/protect-main.json` — importable GitHub Free ruleset for public `main`
- `docs/SETUP.md` — one-time setup and incident #45 closure procedure

See [docs/SETUP.md](docs/SETUP.md) before adding any secret or enabling production deployment.
