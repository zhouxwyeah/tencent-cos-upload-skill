#!/usr/bin/env node
/**
 * 腾讯云COS文件上传脚本 (轻量版，无外部依赖)
 * 用法: node upload-lite.js <本地文件路径> [对象键名] [选项]
 *
 * 特点:
 *   - 使用 Node.js 原生模块 (https, crypto, fs)
 *   - 无 npm install 依赖
 *   - 支持小文件直传（不支持分片）
 *
 * 选项:
 *   --secret-id <id>      腾讯云SecretId
 *   --secret-key <key>    腾讯云SecretKey
 *   --region <region>     存储桶地域
 *   --bucket <bucket>     存储桶名称
 */

const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const COS_HOST = 'myqcloud.com';

/**
 * 解析命令行参数
 */
function parseArgs(argv) {
  const args = { positional: [], options: {} };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--secret-id' || arg === '--secret-key' || arg === '--region' || arg === '--bucket') {
      if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) {
        console.error(`[ERROR] 选项 ${arg} 需要提供一个值`);
        process.exit(1);
      }
      args.options[arg.replace('--', '').replace(/-/g, '_')] = argv[++i];
    } else if (!arg.startsWith('--')) {
      args.positional.push(arg);
    }
  }
  return args;
}

/**
 * 生成 COS 签名（Key 授权）
 * 使用简单签名方式，适用于临时上传
 */
function generateSignature(secretId, secretKey, bucket, region, key, httpMethod = 'PUT', expireSeconds = 3600) {
  const now = Math.floor(Date.now() / 1000);
  const expired = now + expireSeconds;

  // KeyTime: 签名有效期
  const keyTime = `${now};${expired}`;

  // SignKey: HMAC-SHA1(SecretKey, KeyTime)
  const signKey = crypto.createHmac('sha1', secretKey).update(keyTime).digest('hex');

  // HttpString: HTTP Method + URI + HttpHeaders + HttpParameters
  const httpString = [
    httpMethod.toLowerCase(),           // http method
    '/' + key,                          // uri (需要以 / 开头)
    '',                                 // http headers (简化，不传)
    ''                                  // http parameters (简化，不传)
  ].join('\n');

  // StringToSign: sha1(HttpString)
  const stringToSign = crypto.createHash('sha1').update(httpString).digest('hex');

  // Signature: HMAC-SHA1(SignKey, StringToSign)
  const signature = crypto.createHmac('sha1', signKey).update(stringToSign).digest('hex');

  // 构造签名查询参数（腾讯云参数名包含空格，需使用方括号语法）
  const queryParams = new URLSearchParams();
  queryParams.append('q-ak', secretId);
  queryParams.append('q-sign-algorithm', 'sha1');
  queryParams.append('q-sign-time', keyTime);
  queryParams.append('q-key-time', keyTime);
  queryParams.append('q-header-list', '');
  queryParams.append('q-url-param-list', '');
  queryParams.append('q-signature', signature);

  return queryParams.toString();
}

/**
 * 上传文件到 COS（简单 PUT 方式，不分片）
 */
async function uploadFile(localPath, key, options = {}) {
  // 获取配置
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
    return { success: false, error: `缺少必要的配置参数: ${missing.join(', ')}` };
  }

  // 检查本地文件
  if (!fs.existsSync(localPath)) {
    return { success: false, error: `文件不存在: ${localPath}` };
  }

  const stats = fs.statSync(localPath);
  if (stats.isDirectory()) {
    return { success: false, error: `不支持上传目录: ${localPath}` };
  }

  // 文件大小检查（轻量版建议 100MB 以下）
  const maxSize = 100 * 1024 * 1024; // 100MB
  if (stats.size > maxSize) {
    return {
      success: false,
      error: `文件过大 (${(stats.size / 1024 / 1024).toFixed(2)}MB)，轻量版限制 100MB，请使用完整版 upload.js`
    };
  }

  // 生成对象键名
  if (!key) {
    key = path.basename(localPath);
  }

  // 对 key 进行编码（保留路径分隔符）
  const encodedKey = encodeURIComponent(key).replace(/%2F/g, '/');

  // 读取文件内容
  const fileContent = fs.readFileSync(localPath);
  const contentLength = fileContent.length;

  // 生成签名
  const signatureQuery = generateSignature(secretId, secretKey, bucket, region, key);

  // 构造请求 URL
  const host = `${bucket}.cos.${region}.${COS_HOST}`;
  const urlPath = `/${encodedKey}?${signatureQuery}`;

  // 发送 PUT 请求
  return new Promise((resolve) => {
    const reqOptions = {
      hostname: host,
      port: 443,
      path: urlPath,
      method: 'PUT',
      headers: {
        'Content-Length': contentLength,
        'Content-Type': 'application/octet-stream'
      }
    };

    console.error(`[INFO] 开始上传: ${localPath} (${(contentLength / 1024 / 1024).toFixed(2)}MB)`);

    const req = https.request(reqOptions, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const url = `https://${host}/${encodedKey}`;
          const etag = res.headers.etag || res.headers.ETag;

          resolve({
            success: true,
            url: url,
            key: key,
            etag: etag,
            size: contentLength
          });
        } else {
          resolve({
            success: false,
            error: `上传失败: HTTP ${res.statusCode}`,
            code: res.statusCode,
            details: responseData
          });
        }
      });
    });

    req.on('error', (err) => {
      resolve({
        success: false,
        error: `请求错误: ${err.message}`
      });
    });

    // 写入文件内容
    req.write(fileContent);
    req.end();
  });
}

// 主函数
async function main() {
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.positional.length < 1) {
    console.error(`用法: node upload-lite.js <本地文件路径> [对象键名] [选项]

选项:
  --secret-id <id>      腾讯云SecretId
  --secret-key <key>    腾讯云SecretKey
  --region <region>     存储桶地域
  --bucket <bucket>     存储桶名称

环境变量:
  TENCENT_COS_SECRET_ID, TENCENT_COS_SECRET_KEY,
  TENCENT_COS_BUCKET, TENCENT_COS_REGION

限制:
  - 单文件最大 100MB（不分片）
  - 如需大文件分片，请使用 upload.js`);
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
