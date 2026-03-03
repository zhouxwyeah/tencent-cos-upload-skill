# 腾讯云COS上传 Skill

将本地文件上传到腾讯云对象存储(COS)并生成可访问的链接。

## 安装

```bash
npm install
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
