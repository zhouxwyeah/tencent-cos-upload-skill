#!/usr/bin/env node
/**
 * 腾讯云COS智能上传脚本
 * 自动选择 upload.js 或 upload-lite.js 进行上传
 *
 * 用法: node upload-smart.js <本地文件路径> [对象键名] [选项]
 *
 * 智能策略:
 *   1. 检查文件大小 <= 100MB: 优先使用 lite 版（无依赖）
 *   2. 检查文件大小 > 100MB:
 *      - 环境 READY (有 node_modules): 使用完整版 upload.js
 *      - 环境不 READY: 尝试安装依赖，若失败则提示文件过大
 *
 * 配置优先级: 命令行参数 > 环境变量 > 配置文件
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const CONFIG_FILE_NAME = '.cosrc';
const LITE_SIZE_LIMIT = 100 * 1024 * 1024; // 100MB

/**
 * 解析命令行参数
 */
function parseArgs(argv) {
  const args = { positional: [], options: {} };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--secret-id' || arg === '--secret-key' || arg === '--region' || arg === '--bucket' || arg === '--config') {
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
 * 验证路径是否在允许的目录范围内（防止路径遍历攻击）
 */
function isPathAllowed(targetPath, allowedDirs) {
  const resolved = path.resolve(targetPath);
  return allowedDirs.some(dir => resolved.startsWith(dir));
}

/**
 * 获取配置文件路径（带路径遍历防护）
 */
function getConfigPath(customPath) {
  // 允许的目录：当前工作目录和用户主目录
  const allowedDirs = [process.cwd(), os.homedir()];

  if (customPath) {
    // 验证自定义路径是否在允许范围内
    if (!isPathAllowed(customPath, allowedDirs)) {
      throw new Error(
        `配置文件路径不安全: ${customPath}\n` +
        `只允许使用当前目录 (${process.cwd()}) 或用户主目录 (${os.homedir()}) 下的配置文件`
      );
    }
    return path.resolve(customPath);
  }

  // 优先查找项目目录下的配置文件
  const projectConfig = path.join(process.cwd(), CONFIG_FILE_NAME);
  if (fs.existsSync(projectConfig)) {
    return projectConfig;
  }
  // 其次查找用户主目录
  const homeConfig = path.join(os.homedir(), CONFIG_FILE_NAME);
  if (fs.existsSync(homeConfig)) {
    return homeConfig;
  }
  return null;
}

/**
 * 读取配置文件
 */
function loadConfig(customPath) {
  const configPath = getConfigPath(customPath);
  if (!configPath || !fs.existsSync(configPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(content);
    return { config, path: configPath };
  } catch (err) {
    console.error(`[WARN] 配置文件解析失败: ${err.message}`);
    return null;
  }
}

/**
 * 保存配置到文件
 */
function saveConfig(config, customPath) {
  const configPath = customPath || path.join(os.homedir(), CONFIG_FILE_NAME);

  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    fs.chmodSync(configPath, 0o600); // 设置权限为仅用户可读写
    return { success: true, path: configPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * 获取完整配置（合并多个来源）
 */
function getFullConfig(options = {}) {
  // 1. 读取配置文件
  const configFile = loadConfig(options.config);
  const fileConfig = configFile ? configFile.config : {};

  // 2. 读取环境变量
  const envConfig = {
    secret_id: process.env.TENCENT_COS_SECRET_ID,
    secret_key: process.env.TENCENT_COS_SECRET_KEY,
    bucket: process.env.TENCENT_COS_BUCKET,
    region: process.env.TENCENT_COS_REGION
  };

  // 3. 命令行参数优先级最高
  const mergedConfig = {
    secret_id: options.secret_id || envConfig.secret_id || fileConfig.secret_id,
    secret_key: options.secret_key || envConfig.secret_key || fileConfig.secret_key,
    bucket: options.bucket || envConfig.bucket || fileConfig.bucket,
    region: options.region || envConfig.region || fileConfig.region
  };

  return {
    config: mergedConfig,
    configPath: configFile ? configFile.path : null
  };
}

/**
 * 检查环境是否 READY（是否有 COS SDK）
 */
function isEnvironmentReady() {
  const scriptDir = path.dirname(__filename);
  const projectRoot = path.dirname(scriptDir);
  const nodeModulesPath = path.join(projectRoot, 'node_modules', 'cos-nodejs-sdk-v5');
  return fs.existsSync(nodeModulesPath);
}

/**
 * 尝试安装依赖
 */
async function tryInstallDependencies() {
  const projectRoot = path.dirname(path.dirname(__filename));

  console.error('[INFO] 检测到缺少依赖，尝试自动安装...');

  try {
    // 检查是否有 package.json
    const packageJsonPath = path.join(projectRoot, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      return { success: false, error: '未找到 package.json' };
    }

    // 尝试使用 npm install
    execSync('npm install', {
      cwd: projectRoot,
      stdio: 'pipe',
      timeout: 120000 // 2分钟超时
    });

    // 再次检查
    if (isEnvironmentReady()) {
      return { success: true };
    } else {
      return { success: false, error: '安装后仍未找到 COS SDK' };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * 验证并解析文件路径
 */
function validateFilePath(filePath) {
  const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB 上限

  // 解析为绝对路径
  const resolved = path.resolve(filePath);

  // 检查文件是否存在
  if (!fs.existsSync(resolved)) {
    return { valid: false, error: `文件不存在: ${filePath}` };
  }

  // 获取文件状态
  let stats;
  try {
    stats = fs.statSync(resolved);
  } catch (err) {
    return { valid: false, error: `无法读取文件: ${err.message}` };
  }

  // 检查是否为目录
  if (stats.isDirectory()) {
    return { valid: false, error: `不支持上传目录: ${filePath}` };
  }

  // 检查是否为普通文件
  if (!stats.isFile()) {
    return { valid: false, error: `只能上传普通文件: ${filePath}` };
  }

  // 检查文件大小上限
  if (stats.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `文件过大 (${(stats.size / 1024 / 1024 / 1024).toFixed(2)}GB)，超过 5GB 限制`
    };
  }

  return {
    valid: true,
    resolvedPath: resolved,
    size: stats.size
  };
}

/**
 * 选择并执行上传
 */
async function smartUpload(localPath, key, options = {}) {
  // 验证文件路径
  const validation = validateFilePath(localPath);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // 使用解析后的绝对路径
  const resolvedPath = validation.resolvedPath;
  const fileSize = validation.size;
  const isLargeFile = fileSize > LITE_SIZE_LIMIT;
  const envReady = isEnvironmentReady();

  console.error(`[INFO] 文件大小: ${(fileSize / 1024 / 1024).toFixed(2)}MB`);
  console.error(`[INFO] 环境状态: ${envReady ? 'READY' : '未就绪'}`);

  let useLite = false;

  if (!isLargeFile) {
    // 小文件：优先使用 lite 版
    useLite = true;
    console.error('[INFO] 文件 <= 100MB，使用轻量版上传');
  } else {
    // 大文件：需要完整版
    if (envReady) {
      useLite = false;
      console.error('[INFO] 文件 > 100MB，环境就绪，使用完整版上传（支持分片）');
    } else {
      // 尝试安装依赖
      console.error('[INFO] 文件 > 100MB，环境未就绪，尝试安装依赖...');
      const installResult = await tryInstallDependencies();

      if (installResult.success) {
        useLite = false;
        console.error('[INFO] 依赖安装成功，使用完整版上传');
      } else {
        // 安装失败，提示用户
        return {
          success: false,
          error: `文件过大 (${(fileSize / 1024 / 1024).toFixed(2)}MB)，需要完整版上传，但依赖安装失败: ${installResult.error}。\n建议:\n1. 手动运行 npm install\n2. 或使用其他方式上传大文件`,
          code: 'ENV_NOT_READY'
        };
      }
    }
  }

  // 获取配置
  const { config } = getFullConfig(options);

  // 构造命令
  const scriptDir = path.dirname(__filename);
  const scriptName = useLite ? 'upload-lite.js' : 'upload.js';
  const scriptPath = path.join(scriptDir, scriptName);

  // 构建命令行参数（使用验证后的绝对路径）
  const args = [resolvedPath];
  if (key) args.push(key);

  // 传递配置参数（优先使用已获取的配置）
  if (config.secret_id) args.push('--secret-id', config.secret_id);
  if (config.secret_key) args.push('--secret-key', config.secret_key);
  if (config.region) args.push('--region', config.region);
  if (config.bucket) args.push('--bucket', config.bucket);

  // 执行上传
  return new Promise((resolve) => {
    const { spawn } = require('child_process');
    const child = spawn('node', [scriptPath, ...args], {
      stdio: ['inherit', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
      process.stdout.write(data);
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });

    child.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch {
          resolve({ success: true, output: stdout });
        }
      } else {
        resolve({
          success: false,
          error: stderr || '上传失败',
          code: code
        });
      }
    });
  });
}

/**
 * 配置管理命令
 * 注意: args.positional[0] 是 'config', 实际动作在 args.positional[1]
 */
async function handleConfigCommand(args) {
  const action = args.positional[1]; // 第一个位置参数是 'config', 第二个才是动作

  if (action === 'show') {
    const { config, configPath } = getFullConfig(args.options);
    console.log(JSON.stringify({
      config: {
        secret_id: config.secret_id ? '***' : undefined,
        secret_key: config.secret_key ? '***' : undefined,
        bucket: config.bucket,
        region: config.region
      },
      configPath: configPath,
      loaded: !!(config.secret_id && config.secret_key && config.bucket && config.region)
    }, null, 2));
    return { success: true };
  }

  if (action === 'set') {
    const config = {};
    if (args.options.secret_id) config.secret_id = args.options.secret_id;
    if (args.options.secret_key) config.secret_key = args.options.secret_key;
    if (args.options.bucket) config.bucket = args.options.bucket;
    if (args.options.region) config.region = args.options.region;

    if (Object.keys(config).length === 0) {
      console.error('用法: upload-smart.js config set --secret-id xxx --secret-key xxx --bucket xxx --region xxx');
      return { success: false, error: '未提供任何配置项' };
    }

    const result = saveConfig(config, args.options.config);
    if (result.success) {
      console.log(JSON.stringify({
        success: true,
        message: '配置已保存',
        path: result.path
      }, null, 2));
    } else {
      console.log(JSON.stringify({
        success: false,
        error: result.error
      }, null, 2));
    }
    return result;
  }

  if (action === 'init') {
    // 交互式配置（供LLM使用）
    console.error('[INFO] 交互式配置初始化');
    console.error('[INFO] 请提供以下配置信息（可由LLM自动填充）:');

    // 这里可以扩展为交互式输入
    console.error('提示: 使用 config set 命令设置配置');
    return { success: true };
  }

  console.error(`用法: upload-smart.js config <action> [options]

actions:
  show    显示当前配置
  set     设置配置（使用 --secret-id, --secret-key, --bucket, --region）
  init    交互式配置初始化

options:
  --config <path>  指定配置文件路径`);

  return { success: false, error: '未知配置命令' };
}

// 主函数
async function main() {
  const parsed = parseArgs(process.argv.slice(2));

  // 配置管理命令
  if (parsed.positional[0] === 'config') {
    const result = await handleConfigCommand(parsed);
    process.exit(result.success ? 0 : 1);
  }

  if (parsed.positional.length < 1) {
    console.error(`用法: node upload-smart.js <本地文件路径> [对象键名] [选项]

智能上传策略:
  - 文件 <= 100MB: 自动使用轻量版（无需依赖）
  - 文件 > 100MB: 检查环境，如未就绪尝试自动安装依赖

选项:
  --secret-id <id>      腾讯云SecretId
  --secret-key <key>    腾讯云SecretKey
  --region <region>     存储桶地域
  --bucket <bucket>     存储桶名称
  --config <path>       指定配置文件路径

配置管理:
  node upload-smart.js config show
  node upload-smart.js config set --secret-id xxx --secret-key xxx --bucket xxx --region xxx

配置优先级: 命令行参数 > 环境变量 > 配置文件 (~/.cosrc 或 ./.cosrc)

环境变量:
  TENCENT_COS_SECRET_ID, TENCENT_COS_SECRET_KEY,
  TENCENT_COS_BUCKET, TENCENT_COS_REGION`);
    process.exit(1);
  }

  const localPath = parsed.positional[0];
  const key = parsed.positional[1];

  const result = await smartUpload(localPath, key, parsed.options);

  if (!result.success && result.code === 'ENV_NOT_READY') {
    // 文件过大且环境未就绪的特殊处理
    console.error(result.error);
    process.exit(1);
  }

  process.exit(result.success ? 0 : 1);
}

main().catch(err => {
  console.error(JSON.stringify({ success: false, error: err.message }, null, 2));
  process.exit(1);
});
