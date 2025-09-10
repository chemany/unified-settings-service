const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// 导入路由
const authRoutes = require('./routes/auth');
const settingsRoutes = require('./routes/settings');
const fileSettingsRoutes = require('./routes/fileSettings');

// 初始化数据库 - 已改为文件存储，暂时禁用
// require('./models/database');
// require('./models/User');
// require('./models/Settings');

const app = express();

// 安全中间件
app.use(helmet());

// 跨域设置
app.use(cors({
    origin: function (origin, callback) {
        // 允许的源列表
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:3001', 
            'http://localhost:5173',
            'http://localhost:3002',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:3001',
            'http://127.0.0.1:5173'
        ];
        
        // 允许本地文件访问（origin为null）
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(null, true); // 暂时允许所有源，生产环境需要限制
        }
    },
    credentials: true
}));

// 速率限制
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 分钟
    max: 300, // 限制每个 IP 15分钟内最多 300 个请求 (从100提高到300)
    message: {
        error: '请求太频繁，请稍后再试'
    }
});
//app.use(limiter);

// 解析 JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 健康检查
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'unified-settings-service'
    });
});

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/file-settings', fileSettingsRoutes);

// 404 错误处理
app.use('*', (req, res) => {
    res.status(404).json({
        error: '接口不存在'
    });
});

// 全局错误处理
app.use((error, req, res, next) => {
    console.error('服务器错误:', error);
    res.status(500).json({
        error: '服务器内部错误'
    });
});

const PORT = process.env.PORT || 3002;

app.listen(PORT, () => {
    console.log(`🚀 统一设置服务已启动: http://localhost:${PORT}`);
    console.log(`📊 健康检查: http://localhost:${PORT}/health`);
});

module.exports = app;