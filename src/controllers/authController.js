const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');

exports.register = async (req, res) => {
    try {
        const { username, fullname, password } = req.body || {};

        // Kiểm tra kiểu dữ liệu.
        if (
            typeof username !== 'string' ||
            typeof fullname !== 'string' ||
            typeof password !== 'string'
        ) {
            return res.status(400).json({
                message: 'username, fullname and password are required'
            });
        }

        const cleanUsername = username.trim().toLowerCase();
        const cleanFullname = fullname.trim();

        if (!/^[a-z0-9_]{3,50}$/.test(cleanUsername)) {
            return res.status(400).json({
                message: 'Username must contain 3-50 letters, numbers or underscores'
            });
        }

        if (
            cleanFullname.length === 0 ||
            cleanFullname.length > 100
        ) {
            return res.status(400).json({
                message: 'Fullname must contain 1-100 characters'
            });
        }

        if (
            password.length < 8 ||
            Buffer.byteLength(password, 'utf8') > 72
        ) {
            return res.status(400).json({
                message: 'Password must have at least 8 characters and at most 72 bytes'
            });
        }

        // Kiểm tra tên đăng nhập đã tồn tại.
        const existingUser = await prisma.user.findUnique({
            where: { username: cleanUsername }
        });

        if (existingUser) {
            return res.status(409).json({
                message: 'Username already exists'
            });
        }

        // Server tự chọn vai trò và hạng thành viên mặc định.
        const role = await prisma.role.findFirst({
            where: { rolename: 'normal' }
        });

        const membership = await prisma.memberShip.findFirst({
            where: { mname: 'BASIC' }
        });

        if (!role || !membership) {
            return res.status(500).json({
                message: 'Default data missing. Run npm run seed first'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const user = await prisma.user.create({
            data: {
                username: cleanUsername,
                fullname: cleanFullname,
                password: hashedPassword,
                roleid: role.roleid,
                mid: membership.mid
            },
            select: {
                uid: true,
                username: true,
                fullname: true,
                role: {
                    select: { rolename: true }
                },
                membership: {
                    select: {
                        mname: true,
                        score: true
                    }
                }
            }
        });

        return res.status(201).json({
            message: 'Register successfully',
            user
        });
    } catch (error) {
        // Xử lý cả trường hợp hai yêu cầu đăng ký trùng cùng lúc.
        if (error.code === 'P2002') {
            return res.status(409).json({
                message: 'Username already exists'
            });
        }

        console.error('Register failed:', error.message);

        return res.status(500).json({
            message: 'Internal server error'
        });
    }
};
exports.login = async (req, res) => {
    try {
        const { username, password } = req.body || {};

        if (
            typeof username !== 'string' ||
            typeof password !== 'string'
        ) {
            return res.status(400).json({
                message: 'Username and password are required'
            });
        }

        const cleanUsername = username.trim().toLowerCase();

        if (
            !/^[a-z0-9_]{3,50}$/.test(cleanUsername) ||
            password.length === 0 ||
            Buffer.byteLength(password, 'utf8') > 72
        ) {
            return res.status(400).json({
                message: 'Invalid username or password format'
            });
        }

        const user = await prisma.user.findUnique({
            where: { username: cleanUsername },
            include: {
                role: true,
                membership: true
            }
        });

        if (!user) {
            return res.status(401).json({
                message: 'Invalid username or password'
            });
        }

        const passwordMatches = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatches) {
            return res.status(401).json({
                message: 'Invalid username or password'
            });
        }

        const secret = process.env.JWT_SECRET;

        if (!secret || secret.length < 32) {
            console.error('JWT_SECRET is missing or too short');

            return res.status(500).json({
                message: 'Authentication configuration error'
            });
        }

        const token = jwt.sign(
            { uid: user.uid },
            secret,
            {
                algorithm: 'HS256',
                expiresIn: process.env.JWT_EXPIRES_IN || '1h'
            }
        );

        return res.status(200).json({
            message: 'Login successfully',
            token,
            user: {
                uid: user.uid,
                username: user.username,
                fullname: user.fullname,
                role: user.role.rolename,
                membership: user.membership.mname,
                score: user.membership.score
            }
        });
    } catch (error) {
        console.error('Login failed:', error.message);

        return res.status(500).json({
            message: 'Internal server error'
        });
    }
};
exports.getMe = (req, res) => {
    return res.status(200).json({
        user: {
            uid: req.user.uid,
            username: req.user.username,
            fullname: req.user.fullname,
            role: req.user.role.rolename,
            membership: req.user.membership.mname,
            score: req.user.membership.score
        }
    });
};