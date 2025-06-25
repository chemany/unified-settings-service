/**
 * 基于JSON文件的设置管理服务
 * 每个用户一个独立的文件夹，避免相互影响
 */

const fs = require('fs');
const path = require('path');

class FileSettingsService {
    constructor() {
        this.baseDir = path.join(__dirname, '../../user-settings');
        this.configDir = path.join(__dirname, '../../config');
        
        // 确保目录存在
        this.ensureDirectoryExists(this.baseDir);
        this.ensureDirectoryExists(this.configDir);
    }

    /**
     * 确保目录存在
     */
    ensureDirectoryExists(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            console.log(`[FileSettings] 创建目录: ${dirPath}`);
        }
    }

    /**
     * 获取用户设置目录
     */
    getUserSettingsDir(userId) {
        const userDir = path.join(this.baseDir, userId);
        this.ensureDirectoryExists(userDir);
        return userDir;
    }

    /**
     * 读取JSON文件
     */
    readJsonFile(filePath, defaultValue = null) {
        try {
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf8');
                return JSON.parse(content);
            }
            return defaultValue;
        } catch (error) {
            console.error(`[FileSettings] 读取文件失败 ${filePath}:`, error);
            return defaultValue;
        }
    }

    /**
     * 写入JSON文件
     */
    writeJsonFile(filePath, data) {
        try {
            const content = JSON.stringify(data, null, 2);
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`[FileSettings] 保存文件成功: ${filePath}`);
            return true;
        } catch (error) {
            console.error(`[FileSettings] 保存文件失败 ${filePath}:`, error);
            return false;
        }
    }

    /**
     * 获取默认免费模型配置
     */
    getDefaultModels() {
        const defaultModelsPath = path.join(this.configDir, 'default-models.json');
        return this.readJsonFile(defaultModelsPath, {});
    }

    /**
     * 获取用户LLM设置（支持多provider）
     */
    getUserLlmSettings(userId) {
        const userDir = this.getUserSettingsDir(userId);
        const llmPath = path.join(userDir, 'llm.json');
        
        const userSettings = this.readJsonFile(llmPath);
        
        if (!userSettings) {
            console.log(`[FileSettings] 用户 ${userId} 无LLM设置，返回默认免费模型`);
            const defaultModels = this.getDefaultModels();
            return defaultModels.builtin_free || null;
        }
        
        // 处理新的多provider格式
        if (userSettings.providers && userSettings.current_provider) {
            const currentProviderSettings = userSettings.providers[userSettings.current_provider];
            if (currentProviderSettings) {
                // 返回当前provider的设置，但保持兼容旧格式
                const compatibleFormat = {
                    provider: userSettings.current_provider,
                    api_key: currentProviderSettings.api_key,
                    model_name: currentProviderSettings.model_name,
                    base_url: currentProviderSettings.base_url,
                    // 同时包含新格式信息，供前端使用
                    _multi_provider: true,
                    _all_providers: userSettings.providers,
                    updated_at: userSettings.updated_at
                };
                
                console.log(`[FileSettings] 用户 ${userId} 使用多provider格式，当前: ${userSettings.current_provider}`);
                return compatibleFormat;
            }
        }
        
        // 兼容旧的单provider格式
        if (userSettings.provider === 'builtin') {
            console.log(`[FileSettings] 用户 ${userId} 使用内置模型，返回最新默认配置`);
            const defaultModels = this.getDefaultModels();
            return defaultModels.builtin_free || userSettings;
        }
        
        return userSettings;
    }

    /**
     * 获取provider的默认配置
     */
    getProviderDefaults(provider) {
        const providerDefaults = {
            'openai': {
                base_url: 'https://api.openai.com/v1',
                default_model: 'gpt-4o-mini'
            },
            'anthropic': {
                base_url: 'https://api.anthropic.com',
                default_model: 'claude-3-haiku-20240307'
            },
            'deepseek': {
                base_url: 'https://api.deepseek.com/v1',
                default_model: 'deepseek-chat'
            },
            'google': {
                base_url: 'https://generativelanguage.googleapis.com/v1beta',
                default_model: 'gemini-1.5-flash'
            },
            'openrouter': {
                base_url: 'https://openrouter.ai/api/v1',
                default_model: 'meta-llama/llama-3.2-3b-instruct:free'
            },
            'ollama': {
                base_url: 'http://localhost:11434/v1',
                default_model: 'llama3.2:3b'
            },
            'builtin': {
                base_url: '',
                default_model: 'builtin-free',
                api_key: 'builtin-free-key',
                description: '内置免费模型'
            }
        };
        
        return providerDefaults[provider] || { base_url: '', default_model: '' };
    }

    /**
     * 保存用户LLM设置（支持多provider）
     */
    saveUserLlmSettings(userId, settings) {
        const userDir = this.getUserSettingsDir(userId);
        const llmPath = path.join(userDir, 'llm.json');
        
        const provider = settings.provider;
        
        // 检查是否使用默认配置标记
        if (provider === 'builtin' && settings.api_key === 'USE_DEFAULT_CONFIG') {
            console.log(`[FileSettings] 用户 ${userId} 选择内置免费模型，设置current_provider为builtin但不保存具体配置`);
            
            // 读取现有设置
            let existingSettings = this.readJsonFile(llmPath, {
                current_provider: 'none',
                providers: {}
            });
            
            // 只设置current_provider为builtin，不保存具体的builtin配置
            // 这样在读取时会返回默认配置
            existingSettings.current_provider = 'builtin';
            existingSettings.updated_at = new Date().toISOString();
            
            // 如果存在builtin配置，删除它以确保使用默认配置
            if (existingSettings.providers && existingSettings.providers.builtin) {
                delete existingSettings.providers.builtin;
            }
            
            return this.writeJsonFile(llmPath, existingSettings);
        }
        
        // 读取现有设置
        let existingSettings = this.readJsonFile(llmPath, {
            current_provider: 'none',
            providers: {}
        });
        
        // 确保结构正确
        if (!existingSettings.providers) {
            existingSettings.providers = {};
        }
        
        const defaults = this.getProviderDefaults(provider);
        
        // 处理内置免费模型（非USE_DEFAULT_CONFIG情况）
        if (provider === 'builtin') {
            existingSettings.providers[provider] = {
                api_key: defaults.api_key,
                model_name: defaults.default_model,
                base_url: defaults.base_url,
                description: defaults.description,
                updated_at: new Date().toISOString()
            };
        } else {
            // 更新指定provider的设置，允许用户自定义base_url
            existingSettings.providers[provider] = {
                api_key: settings.api_key || '',
                model_name: settings.model_name || defaults.default_model,
                base_url: settings.base_url || defaults.base_url, // 优先使用用户提供的base_url，回退到默认值
                updated_at: new Date().toISOString()
            };
        }
        
        // 设置当前provider
        existingSettings.current_provider = provider;
        existingSettings.updated_at = new Date().toISOString();
        
        const finalBaseUrl = provider === 'builtin' ? defaults.base_url : (settings.base_url || defaults.base_url);
        console.log(`[FileSettings] 保存${provider}设置，使用base_url: ${finalBaseUrl}`);
        
        return this.writeJsonFile(llmPath, existingSettings);
    }

    /**
     * 获取用户日历设置
     */
    getUserCalendarSettings(userId) {
        const userDir = this.getUserSettingsDir(userId);
        const calendarPath = path.join(userDir, 'calendar.json');
        
        return this.readJsonFile(calendarPath, {
            default_view: 'month',
            week_start: 1,
            time_format: '24h',
            first_day_of_week: 'monday'
        });
    }

    /**
     * 保存用户日历设置（支持IMAP、Exchange、CalDAV等）
     */
    saveUserCalendarSettings(userId, settings) {
        const userDir = this.getUserSettingsDir(userId);
        const calendarPath = path.join(userDir, 'calendar.json');
        
        // 读取现有设置
        let existingSettings = this.readJsonFile(calendarPath, {
            default_view: 'month',
            week_start: 1,
            time_format: '24h',
            first_day_of_week: 'monday'
        });
        
        // 合并新设置
        const mergedSettings = {
            ...existingSettings,
            ...settings,
            updated_at: new Date().toISOString()
        };
        
        console.log(`[FileSettings] 保存用户 ${userId} 的日历设置，包含: ${Object.keys(settings).join(', ')}`);
        
        return this.writeJsonFile(calendarPath, mergedSettings);
    }

    /**
     * 保存用户IMAP设置
     */
    saveUserImapSettings(userId, settings) {
        const userDir = this.getUserSettingsDir(userId);
        const imapPath = path.join(userDir, 'imap.json');
        
        const settingsWithTimestamp = {
            ...settings,
            updated_at: new Date().toISOString()
        };
        
        console.log(`[FileSettings] 保存用户 ${userId} 的IMAP设置: ${settings.email || 'N/A'}`);
        
        return this.writeJsonFile(imapPath, settingsWithTimestamp);
    }

    /**
     * 获取用户IMAP设置
     */
    getUserImapSettings(userId) {
        const userDir = this.getUserSettingsDir(userId);
        const imapPath = path.join(userDir, 'imap.json');
        
        return this.readJsonFile(imapPath, {});
    }

    /**
     * 保存用户Exchange设置
     */
    saveUserExchangeSettings(userId, settings) {
        const userDir = this.getUserSettingsDir(userId);
        const exchangePath = path.join(userDir, 'exchange.json');
        
        const settingsWithTimestamp = {
            ...settings,
            updated_at: new Date().toISOString()
        };
        
        console.log(`[FileSettings] 保存用户 ${userId} 的Exchange设置: ${settings.email || 'N/A'}`);
        
        return this.writeJsonFile(exchangePath, settingsWithTimestamp);
    }

    /**
     * 获取用户Exchange设置
     */
    getUserExchangeSettings(userId) {
        const userDir = this.getUserSettingsDir(userId);
        const exchangePath = path.join(userDir, 'exchange.json');
        
        return this.readJsonFile(exchangePath, {});
    }

    /**
     * 保存用户CalDAV设置
     */
    saveUserCalDAVSettings(userId, settings) {
        const userDir = this.getUserSettingsDir(userId);
        const caldavPath = path.join(userDir, 'caldav.json');
        
        const settingsWithTimestamp = {
            ...settings,
            updated_at: new Date().toISOString()
        };
        
        console.log(`[FileSettings] 保存用户 ${userId} 的CalDAV设置: ${settings.username || 'N/A'}`);
        
        return this.writeJsonFile(caldavPath, settingsWithTimestamp);
    }

    /**
     * 获取用户CalDAV设置
     */
    getUserCalDAVSettings(userId) {
        const userDir = this.getUserSettingsDir(userId);
        const caldavPath = path.join(userDir, 'caldav.json');
        
        return this.readJsonFile(caldavPath, {});
    }

    /**
     * 删除用户所有设置
     */
    deleteUserSettings(userId) {
        try {
            const userDir = this.getUserSettingsDir(userId);
            if (fs.existsSync(userDir)) {
                fs.rmSync(userDir, { recursive: true, force: true });
                console.log(`[FileSettings] 删除用户 ${userId} 的所有设置`);
                return true;
            }
            return false;
        } catch (error) {
            console.error(`[FileSettings] 删除用户设置失败:`, error);
            return false;
        }
    }

    /**
     * 获取所有用户列表
     */
    getAllUsers() {
        try {
            const users = fs.readdirSync(this.baseDir, { withFileTypes: true })
                          .filter(dirent => dirent.isDirectory())
                          .map(dirent => dirent.name);
            return users;
        } catch (error) {
            console.error('[FileSettings] 获取用户列表失败:', error);
            return [];
        }
    }

    /**
     * 获取用户设置概览
     */
    getUserSettingsOverview(userId) {
        const userDir = this.getUserSettingsDir(userId);
        const overview = {
            userId,
            llm: this.readJsonFile(path.join(userDir, 'llm.json')),
            calendar: this.readJsonFile(path.join(userDir, 'calendar.json')),
            embedding: this.readJsonFile(path.join(userDir, 'embedding.json')),
            reranking: this.readJsonFile(path.join(userDir, 'reranking.json')),
            lastAccess: new Date().toISOString()
        };
        
        return overview;
    }

    /**
     * 获取用户embedding设置
     */
    getEmbeddingSettings(userId) {
        const userDir = this.getUserSettingsDir(userId);
        const embeddingPath = path.join(userDir, 'embedding.json');
        
        const defaultSettings = {
            provider: 'siliconflow',
            apiKey: '',
            model: 'BAAI/bge-large-zh-v1.5',
            encodingFormat: 'float',
            customEndpoint: ''
        };
        
        return this.readJsonFile(embeddingPath, defaultSettings);
    }

    /**
     * 保存用户embedding设置
     */
    saveEmbeddingSettings(userId, settings) {
        const userDir = this.getUserSettingsDir(userId);
        const embeddingPath = path.join(userDir, 'embedding.json');
        
        const settingsWithTimestamp = {
            ...settings,
            updated_at: new Date().toISOString()
        };
        
        console.log(`[FileSettings] 保存用户 ${userId} 的embedding设置: ${settings.provider || 'N/A'}`);
        
        return this.writeJsonFile(embeddingPath, settingsWithTimestamp);
    }

    /**
     * 获取用户reranking设置
     */
    getRerankingSettings(userId) {
        const userDir = this.getUserSettingsDir(userId);
        const rerankingPath = path.join(userDir, 'reranking.json');
        
        const defaultSettings = {
            enableReranking: false,
            rerankingProvider: 'siliconflow',
            rerankingModel: 'BAAI/bge-reranker-v2-m3',
            initialRerankCandidates: 100,
            finalRerankTopN: 10,
            rerankingCustomEndpoint: ''
        };
        
        return this.readJsonFile(rerankingPath, defaultSettings);
    }

    /**
     * 保存用户reranking设置
     */
    saveRerankingSettings(userId, settings) {
        const userDir = this.getUserSettingsDir(userId);
        const rerankingPath = path.join(userDir, 'reranking.json');
        
        const settingsWithTimestamp = {
            ...settings,
            updated_at: new Date().toISOString()
        };
        
        console.log(`[FileSettings] 保存用户 ${userId} 的reranking设置: ${settings.rerankingProvider || 'N/A'}`);
        
        return this.writeJsonFile(rerankingPath, settingsWithTimestamp);
    }
}

module.exports = new FileSettingsService();