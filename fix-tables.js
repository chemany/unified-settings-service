const Database = require('better-sqlite3');

console.log('🔧 重建数据库表结构...');

try {
  const db = new Database('./database/settings.db');
  
  // 1. 删除错误的表
  console.log('🗑️ 删除错误的表结构...');
  db.exec('DROP TABLE IF EXISTS global_settings');
  console.log('✅ 已删除错误的global_settings表');
  
  // 2. 重新创建正确的表结构
  console.log('🏗️ 创建正确的表结构...');
  
  // 创建全局共享设置表 (基础AI配置)
  db.exec(`
    CREATE TABLE IF NOT EXISTS global_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      category TEXT NOT NULL,
      config_data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, category)
    )
  `);
  console.log('✅ global_settings表创建成功');
  
  // 创建应用专用设置表
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      app_name TEXT NOT NULL,
      category TEXT NOT NULL,
      config_data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, app_name, category)
    )
  `);
  console.log('✅ app_settings表创建成功');
  
  // 3. 检查所有表
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('📋 数据库中的表:', tables.map(t => t.name));
  
  // 4. 检查表结构
  console.log('\n📊 global_settings表结构:');
  const columns = db.pragma('table_info(global_settings)');
  columns.forEach(col => {
    console.log(`  - ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
  });
  
  db.close();
  console.log('\n🎉 数据库修复完成！');
} catch (error) {
  console.error('❌ 修复失败:', error.message);
  console.error('详细错误:', error);
}