const { Prisma } = require('@prisma/client');

// Highest qualifying score threshold wins; percentages never come from clients.
function parsePolicy(raw) {
    const policy = JSON.parse(raw);
    if (!Array.isArray(policy)) throw new Error('DISCOUNT_POLICY must be an array');
    const scores = new Set();
    for (const rule of policy) {
        if (!rule || !Number.isInteger(rule.minScore) || rule.minScore < 0 ||
            typeof rule.percent !== 'number' || !Number.isFinite(rule.percent) ||
            rule.percent < 0 || rule.percent > 100 || scores.has(rule.minScore)) {
            throw new Error('Invalid or duplicate discount threshold');
        }
        scores.add(rule.minScore);
    }
    return [...policy].sort((a, b) => b.minScore - a.minScore);
}

function calculateDiscount(subtotal, score, raw = process.env.DISCOUNT_POLICY || '[]') {
    if (!Number.isInteger(score) || score < 0) throw new Error('Invalid membership score');
    const amount = new Prisma.Decimal(subtotal);
    if (amount.isNegative() || !amount.isFinite()) throw new Error('Invalid subtotal');
    const rule = parsePolicy(raw).find(item => score >= item.minScore);
    const discount = amount.mul(rule ? rule.percent : 0).div(100)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    if (discount.greaterThan('99999999.99')) throw new Error('Discount exceeds database limit');
    return discount;
}

module.exports = { parsePolicy, calculateDiscount };
