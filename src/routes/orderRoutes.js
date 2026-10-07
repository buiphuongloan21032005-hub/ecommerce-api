const express = require('express');
const orderController = require('../controllers/orderController');
const { authenticate } = require('../middlewares/authMiddleware');

const router = express.Router();

// Tất cả API đơn hàng đều yêu cầu đăng nhập.
router.use(authenticate);

router.post('/', orderController.createOrder);
router.get('/', orderController.getOrders);
router.get('/:oid', orderController.getOrderById);

module.exports = router;