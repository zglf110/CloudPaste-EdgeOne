# 生产环境部署建议

## 🎯 部署前检查清单

### 环境变量配置

#### 必需的环境变量 ✅
```bash
# ====== 核心配置 ======
CLOUD_PLATFORM=edgeone                    # 必须设置为 edgeone
MYSQL_HOST=your-production-mysql-host     # 生产数据库地址
MYSQL_PORT=3306                           # MySQL 端口
MYSQL_USER=cloudpaste_user                # 数据库用户
MYSQL_PASSWORD=<strong-password>          # 强密码
MYSQL_DATABASE=cloudpaste                 # 数据库名称
ENCRYPTION_SECRET=<32-chars-random>       # 32位随机字符串
```

#### 生产环境推荐配置 🔐
```bash
# ====== 安全配置 ======
MYSQL_SSL=true                            # 生产环境建议启用 SSL
ADMIN_TOKEN_EXPIRY_DAYS=7                 # Token 过期时间

# ====== 日志配置（生产环境）======
DEBUG_LOG=false                           # 关闭详细日志
DEBUG_SQL=false                           # 关闭 SQL 日志
DEBUG_DB=false                            # 关闭数据库日志
LOG_LEVEL=warn                            # 只记录警告和错误
```

#### 调试/故障排查配置 🔍
```bash
# 遇到问题时临时启用，排查完成后关闭

# 启用所有调试日志（短期使用）
DEBUG_LOG=true
DEBUG_SQL=true
DEBUG_DB=true
LOG_LEVEL=debug

# 只查看 SQL 性能问题
DEBUG_SQL=true
LOG_LEVEL=info

# 只查看数据库连接问题
DEBUG_DB=true
LOG_LEVEL=info
```

## 🔒 安全建议

### 1. 数据库安全

#### 使用强密码
```bash
# 不要使用
MYSQL_PASSWORD=123456
MYSQL_PASSWORD=cloudpaste

# 应该使用（至少16位，包含大小写字母、数字、特殊字符）
MYSQL_PASSWORD=Kj8#mP2$nQ9@xL5%wR3*
```

#### 启用 SSL 连接
```bash
MYSQL_SSL=true
```

确保 MySQL 服务器已配置 SSL：
```sql
-- 检查 SSL 状态
SHOW VARIABLES LIKE '%ssl%';
```

#### 最小权限原则
```sql
-- 创建专用用户，只授予必要权限
CREATE USER 'cloudpaste_user'@'%' IDENTIFIED BY 'strong_password';

-- 只授予必要的权限
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX 
ON cloudpaste.* TO 'cloudpaste_user'@'%';

FLUSH PRIVILEGES;
```

### 2. 加密密钥管理

#### 生成强随机密钥
```bash
# Linux/Mac - 使用 OpenSSL
openssl rand -base64 32

# 或使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

#### 密钥存储
- ✅ 使用环境变量存储
- ✅ 使用密钥管理服务（如 AWS Secrets Manager、腾讯云 SSM）
- ❌ 不要硬编码到代码中
- ❌ 不要提交到 Git 仓库

### 3. 网络安全

#### MySQL 访问控制
```sql
-- 限制访问 IP（如果可能）
CREATE USER 'cloudpaste'@'<edgeone-ip-range>' IDENTIFIED BY 'password';

-- 或使用白名单
-- 在云数据库控制台配置安全组/防火墙规则
```

#### 定期审查
- 定期检查数据库访问日志
- 监控异常连接
- 定期更新密码

## 📊 性能优化

### 1. 数据库优化

#### 连接池配置
当前默认配置：
```javascript
connectionLimit: 10      // 最大连接数
waitForConnections: true // 等待可用连接
queueLimit: 0           // 无队列限制
connectTimeout: 30000    // 30秒连接超时
```

根据负载调整：
```javascript
// 高并发场景
connectionLimit: 20

