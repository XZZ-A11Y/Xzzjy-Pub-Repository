/**
 * 小猪猪教育数字资源库 - 存储层
 * 支持两种模式：
 * 1. GitHub API 模式（生产环境，需 Token）
 * 2. LocalStorage 模式（开发/演示环境，无需后端）
 */

class Storage {
    constructor() {
        this.mode = 'local';  // 'github' | 'local'
        this.token = localStorage.getItem('github_token') || '';
        this.owner = localStorage.getItem('github_owner') || CONFIG.GITHUB.owner;
        this.mainRepo = localStorage.getItem('github_main_repo') || CONFIG.GITHUB.mainRepo;
        this.shareRepo = localStorage.getItem('github_share_repo') || CONFIG.GITHUB.shareRepo;
    }

    setGitHubConfig(token, owner, mainRepo, shareRepo) {
        this.token = token;
        this.owner = owner;
        this.mainRepo = mainRepo;
        this.shareRepo = shareRepo;
        this.mode = 'github';
        localStorage.setItem('github_token', token);
        localStorage.setItem('github_owner', owner);
        localStorage.setItem('github_main_repo', mainRepo);
        localStorage.setItem('github_share_repo', shareRepo);
    }

    setLocalMode() {
        this.mode = 'local';
    }

    isGitHubMode() {
        return this.mode === 'github' && this.token;
    }

    // 通用读取
    async read(path) {
        if (this.isGitHubMode()) {
            return await this.readFromGitHub(path);
        }
        return this.readLocal(path);
    }

    // 通用写入
    async write(path, data) {
        if (this.isGitHubMode()) {
            return await this.writeToGitHub(path, data);
        }
        return this.writeLocal(path, data);
    }

    // ===== LocalStorage 模式 =====
    readLocal(path) {
        try {
            const key = `piggy_${path}`;
            const data = localStorage.getItem(key);
            if (data) return JSON.parse(data);

            // 返回默认值
            const defaultKey = path.split('/').pop().replace('.json', '');
            if (DEFAULT_DATA[defaultKey]) {
                localStorage.setItem(key, JSON.stringify(DEFAULT_DATA[defaultKey]));
                return DEFAULT_DATA[defaultKey];
            }
            return null;
        } catch (e) {
            console.error('Read local error:', e);
            return null;
        }
    }

    writeLocal(path, data) {
        try {
            const key = `piggy_${path}`;
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('Write local error:', e);
            return false;
        }
    }

