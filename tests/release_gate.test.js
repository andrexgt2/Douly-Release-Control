'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const gate = require('../.github/release-control/release_gate.js');

function status(context, state, id, createdAt) {
  return { context, state, id, created_at: createdAt };
}

test('accepts only exact lowercase 40-character SHAs', () => {
  assert.equal(gate.validateSha('a'.repeat(40)), true);
  assert.equal(gate.validateSha('A'.repeat(40)), false);
  assert.equal(gate.validateSha('a'.repeat(39)), false);
  assert.equal(gate.validateSha('main'), false);
});

test('normal deploy requires repository, security and QA exact-SHA evidence', () => {
  const rows = Object.values(gate.DEPLOY_REQUIRED_CONTEXTS).map((context, i) =>
    status(context, 'success', i + 1, `2026-09-09T10:0${i}:00Z`)
  );
  assert.equal(gate.evaluateRequiredStatuses(rows).ok, true);
});

test('fails closed when an automated required status is missing', () => {
  const rows = [
    status(gate.DEPLOY_REQUIRED_CONTEXTS.repository, 'success', 1, '2026-09-09T10:00:00Z'),
    status(gate.DEPLOY_REQUIRED_CONTEXTS.qa, 'success', 3, '2026-09-09T10:02:00Z')
  ];
  const result = gate.evaluateRequiredStatuses(rows);
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing.map(item => item.context), [gate.DEPLOY_REQUIRED_CONTEXTS.security]);
});

test('latest failure overrides an older success for the same context', () => {
  const rows = [
    status(gate.DEPLOY_REQUIRED_CONTEXTS.repository, 'success', 1, '2026-09-09T10:00:00Z'),
    status(gate.DEPLOY_REQUIRED_CONTEXTS.security, 'success', 2, '2026-09-09T10:01:00Z'),
    status(gate.DEPLOY_REQUIRED_CONTEXTS.security, 'failure', 9, '2026-09-09T11:01:00Z'),
    status(gate.DEPLOY_REQUIRED_CONTEXTS.qa, 'success', 3, '2026-09-09T10:02:00Z')
  ];
  const result = gate.evaluateRequiredStatuses(rows);
  assert.equal(result.ok, false);
  assert.deepEqual(result.failing, [{
    name: 'security',
    context: gate.DEPLOY_REQUIRED_CONTEXTS.security,
    state: 'failure'
  }]);
});

test('only an exact SHA contained in main is eligible', () => {
  assert.equal(gate.targetIsOnMain('identical'), true);
  assert.equal(gate.targetIsOnMain('ahead'), true);
  assert.equal(gate.targetIsOnMain('behind'), false);
  assert.equal(gate.targetIsOnMain('diverged'), false);
});

test('workflow allowlist permits only canonical deploy, observation and validation paths', () => {
  const canonical = [
    'deploy-douly.yml',
    'deploy-ops-control-center.yml',
    'ops-github-ingestion.yml',
    'validate-control-plane.yml'
  ];
  assert.equal(gate.validateWorkflowAllowlist(canonical).ok, true);

  const bad = gate.validateWorkflowAllowlist([...canonical, 'one-shot-production.yml']);
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.unexpected, ['one-shot-production.yml']);
});
