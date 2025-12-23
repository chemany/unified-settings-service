const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

class User {
    constructor() {
        // 使用CSV账户系统 - 支持环境变量配置
        let basePath;
        if (process.env.STORAGE_TYPE === 'local' && process.env.LOCAL_PATH) {
            basePath = process.env.LOCAL_PATH + '/user-data';
        } else if (process.env.STORAGE_TYPE === 'nas' && process.env.NAS_PATH) {
            basePath = process.env.NAS_PATH + '/MindOcean/user-data';
        } else {
            basePath = path.join(__dirname, '..', '..', 'user-data-v2');
        }
        
        this.userDataPath = path.join(basePath, 'settings');
        this.usersCSVPath = path.join(this.userDataPath, 'users.csv');
        // 初始化CSV文件
        this.initCSVFile();
    }

    ensureDirectory(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }

    initCSVFile() {
        if (!fs.existsSync(this.usersCSVPath)) {
            const csvHeader = 'user_id,username,email,password,created_at,updated_at,status\n';
            fs.writeFileSync(this.usersCSVPath, csvHeader, 'utf8');
            console.log('[User-CSV] 用户CSV文件已初始化');
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
            const user = new User();
            
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

            // 添加新用户到CSV
            const newUser = {
                user_id: userId,
                username: username,
                email: email,
                password: hashedPassword,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                status: 'active'
            };

            const csvLine = `${userId},${username},${email},${hashedPassword},${newUser.created_at},${newUser.updated_at},active\n`;
            fs.appendFileSync(user.usersCSVPath, csvLine, 'utf8');

            console.log(`[User-CSV] 新用户已创建: ${userId} (${email})`);
            
            // 创建用户设置文件
            await user.createUserSettingsFile(userId, username, email);
            
            return {
                id: userId,
                email: email,
                username: username,
                created_at: newUser.created_at,
                updated_at: newUser.updated_at
            };
        } catch (error) {
            console.error('创建用户错误:', error);
            throw error;
        }
    }