    // ===== GitHub API 模式 =====
    async requestGitHub(url, options = {}) {
        const headers = {
            'Authorization': `Bearer ${this.token}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            ...options.headers,
        };
        const response = await fetch(url, { ...options, headers });
        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
        }
        return response;
    }

    async readFromGitHub(path) {
        try {
            const url = `${CONFIG.API.baseUrl}/repos/${this.owner}/${this.mainRepo}/contents/${path}`;
            const response = await this.requestGitHub(url);
            const data = await response.json();
            if (data.content) {
                const decoded = atob(data.content.replace(/\n/g, ''));
                return JSON.parse(decoded);
            }
            return null;
        } catch (e) {
            console.error('GitHub read error:', e);
            // 降级到 local
            return this.readLocal(path);
        }
    }

    async writeToGitHub(path, data) {
        try {
            const url = `${CONFIG.API.baseUrl}/repos/${this.owner}/${this.mainRepo}/contents/${path}`;
            // 获取当前 SHA（如果需要更新）
            let sha = '';
            try {
                const existing = await this.requestGitHub(url);
                const existingData = await existing.json();
                sha = existingData.sha;
            } catch (e) { /* 文件不存在，创建新文件 */ }

            const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
            const body = {
                message: `Update ${path} via Piggy Resource Manager`,
                content: content,
                branch: CONFIG.GITHUB.branch,
            };
            if (sha) body.sha = sha;

            await this.requestGitHub(url, {
                method: 'PUT',
                body: JSON.stringify(body),
            });
            return true;
        } catch (e) {
            console.error('GitHub write error:', e);
            // 降级到 local
            return this.writeLocal(path, data);
        }
    }

    // ===== 便捷方法 =====
    async getUsers() {
        return await this.read(CONFIG.DATA_PATHS.users) || DEFAULT_DATA.users;
    }

    async saveUsers(users) {
        return await this.write(CONFIG.DATA_PATHS.users, users);
    }

    async getOrders() {
        return await this.read(CONFIG.DATA_PATHS.orders) || DEFAULT_DATA.orders;
    }

    async saveOrders(orders) {
        return await this.write(CONFIG.DATA_PATHS.orders, orders);
    }

    async getPackages() {
        return await this.read(CONFIG.DATA_PATHS.packages) || DEFAULT_DATA.packages;
    }

    async getPointPacks() {
        return await this.read(CONFIG.DATA_PATHS.pointPacks) || DEFAULT_DATA.pointPacks;
    }

    async getCoupons() {
        return await this.read(CONFIG.DATA_PATHS.coupons) || DEFAULT_DATA.coupons;
    }

    async saveCoupons(coupons) {
        return await this.write(CONFIG.DATA_PATHS.coupons, coupons);
    }

    async getAnnouncements() {
        return await this.read(CONFIG.DATA_PATHS.announcements) || DEFAULT_DATA.announcements;
    }

    async saveAnnouncements(announcements) {
        return await this.write(CONFIG.DATA_PATHS.announcements, announcements);
    }

    async getRefunds() {
        return await this.read(CONFIG.DATA_PATHS.refunds) || DEFAULT_DATA.refunds;
    }

    async saveRefunds(refunds) {
        return await this.write(CONFIG.DATA_PATHS.refunds, refunds);
    }

    async getConfig() {
        return await this.read(CONFIG.DATA_PATHS.config) || DEFAULT_DATA.config;
    }

    // ===== GitHub 仓库文件操作 =====
    async getRepoContents(repo, path = '') {
        if (!this.isGitHubMode()) {
            // Local mode: 返回模拟数据
            return this.getMockContents(path);
        }
        try {
            const url = `${CONFIG.API.baseUrl}/repos/${this.owner}/${repo}/contents/${path}`;
            const response = await this.requestGitHub(url);
            return await response.json();
        } catch (e) {
            console.error('Get repo contents error:', e);
            return this.getMockContents(path);
        }
    }

    async getReleases(repo) {
        if (!this.isGitHubMode()) {
            return this.getMockReleases();
        }
        try {
            const url = `${CONFIG.API.baseUrl}/repos/${this.owner}/${repo}/releases`;
            const response = await this.requestGitHub(url);
            return await response.json();
        } catch (e) {
            return this.getMockReleases();
        }
    }

    async getTags(repo) {
        if (!this.isGitHubMode()) {
            return this.getMockTags();
        }
        try {
            const url = `${CONFIG.API.baseUrl}/repos/${this.owner}/${repo}/tags`;
            const response = await this.requestGitHub(url);
            return await response.json();
        } catch (e) {
            return this.getMockTags();
        }
    }

    // 模拟数据（用于演示/Local 模式）
    getMockContents(path) {
        if (path === '') {
            return [
                { name: '数学', type: 'dir', path: '数学', size: 0, updated: '2024-06-01T00:00:00Z' },
                { name: '英语', type: 'dir', path: '英语', size: 0, updated: '2024-06-02T00:00:00Z' },
                { name: '物理', type: 'dir', path: '物理', size: 0, updated: '2024-06-03T00:00:00Z' },
                { name: 'README.md', type: 'file', path: 'README.md', size: 1024, updated: '2024-01-01T00:00:00Z' },
                { name: '课程大纲.pdf', type: 'file', path: '课程大纲.pdf', size: 2048576, updated: '2024-05-15T00:00:00Z' },
                { name: '教学视频.mp4', type: 'file', path: '教学视频.mp4', size: 104857600, updated: '2024-05-20T00:00:00Z' },
                { name: '练习题.docx', type: 'file', path: '练习题.docx', size: 512000, updated: '2024-06-01T00:00:00Z' },
                { name: '知识点图解.png', type: 'file', path: '知识点图解.png', size: 307200, updated: '2024-06-05T00:00:00Z' },
            ];
        }
        return [
            { name: '示例文件1.pdf', type: 'file', path: `${path}/示例文件1.pdf`, size: 1024000, updated: '2024-06-01T00:00:00Z' },
            { name: '示例视频.mp4', type: 'file', path: `${path}/示例视频.mp4`, size: 52428800, updated: '2024-06-02T00:00:00Z' },
            { name: '笔记.docx', type: 'file', path: `${path}/笔记.docx`, size: 256000, updated: '2024-06-03T00:00:00Z' },
        ];
    }

    getMockReleases() {
        return [
            { id: 1, tag_name: 'v2.0.0', name: '版本 2.0.0', body: '新增AI问答功能、批量下载、学习小组等', published_at: '2024-06-01T00:00:00Z',
              assets: [
                  { id: 1, name: '教学完整包.zip', size: 1073741824, download_count: 256 },
                  { id: 2, name: '课件合集.pdf', size: 52428800, download_count: 1024 },
              ]},
            { id: 2, tag_name: 'v1.5.0', name: '版本 1.5.0', body: '新增会员系统、秒点机制', published_at: '2024-05-01T00:00:00Z',
              assets: [
                  { id: 3, name: 'v1.5资源包.zip', size: 536870912, download_count: 512 },
              ]},
        ];
    }

    getMockTags() {
        return [
            { name: 'v2.0.0', commit: { sha: 'abc123', created_at: '2024-06-01T00:00:00Z' } },
            { name: 'v1.5.0', commit: { sha: 'def456', created_at: '2024-05-01T00:00:00Z' } },
            { name: 'v1.0.0', commit: { sha: 'ghi789', created_at: '2024-04-01T00:00:00Z' } },
        ];
    }

    // 验证 Token
    async validateToken(token) {
        try {
            const response = await fetch(`${CONFIG.API.baseUrl}/user`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.ok;
        } catch (e) {
            return false;
        }
    }
}

// 全局存储实例
const storage = new Storage();
