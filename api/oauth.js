/**
 * OAuth Callback Handler
 * 
 * 此文件用于 GitHub OAuth 回调处理
 * 部署方式：Cloudflare Pages Functions 或 Vercel Edge Functions
 * 
 * 文件结构：
 * - Cloudflare Pages: /functions/oauth.js
 * - Vercel: /api/oauth.js
 * 
 * 由于 GitHub Pages 是纯静态托管，无法运行后端代码，
 * 推荐使用以下方案之一：
 * 
 * 方案1：Cloudflare Pages + Functions（推荐）
 * 方案2：Vercel Edge Functions
 * 方案3：Netlify Functions
 * 方案4：直接使用 Personal Access Token（简化方案，当前默认）
 */

// ===== Cloudflare Pages Functions 版本 =====
export async function onRequest({ request, env }) {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code) {
        return new Response('Missing authorization code', { status: 400 });
    }

    // 用 authorization_code 换取 access_token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            client_id: env.CLIENT_ID,
            client_secret: env.CLIENT_SECRET,
            code: code,
        }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
        return new Response(`OAuth error: ${tokenData.error_description}`, { status: 400 });
    }

    // 获取用户信息
    const userResponse = await fetch('https://api.github.com/user', {
        headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'Accept': 'application/vnd.github+json',
        },
    });

    const userData = await userResponse.json();

    // 将 token 存储到客户端的 localStorage（通过 URL fragment 传递）
    const html = `
<!DOCTYPE html>
<html>
<head><title>登录成功 - 正在跳转...</title></head>
<body>
<script>
// 将 token 通过 postMessage 传递给父窗口
window.opener && window.opener.postMessage({
    type: 'github-oauth-success',
    token: '${tokenData.access_token}',
    user: ${JSON.stringify(userData)}
}, '*');

// 或者直接重定向
window.location.href = '/' + (window.location.search || '');
</script>
</body>
</html>`;

    return new Response(html, {
        headers: { 'Content-Type': 'text/html' },
    });
}

// ===== 使用说明 =====
export const README = `
# OAuth 部署说明

## 方案 A：直接使用 Personal Access Token（最简单，推荐快速开始）

用户直接在登录页面输入 GitHub Personal Access Token 即可。
获取方式：GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
需要勾选 repo 权限。

## 方案 B：Cloudflare Pages + Functions（完整 OAuth 体验）

1. 将仓库部署到 Cloudflare Pages
2. 在 Pages Settings → Environment variables 中配置：
   - CLIENT_ID: GitHub OAuth App 的 Client ID
   - CLIENT_SECRET: GitHub OAuth App 的 Client Secret
3. 将本文件放到 /functions/oauth.js
4. 在 GitHub OAuth App 中设置 Callback URL: https://你的域名/oauth

## 方案 C：Vercel Edge Functions

1. 将仓库部署到 Vercel
2. 在项目 Settings → Environment Variables 中配置 CLIENT_ID 和 CLIENT_SECRET
3. 将本文件放到 /api/oauth.js（修改导出方式）
4. 在 GitHub OAuth App 中设置 Callback URL: https://你的域名/api/oauth

## GitHub OAuth App 创建步骤

1. 访问 GitHub → Settings → Developer settings → OAuth Apps → New OAuth App
2. Application name: 小猪猪教育数字资源库
3. Homepage URL: https://你的域名
4. Callback URL: https://你的域名/oauth (或 /api/oauth)
5. 创建后获取 Client ID 和 Client Secret
6. 将 Client ID 填入 config.js 的 GITHUB.clientId
`;
