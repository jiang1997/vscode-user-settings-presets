import * as assert from 'assert';

// Extracted from the webview import handler
function parseExportLines(text: string): { name: string; value: string }[] {
  const results: { name: string; value: string }[] = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const m = trimmed.match(/^(?:export\s+)?(\w+)=(.+)$/);
    if (!m) continue;
    results.push({ name: m[1], value: m[2] });
  }
  return results;
}

describe('Import parser', () => {
  it('parses export VAR=value lines', () => {
    const input = `export ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
export ANTHROPIC_AUTH_TOKEN=sk-9985672d54134037ac44d66ce3ee07c9`;
    const result = parseExportLines(input);
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].name, 'ANTHROPIC_BASE_URL');
    assert.strictEqual(result[0].value, 'https://api.deepseek.com/anthropic');
    assert.strictEqual(result[1].name, 'ANTHROPIC_AUTH_TOKEN');
    assert.strictEqual(result[1].value, 'sk-9985672d54134037ac44d66ce3ee07c9');
  });

  it('parses VAR=value without export prefix', () => {
    const result = parseExportLines('ANTHROPIC_MODEL=deepseek-v4-pro[1m]');
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, 'ANTHROPIC_MODEL');
    assert.strictEqual(result[0].value, 'deepseek-v4-pro[1m]');
  });

  it('handles values containing equals signs', () => {
    const result = parseExportLines('KEY=val=ue');
    assert.strictEqual(result[0].value, 'val=ue');
  });

  it('handles values with square brackets', () => {
    const result = parseExportLines('MODEL=deepseek-v4-pro[1m]');
    assert.strictEqual(result[0].value, 'deepseek-v4-pro[1m]');
  });

  it('skips empty lines and comment-like lines', () => {
    const input = `
# comment line
export FOO=bar

# another comment
export BAZ=qux
`;
    const result = parseExportLines(input);
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].name, 'FOO');
    assert.strictEqual(result[1].name, 'BAZ');
  });

  it('handles Windows line endings (\\r\\n)', () => {
    const result = parseExportLines('A=1\r\nB=2\r\nC=3');
    assert.strictEqual(result.length, 3);
  });
});
