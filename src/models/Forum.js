const db = require('./database');

class Forum {
    constructor() {
        this.initTables();
    }

    initTables() {
        try {
            // 创建帖子表
            db.prepare(`
                CREATE TABLE IF NOT EXISTS forum_posts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL,
                    category TEXT NOT NULL, -- 'process', 'equipment', 'safety', 'career', etc.
                    tags TEXT,              -- JSON string of tags
                    user_id TEXT NOT NULL,
                    author_name TEXT NOT NULL,
                    views INTEGER DEFAULT 0,
                    likes INTEGER DEFAULT 0,
                    is_top INTEGER DEFAULT 0, -- 0 or 1
                    status TEXT DEFAULT 'active',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `).run();

            // 创建评论表
            db.prepare(`
                CREATE TABLE IF NOT EXISTS forum_comments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    post_id INTEGER NOT NULL,
                    user_id TEXT NOT NULL,
                    author_name TEXT NOT NULL,
                    content TEXT NOT NULL,
                    likes INTEGER DEFAULT 0,
                    is_accepted INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE
                )
            `).run();

            // 自动补全字段 (用于已有表的升级)
            const columns = db.prepare("PRAGMA table_info(forum_posts)").all();
            const colNames = columns.map(c => c.name);

            if (!colNames.includes('type')) {
                db.prepare("ALTER TABLE forum_posts ADD COLUMN type TEXT DEFAULT 'help'").run();
            }
            if (!colNames.includes('attachments')) {
                db.prepare("ALTER TABLE forum_posts ADD COLUMN attachments TEXT DEFAULT '[]'").run();
            }
            if (!colNames.includes('is_essence')) {
                db.prepare("ALTER TABLE forum_posts ADD COLUMN is_essence INTEGER DEFAULT 0").run();
            }

            // 创建点赞表
            db.prepare(`
                CREATE TABLE IF NOT EXISTS forum_likes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    post_id INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, post_id),
                    FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE
                )
            `).run();

            // 创建收藏表
            db.prepare(`
                CREATE TABLE IF NOT EXISTS forum_collections (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    post_id INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, post_id),
                    FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE
                )
            `).run();

            // 创建站内消息表
            db.prepare(`
                CREATE TABLE IF NOT EXISTS forum_messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sender_id TEXT NOT NULL,
                    receiver_id TEXT NOT NULL,
                    content TEXT NOT NULL,
                    is_read INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `).run();

            console.log('Forum表初始化/升级成功');
        } catch (error) {
            console.error('Forum表初始化失败:', error);
        }
    }

    // --- 帖子操作 ---

