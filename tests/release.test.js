import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRelease } from '../scripts/check-release.js';

test('release tag must match package version and prereleases use next', () => {
  assert.equal(checkRelease('0.1.0', 'v0.1.0', false), 'latest');
  assert.equal(checkRelease('0.2.0-beta.1', 'v0.2.0-beta.1', true), 'next');
  assert.throws(() => checkRelease('0.1.0', 'v0.2.0', false), /Expected release tag/);
  assert.throws(() => checkRelease('0.2.0-beta.1', 'v0.2.0-beta.1', false), /pre-release/);
});
