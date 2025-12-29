# 会议纪要服务配置说明

本文档说明如何配置会议纪要功能所需的 vLLM 和 FunASR 服务。

## 配置文件位置

所有配置文件位于：`/home/jason/code/unified-settings-service/config/`

## 1. vLLM 配置

### 配置文件
`default-models.json`

### 配置格式
```json
{
  "builtin_free_siyuan": {
    "name": "本地 VLLM 增强模型",
    "provider": "openai",
    "api_key": "vllm-token",
    "base_url": "http://jason.cheman.top:8001/v1",
    "model_name": "tclf90/Qwen3-32B-GPTQ-Int4",
    "temperature": 0.7,
    "max_tokens": 4000,
    "description": "基于双 V100 部署的本地化 Qwen3-32B 模型 (via jason.cheman.top)",
    "version": "2.0.5",
    "last_updated": "2025-12-22T10:00:00.000Z",
    "features": [
      "知识图谱",
      "智能摘要",
      "概念关联",
      "文档分析"
    ],
    "system_prompt": "你是思源笔记的AI助手，专门帮助用户整理知识、建立概念关联和生成智能摘要。"
  }
}
```

### 配置参数说明

| 参数 | 说明 | 示例 |
|------|------|--------|
| `name` | 模型显示名称 | "本地 VLLM 增强模型" |
| `provider` | 提供商类型 | "openai" |
| `api_key` | API 密钥（vLLM 通常不需要） | "vllm-token" |
| `base_url` | vLLM 服务地址（注意：会自动移除末尾的 `/v1`） | "http://jason.cheman.top:8001/v1" |
| `model_name` | 模型名称 | "tclf90/Qwen3-32B-GPTQ-Int4" |
| `temperature` | 温度参数（0-1，越高越随机） | 0.7 |
| `max_tokens` | 最大生成 token 数 | 4000 |
| `description` | 模型描述 | "基于双 V100 部署的本地化 Qwen3-32B 模型" |
| `system_prompt` | 系统提示词 | "你是思源笔记的AI助手..." |

### 部署 vLLM 服务

如果还没有部署 vLLM 服务，可以使用以下命令部署 Qwen3-32B 模型：

```bash
# 使用 vLLM 部署 Qwen3-32B
docker run --gpus all \
  -p 8000:8000 \
  -v /data/models:/models \
  vllm/vllm-openai:latest \
  --model /models/Qwen3-32B-GPTQ-Int4 \
  --host 0.0.0.0 \
  --port 8000
```

或者使用 Python 直接部署：

```bash
pip install vllm

python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen2-72B-Instruct \
  --host 0.0.0.0 \
  --port 8000
```

## 2. FunASR 配置

### 配置文件
`asr-config.json`

### 配置格式
```json
{
  "endpoint": "http://localhost:10086",
  "timeout": 30,
  "language": "zh",
  "description": "FunASR 语音识别服务配置",
  "version": "1.0.0",
  "last_updated": "2025-12-24T10:00:00.000Z"
}
```

### 配置参数说明

| 参数 | 说明 | 示例 |
|------|------|--------|
| `endpoint` | FunASR 服务地址 | "http://localhost:10086" |
| `timeout` | 请求超时时间（秒） | 30 |
| `language` | 识别语言 | "zh" (中文), "en" (英文) |
| `description` | 配置描述 | "FunASR 语音识别服务配置" |

### 部署 FunASR 服务

FunASR 是阿里巴巴开源的语音识别服务，可以使用以下方式部署：

#### 方式 1：使用 Docker 部署

```bash
docker run -d \
  --name funasr \
  -p 10086:10086 \
  funasr/funasr:latest
```

#### 方式 2：使用 Python 部署

```bash
# 克隆 FunASR 仓库
git clone https://github.com/alibaba-damo-academy/FunASR.git
cd FunASR

# 安装依赖
pip install -r requirements.txt

# 启动服务
python funasr/wsgi.py
```

