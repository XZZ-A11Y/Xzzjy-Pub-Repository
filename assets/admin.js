/**
 * 小猪猪教育数字资源库 - 管理后台逻辑
 */

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', () => {
    checkAdminAuth();
});

function checkAdminAuth() {
    const isAuthed = sessionStorage.getItem('admin_authed') === 'true';
    if (isAuthed) {
        showAdminApp();
    } else {
        showAdminAuth();
    }
}

function showAdminAuth() {
    document.getElementById('admin-auth').style.display = 'flex';
    document.getElementById('admin-app').style.display = 'none';
}

function showAdminApp() {
    document.getElementById('admin-auth').style.display = 'none';
    document.getElementById('admin-app').style.display = 'flex';
    switchAdminPage('token');
}

// 管理端密码验证
document.getElementById('admin-login-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const password = document.getElementById('admin-password').value;
    if (password === CONFIG.ADMIN_PASSWORD) {
        sessionStorage.setItem('admin_authed', 'true');
        showAdminApp();
        showToast('登录成功', 'success');
    } else {
        showToast('密码错误，请重新输入', 'error');
        document.getElementById('admin-password').value = '';
    }
});

function adminLogout() {
    sessionStorage.removeItem('admin_authed');
    location.reload();
}

// ===== 页面切换 =====
function switchAdminPage(page) {
    document.querySelectorAll('.admin-nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.admin-page').forEach(p => p.classList.remove('active'));

    document.querySelector(`.admin-nav-item[data-page="${page}"]`).classList.add('active');
    document.getElementById(`admin-page-${page}`).classList.add('active');

    const titles = {
        'token': 'GitHub Token 配置',
        'files': '主仓库文件管理',
        'share-files': '分享仓库文件管理',
        'issues': 'Issue 管理',
        'users': '用户权限管理',
        'packages': '套餐管理',
        'coupons': '优惠券管理',
        'approvals': '订单审批',
        'orders': '订单记录',
        'quotas': '用户额度',
        'refunds': '退款审批',
        'announcements': '公告管理',
        'traffic': '下载流量统计',
        'visitors': '访问统计',
    };
    document.getElementById('admin-page-title').textContent = titles[page] || '';

    // 加载页面数据
    switch (page) {
        case 'files': loadFileManager('file-manager', storage.mainRepo); break;
        case 'share-files': loadFileManager('share-file-manager', storage.shareRepo); break;
        case 'issues': loadIssues(); break;
        case 'users': loadUsers(); break;
        case 'packages': loadPackages(); break;
        case 'coupons': loadCoupons(); break;
        case 'approvals': loadApprovals(); break;
        case 'orders': loadOrdersRecord(); break;
        case 'quotas': loadQuotas(); break;
        case 'refunds': loadRefunds(); break;
        case 'announcements': loadAnnouncementsAdmin(); break;
        case 'traffic': loadTraffic(); break;
        case 'visitors': loadVisitors(); break;
    }
}

// ===== Token 配置 =====
async function saveToken() {
    const token = document.getElementById('github-token').value.trim();
    if (!token) { showToast('请输入 Token', 'error'); return; }

    // 验证 Token
    const isValid = await storage.validateToken(token);
    if (isValid) {
        storage.token = token;
        localStorage.setItem('github_token', token);
        showToast('Token 配置成功', 'success');
    } else {
        showToast('Token 无效，请检查后重试', 'error');
    }
}

function saveRepoConfig() {
    const owner = document.getElementById('main-repo').value.split('/')[0] || storage.owner;
    const mainRepo = document.getElementById('main-repo').value.split('/')[1] || 'resource-main';
    const shareRepo = document.getElementById('share-repo').value.split('/')[1] || 'Every-day-Share';

    storage.owner = owner;
    storage.mainRepo = mainRepo;
    storage.shareRepo = shareRepo;

    localStorage.setItem('github_owner', owner);
    localStorage.setItem('github_main_repo', mainRepo);
    localStorage.setItem('github_share_repo', shareRepo);

    showToast('仓库配置已保存', 'success');
}

// ===== 文件管理器 =====
let currentAdminFolder = '';
let currentAdminRepo = '';

