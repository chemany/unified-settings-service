const express = require('express');
const { body } = require('express-validator');
const AuthController = require('../controllers/authController');
const auth = require('../middleware/auth');

const router = express.Router();

// 用户注册
router.post('/register', [
    body('email')
        .isEmail()
        .withMessage('请输入有效的邮箱地址')
        .normalizeEmail(),
    body('username')
        .isLength({ min: 3, max: 20 })
        .withMessage('用户名长度应在3-20个字符之间')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('用户名只能包含字母、数字和下划线'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('密码至少6个字符')
        .matches(/^(?=.*[a-zA-Z])(?=.*\d)/)
        .withMessage('密码必须包含至少一个字母和一个数字')
], AuthController.register);

// 用户登录
router.post('/login', [
    body('email')
        .isEmail()
        .withMessage('请输入有效的邮箱地址')
        .normalizeEmail(),
    body('password')
        .notEmpty()
        .withMessage('密码不能为空')
], AuthController.login);

// 验证令牌
router.get('/verify', AuthController.verifyToken);

// 刷新令牌
router.post('/refresh', AuthController.refreshToken);

// 获取当前用户信息 (需要认证)
router.get('/me', auth, AuthController.getCurrentUser);

// 更新用户信息 (需要认证)
router.put('/me', [
    auth,
    body('email')
        .optional()
        .isEmail()
        .withMessage('请输入有效的邮箱地址')
        .normalizeEmail(),
    body('username')
        .optional()
        .isLength({ min: 3, max: 20 })
        .withMessage('用户名长度应在3-20个字符之间')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('用户名只能包含字母、数字和下划线'),
    body('password')
        .optional()
        .isLength({ min: 6 })
        .withMessage('密码至少6个字符')
        .matches(/^(?=.*[a-zA-Z])(?=.*\d)/)
        .withMessage('密码必须包含至少一个字母和一个数字')
], AuthController.updateUser);

// 注销登录 (需要认证)
router.post('/logout', auth, AuthController.logout);

module.exports = router;