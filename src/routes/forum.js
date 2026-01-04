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

module.exports = router;
