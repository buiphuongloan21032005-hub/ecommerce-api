const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const prisma = require('../src/config/prisma');
const { calculateDiscount } = require('../src/config/discount');
const base = 'http://127.0.0.1:' + (process.env.PORT || '3001');

async function request(route, method = 'GET', body, token) {
    const response = await fetch(base + route, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(15000)
    });
    return { status: response.status, body: await response.json() };
}
async function main() {
    const health = await request('/health');
    assert.equal(health.status, 200);
    assert.equal(health.body.database, 'connected');
    const username = 'smoke_' + crypto.randomBytes(8).toString('hex');
    const password = crypto.randomBytes(16).toString('hex');
    const signup = await request('/api/auth/register', 'POST', { username, password, fullname: 'Smoke Test' });
    assert.equal(signup.status, 201);
    assert.equal(signup.body.user.role.rolename, 'normal');
    assert.equal(signup.body.user.membership.score, 10);
    const login = await request('/api/auth/login', 'POST', { username, password });
    assert.equal(login.status, 200);
    const token = login.body.token;
    assert.equal(typeof token, 'string');
    const x = await prisma.product.create({ data: { pname: username + ' X', price: '100000', quantity: 20 } });
    const y = await prisma.product.create({ data: { pname: username + ' Y', price: '200000', quantity: 30 } });
    const payload = { items: [{ pid: x.pid, qty: 2 }, { pid: y.pid, qty: 5 }] };
    assert.equal((await request('/api/orders', 'POST', payload)).status, 401);
    const before = Date.now();
    const result = await request('/api/orders', 'POST', payload, token);
    assert.equal(result.status, 201);
    const order = result.body.order;
    assert.equal(order.discount, calculateDiscount('1200000', 10).toString());
    const savedOrder = await prisma.order.findUnique({ where: { oid: order.oid } });
    assert.equal(savedOrder.discount.toString(), order.discount);
    assert.equal(order.orderDetails.length, 2);
    assert.equal(order.shipments.length, 1);
    assert.equal(order.shipments[0].status, 'PENDING');
    assert.ok(Math.abs(Date.parse(order.createat) - before) < 60000);
    assert.equal((await request('/api/orders/' + order.oid, 'GET', undefined, token)).status, 200);
    for (const [pid, quantity] of [[x.pid, 18], [y.pid, 25]]) {
        assert.equal((await prisma.product.findUnique({ where: { pid } })).quantity, quantity);
    }
    assert.equal(await prisma.orderDetail.count({ where: { oid: order.oid } }), 2);
    const count = await prisma.order.count({ where: { uid: signup.body.user.uid } });
    const failed = await request('/api/orders', 'POST', { items: [{ pid: x.pid, qty: 1 }, { pid: y.pid, qty: 999 }] }, token);
    assert.equal(failed.status, 409);
    assert.equal((await prisma.product.findUnique({ where: { pid: x.pid } })).quantity, 18);
    assert.equal(await prisma.order.count({ where: { uid: signup.body.user.uid } }), count);
    assert.equal((await request('/api/shipments/' + order.shipments[0].shipid + '/status', 'PATCH', { status: 'SHIPPING' }, token)).status, 403);
    const other = username + '_b';
    assert.equal((await request('/api/auth/register', 'POST', { username: other, password, fullname: 'Other User' })).status, 201);
    const otherLogin = await request('/api/auth/login', 'POST', { username: other, password });
    assert.equal(otherLogin.status, 200);
    assert.equal((await request('/api/orders/' + order.oid, 'GET', undefined, otherLogin.body.token)).status, 404);
    console.log('PASS: health, register, login, auth, order, shipment, stock, rollback, ownership');
    console.log('Test records retained:', { username, oid: order.oid, x: x.pid, y: y.pid });
}
main().catch(error => { console.error('FAIL:', error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
