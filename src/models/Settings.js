const db = require('./database');
const builtinModelsConfig = require('../config/builtin-models');

class Settings {
    constructor() {
        this.initTables();
    }

    initTables() {
        try {
            // 创建全局共享设置表 (基础AI配置)
            db.prepare(`
                CREATE TABLE IF NOT EXISTS global_settings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    category TEXT NOT NULL,  -- 'llm_base', 'embedding_base', 'reranking_base'
                    config_data TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, category)
                )
            `).run();

            // 创建应用专用设置表
            db.prepare(`
                CREATE TABLE IF NOT EXISTS app_settings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    app_name TEXT NOT NULL,  -- 'notebook_lm', 'calendar'
                    category TEXT NOT NULL,  -- 'ui', 'features', 'preferences'
                    config_data TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, app_name, category)
                )
            `).run();
            
            console.log('Settings表初始化成功');
        } catch (error) {
            console.error('Settings表初始化失败:', error);
        }
    }

    // 默认的全局基础AI设置
    static getDefaultGlobalSettings() {
        return {
            llm_base: builtinModelsConfig.getBuiltinConfig(),
            embedding_base: {
                provider: 'openai', 
                api_key: '',
                base_url: 'https://api.openai.com/v1',
                model: 'text-embedding-ada-002',
                dimensions: 1536
            },
            reranking_base: {
                provider: 'cohere',
                api_key: '',
                base_url: 'https://api.cohere.ai/v1',
                model: 'rerank-multilingual-v2.0',
                top_k: 5
            }
        };
    }    // 默认的应用专用设置
    static getDefaultAppSettings() {
        return {
            notebook_lm: {
                ui: {
                    theme: 'light',
                    language: 'zh-CN', 
                    sidebar_collapsed: false,
                    auto_save: true,
                    line_numbers: true
                },
                features: {
                    auto_summary: true,
                    smart_completion: true,
                    collaborative_editing: false,
                    version_control: true,
                    citation_format: 'apa'
                }
            },
            calendar: {
                ui: {
                    theme: 'light',
                    language: 'zh-CN',
                    default_view: 'month',
                    week_start: 'monday',
                    time_format: '24h'
                },
                features: {
                    smart_scheduling: true,
                    auto_categorize: true,
                    conflict_detection: true,
                    weather_integration: false,
                    meeting_reminders: true
                },
                sync: {
                    outlook_enabled: false,
                    outlook_server: '',
                    outlook_username: '',
                    qq_enabled: false,
                    qq_server: '',
                    qq_username: '',
                    sync_interval: 15
                },
                notification: {
                    email_enabled: true,
                    desktop_enabled: true,
                    advance_minutes: 15,
                    sound_enabled: true,
                    recurring_reminders: true
                },
                exchange: {
                    enabled: false,
                    server: '',
                    username: '',
                    password: '',
                    auto_sync: true,
                    sync_interval: 15
                },
                imap: {
                    enabled: false,
                    server: '',
                    port: 993,
                    username: '',
                    password: '',
                    use_ssl: true,
                    folder: 'INBOX'
                },
                caldav: {
                    enabled: false,
                    server: '',
                    username: '',
                    password: '',
                    calendar_url: '',
                    sync_interval: 30
                },
                imap_filter: {
                    enabled: true,
                    sender_allowlist: []
                }
            }
        };
    }    // 获取全局基础AI设置
    static async getGlobalSettings(userId, category) {
        try {
            const stmt = db.prepare('SELECT * FROM global_settings WHERE user_id = ? AND category = ?');
            const result = stmt.get(userId, category);
            
            if (result) {
                return {
                    ...result,
                    config_data: JSON.parse(result.config_data)
                };
            }
            return null;
        } catch (error) {
            console.error('获取全局设置错误:', error);
            throw error;
        }
    }

    // 保存或更新全局基础AI设置
    static async saveOrUpdateGlobalSettings(userId, category, configData) {
        try {
            const stmt = db.prepare(`
                INSERT OR REPLACE INTO global_settings (user_id, category, config_data, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            `);
            
            stmt.run(userId, category, JSON.stringify(configData));
            
            return await this.getGlobalSettings(userId, category);
        } catch (error) {
            console.error('保存全局设置错误:', error);
            throw error;
        }
    }

