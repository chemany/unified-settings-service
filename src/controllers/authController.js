const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

class AuthController {
    // 用户注册
    static async register(req, res) {
        try {
            // 验证输入数据
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: '输入数据验证失败',
                    details: errors.array()
                });
            }

            const { email, username, password } = req.body;

            try {
                const newUser = await User.createUser({ email, username, password });
                
                res.status(201).json({
                    message: '注册成功',
                    user: newUser
                });
            } catch (error) {
                if (error.message.includes('邮箱已被注册') || error.message.includes('用户名已被使用')) {
                    return res.status(409).json({
                        error: error.message
                    });
                }
                throw error;
            }
        } catch (error) {
            console.error('注册错误:', error);
            res.status(500).json({
                error: '注册失败'
            });
        }
    }

    // 用户登录
    static async login(req, res) {
        try {
            // 验证输入数据
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: '输入数据验证失败',
                    details: errors.array()
                });
            }

            const { email, password } = req.body;            // 验证用户邮箱和密码
            const userWithPassword = await User.findByEmailWithPassword(email);
            if (!userWithPassword) {
                return res.status(401).json({
                    error: '邮箱或密码错误'
                });
            }

            const bcrypt = require('bcryptjs');
            const isPasswordValid = await bcrypt.compare(password, userWithPassword.password);
            if (!isPasswordValid) {
                return res.status(401).json({
                    error: '邮箱或密码错误'
                });
            }

            // 生成JWT令牌
            const token = jwt.sign(
                { 
                    userId: userWithPassword.id,
                    email: userWithPassword.email
                },
                process.env.JWT_SECRET || 'your-secret-key',
                { expiresIn: '24h' }
            );

            // 获取用户信息(不含密码)
            const user = await User.findById(userWithPassword.id);

            res.json({
                message: '登录成功',
                accessToken: token,
                user: user
            });
        } catch (error) {
            console.error('登录错误:', error);
            res.status(500).json({
                error: '登录失败'
            });
        }
    }

    // 验证令牌
    static async verifyToken(req, res) {
        try {
            // 从请求头中获取令牌
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];

            if (!token) {
                return res.status(401).json({
                    error: '未提供访问令牌'
                });
            }

            // 验证令牌
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
            const user = await User.findById(decoded.userId);

            if (!user) {
                return res.status(401).json({
                    error: '无效的访问令牌'
                });
            }

            res.json({
                valid: true,
                user: user
            });
        } catch (error) {
            if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
                return res.status(401).json({
                    error: '无效或过期的访问令牌'
                });
            }

            console.error('验证令牌错误:', error);
            res.status(500).json({
                error: '令牌验证失败'
            });
        }
    }    // 刷新令牌
    static async refreshToken(req, res) {
        try {
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];

            if (!token) {
                return res.status(401).json({
                    error: '未提供访问令牌'
                });
            }

            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
                const user = await User.findById(decoded.userId);

                if (!user) {
                    return res.status(401).json({
                        error: '用户不存在'
                    });
                }

                // 生成新的令牌
                const newToken = jwt.sign(
                    { 
                        userId: user.id,
                        email: user.email
                    },
                    process.env.JWT_SECRET || 'your-secret-key',
                    { expiresIn: '24h' }
                );

                res.json({
                    message: '令牌刷新成功',
                    accessToken: newToken,
                    user: user
                });
            } catch (error) {
                if (error.name === 'TokenExpiredError') {
                    return res.status(401).json({
                        error: '令牌已过期，请重新登录'
                    });
                }
                throw error;
            }
        } catch (error) {
            console.error('刷新令牌错误:', error);
            res.status(500).json({
                error: '令牌刷新失败'
            });
        }
    }

    // 获取当前用户信息
    static async getCurrentUser(req, res) {
        try {
            const user = await User.findById(req.user.id);
            
            if (!user) {
                return res.status(404).json({
                    error: '用户不存在'
                });
            }

            // 添加 role 信息
            user.role = req.user.role || 'user';

            res.json({
                user: user
            });
        } catch (error) {
            console.error('获取用户信息错误:', error);
            res.status(500).json({
                error: '获取用户信息失败'
            });
        }
    }

    // 更新用户信息
    static async updateUser(req, res) {
        try {
            // 验证输入数据
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: '输入数据验证失败',
                    details: errors.array()
                });
            }

            const userId = req.user.id;
            const updateData = req.body;

            try {
                const updatedUser = await User.updateUser(userId, updateData);
                
                res.json({
                    message: '用户信息更新成功',
                    user: updatedUser
                });
            } catch (error) {
                if (error.message.includes('邮箱已被') || error.message.includes('用户名已被')) {
                    return res.status(409).json({
                        error: error.message
                    });
                }
                throw error;
            }
        } catch (error) {
            console.error('更新用户信息错误:', error);
            res.status(500).json({
                error: '更新用户信息失败'
            });
        }
    }

    // 注销登录
    static async logout(req, res) {
        try {
            // 在实际项目中，可以将令牌加入黑名单
            // 这里只是返回成功消息
            res.json({
                message: '注销成功'
            });
        } catch (error) {
            console.error('注销错误:', error);
            res.status(500).json({
                error: '注销失败'
            });
        }
    }
}

module.exports = AuthController;