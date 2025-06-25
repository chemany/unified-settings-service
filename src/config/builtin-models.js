/**
 * 内置免费模型配置管理
 * 从配置文件动态读取模型配置，不使用硬编码
 */

const fs = require('fs');
const path = require('path');

class BuiltinModelsConfig {
    constructor() {
        this.configPath = path.join(__dirname, '../../../config/default-models.json');
        this.defaultSettingsPath = path.join(__dirname, '../../../config/default-settings.json');
    }

    /**
     * 从配置文件读取内置模型配置
     * @returns {Object} 内置模型配置
     */
    getBuiltinConfig() {
        try {
            console.log('[BuiltinModelsConfig] 从配置文件读取内置模型:', this.configPath);
            
            if (!fs.existsSync(this.configPath)) {
                console.error('[BuiltinModelsConfig] 配置文件不存在:', this.configPath);
                return this.getFallbackConfig();
            }

            const configData = fs.readFileSync(this.configPath, 'utf8');
            const config = JSON.parse(configData);
            
            if (config.builtin_free) {
                console.log('[BuiltinModelsConfig] 成功读取内置免费模型配置:', config.builtin_free);
                return {
                    provider: config.builtin_free.provider || 'builtin',
                    api_key: config.builtin_free.api_key,
                    base_url: config.builtin_free.base_url,
                    model_name: config.builtin_free.model_name,
                    model: config.builtin_free.model_name, // 兼容性字段
                    temperature: config.builtin_free.temperature || 0.7,
                    max_tokens: config.builtin_free.max_tokens || 2000,
                    timeout: 30000,
                    description: config.builtin_free.description
                };
            } else {
                console.warn('[BuiltinModelsConfig] 配置文件中未找到 builtin_free 配置');
                return this.getFallbackConfig();
            }
        } catch (error) {
            console.error('[BuiltinModelsConfig] 读取配置文件失败:', error);
            return this.getFallbackConfig();
        }
    }

    /**
     * 获取回退配置（当配置文件不可用时）
     * @returns {Object} 回退配置
     */
    getFallbackConfig() {
        console.log('[BuiltinModelsConfig] 使用回退配置');
        return {
            provider: 'builtin',
            api_key: '', // 空密钥，需要用户配置
            base_url: 'https://openrouter.ai/api/v1/chat/completions',
            model_name: 'deepseek/deepseek-r1:free',
            model: 'deepseek/deepseek-r1:free',
            temperature: 0.7,
            max_tokens: 2000,
            timeout: 30000,
            description: '内置免费模型（需要配置API密钥）'
        };
    }

    /**
     * 更新配置文件中的内置模型配置
     * @param {Object} newConfig - 新的配置
     */
    updateBuiltinConfig(newConfig) {
        try {
            let config = {};
            
            // 读取现有配置
            if (fs.existsSync(this.configPath)) {
                const configData = fs.readFileSync(this.configPath, 'utf8');
                config = JSON.parse(configData);
            }
            
            // 更新内置免费模型配置
            config.builtin_free = {
                ...config.builtin_free,
                ...newConfig
            };
            
            // 写回文件
            fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8');
            console.log('[BuiltinModelsConfig] 成功更新配置文件');
            
        } catch (error) {
            console.error('[BuiltinModelsConfig] 更新配置文件失败:', error);
            throw error;
        }
    }

    /**
     * 获取所有可用的内置模型配置
     * @returns {Array} 内置模型配置列表
     */
    getAllBuiltinConfigs() {
        try {
            if (!fs.existsSync(this.configPath)) {
                return [{ name: 'Default', ...this.getFallbackConfig() }];
            }

            const configData = fs.readFileSync(this.configPath, 'utf8');
            const config = JSON.parse(configData);
            
            const configs = [];
            
            // 添加主要的内置免费模型
            if (config.builtin_free) {
                configs.push({
                    name: config.builtin_free.name || 'Default Free Model',
                    ...this.getBuiltinConfig()
                });
            }
            
            // 如果配置文件中有其他内置模型，也添加进来
            if (config.builtin_models && Array.isArray(config.builtin_models)) {
                config.builtin_models.forEach(model => {
                    configs.push({
                        name: model.name || model.id,
                        provider: model.provider,
                        api_key: model.api_key,
                        base_url: model.base_url,
                        model_name: model.model,
                        model: model.model,
                        description: model.description
                    });
                });
            }
            
            return configs.length > 0 ? configs : [{ name: 'Default', ...this.getFallbackConfig() }];
            
        } catch (error) {
            console.error('[BuiltinModelsConfig] 获取所有配置失败:', error);
            return [{ name: 'Default', ...this.getFallbackConfig() }];
        }
    }

    /**
     * 验证内置模型配置是否完整
     * @param {Object} config - 要验证的配置
     * @returns {boolean} 配置是否完整
     */
    validateConfig(config = null) {
        const configToValidate = config || this.getBuiltinConfig();
        const requiredFields = ['provider', 'api_key', 'base_url', 'model_name'];
        return requiredFields.every(field => 
            configToValidate[field] && configToValidate[field].trim() !== ''
        );
    }

    /**
     * 获取配置状态信息
     * @returns {Object} 配置状态
     */
    getConfigStatus() {
        const config = this.getBuiltinConfig();
        const isValid = this.validateConfig(config);
        return {
            isValid,
            provider: config.provider,
            model: config.model_name,
            hasApiKey: !!config.api_key,
            configExists: fs.existsSync(this.configPath),
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * 重新加载配置（清除缓存）
     */
    reloadConfig() {
        // 这个方法可以用来强制重新读取配置文件
        console.log('[BuiltinModelsConfig] 重新加载配置');
        return this.getBuiltinConfig();
    }
}

// 创建单例实例
const builtinModelsConfig = new BuiltinModelsConfig();

/**
 * 从JSON文件加载默认全局设置
 */
function loadDefaultConfig() {
    const DEFAULT_CONFIG_PATH = path.join(__dirname, '../../../config/default-settings.json');
    
    try {
        if (fs.existsSync(DEFAULT_CONFIG_PATH)) {
            const configData = fs.readFileSync(DEFAULT_CONFIG_PATH, 'utf8');
            const config = JSON.parse(configData);
            console.log('[Config] 成功加载默认配置文件:', DEFAULT_CONFIG_PATH);
            return config.global_settings;
        } else {
            console.warn('[Config] 默认配置文件不存在，使用内置配置:', DEFAULT_CONFIG_PATH);
            return getBuiltinDefaultSettings();
        }
    } catch (error) {
        console.error('[Config] 加载默认配置文件失败，使用内置配置:', error);
        return getBuiltinDefaultSettings();
    }
}

function getBuiltinDefaultSettings() {
    // 从内置模型配置获取LLM设置
    const builtinConfig = builtinModelsConfig.getBuiltinConfig();
    
    return {
        llm_base: {
            provider: builtinConfig.provider,
            api_key: builtinConfig.api_key,
            base_url: builtinConfig.base_url,
            model_name: builtinConfig.model_name,
            temperature: builtinConfig.temperature,
            max_tokens: builtinConfig.max_tokens
        },
        calendar_base: {
            default_view: 'month',
            week_start: 1,
            time_format: '24h',
            first_day_of_week: 'monday'
        }
    };
}

function getDefaultGlobalSettings() {
    return loadDefaultConfig();
}

module.exports = {
    builtinModelsConfig,
    getDefaultGlobalSettings,
    loadDefaultConfig,
    getBuiltinDefaultSettings
};