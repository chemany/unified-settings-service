/**
 * 基于JSON文件的设置控制器
 * 简单、可靠、易于调试
 */

const fileSettingsService = require('../services/FileSettingsService');

class FileSettingsController {
    
    /**
     * 获取用户LLM设置
     * GET /api/file-settings/llm
     */
    static async getLlmSettings(req, res) {
        try {
            const userId = req.user.id;
            const appType = req.query.app || req.headers['x-app-type'];
            
            console.log(`[FileSettings] 获取用户 ${userId} 的LLM设置，应用类型: ${appType || '通用'}`);
            
            let llmSettings;
            if (appType) {
                llmSettings = await fileSettingsService.getAppLlmSettings(userId, appType);
            } else {
                llmSettings = fileSettingsService.getUserLlmSettings(userId);
            }
            
            if (!llmSettings) {
                return res.status(404).json({
                    error: '无法获取LLM设置'
                });
            }
            
            console.log(`[FileSettings] 返回LLM设置:`, {
                provider: llmSettings.provider,
                model: llmSettings.model_name,
                hasApiKey: !!llmSettings.api_key
            });
            
            res.json(llmSettings);
            
        } catch (error) {
            console.error('[FileSettings] 获取LLM设置失败:', error);
            res.status(500).json({
                error: '获取LLM设置失败'
            });
        }
    }

    /**
     * 保存用户LLM设置
     * POST /api/file-settings/llm
     */
    static async saveLlmSettings(req, res) {
        try {
            const userId = req.user.id;
            const settings = req.body;
            
            console.log(`[FileSettings] 保存用户 ${userId} 的LLM设置:`, {
                provider: settings.provider,
                model: settings.model_name
            });
            
            const success = fileSettingsService.saveUserLlmSettings(userId, settings);
            
            if (success) {
                res.json({
                    message: 'LLM设置保存成功',
                    settings
                });
            } else {
                res.status(500).json({
                    error: '保存LLM设置失败'
                });
            }
            
        } catch (error) {
            console.error('[FileSettings] 保存LLM设置失败:', error);
            res.status(500).json({
                error: '保存LLM设置失败'
            });
        }
    }

    /**
     * 获取用户日历设置
     * GET /api/file-settings/calendar
     */
    static async getCalendarSettings(req, res) {
        try {
            const userId = req.user.id;
            console.log(`[FileSettings] 获取用户 ${userId} 的日历设置`);
            
            const calendarSettings = fileSettingsService.getUserCalendarSettings(userId);
            
            res.json(calendarSettings);
            
        } catch (error) {
            console.error('[FileSettings] 获取日历设置失败:', error);
            res.status(500).json({
                error: '获取日历设置失败'
            });
        }
    }

    /**
     * 保存用户日历设置
     * POST /api/file-settings/calendar
     */
    static async saveCalendarSettings(req, res) {
        try {
            const userId = req.user.id;
            const settings = req.body;
            
            console.log(`[FileSettings] 保存用户 ${userId} 的日历设置`);
            
            const success = fileSettingsService.saveUserCalendarSettings(userId, settings);
            
            if (success) {
                res.json({
                    message: '日历设置保存成功',
                    settings
                });
            } else {
                res.status(500).json({
                    error: '保存日历设置失败'
                });
            }
            
        } catch (error) {
            console.error('[FileSettings] 保存日历设置失败:', error);
            res.status(500).json({
                error: '保存日历设置失败'
            });
        }
    }

    /**
     * 获取用户IMAP设置
     * GET /api/file-settings/imap
     */
    static async getImapSettings(req, res) {
        try {
            const userId = req.user.id;
            console.log(`[FileSettings] 获取用户 ${userId} 的IMAP设置`);
            
            const imapSettings = fileSettingsService.getUserImapSettings(userId);
            
            res.json(imapSettings);
            
        } catch (error) {
            console.error('[FileSettings] 获取IMAP设置失败:', error);
            res.status(500).json({
                error: '获取IMAP设置失败'
            });
        }
    }

    /**
     * 保存用户IMAP设置
     * POST /api/file-settings/imap
     */
    static async saveImapSettings(req, res) {
        try {
            const userId = req.user.id;
            const settings = req.body;
            
            console.log(`[FileSettings] 保存用户 ${userId} 的IMAP设置`);
            
            const success = fileSettingsService.saveUserImapSettings(userId, settings);
            
            if (success) {
                res.json({
                    message: 'IMAP设置保存成功',
                    settings
                });
            } else {
                res.status(500).json({
                    error: '保存IMAP设置失败'
                });
            }
            
        } catch (error) {
            console.error('[FileSettings] 保存IMAP设置失败:', error);
            res.status(500).json({
                error: '保存IMAP设置失败'
            });
        }
    }

