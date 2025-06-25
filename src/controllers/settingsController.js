const { validationResult } = require('express-validator');
const { builtinModelsConfig, getDefaultGlobalSettings } = require('../config/builtin-models');
const fileSettingsService = require('../services/FileSettingsService');

class SettingsController {
    /**
     * 获取全局设置
     * GET /api/settings/global/:category
     */
    static async getGlobalSettings(req, res) {
        try {
            const { category } = req.params;
            const userId = req.user.id;
            
            console.log(`[Settings] 获取全局设置: ${category}, 用户: ${userId}`);
            
            // 改为使用文件存储而不是数据库
            let settings = null;
            
            if (category === 'llm_base') {
                settings = fileSettingsService.getUserLlmSettings(userId);
                if (settings) {
                    // 转换为统一格式
                    settings = {
                        id: 1,
                        user_id: userId,
                        category: category,
                        config_data: settings,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    };
                }
            } else {
                // 其他类型设置可以从文件中读取或使用默认值
                const { getDefaultGlobalSettings } = require('../config/builtin-models');
                const defaultSettings = getDefaultGlobalSettings();
                if (defaultSettings[category]) {
                    settings = {
                        id: 1,
                        user_id: userId,
                        category: category,
                        config_data: defaultSettings[category],
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    };
                }
            }
            
            if (settings) {
                res.json({
                    success: true,
                    data: settings
                });
            } else {
                res.status(404).json({
                    error: '未找到指定的全局设置'
                });
            }
            
        } catch (error) {
            console.error('[Settings] 获取全局设置失败:', error);
            res.status(500).json({
                error: '获取全局设置失败'
            });
        }
    }

    /**
     * 保存全局设置
     * POST /api/settings/global/:category
     */
    static async saveGlobalSettings(req, res) {
        try {
            const { category } = req.params;
            const configData = req.body;
            const userId = req.user.id;
            
            console.log(`[Settings] 保存全局设置: ${category}, 用户: ${userId}`, {
                provider: configData.provider,
                model: configData.model_name || configData.model
            });
            
            // 改为使用文件存储而不是数据库
            let success = false;
            
            if (category === 'llm_base') {
                // 转换统一格式到LLM格式
                const llmSettings = {
                    provider: configData.provider,
                    api_key: configData.api_key,
                    model_name: configData.model_name || configData.model,
                    base_url: configData.base_url
                };
                
                success = fileSettingsService.saveUserLlmSettings(userId, llmSettings);
            } else if (category === 'embedding_base') {
                // 保存embedding设置
                success = fileSettingsService.saveEmbeddingSettings(userId, configData);
            } else if (category === 'reranking_base') {
                // 保存reranking设置
                success = fileSettingsService.saveRerankingSettings(userId, configData);
            } else {
                // 其他类型设置
                console.log(`[Settings] 暂不支持保存 ${category} 类型的设置到文件`);
                success = false;
            }
            
            if (success) {
                res.json({
                    success: true,
                    message: '全局设置保存成功',
                    data: {
                        user_id: userId,
                        category: category,
                        config_data: configData,
                        updated_at: new Date().toISOString()
                    }
                });
            } else {
                throw new Error('文件保存失败');
            }
            
        } catch (error) {
            console.error('[Settings] 保存全局设置失败:', error);
            res.status(500).json({
                error: '保存全局设置失败'
            });
        }
    }

    // 获取应用专用设置 - 暂时返回默认值
    static async getAppSettings(req, res) {
        try {
            const { appName, category } = req.params;
            const userId = req.user.id;

            console.log(`[Settings] 获取应用设置: ${appName}/${category}, 用户: ${userId}`);
            
            // 目前暂不支持应用专用设置的文件存储，返回默认配置
            const { getDefaultAppSettings } = require('../config/builtin-models');
            const defaultSettings = getDefaultAppSettings();
            
            res.json({
                config_data: defaultSettings[appName]?.[category] || {}
            });
        } catch (error) {
            console.error(`[Settings] 获取应用设置失败: ${error}`);
            res.status(500).json({
                error: '获取应用设置失败'
            });
        }
    }

    // 保存应用专用设置 - 暂时不支持
    static async saveAppSettings(req, res) {
        try {
            const { appName, category } = req.params;
            const userId = req.user.id;
            
            console.log(`[Settings] 暂不支持保存应用设置: ${appName}/${category}, 用户: ${userId}`);
            
            res.json({
                message: '应用设置保存功能暂未实现（基于文件存储）',
                config_data: req.body
            });
        } catch (error) {
            console.error('[Settings] 保存应用设置失败:', error);
            res.status(500).json({
                error: '保存应用设置失败'
            });
        }
    }

