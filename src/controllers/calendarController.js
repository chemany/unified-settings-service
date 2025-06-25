const CalendarSettings = require('../models/CalendarSettings');
const { validationResult } = require('express-validator');

class CalendarController {
    // 获取特定类型的日历设置
    static async getCalendarSettings(req, res) {
        try {
            const { type } = req.params;
            const userId = req.user.id;

            const settings = await CalendarSettings.getByUserAndType(userId, type);
            
            if (!settings) {
                // 返回默认设置
                const defaultSettings = CalendarSettings.getDefaultSettings();
                return res.json({
                    config_data: defaultSettings[type] || {}
                });
            }

            res.json({
                config_data: settings.config_data
            });
        } catch (error) {
            console.error(`获取${req.params.type}设置错误:`, error);
            res.status(500).json({
                error: '获取日历设置失败'
            });
        }
    }

    // 保存特定类型的日历设置
    static async saveCalendarSettings(req, res) {
        try {
            // 验证输入数据
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: '输入数据验证失败',
                    details: errors.array()
                });
            }

            const { type } = req.params;
            const userId = req.user.id;
            const configData = req.body;            // 验证类型是否有效
            const validTypes = ['general', 'notification', 'ai', 'sync'];
            if (!validTypes.includes(type)) {
                return res.status(400).json({
                    error: '无效的日历设置类型'
                });
            }

            const settings = await CalendarSettings.saveOrUpdate(userId, type, configData);

            res.json({
                message: `${type}设置保存成功`,
                config_data: settings.config_data
            });
        } catch (error) {
            console.error(`保存${req.params.type}设置错误:`, error);
            res.status(500).json({
                error: '保存日历设置失败'
            });
        }
    }

    // 获取用户的所有日历设置
    static async getAllCalendarSettings(req, res) {
        try {
            const userId = req.user.id;
            const allSettings = await CalendarSettings.getAllByUser(userId);
            
            const defaultSettings = CalendarSettings.getDefaultSettings();
            const result = {};

            // 合并默认设置和用户设置
            for (const type of Object.keys(defaultSettings)) {
                const userSetting = allSettings.find(s => s.type === type);
                result[type] = userSetting ? userSetting.config_data : defaultSettings[type];
            }

            res.json(result);
        } catch (error) {
            console.error('获取所有日历设置错误:', error);
            res.status(500).json({
                error: '获取日历设置失败'
            });
        }
    }

    // 批量保存多个日历设置
    static async saveAllCalendarSettings(req, res) {
        try {
            // 验证输入数据
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: '输入数据验证失败',
                    details: errors.array()
                });
            }

            const userId = req.user.id;
            const settingsData = req.body;
            const validTypes = ['general', 'notification', 'ai', 'sync'];
            
            const results = {};

            for (const [type, configData] of Object.entries(settingsData)) {
                if (validTypes.includes(type)) {
                    const settings = await CalendarSettings.saveOrUpdate(userId, type, configData);
                    results[type] = settings.config_data;
                }
            }

            res.json({
                message: '日历设置保存成功',
                settings: results
            });
        } catch (error) {
            console.error('批量保存日历设置错误:', error);
            res.status(500).json({
                error: '保存日历设置失败'
            });
        }
    }    // 重置特定类型的日历设置
    static async resetCalendarSettings(req, res) {
        try {
            const { type } = req.params;
            const userId = req.user.id;

            const validTypes = ['general', 'notification', 'ai', 'sync'];
            if (!validTypes.includes(type)) {
                return res.status(400).json({
                    error: '无效的日历设置类型'
                });
            }

            // 删除用户的自定义设置，恢复默认值
            await CalendarSettings.deleteByUserAndType(userId, type);
            
            const defaultSettings = CalendarSettings.getDefaultSettings();

            res.json({
                message: `${type}设置已重置`,
                config_data: defaultSettings[type]
            });
        } catch (error) {
            console.error(`重置${req.params.type}设置错误:`, error);
            res.status(500).json({
                error: '重置日历设置失败'
            });
        }
    }

    // 重置所有日历设置
    static async resetAllCalendarSettings(req, res) {
        try {
            const userId = req.user.id;
            
            await CalendarSettings.deleteAllByUser(userId);
            
            const defaultSettings = CalendarSettings.getDefaultSettings();

            res.json({
                message: '所有日历设置已重置',
                settings: defaultSettings
            });
        } catch (error) {
            console.error('重置所有日历设置错误:', error);
            res.status(500).json({
                error: '重置日历设置失败'
            });
        }
    }
}

module.exports = CalendarController;