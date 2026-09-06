'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const gate = require('../.github/release-control/release_gate.js');
function status(context, state, id, createdAt) { return { context, state, id, created_at: createdAt }; }
function candidate(overrides = {}) { return { release_candidate_id: 'douly-rc-541-a', source_sha: 'a'.repeat(40), runtime_artifact_hash: 'b'.repeat(64), risk_lane: gate.RISK_LANES.GUARDED, ...overrides }; }

test('accepts only exact lowercase 40-character SHAs', () => { assert.equal(gate.validateSha('a'.repeat(40)), true); assert.equal(gate.validateSha('A'.repeat(40)), false); assert.equal(gate.validateSha('a'.repeat(39)), false); assert.equal(gate.validateSha('main'), false); });
test('validates minimal release candidate identity', () => { assert.equal(gate.validateCandidateManifest(candidate()).ok, true); assert.equal(gate.validateCandidateManifest(candidate({ runtime_artifact_hash: 'x' })).ok, false); assert.equal(gate.validateCandidateManifest(candidate({ risk_lane: 'UNKNOWN' })).ok, false); });

test('risk classification is fail-closed and sensitive boundaries are always GUARDED', () => {
  assert.equal(gate.classifyRiskLane(['docs/README.md']), gate.RISK_LANES.FAST);
  assert.equal(gate.classifyRiskLane(['public/theme.css']), gate.RISK_LANES.FAST);
  assert.equal(gate.classifyRiskLane(['public/app.js']), gate.RISK_LANES.GUARDED);
  assert.equal(gate.classifyRiskLane(['supabase/migrations/1.sql']), gate.RISK_LANES.GUARDED);
  assert.equal(gate.classifyRiskLane(['public/sw.js']), gate.RISK_LANES.GUARDED);
  assert.equal(gate.classifyRiskLane([]), gate.RISK_LANES.GUARDED);
  assert.equal(gate.classifyRiskLane(undefined), gate.RISK_LANES.GUARDED);
});

test('manifest cannot self-assert FAST against derived classification', () => {
  const forcedFast = candidate({ risk_lane: gate.RISK_LANES.FAST });
  assert.equal(gate.validateCandidateManifest(forcedFast, ['public/app.js']).ok, false);
  assert.equal(gate.validateCandidateManifest(forcedFast, ['docs/README.md']).ok, true);
});

test('runtime evidence reuse requires same hash and preserves newly required contexts', () => {
  const guarded = candidate();
  const docsFast = candidate({ release_candidate_id: 'douly-rc-541-b', source_sha: 'c'.repeat(40), risk_lane: gate.RISK_LANES.FAST });
  const runtimeChange = candidate({ release_candidate_id: 'douly-rc-541-c', source_sha: 'd'.repeat(40), runtime_artifact_hash: 'e'.repeat(64) });
  assert.equal(gate.mayReuseRuntimeEvidence(guarded, docsFast, gate.REQUIRED_CONTEXTS.qa), true);
  assert.equal(gate.mayReuseRuntimeEvidence(guarded, runtimeChange, gate.REQUIRED_CONTEXTS.qa), false);
  assert.equal(gate.mayReuseRuntimeEvidence(docsFast, guarded, gate.REQUIRED_CONTEXTS.security), false);
  assert.equal(gate.mayReuseRuntimeEvidence(guarded, docsFast, gate.REQUIRED_CONTEXTS.security), true);
});

test('evidence scope prevents source/candidate evidence carrying on hash equality alone', () => {
  const original = candidate();
  const changedSource = candidate({ release_candidate_id: 'douly-rc-541-b', source_sha: 'c'.repeat(40) });
  assert.equal(gate.mayReuseEvidence(original, changedSource, gate.EVIDENCE_SCOPES.RUNTIME, gate.REQUIRED_CONTEXTS.qa), true);
  assert.equal(gate.mayReuseEvidence(original, changedSource, gate.EVIDENCE_SCOPES.SOURCE), false);
  assert.equal(gate.mayReuseEvidence(original, changedSource, gate.EVIDENCE_SCOPES.CANDIDATE), false);
});

