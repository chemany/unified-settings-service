const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const auth = require('../middleware/auth');

// Load default models config
const defaultModelsPath = path.join(__dirname, '../../config/default-models.json');
let defaultModels = {};

function loadDefaultModels() {
    try {
        if (fs.existsSync(defaultModelsPath)) {
            const data = fs.readFileSync(defaultModelsPath, 'utf8');
            defaultModels = JSON.parse(data);
            console.log('Default models loaded:', Object.keys(defaultModels));
        }
    } catch (error) {
        console.error('Failed to load default models:', error);
    }
}

// Initial load
loadDefaultModels();

function extractImagePayload(rawContent) {
    let content = rawContent;
    if (Array.isArray(content)) {
        content = content
            .map(part => {
                if (!part || typeof part !== 'object') return '';
                if (part.type === 'text') return part.text || '';
                if (part.type === 'image_url' && part.image_url && part.image_url.url) {
                    return JSON.stringify(part);
                }
                return '';
            })
            .filter(Boolean)
            .join('\n');
    }
    if (content == null) {
        return null;
    }
    if (typeof content !== 'string') {
        content = String(content);
    }

    const dataUrlMatch = content.match(/data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)/);
    if (dataUrlMatch) {
        return {
            imageUrl: `data:${dataUrlMatch[1]};base64,${dataUrlMatch[2]}`,
            mimeType: dataUrlMatch[1]
        };
    }

    const markdownUrlMatch = content.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/);
    if (markdownUrlMatch) {
        return {
            imageUrl: markdownUrlMatch[1],
            mimeType: 'image/png'
        };
    }

    try {
        const parsed = JSON.parse(content);
        const nestedImageUrl = parsed && parsed.image_url && parsed.image_url.url
            ? parsed.image_url.url
            : parsed && parsed.url
                ? parsed.url
                : '';
        if (nestedImageUrl) {
            return {
                imageUrl: nestedImageUrl,
                mimeType: nestedImageUrl.startsWith('data:image/')
                    ? nestedImageUrl.slice(5, nestedImageUrl.indexOf(';'))
                    : 'image/png'
            };
        }
    } catch (error) {}

    const compact = content.replace(/\s+/g, '');
    if (/^[A-Za-z0-9+/=]+$/.test(compact) && compact.length > 128) {
        return {
            imageUrl: `data:image/png;base64,${compact}`,
            mimeType: 'image/png'
        };
    }

    return null;
}

