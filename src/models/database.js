const Database = require('better-sqlite3');
const path = require('path');

// 数据库文件路径
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../database/settings.db');

// 创建数据库连接
const db = new Database(dbPath, {
    verbose: process.env.NODE_ENV === 'development' ? console.log : null
});

// 启用外键约束
db.pragma('foreign_keys = ON');

// 设置WAL模式以提高并发性能
db.pragma('journal_mode = WAL');

console.log(`📊 数据库连接成功: ${dbPath}`);

module.exports = db;