#### 方式 3：使用模型推理服务

FunASR 也支持直接调用模型进行推理，需要配置模型路径：

```bash
# 下载预训练模型
wget https://modelscope.cn/datasets/speech_paraformer_asr_nat-zh-cn-16k-common-vocab8404-pytorch/resolve/master/speech_paraformer_asr_nat-zh-cn-16k-common-vocab8404-pytorch.tar.gz

# 解压模型
tar -xzf speech_paraformer_asr_nat-zh-cn-16k-common-vocab8404-pytorch.tar.gz

# 启动推理服务
python -m funasr.bin.asr_inference_launch \
  --model-dir ./speech_paraformer_asr_nat-zh-cn-16k-common-vocab8404-pytorch \
  --port 10086
```

### FunASR API 接口

会议纪要功能使用 FunASR 的 `/transcribe` 接口：

**请求：**
- 方法：POST
- Content-Type：multipart/form-data
- 参数：
  - `audio`: 音频文件（支持 webm, wav, mp3 等格式）
  - `language`: 语言代码（zh, en 等）

**响应：**
```json
{
  "text": "识别到的文本内容",
  "confidence": 0.95,
  "duration": 120.5,
  "err_no": 0,
  "err_msg": ""
}
```

## 3. 会议纪要功能配置总结

### 完整配置示例

**vLLM 配置** (`default-models.json`)：
```json
{
  "builtin_free_siyuan": {
    "name": "本地 VLLM 增强模型",
    "provider": "openai",
    "api_key": "vllm-token",
    "base_url": "http://jason.cheman.top:8001/v1",
    "model_name": "tclf90/Qwen3-32B-GPTQ-Int4",
    "temperature": 0.7,
    "max_tokens": 4000,
    "description": "基于双 V100 部署的本地化 Qwen3-32B 模型 (via jason.cheman.top)",
    "version": "2.0.5",
    "last_updated": "2025-12-22T10:00:00.000Z",
    "features": ["知识图谱", "智能摘要", "概念关联", "文档分析"],
    "system_prompt": "你是思源笔记的AI助手，专门帮助用户整理知识、建立概念关联和生成智能摘要。"
  }
}
```

**FunASR 配置** (`asr-config.json`)：
```json
{
  "endpoint": "http://localhost:10086",
  "timeout": 30,
  "language": "zh",
  "description": "FunASR 语音识别服务配置",
  "version": "1.0.0",
  "last_updated": "2025-12-24T10:00:00.000Z"
}
```

### 服务启动顺序

1. 启动 vLLM 服务（端口 8000 或 8001）
2. 启动 FunASR 服务（端口 10086）
3. 配置 `default-models.json` 和 `asr-config.json`
4. 重启 NeuraLink-Notes 服务

### 验证服务

验证 vLLM 服务：
```bash
curl http://localhost:8000/v1/models
```

验证 FunASR 服务：
```bash
curl -X POST http://localhost:10086/transcribe \
  -F "audio=@test.wav" \
  -F "language=zh"
```

## 4. 常见问题

### Q: vLLM 服务启动失败？
A: 检查：
- GPU 是否可用（`nvidia-smi`）
- 端口是否被占用（`lsof -i :8000`）
- 模型文件是否存在

### Q: FunASR 识别不准确？
A: 尝试：
- 使用更高质量的音频输入
- 调整 `language` 参数
- 检查音频采样率（推荐 16kHz）

### Q: 会议纪要没有生成？
A: 检查：
- 服务日志：`pm2 logs siyuan-kernel`
- 配置文件路径是否正确
- 网络连接是否正常

## 5. 参考资料

- [vLLM 官方文档](https://docs.vllm.ai/)
- [FunASR GitHub 仓库](https://github.com/alibaba-damo-academy/FunASR)
- [Qwen 模型](https://github.com/QwenLM/Qwen)
