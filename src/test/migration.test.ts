import * as assert from 'assert';
import { ApiProfile, EnvVar, LegacyApiProfile } from '../types';

// Extracted pure logic from loadProfiles in profileTreeProvider.ts
function migrateProfiles(raw: any[]): { profiles: ApiProfile[]; changed: boolean } {
  const migrated: ApiProfile[] = [];
  let changed = false;

  for (const entry of raw) {
    if (Array.isArray((entry as ApiProfile).envVars)) {
      migrated.push(entry as ApiProfile);
    } else {
      const legacy = entry as LegacyApiProfile;
      const envVars: EnvVar[] = [];
      if (legacy.baseUrl) {
        envVars.push({ name: 'ANTHROPIC_BASE_URL', value: legacy.baseUrl });
      }
      if (legacy.apiKey) {
        envVars.push({ name: 'ANTHROPIC_AUTH_TOKEN', value: legacy.apiKey });
      }
      migrated.push({ name: legacy.name, envVars });
      changed = true;
    }
  }

  return { profiles: migrated, changed };
}

describe('Profile migration', () => {
  it('migrates legacy {name, baseUrl, apiKey} to {name, envVars[]}', () => {
    const raw: any[] = [
      { name: 'prod', baseUrl: 'https://api.example.com', apiKey: 'sk-123' },
    ];
    const result = migrateProfiles(raw);
    assert.strictEqual(result.changed, true);
    assert.strictEqual(result.profiles[0].name, 'prod');
    assert.strictEqual(result.profiles[0].envVars.length, 2);
    assert.strictEqual(result.profiles[0].envVars[0].name, 'ANTHROPIC_BASE_URL');
    assert.strictEqual(result.profiles[0].envVars[0].value, 'https://api.example.com');
    assert.strictEqual(result.profiles[0].envVars[1].name, 'ANTHROPIC_AUTH_TOKEN');
    assert.strictEqual(result.profiles[0].envVars[1].value, 'sk-123');
  });

  it('does not change already-migrated profiles', () => {
    const raw: ApiProfile[] = [
      { name: 'prod', envVars: [{ name: 'X', value: 'Y' }] },
    ];
    const result = migrateProfiles(raw);
    assert.strictEqual(result.changed, false);
    assert.strictEqual(result.profiles[0].envVars.length, 1);
  });

  it('handles mixed old and new profiles', () => {
    const raw: any[] = [
      { name: 'old', baseUrl: 'https://a', apiKey: 'key' },
      { name: 'new', envVars: [{ name: 'X', value: 'Y' }] },
    ];
    const result = migrateProfiles(raw);
    assert.strictEqual(result.changed, true);
    assert.strictEqual(result.profiles.length, 2);
  });

  it('handles empty array', () => {
    const result = migrateProfiles([]);
    assert.strictEqual(result.changed, false);
    assert.strictEqual(result.profiles.length, 0);
  });
});
