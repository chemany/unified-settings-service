const db = require('./database');
const bcrypt = require('bcrypt');

class User {
    // 初始化数据库表
    static initTables() {
        try {
            // 创建用户表 (与Notebook LM兼容)
            db.prepare(`
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    username TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `).run();

            console.log('User表初始化成功');
        } catch (error) {
            console.error('User表初始化失败:', error);
            throw error;
        }
    }

    // 生成用户ID (模仿Prisma的cuid)
    static generateId() {
        const timestamp = Date.now().toString(36);
        const randomStr = Math.random().toString(36).substring(2, 15);
        return `cm${timestamp}${randomStr}`;
    }

    // 创建新用户
    static async createUser({ email, username, password }) {
        try {
            // 检查邮箱是否已存在
            const existingUser = await this.findByEmail(email);
            if (existingUser) {
                throw new Error('邮箱已被注册');
            }

            // 检查用户名是否已存在
            const existingUsername = await this.findByUsername(username);
            if (existingUsername) {
                throw new Error('用户名已被使用');
            }

            // 哈希密码
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            // 生成用户ID
            const userId = this.generateId();

            // 插入新用户
            const stmt = db.prepare(`
                INSERT INTO users (id, email, username, password, created_at, updated_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `);
            
            stmt.run(userId, email, username, hashedPassword);

            // 返回用户信息 (不包含密码)
            return await this.findById(userId);
        } catch (error) {
            console.error('创建用户错误:', error);
            throw error;
        }
    }

    // 根据ID查找用户
    static async findById(id) {
        try {
            const stmt = db.prepare('SELECT id, email, username, created_at, updated_at FROM users WHERE id = ?');
            return stmt.get(id);
        } catch (error) {
            console.error('根据ID查找用户错误:', error);
            throw error;
        }
    }

    // 根据邮箱查找用户
    static async findByEmail(email) {
        try {
            const stmt = db.prepare('SELECT id, email, username, created_at, updated_at FROM users WHERE email = ?');
            return stmt.get(email);
        } catch (error) {
            console.error('根据邮箱查找用户错误:', error);
            throw error;
        }
    }

    // 根据邮箱查找用户(包含密码，用于验证)
    static async findByEmailWithPassword(email) {
        try {
            const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
            return stmt.get(email);
        } catch (error) {
            console.error('根据邮箱查找用户(含密码)错误:', error);
            throw error;
        }
    }

    // 根据用户名查找用户
    static async findByUsername(username) {
        try {
            const stmt = db.prepare('SELECT id, email, username, created_at, updated_at FROM users WHERE username = ?');
            return stmt.get(username);
        } catch (error) {
            console.error('根据用户名查找用户错误:', error);
            throw error;
        }
    }

    // 验证用户密码
    static async validatePassword(userId, password) {
        try {
            const stmt = db.prepare('SELECT password FROM users WHERE id = ?');
            const user = stmt.get(userId);
            
            if (!user) {
                return false;
            }

            return await bcrypt.compare(password, user.password);
        } catch (error) {
            console.error('验证密码错误:', error);
            throw error;
        }
    }

    // 更新用户信息
    static async updateUser(userId, { email, username, password }) {
        try {
            const updates = [];
            const values = [];

            if (email) {
                // 检查邮箱是否被其他用户使用
                const existingUser = await this.findByEmail(email);
                if (existingUser && existingUser.id !== userId) {
                    throw new Error('邮箱已被其他用户使用');
                }
                updates.push('email = ?');
                values.push(email);
            }

            if (username) {
                // 检查用户名是否被其他用户使用
                const existingUser = await this.findByUsername(username);
                if (existingUser && existingUser.id !== userId) {
                    throw new Error('用户名已被其他用户使用');
                }
                updates.push('username = ?');
                values.push(username);
            }

            if (password) {
                // 哈希新密码
                const saltRounds = 10;
                const hashedPassword = await bcrypt.hash(password, saltRounds);
                updates.push('password = ?');
                values.push(hashedPassword);
            }

            if (updates.length === 0) {
                throw new Error('没有提供要更新的字段');
            }

            updates.push('updated_at = CURRENT_TIMESTAMP');
            values.push(userId);

            const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
            const stmt = db.prepare(sql);
            stmt.run(...values);

            return await this.findById(userId);
        } catch (error) {
            console.error('更新用户错误:', error);
            throw error;
        }
    }

    // 删除用户
    static async deleteUser(userId) {
        try {
            const stmt = db.prepare('DELETE FROM users WHERE id = ?');
            const result = stmt.run(userId);
            
            return result.changes > 0;
        } catch (error) {
            console.error('删除用户错误:', error);
            throw error;
        }
    }

    // 获取用户总数
    static async getUserCount() {
        try {
            const stmt = db.prepare('SELECT COUNT(*) as count FROM users');
            const result = stmt.get();
            return result.count;
        } catch (error) {
            console.error('获取用户总数错误:', error);
            throw error;
        }
    }
}

// 模块加载时初始化表
User.initTables();

module.exports = User;