    // 获取用户完整配置 - 基于文件
    static async getFullUserConfig(req, res) {
        try {
            const { appName } = req.params;
            const userId = req.user.id;
            
            console.log(`[Settings] 获取用户完整配置: ${appName}, 用户: ${userId}`);
            
            // 从文件获取LLM设置
            const llmSettings = fileSettingsService.getUserLlmSettings(userId);
            
            const fullConfig = {
                llm_base: llmSettings || {},
                // 其他设置可以从对应文件读取
            };
            
            res.json(fullConfig);
        } catch (error) {
            console.error('[Settings] 获取用户完整配置失败:', error);
            res.status(500).json({
                error: '获取用户完整配置失败'
            });
        }
    }

    // 批量保存全局设置 - 基于文件
    static async batchSaveGlobalSettings(req, res) {
        try {
            const userId = req.user.id;
            const settingsMap = req.body;
            
            console.log(`[Settings] 批量保存全局设置, 用户: ${userId}`);
            
            const results = {};
            
            for (const [category, configData] of Object.entries(settingsMap)) {
                if (category === 'llm_base') {
                    const llmSettings = {
                        provider: configData.provider,
                        api_key: configData.api_key,
                        model_name: configData.model_name || configData.model,
                        base_url: configData.base_url
                    };
                    
                    const success = fileSettingsService.saveUserLlmSettings(userId, llmSettings);
                    if (success) {
                        results[category] = configData;
                    }
                }
            }
            
            res.json({
                message: '批量保存全局设置成功',
                results
            });
        } catch (error) {
            console.error('[Settings] 批量保存全局设置失败:', error);
            res.status(500).json({
                error: '批量保存全局设置失败'
            });
        }
    }

    // 批量保存应用设置 - 暂不支持
    static async batchSaveAppSettings(req, res) {
        try {
            console.log('[Settings] 批量保存应用设置功能暂未实现（基于文件存储）');
            
            res.json({
                message: '批量保存应用设置功能暂未实现（基于文件存储）',
                results: {}
            });
        } catch (error) {
            console.error('[Settings] 批量保存应用设置失败:', error);
            res.status(500).json({
                error: '批量保存应用设置失败'
            });
        }
    }

    // 重置全局设置
    static async resetGlobalSettings(req, res) {
        try {
            const { category } = req.params;
            const userId = req.user.id;
            
            console.log(`[Settings] 重置全局设置: ${category}, 用户: ${userId}`);
            
            if (category === 'llm_base') {
                // 删除用户LLM设置文件，回到默认状态
                const userDir = fileSettingsService.getUserSettingsDir(userId);
                const llmPath = require('path').join(userDir, 'llm.json');
                
                const fs = require('fs');
                if (fs.existsSync(llmPath)) {
                    fs.unlinkSync(llmPath);
                }
            }
            
            // 返回默认设置
            const { getDefaultGlobalSettings } = require('../config/builtin-models');
            const defaultSettings = getDefaultGlobalSettings();
            
            res.json({
                message: '全局设置重置成功',
                config_data: defaultSettings[category] || {}
            });
        } catch (error) {
            console.error('[Settings] 重置全局设置失败:', error);
            res.status(500).json({
                error: '重置全局设置失败'
            });
        }
    }

    // 重置应用设置 - 暂不支持
    static async resetAppSettings(req, res) {
        try {
            console.log('[Settings] 重置应用设置功能暂未实现（基于文件存储）');
            
            res.json({
                message: '重置应用设置功能暂未实现（基于文件存储）',
                config_data: {}
            });
        } catch (error) {
            console.error('[Settings] 重置应用设置失败:', error);
            res.status(500).json({
                error: '重置应用设置失败'
            });
        }
    }

    // 重置用户所有全局设置
    static async resetAllGlobalSettings(req, res) {
        try {
            const userId = req.user.id;
            
            console.log(`[Settings] 重置用户所有全局设置, 用户: ${userId}`);
            
            // 删除用户设置目录
            fileSettingsService.deleteUserSettings(userId);
            
            // 返回默认设置
            const { getDefaultGlobalSettings } = require('../config/builtin-models');
            const defaultSettings = getDefaultGlobalSettings();
            
            res.json({
                message: '所有全局设置重置成功',
                config_data: defaultSettings
            });
        } catch (error) {
            console.error('[Settings] 重置所有全局设置失败:', error);
            res.status(500).json({
                error: '重置所有全局设置失败'
            });
        }
    }

    // 重置用户所有应用设置 - 暂不支持
    static async resetAllAppSettings(req, res) {
        try {
            console.log('[Settings] 重置所有应用设置功能暂未实现（基于文件存储）');
            
            res.json({
                message: '重置所有应用设置功能暂未实现（基于文件存储）',
                config_data: {}
            });
        } catch (error) {
            console.error('[Settings] 重置所有应用设置失败:', error);
            res.status(500).json({
                error: '重置所有应用设置失败'
            });
        }
    }

