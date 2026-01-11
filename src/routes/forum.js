const express = require('express');
const router = express.Router();
const forumController = require('../controllers/forumController');
const authenticateToken = require('../middleware/auth'); // 修正：该模块直接导出函数，非对象解构
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 附件存储配置 (优先使用本地目录，解决 NAS 权限问题)
const NAS_ATTACHMENT_PATH = '/root/code/cheman.top/notepads/attachments';

// 确保目录存在
try {
    if (!fs.existsSync(NAS_ATTACHMENT_PATH)) {
        fs.mkdirSync(NAS_ATTACHMENT_PATH, { recursive: true });
    }
} catch (e) {
    console.error('无法创建附件目录:', e.message);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, NAS_ATTACHMENT_PATH);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 限制 100MB
});

// 公开接口 (确保名称与控制器匹配)
router.get('/posts', forumController.getPosts);
router.get('/posts/:id', forumController.getPost);

// 需要登录的接口
router.post('/posts', authenticateToken, forumController.createPost);
router.delete('/posts/:id', authenticateToken, forumController.deletePost); // Add delete route
router.put('/posts/:id', authenticateToken, forumController.updatePost);
router.delete('/posts/:id', authenticateToken, forumController.deletePost);
router.post('/comments', authenticateToken, forumController.createComment);

// 附件上传接口
router.post('/upload', authenticateToken, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: '请选择要上传的文件' });
    }
    // 修复中文文件名乱码问题 (Multer 默认可能按 latin1 处理)
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

    // 返回可访问的 URL 路径
    const fileUrl = `/attachments/${req.file.filename}`;
    res.json({
        url: fileUrl,
        name: originalName
    });
});

// 附件删除接口（用于清理未提交的附件）
router.delete('/attachment', authenticateToken, (req, res) => {
    const { url } = req.body;
    if (!url || !url.startsWith('/attachments/')) {
        return res.status(400).json({ error: '无效的附件路径' });
    }

    // 从 URL 提取文件名
    const filename = url.replace('/attachments/', '');
    // 防止路径遍历攻击
    if (filename.includes('..') || filename.includes('/')) {
        return res.status(400).json({ error: '无效的文件名' });
    }

    const filePath = path.join(NAS_ATTACHMENT_PATH, filename);

    fs.unlink(filePath, (err) => {
        if (err) {
            console.warn('删除附件失败:', err.message);
            // 文件不存在也返回成功（幂等性）
            return res.json({ success: true, message: '附件已删除或不存在' });
        }
        res.json({ success: true, message: '附件已删除' });
    });
});

// --- 用户相关接口 ---

// 获取当前用户信息（包含统计信息）
router.get('/user/me', authenticateToken, forumController.getCurrentUser);

// 获取指定用户信息（公开）
router.get('/user/:id', forumController.getUserById);

// 获取指定用户发布的帖子（公开）
router.get('/user/:id/posts', forumController.getUserPostsById);

// 获取当前用户发布的帖子
router.get('/user/me/posts', authenticateToken, forumController.getMyPosts);

// 获取当前用户点赞的帖子
router.get('/user/me/likes', authenticateToken, forumController.getMyLikedPosts);

// 获取当前用户收藏的帖子
router.get('/user/me/collections', authenticateToken, forumController.getMyCollectedPosts);

// 更新当前用户擅长领域标签
router.put('/user/me/expertise', authenticateToken, forumController.updateExpertiseTags);

// 更新当前用户个人简介
router.put('/user/me/bio', authenticateToken, forumController.updateBio);

// 获取可用的擅长领域选项（公开）
router.get('/expertise-options', forumController.getExpertiseOptions);

// 获取等级配置（公开）
router.get('/level-config', forumController.getLevelConfig);

// --- 互动接口 ---

// 点赞/取消点赞
router.post('/posts/:id/like', authenticateToken, forumController.toggleLike);

// 收藏/取消收藏
router.post('/posts/:id/collect', authenticateToken, forumController.toggleCollect);

// 获取帖子互动状态（当前用户是否点赞/收藏）
router.get('/posts/:id/status', authenticateToken, forumController.getPostStatus);

// 批量获取帖子互动状态
router.get('/posts-status/batch', authenticateToken, forumController.getBatchPostStatus);

// --- 站内消息接口 ---

// 发送站内消息
router.post('/messages/send', authenticateToken, forumController.sendMessage);

// 获取消息联系人列表
router.get('/messages/contacts', authenticateToken, forumController.getMessageContacts);

// 获取与特定用户的对话
router.get('/messages/conversation/:otherId', authenticateToken, forumController.getConversation);

// 获取未读消息数量
router.get('/messages/unread-count', authenticateToken, forumController.getUnreadCount);

// 标记对话为已读
router.post('/messages/read/:otherId', authenticateToken, forumController.markConversationAsRead);

// 置顶/取消置顶帖子（仅管理员）
router.post('/posts/:id/pin', authenticateToken, async (req, res) => {
    try {
        // 检查是否为管理员
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: '无权限操作' });
        }

        const { id } = req.params;
        const db = require('../models/database');

        // 获取当前置顶状态
        const post = db.prepare('SELECT is_top FROM forum_posts WHERE id = ?').get(id);
        if (!post) {
            return res.status(404).json({ error: '帖子不存在' });
        }

        // 切换置顶状态
        const newStatus = post.is_top ? 0 : 1;
        db.prepare('UPDATE forum_posts SET is_top = ? WHERE id = ?').run(newStatus, id);

        res.json({
            success: true,
            isPinned: newStatus === 1,
            message: newStatus ? '帖子已置顶' : '已取消置顶'
        });
    } catch (error) {
        console.error('置顶操作错误:', error);
        res.status(500).json({ error: '操作失败' });
    }
});

module.exports = router;
