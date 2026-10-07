const express = require('express');

const authController = require('../controllers/authController');

const {
    authenticate,
    authorize
} = require('../middlewares/authMiddleware');

const router = express.Router();

// Đăng ký.
router.post('/register', authController.register);

// Đăng nhập.
router.post('/login', authController.login);

// Xem thông tin tài khoản đang đăng nhập.
router.get('/me', authenticate, authController.getMe);

// Kiểm tra quyền quản trị.
router.get(
    '/admin-check',
    authenticate,
    authorize('ADMIN'),
    (req, res) => {
        res.status(200).json({
            message: 'Admin access granted'
        });
    }
);

module.exports = router;