async function loadFileManager(containerId, repo) {
    currentAdminRepo = repo;
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
        <div class="file-manager-header">
            <div class="breadcrumb" id="admin-breadcrumb"></div>
            <div class="file-actions">
                <button class="btn btn-primary btn-sm" onclick="showCreateFolderModal()"><i class="fas fa-folder-plus"></i> 新建文件夹</button>
                <button class="btn btn-primary btn-sm" onclick="showCreateFileModal()"><i class="fas fa-file-plus"></i> 新建文件</button>
                <button class="btn btn-primary btn-sm" onclick="showUploadModal()"><i class="fas fa-upload"></i> 上传文件</button>
                <button class="btn btn-outline btn-sm" onclick="showReleaseManager()"><i class="fas fa-tag"></i> 管理 Releases</button>
                <button class="btn btn-outline btn-sm" onclick="showTagManager()"><i class="fas fa-tags"></i> 管理 Tags</button>
            </div>
        </div>
        <div class="release-selector">
            <label>上传到 Release：</label>
            <select id="release-select" onchange="onReleaseChange()">
                <option value="">-- 选择 Release（留空则默认） --</option>
            </select>
        </div>
        <div id="admin-file-list" class="admin-file-list"></div>
    `;

    await refreshFileList();
    await loadReleasesForSelect();
}

async function refreshFileList() {
    const listEl = document.getElementById('admin-file-list');
    if (!listEl) return;

    try {
        const contents = await storage.getRepoContents(currentAdminRepo, currentAdminFolder);
        listEl.innerHTML = contents.map(item => `
            <div class="admin-file-item">
                <i class="fas ${item.type === 'dir' ? 'fa-folder' : getFileIcon(item.name)}"></i>
                <span class="file-name">${item.name}</span>
                <span class="file-size">${formatSize(item.size)}</span>
                <span class="file-updated">${new Date(item.updated || Date.now()).toLocaleDateString()}</span>
                <div class="file-actions">
                    ${item.type === 'dir' ? `<button class="btn-icon" onclick="enterAdminFolder('${item.path}')"><i class="fas fa-folder-open"></i></button>` : ''}
                    ${item.type === 'file' ? `<button class="btn-icon" onclick="editFile('${item.path}')"><i class="fas fa-edit"></i></button>` : ''}
                    ${item.type === 'file' ? `<button class="btn-icon" onclick="deleteFile('${item.path}')"><i class="fas fa-trash"></i></button>` : ''}
                    ${item.type === 'dir' ? `<button class="btn-icon" onclick="deleteFolder('${item.path}')"><i class="fas fa-trash"></i></button>` : ''}
                </div>
            </div>
        `).join('');

        // 更新面包屑
        const breadcrumb = document.getElementById('admin-breadcrumb');
        if (breadcrumb) {
            const parts = currentAdminFolder.split('/').filter(Boolean);
            let html = `<a href="#" onclick="enterAdminFolder('')"><i class="fas fa-home"></i></a>`;
            let path = '';
            parts.forEach(part => {
                path += '/' + part;
                html += ` / <a href="#" onclick="enterAdminFolder('${path.slice(1)}')">${part}</a>`;
            });
            breadcrumb.innerHTML = html;
        }
    } catch (e) {
        listEl.innerHTML = '<div class="empty-state"><i class="fas fa-folder-open"></i><p>暂无文件</p></div>';
    }
}

function enterAdminFolder(path) {
    currentAdminFolder = path;
    refreshFileList();
}

async function loadReleasesForSelect() {
    const select = document.getElementById('release-select');
    if (!select) return;
    const releases = await storage.getReleases(currentAdminRepo);
    select.innerHTML = `<option value="">-- 默认 Release --</option>` +
        releases.map(r => `<option value="${r.id}">${r.tag_name} - ${r.name || ''}</option>`).join('');
}

// ===== 文件操作弹窗 =====
function showCreateFolderModal() {
    openAdminModal('新建文件夹', `
        <div class="form-group">
            <label>文件夹名称</label>
            <input type="text" id="folder-name" placeholder="请输入文件夹名称">
        </div>
        <div class="modal-actions">
            <button class="btn btn-primary" onclick="createFolder()">创建</button>
            <button class="btn btn-outline" onclick="closeAdminModal()">取消</button>
        </div>
    `);
}

async function createFolder() {
    const name = document.getElementById('folder-name').value;
    if (!name) { showToast('请输入文件夹名称', 'error'); return; }

    if (storage.isGitHubMode()) {
        // GitHub 创建空文件夹需要一个 .gitkeep 文件
        try {
            await githubAPI.createOrUpdateFile(
                currentAdminRepo,
                `${currentAdminFolder}/${name}/.gitkeep`,
                '',
                `Create folder: ${name}`
            );
            showToast('文件夹创建成功', 'success');
            closeAdminModal();
            refreshFileList();
        } catch (e) {
            showToast('创建失败：' + e.message, 'error');
        }
    } else {
        showToast('文件夹创建成功（本地模式）', 'success');
        closeAdminModal();
        refreshFileList();
    }
}

function showCreateFileModal() {
    openAdminModal('新建文件', `
        <div class="form-group">
            <label>文件名</label>
            <input type="text" id="file-name" placeholder="example.txt">
        </div>
        <div class="form-group">
            <label>文件内容</label>
            <textarea id="file-content" rows="10" placeholder="输入文件内容..."></textarea>
        </div>
        <div class="modal-actions">
            <button class="btn btn-primary" onclick="createFile()">保存</button>
            <button class="btn btn-outline" onclick="closeAdminModal()">取消</button>
        </div>
    `);
}

async function createFile() {
    const name = document.getElementById('file-name').value;
    const content = document.getElementById('file-content').value;
    if (!name) { showToast('请输入文件名', 'error'); return; }

    if (storage.isGitHubMode()) {
        try {
            await githubAPI.createOrUpdateFile(
                currentAdminRepo,
                `${currentAdminFolder}/${name}`,
                content,
                `Create file: ${name}`
            );
            showToast('文件创建成功', 'success');
            closeAdminModal();
            refreshFileList();
        } catch (e) {
            showToast('创建失败：' + e.message, 'error');
        }
    } else {
        showToast('文件创建成功（本地模式）', 'success');
        closeAdminModal();
        refreshFileList();
    }
}

async function editFile(path) {
    // 读取文件内容并编辑
    if (storage.isGitHubMode()) {
        try {
            const url = `${CONFIG.API.baseUrl}/repos/${storage.owner}/${currentAdminRepo}/contents/${path}`;
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${storage.token}` }
            });
            const data = await response.json();
            const content = atob(data.content.replace(/\n/g, ''));

            openAdminModal('编辑文件', `
                <div class="form-group">
                    <label>文件路径</label>
                    <input type="text" value="${path}" readonly>
                </div>
                <div class="form-group">
                    <label>文件内容</label>
                    <textarea id="edit-content" rows="15">${content}</textarea>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-primary" onclick="saveFile('${path}', '${data.sha}')">保存</button>
                    <button class="btn btn-outline" onclick="closeAdminModal()">取消</button>
                </div>
            `);
        } catch (e) {
            showToast('读取文件失败', 'error');
        }
    } else {
        showToast('编辑功能在 GitHub 模式下可用', 'info');
    }
}

