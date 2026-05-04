import * as assert from 'assert';
import { EnvVar } from '../types';

// Extracted from writeEnvVars in extension.ts
function filterEmpty(envVars: EnvVar[]): EnvVar[] {
  return envVars.filter(e => e.value !== '');
}

describe('Env var filtering', () => {
  it('filters out entries with empty values', () => {
    const input: EnvVar[] = [
      { name: 'A', value: '1' },
      { name: 'B', value: '' },
      { name: 'C', value: '3' },
      { name: 'D', value: '' },
    ];
    const result = filterEmpty(input);
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].name, 'A');
    assert.strictEqual(result[1].name, 'C');
  });

  it('returns empty array when all values are empty', () => {
    const input: EnvVar[] = [
      { name: 'A', value: '' },
      { name: 'B', value: '' },
    ];
    const result = filterEmpty(input);
    assert.strictEqual(result.length, 0);
  });

  it('returns all items when all have non-empty values', () => {
    const input: EnvVar[] = [
      { name: 'A', value: '1' },
      { name: 'B', value: '2' },
    ];
    const result = filterEmpty(input);
    assert.strictEqual(result.length, 2);
  });

  it('returns empty array for empty input', () => {
    const result = filterEmpty([]);
    assert.strictEqual(result.length, 0);
  });
});
