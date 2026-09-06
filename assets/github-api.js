/**
 * 小猪猪教育数字资源库 - GitHub API 封装
 * 处理 OAuth 登录、仓库文件管理、Releases、Tags、Issues 等
 */

class GitHubAPI {
    constructor() {
        this.token = localStorage.getItem('github_token') || '';
        this.clientId = CONFIG.GITHUB.clientId;
        this.redirectUri = CONFIG.GITHUB.redirectUri;
    }

    // ===== OAuth 登录流程 =====
    getOAuthUrl(state) {
        const params = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            state: state || this.generateState(),
            scope: 'repo user',
        });
        return `https://github.com/login/oauth/authorize?${params}`;
    }

    generateState() {
        const state = Math.random().toString(36).substring(2, 15);
        sessionStorage.setItem('oauth_state', state);
        return state;
    }

    // 用授权码换取 access token（需要通过后端代理，或使用 PKCE）
    async exchangeCode(code) {
        // 注意：GitHub OAuth 需要用后端交换 token
        // 前端直接使用 token 的方式：让用户在 Settings → Developer settings 中创建 Personal Access Token
        // 或者部署一个简单的 Cloudflare Worker / Vercel Edge Function 来交换 token
        //
        // 这里我们采用简化方案：直接让用户输入 PAT (Personal Access Token)
        // 这在 GitHub Pages 静态托管场景下是最实际的方案
        throw new Error('Please use Personal Access Token directly');
    }

    // 设置 token
    setToken(token) {
        this.token = token;
        localStorage.setItem('github_token', token);
        storage.token = token;
    }

    // 获取当前用户信息
    async getUserInfo() {
        if (!this.token) return null;
        try {
            const response = await fetch(`${CONFIG.API.baseUrl}/user`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (response.ok) {
                return await response.json();
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    // ===== 仓库文件操作 =====
    async createOrUpdateFile(repo, path, content, message = 'Update via API') {
        if (!this.token) throw new Error('No token configured');

        // 先尝试获取现有文件的 SHA
        let sha = '';
        try {
            const url = `${CONFIG.API.baseUrl}/repos/${storage.owner}/${repo}/contents/${path}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Accept': 'application/vnd.github+json',
                }
            });
            if (response.ok) {
                const data = await response.json();
                sha = data.sha;
            }
        } catch (e) {}

        const body = {
            message,
            content: btoa(unescape(encodeURIComponent(content))),
            branch: CONFIG.GITHUB.branch,
        };
        if (sha) body.sha = sha;

        const response = await fetch(`${CONFIG.API.baseUrl}/repos/${storage.owner}/${repo}/contents/${path}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Accept': 'application/vnd.github+json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            throw new Error(`Failed to save file: ${response.status}`);
        }
        return await response.json();
    }

    async deleteFile(repo, path, message = 'Delete via API') {
        if (!this.token) throw new Error('No token configured');

        // 先获取 SHA
        const url = `${CONFIG.API.baseUrl}/repos/${storage.owner}/${repo}/contents/${path}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Accept': 'application/vnd.github+json',
            }
        });

        if (!response.ok) throw new Error('File not found');

        const data = await response.json();
        const body = {
            message,
            sha: data.sha,
            branch: CONFIG.GITHUB.branch,
        };

        const delResponse = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Accept': 'application/vnd.github+json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!delResponse.ok) throw new Error('Delete failed');
        return true;
    }

    // ===== Release 操作 =====
    async createRelease(repo, tagName, name, body) {
        if (!this.token) throw new Error('No token configured');

        const response = await fetch(`${CONFIG.API.baseUrl}/repos/${storage.owner}/${repo}/releases`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Accept': 'application/vnd.github+json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ tag_name: tagName, name, body }),
        });

        if (!response.ok) throw new Error('Create release failed');
        return await response.json();
    }

    async uploadReleaseAsset(repo, releaseId, file) {
        if (!this.token) throw new Error('No token configured');

        // 第一步：获取 release 信息以获取 upload_url
        const release = await fetch(`${CONFIG.API.baseUrl}/repos/${storage.owner}/${repo}/releases/${releaseId}`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        }).then(r => r.json());

        const uploadUrl = release.upload_url.replace('{?name,label}', `?name=${encodeURIComponent(file.name)}`);
        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/octet-stream',
            },
            body: file,
        });

        if (!response.ok) throw new Error('Upload asset failed');
        return await response.json();
    }

    async deleteReleaseAsset(repo, assetId) {
        if (!this.token) throw new Error('No token configured');

        const response = await fetch(`${CONFIG.API.baseUrl}/repos/${storage.owner}/${repo}/releases/assets/${assetId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${this.token}` },
        });

        return response.ok;
    }

    // ===== Issues 操作 =====
    async listIssues(repo, state = 'all') {
        try {
            const response = await fetch(`${CONFIG.API.baseUrl}/repos/${storage.owner}/${repo}/issues?state=${state}`, {
                headers: {
                    'Authorization': this.token ? `Bearer ${this.token}` : '',
                    'Accept': 'application/vnd.github+json',
                }
            });
            if (response.ok) return await response.json();
            return [];
        } catch (e) {
            return [];
        }
    }

    async createIssue(repo, title, body, labels = []) {
        if (!this.token) throw new Error('No token configured');

        const response = await fetch(`${CONFIG.API.baseUrl}/repos/${storage.owner}/${repo}/issues`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Accept': 'application/vnd.github+json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ title, body, labels }),
        });

        if (!response.ok) throw new Error('Create issue failed');
        return await response.json();
    }

    async updateIssue(repo, issueNumber, updates) {
        if (!this.token) throw new Error('No token configured');

        const response = await fetch(`${CONFIG.API.baseUrl}/repos/${storage.owner}/${repo}/issues/${issueNumber}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Accept': 'application/vnd.github+json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updates),
        });

        if (!response.ok) throw new Error('Update issue failed');
        return await response.json();
    }

    // ===== 获取文件下载链接 =====
    getRawUrl(repo, path) {
        return `${CONFIG.API.cdnBase}/${storage.owner}/${repo}@${CONFIG.GITHUB.branch}/${path}`;
    }

    getDownloadUrl(repo, path) {
        return `${CONFIG.API.rawBase}/${storage.owner}/${repo}/${CONFIG.GITHUB.branch}/${path}`;
    }
}

// 全局 GitHub API 实例
const githubAPI = new GitHubAPI();
