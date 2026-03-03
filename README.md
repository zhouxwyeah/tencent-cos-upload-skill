# 腾讯云COS上传 Skill

将本地文件上传到腾讯云对象存储(COS)并生成可访问的链接。

## 版本选择

本项目提供三个版本：

| 版本 | 文件 | 依赖 | 特点 | 适用场景 |
|------|------|------|------|----------|
| **智能版** ⭐ | `upload-smart.js` | 可选 | 自动选择上传方式，支持配置管理 | 推荐使用 |
| **轻量版** | `upload-lite.js` | 无 | 零依赖，单文件可运行 | 快速部署、CI/CD |
| **完整版** | `upload.js` | SDK | 支持大文件分片上传 | 大文件、生产环境 |

### 智能版特点

- **自动选择**: 文件 ≤100MB 使用轻量版，>100MB 检查环境并自动安装依赖
- **配置管理**: 支持配置文件（`~/.cosrc` 或 `./.cosrc`），LLM 可自动写入配置
- **多源配置**: 命令行参数 > 环境变量 > 配置文件

## 快速开始

### 智能版（推荐）

```bash
# 无需安装依赖，开箱即用
node scripts/upload-smart.js ./photo.jpg

# 大文件自动处理（如环境不就绪，会自动安装依赖）
node scripts/upload-smart.js ./large-video.zip
```

### 项目结构

```
.
├── scripts/
│   ├── upload.js           # 完整版（SDK，支持分片）
│   ├── upload-lite.js      # 轻量版（零依赖，100MB限制）
│   └── upload-smart.js     # 智能版（自动选择，推荐）⭐
├── package.json
├── README.md
└── SKILL.md                # LLM Skill 描述文件
```

## 安装

### 轻量版（推荐快速开始）

无需安装，直接使用：

```bash
node scripts/upload-lite.js <本地文件路径> [对象键名] [选项]
```

**限制**: 单文件最大 100MB（不分片上传）

### 完整版（支持大文件）

```bash
npm install
node scripts/upload.js <本地文件路径> [对象键名] [选项]
```

## 使用方法

### 智能版（推荐）

```bash
# 基本使用（自动选择上传方式）
node scripts/upload-smart.js <本地文件路径> [对象键名]

# 使用命令行参数
node scripts/upload-smart.js ./photo.jpg \
  --secret-id <your-secret-id> \
  --secret-key <your-secret-key> \
  --region <region> \
  --bucket <bucket-name>

# 大文件上传（自动安装依赖）
node scripts/upload-smart.js ./large-file.zip
```

### 配置管理

智能版支持配置文件，优先级：命令行参数 > 环境变量 > 配置文件

```bash
# 查看当前配置
node scripts/upload-smart.js config show

# 设置配置（保存到 ~/.cosrc）
node scripts/upload-smart.js config set \
  --secret-id <your-secret-id> \
  --secret-key <your-secret-key> \
  --region <region> \
  --bucket <bucket-name>

# 使用指定配置文件
node scripts/upload-smart.js ./file.txt --config ./my-config.json
```

配置文件格式（JSON）：
```json
{
  "secret_id": "your-secret-id",
  "secret_key": "your-secret-key",
  "region": "ap-guangzhou",
  "bucket": "your-bucket-name"
}
```

### 方式1: 命令行参数（完整版/轻量版）

```bash
node scripts/upload.js <本地文件路径> [对象键名] \
  --secret-id <your-secret-id> \
  --secret-key <your-secret-key> \
  --region <region> \
  --bucket <bucket-name>
```

### 方式2: 环境变量

```bash
export TENCENT_COS_SECRET_ID=your-secret-id
export TENCENT_COS_SECRET_KEY=your-secret-key
export TENCENT_COS_BUCKET=your-bucket-name
export TENCENT_COS_REGION=ap-guangzhou

node scripts/upload.js <本地文件路径> [对象键名]
```

## 示例

```bash
# 上传单个文件
node scripts/upload.js ./photo.jpg

# 上传到指定目录
node scripts/upload.js ./photo.jpg images/photo.jpg

# 使用环境变量
node scripts/upload.js ./document.pdf
```

## 返回值

成功时返回 JSON:

```json
{
  "success": true,
  "url": "https://bucket.cos.region.myqcloud.com/file.jpg",
  "key": "file.jpg",
  "etag": "\"abc123...\""
}
```

## 配置说明

| 参数 | 说明 | 获取方式 |
|------|------|----------|
| SecretId | 腾讯云 API 密钥 ID | [腾讯云控制台](https://console.cloud.tencent.com/cam/capi) |
| SecretKey | 腾讯云 API 密钥 Key | [腾讯云控制台](https://console.cloud.tencent.com/cam/capi) |
| Bucket | 存储桶名称 | COS 控制台 |
| Region | 存储桶地域 | 如 `ap-guangzhou`, `ap-shanghai` |

## 功能特性

- ✅ **智能版**：自动选择最佳上传方式（小文件用轻量版，大文件用完整版）
- ✅ **配置管理**：支持配置文件（`~/.cosrc`），LLM 可自动读取和写入
- ✅ **大文件支持**：自动分片上传（2MB分片），支持自动安装依赖
- ✅ **多源配置**：命令行参数 > 环境变量 > 配置文件
- ✅ **上传进度显示**：完整版支持实时进度百分比
- ✅ **自定义对象键名**：支持目录前缀（如 `images/photo.jpg`）
- ✅ **零依赖轻量版**：单文件可直接运行，无需 npm install
- ✅ **完整的错误处理**：清晰的错误提示和退出码

## LLM 自动化工作流

智能版 `upload-smart.js` 专为 LLM 自动化设计：

### 标准工作流程

```
用户: 上传这张图片 ./photo.jpg

LLM:
1. 检查配置: node scripts/upload-smart.js config show
2. 如无配置，询问用户 SecretId/SecretKey/Bucket/Region
3. 保存配置: node scripts/upload-smart.js config set --secret-id ...
4. 上传文件: node scripts/upload-smart.js ./photo.jpg
5. 将返回的 URL 提供给用户
```

### 快速参考（LLM 用）

| 任务 | 命令 |
|------|------|
| 检查配置 | `node scripts/upload-smart.js config show` |
| 设置配置 | `node scripts/upload-smart.js config set --secret-id <id> --secret-key <key> --bucket <bucket> --region <region>` |
| 上传文件 | `node scripts/upload-smart.js <文件路径> [对象键名]` |
| 使用特定配置 | `node scripts/upload-smart.js <文件路径> --config ./my-config.json` |

## 许可证

MIT
