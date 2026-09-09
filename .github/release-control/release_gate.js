'use strict';

const SOURCE_REPO = 'andrexgt2/Douly';

// Production preflight uses only active, exact-SHA automated engineering
// evidence. Product Owner authorization is enforced once by the protected
// `production` environment on the deploy job and is not duplicated here.
const DEPLOY_REQUIRED_CONTEXTS = Object.freeze({
  repository: 'douly/repository-validation',
  security: 'douly/release-security',
  qa: 'douly/release-qa'
});

const ALLOWED_WORKFLOWS = Object.freeze([
  'deploy-douly.yml',
  'deploy-ops-control-center.yml',
  'ops-github-ingestion.yml',
  'validate-control-plane.yml'
]);

function validateSha(sha) {
  return typeof sha === 'string' && /^[0-9a-f]{40}$/.test(sha);
}

function latestStatusesByContext(statuses) {
  const rows = Array.isArray(statuses) ? statuses.slice() : [];
  rows.sort((a, b) => {
    const ta = Date.parse(a?.created_at || 0) || 0;
    const tb = Date.parse(b?.created_at || 0) || 0;
    return tb !== ta ? tb - ta : Number(b?.id || 0) - Number(a?.id || 0);
  });

  const latest = new Map();
  for (const row of rows) {
    const context = String(row?.context || '');
    if (context && !latest.has(context)) latest.set(context, row);
  }
  return latest;
}

function evaluateRequiredStatuses(statuses, requiredContexts = DEPLOY_REQUIRED_CONTEXTS) {
  const latest = latestStatusesByContext(statuses);
  const missing = [];
  const failing = [];

  for (const [name, context] of Object.entries(requiredContexts)) {
    const row = latest.get(context);
    if (!row) missing.push({ name, context });
    else if (row.state !== 'success') failing.push({ name, context, state: row.state || 'unknown' });
  }

  return Object.freeze({ ok: missing.length === 0 && failing.length === 0, missing, failing });
}

function targetIsOnMain(compareStatus) {
  return compareStatus === 'identical' || compareStatus === 'ahead';
}

function validateWorkflowAllowlist(workflowNames, allowed = ALLOWED_WORKFLOWS) {
  const actual = Array.from(new Set((workflowNames || []).map(String))).sort();
  const expected = Array.from(new Set((allowed || []).map(String))).sort();
  const unexpected = actual.filter(name => !expected.includes(name));
  const missing = expected.filter(name => !actual.includes(name));
  return Object.freeze({ ok: unexpected.length === 0 && missing.length === 0, unexpected, missing });
}

module.exports = Object.freeze({
  SOURCE_REPO,
  DEPLOY_REQUIRED_CONTEXTS,
  ALLOWED_WORKFLOWS,
  validateSha,
  latestStatusesByContext,
  evaluateRequiredStatuses,
  targetIsOnMain,
  validateWorkflowAllowlist
});