async function saveFile(path, sha) {
    const content = document.getElementById('edit-content').value;
    try {
        await fetch(`${CONFIG.API.baseUrl}/repos/${storage.owner}/${currentAdminRepo}/contents/${path}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${storage.token}`,
                'Accept': 'application/vnd.github+json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: `Update ${path}`,
                content: btoa(unescape(encodeURIComponent(content))),
                sha,
                branch: CONFIG.GITHUB.branch,
            }),
        });
        showToast('文件保存成功', 'success');
        closeAdminModal();
        refreshFileList();
    } catch (e) {
        showToast('保存失败：' + e.message, 'error');
    }
}

async function deleteFile(path) {
    if (!confirm(`确定要删除 ${path} 吗？此操作不可恢复。`)) return;

    if (storage.isGitHubMode()) {
        try {
            await githubAPI.deleteFile(currentAdminRepo, path);
            showToast('文件已删除', 'success');
            refreshFileList();
        } catch (e) {
            showToast('删除失败：' + e.message, 'error');
        }
    } else {
        showToast('文件已删除（本地模式）', 'success');
        refreshFileList();
    }
}

function deleteFolder(path) {
    if (!confirm(`确定要删除文件夹 ${path} 及其所有内容吗？此操作不可恢复。`)) return;
    showToast('文件夹删除成功（演示模式）', 'success');
    refreshFileList();
}

function showUploadModal() {
    openAdminModal('上传文件', `
        <div class="form-group">
            <label>选择 Release</label>
            <select id="upload-release">
                <option value="">默认 Release（文件存储）</option>
            </select>
        </div>
        <div class="form-group">
            <label>选择文件（可多选）</label>
            <input type="file" id="upload-files" multiple>
        </div>
        <div class="upload-progress" id="upload-progress"></div>
        <div class="modal-actions">
            <button class="btn btn-primary" onclick="uploadFiles()">开始上传</button>
            <button class="btn btn-outline" onclick="closeAdminModal()">取消</button>
        </div>
    `);
    // 加载 Release 列表
    loadReleasesForSelect().then(() => {
        const select = document.getElementById('upload-release');
        const adminSelect = document.getElementById('release-select');
        if (select && adminSelect) {
            select.innerHTML = adminSelect.innerHTML;
        }
    });
}

async function uploadFiles() {
    const files = document.getElementById('upload-files').files;
    if (!files.length) { showToast('请选择文件', 'error'); return; }

    const releaseId = document.getElementById('upload-release').value;
    const progressEl = document.getElementById('upload-progress');

    if (storage.isGitHubMode() && releaseId) {
        // 上传到 Release Assets
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            progressEl.innerHTML = `<p>上传中 (${i + 1}/${files.length}): ${file.name}</p>`;
            try {
                await githubAPI.uploadReleaseAsset(currentAdminRepo, releaseId, file);
                progressEl.innerHTML += `<p class="text-success">✓ ${file.name} 上传成功</p>`;
            } catch (e) {
                progressEl.innerHTML += `<p class="text-error">✗ ${file.name} 上传失败: ${e.message}</p>`;
            }
        }
        showToast('上传完成', 'success');
    } else {
        // 本地模式或上传为仓库文件
        progressEl.innerHTML = `<p>上传中...</p>`;
        setTimeout(() => {
            progressEl.innerHTML = `<p class="text-success">✓ 所有文件上传成功（演示模式）</p>`;
            showToast('文件上传成功（演示模式）', 'success');
            closeAdminModal();
            refreshFileList();
        }, 1500);
    }
}

// ===== Release 管理 =====
function showReleaseManager() {
    openAdminModal('管理 Releases', `
        <div class="release-manager">
            <button class="btn btn-primary btn-sm" onclick="showCreateRelease()"><i class="fas fa-plus"></i> 创建 Release</button>
            <div id="releases-manage-list"></div>
        </div>
    `);
    loadReleasesForManage();
}

async function loadReleasesForManage() {
    const container = document.getElementById('releases-manage-list');
    if (!container) return;
    const releases = await storage.getReleases(currentAdminRepo);
    container.innerHTML = releases.map(r => `
        <div class="release-manage-item">
            <span class="tag-name">${r.tag_name}</span>
            <span>${r.name || ''}</span>
            <span class="release-date">${new Date(r.published_at).toLocaleDateString()}</span>
            <button class="btn-icon" onclick="editRelease('${r.id}')"><i class="fas fa-edit"></i></button>
            <button class="btn-icon" onclick="deleteRelease('${r.id}')"><i class="fas fa-trash"></i></button>
        </div>
    `).join('');
}

function showCreateRelease() {
    openAdminModal('创建 Release', `
        <div class="form-group">
            <label>版本号（Tag）</label>
            <input type="text" id="release-tag" placeholder="v1.0.0">
        </div>
        <div class="form-group">
            <label>Release 名称</label>
            <input type="text" id="release-name" placeholder="版本 1.0.0">
        </div>
        <div class="form-group">
            <label>发布说明</label>
            <textarea id="release-body" rows="5" placeholder="支持 Markdown"></textarea>
        </div>
        <div class="modal-actions">
            <button class="btn btn-primary" onclick="createRelease()">创建</button>
            <button class="btn btn-outline" onclick="closeAdminModal()">取消</button>
        </div>
    `);
}

async function createRelease() {
    const tag = document.getElementById('release-tag').value;
    const name = document.getElementById('release-name').value;
    const body = document.getElementById('release-body').value;

    if (!tag) { showToast('请输入版本号', 'error'); return; }

    if (storage.isGitHubMode()) {
        try {
            await githubAPI.createRelease(currentAdminRepo, tag, name, body);
            showToast('Release 创建成功', 'success');
            closeAdminModal();
        } catch (e) {
            showToast('创建失败：' + e.message, 'error');
        }
    } else {
        showToast('Release 创建成功（演示模式）', 'success');
        closeAdminModal();
    }
}

async function deleteRelease(releaseId) {
    if (!confirm('确定要删除此 Release 吗？')) return;
    showToast('Release 删除成功（演示模式）', 'success');
}

