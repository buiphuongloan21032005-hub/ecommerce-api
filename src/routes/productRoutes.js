const express = require('express');
const productController = require('../controllers/productController');

const {
    authenticate,
    authorize
} = require('../middlewares/authMiddleware');

const router = express.Router();

// Mọi người được xem sản phẩm.
router.get('/', productController.getProducts);
router.get('/:pid', productController.getProductById);

// Chỉ ADMIN được thêm, sửa và xóa.
router.post(
    '/',
    authenticate,
    authorize('ADMIN'),
    productController.createProduct
);

router.put(
    '/:pid',
    authenticate,
    authorize('ADMIN'),
    productController.updateProduct
);

router.delete(
    '/:pid',
    authenticate,
    authorize('ADMIN'),
    productController.deleteProduct
);

module.exports = router;