# 🔧 统一设置服务 (Unified Settings Service)

为多个应用提供统一的用户认证和设置管理服务，支持灵枢笔记、智能日历等应用的统一账号管理。

## ✨ 功能特性

### 🔐 统一账号系统
- **用户注册登录** - JWT令牌认证机制
- **用户信息管理** - 统一的用户资料管理
- **令牌刷新** - 自动令牌刷新和验证
- **安全认证** - bcrypt密码加密存储

### ⚙️ 配置管理
- **全局AI设置** - LLM、嵌入、重排序配置（多应用共享）
- **应用专用设置** - UI偏好、功能开关（各应用独立）
- **批量操作** - 批量配置导入导出
- **设置重置** - 一键恢复默认配置

### 🔄 多应用支持
- **灵枢笔记** - AI笔记管理系统
- **智能日历** - 多平台日历同步
- **可扩展架构** - 轻松集成新应用

### 📊 数据管理
- **SQLite数据库** - 轻量级高性能数据存储
- **JSON文件存储** - 灵活的配置文件管理
- **数据备份** - 自动数据备份和恢复

## 🏗️ 技术架构

### 后端技术栈
- **Node.js** - 高性能JavaScript运行时
- **Express.js** - 轻量级Web框架
- **SQLite** - 嵌入式数据库
- **JWT** - JSON Web Token认证
- **bcrypt** - 密码加密

### 安全特性
- **CORS配置** - 跨域请求安全控制
- **Helmet** - HTTP安全头设置
- **Rate Limiting** - API请求频率限制
- **输入验证** - express-validator数据验证

## 🚀 快速开始

### 环境要求
- Node.js 16+
- npm或yarn
- Git

### 安装步骤

1. **克隆项目**
   ```bash
   git clone https://github.com/你的用户名/unified-settings-service.git
   cd unified-settings-service
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **环境配置**
   ```bash
   # 复制环境变量文件
   cp .env.example .env
   
   # 编辑环境变量
   nano .env
   ```

4. **启动服务**
   ```bash
   # 开发模式
   npm run dev
   
   # 生产模式
   npm start
   ```

5. **验证服务**
   ```bash
   # 健康检查
   curl http://localhost:3002/health
   ```

## ⚙️ 配置说明

### 环境变量 (.env)
```env
# 服务配置
PORT=3002
NODE_ENV=development

# JWT配置
JWT_SECRET="your-super-secret-jwt-key-here"
JWT_EXPIRES_IN="24h"

# 数据库配置
DATABASE_PATH="./database/unified-settings.db"

# 安全配置
BCRYPT_ROUNDS=12

# CORS配置
ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3004"

# 日志配置
LOG_LEVEL="info"
```

### 数据库初始化
```bash
# 数据库会在首次启动时自动创建
# 如需重置数据库
node fix-db.js
```

## 📊 API文档

### 认证接口

#### 用户注册
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "username",
  "password": "password123"
}
```

#### 用户登录
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

#### 验证令牌
```http
GET /api/auth/verify
Authorization: Bearer <jwt-token>
```

#### 获取用户信息
```http
GET /api/auth/me
Authorization: Bearer <jwt-token>
```

#### 更新用户信息
```http
PUT /api/auth/me
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "username": "newusername",
  "email": "newemail@example.com"
}
```

### 设置管理接口

#### 获取全局设置
```http
GET /api/settings/global/:category
Authorization: Bearer <jwt-token>
```

#### 保存全局设置
```http
POST /api/settings/global/:category
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "provider": "openai",
  "model": "gpt-4",
  "api_key": "your-api-key"
}
```

#### 获取应用设置
```http
GET /api/settings/app/:appName/:category
Authorization: Bearer <jwt-token>
```

#### 获取完整配置
```http
GET /api/settings/full/:appName
Authorization: Bearer <jwt-token>
```

## 🛠️ 开发指南

