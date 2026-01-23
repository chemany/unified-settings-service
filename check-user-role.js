const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database/settings.db');
const db = new Database(dbPath);

const email = process.argv[2] || 'link918@qq.com';

console.log('查询用户:', email);
console.log('');

const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

if (user) {
    console.log('用户信息:');
    console.log(JSON.stringify(user, null, 2));
} else {
    console.log('用户不存在');
}

db.close();
