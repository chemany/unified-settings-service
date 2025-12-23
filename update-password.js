const bcrypt = require('bcryptjs');
const sqlite3 = require('better-sqlite3');
const path = require('path');

// 数据库路径
const dbPath = path.join(__dirname, 'database', 'settings.db');
const db = sqlite3(dbPath);

// 新密码
const email = 'link918@qq.com';
const newPassword = 'zhangli1115';

// 生成密码哈希
const hashedPassword = bcrypt.hashSync(newPassword, 10);

console.log('正在更新密码...');
console.log('邮箱:', email);
console.log('新密码:', newPassword);
console.log('哈希值:', hashedPassword);

try {
    // 更新密码
    const stmt = db.prepare('UPDATE users SET password = ? WHERE email = ?');
    const result = stmt.run(hashedPassword, email);
    
    if (result.changes > 0) {
        console.log('✅ 密码更新成功！');
        
        // 验证更新
        const user = db.prepare('SELECT email, username FROM users WHERE email = ?').get(email);
        console.log('用户信息:', user);
    } else {
        console.log('❌ 未找到该用户');
    }
} catch (error) {
    console.error('❌ 更新失败:', error);
} finally {
    db.close();
}