// 低并发场景
connectionLimit: 5
```

#### 索引优化
确保以下表有正确的索引（迁移脚本已包含）：
- users 表：username（唯一索引）
- api_keys 表：key（唯一索引）、user_id
- upload_sessions 表：session_id、user_id
- files 表：storage_path、owner_id、created_at

#### 查询优化
启用 SQL 日志分析慢查询：
```bash
DEBUG_SQL=true
```

查看执行时间超过 100ms 的查询，考虑优化。

### 2. 应用层优化

#### 监控连接池状态
定期检查连接池是否有压力：
```bash
DEBUG_DB=true  # 临时启用
```

如果看到 `queuedRequests` 持续增长，考虑：
1. 增加 `connectionLimit`
2. 优化慢查询
3. 检查连接泄漏

#### 缓存策略
- EdgeOne 自带 CDN 缓存静态资源
- API 响应根据业务需求配置缓存头

## 🔍 监控与告警

### 1. 关键指标

#### 应用指标
- 请求响应时间
- 错误率
- API 调用量

#### 数据库指标
```bash
# 启用数据库日志监控
DEBUG_DB=true
```

监控：
- 连接池使用率
- SQL 执行时间
- 慢查询数量
- 连接失败率

#### 系统指标
- CPU 使用率
- 内存使用率
- 网络延迟

### 2. 日志分析

#### 生产环境日志策略
```bash
# 默认配置 - 只记录重要信息
LOG_LEVEL=warn
DEBUG_LOG=false
DEBUG_SQL=false
DEBUG_DB=false
```

#### 问题发生时
```bash
# 1. 立即启用详细日志
DEBUG_LOG=true
DEBUG_SQL=true
DEBUG_DB=true
LOG_LEVEL=debug

# 2. 收集日志
# 3. 分析问题
# 4. 修复后关闭调试日志
```

#### 日志分析工具
建议将日志导入到日志分析平台：
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Grafana Loki
- 云服务商的日志服务（腾讯云 CLS、阿里云 SLS）

日志已经是 JSON 格式，便于解析：
```json
{
  "timestamp": "2024-01-15T10:30:46.234Z",
  "category": "MySQL/SQL",
  "sql": "SELECT * FROM users WHERE id = ?",
  "params": [1],
  "duration_ms": 45
}
```

### 3. 告警规则

建议配置以下告警：

#### 数据库告警
- ⚠️ MySQL 连接失败率 > 1%
- ⚠️ 平均 SQL 执行时间 > 200ms
- 🔴 数据库不可用
- 🔴 连接池耗尽（freeConnections = 0 持续 > 1分钟）

#### 应用告警
- ⚠️ API 错误率 > 5%
- ⚠️ 平均响应时间 > 1s
- 🔴 应用无响应

## 🔄 故障恢复

### 数据库故障

#### 主动健康检查
应用已内置健康检查，每次初始化都会 ping 数据库。

#### 连接失败处理
应用会自动重试数据库初始化（`dbInitPromise` 机制）。

如果数据库长时间不可用：
1. 检查数据库状态
2. 检查网络连接
3. 查看详细日志（`DEBUG_DB=true`）
4. 恢复数据库后，应用会自动重连

### 性能降级

如果数据库性能下降：
1. 启用 SQL 日志查看慢查询
   ```bash
   DEBUG_SQL=true
   ```
2. 分析慢查询原因
3. 优化查询或添加索引
4. 考虑扩容数据库

## 📝 维护计划

### 日常维护

#### 每日
- 检查错误日志
- 监控关键指标
- 备份数据库

#### 每周
- 审查性能指标
- 检查慢查询
- 清理过期数据（如果有）

#### 每月
- 数据库性能调优
- 更新依赖包（安全更新）
- 审查安全日志
- 测试备份恢复

### 备份策略

#### 数据库备份
```bash
# 每日全量备份
mysqldump -h your-host -u your-user -p \
  --single-transaction \
  --routines \
  --triggers \
  cloudpaste > backup_$(date +%Y%m%d).sql

