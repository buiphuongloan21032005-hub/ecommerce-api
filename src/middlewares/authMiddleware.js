const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');

exports.authenticate = async (req, res, next) => {
    const authorization = req.get('Authorization') || '';
    const match = authorization.match(/^Bearer\s+(\S+)$/i);

    if (!match) {
        return res.status(401).json({
            message: 'Bearer token is required'
        });
    }

    const secret = process.env.JWT_SECRET;

    if (!secret || secret.length < 32) {
        return res.status(500).json({
            message: 'Authentication configuration error'
        });
    }

    let payload;

    // Xác minh chữ ký và thời hạn của token.
    try {
        payload = jwt.verify(match[1], secret, {
            algorithms: ['HS256']
        });
    } catch (error) {
        return res.status(401).json({
            message: 'Invalid or expired token'
        });
    }

    if (
        !payload ||
        typeof payload !== 'object' ||
        !Number.isInteger(payload.uid) ||
        payload.uid <= 0 ||
        !Number.isInteger(payload.exp)
    ) {
        return res.status(401).json({
            message: 'Invalid token payload'
        });
    }

    try {
        // Lấy thông tin và quyền hiện tại từ database.
        const user = await prisma.user.findUnique({
            where: { uid: payload.uid },
            select: {
                uid: true,
                mid: true,
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

        if (!user) {
            return res.status(401).json({
                message: 'User no longer exists'
            });
        }

        req.user = user;
        return next();
    } catch (error) {
        console.error('Authentication failed:', error.message);

        return res.status(500).json({
            message: 'Internal server error'
        });
    }
};
exports.authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                message: 'Authentication required'
            });
        }

        if (!allowedRoles.includes(req.user.role.rolename)) {
            return res.status(403).json({
                message: 'Access denied'
            });
        }

        return next();
    };
};