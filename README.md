# 腾讯云COS上传 Skill

将本地文件上传到腾讯云对象存储(COS)并生成可访问的链接。

## 版本选择

本项目提供两个版本：

| 版本 | 文件 | 依赖 | 特点 | 适用场景 |
|------|------|------|------|----------|
| **轻量版** | `upload-lite.js` | 无 | 零依赖，单文件可运行 | 快速部署、CI/CD |
| **完整版** | `upload.js` | SDK | 支持大文件分片上传 | 大文件、生产环境 |

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

### 方式1: 命令行参数

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

- ✅ 支持大文件自动分片上传（2MB分片）
- ✅ 上传进度显示
- ✅ 自定义对象键名和目录前缀
- ✅ 命令行参数和环境变量两种配置方式
- ✅ 完整的错误处理和提示

## 许可证

MIT
