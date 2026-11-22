import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatTabHash, parseTabFromLocation } from './appTabHash';

describe('appTabHash', () => {
  it('parses standard tab hashes directly', () => {
    assert.equal(parseTabFromLocation('#home'), 'home');
    assert.equal(parseTabFromLocation('#calendar'), 'calendar');
    assert.equal(parseTabFromLocation('#insights'), 'insights');
    assert.equal(parseTabFromLocation('#settings'), 'settings');
  });

  it('prefers hash over query param and supports legacy query/hash aliases', () => {
    assert.equal(parseTabFromLocation('#calendar', '?tab=settings'), 'calendar');
    assert.equal(parseTabFromLocation('', '?tab=insights'), 'insights');
    assert.equal(parseTabFromLocation('#timeline'), 'calendar');
    assert.equal(parseTabFromLocation('', '?tab=vault'), 'settings');
  });

  it('falls back safely to home for empty or unknown hashes', () => {
    assert.equal(parseTabFromLocation(''), 'home');
    assert.equal(parseTabFromLocation('#unknown'), 'home');
    assert.equal(formatTabHash('calendar'), '#calendar');
  });
});