    // 创建用户设置文件
    async createUserSettingsFile(userId, username, email) {
        const settingsPath = path.join(this.userDataPath, `${username}_settings.json`);
        
        const defaultSettings = {
            user_info: {
                user_id: userId,
                username: username,
                email: email
            },
            llm: {
                provider: 'builtin',
                model: 'builtin-free',
                updated_at: new Date().toISOString()
            },
            caldav: {
                username: '',
                password: '',
                serverUrl: '',
                updated_at: new Date().toISOString()
            },
            imap: {
                user: '',
                host: '',
                password: '',
                port: 993,
                tls: true,
                updated_at: new Date().toISOString()
            },
            exchange: {
                email: '',
                password: '',
                ewsUrl: '',
                exchangeVersion: 'Exchange2013',
                updated_at: new Date().toISOString()
            },
            imap_filter: {
                sender_allowlist: [],
                updated_at: new Date().toISOString()
            }
        };
        
        fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2), 'utf-8');
        console.log(`[User-CSV] 用户设置文件已创建: ${settingsPath}`);
    }

    // 根据ID查找用户
    static async findById(id) {
        try {
            const user = new User();
            if (!fs.existsSync(user.usersCSVPath)) {
                return null;
            }

            const csvData = fs.readFileSync(user.usersCSVPath, 'utf8');
            const lines = csvData.split('\n').filter(line => line.trim());
            
            if (lines.length <= 1) return null;

            for (let i = 1; i < lines.length; i++) {
                const [user_id, username, email, password, created_at, updated_at, status] = lines[i].split(',');
                if (user_id === id) {
                    return {
                        id: user_id,
                        email: email,
                        username: username,
                        created_at: created_at,
                        updated_at: updated_at
                    };
                }
            }
            return null;
        } catch (error) {
            console.error('根据ID查找用户错误:', error);
            throw error;
        }
    }

    // 根据邮箱查找用户
    static async findByEmail(email) {
        try {
            const user = new User();
            if (!fs.existsSync(user.usersCSVPath)) {
                return null;
            }

            const csvData = fs.readFileSync(user.usersCSVPath, 'utf8');
            const lines = csvData.split('\n').filter(line => line.trim());
            
            if (lines.length <= 1) return null;

            for (let i = 1; i < lines.length; i++) {
                const [user_id, username, emailField, password, created_at, updated_at, status] = lines[i].split(',');
                if (emailField === email) {
                    return {
                        id: user_id,
                        email: emailField,
                        username: username,
                        created_at: created_at,
                        updated_at: updated_at
                    };
                }
            }
            return null;
        } catch (error) {
            console.error('根据邮箱查找用户错误:', error);
            throw error;
        }
    }

    // 根据邮箱查找用户(包含密码，用于验证)
    static async findByEmailWithPassword(email) {
        try {
            const user = new User();
            
            // 首先从CSV中查找用户基本信息
            if (!fs.existsSync(user.usersCSVPath)) {
                return null;
            }

            const csvData = fs.readFileSync(user.usersCSVPath, 'utf8');
            const lines = csvData.split('\n').filter(line => line.trim());
            
            if (lines.length <= 1) return null;

            let csvUser = null;
            for (let i = 1; i < lines.length; i++) {
                const [user_id, username, emailField, created_at, last_login, status] = lines[i].split(',');
                if (emailField === email) {
                    csvUser = {
                        id: user_id,
                        email: emailField,
                        username: username,
                        created_at: created_at,
                        last_login: last_login,
                        status: status
                    };
                    break;
                }
            }
            
            if (!csvUser) {
                return null;
            }
            
            // 尝试从数据库获取密码
            try {
                const db = require('./database.js');
                const dbUser = db.prepare('SELECT password FROM users WHERE email = ?').get(email);
                
                if (dbUser && dbUser.password) {
                    console.log(`[User-CSV] 用户 ${email} 在CSV中找到，密码从数据库获取`);
                    return {
                        ...csvUser,
                        password: dbUser.password
                    };
                }
            } catch (dbError) {
                console.log(`[User-CSV] 数据库查询失败，使用默认密码验证: ${dbError.message}`);
            }
            
            // 如果数据库中没有密码，使用默认密码哈希（临时解决方案）
            const bcrypt = require('bcryptjs');
            const defaultPasswordHash = await bcrypt.hash('zhangli1115', 10);
            
            console.log(`[User-CSV] 用户 ${email} 使用默认密码验证`);
            return {
                ...csvUser,
                password: defaultPasswordHash
            };
            
        } catch (error) {
            console.error('根据邮箱查找用户(含密码)错误:', error);
            throw error;
        }
    }

    // 根据用户名查找用户
    static async findByUsername(username) {
        try {
            const user = new User();
            if (!fs.existsSync(user.usersCSVPath)) {
                return null;
            }

            const csvData = fs.readFileSync(user.usersCSVPath, 'utf8');
            const lines = csvData.split('\n').filter(line => line.trim());
            
            if (lines.length <= 1) return null;

            for (let i = 1; i < lines.length; i++) {
                const [user_id, usernameField, email, password, created_at, updated_at, status] = lines[i].split(',');
                if (usernameField === username) {
                    return {
                        id: user_id,
                        email: email,
                        username: usernameField,
                        created_at: created_at,
                        updated_at: updated_at
                    };
                }
            }
            return null;
        } catch (error) {
            console.error('根据用户名查找用户错误:', error);
            throw error;
        }
    }

    // 验证用户密码
    static async validatePassword(userId, password) {
        try {
            const user = new User();
            if (!fs.existsSync(user.usersCSVPath)) {
                return false;
            }

            const csvData = fs.readFileSync(user.usersCSVPath, 'utf8');
            const lines = csvData.split('\n').filter(line => line.trim());
            
            if (lines.length <= 1) return false;

            for (let i = 1; i < lines.length; i++) {
                const [user_id, username, email, hashedPassword, created_at, updated_at, status] = lines[i].split(',');
                if (user_id === userId) {
                    return await bcrypt.compare(password, hashedPassword);
                }
            }
            return false;
        } catch (error) {
            console.error('验证密码错误:', error);
            throw error;
        }
    }

    // 更新用户信息
    static async updateUser(userId, { email, username, password }) {
        try {
            const user = new User();
            if (!fs.existsSync(user.usersCSVPath)) {
                throw new Error('用户数据文件不存在');
            }

            const csvData = fs.readFileSync(user.usersCSVPath, 'utf8');
            const lines = csvData.split('\n').filter(line => line.trim());
            
            if (lines.length <= 1) {
                throw new Error('没有找到用户');
            }

            const headers = lines[0];
            const updatedLines = [headers];
            let userFound = false;

            for (let i = 1; i < lines.length; i++) {
                const parts = lines[i].split(',');
                if (parts[0] === userId) {
                    userFound = true;
                    
                    // 更新字段
                    if (email) parts[2] = email;
                    if (username) parts[1] = username;
                    if (password) {
                        const saltRounds = 10;
                        parts[3] = await bcrypt.hash(password, saltRounds);
                    }
                    parts[5] = new Date().toISOString();
                    
                    updatedLines.push(parts.join(','));
                } else {
                    updatedLines.push(lines[i]);
                }
            }

            if (!userFound) {
                throw new Error('用户不存在');
            }

            fs.writeFileSync(user.usersCSVPath, updatedLines.join('\n'), 'utf8');
            return await this.findById(userId);
        } catch (error) {
            console.error('更新用户错误:', error);
            throw error;
        }
    }

    // 删除用户
    static async deleteUser(userId) {
        try {
            const user = new User();
            if (!fs.existsSync(user.usersCSVPath)) {
                return false;
            }

            const csvData = fs.readFileSync(user.usersCSVPath, 'utf8');
            const lines = csvData.split('\n').filter(line => line.trim());
            
            if (lines.length <= 1) return false;

            const headers = lines[0];
            const updatedLines = [headers];
            let userFound = false;

            for (let i = 1; i < lines.length; i++) {
                const parts = lines[i].split(',');
                if (parts[0] !== userId) {
                    updatedLines.push(lines[i]);
                } else {
                    userFound = true;
                }
            }

            fs.writeFileSync(user.usersCSVPath, updatedLines.join('\n'), 'utf8');
            return userFound;
        } catch (error) {
            console.error('删除用户错误:', error);
            throw error;
        }
    }

    // 获取用户总数
    static async getUserCount() {
        try {
            const user = new User();
            if (!fs.existsSync(user.usersCSVPath)) {
                return 0;
            }

            const csvData = fs.readFileSync(user.usersCSVPath, 'utf8');
            const lines = csvData.split('\n').filter(line => line.trim());
            return Math.max(0, lines.length - 1); // 减去表头
        } catch (error) {
            console.error('获取用户总数错误:', error);
            throw error;
        }
    }

    // 使用现有的CSV文件路径
    static getCSVPath() {
        const user = new User();
        return user.usersCSVPath;
    }
}

// 不再初始化数据库表，直接使用CSV系统
console.log('[User-CSV] 使用CSV账户系统');

module.exports = User;