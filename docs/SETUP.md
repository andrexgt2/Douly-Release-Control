# Douly Release Control — setup

This repository is the production control plane for the private `andrexgt2/Douly` application repository.

It must never contain Douly application source, Supabase data, child data, Cloudflare credentials, or private application configuration.

## Security model

There are two canonical production deployment paths:

1. **Parent-facing Douly application** — requires the complete exact-SHA release tuple:
   - `douly/repository-validation = success`
   - `douly/release-security = success`
   - `douly/release-qa = success`
   - `douly/release-po = success`
   - SHA contained in `Douly/main`
   - explicit `DEPLOY` confirmation
   - protected `production` environment approval.
2. **Internal Ops Control Center** — may deploy only the isolated `ops/control-center/` boundary and requires:
   - exact lowercase 40-character source SHA;
   - SHA contained in `Douly/main`;
   - `douly/repository-validation = success` on that exact SHA;
   - source config pinned to Worker `douly-ops-control-center` and Custom Domain `ops.douly.family`;
   - `workers_dev = false`;
   - immutable deployment marker with `confirm = DEPLOY`;
   - protected `production` environment approval.

The Ops path is deliberately narrower than the parent-facing release gate because it cannot publish the Douly PWA and its source boundary is restricted to the internal Control Center.

## 1. Protect this repository first

Import `rulesets/protect-main.json` in:

`Settings -> Rules -> Rulesets -> New ruleset -> Import a ruleset`

The ruleset must be Active and enforced. It requires PRs, blocks deletion/force-push, permits squash merge only, and requires the `validate` job.

Do not add any release credential until this ruleset is enforced.

## 2. Create a read-only token for the private Douly repository

Create a fine-grained personal access token limited to repository `andrexgt2/Douly` only.

Minimum repository permissions:

- Contents: Read-only
- Commit statuses: Read-only
- Metadata: Read-only (normally implicit/required by GitHub)

No write permission is required.

Do **not** store it as a repository-level secret.

## 3. Create and protect the production environment

Create environment:

`Settings -> Environments -> production`

Recommended rules on the public repository:

- Required reviewer: `andrexgt2`
- Deployment branches/tags: Protected branches only

Create these **environment secrets** inside `production`:

- `DOULY_REPO_READ_TOKEN`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

The private-repository token is therefore unavailable to pull-request workflows and becomes available only after the protected production environment gate is satisfied.

Do not keep Cloudflare deployment credentials in the private Douly repository once this control plane is active.

For the Control Center Custom Domain, the Cloudflare API token must also be able to manage the Worker route/custom-domain binding for the `douly.family` zone.

## 4. Canonical production workflows

Only these workflows may reference production credentials:

- `.github/workflows/deploy-douly.yml`
- `.github/workflows/deploy-ops-control-center.yml`

`deploy-douly.yml` is the full parent-facing release path and retains the complete Repository + Security + QA + Product Owner exact-SHA gate.

`deploy-ops-control-center.yml` is marker-driven. A change to `deployments/ops-control-center.json` on protected `main` requests deployment of one exact Douly SHA. The workflow validates that SHA, confirms it is on `Douly/main`, verifies repository-validation PASS, checks the pinned Control Center Worker/domain config, checks out that exact SHA and deploys only from `ops/control-center/`.

## 5. Required negative test for incident #45

After setup is complete, run `Deploy Douly production` manually with:

- a SHA that does not satisfy the exact-SHA gate, or a deliberately mismatched/non-main SHA;
- `confirm = DEPLOY`.

Approve the `production` environment when prompted so the preflight can read the private repository.

Expected result:

- `preflight` fails;
- `deploy` is skipped;
- Wrangler is never invoked.

Record the failed run URL as QA evidence on Douly issue #45.

## 6. Decommission the old production path

After this repository is protected and the negative test passes, remove production deployment authority and Cloudflare deployment secrets from `andrexgt2/Douly` through a separately approved PR.

The private repository may keep CI and exact-SHA approval/status workflows, but it must no longer be able to publish Douly to production directly.