    // 获取应用专用设置
    static async getAppSettings(userId, appName, category) {
        try {
            const stmt = db.prepare('SELECT * FROM app_settings WHERE user_id = ? AND app_name = ? AND category = ?');
            const result = stmt.get(userId, appName, category);
            
            if (result) {
                return {
                    ...result,
                    config_data: JSON.parse(result.config_data)
                };
            }
            return null;
        } catch (error) {
            console.error('获取应用设置错误:', error);
            throw error;
        }
    }    // 保存或更新应用专用设置
    static async saveOrUpdateAppSettings(userId, appName, category, configData) {
        try {
            const stmt = db.prepare(`
                INSERT OR REPLACE INTO app_settings (user_id, app_name, category, config_data, updated_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            `);
            
            stmt.run(userId, appName, category, JSON.stringify(configData));
            
            return await this.getAppSettings(userId, appName, category);
        } catch (error) {
            console.error('保存应用设置错误:', error);
            throw error;
        }
    }

    // 获取用户的所有全局基础AI设置
    static async getAllGlobalSettings(userId) {
        try {
            const stmt = db.prepare('SELECT * FROM global_settings WHERE user_id = ?');
            const results = stmt.all(userId);
            
            return results.map(result => ({
                ...result,
                config_data: JSON.parse(result.config_data)
            }));
        } catch (error) {
            console.error('获取所有全局设置错误:', error);
            throw error;
        }
    }

    // 获取用户的所有应用设置
    static async getAllAppSettings(userId, appName) {
        try {
            const stmt = db.prepare('SELECT * FROM app_settings WHERE user_id = ? AND app_name = ?');
            const results = stmt.all(userId, appName);
            
            return results.map(result => ({
                ...result,
                config_data: JSON.parse(result.config_data)
            }));
        } catch (error) {
            console.error('获取所有应用设置错误:', error);
            throw error;
        }
    }    // 删除全局设置
    static async deleteGlobalSettings(userId, category) {
        try {
            const stmt = db.prepare('DELETE FROM global_settings WHERE user_id = ? AND category = ?');
            stmt.run(userId, category);
        } catch (error) {
            console.error('删除全局设置错误:', error);
            throw error;
        }
    }

    // 删除应用设置
    static async deleteAppSettings(userId, appName, category) {
        try {
            const stmt = db.prepare('DELETE FROM app_settings WHERE user_id = ? AND app_name = ? AND category = ?');
            stmt.run(userId, appName, category);
        } catch (error) {
            console.error('删除应用设置错误:', error);
            throw error;
        }
    }

    // 删除用户的所有全局设置
    static async deleteAllGlobalSettings(userId) {
        try {
            const stmt = db.prepare('DELETE FROM global_settings WHERE user_id = ?');
            stmt.run(userId);
        } catch (error) {
            console.error('删除所有全局设置错误:', error);
            throw error;
        }
    }

    // 删除用户的所有应用设置
    static async deleteAllAppSettings(userId, appName) {
        try {
            const stmt = db.prepare('DELETE FROM app_settings WHERE user_id = ? AND app_name = ?');
            stmt.run(userId, appName);
        } catch (error) {
            console.error('删除所有应用设置错误:', error);
            throw error;
        }
    }

    // 获取完整的用户配置（合并全局和应用设置）
    static async getFullUserConfig(userId, appName) {
        try {
            const globalSettings = await this.getAllGlobalSettings(userId);
            const appSettings = await this.getAllAppSettings(userId, appName);
            
            const defaultGlobal = this.getDefaultGlobalSettings();
            const defaultApp = this.getDefaultAppSettings()[appName] || {};
            
            const result = {
                global: {},
                app: {}
            };

            // 合并全局设置
            for (const category of Object.keys(defaultGlobal)) {
                const userSetting = globalSettings.find(s => s.category === category);
                result.global[category] = userSetting ? userSetting.config_data : defaultGlobal[category];
            }

            // 合并应用设置
            for (const category of Object.keys(defaultApp)) {
                const userSetting = appSettings.find(s => s.category === category);
                result.app[category] = userSetting ? userSetting.config_data : defaultApp[category];
            }

            return result;
        } catch (error) {
            console.error('获取完整用户配置错误:', error);
            throw error;
        }
    }
}

module.exports = Settings;