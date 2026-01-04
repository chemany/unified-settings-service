const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// 导入路由
const authRoutes = require('./routes/auth');
const settingsRoutes = require('./routes/settings');
const fileSettingsRoutes = require('./routes/fileSettings');
const aiRoutes = require('./routes/ai');
const forumRoutes = require('./routes/forum');

const app = express();

// 安全中间件
app.use(helmet());

// 跨域设置 - 允许所有源
app.use(cors({
    origin: true,
    credentials: true
}));

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
app.use('/api/ai', aiRoutes);
app.use('/api/forum', forumRoutes);

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
