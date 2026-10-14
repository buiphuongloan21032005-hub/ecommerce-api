const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const target = path.join(root, '.env');
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--fresh-db')) {
    console.error('Usage: node scripts/setup-env.js [--fresh-db]');
    process.exit(1);
}
const fresh = args.includes('--fresh-db');
if (fs.existsSync(target) && !fresh) {
    console.log('.env already exists; no changes made.');
    console.log('To start a separate empty database and keep the old volume: add --fresh-db');
    process.exit(0);
}
const suffix = Date.now() + '_' + crypto.randomBytes(4).toString('hex');
if (fs.existsSync(target)) {
    fs.copyFileSync(target, target + '.backup.' + suffix, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(target + '.backup.' + suffix, 0o600);
    console.log('Backed up the previous .env (ignored by Git).');
}
const password = crypto.randomBytes(24).toString('hex');
const secret = crypto.randomBytes(32).toString('hex');
const volume = fresh ? 'ecommerce_api_prompt2_' + suffix : 'ecommerce-api_postgres_data';
const content = [
    'PORT=3001',
    'POSTGRES_USER=postgres',
    'POSTGRES_PASSWORD=' + password,
    'POSTGRES_DB=ecommerce_db',
    'POSTGRES_PORT=5433',
    'POSTGRES_VOLUME=' + volume,
    'DATABASE_URL=postgresql://postgres:' + password + '@localhost:5433/ecommerce_db?schema=public',
    'JWT_SECRET=' + secret,
    'JWT_EXPIRES_IN=1h',
    ''
].join('\n');
fs.writeFileSync(target, content, { mode: 0o600 });
fs.chmodSync(target, 0o600);
console.log('Created .env with random credentials. No secrets printed.');
if (fresh) console.log('Next Compose startup uses a NEW EMPTY database. Old volumes are preserved.');
console.log('Volume: ' + volume);
