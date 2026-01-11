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

            // 创建评论表（支持嵌套评论/楼中楼）
            db.prepare(`
                CREATE TABLE IF NOT EXISTS forum_comments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    post_id INTEGER NOT NULL,
                    user_id TEXT NOT NULL,
                    author_name TEXT NOT NULL,
                    content TEXT NOT NULL,
                    parent_comment_id INTEGER DEFAULT NULL,
                    reply_to_user_id TEXT DEFAULT NULL,
                    reply_to_user_name TEXT DEFAULT NULL,
                    depth INTEGER DEFAULT 0,
                    likes INTEGER DEFAULT 0,
                    is_accepted INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE,
                    FOREIGN KEY (parent_comment_id) REFERENCES forum_comments(id) ON DELETE CASCADE
                )
            `).run();

            // 自动补全评论表字段（用于已有表的升级）
            const commentColumns = db.prepare("PRAGMA table_info(forum_comments)").all();
            const commentColNames = commentColumns.map(c => c.name);

            if (!commentColNames.includes('parent_comment_id')) {
                db.prepare("ALTER TABLE forum_comments ADD COLUMN parent_comment_id INTEGER DEFAULT NULL").run();
            }
            if (!commentColNames.includes('reply_to_user_id')) {
                db.prepare("ALTER TABLE forum_comments ADD COLUMN reply_to_user_id TEXT DEFAULT NULL").run();
            }
            if (!commentColNames.includes('reply_to_user_name')) {
                db.prepare("ALTER TABLE forum_comments ADD COLUMN reply_to_user_name TEXT DEFAULT NULL").run();
            }
            if (!commentColNames.includes('depth')) {
                db.prepare("ALTER TABLE forum_comments ADD COLUMN depth INTEGER DEFAULT 0").run();
            }

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
                CREATE TABLE IF NOT EXISTS forum_messages(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_id TEXT NOT NULL,
                receiver_id TEXT NOT NULL,
                content TEXT NOT NULL,
                is_read INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
                `).run();

            // 创建用户扩展信息表（积分、等级、擅长领域等）
            db.prepare(`
                CREATE TABLE IF NOT EXISTS user_profiles (
                    user_id TEXT PRIMARY KEY,
                    points INTEGER DEFAULT 0,
                    expertise_tags TEXT DEFAULT '[]',
                    bio TEXT DEFAULT '',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `).run();

            // 自动补全 user_profiles 字段
            const profileColumns = db.prepare("PRAGMA table_info(user_profiles)").all();
            const profileColNames = profileColumns.map(c => c.name);
            if (!profileColNames.includes('bio')) {
                db.prepare("ALTER TABLE user_profiles ADD COLUMN bio TEXT DEFAULT ''").run();
            }

            // --- FTS5 全文检索支持 ---
            try {
                // 强制重建索引以应用新的分词器
                // 注意：生产环境应通过版本控制或迁移脚本处理，这里为了快速修复直接重建
                const ftsCheck = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'forum_posts_fts'").get();
                // 如果已存在且不是 trigram 分词，则删除重建
                if (ftsCheck && !ftsCheck.sql.includes('trigram')) {
                    console.log('检测到旧的 FTS 索引配置，正在重新构建以支持中文检索...');
                    db.prepare('DROP TABLE IF EXISTS forum_posts_fts').run();
                }

                // 1. 创建 FTS5 虚拟表
                // 使用 tokenize='trigram' 以完美支持中文/日文/韩文的子串搜索
                // SQLite 3.34+ 支持。如果报错，说明 SQLite 版本过低。
                db.prepare(`
                    CREATE VIRTUAL TABLE IF NOT EXISTS forum_posts_fts USING fts5(title, content, tokenize='trigram');
                `).run();

                // 2. 创建触发器保持同步

                // 先清理旧触发器，确保定义是最新的
                db.prepare('DROP TRIGGER IF EXISTS forum_posts_ai').run();
                db.prepare('DROP TRIGGER IF EXISTS forum_posts_ad').run();
                db.prepare('DROP TRIGGER IF EXISTS forum_posts_au').run();

                // INSERT Trigger
                db.prepare(`
                    CREATE TRIGGER forum_posts_ai AFTER INSERT ON forum_posts BEGIN
                        INSERT INTO forum_posts_fts(rowid, title, content) VALUES (new.id, new.title, new.content);
                    END;
                `).run();

                // DELETE Trigger
                db.prepare(`
                    CREATE TRIGGER forum_posts_ad AFTER DELETE ON forum_posts BEGIN
                        DELETE FROM forum_posts_fts WHERE rowid=old.id;
                    END;
                `).run();

                // UPDATE Trigger - 仅在标题或内容变更时触发，避免 views/likes 更新导致 FTS 错误
                db.prepare(`
                    CREATE TRIGGER forum_posts_au AFTER UPDATE OF title, content ON forum_posts BEGIN
                        INSERT INTO forum_posts_fts(forum_posts_fts, rowid, title, content) VALUES('delete', old.id, old.title, old.content);
                        INSERT INTO forum_posts_fts(rowid, title, content) VALUES (new.id, new.title, new.content);
                    END;
                `).run();

                // 3. 数据校验与填充
                const ftsCount = db.prepare('SELECT count(*) as c FROM forum_posts_fts').get().c;
                const postCount = db.prepare('SELECT count(*) as c FROM forum_posts').get().c;

                if (ftsCount !== postCount) { // 简单校验，如果不一致则重构（或为空时填充）
                    console.log('正在同步/构建 FTS 全文索引数据...');
                    // 清空 FTS
                    db.prepare('DELETE FROM forum_posts_fts').run();
                    // 重新插入
                    db.prepare('INSERT INTO forum_posts_fts(rowid, title, content) SELECT id, title, content FROM forum_posts').run();
                    console.log(`FTS 索引构建完成 (共 ${postCount} 条)`);
                }
            } catch (ftsError) {
                console.warn('FTS5 初始化异常:', ftsError.message);
                if (ftsError.message.includes('tokenizer')) {
                    console.error('当前 SQLite 版本不支持 trigram 分词器。建议升级 SQLite 或 Node.js 环境。将回退到默认分词器（可能不支持中文子串）。');
                    // Fallback creation if trigram fails (optional, but good for stability)
                    try {
                        db.prepare(`CREATE VIRTUAL TABLE IF NOT EXISTS forum_posts_fts USING fts5(title, content, tokenize='simple')`).run();
                    } catch (e) { }
                }
            }

            console.log('Forum表初始化/升级成功');
        } catch (error) {
            console.error('Forum表初始化失败:', error);
        }
    }

    // --- 帖子操作 ---

    static async createPost({ title, content, category, tags, type = 'help', attachments = [], userId, authorName }) {
        const stmt = db.prepare(`
            INSERT INTO forum_posts(title, content, category, tags, type, attachments, user_id, author_name)
            VALUES(?, ?, ?, ?, ?, ?, ?, ?)
                `);
        const result = stmt.run(title, content, category, JSON.stringify(tags), type, JSON.stringify(attachments), userId, authorName);
        
        // 发帖奖励积分
        await this.addPoints(userId, this.POINTS_RULES.POST_CREATE, 'post_create');
        
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
            // 混合搜索策略：
            // SQLite FTS5 Trigram 分词器对 < 3 字符的词支持不稳定（有时需要全表扫描FTS表，有时返回0）。
            // 为了确保 "化工" (2字符) 或 "H2" (2字符) 这种短词能 100% 搜到，
            // 我们采用增强型 LIKE 查询：将搜索词按空格拆分，对每个词进行 (title LIKE %词% OR content LIKE %词%)
            // 这种方式在数据量 < 10万级时性能完全可以接受，且准确率最高。

            const terms = search.trim().split(/\s+/).filter(t => t.length > 0);

            if (terms && terms.length > 0) {
                // 构建多词 AND 查询
                const searchConditions = terms.map(() => `(title LIKE ? OR content LIKE ?)`).join(' AND ');
                query += ` AND ${searchConditions}`;

                terms.forEach(term => {
                    params.push(`%${term}%`, `%${term}%`);
                });
            } else {
                // 如果全是空格，就不加条件
            }

            if (category && category !== 'all') {
                query += ' AND category = ?'; // 注意这里不需要 forum_posts. 前缀，因为没有JOIN
                params.push(category);
            }
        } else {
            // 原有的普通查询逻辑
            if (category && category !== 'all') {
                query += ' AND category = ?';
                params.push(category);
            }
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


    static async createComment({ postId, userId, authorName, content, parentCommentId = null, replyToUserId = null, replyToUserName = null }) {
        let depth = 0;
        
        // 如果是回复评论，计算深度（最多支持2级嵌套）
        if (parentCommentId) {
            const parentComment = await this.getCommentById(parentCommentId);
            if (parentComment) {
                // 限制最大深度为1（即最多两级：主评论 + 回复）
                depth = Math.min(parentComment.depth + 1, 1);
                // 如果父评论已经是回复（depth=1），则将新回复挂到父评论的父评论下
                if (parentComment.depth >= 1 && parentComment.parent_comment_id) {
                    parentCommentId = parentComment.parent_comment_id;
                    depth = 1;
                }
            }
        }
    static async updatePost(id, { title, content, category, tags, type, attachments }) {
        const stmt = db.prepare(`
            UPDATE forum_posts
            SET title = :title, 
                content = :content, 
                category = :category, 
                tags = :tags, 
                type = :type, 
                attachments = :attachments, 
                updated_at = CURRENT_TIMESTAMP
            WHERE id = :id
        `);
        return stmt.run({
            title: title || '',
            content: content || '',
            category: category || 'all',
            tags: JSON.stringify(tags || []),
            type: type || 'help',
            attachments: JSON.stringify(attachments || []),
            id: Number(id)
        });
    }

    static async deletePost(id) {
        // 使用软删除
        return db.prepare("UPDATE forum_posts SET status = 'deleted' WHERE id = ?").run(id);
    }

    // --- 评论操作 ---

        const stmt = db.prepare(`
            INSERT INTO forum_comments(post_id, user_id, author_name, content, parent_comment_id, reply_to_user_id, reply_to_user_name, depth)
            VALUES(?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(postId, userId, authorName, content, parentCommentId, replyToUserId, replyToUserName, depth);
        
        // 评论奖励积分
        await this.addPoints(userId, this.POINTS_RULES.COMMENT_CREATE, 'comment_create');
        
        return this.getCommentById(result.lastInsertRowid);
    }

    static async getCommentById(id) {
        return db.prepare('SELECT * FROM forum_comments WHERE id = ?').get(id);
    }

    static async getCommentsByPostId(postId) {
        // 获取所有评论，按创建时间排序
        const allComments = db.prepare('SELECT * FROM forum_comments WHERE post_id = ? ORDER BY created_at ASC').all(postId);
        
        // 构建嵌套结构
        return this.buildCommentTree(allComments);
    }

    // 构建评论树结构
    static buildCommentTree(comments) {
        const commentMap = new Map();
        const rootComments = [];

        // 第一遍：创建映射
        comments.forEach(comment => {
            comment.replies = [];
            commentMap.set(comment.id, comment);
        });

        // 第二遍：构建树
        comments.forEach(comment => {
            if (comment.parent_comment_id && commentMap.has(comment.parent_comment_id)) {
                // 是回复，添加到父评论的 replies 数组
                commentMap.get(comment.parent_comment_id).replies.push(comment);
            } else {
                // 是主评论
                rootComments.push(comment);
            }
        });

        return rootComments;
    }

    // 获取评论的回复列表
    static async getCommentReplies(commentId) {
        return db.prepare('SELECT * FROM forum_comments WHERE parent_comment_id = ? ORDER BY created_at ASC').all(commentId);
    }

    // --- 点赞操作 ---

    static async toggleLike(postId, userId) {
        // 检查是否已点赞
        const existing = db.prepare('SELECT id FROM forum_likes WHERE user_id = ? AND post_id = ?').get(userId, postId);

        // 获取帖子作者ID
        const post = db.prepare('SELECT user_id FROM forum_posts WHERE id = ?').get(postId);
        const authorId = post ? post.user_id : null;

        if (existing) {
            // 取消点赞
            db.prepare('DELETE FROM forum_likes WHERE user_id = ? AND post_id = ?').run(userId, postId);
            db.prepare('UPDATE forum_posts SET likes = likes - 1 WHERE id = ?').run(postId);
            
            // 扣除作者积分（如果不是自己点赞自己）
            if (authorId && authorId !== userId) {
                await this.addPoints(authorId, -this.POINTS_RULES.POST_LIKED, 'post_unliked');
            }
            
            return { liked: false, likes: this.getLikesCount(postId) };
        } else {
            // 添加点赞
            db.prepare('INSERT INTO forum_likes (user_id, post_id) VALUES (?, ?)').run(userId, postId);
            db.prepare('UPDATE forum_posts SET likes = likes + 1 WHERE id = ?').run(postId);
            
            // 奖励作者积分（如果不是自己点赞自己）
            if (authorId && authorId !== userId) {
                await this.addPoints(authorId, this.POINTS_RULES.POST_LIKED, 'post_liked');
            }
            
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
        const query = `SELECT * FROM forum_posts WHERE id IN(${placeholders}) AND status = 'active' ORDER BY created_at DESC LIMIT ? OFFSET ? `;

        const posts = db.prepare(query).all(...postIds, Math.floor(limit), Math.floor(offset));
        return posts.map(p => ({
            ...p,
            tags: JSON.parse(p.tags || '[]'),
            attachments: JSON.parse(p.attachments || '[]')
        }));
    }

    // 获取用户基本信息（从CSV用户系统）
    static async getUserBasicInfo(userId) {
        // 优先从CSV用户系统获取
        try {
            const User = require('./User');
            const user = await User.findById(userId);
            if (user) {
                return user;
            }
        } catch (e) {
            console.log('[Forum] CSV用户查询失败，尝试数据库:', e.message);
        }

        // 回退到数据库查询
        const user = db.prepare("SELECT id, username, email FROM users WHERE id = ?").get(userId);
        return user;
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
            INSERT INTO forum_messages(sender_id, receiver_id, content)
            VALUES(?, ?, ?)
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

    static async getConversation(userId, otherUserId, limit = 50, offset = 0) {
        const messages = db.prepare(`
            SELECT m.*,
                sender.username as sender_name,
                receiver.username as receiver_name
            FROM forum_messages m
            LEFT JOIN users sender ON m.sender_id = sender.id
            LEFT JOIN users receiver ON m.receiver_id = receiver.id
            WHERE(m.sender_id = ? AND m.receiver_id = ?)
            OR(m.sender_id = ? AND m.receiver_id = ?)
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
        const User = require('./User');

        // 获取每个联系人的最后一条消息
        const messages = db.prepare(`
            SELECT m.*,
                sender.username as sender_name,
                (SELECT MAX(created_at) FROM forum_messages m2
            WHERE(m2.sender_id = m.sender_id AND m2.receiver_id = m.receiver_id)
            OR(m2.sender_id = m.receiver_id AND m2.receiver_id = m.sender_id)) as max_time
            FROM forum_messages m
            LEFT JOIN users sender ON m.sender_id = sender.id
            WHERE m.receiver_id = ? OR m.sender_id = ?
                GROUP BY CASE
                WHEN m.sender_id = ? THEN m.receiver_id
                ELSE m.sender_id
            END
            SELECT m.*
            FROM forum_messages m
            INNER JOIN (
                SELECT MAX(id) as max_id
                FROM forum_messages
                WHERE receiver_id = ? OR sender_id = ?
                GROUP BY CASE
                    WHEN sender_id = ? THEN receiver_id
                    ELSE sender_id
                END
            ) latest ON m.id = latest.max_id
            ORDER BY m.created_at DESC
                `).all(userId, userId, userId);

        // 从CSV获取用户名
        for (const msg of messages) {
            const sender = await User.findById(msg.sender_id);
            const receiver = await User.findById(msg.receiver_id);
            msg.sender_name = sender?.username || '用户';
            msg.receiver_name = receiver?.username || '用户';
        }

        return messages;
    }

    static async getConversation(userId, otherUserId, limit = 50, offset = 0) {
        const User = require('./User');

        const messages = db.prepare(`
            SELECT m.*
            FROM forum_messages m
            WHERE (m.sender_id = ? AND m.receiver_id = ?)
               OR (m.sender_id = ? AND m.receiver_id = ?)
            ORDER BY m.created_at ASC
            LIMIT ? OFFSET ?
        `).all(userId, otherUserId, otherUserId, userId, Math.floor(limit), Math.floor(offset));

        // 从CSV获取用户名
        const userCache = {};
        for (const msg of messages) {
            if (!userCache[msg.sender_id]) {
                const sender = await User.findById(msg.sender_id);
                userCache[msg.sender_id] = sender?.username || '用户';
            }
            if (!userCache[msg.receiver_id]) {
                const receiver = await User.findById(msg.receiver_id);
                userCache[msg.receiver_id] = receiver?.username || '用户';
            }
            msg.sender_name = userCache[msg.sender_id];
            msg.receiver_name = userCache[msg.receiver_id];
        }

        return messages;
    }

    // --- 用户扩展信息操作 ---

    // 等级配置：根据积分计算等级
    static LEVEL_CONFIG = [
        { minPoints: 0, level: 1, title: '实习工程师', icon: '🌱' },
        { minPoints: 50, level: 2, title: '助理工程师', icon: '🌿' },
        { minPoints: 150, level: 3, title: '初级工程师', icon: '🌲' },
        { minPoints: 400, level: 4, title: '中级工程师', icon: '⭐' },
        { minPoints: 800, level: 5, title: '高级工程师', icon: '🌟' },
        { minPoints: 1500, level: 6, title: '资深工程师', icon: '💫' },
        { minPoints: 3000, level: 7, title: '首席工程师', icon: '🏆' },
        { minPoints: 6000, level: 8, title: '技术专家', icon: '👑' },
        { minPoints: 10000, level: 9, title: '资深专家', icon: '💎' },
        { minPoints: 20000, level: 10, title: '行业大师', icon: '🎖️' }
    ];

    // 积分规则
    static POINTS_RULES = {
        POST_CREATE: 10,      // 发帖 +10
        POST_LIKED: 5,        // 帖子被点赞 +5
        COMMENT_CREATE: 3,    // 评论 +3
        COMMENT_ACCEPTED: 20, // 评论被采纳 +20
        DAILY_LOGIN: 2        // 每日登录 +2
    };

    // 获取用户扩展信息
    static async getUserProfile(userId) {
        let profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(userId);
        
        if (!profile) {
            // 如果不存在，创建默认记录
            db.prepare(`
                INSERT INTO user_profiles (user_id, points, expertise_tags, bio)
                VALUES (?, 0, '[]', '')
            `).run(userId);
            profile = { user_id: userId, points: 0, expertise_tags: '[]', bio: '', created_at: new Date().toISOString() };
        }

        // 解析 JSON 字段
        profile.expertise_tags = JSON.parse(profile.expertise_tags || '[]');
        
        // 计算等级信息
        const levelInfo = this.calculateLevel(profile.points);
        
        return {
            ...profile,
            level: levelInfo.level,
            levelTitle: levelInfo.title,
            levelIcon: levelInfo.icon,
            nextLevelPoints: levelInfo.nextLevelPoints,
            currentLevelMinPoints: levelInfo.currentLevelMinPoints
        };
    }

    // 根据积分计算等级
    static calculateLevel(points) {
        let currentLevel = this.LEVEL_CONFIG[0];
        let nextLevel = this.LEVEL_CONFIG[1];

        for (let i = this.LEVEL_CONFIG.length - 1; i >= 0; i--) {
            if (points >= this.LEVEL_CONFIG[i].minPoints) {
                currentLevel = this.LEVEL_CONFIG[i];
                nextLevel = this.LEVEL_CONFIG[i + 1] || null;
                break;
            }
        }

        return {
            level: currentLevel.level,
            title: currentLevel.title,
            icon: currentLevel.icon,
            currentLevelMinPoints: currentLevel.minPoints,
            nextLevelPoints: nextLevel ? nextLevel.minPoints : null
        };
    }

    // 增加用户积分
    static async addPoints(userId, points, reason = '') {
        // 确保用户记录存在
        await this.getUserProfile(userId);
        
        db.prepare(`
            UPDATE user_profiles 
            SET points = points + ?, updated_at = CURRENT_TIMESTAMP 
            WHERE user_id = ?
        `).run(points, userId);

        // 返回更新后的积分
        const profile = db.prepare('SELECT points FROM user_profiles WHERE user_id = ?').get(userId);
        return profile ? profile.points : 0;
    }

    // 更新用户擅长领域标签
    static async updateExpertiseTags(userId, tags) {
        // 确保用户记录存在
        await this.getUserProfile(userId);
        
        // 限制最多5个标签
        const limitedTags = (tags || []).slice(0, 5);
        
        db.prepare(`
            UPDATE user_profiles 
            SET expertise_tags = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE user_id = ?
        `).run(JSON.stringify(limitedTags), userId);

        return limitedTags;
    }

    // 更新用户简介
    static async updateBio(userId, bio) {
        // 确保用户记录存在
        await this.getUserProfile(userId);
        
        // 限制简介长度
        const limitedBio = (bio || '').slice(0, 200);
        
        db.prepare(`
            UPDATE user_profiles 
            SET bio = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE user_id = ?
        `).run(limitedBio, userId);

        return limitedBio;
    }

    // 获取用户注册时间（从 CSV 或首次发帖时间推算）
    static async getUserJoinDate(userId) {
        // 尝试从 user_profiles 获取
        const profile = db.prepare('SELECT created_at FROM user_profiles WHERE user_id = ?').get(userId);
        if (profile && profile.created_at) {
            return profile.created_at;
        }

        // 回退：从用户首次发帖时间推算
        const firstPost = db.prepare(`
            SELECT MIN(created_at) as first_post 
            FROM forum_posts 
            WHERE user_id = ?
        `).get(userId);

        return firstPost?.first_post || new Date().toISOString();
    }

    // 获取用户评论数
    static async getUserCommentCount(userId) {
        const result = db.prepare("SELECT COUNT(*) as count FROM forum_comments WHERE user_id = ?").get(userId);
        return result ? result.count : 0;
    }

    // 可用的擅长领域标签列表
    static EXPERTISE_OPTIONS = [
        { value: 'process', label: '工艺技术', icon: '⚗️' },
        { value: 'equipment', label: '设备机械', icon: '⚙️' },
        { value: 'instrument', label: '仪表自控', icon: '⚡' },
        { value: 'safety', label: '安全环保', icon: '🛡️' },
        { value: 'career', label: '注册化工', icon: '🎓' },
        { value: 'project', label: '工程项目', icon: '📐' },
        { value: 'energy', label: '新能源', icon: '🔋' },
        { value: 'material', label: '材料化学', icon: '🧪' },
        { value: 'pharma', label: '制药工程', icon: '💊' },
        { value: 'petro', label: '石油化工', icon: '🛢️' }
    ];
}

// 初始化表
new Forum();

module.exports = Forum;
