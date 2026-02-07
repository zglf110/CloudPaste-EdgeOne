# CloudPaste - EdgeOne Pages 部署指南

本项目已经过重构，可以直接部署到腾讯云 EdgeOne Pages。

## 📁 项目结构

```
CloudPaste/
├── functions/              # 后端代码（EdgeOne Pages Functions）
│   ├── [[default]].js     # EdgeOne Pages 入口点
│   ├── index.js           # Hono 应用主文件
│   ├── adapters/          # 数据库适配器（MySQL）
│   ├── db/                # 数据库操作
│   ├── routes/            # API 路由
│   ├── services/          # 业务服务
│   ├── storage/           # 存储服务
│   ├── utils/             # 工具函数
│   └── ...
├── public/                 # 静态前端文件
│   ├── index.html
│   ├── assets/
│   └── ...
├── backend/                # 原后端目录（保留用于参考）
├── frontend/               # 原前端源码（保留用于开发）
├── package.json
└── README_EDGEONE.md      # 本文件
```

## 🚀 快速部署

### 方式一：通过 EdgeOne Console 部署

1. **准备 MySQL 数据库**
   ```sql
   CREATE DATABASE cloudpaste CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

2. **配置环境变量**
   
   在 EdgeOne Pages 控制台设置以下环境变量：
   
   ```bash
   # 必需配置
   CLOUD_PLATFORM=edgeone
   MYSQL_HOST=your-mysql-host.com
   MYSQL_PORT=3306
   MYSQL_USER=your_mysql_user
   MYSQL_PASSWORD=your_mysql_password
   MYSQL_DATABASE=cloudpaste
   ENCRYPTION_SECRET=your-32-character-random-secret
   
   # 可选配置
   MYSQL_SSL=false
   DEBUG_LOG=false
   DEBUG_SQL=false
   DEBUG_DB=false
   LOG_LEVEL=warn
   ```

3. **部署到 EdgeOne Pages**
   
   - 登录 [EdgeOne Pages 控制台](https://edgeone.cloud.tencent.com/)
   - 创建新项目
   - 选择 GitHub 仓库或上传代码
   - 等待部署完成

4. **首次访问**
   
   - 默认管理员账户：`admin` / `admin123`
   - **立即修改默认密码！**

### 方式二：使用 EdgeOne CLI 部署

1. **安装 EdgeOne CLI**
   ```bash
   npm install -g edgeone
   ```

2. **登录**
   ```bash
   edgeone login
   ```

3. **部署**
   ```bash
   edgeone pages deploy
   ```

## 🏗️ 本地开发

### 前端开发

```bash
cd frontend
npm install
npm run dev
```

### 后端开发（使用 EdgeOne CLI）

```bash
# 安装依赖
npm install

# 本地运行
edgeone pages dev
```

### 构建前端

```bash
npm run build:frontend
```

这会：
1. 安装前端依赖
2. 构建前端
3. 将构建文件复制到 `public/` 目录

## 🔧 配置说明

### 必需的环境变量

| 变量 | 说明 | 示例 |
|------|------|------|
| `CLOUD_PLATFORM` | 云平台标识 | `edgeone` |
| `MYSQL_HOST` | MySQL 主机地址 | `mysql.example.com` |
| `MYSQL_PORT` | MySQL 端口 | `3306` |
| `MYSQL_USER` | MySQL 用户名 | `cloudpaste_user` |
| `MYSQL_PASSWORD` | MySQL 密码 | `your_password` |
| `MYSQL_DATABASE` | 数据库名称 | `cloudpaste` |
| `ENCRYPTION_SECRET` | 加密密钥（32位） | 使用 `openssl rand -base64 32` 生成 |

### 可选的环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `MYSQL_SSL` | 是否使用 SSL | `false` |
| `DEBUG_LOG` | 启用调试日志 | `false` |
| `DEBUG_SQL` | 启用 SQL 日志 | `false` |
| `DEBUG_DB` | 启用数据库日志 | `false` |
| `LOG_LEVEL` | 日志级别 | `warn` |

## 🌐 API 端点

部署后，所有 API 都在同一域名下：

- `GET /api/system/version` - 获取系统版本
- `GET /api/system/health` - 健康检查
- `POST /api/admin/login` - 管理员登录
- 更多 API 请参考 [API 文档](Api-doc.md)

## 🐛 故障排查

### 1. 部署后出现 404

**原因**：可能是静态文件未正确部署

**解决方案**：
```bash
npm run build:frontend  # 构建前端
edgeone pages deploy    # 重新部署
```

### 2. MySQL 连接失败

**解决方案**：
1. 启用日志查看详情：
   ```bash
   DEBUG_DB=true
   DEBUG_LOG=true
   ```
2. 检查 MySQL 配置：
   - 主机地址和端口是否正确
   - 用户名密码是否正确
   - 防火墙是否允许连接
   - 用户权限是否足够

### 3. API 返回 500 错误

**解决方案**：
1. 查看 EdgeOne Pages 日志
2. 启用详细日志：
   ```bash
   DEBUG_LOG=true
   DEBUG_SQL=true
   LOG_LEVEL=debug
   ```
3. 检查环境变量是否正确设置

## 📖 相关文档

- [EdgeOne Pages 官方文档](https://cloud.tencent.com/document/product/1552)
- [完整部署指南](EDGEONE_DEPLOYMENT.md)
- [快速开始](EDGEONE_QUICKSTART.md)
- [API 文档](Api-doc.md)
- [生产环境指南](PRODUCTION_GUIDE_CN.md)

## 🔐 安全建议

1. ✅ 部署后立即修改默认管理员密码
2. ✅ 使用强随机字符串作为 `ENCRYPTION_SECRET`
3. ✅ 生产环境启用 `MYSQL_SSL=true`
4. ✅ 定期备份 MySQL 数据库
5. ✅ 监控 EdgeOne Pages 日志

## 📝 更新日志

### v1.9.1 - EdgeOne Pages 支持

- ✅ 重构项目结构以支持 EdgeOne Pages
- ✅ 后端代码移至 `functions/` 目录
- ✅ 创建 `[[default]].js` 作为 EdgeOne Pages 入口点
- ✅ 静态文件移至 `public/` 目录
- ✅ 添加 EdgeOne Pages 专用配置和文档

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

Apache License 2.0

---

**部署成功后，访问您的 EdgeOne Pages 域名即可使用 CloudPaste！** 🎉
