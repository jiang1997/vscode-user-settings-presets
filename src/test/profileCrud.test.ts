import * as assert from 'assert';
import { SettingProfile } from '../types';

// ── Pure-logic extracts from ProfileManagerPanel ──────────

function upsertProfile(profiles: SettingProfile[], profile: SettingProfile, oldName?: string): SettingProfile[] {
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

function deleteProfile(profiles: SettingProfile[], name: string): SettingProfile[] {
  const idx = profiles.findIndex(p => p.name === name);
  if (idx >= 0) profiles.splice(idx, 1);
  return profiles;
}

function resolveActiveAfterDelete(profiles: SettingProfile[], activeName: string | undefined, deletedName: string): string | undefined {
  if (activeName === deletedName) return undefined;
  return activeName;
}

// ── Tests ─────────────────────────────────────────────────

const sampleProfile: SettingProfile = {
  name: 'prod',
  settingKey: 'claudeCode.environmentVariables',
  value: [{ name: 'ANTHROPIC_BASE_URL', value: 'https://api.example.com' }],
};

describe('Profile CRUD', () => {
  describe('upsertProfile', () => {
    it('appends a new profile', () => {
      const profiles: SettingProfile[] = [];
      const result = upsertProfile(profiles, sampleProfile);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, 'prod');
      assert.strictEqual(result[0].settingKey, 'claudeCode.environmentVariables');
    });

    it('updates an existing profile by name', () => {
      const profiles = [JSON.parse(JSON.stringify(sampleProfile))];
      const updated: SettingProfile = { name: 'prod', settingKey: 'python.defaultInterpreterPath', value: '/usr/bin/python3' };
      const result = upsertProfile(profiles, updated);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].settingKey, 'python.defaultInterpreterPath');
      assert.strictEqual(result[0].value, '/usr/bin/python3');
    });

    it('updates by oldName when profile is renamed', () => {
      const profiles = [JSON.parse(JSON.stringify(sampleProfile))];
      const renamed: SettingProfile = { name: 'production', settingKey: sampleProfile.settingKey, value: sampleProfile.value };
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
});
