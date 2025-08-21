/**
 * 基于JSON文件的设置路由
 */

const express = require('express');
const router = express.Router();
const FileSettingsController = require('../controllers/FileSettingsController');
const authMiddleware = require('../middleware/auth');

// 所有路由都需要认证
router.use(authMiddleware);

/**
 * LLM设置相关路由
 */
// 获取LLM设置
router.get('/llm', FileSettingsController.getLlmSettings);

// 保存LLM设置
router.post('/llm', FileSettingsController.saveLlmSettings);

/**
 * 日历设置相关路由
 */
// 获取日历设置
router.get('/calendar', FileSettingsController.getCalendarSettings);

// 保存日历设置
router.post('/calendar', FileSettingsController.saveCalendarSettings);

/**
 * IMAP设置相关路由
 */
// 获取IMAP设置
router.get('/imap', FileSettingsController.getImapSettings);

// 保存IMAP设置
router.post('/imap', FileSettingsController.saveImapSettings);

/**
 * Exchange设置相关路由
 */
// 获取Exchange设置
router.get('/exchange', FileSettingsController.getExchangeSettings);

// 保存Exchange设置
router.post('/exchange', FileSettingsController.saveExchangeSettings);

/**
 * CalDAV设置相关路由
 */
// 获取CalDAV设置
router.get('/caldav', FileSettingsController.getCalDAVSettings);

// 保存CalDAV设置
router.post('/caldav', FileSettingsController.saveCalDAVSettings);

/**
 * 默认配置相关路由
 */
// 获取默认免费模型配置
router.get('/default-models', FileSettingsController.getDefaultModels);

/**
 * Embedding设置相关路由
 */
// 获取Embedding设置
router.get('/embedding', FileSettingsController.getEmbeddingSettings);

// 保存Embedding设置
router.post('/embedding', FileSettingsController.saveEmbeddingSettings);

/**
 * Reranking设置相关路由
 */
// 获取Reranking设置
router.get('/reranking', FileSettingsController.getRerankingSettings);

// 保存Reranking设置
router.post('/reranking', FileSettingsController.saveRerankingSettings);

/**
 * 用户管理相关路由
 */
// 获取用户设置概览
router.get('/overview', FileSettingsController.getUserOverview);

// 重置用户设置
router.delete('/reset', FileSettingsController.resetUserSettings);

/**
 * 管理员路由（可选）
 */
// 获取所有用户列表
router.get('/admin/users', FileSettingsController.getAllUsers);

module.exports = router; 