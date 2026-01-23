const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authenticateToken = require('../middleware/auth');

// 管理员权限中间件
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: '需要管理员权限' });
    }
    next();
};

// 论坛相关的管理功能已迁移到 cheman-forum-service
// 可以在这里添加其他非论坛相关的管理路由

module.exports = router;