    /**
     * 获取用户Exchange设置
     * GET /api/file-settings/exchange
     */
    static async getExchangeSettings(req, res) {
        try {
            const userId = req.user.id;
            console.log(`[FileSettings] 获取用户 ${userId} 的Exchange设置`);
            
            const exchangeSettings = fileSettingsService.getUserExchangeSettings(userId);
            
            res.json(exchangeSettings);
            
        } catch (error) {
            console.error('[FileSettings] 获取Exchange设置失败:', error);
            res.status(500).json({
                error: '获取Exchange设置失败'
            });
        }
    }

    /**
     * 保存用户Exchange设置
     * POST /api/file-settings/exchange
     */
    static async saveExchangeSettings(req, res) {
        try {
            const userId = req.user.id;
            const settings = req.body;
            
            console.log(`[FileSettings] 保存用户 ${userId} 的Exchange设置`);
            
            const success = fileSettingsService.saveUserExchangeSettings(userId, settings);
            
            if (success) {
                res.json({
                    message: 'Exchange设置保存成功',
                    settings
                });
            } else {
                res.status(500).json({
                    error: '保存Exchange设置失败'
                });
            }
            
        } catch (error) {
            console.error('[FileSettings] 保存Exchange设置失败:', error);
            res.status(500).json({
                error: '保存Exchange设置失败'
            });
        }
    }

    /**
     * 获取用户CalDAV设置
     * GET /api/file-settings/caldav
     */
    static async getCalDAVSettings(req, res) {
        try {
            const userId = req.user.id;
            console.log(`[FileSettings] 获取用户 ${userId} 的CalDAV设置`);
            
            const caldavSettings = fileSettingsService.getUserCalDAVSettings(userId);
            
            res.json(caldavSettings);
            
        } catch (error) {
            console.error('[FileSettings] 获取CalDAV设置失败:', error);
            res.status(500).json({
                error: '获取CalDAV设置失败'
            });
        }
    }

    /**
     * 保存用户CalDAV设置
     * POST /api/file-settings/caldav
     */
    static async saveCalDAVSettings(req, res) {
        try {
            const userId = req.user.id;
            const settings = req.body;
            
            console.log(`[FileSettings] 保存用户 ${userId} 的CalDAV设置`);
            
            const success = fileSettingsService.saveUserCalDAVSettings(userId, settings);
            
            if (success) {
                res.json({
                    message: 'CalDAV设置保存成功',
                    settings
                });
            } else {
                res.status(500).json({
                    error: '保存CalDAV设置失败'
                });
            }
            
        } catch (error) {
            console.error('[FileSettings] 保存CalDAV设置失败:', error);
            res.status(500).json({
                error: '保存CalDAV设置失败'
            });
        }
    }

    /**
     * 获取默认免费模型配置
     * GET /api/file-settings/default-models
     */
    static async getDefaultModels(req, res) {
        try {
            console.log('[FileSettings] 获取默认免费模型配置');
            
            const defaultModels = fileSettingsService.getDefaultModels();
            
            res.json(defaultModels);
            
        } catch (error) {
            console.error('[FileSettings] 获取默认模型配置失败:', error);
            res.status(500).json({
                error: '获取默认模型配置失败'
            });
        }
    }

    /**
     * 获取用户设置概览
     * GET /api/file-settings/overview
     */
    static async getUserOverview(req, res) {
        try {
            const userId = req.user.id;
            console.log(`[FileSettings] 获取用户 ${userId} 的设置概览`);
            
            const overview = fileSettingsService.getUserSettingsOverview(userId);
            
            res.json(overview);
            
        } catch (error) {
            console.error('[FileSettings] 获取用户概览失败:', error);
            res.status(500).json({
                error: '获取用户概览失败'
            });
        }
    }

    /**
     * 重置用户设置
     * DELETE /api/file-settings/reset
     */
    static async resetUserSettings(req, res) {
        try {
            const userId = req.user.id;
            console.log(`[FileSettings] 重置用户 ${userId} 的所有设置`);
            
            const success = fileSettingsService.deleteUserSettings(userId);
            
            if (success) {
                res.json({
                    message: '用户设置重置成功'
                });
            } else {
                res.json({
                    message: '用户暂无设置需要重置'
                });
            }
            
        } catch (error) {
            console.error('[FileSettings] 重置用户设置失败:', error);
            res.status(500).json({
                error: '重置用户设置失败'
            });
        }
    }

    /**
     * 管理员：获取所有用户列表
     * GET /api/file-settings/admin/users
     */
    static async getAllUsers(req, res) {
        try {
            console.log('[FileSettings] 获取所有用户列表');
            
            const users = fileSettingsService.getAllUsers();
            
            res.json({
                users,
                count: users.length
            });
            
        } catch (error) {
            console.error('[FileSettings] 获取用户列表失败:', error);
            res.status(500).json({
                error: '获取用户列表失败'
            });
        }
    }
}

module.exports = FileSettingsController; 