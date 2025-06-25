const jwt = require('jsonwebtoken');

// 使用与服务相同的密钥
const JWT_SECRET = 'unified-settings-super-secret-key-2024';

// 创建测试用户令牌
const testUser = {
    userId: 'test-user-123',
    email: 'test@example.com',
    username: 'testuser'
};

const token = jwt.sign(
    testUser,
    JWT_SECRET,
    { expiresIn: '24h' }
);

console.log('Generated test token:');
console.log(token);