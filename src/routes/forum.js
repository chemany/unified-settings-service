const express = require('express');
const router = express.Router();
const forumController = require('../controllers/forumController');
const authenticateToken = require('../middleware/auth'); // 修正：该模块直接导出函数，非对象解构
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 附件存储配置 (NAS WebDAV 挂载路径 - 已切换到独立挂载点避免覆盖本地数据)
const NAS_ATTACHMENT_PATH = '/mnt/nas_jason/sata12-18153517921/MindOcean/attachments';

// 确保目录存在 (davfs 挂载点可能需要权限或已存在)
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

module.exports = router;
