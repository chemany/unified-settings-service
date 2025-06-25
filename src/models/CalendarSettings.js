const database = require('./database');

class CalendarSettings {
    constructor(data) {
        this.id = data.id;
        this.user_id = data.user_id;
        this.setting_type = data.setting_type;
        this.config_data = typeof data.config_data === 'string' 
            ? JSON.parse(data.config_data) 
            : data.config_data;
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
    }

    // 获取用户的特定类型设置
    static async getByUserAndType(userId, settingType) {
        const row = await database.get(
            'SELECT * FROM calendar_settings WHERE user_id = ? AND setting_type = ?',
            [userId, settingType]
        );
        return row ? new CalendarSettings(row) : null;
    }

    // 获取用户的所有日历设置
    static async getAllByUser(userId) {
        const rows = await database.all(
            'SELECT * FROM calendar_settings WHERE user_id = ?',
            [userId]
        );
        return rows.map(row => new CalendarSettings(row));
    }

    // 保存或更新设置
    static async saveOrUpdate(userId, settingType, configData) {
        const configJson = JSON.stringify(configData);
        
        // 使用 INSERT OR REPLACE 来处理插入或更新
        const result = await database.run(`
            INSERT OR REPLACE INTO calendar_settings (user_id, setting_type, config_data, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `, [userId, settingType, configJson]);

        return CalendarSettings.getByUserAndType(userId, settingType);
    }    // 删除特定类型的设置
    static async deleteByUserAndType(userId, settingType) {
        await database.run(
            'DELETE FROM calendar_settings WHERE user_id = ? AND setting_type = ?',
            [userId, settingType]
        );
    }

    // 删除用户的所有日历设置
    static async deleteAllByUser(userId) {
        await database.run(
            'DELETE FROM calendar_settings WHERE user_id = ?',
            [userId]
        );
    }

    // 获取默认设置
    static getDefaultSettings() {
        return {
            exchange: {
                email: '',
                password: '',
                ewsUrl: '',
                exchangeVersion: 'Exchange2013'
            },
            caldav: {
                username: '',
                password: '',
                serverUrl: ''
            },
            imap: {
                email: '',
                password: '',
                imapHost: '',
                imapPort: 993,
                useTLS: true,
                allowlist: [] // 邮件白名单
            }
        };
    }

    // 转换为JSON对象
    toJSON() {
        return {
            id: this.id,
            user_id: this.user_id,
            setting_type: this.setting_type,
            config_data: this.config_data,
            created_at: this.created_at,
            updated_at: this.updated_at
        };
    }
}

module.exports = CalendarSettings;