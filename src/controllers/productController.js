const prisma = require('../config/prisma');

// Kiểm tra mã sản phẩm.
function validPid(value) {
    return /^[1-9]\d*$/.test(value) &&
        Number(value) <= 2147483647;
}

// Kiểm tra dữ liệu khi thêm hoặc sửa sản phẩm.
function validateProduct(body) {
    const { pname, price, quantity } = body || {};

    if (
        typeof pname !== 'string' ||
        pname.trim().length === 0 ||
        pname.trim().length > 100
    ) {
        return 'Product name must contain 1-100 characters';
    }

    // Giá nhận dạng số hoặc chuỗi thập phân.
    // Tối đa 8 chữ số nguyên và 2 chữ số thập phân.
    if (
        !['string', 'number'].includes(typeof price) ||
        !/^\d{1,8}(\.\d{1,2})?$/.test(String(price))
    ) {
        return 'Price must be between 0 and 99999999.99 with at most 2 decimal places';
    }

    if (
        !Number.isInteger(quantity) ||
        quantity < 0 ||
        quantity > 2147483647
    ) {
        return 'Quantity must be a non-negative integer within the database limit';
    }

    return null;
}

// Xử lý lỗi database dùng chung.
function handleError(error, res) {
    if (error.code === 'P2025') {
        return res.status(404).json({
            message: 'Product not found'
        });
    }

    if (error.code === 'P2003') {
        return res.status(409).json({
            message: 'Cannot delete a product referenced by an order'
        });
    }

    console.error('Product error:', error.message);

    return res.status(500).json({
        message: 'Internal server error'
    });
}

// GET /api/products
exports.getProducts = async (req, res) => {
    try {
        const products = await prisma.product.findMany({
            orderBy: { pid: 'asc' }
        });

        return res.status(200).json(products);
    } catch (error) {
        return handleError(error, res);
    }
};

// GET /api/products/:pid
exports.getProductById = async (req, res) => {
    if (!validPid(req.params.pid)) {
        return res.status(400).json({
            message: 'Invalid product ID'
        });
    }

    try {
        const product = await prisma.product.findUnique({
            where: { pid: Number(req.params.pid) }
        });

        if (!product) {
            return res.status(404).json({
                message: 'Product not found'
            });
        }

        return res.status(200).json(product);
    } catch (error) {
        return handleError(error, res);
    }
};

// POST /api/products
exports.createProduct = async (req, res) => {
    const validationError = validateProduct(req.body);

    if (validationError) {
        return res.status(400).json({
            message: validationError
        });
    }

    try {
        const { pname, price, quantity } = req.body;

        const product = await prisma.product.create({
            data: {
                pname: pname.trim(),
                price: String(price),
                quantity
            }
        });

        return res.status(201).json({
            message: 'Product created successfully',
            product
        });
    } catch (error) {
        return handleError(error, res);
    }
};

// PUT /api/products/:pid
exports.updateProduct = async (req, res) => {
    if (!validPid(req.params.pid)) {
        return res.status(400).json({
            message: 'Invalid product ID'
        });
    }

    const validationError = validateProduct(req.body);

    if (validationError) {
        return res.status(400).json({
            message: validationError
        });
    }

    try {
        const { pname, price, quantity } = req.body;

        const product = await prisma.product.update({
            where: { pid: Number(req.params.pid) },
            data: {
                pname: pname.trim(),
                price: String(price),
                quantity
            }
        });

        return res.status(200).json({
            message: 'Product updated successfully',
            product
        });
    } catch (error) {
        return handleError(error, res);
    }
};

// DELETE /api/products/:pid
exports.deleteProduct = async (req, res) => {
    if (!validPid(req.params.pid)) {
        return res.status(400).json({
            message: 'Invalid product ID'
        });
    }

    try {
        await prisma.product.delete({
            where: { pid: Number(req.params.pid) }
        });

        return res.status(200).json({
            message: 'Product deleted successfully'
        });
    } catch (error) {
        return handleError(error, res);
    }
};