### 项目结构
```
unified-settings-service/
├── src/
│   ├── controllers/        # 控制器层
│   │   ├── authController.js
│   │   └── settingsController.js
│   ├── models/            # 数据模型
│   │   ├── User.js
│   │   └── Settings.js
│   ├── routes/            # 路由定义
│   │   ├── auth.js
│   │   └── settings.js
│   ├── middleware/        # 中间件
│   │   └── auth.js
│   ├── services/          # 业务逻辑
│   │   └── FileSettingsService.js
│   ├── config/            # 配置文件
│   │   └── builtin-models.js
│   └── app.js            # 主应用文件
├── database/              # 数据库文件
├── user-settings/         # 用户配置文件
├── config/               # 全局配置
└── package.json
```

### 数据库架构

#### 用户表 (users)
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 全局设置表 (global_settings)
```sql
CREATE TABLE global_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    category TEXT NOT NULL,
    config_data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### 应用设置表 (app_settings)
```sql
CREATE TABLE app_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    app_name TEXT NOT NULL,
    category TEXT NOT NULL,
    config_data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### 添加新应用集成

1. **更新默认配置**
   ```javascript
   // src/config/builtin-models.js
   const getDefaultAppSettings = () => ({
     // ... 现有应用
     'your-new-app': {
       ui: {
         theme: 'light',
         language: 'zh-CN'
       },
       features: {
         feature1: true,
         feature2: false
       }
     }
   });
   ```

2. **添加应用路由**
   ```javascript
   // src/routes/settings.js
   router.get('/app/your-new-app/:category', auth, SettingsController.getAppSettings);
   router.post('/app/your-new-app/:category', auth, SettingsController.saveAppSettings);
   ```

### 测试

```bash
# 运行所有测试
npm test

# 运行特定测试
npm test -- --grep "auth"

# 测试覆盖率
npm run test:coverage
```

### 部署

#### Docker部署
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3002
CMD ["npm", "start"]
```

#### 系统服务部署
```bash
# 创建系统服务
sudo nano /etc/systemd/system/unified-settings.service

# 启用服务
sudo systemctl enable unified-settings
sudo systemctl start unified-settings
```

## 🔧 故障排除

### 常见问题

#### 数据库连接失败
```bash
# 检查数据库文件权限
ls -la database/
# 重新初始化数据库
node fix-db.js
```

#### JWT令牌验证失败
```bash
# 检查JWT_SECRET环境变量
echo $JWT_SECRET
# 重新生成安全密钥
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

#### CORS错误
```javascript
// 检查ALLOWED_ORIGINS配置
// src/app.js
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
```

### 日志分析
```bash
# 查看服务日志
journalctl -u unified-settings -f

# 查看应用日志
tail -f logs/app.log
```

## 📊 监控和维护

### 性能监控
- API响应时间统计
- 数据库查询性能
- 内存和CPU使用率
- 用户注册和登录统计

### 备份策略
```bash
# 数据库备份
cp database/unified-settings.db backup/unified-settings-$(date +%Y%m%d).db

# 用户配置备份
tar -czf backup/user-settings-$(date +%Y%m%d).tar.gz user-settings/
```

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [Express.js](https://expressjs.com/) - 后端框架
- [SQLite](https://www.sqlite.org/) - 数据库
- [JWT](https://jwt.io/) - 认证标准
- [bcrypt](https://github.com/kelektiv/node.bcrypt.js) - 密码加密

## 📞 联系方式

- 项目地址: https://github.com/你的用户名/unified-settings-service
- 问题反馈: https://github.com/你的用户名/unified-settings-service/issues
- 文档更新: https://github.com/你的用户名/unified-settings-service/wiki

## 🔗 相关项目

- [灵枢笔记](https://github.com/你的用户名/notebook-lm-clone) - AI智能笔记系统
- [智能日历](https://github.com/你的用户名/smart-calendar) - 多平台日历同步

---

⭐ 如果这个项目对您有帮助，请给它一个星标！