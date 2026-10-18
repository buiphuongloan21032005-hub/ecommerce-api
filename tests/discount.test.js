const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parsePolicy, calculateDiscount } = require('../src/config/discount');

test('no policy gives zero; configured score tiers choose highest qualifying threshold', () => {
    assert.equal(calculateDiscount('1200000', 10, '[]').toString(), '0');
    const policy = JSON.stringify([{ minScore: 10, percent: 10 }, { minScore: 50, percent: 15 }]);
    assert.equal(calculateDiscount('1200000', 9, policy).toString(), '0');
    assert.equal(calculateDiscount('1200000', 10, policy).toString(), '120000');
    assert.equal(calculateDiscount('1200000', 50, policy).toString(), '180000');
});

test('money rounds to two decimal places; invalid policies and scores fail safely', () => {
    assert.equal(calculateDiscount('0.05', 10, '[{"minScore":10,"percent":10}]').toString(), '0.01');
    for (const raw of ['{}', '[{"minScore":0,"percent":101}]', '[{"minScore":-1,"percent":5}]',
        '[{"minScore":1,"percent":5},{"minScore":1,"percent":10}]']) {
        assert.throws(() => parsePolicy(raw));
    }
    assert.throws(() => calculateDiscount(100, -1, '[]'));
    assert.throws(() => calculateDiscount('100000000', 10, '[{"minScore":0,"percent":100}]'));
});
