---
name: tencent-cos-upload
description: 上传文件到腾讯云对象存储(COS)并生成可访问的链接。当用户需要发送文件、分享文件或需要生成文件URL时使用此Skill。支持大文件分片上传。
license: MIT
metadata:
  author: user
  version: "1.0.0"
---

# 腾讯云COS文件上传

## 功能
将本地文件上传到腾讯云COS，返回可公开访问的URL。

## 使用方法

```bash
node scripts/upload.js <本地文件路径> [对象键名]
```

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

## 使用场景
- BOT聊天中需要发送文件时，先上传文件到COS，然后在消息中加入可访问的链接
- 需要分享临时文件链接给其他人
- 需要长期存储文件并获取稳定URL
