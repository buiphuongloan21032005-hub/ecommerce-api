const prisma = require('../config/prisma');

function isPositiveInt(value) {
    return Number.isInteger(value) &&
        value > 0 &&
        value <= 2147483647;
}

function businessError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

// POST /api/orders
exports.createOrder = async (req, res) => {
    const { items } = req.body || {};

    if (
        !Array.isArray(items) ||
        items.length === 0 ||
        items.length > 50
    ) {
        return res.status(400).json({
            message: 'Order must contain 1-50 product items'
        });
    }

    const productIds = new Set();

    for (const item of items) {
        if (
            !item ||
            !isPositiveInt(item.pid) ||
            !isPositiveInt(item.qty)
        ) {
            return res.status(400).json({
                message: 'Each item must have a positive integer pid and qty'
            });
        }

        if (productIds.has(item.pid)) {
            return res.status(400).json({
                message: 'Duplicate product ID in order'
            });
        }

        productIds.add(item.pid);
    }

    // Xử lý sản phẩm theo cùng thứ tự để giảm xung đột khóa.
    const sortedItems = [...items].sort((a, b) => a.pid - b.pid);

    try {
        const order = await prisma.$transaction(async (tx) => {
            const details = [];

            for (const item of sortedItems) {
                // Chỉ trừ khi lượng tồn hiện tại đủ đáp ứng.
                const result = await tx.product.updateMany({
                    where: {
                        pid: item.pid,
                        quantity: { gte: item.qty }
                    },
                    data: {
                        quantity: { decrement: item.qty }
                    }
                });

                if (result.count === 0) {
                    const product = await tx.product.findUnique({
                        where: { pid: item.pid }
                    });

                    if (!product) {
                        throw businessError(
                            404,
                            `Product ${item.pid} not found`
                        );
                    }

                    throw businessError(
                        409,
                        `Insufficient stock for product ${item.pid}`
                    );
                }

                const product = await tx.product.findUnique({
                    where: { pid: item.pid }
                });

                details.push({
                    pid: item.pid,
                    qty: item.qty,
                    unit_price: product.price
                });
            }

            return tx.order.create({
                data: {
                    uid: req.user.uid,
                    orderDetails: {
                        create: details
                    },
                    shipments: {
                        create: {
                            status: 'PENDING'
                        }
                    }
                },
                include: {
                    orderDetails: true,
                    shipments: true
                }
            });
        });

        return res.status(201).json({
            message: 'Order created successfully',
            order
        });
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({
                message: error.message
            });
        }

        if (error.code === 'P2034') {
            return res.status(409).json({
                message: 'Order conflict. Please try again'
            });
        }

        console.error('Create order failed:', error.message);

        return res.status(500).json({
            message: 'Cannot create order'
        });
    }
};

// GET /api/orders
exports.getOrders = async (req, res) => {
    try {
        const isAdmin = req.user.role.rolename === 'ADMIN';

        const orders = await prisma.order.findMany({
            where: isAdmin ? {} : { uid: req.user.uid },
            include: {
                orderDetails: true,
                shipments: true
            },
            orderBy: { oid: 'desc' }
        });

        return res.status(200).json(orders);
    } catch (error) {
        console.error('Get orders failed:', error.message);

        return res.status(500).json({
            message: 'Cannot get orders'
        });
    }
};

// GET /api/orders/:oid
exports.getOrderById = async (req, res) => {
    const oid = Number(req.params.oid);

    if (
        !/^[1-9]\d*$/.test(req.params.oid) ||
        !isPositiveInt(oid)
    ) {
        return res.status(400).json({
            message: 'Invalid order ID'
        });
    }

    try {
        const isAdmin = req.user.role.rolename === 'ADMIN';

        const order = await prisma.order.findFirst({
            where: {
                oid,
                ...(isAdmin ? {} : { uid: req.user.uid })
            },
            include: {
                orderDetails: true,
                shipments: true
            }
        });

        if (!order) {
            return res.status(404).json({
                message: 'Order not found'
            });
        }

        return res.status(200).json(order);
    } catch (error) {
        console.error('Get order failed:', error.message);

        return res.status(500).json({
            message: 'Cannot get order'
        });
    }
};