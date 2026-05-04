import * as assert from 'assert';
import { ApiProfile, EnvVar } from '../types';

// ── Pure-logic extracts from ProfileManagerPanel ──────────

function upsertProfile(profiles: ApiProfile[], profile: ApiProfile, oldName?: string): ApiProfile[] {
  const idx = oldName
    ? profiles.findIndex(p => p.name === oldName)
    : profiles.findIndex(p => p.name === profile.name);
  if (idx >= 0) {
    profiles[idx] = profile;
  } else {
    profiles.push(profile);
  }
  return profiles;
}

function deleteProfile(profiles: ApiProfile[], name: string): ApiProfile[] {
  const idx = profiles.findIndex(p => p.name === name);
  if (idx >= 0) profiles.splice(idx, 1);
  return profiles;
}

function resolveActiveAfterDelete(profiles: ApiProfile[], activeName: string | undefined, deletedName: string): string | undefined {
  if (activeName === deletedName) return undefined;
  return activeName;
}

function filterEmpty(envVars: EnvVar[]): EnvVar[] {
  return envVars.filter(e => e.value !== '');
}

// ── Tests ─────────────────────────────────────────────────

const sampleProfile: ApiProfile = {
  name: 'prod',
  envVars: [
    { name: 'ANTHROPIC_BASE_URL', value: 'https://api.example.com' },
    { name: 'ANTHROPIC_AUTH_TOKEN', value: 'sk-123' },
  ],
};

describe('Profile CRUD', () => {
  describe('upsertProfile', () => {
    it('appends a new profile', () => {
      const profiles: ApiProfile[] = [];
      const result = upsertProfile(profiles, sampleProfile);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, 'prod');
    });

    it('updates an existing profile by name', () => {
      const profiles = [JSON.parse(JSON.stringify(sampleProfile))];
      const updated = { name: 'prod', envVars: [{ name: 'X', value: 'Y' }] };
      const result = upsertProfile(profiles, updated);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].envVars.length, 1);
      assert.strictEqual(result[0].envVars[0].name, 'X');
    });

    it('updates by oldName when profile is renamed', () => {
      const profiles = [JSON.parse(JSON.stringify(sampleProfile))];
      const renamed = { name: 'production', envVars: sampleProfile.envVars };
      const result = upsertProfile(profiles, renamed, 'prod');
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, 'production');
    });

    it('does not duplicate when oldName matches an existing profile', () => {
      const profiles = [JSON.parse(JSON.stringify(sampleProfile))];
      const result = upsertProfile(profiles, sampleProfile, 'prod');
      assert.strictEqual(result.length, 1);
    });
  });

  describe('deleteProfile', () => {
    it('removes a profile by name', () => {
      const profiles = [JSON.parse(JSON.stringify(sampleProfile))];
      const result = deleteProfile(profiles, 'prod');
      assert.strictEqual(result.length, 0);
    });

    it('does nothing when name not found', () => {
      const profiles = [JSON.parse(JSON.stringify(sampleProfile))];
      const result = deleteProfile(profiles, 'nonexistent');
      assert.strictEqual(result.length, 1);
    });
  });

  describe('resolveActiveAfterDelete', () => {
    it('clears active when deleted profile was active', () => {
      assert.strictEqual(resolveActiveAfterDelete([], 'prod', 'prod'), undefined);
    });

    it('keeps active when another profile was deleted', () => {
      assert.strictEqual(resolveActiveAfterDelete([], 'staging', 'prod'), 'staging');
    });

    it('keeps undefined when nothing was active', () => {
      assert.strictEqual(resolveActiveAfterDelete([], undefined, 'prod'), undefined);
    });
  });

  describe('filterEmpty for activation', () => {
    it('excludes empty values when writing to settings', () => {
      const vars: EnvVar[] = [
        { name: 'A', value: '1' },
        { name: 'B', value: '' },
        { name: 'C', value: '3' },
      ];
      const result = filterEmpty(vars);
      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].name, 'A');
      assert.strictEqual(result[1].name, 'C');
    });
  });
});
