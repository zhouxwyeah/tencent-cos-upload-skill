---
name: tencent-cos-upload
description: 上传文件到腾讯云对象存储(COS)并生成可访问的链接。智能选择上传方式，支持配置文件管理。当用户需要发送文件、分享文件或需要生成文件URL时使用此Skill。支持大文件分片上传。
license: MIT
metadata:
  author: user
  version: "1.0.2"
---

# 腾讯云COS文件上传

## 功能
将本地文件上传到腾讯云COS，返回可公开访问的URL。

**智能特性**:
- 自动选择上传方式（小文件用轻量版，大文件用完整版）
- 大文件自动安装依赖
- 支持配置文件管理（LLM 可自动写入配置）

## 使用方法

### 推荐：智能版

```bash
node scripts/upload-smart.js <本地文件路径> [对象键名]
```

智能策略：
- 文件 ≤100MB：使用轻量版（无需依赖）
- 文件 >100MB：检查环境，如未就绪自动安装依赖

### 配置管理

```bash
# 查看当前配置
node scripts/upload-smart.js config show

# 设置配置（LLM 可自动执行）
node scripts/upload-smart.js config set \
  --secret-id <your-secret-id> \
  --secret-key <your-secret-key> \
  --bucket <bucket-name> \
  --region <region>
```

配置优先级：命令行参数 > 环境变量 > 配置文件 (~/.cosrc)

## 参数
- `本地文件路径`: 要上传的本地文件完整路径（必需）
- `对象键名`（可选）: 存储在COS上的文件名，默认为原文件名

## 环境变量配置
使用前需设置以下环境变量：
- `TENCENT_COS_SECRET_ID`: 腾讯云SecretId
- `TENCENT_COS_SECRET_KEY`: 腾讯云SecretKey
- `TENCENT_COS_BUCKET`: 存储桶名称
- `TENCENT_COS_REGION`: 存储桶地域（如 ap-guangzhou）

## 返回值
上传成功后返回JSON格式：
```json
{
  "success": true,
  "url": "https://bucket.cos.region.myqcloud.com/file.jpg",
  "key": "file.jpg"
}
```

## LLM 使用指南

当用户需要上传文件时，按以下步骤执行：

### 1. 检查现有配置
```bash
node scripts/upload-smart.js config show
```

### 2. 如无配置，询问用户并设置
```bash
node scripts/upload-smart.js config set \
  --secret-id <用户提供> \
  --secret-key <用户提供> \
  --bucket <用户提供> \
  --region <用户提供>
```

### 3. 执行上传（智能版会自动处理大小文件）
```bash
node scripts/upload-smart.js <文件路径> [对象键名]
```

### 注意事项
- 配置会保存到 `~/.cosrc`，下次无需重复设置
- 文件 >100MB 时，如环境未就绪，会自动尝试安装依赖
- 上传成功后返回的 URL 可直接在对话中使用

## 使用场景
- BOT聊天中需要发送文件时，先上传文件到COS，然后在消息中加入可访问的链接
- 需要分享临时文件链接给其他人
- 需要长期存储文件并获取稳定URL
- 在对话中分享图片、文档、压缩包等文件
