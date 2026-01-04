const Forum = require('../models/Forum');
const { validationResult } = require('express-validator');

class ForumController {
    // 获取帖子列表
    static async getPosts(req, res) {
        try {
            console.log(`[Forum] GET /posts - Query: ${JSON.stringify(req.query)}`);
            const { category, search, limit, offset } = req.query;
            const posts = await Forum.listPosts({
                category,
                search,
                limit: parseInt(limit) || 20,
                offset: parseInt(offset) || 0
            });
            console.log(`[Forum] Found ${posts.length} posts`);
            res.json({ posts });
        } catch (error) {
            console.error('获取帖子列表错误:', error);
            res.status(500).json({ error: '获取帖子列表失败' });
        }
    }

    // 获取帖子详情
    static async getPost(req, res) {
        try {
            const { id } = req.params;
            const post = await Forum.getPostById(id);
            if (!post) {
                return res.status(404).json({ error: '帖子不存在' });
            }

            // 增加浏览量
            await Forum.incrementViews(id);

            // 获取评论
            const comments = await Forum.getCommentsByPostId(id);

            res.json({ post, comments });
        } catch (error) {
            console.error('获取帖子详情错误:', error);
            res.status(500).json({ error: '获取帖子详情失败' });
        }
    }

    // 创建帖子
    static async createPost(req, res) {
        try {
            const { title, content, category, tags, type, attachments } = req.body;
            const post = await Forum.createPost({
                title,
                content,
                category,
                tags,
                type: type || 'help',
                attachments: attachments || [],
                userId: req.user.id,
                authorName: req.user.username || req.user.email
            });
            res.status(201).json(post);
        } catch (error) {
            console.error('创建帖子错误:', error);
            res.status(500).json({ error: '发布帖子失败' });
        }
    }

    // 发布评论
    static async createComment(req, res) {
        try {
            const { postId, content } = req.body;
            const comment = await Forum.createComment({
                postId,
                userId: req.user.id,
                authorName: req.user.username,
                content
            });
            res.status(201).json({ message: '回复成功', comment });
        } catch (error) {
            console.error('发布评论错误:', error);
            res.status(500).json({ error: '发表回复失败' });
        }
    }
}

module.exports = ForumController;
