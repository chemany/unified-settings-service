async function testOpenRouter() {
    const fetch = (await import('node-fetch')).default;
    console.log('Testing OpenRouter API...');

    const apiKey = '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';
    const baseUrl = 'https://openrouter.ai/api/v1';

    // 尝试几个免费模型
    const models = [
        'x-ai/grok-beta',
        'google/gemini-flash-1.5',
        'meta-llama/llama-3.2-3b-instruct:free',
        'nousresearch/hermes-3-llama-3.1-405b:free',
        'qwen/qwen-2-7b-instruct:free'
    ];

    for (const model of models) {
        console.log(`\n--- Testing model: ${model} ---`);
        try {
            const response = await fetch(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': 'https://siyuan-note.com',
                    'X-Title': 'SiYuan Note'
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'user', content: '你好，请用中文回答：1+1=?' }
                    ],
                    temperature: 0.7,
                    max_tokens: 100
                })
            });

            const status = response.status;
            const text = await response.text();

            if (response.ok) {
                const data = JSON.parse(text);
                console.log(`✓ SUCCESS: ${data.choices[0].message.content}`);
            } else {
                console.log(`✗ FAILED (${status}): ${text.substring(0, 200)}`);
            }
        } catch (error) {
            console.log(`✗ ERROR: ${error.message}`);
        }
    }
}

testOpenRouter().catch(console.error);
