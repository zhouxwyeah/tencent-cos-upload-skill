#!/usr/bin/env node
/**
 * 腾讯云COS文件上传脚本
 * 用法: node upload.js <本地文件路径> [对象键名] [选项]
 *
 * 选项:
 *   --secret-id <id>      腾讯云SecretId
 *   --secret-key <key>    腾讯云SecretKey
 *   --region <region>     存储桶地域
 *   --bucket <bucket>     存储桶名称
 *
 * 也可通过环境变量配置:
 *   TENCENT_COS_SECRET_ID, TENCENT_COS_SECRET_KEY,
 *   TENCENT_COS_BUCKET, TENCENT_COS_REGION
 */

const fs = require('fs');
const path = require('path');
const COS = require('cos-nodejs-sdk-v5');

function parseArgs(argv) {
  const args = {
    positional: [],
    options: {}
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--secret-id' || arg === '--secret-key' || arg === '--region' || arg === '--bucket') {
      args.options[arg.replace('--', '').replace(/-/g, '_')] = argv[++i];
    } else if (!arg.startsWith('--')) {
      args.positional.push(arg);
    }
  }

  return args;
}

async function uploadFile(localPath, key, options = {}) {
  // 获取配置（优先命令行参数，其次环境变量）
  const secretId = options.secret_id || process.env.TENCENT_COS_SECRET_ID;
  const secretKey = options.secret_key || process.env.TENCENT_COS_SECRET_KEY;
  const bucket = options.bucket || process.env.TENCENT_COS_BUCKET;
  const region = options.region || process.env.TENCENT_COS_REGION;

  // 验证配置
  if (!secretId || !secretKey || !bucket || !region) {
    const missing = [];
    if (!secretId) missing.push('secret-id');
    if (!secretKey) missing.push('secret-key');
    if (!bucket) missing.push('bucket');
    if (!region) missing.push('region');
    return {
      success: false,
      error: `缺少必要的配置参数: ${missing.join(', ')}。请通过命令行参数或环境变量提供。`
    };
  }

  // 检查本地文件
  if (!fs.existsSync(localPath)) {
    return {
      success: false,
      error: `文件不存在: ${localPath}`
    };
  }

  const stats = fs.statSync(localPath);
  if (stats.isDirectory()) {
    return {
      success: false,
      error: `不支持上传目录: ${localPath}`
    };
  }

  // 生成对象键名
  if (!key) {
    key = path.basename(localPath);
  }

  // 初始化COS客户端
  const cos = new COS({
    SecretId: secretId,
    SecretKey: secretKey,
  });

  try {
    // 上传文件（自动分片）
    const result = await cos.uploadFile({
      Bucket: bucket,
      Region: region,
      Key: key,
      FilePath: localPath,
      SliceSize: 1024 * 1024 * 2, // 2MB分片
      onTaskReady: (taskId) => {
        console.error(`[INFO] 上传任务ID: ${taskId}`);
      },
      onProgress: (progressData) => {
        const percent = Math.round(progressData.percent * 100);
        const loaded = (progressData.loaded / 1024 / 1024).toFixed(2);
        const total = (progressData.total / 1024 / 1024).toFixed(2);
        console.error(`[PROGRESS] 上传进度: ${percent}% (${loaded}MB / ${total}MB)`);
      }
    });

    // 生成访问URL
    const url = `https://${bucket}.cos.${region}.myqcloud.com/${key}`;

    return {
      success: true,
      url: url,
      key: key,
      etag: result.ETag,
      location: result.Location || url
    };
  } catch (err) {
    return {
      success: false,
      error: err.message || err.toString(),
      code: err.code || err.statusCode
    };
  }
}

// 主函数
async function main() {
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.positional.length < 1) {
    console.error(`用法: node upload.js <本地文件路径> [对象键名] [选项]

选项:
  --secret-id <id>      腾讯云SecretId
  --secret-key <key>    腾讯云SecretKey
  --region <region>     存储桶地域
  --bucket <bucket>     存储桶名称

环境变量:
  TENCENT_COS_SECRET_ID, TENCENT_COS_SECRET_KEY,
  TENCENT_COS_BUCKET, TENCENT_COS_REGION`);
    process.exit(1);
  }

  const localPath = parsed.positional[0];
  const key = parsed.positional[1];

  const result = await uploadFile(localPath, key, parsed.options);
  console.log(JSON.stringify(result, null, 2));

  process.exit(result.success ? 0 : 1);
}

main().catch(err => {
  console.error(JSON.stringify({ success: false, error: err.message }, null, 2));
  process.exit(1);
});
