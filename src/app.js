require('../scripts/check-env');

const express = require('express');
const prisma = require('./config/prisma');
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const shipmentRoutes = require('./routes/shipmentRoutes');

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/shipments', shipmentRoutes);

// Trang chủ.
app.get('/', (req, res) => {
    res.status(200).json({
        message: 'Ecommerce API is running'
    });
});

// Kiểm tra ứng dụng và kết nối database.
app.get('/health', async (req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;

        res.status(200).json({
            status: 'healthy',
            service: 'ecommerce-api',
            database: 'connected'
        });
    } catch (error) {
        console.error('Database healthcheck failed:', error.message);

        res.status(503).json({
            status: 'unhealthy',
            service: 'ecommerce-api',
            database: 'disconnected'
        });
    }
});

// Xử lý đường dẫn không tồn tại.
app.use((req, res) => {
    res.status(404).json({
        message: 'Route not found'
    });
});

// JSON lỗi phải trả JSON 400 thay vì trang lỗi HTML.
app.use((error, req, res, next) => {
    if (error.type === 'entity.parse.failed') {
        return res.status(400).json({ message: 'Invalid JSON body' });
    }
    if (error.type === 'entity.too.large') {
        return res.status(413).json({ message: 'Request body too large' });
    }
    console.error('Request failed:', error.message);
    return res.status(500).json({ message: 'Internal server error' });
});

// Kết nối database trước khi mở cổng API.
async function startServer() {
    try {
        await prisma.$connect();
        console.log('PostgreSQL connected');

        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log(
                `Ecommerce API running at http://localhost:${PORT}`
            );
        });

        server.on('error', async (error) => {
            console.error('Server error:', error.message);
            await prisma.$disconnect();
            process.exit(1);
        });
    } catch (error) {
        console.error('Database connection failed:', error.message);
        await prisma.$disconnect();
        process.exit(1);
    }
}

startServer();