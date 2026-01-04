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
}

// 初始化表
new Forum();

module.exports = Forum;
