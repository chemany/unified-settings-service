const express = require('express');
const { body } = require('express-validator');
const SettingsController = require('../controllers/settingsController');
const auth = require('../middleware/auth');

const router = express.Router();

// 获取全局基础AI设置
router.get('/global/:category', auth, SettingsController.getGlobalSettings);

// 保存全局基础AI设置
router.post('/global/:category', [
    auth,
    body().isObject().withMessage('请求体必须是JSON对象')
], SettingsController.saveGlobalSettings);

// 获取应用专用设置
router.get('/app/:appName/:category', auth, SettingsController.getAppSettings);

// 保存应用专用设置
router.post('/app/:appName/:category', [
    auth,
    body().isObject().withMessage('请求体必须是JSON对象')
], SettingsController.saveAppSettings);

// 获取完整的用户配置 (全局+应用)
router.get('/full/:appName', auth, SettingsController.getFullUserConfig);

// 批量保存全局设置
router.post('/global/batch', [
    auth,
    body().isObject().withMessage('请求体必须是JSON对象')
], SettingsController.batchSaveGlobalSettings);

// 批量保存应用设置
router.post('/app/:appName/batch', [
    auth,
    body().isObject().withMessage('请求体必须是JSON对象')
], SettingsController.batchSaveAppSettings);

// 重置全局设置
router.delete('/global/:category', auth, SettingsController.resetGlobalSettings);

// 重置应用设置
router.delete('/app/:appName/:category', auth, SettingsController.resetAppSettings);

// 重置所有全局设置
router.delete('/global', auth, SettingsController.resetAllGlobalSettings);

// 重置所有应用设置
router.delete('/app/:appName', auth, SettingsController.resetAllAppSettings);

// 从文件读取LLM设置
router.get('/llm-file', auth, SettingsController.getLLMSettingsFromFile);

// 保存LLM设置到文件
router.post('/llm-file', [
    auth,
    body().isObject().withMessage('请求体必须是JSON对象')
], SettingsController.saveLLMSettingsToFile);

// 获取默认模型配置
router.get('/default-models', auth, SettingsController.getDefaultModels);

// 从文件读取embedding设置
router.get('/embedding-file', auth, SettingsController.getEmbeddingSettingsFromFile);

// 保存embedding设置到文件
router.post('/embedding-file', [
    auth,
    body().isObject().withMessage('请求体必须是JSON对象')
], SettingsController.saveEmbeddingSettingsToFile);

// 从文件读取reranking设置
router.get('/reranking-file', auth, SettingsController.getRerankingSettingsFromFile);

// 保存reranking设置到文件
router.post('/reranking-file', [
    auth,
    body().isObject().withMessage('请求体必须是JSON对象')
], SettingsController.saveRerankingSettingsToFile);

// 内置模型配置管理 - 暂时禁用（已改为文件存储）
// router.get('/builtin-models', auth, SettingsController.getBuiltinModelsConfig);
// router.put('/builtin-models', [
//     auth,
//     body().isObject().withMessage('请求体必须是JSON对象')
// ], SettingsController.updateBuiltinModelsConfig);

module.exports = router;