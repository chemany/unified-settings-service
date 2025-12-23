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

router.post('/chat', auth, async (req, res) => {
    try {
        const { messages } = req.body;
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ success: false, msg: 'Invalid messages format' });
        }

        // Reload config to ensure freshness
        loadDefaultModels();

        // Determine which model to use
        // Use 'builtin_free_neuralink' as default
        let modelConfig = defaultModels['builtin_free_neuralink'] || defaultModels['builtin_free'];

        if (!modelConfig) {
            return res.status(500).json({ success: false, msg: 'Builtin model configuration not found' });
        }

        console.log(`Using model config: ${modelConfig.name} (${modelConfig.model_name})`);

        const response = await axios.post(`${modelConfig.base_url}/chat/completions`, {
            model: modelConfig.model_name,
            messages: messages,
            temperature: modelConfig.temperature || 0.7,
            max_tokens: modelConfig.max_tokens || 2000
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${modelConfig.api_key}`,
                'HTTP-Referer': 'https://siyuan-note.com',
                'X-Title': 'SiYuan Note'
            }
        });

        const content = response.data.choices?.[0]?.message?.content || '';

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

module.exports = router;
