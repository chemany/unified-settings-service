const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
    try {
        // 从请求头中获取令牌
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                error: '访问被拒绝，未提供令牌'
            });
        }

        // 验证令牌
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        
        // 查找用户，如果不存在则为文件系统存储创建虚拟用户
        let user = await User.findById(decoded.userId);
        if (!user) {
            console.log(`[认证] 用户 ${decoded.userId} 在数据库中不存在，创建虚拟用户用于文件存储`);
            // 为文件存储创建虚拟用户对象
            user = {
                id: decoded.userId,
                email: decoded.email || `${decoded.userId}@local`,
                username: decoded.username || decoded.userId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
        }

        // 将用户信息添加到请求对象
        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                error: '无效的令牌'
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: '令牌已过期'
            });
        }

        console.error('认证中间件错误:', error);
        res.status(500).json({
            error: '服务器错误'
        });
    }
};

module.exports = auth;