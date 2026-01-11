const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'database', 'settings.db');
const db = new Database(dbPath);

const userId = 'cmmd6qkqmby4tt7lvis7h';

// 测试 GROUP BY 查询
const messages = db.prepare(`
    SELECT m.*,
           (SELECT MAX(created_at) FROM forum_messages m2
            WHERE (m2.sender_id = m.sender_id AND m2.receiver_id = m.receiver_id)
               OR (m2.sender_id = m.receiver_id AND m2.receiver_id = m.sender_id)) as max_time
    FROM forum_messages m
    WHERE m.receiver_id = ? OR m.sender_id = ?
    GROUP BY CASE
        WHEN m.sender_id = ? THEN m.receiver_id
        ELSE m.sender_id
    END
    ORDER BY m.created_at DESC
`).all(userId, userId, userId);

console.log('GROUP BY 查询结果数量:', messages.length);
messages.forEach(m => console.log('  ID:', m.id, '发送者:', m.sender_id, '接收者:', m.receiver_id));

db.close();