// ===== Tag 管理 =====
function showTagManager() {
    openAdminModal('管理 Tags', `
        <div class="tag-manager">
            <div class="form-group">
                <label>标签名称</label>
                <input type="text" id="tag-name" placeholder="v1.0.0">
            </div>
            <div class="form-group">
                <label>关联 Commit SHA（可选）</label>
                <input type="text" id="tag-commit" placeholder="留空则使用当前 HEAD">
            </div>
            <button class="btn btn-primary" onclick="createTag()">创建 Tag</button>
        </div>
    `);
}

async function createTag() {
    const name = document.getElementById('tag-name').value;
    if (!name) { showToast('请输入标签名称', 'error'); return; }
    showToast('Tag 创建成功（演示模式）', 'success');
    closeAdminModal();
}

// ===== Issue 管理 =====
async function loadIssues() {
    const container = document.getElementById('issues-container');
    if (!container) return;

    const issues = await githubAPI.listIssues(currentAdminRepo);

    container.innerHTML = `
        <div class="issues-header">
            <div class="issue-filters">
                <select onchange="filterIssues(this.value)">
                    <option value="all">全部</option>
                    <option value="open">Open</option>
                    <option value="closed">Closed</option>
                </select>
            </div>
            <button class="btn btn-primary btn-sm" onclick="showCreateIssue()"><i class="fas fa-plus"></i> 新建 Issue</button>
        </div>
        <div class="issues-list">
            ${issues.length === 0
                ? '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>暂无 Issue</p></div>'
                : issues.map(issue => `
                    <div class="issue-card" onclick="viewIssue(${issue.number})">
                        <span class="issue-state state-${issue.state}">${issue.state}</span>
                        <span class="issue-number">#${issue.number}</span>
                        <span class="issue-title">${issue.title}</span>
                        <span class="issue-date">${new Date(issue.created_at).toLocaleDateString()}</span>
                        <div class="issue-labels">
                            ${(issue.labels || []).map(l => `<span class="label" style="background:#${l.color}">${l.name}</span>`).join('')}
                        </div>
                    </div>
                `).join('')
            }
        </div>
    `;
}

function showCreateIssue() {
    openAdminModal('新建 Issue', `
        <div class="form-group">
            <label>标题</label>
            <input type="text" id="issue-title" placeholder="Issue 标题">
        </div>
        <div class="form-group">
            <label>描述</label>
            <textarea id="issue-body" rows="8" placeholder="详细描述..."></textarea>
        </div>
        <div class="form-group">
            <label>标签（逗号分隔）</label>
            <input type="text" id="issue-labels" placeholder="bug, enhancement">
        </div>
        <div class="modal-actions">
            <button class="btn btn-primary" onclick="createIssue()">提交</button>
            <button class="btn btn-outline" onclick="closeAdminModal()">取消</button>
        </div>
    `);
}

async function createIssue() {
    const title = document.getElementById('issue-title').value;
    const body = document.getElementById('issue-body').value;
    const labelsInput = document.getElementById('issue-labels').value;
    const labels = labelsInput.split(',').map(l => l.trim()).filter(Boolean);

    if (!title) { showToast('请输入标题', 'error'); return; }

    if (storage.isGitHubMode()) {
        try {
            await githubAPI.createIssue(currentAdminRepo, title, body, labels);
            showToast('Issue 创建成功', 'success');
            closeAdminModal();
            loadIssues();
        } catch (e) {
            showToast('创建失败：' + e.message, 'error');
        }
    } else {
        showToast('Issue 创建成功（演示模式）', 'success');
        closeAdminModal();
        loadIssues();
    }
}

function filterIssues(state) {
    loadIssues();
}

