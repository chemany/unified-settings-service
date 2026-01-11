// 检查消息数据库
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database', 'settings.db');
const db = new Database(dbPath);

console.log('=== 检查 forum_messages 表 ===');

// 查看所有消息
const messages = db.prepare('SELECT * FROM forum_messages ORDER BY created_at DESC LIMIT 20').all();
console.log('消息数量:', messages.length);
console.log('消息列表:');
messages.forEach(m => {
    console.log(`  ID: ${m.id}, 发送者: ${m.sender_id}, 接收者: ${m.receiver_id}, 内容: ${m.content.substring(0, 30)}..., 时间: ${m.created_at}`);
});

// 测试 jason 的消息查询
const jasonId = 'cmmd6qkqmby4tt7lvis7h';
console.log('\n=== 测试 jason 的消息查询 ===');
console.log('jason ID:', jasonId);

const jasonMessages = db.prepare(`
    SELECT * FROM forum_messages 
    WHERE receiver_id = ? OR sender_id = ?
    ORDER BY created_at DESC
`).all(jasonId, jasonId);
console.log('jason 相关消息数量:', jasonMessages.length);
jasonMessages.forEach(m => {
    console.log(`  ID: ${m.id}, 发送者: ${m.sender_id}, 接收者: ${m.receiver_id}`);
});

// 测试 imjason 的消息查询
const imjasonId = 'cmmk4ycpxc8y2cejhh7k2';
console.log('\n=== 测试 imjason 的消息查询 ===');
console.log('imjason ID:', imjasonId);

const imjasonMessages = db.prepare(`
    SELECT * FROM forum_messages 
    WHERE receiver_id = ? OR sender_id = ?
    ORDER BY created_at DESC
`).all(imjasonId, imjasonId);
console.log('imjason 相关消息数量:', imjasonMessages.length);
imjasonMessages.forEach(m => {
    console.log(`  ID: ${m.id}, 发送者: ${m.sender_id}, 接收者: ${m.receiver_id}`);
});

db.close();
