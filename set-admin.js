const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'database/settings.db'));

const email = 'link918@qq.com';

// 检查是否有 role 字段
const tableInfo = db.prepare("PRAGMA table_info(users)").all();
const hasRole = tableInfo.some(col => col.name === 'role');

if (!hasRole) {
    console.log('添加 role 字段...');
    db.prepare("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'").run();
}

const user = db.prepare('SELECT id, username, email, role FROM users WHERE email = ?').get(email);
console.log('当前用户:', user);

if (user) {
    db.prepare('UPDATE users SET role = ? WHERE email = ?').run('admin', email);
    const updated = db.prepare('SELECT id, username, email, role FROM users WHERE email = ?').get(email);
    console.log('更新后:', updated);
} else {
    console.log('用户不存在');
}

db.close();