    static async createPost({ title, content, category, tags, type = 'help', attachments = [], userId, authorName }) {
        const stmt = db.prepare(`
            INSERT INTO forum_posts (title, content, category, tags, type, attachments, user_id, author_name)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(title, content, category, JSON.stringify(tags), type, JSON.stringify(attachments), userId, authorName);
        return this.getPostById(result.lastInsertRowid);
    }

    static async getPostById(id) {
        const stmt = db.prepare('SELECT * FROM forum_posts WHERE id = ?');
        const post = stmt.get(id);
        if (post) {
            post.tags = JSON.parse(post.tags || '[]');
            post.attachments = JSON.parse(post.attachments || '[]');
            return post;
        }
        return null;
    }

    static async listPosts({ category, search, sort = 'latest', limit = 20, offset = 0 }) {
        let query = "SELECT * FROM forum_posts WHERE status = 'active'";
        const params = [];

        if (category && category !== 'all') {
            query += ' AND category = ?';
            params.push(category);
        }

        if (search) {
            query += ' AND (title LIKE ? OR content LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        // 精华帖子筛选
        if (sort === 'essence') {
            query += ' AND is_essence = 1';
        }

        // 排序逻辑
        switch (sort) {
            case 'hot':
                // 最热：按浏览量 + 回复数排序
                query += ' ORDER BY is_top DESC, (views + (SELECT COUNT(*) FROM forum_comments WHERE post_id = forum_posts.id)) DESC, created_at DESC';
                break;
            case 'essence':
            case 'latest':
            default:
                // 默认按发布时间倒序
                query += ' ORDER BY is_top DESC, created_at DESC';
                break;
        }

        query += ' LIMIT ? OFFSET ?';
        params.push(Math.floor(limit), Math.floor(offset));

        const stmt = db.prepare(query);
        const posts = stmt.all(...params);
        return posts.map(p => ({
            ...p,
            tags: JSON.parse(p.tags || '[]'),
            attachments: JSON.parse(p.attachments || '[]')
        }));
    }

    static async incrementViews(id) {
        db.prepare('UPDATE forum_posts SET views = views + 1 WHERE id = ?').run(id);
    }

    // --- 评论操作 ---

    static async createComment({ postId, userId, authorName, content }) {
        const stmt = db.prepare(`
            INSERT INTO forum_comments (post_id, user_id, author_name, content)
            VALUES (?, ?, ?, ?)
        `);
        const result = stmt.run(postId, userId, authorName, content);
        return this.getCommentById(result.lastInsertRowid);
    }

    static async getCommentById(id) {
        return db.prepare('SELECT * FROM forum_comments WHERE id = ?').get(id);
    }

    static async getCommentsByPostId(postId) {
        return db.prepare('SELECT * FROM forum_comments WHERE post_id = ? ORDER BY created_at ASC').all(postId);
    }

    // --- 点赞操作 ---

    static async toggleLike(postId, userId) {
        // 检查是否已点赞
        const existing = db.prepare('SELECT id FROM forum_likes WHERE user_id = ? AND post_id = ?').get(userId, postId);

        if (existing) {
            // 取消点赞
            db.prepare('DELETE FROM forum_likes WHERE user_id = ? AND post_id = ?').run(userId, postId);
            db.prepare('UPDATE forum_posts SET likes = likes - 1 WHERE id = ?').run(postId);
            return { liked: false, likes: this.getLikesCount(postId) };
        } else {
            // 添加点赞
            db.prepare('INSERT INTO forum_likes (user_id, post_id) VALUES (?, ?)').run(userId, postId);
            db.prepare('UPDATE forum_posts SET likes = likes + 1 WHERE id = ?').run(postId);
            return { liked: true, likes: this.getLikesCount(postId) };
        }
    }

    static async getLikesCount(postId) {
        const result = db.prepare('SELECT likes FROM forum_posts WHERE id = ?').get(postId);
        return result ? result.likes : 0;
    }

    static async isLiked(postId, userId) {
        const existing = db.prepare('SELECT id FROM forum_likes WHERE user_id = ? AND post_id = ?').get(userId, postId);
        return !!existing;
    }

    // --- 收藏操作 ---

    static async toggleCollect(postId, userId) {
        // 检查是否已收藏
        const existing = db.prepare('SELECT id FROM forum_collections WHERE user_id = ? AND post_id = ?').get(userId, postId);

        if (existing) {
            // 取消收藏
            db.prepare('DELETE FROM forum_collections WHERE user_id = ? AND post_id = ?').run(userId, postId);
            return { collected: false };
        } else {
            // 添加收藏
            db.prepare('INSERT INTO forum_collections (user_id, post_id) VALUES (?, ?)').run(userId, postId);
            return { collected: true };
        }
    }

    static async isCollected(postId, userId) {
        const existing = db.prepare('SELECT id FROM forum_collections WHERE user_id = ? AND post_id = ?').get(userId, postId);
        return !!existing;
    }

    // --- 获取用户的所有点赞和收藏 ---

    static async getUserLikedPosts(userId) {
        const rows = db.prepare('SELECT post_id FROM forum_likes WHERE user_id = ?').all(userId);
        return rows.map(r => r.post_id);
    }

    static async getUserCollectedPosts(userId) {
        const rows = db.prepare('SELECT post_id FROM forum_collections WHERE user_id = ?').all(userId);
        return rows.map(r => r.post_id);
    }

    // --- 用户相关查询 ---

    static async getPostsByIds(postIds, limit = 50, offset = 0) {
        if (!postIds || postIds.length === 0) return [];

        // 构建 IN 查询
        const placeholders = postIds.map(() => '?').join(',');
        const query = `SELECT * FROM forum_posts WHERE id IN (${placeholders}) AND status = 'active' ORDER BY created_at DESC LIMIT ? OFFSET ?`;

        const posts = db.prepare(query).all(...postIds, Math.floor(limit), Math.floor(offset));
        return posts.map(p => ({
            ...p,
            tags: JSON.parse(p.tags || '[]'),
            attachments: JSON.parse(p.attachments || '[]')
        }));
    }

    static async getUserPostCount(userId) {
        const result = db.prepare("SELECT COUNT(*) as count FROM forum_posts WHERE user_id = ? AND status = 'active'").get(userId);
        return result ? result.count : 0;
    }

    static async getUserLikeCount(userId) {
        const result = db.prepare("SELECT COUNT(*) as count FROM forum_likes WHERE user_id = ?").get(userId);
        return result ? result.count : 0;
    }

    static async getUserCollectCount(userId) {
        const result = db.prepare("SELECT COUNT(*) as count FROM forum_collections WHERE user_id = ?").get(userId);
        return result ? result.count : 0;
    }

    static async getUserReceivedLikes(userId) {
        // 用户收到的点赞数（其帖子被点赞的总数）
        const result = db.prepare(`
            SELECT COALESCE(SUM(p.likes), 0) as total
            FROM forum_posts p
            WHERE p.user_id = ?
        `).get(userId);
        return result ? result.total : 0;
    }

    // 按用户ID获取帖子
    static async getUserPosts(userId, limit = 20, offset = 0) {
        const posts = db.prepare(`
            SELECT * FROM forum_posts
            WHERE user_id = ? AND status = 'active'
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `).all(userId, Math.floor(limit), Math.floor(offset));

        return posts.map(p => ({
            ...p,
            tags: JSON.parse(p.tags || '[]'),
            attachments: JSON.parse(p.attachments || '[]')
        }));
    }

    // --- 站内消息操作 ---

    static async sendMessage({ senderId, receiverId, content }) {
        const stmt = db.prepare(`
            INSERT INTO forum_messages (sender_id, receiver_id, content)
            VALUES (?, ?, ?)
        `);
        const result = stmt.run(senderId, receiverId, content);
        return this.getMessageById(result.lastInsertRowid);
    }

    static async getMessageById(id) {
        return db.prepare('SELECT * FROM forum_messages WHERE id = ?').get(id);
    }

    // 获取用户收到的消息（按对话分组）
    static async getUserMessages(userId, limit = 50, offset = 0) {
        const messages = db.prepare(`
            SELECT m.*,
                   sender.username as sender_name,
                   (SELECT COUNT(*) FROM forum_messages m2
                    WHERE m2.sender_id = m.sender_id AND m2.receiver_id = ?
                    AND m2.created_at > m.created_at) as has_more
            FROM forum_messages m
            LEFT JOIN users sender ON m.sender_id = sender.id
            WHERE m.receiver_id = ?
            ORDER BY m.created_at DESC
            LIMIT ? OFFSET ?
        `).all(userId, userId, Math.floor(limit), Math.floor(offset));

        return messages;
    }

    // 获取与特定用户的对话
    static async getConversation(userId, otherUserId, limit = 50, offset = 0) {
        const messages = db.prepare(`
            SELECT m.*,
                   sender.username as sender_name,
                   receiver.username as receiver_name
            FROM forum_messages m
            LEFT JOIN users sender ON m.sender_id = sender.id
            LEFT JOIN users receiver ON m.receiver_id = receiver.id
            WHERE (m.sender_id = ? AND m.receiver_id = ?)
               OR (m.sender_id = ? AND m.receiver_id = ?)
            ORDER BY m.created_at ASC
            LIMIT ? OFFSET ?
        `).all(userId, otherUserId, otherUserId, userId, Math.floor(limit), Math.floor(offset));

        return messages;
    }

    // 获取未读消息数量
    static async getUnreadCount(userId) {
        const result = db.prepare("SELECT COUNT(*) as count FROM forum_messages WHERE receiver_id = ? AND is_read = 0").get(userId);
        return result ? result.count : 0;
    }

    // 标记消息为已读
    static async markAsRead(messageId, userId) {
        db.prepare("UPDATE forum_messages SET is_read = 1 WHERE id = ? AND receiver_id = ?").run(messageId, userId);
    }

    // 标记与某用户的所有对话为已读
    static async markConversationAsRead(userId, otherUserId) {
        db.prepare("UPDATE forum_messages SET is_read = 1 WHERE receiver_id = ? AND sender_id = ?").run(userId, otherUserId);
    }

    // 获取所有对话联系人（最后一条消息）
    static async getMessageContacts(userId) {
        // 获取每个联系人的最后一条消息
        const messages = db.prepare(`
            SELECT m.*,
                   sender.username as sender_name,
                   (SELECT MAX(created_at) FROM forum_messages m2
                    WHERE (m2.sender_id = m.sender_id AND m2.receiver_id = m.receiver_id)
                       OR (m2.sender_id = m.receiver_id AND m2.receiver_id = m.sender_id)) as max_time
            FROM forum_messages m
            LEFT JOIN users sender ON m.sender_id = sender.id
            WHERE m.receiver_id = ? OR m.sender_id = ?
            GROUP BY CASE
                WHEN m.sender_id = ? THEN m.receiver_id
                ELSE m.sender_id
            END
            ORDER BY m.created_at DESC
        `).all(userId, userId, userId);

        return messages;
    }
}

// 初始化表
new Forum();

module.exports = Forum;
