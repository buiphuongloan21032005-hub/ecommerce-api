const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

test('setup preserves existing config; fresh mode backs it up and selects a separate volume', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ecommerce-setup-'));
    try {
        fs.mkdirSync(path.join(root, 'scripts'));
        const script = path.join(root, 'scripts/setup-env.js');
        fs.copyFileSync(path.join(__dirname, '../scripts/setup-env.js'), script);
        const run = (...args) => execFileSync(process.execPath, [script, ...args], { encoding: 'utf8' });
        run();
        const original = fs.readFileSync(path.join(root, '.env'), 'utf8');
        const parse = text => Object.fromEntries(text.trim().split('\n').map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
        const oldEnv = parse(original);
        const url = new URL(oldEnv.DATABASE_URL);
        assert.equal(url.password, oldEnv.POSTGRES_PASSWORD);
        assert.equal(url.username, oldEnv.POSTGRES_USER);
        assert.equal(url.pathname, '/' + oldEnv.POSTGRES_DB);
        assert.equal(url.port, oldEnv.POSTGRES_PORT);
        assert.ok(oldEnv.JWT_SECRET.length >= 32);
        run();
        assert.equal(fs.readFileSync(path.join(root, '.env'), 'utf8'), original);
        const output = run('--fresh-db');
        const fresh = parse(fs.readFileSync(path.join(root, '.env'), 'utf8'));
        assert.notEqual(fresh.POSTGRES_VOLUME, oldEnv.POSTGRES_VOLUME);
        assert.notEqual(fresh.POSTGRES_PASSWORD, oldEnv.POSTGRES_PASSWORD);
        assert.ok(!output.includes(fresh.POSTGRES_PASSWORD));
        assert.ok(!output.includes(fresh.JWT_SECRET));
        const backups = fs.readdirSync(root).filter(file => file.startsWith('.env.backup.'));
        assert.equal(backups.length, 1);
        assert.equal(fs.readFileSync(path.join(root, backups[0]), 'utf8'), original);
        assert.equal(fs.statSync(path.join(root, '.env')).mode & 0o777, 0o600);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
