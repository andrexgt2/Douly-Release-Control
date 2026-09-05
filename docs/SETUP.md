# Douly Release Control — setup

This repository is the production control plane for the private `andrexgt2/Douly` application repository.

It must never contain Douly application source, Supabase data, child data, Cloudflare credentials, or private application configuration.

## Security model

Production deployment is allowed only when all of the following are true for one exact Douly commit SHA:

- `douly/repository-validation = success`
- `douly/release-security = success`
- `douly/release-qa = success`
- `douly/release-po = success`
- the SHA is contained in `Douly/main`
- the operator explicitly selects `DEPLOY`
- the protected `production` environment allows the job to proceed

Any later BLOCK/failure status on the same context invalidates an older PASS.

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

## 4. Canonical production workflow

Only `.github/workflows/deploy-douly.yml` may reference production credentials.

The workflow:

1. receives an exact 40-character Douly SHA;
2. waits for the protected `production` environment approval;
3. queries the private Douly repository using the read-only token;
4. verifies the SHA exists and is contained in `Douly/main`;
5. reads all exact-SHA release statuses;
6. fails closed unless Repository, Security, QA and PO are all PASS;
7. checks out exactly that Douly SHA with credentials persistence disabled;
8. verifies the checkout SHA;
9. deploys through Wrangler;
10. confirms the deployed Cloudflare state.

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