# 压缩备份
gzip backup_$(date +%Y%m%d).sql

# 保留最近30天的备份
```

#### 对象存储备份
- R2/S3 启用版本控制
- 配置对象生命周期策略
- 定期测试恢复流程

## 🚀 扩容建议

### 数据库扩容

#### 垂直扩容
- 增加 CPU 和内存
- 升级 MySQL 版本
- 使用更快的存储（SSD）

#### 水平扩容（高级）
- 读写分离
- 数据库分片
- 使用数据库代理

### 应用扩容

EdgeOne Pages 自动扩容，但需要注意：
- 数据库连接数限制
- 可能需要增加数据库的最大连接数

## 🎓 最佳实践总结

### ✅ 应该做的

1. **安全**
   - 使用强密码和加密密钥
   - 启用 MySQL SSL
   - 定期更新依赖

2. **性能**
   - 监控 SQL 执行时间
   - 优化慢查询
   - 合理配置连接池

3. **可靠性**
   - 定期备份数据
   - 配置告警
   - 测试恢复流程

4. **可观测性**
   - 生产环境 LOG_LEVEL=warn
   - 问题时启用详细日志
   - 集成日志分析平台

### ❌ 不应该做的

1. **安全**
   - 不要使用弱密码
   - 不要在代码中硬编码密钥
   - 不要禁用 SSL（生产环境）

2. **性能**
   - 不要在生产环境长期开启 DEBUG_SQL
   - 不要忽略慢查询
   - 不要过度配置连接池

3. **运维**
   - 不要没有备份就上线
   - 不要没有监控就上线
   - 不要在生产环境直接测试

## 📞 问题排查流程

### 1. 发现问题
- 通过监控告警
- 用户反馈
- 错误日志

### 2. 收集信息
```bash
# 启用详细日志
DEBUG_LOG=true
DEBUG_SQL=true
DEBUG_DB=true
LOG_LEVEL=debug
```

### 3. 分析问题
- 查看错误日志
- 分析 SQL 执行时间
- 检查连接池状态
- 查看数据库监控

### 4. 定位原因
- 数据库连接问题？
- SQL 性能问题？
- 应用逻辑问题？
- 资源不足？

### 5. 解决问题
- 修复代码
- 优化配置
- 扩容资源

### 6. 验证修复
- 关闭调试日志
- 持续监控
- 确认问题解决

## 🎉 部署清单

最后，部署前确认：

### 环境配置 ✅
- [ ] 所有必需的环境变量已设置
- [ ] 加密密钥已生成（32位随机字符串）
- [ ] 数据库密码足够强
- [ ] MySQL SSL 已启用（生产环境）
- [ ] 日志级别设置为 warn 或 error

### 数据库 ✅
- [ ] 数据库已创建
- [ ] 用户权限已正确配置
- [ ] 可以从 EdgeOne Pages 连接到数据库
- [ ] 备份策略已配置

### 安全 ✅
- [ ] 默认管理员密码已修改
- [ ] API 密钥已创建
- [ ] 防火墙规则已配置
- [ ] SSL 证书已配置

### 监控 ✅
- [ ] 日志收集已配置
- [ ] 告警规则已设置
- [ ] 监控面板已创建

### 测试 ✅
- [ ] 可以登录管理界面
- [ ] 文件上传功能正常
- [ ] API 调用正常
- [ ] WebDAV 访问正常（如需要）

### 备份 ✅
- [ ] 数据库备份已配置
- [ ] 对象存储版本控制已启用
- [ ] 恢复流程已测试

---

**准备就绪！** 🚀

完成以上检查后，您的 CloudPaste EdgeOne Pages 部署就可以稳定运行了。遇到任何问题，记得先启用调试日志（`DEBUG_LOG=true`）来快速定位问题。
