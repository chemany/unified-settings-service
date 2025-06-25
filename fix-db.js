const Database = require('better-sqlite3');

console.log('修复数据库...');

try {
  const db = new Database('./database/settings.db');
  
  // 创建 global_settings 表
  db.exec(`
    CREATE TABLE IF NOT EXISTS global_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      setting_key TEXT UNIQUE NOT NULL,
      setting_value TEXT,
      app_name TEXT DEFAULT 'global',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  console.log('✅ global_settings 表创建成功');
  
  // 检查表是否存在
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('数据库中的表:', tables.map(t => t.name));
  
  db.close();
  console.log('✅ 数据库修复完成');
} catch (error) {
  console.error('❌ 修复失败:', error.message);
} 