/**
 * 小猪猪教育数字资源库 - 公开资源分享页面
 */

document.addEventListener('DOMContentLoaded', () => {
    loadSharePage();
    loadAnnouncements();
});

let shareCurrentFolder = '';
let shareCurrentSource = 'all';

async function loadSharePage() {
    await loadShareFiles();
    await loadShareReleases();
}

async function loadShareFiles() {
    const container = document.getElementById('share-file-list');
    if (!container) return;

    try {
        const contents = await storage.getRepoContents(storage.shareRepo, shareCurrentFolder);

        let allItems = contents.map(i => ({ ...i, source: 'repo' }));

        if (shareCurrentSource !== 'repo') {
            const releases = await storage.getReleases(storage.shareRepo);
            const assets = releases.flatMap(r => (r.assets || []).map(a => ({
                name: a.name, size: a.size, updated: a.updated_at || a.created_at,
                source: 'release', releaseName: r.name || r.tag_name,
                downloadUrl: a.browser_download_url,
            })));
            allItems = shareCurrentSource === 'release' ? assets : [...allItems, ...assets];
        }

        container.innerHTML = allItems.map(item => {
            if (item.type === 'dir') {
                return `
                    <div class="file-item folder" onclick="enterShareFolder('${item.path}')">
                        <i class="fas fa-folder"></i>
                        <span class="file-name">${item.name}</span>
                        <span class="file-type">文件夹</span>
                    </div>
                `;
            }

            return `
                <div class="file-item">
                    <i class="fas ${getFileIcon(item.name)}"></i>
                    <span class="file-name">${item.name}</span>
                    <span class="file-size">${formatSize(item.size)}</span>
                    <span class="file-source source-${item.source}">${item.source === 'release' ? 'Release附件' : '仓库文件'}</span>
                    <div class="file-actions">
                        <button class="btn-icon" onclick="previewShareFile('${item.name}')" title="预览"><i class="fas fa-eye"></i></button>
                        <button class="btn-icon" onclick="downloadShareFile('${item.name}', '${item.source}')" title="下载"><i class="fas fa-download"></i></button>
                    </div>
                </div>
            `;
        }).join('');

        updateShareBreadcrumb();
    } catch (e) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-folder-open"></i><p>暂无文件</p></div>';
    }
}

function enterShareFolder(path) {
    shareCurrentFolder = path;
    loadShareFiles();
}

function updateShareBreadcrumb() {
    const breadcrumb = document.querySelector('#share-file-list').previousElementSibling;
}

function switchFileSource(source) {
    shareCurrentSource = source;
    document.querySelectorAll('.file-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.file-tab[data-source="${source}"]`).classList.add('active');
    loadShareFiles();
}

async function loadShareReleases() {
    const container = document.getElementById('share-releases-list');
    if (!container) return;

    const releases = await storage.getReleases(storage.shareRepo);
    container.innerHTML = releases.map(r => `
        <div class="release-card">
            <span class="release-tag">${r.tag_name}</span>
            <span class="release-date">${new Date(r.published_at).toLocaleDateString()}</span>
            <p class="release-body">${r.body || ''}</p>
        </div>
    `).join('');
}

function previewShareFile(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    const url = `${CONFIG.API.cdnBase}/${storage.owner}/${storage.shareRepo}@${CONFIG.GITHUB.branch}/${shareCurrentFolder}/${fileName}`;
    const container = document.getElementById('preview-container');

    if (['mp4', 'mov', 'avi', 'webm'].includes(ext)) {
        container.innerHTML = `<video controls autoplay style="width:100%;max-height:70vh;"><source src="${url}"></video>`;
    } else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
        container.innerHTML = `<img src="${url}" style="max-width:100%;max-height:70vh;">`;
    } else if (ext === 'pdf') {
        container.innerHTML = `<iframe src="${url}" style="width:100%;height:70vh;border:none;"></iframe>`;
    } else {
        container.innerHTML = `<p class="text-center"><i class="fas fa-file-alt fa-3x"></i><br>该文件类型暂不支持在线预览，请下载后查看</p>`;
    }

    document.getElementById('preview-title').textContent = fileName;
    document.getElementById('preview-modal').style.display = 'block';
}

function closePreview() {
    document.getElementById('preview-modal').style.display = 'none';
}

function downloadShareFile(fileName, source) {
    const url = `${CONFIG.API.cdnBase}/${storage.owner}/${storage.shareRepo}@${CONFIG.GITHUB.branch}/${shareCurrentFolder}/${fileName}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
}

async function loadAnnouncements() {
    const announcements = await storage.getAnnouncements();
    const enabled = announcements.filter(a => a.enabled).sort((a, b) => a.sort - b.sort);

    const banner = document.getElementById('announcement-banner');
    const content = banner?.querySelector('.banner-content');

    if (content && enabled.length > 0) {
        content.innerHTML = enabled.map(a => `<span class="banner-item">📢 ${a.title}</span>`).join('');
        banner.style.display = 'block';
    } else if (banner) {
        banner.style.display = 'none';
    }
}

function closeBanner() {
    document.getElementById('announcement-banner').style.display = 'none';
}

function formatSize(bytes) {
    if (!bytes || bytes === 0) return '-';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
    return `${bytes.toFixed(1)} ${units[i]}`;
}

function getFileIcon(name) {
    const ext = name.split('.').pop().toLowerCase();
    const map = {
        pdf: 'fa-file-pdf', mp4: 'fa-file-video', jpg: 'fa-file-image', png: 'fa-file-image',
        docx: 'fa-file-word', zip: 'fa-file-archive',
    };
    return map[ext] || 'fa-file';
}