test('same candidate id cannot be treated as same binding after identity changes', () => {
  const original = candidate(); const rebound = candidate({ runtime_artifact_hash: 'c'.repeat(64) });
  assert.equal(gate.sameCandidateBinding(original, rebound), false);
  assert.equal(gate.mayReuseEvidence(original, rebound, gate.EVIDENCE_SCOPES.CANDIDATE), false);
});

test('FAST lane omits mandatory Security status while GUARDED retains it', () => { const fast = gate.requiredContextsForRiskLane(gate.RISK_LANES.FAST); const guarded = gate.requiredContextsForRiskLane(gate.RISK_LANES.GUARDED); assert.equal(Object.values(fast).includes(gate.REQUIRED_CONTEXTS.security), false); assert.equal(Object.values(guarded).includes(gate.REQUIRED_CONTEXTS.security), true); assert.throws(() => gate.requiredContextsForRiskLane('UNKNOWN')); });
test('requires repository, security, qa and po PASS on the same SHA by default', () => { const rows = Object.values(gate.REQUIRED_CONTEXTS).map((context, i) => status(context, 'success', i + 1, `2026-09-05T10:0${i}:00Z`)); assert.equal(gate.evaluateRequiredStatuses(rows).ok, true); });
test('fails closed when one required status is missing', () => { const rows = [status(gate.REQUIRED_CONTEXTS.repository, 'success', 1, '2026-09-05T10:00:00Z'), status(gate.REQUIRED_CONTEXTS.security, 'success', 2, '2026-09-05T10:01:00Z'), status(gate.REQUIRED_CONTEXTS.qa, 'success', 3, '2026-09-05T10:02:00Z')]; const result = gate.evaluateRequiredStatuses(rows); assert.equal(result.ok, false); assert.deepEqual(result.missing.map(x => x.context), [gate.REQUIRED_CONTEXTS.po]); });
test('latest BLOCK overrides an older PASS', () => { const rows = [status(gate.REQUIRED_CONTEXTS.repository, 'success', 1, '2026-09-05T10:00:00Z'), status(gate.REQUIRED_CONTEXTS.security, 'success', 2, '2026-09-05T10:01:00Z'), status(gate.REQUIRED_CONTEXTS.security, 'failure', 9, '2026-09-05T11:01:00Z'), status(gate.REQUIRED_CONTEXTS.qa, 'success', 3, '2026-09-05T10:02:00Z'), status(gate.REQUIRED_CONTEXTS.po, 'success', 4, '2026-09-05T10:03:00Z')]; const result = gate.evaluateRequiredStatuses(rows); assert.equal(result.ok, false); assert.deepEqual(result.failing, [{ name: 'security', context: gate.REQUIRED_CONTEXTS.security, state: 'failure' }]); });
test('only an exact main-contained SHA is eligible', () => { assert.equal(gate.targetIsOnMain('identical'), true); assert.equal(gate.targetIsOnMain('ahead'), true); assert.equal(gate.targetIsOnMain('behind'), false); assert.equal(gate.targetIsOnMain('diverged'), false); });
test('workflow allowlist permits canonical deploy, ops observation and validation paths only', () => { assert.equal(gate.validateWorkflowAllowlist(['deploy-douly.yml','deploy-ops-control-center.yml','ops-github-ingestion.yml','validate-control-plane.yml']).ok, true); const bad = gate.validateWorkflowAllowlist(['deploy-douly.yml','deploy-ops-control-center.yml','ops-github-ingestion.yml','validate-control-plane.yml','one-shot-production.yml']); assert.equal(bad.ok, false); assert.deepEqual(bad.unexpected, ['one-shot-production.yml']); });