router.post('/chat', auth, async (req, res) => {
    try {
        const { messages } = req.body;
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ success: false, msg: 'Invalid messages format' });
        }

        // Reload config to ensure freshness
        loadDefaultModels();

        // Determine which model to use
        // Try siyuan model first, then tidelog, then any available builtin model
        let modelConfig = 
            defaultModels['builtin_free_siyuan'] || 
            defaultModels['builtin_free_tidelog'] ||
            Object.values(defaultModels).find(m => m.provider === 'openai') ||
            defaultModels['builtin_free'];

        if (!modelConfig) {
            return res.status(500).json({ success: false, msg: 'Builtin model configuration not found' });
        }

        console.log(`Using model config: ${modelConfig.name} (${modelConfig.model_name})`);

        const normalizedBaseURL = (modelConfig.base_url || '').replace(/\/+$/, '');
        const useResponsesAPI = /\/responses$/i.test(normalizedBaseURL);
        const requestURL = useResponsesAPI ? normalizedBaseURL : `${normalizedBaseURL}/chat/completions`;
        const requestBody = useResponsesAPI
            ? {
                model: modelConfig.model_name,
                input: messages.map(m => ({
                    role: m.role || 'user',
                    content: m.content || ''
                })),
                temperature: modelConfig.temperature || 0.7,
                max_output_tokens: modelConfig.max_tokens || 2000,
                ...(modelConfig.top_kwargs || {})
            }
            : {
                model: modelConfig.model_name,
                messages: messages,
                temperature: modelConfig.temperature || 0.7,
                max_tokens: modelConfig.max_tokens || 2000,
                ...(modelConfig.top_kwargs || {})
            };

        const response = await axios.post(requestURL, requestBody, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${modelConfig.api_key}`,
                'HTTP-Referer': 'https://siyuan-note.com',
                'X-Title': 'SiYuan Note'
            }
        });

        const content = useResponsesAPI
            ? (response.data.output || [])
                .flatMap(item => item.content || [])
                .filter(part => part.type === 'output_text')
                .map(part => part.text)
                .filter(Boolean)
                .join('\n')
            : (response.data.choices?.[0]?.message?.content || '');

        res.json({
            code: 0, // Siyuan expects code 0 for success
            msg: '',
            data: {
                content: content,
                message: content // Fallback
            }
        });

    } catch (error) {
        console.error('AI Chat Error:', error.response?.data || error.message);
        const errorMsg = error.response?.data?.error?.message || error.message || 'Unknown error';
        res.status(500).json({ code: -1, msg: errorMsg });
    }
});

router.post('/image-generate', auth, async (req, res) => {
    try {
        const prompt = typeof req.body.prompt === 'string' ? req.body.prompt.trim() : '';
        const size = typeof req.body.size === 'string' && req.body.size.trim() ? req.body.size.trim() : '1024x1024';
        const referenceImages = Array.isArray(req.body.referenceImages) ? req.body.referenceImages : [];
        const history = Array.isArray(req.body.history) ? req.body.history : [];

        if (!prompt) {
            return res.status(400).json({ error: 'prompt 不能为空' });
        }

        loadDefaultModels();

        const imageModelConfig = defaultModels['builtin_ai_image'];
        if (!imageModelConfig) {
            return res.status(500).json({ error: 'AI绘图模型配置未找到' });
        }

        const apiKey = process.env.GPTIMAGE2_API_KEY || imageModelConfig.api_key;
        if (!apiKey) {
            return res.status(500).json({ error: 'AI绘图API密钥未配置' });
        }

        const content = [{
            type: 'text',
            text: [
                history.length ? '历史上下文：' + history.map(item => {
                    if (!item || typeof item !== 'object') return '';
                    const itemPrompt = typeof item.prompt === 'string' ? item.prompt.trim() : '';
                    return itemPrompt;
                }).filter(Boolean).join(' | ') : '',
                prompt,
                `图片尺寸：${size}`
            ].filter(Boolean).join('\n\n')
        }];

        referenceImages.forEach((ref) => {
            if (typeof ref === 'string' && ref.trim()) {
                content.push({
                    type: 'image_url',
                    image_url: {
                        url: ref.trim(),
                        detail: 'high'
                    }
                });
            }
        });

        history.forEach((item) => {
            if (!item || typeof item !== 'object') return;
            const imageUrl = typeof item.imageUrl === 'string' ? item.imageUrl.trim() : '';
            if (imageUrl) {
                content.push({
                    type: 'image_url',
                    image_url: {
                        url: imageUrl,
                        detail: 'high'
                    }
                });
            }
        });

        const normalizedBaseURL = (imageModelConfig.base_url || '').replace(/\/+$/, '');
        const requestURL = `${normalizedBaseURL}/chat/completions`;

        const response = await axios.post(
            requestURL,
            {
                model: imageModelConfig.model_name,
                messages: [
                    {
                        role: 'user',
                        content
                    }
                ],
                max_tokens: imageModelConfig.max_tokens || 4096
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                timeout: 600000
            }
        );

        const upstreamContent = response.data &&
            response.data.choices &&
            response.data.choices[0] &&
            response.data.choices[0].message
            ? response.data.choices[0].message.content
            : '';
        const imagePayload = extractImagePayload(upstreamContent);

        if (!imagePayload) {
            return res.status(502).json({ error: '未能从上游响应中提取图片' });
        }

        res.json({
            success: true,
            data: imagePayload
        });
    } catch (error) {
        console.error('AI Image Generate Error:', error.response?.data || error.message);
        const errorMsg = error.response?.data?.error?.message || error.message || 'Unknown error';
        res.status(500).json({ error: errorMsg });
    }
});

module.exports = router;
