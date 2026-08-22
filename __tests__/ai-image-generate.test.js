const express = require('express');
const request = require('supertest');
const axios = require('axios');

jest.mock('axios');
jest.mock('../src/middleware/auth', () => {
    return (req, res, next) => {
        const authHeader = req.headers.authorization || '';
        if (authHeader !== 'Bearer valid-token') {
            return res.status(401).json({ error: '访问被拒绝，未提供令牌' });
        }
        req.user = {
            id: 'test-user',
            email: 'test@example.com',
            username: 'testuser',
            role: 'user'
        };
        next();
    };
});

const aiRoutes = require('../src/routes/ai');

function createApp() {
    const app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use('/api/ai', aiRoutes);
    return app;
}

describe('POST /api/ai/image-generate', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('未登录时返回 401', async () => {
        const app = createApp();
        const response = await request(app)
            .post('/api/ai/image-generate')
            .send({ prompt: '画一张蒸馏塔流程图海报' });

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('访问被拒绝，未提供令牌');
    });

    test('prompt 为空时返回 400', async () => {
        const app = createApp();
        const response = await request(app)
            .post('/api/ai/image-generate')
            .set('Authorization', 'Bearer valid-token')
            .send({ prompt: '   ' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('prompt 不能为空');
    });

    test('成功时返回提取后的图片地址', async () => {
        axios.post.mockResolvedValue({
            data: {
                choices: [
                    {
                        message: {
                            content: '![generated](https://cdn.example.com/generated-image.png)'
                        }
                    }
                ]
            }
        });

        const app = createApp();
        const response = await request(app)
            .post('/api/ai/image-generate')
            .set('Authorization', 'Bearer valid-token')
            .send({
                prompt: '生成一张蓝图风格的化工厂总览图',
                size: '1024x1024'
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.imageUrl).toBe('https://cdn.example.com/generated-image.png');
        expect(response.body.data.mimeType).toBe('image/png');
        expect(axios.post).toHaveBeenCalledTimes(1);
    });

    test('支持参考图和历史上下文连续生成', async () => {
        axios.post.mockResolvedValue({
            data: {
                choices: [
                    {
                        message: {
                            content: '![generated](https://cdn.example.com/updated-image.png)'
                        }
                    }
                ]
            }
        });

        const app = createApp();
        const response = await request(app)
            .post('/api/ai/image-generate')
            .set('Authorization', 'Bearer valid-token')
            .send({
                prompt: '在上一张基础上增强管廊和蒸汽效果',
                size: '1536x1024',
                referenceImages: [
                    'data:image/png;base64,AAAA'
                ],
                history: [
                    {
                        prompt: '生成一张蓝图风格的化工厂总览图',
                        imageUrl: 'https://cdn.example.com/generated-image.png'
                    }
                ]
            });

        expect(response.status).toBe(200);
        expect(response.body.data.imageUrl).toBe('https://cdn.example.com/updated-image.png');
        expect(axios.post).toHaveBeenCalledTimes(1);

        const requestBody = axios.post.mock.calls[0][1];
        expect(requestBody.messages[0].content[0].text).toContain('历史上下文');
        expect(requestBody.messages[0].content[0].text).toContain('生成一张蓝图风格的化工厂总览图');
        expect(requestBody.messages[0].content[0].text).toContain('在上一张基础上增强管廊和蒸汽效果');
        expect(requestBody.messages[0].content[1].type).toBe('image_url');
        expect(requestBody.messages[0].content[1].image_url.url).toBe('data:image/png;base64,AAAA');
        expect(requestBody.messages[0].content[2].type).toBe('image_url');
        expect(requestBody.messages[0].content[2].image_url.url).toBe('https://cdn.example.com/generated-image.png');
    });

    test('上游错误时返回 500', async () => {
        axios.post.mockRejectedValue({
            response: {
                data: {
                    error: {
                        message: 'upstream failed'
                    }
                }
            }
        });

        const app = createApp();
        const response = await request(app)
            .post('/api/ai/image-generate')
            .set('Authorization', 'Bearer valid-token')
            .send({ prompt: '生成一张精细化工装置宣传图' });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('upstream failed');
    });
});