    /**
     * 从文件读取LLM设置
     * GET /api/settings/llm-file
     */
    static async getLLMSettingsFromFile(req, res) {
        try {
            const userId = req.user.id;
            console.log(`[Settings] 从文件读取LLM设置, 用户: ${userId}`);
            
            const settings = fileSettingsService.getUserLlmSettings(userId);
            
            if (settings) {
                res.json({
                    success: true,
                    data: settings
                });
            } else {
                // 返回默认设置
                const { getDefaultGlobalSettings } = require('../config/builtin-models');
                const defaultSettings = getDefaultGlobalSettings();
                res.json({
                    success: true,
                    data: defaultSettings.llm_base || {}
                });
            }
        } catch (error) {
            console.error('[Settings] 读取LLM设置失败:', error);
            res.status(500).json({
                success: false,
                error: '读取LLM设置失败'
            });
        }
    }

    /**
     * 保存LLM设置到文件
     * POST /api/settings/llm-file
     */
    static async saveLLMSettingsToFile(req, res) {
        try {
            const userId = req.user.id;
            const { provider, settings } = req.body;
            
            console.log(`[Settings] 保存LLM设置到文件, 用户: ${userId}, 提供商: ${provider}`);
            
            const success = fileSettingsService.saveUserLlmSettings(userId, { provider, ...settings });
            
            if (success) {
                res.json({
                    success: true,
                    message: 'LLM设置保存成功'
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'LLM设置保存失败'
                });
            }
        } catch (error) {
            console.error('[Settings] 保存LLM设置失败:', error);
            res.status(500).json({
                success: false,
                error: '保存LLM设置失败'
            });
        }
    }

    /**
     * 获取默认模型配置
     * GET /api/settings/default-models
     */
    static async getDefaultModels(req, res) {
        try {
            console.log('[Settings] 获取默认模型配置');
            
            const defaultModels = fileSettingsService.getDefaultModels();
            
            res.json({
                success: true,
                data: defaultModels
            });
        } catch (error) {
            console.error('[Settings] 获取默认模型配置失败:', error);
            res.status(500).json({
                success: false,
                error: '获取默认模型配置失败'
            });
        }
    }

    /**
     * 从文件获取embedding设置
     * GET /api/settings/embedding-file
     */
    static async getEmbeddingSettingsFromFile(req, res) {
        try {
            const userId = req.user.id;
            
            console.log(`[Settings] 从文件获取embedding设置, 用户: ${userId}`);
            
            const settings = fileSettingsService.getEmbeddingSettings(userId);
            
            res.json({
                success: true,
                data: settings
            });
        } catch (error) {
            console.error('[Settings] 获取embedding设置失败:', error);
            res.status(500).json({
                success: false,
                error: '获取embedding设置失败'
            });
        }
    }

    /**
     * 保存embedding设置到文件
     * POST /api/settings/embedding-file
     */
    static async saveEmbeddingSettingsToFile(req, res) {
        try {
            const userId = req.user.id;
            const settings = req.body;
            
            console.log(`[Settings] 保存embedding设置到文件, 用户: ${userId}`);
            
            const success = fileSettingsService.saveEmbeddingSettings(userId, settings);
            
            if (success) {
                res.json({
                    success: true,
                    message: 'Embedding设置保存成功'
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Embedding设置保存失败'
                });
            }
        } catch (error) {
            console.error('[Settings] 保存embedding设置失败:', error);
            res.status(500).json({
                success: false,
                error: '保存embedding设置失败'
            });
        }
    }

    /**
     * 从文件获取reranking设置
     * GET /api/settings/reranking-file
     */
    static async getRerankingSettingsFromFile(req, res) {
        try {
            const userId = req.user.id;
            
            console.log(`[Settings] 从文件获取reranking设置, 用户: ${userId}`);
            
            const settings = fileSettingsService.getRerankingSettings(userId);
            
            res.json({
                success: true,
                data: settings
            });
        } catch (error) {
            console.error('[Settings] 获取reranking设置失败:', error);
            res.status(500).json({
                success: false,
                error: '获取reranking设置失败'
            });
        }
    }

    /**
     * 保存reranking设置到文件
     * POST /api/settings/reranking-file
     */
    static async saveRerankingSettingsToFile(req, res) {
        try {
            const userId = req.user.id;
            const settings = req.body;
            
            console.log(`[Settings] 保存reranking设置到文件, 用户: ${userId}`);
            
            const success = fileSettingsService.saveRerankingSettings(userId, settings);
            
            if (success) {
                res.json({
                    success: true,
                    message: 'Reranking设置保存成功'
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Reranking设置保存失败'
                });
            }
        } catch (error) {
            console.error('[Settings] 保存reranking设置失败:', error);
            res.status(500).json({
                success: false,
                error: '保存reranking设置失败'
            });
        }
    }
}

module.exports = SettingsController;