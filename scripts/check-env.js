require('dotenv').config();
const jwt = require('jsonwebtoken');
try {
    const url = new URL(process.env.DATABASE_URL || '');
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.username || !url.password || url.pathname.length < 2) {
        throw new Error('DATABASE_URL must specify a PostgreSQL user, password, host and database');
    }
    const secret = process.env.JWT_SECRET || '';
    if (secret.length < 32 || secret.includes('replace_with')) {
        throw new Error('JWT_SECRET must be a random secret of at least 32 characters');
    }
    jwt.sign({ check: true }, secret, { algorithm: 'HS256', expiresIn: process.env.JWT_EXPIRES_IN || '1h' });
    console.log('Environment configuration validated');
} catch (error) {
    console.error('Invalid environment configuration. Generate .env using scripts/setup-env.js; check DATABASE_URL, JWT_SECRET and JWT_EXPIRES_IN.');
    process.exit(1);
}
