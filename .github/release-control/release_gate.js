'use strict';

const SOURCE_REPO = 'andrexgt2/Douly';

const REQUIRED_CONTEXTS = Object.freeze({
  repository: 'douly/repository-validation',
  security: 'douly/release-security',
  qa: 'douly/release-qa',
  po: 'douly/release-po'
});

const RISK_LANES = Object.freeze({
  FAST: 'FAST',
  GUARDED: 'GUARDED'
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

function validateArtifactHash(hash) {
  return typeof hash === 'string' && /^[0-9a-f]{64}$/.test(hash);
}

function validateCandidateId(id) {
  return typeof id === 'string' && /^douly-rc-[a-z0-9][a-z0-9._-]{2,63}$/.test(id);
}

function requiredContextsForRiskLane(riskLane) {
  if (riskLane === RISK_LANES.FAST) {
    return Object.freeze({
      repository: REQUIRED_CONTEXTS.repository,
      qa: REQUIRED_CONTEXTS.qa,
      po: REQUIRED_CONTEXTS.po
    });
  }
  if (riskLane === RISK_LANES.GUARDED) return REQUIRED_CONTEXTS;
  throw new Error(`Unknown risk lane: ${riskLane}`);
}

function validateCandidateManifest(candidate) {
  const errors = [];
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return Object.freeze({ ok: false, errors: ['candidate must be an object'] });
  }
  if (!validateCandidateId(candidate.release_candidate_id)) errors.push('invalid release_candidate_id');
  if (!validateSha(candidate.source_sha)) errors.push('invalid source_sha');
  if (!validateArtifactHash(candidate.runtime_artifact_hash)) errors.push('invalid runtime_artifact_hash');
  if (![RISK_LANES.FAST, RISK_LANES.GUARDED].includes(candidate.risk_lane)) errors.push('invalid risk_lane');
  return Object.freeze({ ok: errors.length === 0, errors });
}

function candidateRuntimeIdentity(candidate) {
  const result = validateCandidateManifest(candidate);
  if (!result.ok) throw new Error(result.errors.join('; '));
  return `${candidate.release_candidate_id}:${candidate.runtime_artifact_hash}`;
}

function mayReuseRuntimeEvidence(previousCandidate, nextCandidate) {
  const previous = validateCandidateManifest(previousCandidate);
  const next = validateCandidateManifest(nextCandidate);
  if (!previous.ok || !next.ok) return false;
  return previousCandidate.runtime_artifact_hash === nextCandidate.runtime_artifact_hash;
}

function latestStatusesByContext(statuses) {
  const rows = Array.isArray(statuses) ? statuses.slice() : [];
  rows.sort((a, b) => {
    const ta = Date.parse(a?.created_at || 0) || 0;
    const tb = Date.parse(b?.created_at || 0) || 0;
    if (tb !== ta) return tb - ta;
    return Number(b?.id || 0) - Number(a?.id || 0);
  });

  const latest = new Map();
  for (const row of rows) {
    const context = String(row?.context || '');
    if (context && !latest.has(context)) latest.set(context, row);
  }
  return latest;
}

function evaluateRequiredStatuses(statuses, requiredContexts = REQUIRED_CONTEXTS) {
  const latest = latestStatusesByContext(statuses);
  const missing = [];
  const failing = [];

  for (const [name, context] of Object.entries(requiredContexts)) {
    const row = latest.get(context);
    if (!row) {
      missing.push({ name, context });
      continue;
    }
    if (row.state !== 'success') {
      failing.push({ name, context, state: row.state || 'unknown' });
    }
  }

  return Object.freeze({
    ok: missing.length === 0 && failing.length === 0,
    missing,
    failing
  });
}

function targetIsOnMain(compareStatus) {
  return compareStatus === 'identical' || compareStatus === 'ahead';
}

function validateWorkflowAllowlist(workflowNames, allowed = ALLOWED_WORKFLOWS) {
  const actual = Array.from(new Set((workflowNames || []).map(String))).sort();
  const expected = Array.from(new Set((allowed || []).map(String))).sort();
  const unexpected = actual.filter(name => !expected.includes(name));
  const missing = expected.filter(name => !actual.includes(name));
  return Object.freeze({
    ok: unexpected.length === 0 && missing.length === 0,
    unexpected,
    missing
  });
}

module.exports = Object.freeze({
  SOURCE_REPO,
  REQUIRED_CONTEXTS,
  RISK_LANES,
  ALLOWED_WORKFLOWS,
  validateSha,
  validateArtifactHash,
  validateCandidateId,
  validateCandidateManifest,
  candidateRuntimeIdentity,
  mayReuseRuntimeEvidence,
  requiredContextsForRiskLane,
  latestStatusesByContext,
  evaluateRequiredStatuses,
  targetIsOnMain,
  validateWorkflowAllowlist
});