// ===== 用户权限管理 =====
async function loadUsers() {
    const container = document.getElementById('users-table');
    if (!container) return;

    const users = await storage.getUsers();
    const search = document.getElementById('user-search')?.value?.toLowerCase() || '';
    const filtered = users.filter(u => u.username.toLowerCase().includes(search));

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>用户名</th><th>手机号</th><th>登录权限</th>
                    <th>预览权限</th><th>下载权限</th><th>会员等级</th>
                    <th>秒点余额</th><th>注册时间</th>
                </tr>
            </thead>
            <tbody>
                ${filtered.map(u => `
                    <tr>
                        <td>${u.username}</td>
                        <td>${maskPhoneLocal(u.phone)}</td>
                        <td><label class="switch switch-sm"><input type="checkbox" ${u.loginPermission ? 'checked' : ''} onchange="updateUserPermission(${u.id}, 'loginPermission', this.checked)"><span class="slider"></span></label></td>
                        <td><label class="switch switch-sm"><input type="checkbox" ${u.previewPermission ? 'checked' : ''} onchange="updateUserPermission(${u.id}, 'previewPermission', this.checked)"><span class="slider"></span></label></td>
                        <td><label class="switch switch-sm"><input type="checkbox" ${u.downloadPermission ? 'checked' : ''} onchange="updateUserPermission(${u.id}, 'downloadPermission', this.checked)"><span class="slider"></span></label></td>
                        <td>${u.vipLevel}</td>
                        <td>${(u.points || 0) + (u.monthlyPoints || 0) + (u.pointPackPoints || 0)}</td>
                        <td>${new Date(u.registeredAt).toLocaleDateString()}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function updateUserPermission(userId, permission, value) {
    const users = await storage.getUsers();
    const user = users.find(u => u.id === userId);
    if (user) {
        user[permission] = value;
        await storage.saveUsers(users);
        showToast('权限已更新', 'success');
    }
}

function maskPhoneLocal(phone) {
    if (!phone) return '-';
    return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
}

// ===== 套餐管理 =====
let currentPackageTab = 'vip';

function switchPackageTab(tab) {
    currentPackageTab = tab;
    document.querySelectorAll('#admin-page-packages .tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    loadPackages();
}

async function loadPackages() {
    const container = document.getElementById('packages-content');
    if (!container) return;

    if (currentPackageTab === 'vip') {
        const packages = await storage.getPackages();
        container.innerHTML = `
            <button class="btn btn-primary btn-sm" onclick="showPackageForm()"><i class="fas fa-plus"></i> 新建套餐</button>
            <table class="data-table">
                <thead><tr><th>名称</th><th>价格</th><th>有效期</th><th>赠送秒点</th><th>状态</th><th>操作</th></tr></thead>
                <tbody>
                    ${packages.map(p => `
                        <tr>
                            <td>${p.name}</td>
                            <td>¥${p.price}</td>
                            <td>${p.duration}</td>
                            <td>${p.dailyPoints}/${p.pointsType === 'daily' ? '日' : '月'}</td>
                            <td><span class="status-badge ${p.status === 'active' ? 'status-approved' : 'status-rejected'}">${p.status === 'active' ? '启用' : '停用'}</span></td>
                            <td>
                                <button class="btn-icon" onclick="editPackage('${p.id}')"><i class="fas fa-edit"></i></button>
                                <button class="btn-icon" onclick="togglePackageStatus('${p.id}')"><i class="fas fa-power-off"></i></button>
                                <button class="btn-icon" onclick="deletePackage('${p.id}')"><i class="fas fa-trash"></i></button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } else {
        const pointPacks = await storage.getPointPacks();
        container.innerHTML = `
            <button class="btn btn-primary btn-sm" onclick="showPointPackForm()"><i class="fas fa-plus"></i> 新建秒点包</button>
            <table class="data-table">
                <thead><tr><th>秒点数量</th><th>价格</th><th>分组</th><th>状态</th><th>操作</th></tr></thead>
                <tbody>
                    ${pointPacks.map(p => `
                        <tr>
                            <td>${p.points.toLocaleString()}</td>
                            <td>¥${p.price}</td>
                            <td>${p.group === 'recommend' ? '常用推荐' : '更具性价比'}</td>
                            <td><span class="status-badge ${p.status === 'active' ? 'status-approved' : 'status-rejected'}">${p.status === 'active' ? '启用' : '停用'}</span></td>
                            <td>
                                <button class="btn-icon" onclick="editPointPack('${p.id}')"><i class="fas fa-edit"></i></button>
                                <button class="btn-icon" onclick="deletePointPack('${p.id}')"><i class="fas fa-trash"></i></button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
}

function showPackageForm() {
    openAdminModal('新建会员套餐', `
        <div class="form-group"><label>套餐名称</label><input type="text" id="pkg-name" placeholder="如：专业版"></div>
        <div class="form-group"><label>价格</label><input type="number" id="pkg-price" placeholder="14.90"></div>
        <div class="form-group"><label>有效期</label><select id="pkg-duration"><option>1个月</option><option>3个月</option><option>6个月</option><option>1年</option><option>永久有效</option></select></div>
        <div class="form-group"><label>赠送秒点类型</label><select id="pkg-points-type"><option value="daily">每日</option><option value="monthly">每月</option></select></div>
        <div class="form-group"><label>赠送秒点数量</label><input type="number" id="pkg-points" placeholder="100"></div>
        <div class="form-group"><label>权益清单（每行一个）</label><textarea id="pkg-benefits" rows="4" placeholder="素材库容量&#10;并发数&#10;去水印"></textarea></div>
        <div class="modal-actions">
            <button class="btn btn-primary" onclick="savePackage()">保存</button>
            <button class="btn btn-outline" onclick="closeAdminModal()">取消</button>
        </div>
    `);
}

async function savePackage() {
    const packages = await storage.getPackages();
    const newPackage = {
        id: 'pkg_' + Date.now(),
        name: document.getElementById('pkg-name').value,
        price: parseFloat(document.getElementById('pkg-price').value),
        duration: document.getElementById('pkg-duration').value,
        pointsType: document.getElementById('pkg-points-type').value,
        dailyPoints: parseInt(document.getElementById('pkg-points').value),
        benefits: document.getElementById('pkg-benefits').value.split('\n').filter(Boolean),
        status: 'active',
    };

    // 检查重名
    if (packages.find(p => p.name === newPackage.name)) {
        showToast('该套餐名称已存在，请更换', 'error');
        return;
    }

    packages.push(newPackage);
    await storage.write(CONFIG.DATA_PATHS.packages, packages);
    showToast('套餐创建成功', 'success');
    closeAdminModal();
    loadPackages();
}

function showPointPackForm() {
    openAdminModal('新建秒点包', `
        <div class="form-group"><label>秒点数量</label><input type="number" id="pp-points" placeholder="1000"></div>
        <div class="form-group"><label>价格</label><input type="number" id="pp-price" placeholder="9.9" step="0.1"></div>
        <div class="form-group"><label>分组</label><select id="pp-group"><option value="recommend">常用推荐</option><option value="value">更具性价比</option></select></div>
        <div class="modal-actions">
            <button class="btn btn-primary" onclick="savePointPack()">保存</button>
            <button class="btn btn-outline" onclick="closeAdminModal()">取消</button>
        </div>
    `);
}

async function savePointPack() {
    const pointPacks = await storage.getPointPacks();
    const newPack = {
        id: 'pp_' + Date.now(),
        points: parseInt(document.getElementById('pp-points').value),
        price: parseFloat(document.getElementById('pp-price').value),
        group: document.getElementById('pp-group').value,
        status: 'active',
    };
    pointPacks.push(newPack);
    await storage.write(CONFIG.DATA_PATHS.pointPacks, pointPacks);
    showToast('秒点包创建成功', 'success');
    closeAdminModal();
    loadPackages();
}

// ===== 优惠券管理 =====
function showCouponForm() {
    openAdminModal('新建优惠券', `
        <div class="form-group"><label>优惠码</label><input type="text" id="coupon-code-input" placeholder="如：SUMMER20"></div>
        <div class="form-group"><label>折扣比例</label><input type="number" id="coupon-discount" placeholder="0.8" min="0.1" max="1" step="0.01"></div>
        <div class="form-group"><label>有效期起</label><input type="date" id="coupon-valid-from"></div>
        <div class="form-group"><label>有效期至</label><input type="date" id="coupon-valid-to"></div>
        <div class="form-group"><label>使用次数上限</label><input type="number" id="coupon-max-uses" placeholder="100"></div>
        <div class="modal-actions">
            <button class="btn btn-primary" onclick="saveCoupon()">保存</button>
            <button class="btn btn-outline" onclick="closeAdminModal()">取消</button>
        </div>
    `);
}

async function saveCoupon() {
    const coupons = await storage.getCoupons();
    const newCoupon = {
        code: document.getElementById('coupon-code-input').value,
        discount: parseFloat(document.getElementById('coupon-discount').value),
        validFrom: document.getElementById('coupon-valid-from').value,
        validTo: document.getElementById('coupon-valid-to').value,
        maxUses: parseInt(document.getElementById('coupon-max-uses').value),
        usedCount: 0,
        status: 'active',
    };

    if (coupons.find(c => c.code === newCoupon.code)) {
        showToast('该优惠码已存在，请更换', 'error');
        return;
    }

    coupons.push(newCoupon);
    await storage.saveCoupons(coupons);
    showToast('优惠券创建成功', 'success');
    closeAdminModal();
    loadCoupons();
}

async function loadCoupons() {
    const container = document.getElementById('coupons-table');
    if (!container) return;
    const coupons = await storage.getCoupons();

    container.innerHTML = `
        <table class="data-table">
            <thead><tr><th>优惠码</th><th>折扣</th><th>有效期</th><th>使用次数</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>
                ${coupons.map(c => `
                    <tr>
                        <td><code>${c.code}</code></td>
                        <td>${c.discount * 10}折</td>
                        <td>${c.validFrom} ~ ${c.validTo}</td>
                        <td>${c.usedCount}/${c.maxUses}</td>
                        <td><span class="status-badge ${c.status === 'active' ? 'status-approved' : 'status-rejected'}">${c.status === 'active' ? '启用' : '停用'}</span></td>
                        <td>
                            <button class="btn-icon" onclick="toggleCouponStatus('${c.code}')"><i class="fas fa-power-off"></i></button>
                            <button class="btn-icon" onclick="deleteCouponItem('${c.code}')"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// ===== 订单审批 =====
async function loadApprovals() {
    const container = document.getElementById('approvals-table');
    if (!container) return;

    const orders = await storage.getOrders();
    const pending = orders.filter(o => o.status === 'pending');

    container.innerHTML = `
        <table class="data-table">
            <thead><tr><th>订单号</th><th>用户</th><th>类型</th><th>名称</th><th>价格</th><th>优惠码</th><th>付款凭证</th><th>提交时间</th><th>操作</th></tr></thead>
            <tbody>
                ${pending.map(o => `
                    <tr>
                        <td>${o.id}</td>
                        <td>${o.username}</td>
                        <td>${o.type}</td>
                        <td>${o.itemName}</td>
                        <td>¥${o.discountedPrice || o.price}</td>
                        <td>${o.couponCode || '-'}</td>
                        <td><i class="fas fa-receipt"></i> ${o.paymentProof}</td>
                        <td>${new Date(o.createdAt).toLocaleString()}</td>
                        <td>
                            <button class="btn btn-sm btn-success" onclick="approveOrder('${o.id}')"><i class="fas fa-check"></i> 通过</button>
                            <button class="btn btn-sm btn-danger" onclick="rejectOrder('${o.id}')"><i class="fas fa-times"></i> 拒绝</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function approveOrder(orderId) {
    const orders = await storage.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const user = (await storage.getUsers()).find(u => u.id === order.userId);
    if (user) {
        // 根据订单类型处理
        if (order.type === '会员套餐') {
            user.vipLevel = order.itemName.includes('旗舰') ? 'flagship' : order.itemName.includes('专业') ? 'pro' : 'pro';
            // 设置有效期
            const pkg = CONFIG.DEFAULT_PACKAGES.find(p => p.name === order.itemName);
            if (pkg) {
                const durationMs = pkg.duration === '1个月' ? 30 * 86400000 :
                    pkg.duration === '1年' ? 365 * 86400000 : 30 * 86400000;
                user.vipExpireAt = new Date(Date.now() + durationMs).toISOString();
            }
        } else if (order.type === '秒点包') {
            const pack = CONFIG.DEFAULT_POINT_PACKS.find(p => p.name === order.itemName) || { points: 1000 };
            user.pointPackPoints = (user.pointPackPoints || 0) + pack.points;
        } else if (order.type === '卡券') {
            // 生成兑换码
            order.redeemCode = 'CODE' + Date.now();
        }

        // 更新优惠码使用次数
        if (order.couponCode) {
            const coupons = await storage.getCoupons();
            const coupon = coupons.find(c => c.code === order.couponCode);
            if (coupon) { coupon.usedCount++; await storage.saveCoupons(coupons); }
        }

        await storage.saveUsers(await storage.getUsers());
    }

    order.status = 'approved';
    order.approvedAt = new Date().toISOString();
    await storage.saveOrders(orders);

    // 处理邀请返利
    await processInviteReward(order.userId);

    showToast('订单已通过', 'success');
    loadApprovals();
}

async function rejectOrder(orderId) {
    const reason = prompt('请输入拒绝原因：');
    if (reason === null) return;

    const orders = await storage.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (order) {
        order.status = 'rejected';
        order.rejectReason = reason;
        order.rejectedAt = new Date().toISOString();
        await storage.saveOrders(orders);
        showToast('订单已拒绝', 'success');
        loadApprovals();
    }
}

async function processInviteReward(userId) {
    const invitations = JSON.parse(localStorage.getItem('piggy__data/invitations.json') || '{}');
    const config = await storage.getConfig();

    for (const [inviterId, invites] of Object.entries(invitations)) {
        const invite = invites.find(i => i.inviteeId === userId && i.status === 'pending');
        if (invite) {
            invite.firstPurchaseAt = new Date().toISOString();
            invite.rewardPoints = config.inviteReward || 100;
            invite.status = 'rewarded';

            // 发放奖励给邀请人
            const users = await storage.getUsers();
            const inviter = users.find(u => u.id === parseInt(inviterId));
            if (inviter) {
                inviter.pointPackPoints = (inviter.pointPackPoints || 0) + invite.rewardPoints;
                await storage.saveUsers(users);
            }
            localStorage.setItem('piggy__data/invitations.json', JSON.stringify(invitations));
            break;
        }
    }
}

// ===== 订单记录 =====
async function loadOrdersRecord() {
    const container = document.getElementById('orders-record-table');
    if (!container) return;

    const orders = await storage.getOrders();
    container.innerHTML = `
        <div class="filters">
            <select onchange="filterOrdersRecord(this.value)">
                <option value="">全部状态</option>
                <option value="pending">待审批</option>
                <option value="approved">已通过</option>
                <option value="rejected">已拒绝</option>
                <option value="refunding">退款中</option>
                <option value="refunded">已退款</option>
            </select>
            <input type="text" placeholder="搜索用户名..." oninput="searchOrdersRecord(this.value)">
        </div>
        <table class="data-table">
            <thead><tr><th>订单号</th><th>用户</th><th>类型</th><th>名称</th><th>价格</th><th>状态</th><th>退款状态</th><th>时间</th></tr></thead>
            <tbody>
                ${orders.slice().reverse().map(o => `
                    <tr>
                        <td>${o.id}</td>
                        <td>${o.username}</td>
                        <td>${o.type}</td>
                        <td>${o.itemName}</td>
                        <td>¥${o.discountedPrice || o.price}</td>
                        <td><span class="status-badge status-${o.status}">${getStatusText(o.status)}</span></td>
                        <td>${o.refundStatus ? getStatusText(o.refundStatus) : '-'}</td>
                        <td>${new Date(o.createdAt).toLocaleString()}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// ===== 用户额度 =====
async function loadQuotas() {
    const container = document.getElementById('quotas-table');
    if (!container) return;

    const users = await storage.getUsers();
    container.innerHTML = `
        <table class="data-table">
            <thead><tr><th>用户名</th><th>会员等级</th><th>赠送秒点剩余</th><th>秒点包秒点</th><th>总秒点</th><th>有效套餐</th></tr></thead>
            <tbody>
                ${users.map(u => {
                    const totalPoints = (u.points || 0) + (u.monthlyPoints || 0) + (u.pointPackPoints || 0);
                    return `
                        <tr>
                            <td>${u.username}</td>
                            <td>${u.vipLevel}</td>
                            <td>${u.points || 0}</td>
                            <td>${u.pointPackPoints || 0}</td>
                            <td><strong>${totalPoints}</strong></td>
                            <td>${u.vipExpireAt ? `至 ${new Date(u.vipExpireAt).toLocaleDateString()}` : '-'}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

// ===== 退款审批 =====
async function loadRefunds() {
    const container = document.getElementById('refunds-table');
    if (!container) return;

    const refunds = await storage.getRefunds();
    const orders = await storage.getOrders();
    const orderMap = {};
    orders.forEach(o => orderMap[o.id] = o);

    container.innerHTML = `
        <table class="data-table">
            <thead><tr><th>订单号</th><th>用户</th><th>类型</th><th>名称</th><th>价格</th><th>退款原因</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>
                ${refunds.map(r => `
                    <tr>
                        <td>${r.orderId}</td>
                        <td>${orderMap[r.orderId]?.username || '-'}</td>
                        <td>${r.type}</td>
                        <td>${r.itemName}</td>
                        <td>¥${r.price}</td>
                        <td>${r.reason}</td>
                        <td><span class="status-badge status-${r.status}">${getStatusText(r.status)}</span></td>
                        <td>
                            ${r.status === 'refunding' ? `
                                <button class="btn btn-sm btn-success" onclick="approveRefund('${r.orderId}')"><i class="fas fa-check"></i> 批准</button>
                                <button class="btn btn-sm btn-danger" onclick="rejectRefund('${r.orderId}')"><i class="fas fa-times"></i> 拒绝</button>
                            ` : ''}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function approveRefund(orderId) {
    const orders = await storage.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const user = (await storage.getUsers()).find(u => u.id === order.userId);
    if (user) {
        if (order.type === '会员套餐') {
            user.vipLevel = 'free';
            user.points = 3; // 恢复免费版每日秒点
            user.monthlyPoints = 0;
        } else if (order.type === '秒点包') {
            const pack = CONFIG.DEFAULT_POINT_PACKS.find(p => p.name === order.itemName) || { points: 0 };
            user.pointPackPoints = Math.max(0, (user.pointPackPoints || 0) - pack.points);
        } else if (order.type === '卡券') {
            order.redeemCode = null; // 作废兑换码
        }
        await storage.saveUsers(await storage.getUsers());
    }

    order.status = 'refunded';
    order.refundStatus = 'refunded';
    await storage.saveOrders(orders);

    const refunds = await storage.getRefunds();
    const refund = refunds.find(r => r.orderId === orderId);
    if (refund) refund.status = 'refunded';
    await storage.saveRefunds(refunds);

    showToast('退款已批准', 'success');
    loadRefunds();
}

async function rejectRefund(orderId) {
    const reason = prompt('请输入拒绝原因：');
    if (reason === null) return;

    const orders = await storage.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (order) {
        order.status = 'refundRejected';
        order.refundStatus = 'refundRejected';
        order.refundRejectReason = reason;
        await storage.saveOrders(orders);
    }

    const refunds = await storage.getRefunds();
    const refund = refunds.find(r => r.orderId === orderId);
    if (refund) refund.status = 'refundRejected';
    await storage.saveRefunds(refunds);

    showToast('退款已拒绝', 'success');
    loadRefunds();
}

// ===== 公告管理 =====
function showAnnouncementForm() {
    openAdminModal('新建公告', `
        <div class="form-group"><label>公告标题</label><input type="text" id="ann-title" placeholder="公告标题"></div>
        <div class="form-group"><label>公告内容</label><textarea id="ann-content" rows="6" placeholder="支持富文本（演示模式为纯文本）"></textarea></div>
        <div class="form-group"><label>是否启用</label><label class="switch"><input type="checkbox" id="ann-enabled" checked><span class="slider"></span></label></div>
        <div class="form-group"><label>排序（数字越小越靠前）</label><input type="number" id="ann-sort" value="1"></div>
        <div class="modal-actions">
            <button class="btn btn-primary" onclick="saveAnnouncement()">保存</button>
            <button class="btn btn-outline" onclick="closeAdminModal()">取消</button>
        </div>
    `);
}

async function saveAnnouncement() {
    const title = document.getElementById('ann-title').value;
    if (!title) { showToast('请输入公告标题', 'error'); return; }

    const announcements = await storage.getAnnouncements();
    announcements.push({
        id: Date.now().toString(),
        title,
        content: document.getElementById('ann-content').value,
        enabled: document.getElementById('ann-enabled').checked,
        sort: parseInt(document.getElementById('ann-sort').value) || 1,
        createdAt: new Date().toISOString(),
    });

    await storage.saveAnnouncements(announcements);
    showToast('公告已保存', 'success');
    closeAdminModal();
    loadAnnouncementsAdmin();
}

async function loadAnnouncementsAdmin() {
    const container = document.getElementById('announcements-table');
    if (!container) return;

    const announcements = await storage.getAnnouncements();
    container.innerHTML = `
        <table class="data-table">
            <thead><tr><th>标题</th><th>内容摘要</th><th>启用</th><th>排序</th><th>创建时间</th><th>操作</th></tr></thead>
            <tbody>
                ${announcements.map(a => `
                    <tr>
                        <td>${a.title}</td>
                        <td>${a.content?.substring(0, 50) || ''}</td>
                        <td><span class="status-badge ${a.enabled ? 'status-approved' : 'status-rejected'}">${a.enabled ? '是' : '否'}</span></td>
                        <td>${a.sort}</td>
                        <td>${new Date(a.createdAt).toLocaleDateString()}</td>
                        <td>
                            <button class="btn-icon" onclick="editAnnouncement('${a.id}')"><i class="fas fa-edit"></i></button>
                            <button class="btn-icon" onclick="toggleAnnouncement('${a.id}')"><i class="fas fa-power-off"></i></button>
                            <button class="btn-icon" onclick="deleteAnnouncement('${a.id}')"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// ===== 流量统计 =====
async function loadTraffic() {
    const container = document.getElementById('traffic-table');
    if (!container) return;

    // 从下载日志聚合
    const logs = JSON.parse(localStorage.getItem('piggy__data/download-logs.json') || '[]');
    const fileStats = {};

    logs.forEach(log => {
        if (!fileStats[log.fileName]) {
            fileStats[log.fileName] = { count: 0, totalSize: 0 };
        }
        fileStats[log.fileName].count++;
        fileStats[log.fileName].totalSize += log.fileSize || 0;
    });

    const stats = Object.entries(fileStats).map(([name, data]) => ({ name, ...data }));

    container.innerHTML = `
        <table class="data-table">
            <thead><tr><th>文件名</th><th>累计下载次数</th><th>累计下载流量</th></tr></thead>
            <tbody>
                ${stats.length === 0
                    ? '<tr><td colspan="3" class="text-center">暂无下载数据</td></tr>'
                    : stats.sort((a, b) => b.count - a.count).map(s => `
                        <tr>
                            <td>${s.name}</td>
                            <td>${s.count}</td>
                            <td>${formatSize(s.totalSize)}</td>
                        </tr>
                    `).join('')
                }
            </tbody>
        </table>
    `;
}

// ===== 访问统计 =====
async function loadVisitors() {
    const container = document.getElementById('visitors-stats');
    if (!container) return;

    const stats = JSON.parse(localStorage.getItem('piggy__data/visitor-stats.json') || '[]');

    container.innerHTML = `
        <div class="visitor-summary">
            <div class="stat-card">
                <h3>累计 UV</h3>
                <span class="stat-number">${stats.reduce((s, d) => s + d.uv, 0)}</span>
            </div>
            <div class="stat-card">
                <h3>累计 PV</h3>
                <span class="stat-number">${stats.reduce((s, d) => s + d.pv, 0)}</span>
            </div>
        </div>
        <table class="data-table">
            <thead><tr><th>日期</th><th>UV</th><th>PV</th></tr></thead>
            <tbody>
                ${stats.slice().reverse().map(s => `
                    <tr>
                        <td>${s.date}</td>
                        <td>${s.uv}</td>
                        <td>${s.pv}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// ===== 弹窗工具 =====
function openAdminModal(title, bodyHtml) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('admin-modal').style.display = 'block';
}

function closeAdminModal() {
    document.getElementById('admin-modal').style.display = 'none';
}

// 点击弹窗外部关闭
document.getElementById('admin-modal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('admin-modal')) closeAdminModal();
});

// ===== 工具函数 =====
function getStatusText(status) {
    const map = {
        pending: '待审批', approved: '已通过', rejected: '已拒绝',
        refunding: '退款中', refunded: '已退款', refundRejected: '退款拒绝',
        active: '启用', inactive: '停用',
    };
    return map[status] || status;
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'times' : 'info'}"></i> ${message}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
}
