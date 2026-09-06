# 小猪猪教育数字资源库

基于 GitHub 存储架构的教育资源管理系统，支持 GitHub OAuth 登录，可一键部署到 GitHub Pages。

## 🚀 快速部署

### 1. Fork 本仓库
### 2. 开启 GitHub Pages（Settings → Pages → 选择 main 分支）
### 3. 配置 GitHub OAuth App（Settings → Developer settings → OAuth Apps）
   - Homepage URL: `https://你的用户名.github.io/你的仓库名/`
   - Callback URL: `https://你的用户名.github.io/你的仓库名/`
### 4. 在仓库 Settings → Secrets and variables → Actions 中配置：
   - `CLIENT_ID`: 你的 OAuth App Client ID
   - `CLIENT_SECRET`: 你的 OAuth App Client Secret
### 5. 访问你的 GitHub Pages 地址即可使用

## 📁 仓库结构
- `index.html` - 主应用入口
- `admin.html` - 管理后台入口
- `share.html` - 公开资源分享页
- `assets/` - CSS/JS 资源
- `data/` - 数据存储（通过 GitHub API 读写）

## 🔑 核心特性
- GitHub OAuth 登录（无需账号密码）
- 管理端固定密码：123456
- 基于 GitHub Repository 的文件管理
- 会员/秒点/优惠券/订单完整商业闭环
- AI 问答（截图/语音提问）
- 15+ 高级功能模块
