const Forum = require('../models/Forum');
const { validationResult } = require('express-validator');

class ForumController {
    // 获取帖子列表
    static async getPosts(req, res) {
        try {
            console.log(`[Forum] GET /posts - Query: ${JSON.stringify(req.query)}`);
            const { category, search, sort, limit, offset } = req.query;
            const posts = await Forum.listPosts({
                category,
                search,
                sort: sort || 'latest',
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

    // 删除帖子
    static async deletePost(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id; // From auth middleware

    // 更新帖子
    static async updatePost(req, res) {
        try {
            const { id } = req.params;
            const { title, content, category, tags, type, attachments } = req.body;
            const userId = req.user.id;

            // 检查帖子是否存在及所有权
            const post = await Forum.getPostById(id);
            if (!post) {
                return res.status(404).json({ error: '帖子不存在' });
            }

            // 权限检查：只有作者可以删除 (后续可扩展管理员权限)
            if (String(post.user_id) !== String(userId)) {
            if (post.user_id !== userId && req.user.role !== 'admin') {
                return res.status(403).json({ error: '无权编辑此帖子' });
            }

            await Forum.updatePost(id, { title, content, category, tags, type, attachments });
            res.json({ success: true, message: '帖子更新成功' });
        } catch (error) {
            console.error('更新帖子错误:', error);
            res.status(500).json({ error: '更新帖子失败' });
        }
    }

    // 删除帖子
    static async deletePost(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            // 检查帖子是否存在及所有权
            const post = await Forum.getPostById(id);
            if (!post) {
                return res.status(404).json({ error: '帖子不存在' });
            }

            if (post.user_id !== userId && req.user.role !== 'admin') {
                return res.status(403).json({ error: '无权删除此帖子' });
            }

            await Forum.deletePost(id);
            res.json({ success: true, message: '帖子已删除' });
        } catch (error) {
            console.error('删除帖子错误:', error);
            res.status(500).json({ error: '删除失败' });
        }
    }

            res.status(500).json({ error: '删除帖子失败' });
        }
    }

    // 发布评论
    static async createComment(req, res) {
        try {
            const { postId, content, parentCommentId, replyToUserId, replyToUserName } = req.body;
            const comment = await Forum.createComment({
                postId,
                userId: req.user.id,
                authorName: req.user.username,
                content,
                parentCommentId: parentCommentId || null,
                replyToUserId: replyToUserId || null,
                replyToUserName: replyToUserName || null
            });
            res.status(201).json({ message: '回复成功', comment });
        } catch (error) {
            console.error('发布评论错误:', error);
            res.status(500).json({ error: '发表回复失败' });
        }
    }

    // 点赞/取消点赞
    static async toggleLike(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            if (!id) {
                return res.status(400).json({ error: '帖子ID不能为空' });
            }

            const result = await Forum.toggleLike(parseInt(id), userId);
            res.json(result);
        } catch (error) {
            console.error('点赞操作错误:', error);
            res.status(500).json({ error: '点赞失败' });
        }
    }

    // 收藏/取消收藏
    static async toggleCollect(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            if (!id) {
                return res.status(400).json({ error: '帖子ID不能为空' });
            }

            const result = await Forum.toggleCollect(parseInt(id), userId);
            res.json(result);
        } catch (error) {
            console.error('收藏操作错误:', error);
            res.status(500).json({ error: '收藏失败' });
        }
    }

    // 获取帖子互动状态（当前用户是否点赞/收藏）
    static async getPostStatus(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                return res.json({ liked: false, collected: false });
            }

            const [liked, collected] = await Promise.all([
                Forum.isLiked(parseInt(id), userId),
                Forum.isCollected(parseInt(id), userId)
            ]);

            res.json({ liked, collected });
        } catch (error) {
            console.error('获取状态错误:', error);
            res.status(500).json({ error: '获取状态失败' });
        }
    }

    // 批量获取帖子互动状态
    static async getBatchPostStatus(req, res) {
        try {
            const { ids } = req.query;
            const userId = req.user?.id;

            if (!userId || !ids) {
                return res.json({});
            }

            const idArray = ids.split(',').map(id => parseInt(id));
            const results = {};

            await Promise.all(idArray.map(async (id) => {
                const [liked, collected] = await Promise.all([
                    Forum.isLiked(id, userId),
                    Forum.isCollected(id, userId)
                ]);
                results[id] = { liked, collected };
            }));

            res.json(results);
        } catch (error) {
            console.error('批量获取状态错误:', error);
            res.status(500).json({ error: '批量获取状态失败' });
        }
    }

    // 获取当前用户的所有点赞帖子ID
    static async getUserLikedPosts(req, res) {
        try {
            const userId = req.user.id;
            const postIds = await Forum.getUserLikedPosts(userId);
            res.json({ postIds });
        } catch (error) {
            console.error('获取点赞列表错误:', error);
            res.status(500).json({ error: '获取点赞列表失败' });
        }
    }

    // 获取当前用户的所有收藏帖子ID
    static async getUserCollectedPosts(req, res) {
        try {
            const userId = req.user.id;
            const postIds = await Forum.getUserCollectedPosts(userId);
            res.json({ postIds });
        } catch (error) {
            console.error('获取收藏列表错误:', error);
            res.status(500).json({ error: '获取收藏列表失败' });
        }
    }

    // --- 用户相关接口 ---

    // 获取当前用户信息（包含统计信息）
    static async getCurrentUser(req, res) {
        try {
            const userId = req.user.id;
            const username = req.user.username || req.user.email;

            const [postCount, likeCount, collectCount, receivedLikes, commentCount, profile, joinDate] = await Promise.all([
                Forum.getUserPostCount(userId),
                Forum.getUserLikeCount(userId),
                Forum.getUserCollectCount(userId),
                Forum.getUserReceivedLikes(userId),
                Forum.getUserCommentCount(userId),
                Forum.getUserProfile(userId),
                Forum.getUserJoinDate(userId)
            ]);

            res.json({
                id: userId,
                username,
                joinDate,
                profile: {
                    points: profile.points,
                    level: profile.level,
                    levelTitle: profile.levelTitle,
                    levelIcon: profile.levelIcon,
                    nextLevelPoints: profile.nextLevelPoints,
                    currentLevelMinPoints: profile.currentLevelMinPoints,
                    expertiseTags: profile.expertise_tags,
                    bio: profile.bio
                },
                stats: {
                    posts: postCount,
                    comments: commentCount,
                    likesGiven: likeCount,
                    collections: collectCount,
                    receivedLikes
                }
            });
        } catch (error) {
            console.error('获取用户信息错误:', error);
            res.status(500).json({ error: '获取用户信息失败' });
        }
    }

    // 获取指定用户信息（公开）
    static async getUserById(req, res) {
        try {
            const { id } = req.params;

    // 获取指定用户信息（公开）
    static async getUserById(req, res) {
        try {
            const { id } = req.params;

            // 从 token 中获取当前用户（如果有登录）
            const currentUserId = req.user?.id;

            // 获取用户基本信息
            const userInfo = await Forum.getUserBasicInfo(id);

            const [postCount, receivedLikes] = await Promise.all([
                Forum.getUserPostCount(id),
                Forum.getUserReceivedLikes(id)
            ]);

            res.json({
                id,
                username: userInfo?.username || `用户${String(id).slice(-6)}`,
                stats: {
                    posts: postCount,
                    receivedLikes
                }
            });
        } catch (error) {
            console.error('获取用户信息错误:', error);
            res.status(500).json({ error: '获取用户信息失败' });
        }
    }
            });
        } catch (error) {
            console.error('获取用户信息错误:', error);
            res.status(500).json({ error: '获取用户信息失败' });
        }
    }

    // 获取指定用户发布的帖子（公开）
    static async getUserPostsById(req, res) {
        try {
            const { id } = req.params;
            const limit = parseInt(req.query.limit) || 20;
            const offset = parseInt(req.query.offset) || 0;

            const posts = await Forum.getUserPosts(id, limit, offset);
            res.json({ posts });
        } catch (error) {
            console.error('获取用户帖子错误:', error);
            res.status(500).json({ error: '获取帖子失败' });
        }
    }

    // 获取当前用户发布的帖子
    static async getMyPosts(req, res) {
        try {
            const userId = req.user.id;
            const limit = parseInt(req.query.limit) || 20;
            const offset = parseInt(req.query.offset) || 0;

            // 获取用户发布的帖子（从 forum_posts 表按 user_id 查询）
            const posts = await Forum.getUserPosts(userId, limit, offset);
            res.json({ posts });
        } catch (error) {
            console.error('获取我的帖子错误:', error);
            res.status(500).json({ error: '获取帖子失败' });
        }
    }

    // 获取当前用户点赞的帖子
    static async getMyLikedPosts(req, res) {
        try {
            const userId = req.user.id;
            const limit = parseInt(req.query.limit) || 20;
            const offset = parseInt(req.query.offset) || 0;

            const postIds = await Forum.getUserLikedPosts(userId);
            const posts = await Forum.getPostsByIds(postIds, limit, offset);
            res.json({ posts });
        } catch (error) {
            console.error('获取点赞帖子错误:', error);
            res.status(500).json({ error: '获取帖子失败' });
        }
    }

    // 获取当前用户收藏的帖子
    static async getMyCollectedPosts(req, res) {
        try {
            const userId = req.user.id;
            const limit = parseInt(req.query.limit) || 20;
            const offset = parseInt(req.query.offset) || 0;

            const postIds = await Forum.getUserCollectedPosts(userId);
            const posts = await Forum.getPostsByIds(postIds, limit, offset);
            res.json({ posts });
        } catch (error) {
            console.error('获取收藏帖子错误:', error);
            res.status(500).json({ error: '获取帖子失败' });
        }
    }

    // --- 站内消息接口 ---

    // 发送站内消息
    static async sendMessage(req, res) {
        try {
            const { receiverId, content } = req.body;
            const senderId = req.user.id;

            if (!receiverId || !content) {
                return res.status(400).json({ error: '收件人和内容不能为空' });
            }

            // 不能给自己发消息
            if (receiverId === senderId) {
                return res.status(400).json({ error: '不能给自己发消息' });
            }

            const message = await Forum.sendMessage({ senderId, receiverId, content });
            res.status(201).json({ message, success: true });
        } catch (error) {
            console.error('发送消息错误:', error);
            res.status(500).json({ error: '发送消息失败' });
        }
    }

    // 获取消息联系人列表
    static async getMessageContacts(req, res) {
        try {
            const userId = req.user.id;
            const messages = await Forum.getMessageContacts(userId);
            res.json({ messages });
        } catch (error) {
            console.error('获取消息列表错误:', error);
            res.status(500).json({ error: '获取消息列表失败' });
        }
    }

    // 获取与特定用户的对话
    static async getConversation(req, res) {
        try {
            const userId = req.user.id;
            const { otherId } = req.params;
            const limit = parseInt(req.query.limit) || 50;
            const offset = parseInt(req.query.offset) || 0;

            const messages = await Forum.getConversation(userId, otherId, limit, offset);
            res.json({ messages });
        } catch (error) {
            console.error('获取对话错误:', error);
            res.status(500).json({ error: '获取对话失败' });
        }
    }

    // 获取未读消息数量
    static async getUnreadCount(req, res) {
        try {
            const userId = req.user.id;
            const count = await Forum.getUnreadCount(userId);
            res.json({ count });
        } catch (error) {
            console.error('获取未读数错误:', error);
            res.status(500).json({ error: '获取未读数失败' });
        }
    }

    // 标记对话为已读
    static async markConversationAsRead(req, res) {
        try {
            const userId = req.user.id;
            const { otherId } = req.params;

            await Forum.markConversationAsRead(userId, otherId);
            res.json({ success: true });
        } catch (error) {
            console.error('标记已读错误:', error);
            res.status(500).json({ error: '操作失败' });
        }
    }

    // --- 用户资料更新接口 ---

    // 更新擅长领域标签
    static async updateExpertiseTags(req, res) {
        try {
            const userId = req.user.id;
            const { tags } = req.body;

            if (!Array.isArray(tags)) {
                return res.status(400).json({ error: '标签格式错误' });
            }

            const updatedTags = await Forum.updateExpertiseTags(userId, tags);
            res.json({ success: true, tags: updatedTags });
        } catch (error) {
            console.error('更新标签错误:', error);
            res.status(500).json({ error: '更新失败' });
        }
    }

    // 更新个人简介
    static async updateBio(req, res) {
        try {
            const userId = req.user.id;
            const { bio } = req.body;

            const updatedBio = await Forum.updateBio(userId, bio || '');
            res.json({ success: true, bio: updatedBio });
        } catch (error) {
            console.error('更新简介错误:', error);
            res.status(500).json({ error: '更新失败' });
        }
    }

    // 获取可用的擅长领域选项
    static async getExpertiseOptions(req, res) {
        res.json({ options: Forum.EXPERTISE_OPTIONS });
    }

    // 获取等级配置
    static async getLevelConfig(req, res) {
        res.json({ levels: Forum.LEVEL_CONFIG, rules: Forum.POINTS_RULES });
    }
}

module.exports = ForumController;
