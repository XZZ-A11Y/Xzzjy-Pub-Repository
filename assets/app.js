/**
 * 小猪猪教育数字资源库 - 主应用逻辑（学生端）
 */

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    // 恢复夜间模式
    const nightMode = localStorage.getItem('night-mode');
    if (nightMode === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.getElementById('night-icon').className = 'fas fa-sun';
    }

    // 检查是否已登录
    if (auth.isLoggedIn()) {
        const user = auth.getCurrentUser();
        // 检查登录权限
        const users = await storage.getUsers();
        const fresh = users.find(u => u.id === user.id);
        if (fresh && !fresh.loginPermission) {
            showToast('您的账号登录权限已被关闭，请联系管理员', 'error');
            localStorage.removeItem('current_user');
        } else {
            showApp();
            return;
        }
    }

    // 检查 URL 中是否有 GitHub OAuth 回调参数
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    if (code && state) {
        // 处理 OAuth 回调
        handleOAuthCallback(code, state);
        return;
    }

    showAuth();
}

function showAuth() {
    document.getElementById('auth-area').style.display = 'flex';
    document.getElementById('app-area').style.display = 'none';
}

// ===== 表单处理 =====
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const success = await auth.login(username, password);
    if (success) showApp();
});

document.getElementById('register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userData = {
        username: document.getElementById('reg-username').value,
        phone: document.getElementById('reg-phone').value,
        password: document.getElementById('reg-password').value,
        confirmPassword: document.getElementById('reg-confirm').value,
        inviteCode: document.getElementById('reg-invite').value,
        captcha: document.getElementById('reg-captcha').value,
    };
    const success = await auth.register(userData);
    if (success) switchTab('login');
});

document.getElementById('forgot-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userData = {
        username: document.getElementById('forgot-username').value,
        phone: document.getElementById('forgot-phone').value,
        newPassword: document.getElementById('forgot-new-password').value,
        confirmPassword: document.getElementById('forgot-confirm').value,
        captcha: document.getElementById('forgot-captcha').value,
    };
    const success = await auth.forgotPassword(userData);
    if (success) switchTab('login');
});

function sendCaptcha() {
    const phone = document.getElementById('reg-phone').value;
    auth.sendCaptcha(phone);
}

function sendForgotCaptcha() {
    const phone = document.getElementById('forgot-phone').value;
    auth.sendCaptcha(phone);
}

function githubLogin() {
    auth.githubLogin();
}

// ===== 首页加载 =====
let currentFolder = '';
let currentSource = 'all';

async function loadHomePage() {
    await loadFileList();
    await loadReleases();
    await loadTags();
}

async function loadFileList() {
    const container = document.getElementById('file-list');
    if (!container) return;

    container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> 加载中...</div>';

    try {
        const contents = await storage.getRepoContents(storage.mainRepo, currentFolder);

        let items = contents;
        if (currentSource === 'repo') {
            items = contents.filter(i => i.type === 'file' || i.type === 'dir');
        } else if (currentSource === 'release') {
            // Release 附件通过 getReleases 获取
            const releases = await storage.getReleases(storage.mainRepo);
            items = releases.flatMap(r => r.assets || []);
        }

        // 合并仓库文件和 Release 附件
        let allItems = [];
        if (currentSource !== 'release') {
            const repoItems = contents.filter(i => i.type === 'file' || i.type === 'dir');
            allItems = repoItems.map(i => ({ ...i, source: 'repo' }));
        }
        if (currentSource !== 'repo') {
            const releases = await storage.getReleases(storage.mainRepo);
            const assets = releases.flatMap(r => (r.assets || []).map(a => ({
                name: a.name, size: a.size, updated: a.updated_at || a.created_at,
                source: 'release', releaseName: r.name || r.tag_name,
                downloadUrl: a.browser_download_url, assetId: a.id,
            })));
            allItems = [...allItems, ...assets];
        }

        // 获取评分
        const reviews = JSON.parse(localStorage.getItem('piggy__data/reviews.json') || '{}');

        container.innerHTML = allItems.map(item => {
            const rating = getAverageRating(item.name, reviews);
            const stars = '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));

            if (item.type === 'dir') {
                return `
                    <div class="file-item folder" onclick="enterFolder('${item.path}')">
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
                    <span class="file-rating">${stars} (${rating.toFixed(1)})</span>
                    <div class="file-actions">
                        <button class="btn-icon" onclick="previewFile('${item.name}', '${item.source}')" title="在线查看"><i class="fas fa-eye"></i></button>
                        <button class="btn-icon" onclick="downloadFile('${item.name}', '${item.source}', ${item.size || 0})" title="下载"><i class="fas fa-download"></i></button>
                        <button class="btn-icon" onclick="addToQueue('${item.name}', ${item.size || 0})" title="加入队列"><i class="fas fa-plus-circle"></i></button>
                        <button class="btn-icon" onclick="addToFavorites('${item.name}')" title="收藏"><i class="fas fa-heart"></i></button>
                        <button class="btn-icon" onclick="showReviewModal('${item.name}')" title="评价"><i class="fas fa-star"></i></button>
                    </div>
                </div>
            `;
        }).join('');

        // 更新面包屑
        updateBreadcrumb();

    } catch (e) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-folder-open"></i><p>暂无文件</p></div>';
    }
}

function getAverageRating(fileName, reviews) {
    if (!reviews[fileName] || reviews[fileName].length === 0) return 0;
    const sum = reviews[fileName].reduce((s, r) => s + r.rating, 0);
    return sum / reviews[fileName].length;
}

function getFileIcon(name) {
    const ext = name.split('.').pop().toLowerCase();
    const map = {
        pdf: 'fa-file-pdf', mp4: 'fa-file-video', mov: 'fa-file-video', avi: 'fa-file-video',
        jpg: 'fa-file-image', png: 'fa-file-image', gif: 'fa-file-image',
        docx: 'fa-file-word', xlsx: 'fa-file-excel', pptx: 'fa-file-powerpoint',
        zip: 'fa-file-archive', rar: 'fa-file-archive',
        mp3: 'fa-file-audio', wav: 'fa-file-audio',
        txt: 'fa-file-alt', md: 'fa-file-alt',
    };
    return map[ext] || 'fa-file';
}

function formatSize(bytes) {
    if (!bytes || bytes === 0) return '-';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
    return `${bytes.toFixed(1)} ${units[i]}`;
}

function enterFolder(path) {
    currentFolder = path;
    loadFileList();
}

function updateBreadcrumb() {
    const breadcrumb = document.getElementById('breadcrumb');
    if (!breadcrumb) return;
    const parts = currentFolder.split('/').filter(Boolean);
    let html = '<a href="#" onclick="goHome()"><i class="fas fa-home"></i></a>';
    let path = '';
    parts.forEach(part => {
        path += '/' + part;
        html += ` / <a href="#" onclick="enterFolder('${path.slice(1)}')">${part}</a>`;
    });
    breadcrumb.innerHTML = html;
}

function goHome() {
    currentFolder = '';
    loadFileList();
}

function switchFileSource(source) {
    currentSource = source;
    document.querySelectorAll('.file-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.file-tab[data-source="${source}"]`).classList.add('active');
    loadFileList();
}

async function loadReleases() {
    const container = document.getElementById('releases-list');
    if (!container) return;
    const releases = await storage.getReleases(storage.mainRepo);
    container.innerHTML = releases.map(r => `
        <div class="release-card">
            <span class="release-tag">${r.tag_name}</span>
            <span class="release-date">${new Date(r.published_at).toLocaleDateString()}</span>
            <p class="release-body">${r.body || ''}</p>
            <div class="release-assets">
                ${(r.assets || []).map(a => `<span class="asset-tag"><i class="fas fa-paperclip"></i> ${a.name}</span>`).join('')}
            </div>
        </div>
    `).join('');
}

async function loadTags() {
    const container = document.getElementById('tags-list');
    if (!container) return;
    const tags = await storage.getTags(storage.mainRepo);
    container.innerHTML = tags.map(t => `
        <div class="tag-item">
            <i class="fas fa-tag"></i>
            <span>${t.name}</span>
            <span class="tag-date">${new Date(t.commit?.created_at || Date.now()).toLocaleDateString()}</span>
        </div>
    `).join('');
}

// ===== 文件操作 =====
async function previewFile(fileName, source) {
    const user = auth.getCurrentUser();
    if (!user.previewPermission) {
        showToast('您暂无预览权限，请联系管理员', 'error');
        return;
    }

    // 检查 SMS 验证（同一会话验证一次）
    if (!auth.verifiedSMS) {
        showSMSModal(() => {
            openViewer(fileName, source);
        });
        return;
    }

    openViewer(fileName, source);
}

function openViewer(fileName, source) {
    const modal = document.getElementById('viewer-modal');
    document.getElementById('viewer-title').textContent = fileName;
    const container = document.getElementById('viewer-container');

    const ext = fileName.split('.').pop().toLowerCase();
    if (['mp4', 'mov', 'avi', 'webm'].includes(ext)) {
        container.innerHTML = `<video controls autoplay style="width:100%;max-height:60vh;"><source src="${getFileUrl(fileName)}"></video>`;
    } else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
        container.innerHTML = `<img src="${getFileUrl(fileName)}" style="max-width:100%;max-height:60vh;">`;
    } else if (ext === 'pdf') {
        container.innerHTML = `<iframe src="${getFileUrl(fileName)}" style="width:100%;height:60vh;border:none;"></iframe>`;
    } else {
        container.innerHTML = '<p class="text-center"><i class="fas fa-file-alt fa-3x"></i><br>该文件类型暂不支持在线查看，请下载后查看</p>';
    }

    modal.style.display = 'block';

    // 记录学习进度
    recordLearningProgress(fileName);
}

function getFileUrl(fileName) {
    // 通过 CDN 获取文件
    return `${CONFIG.API.cdnBase}/${storage.owner}/${storage.mainRepo}@${CONFIG.GITHUB.branch}/${currentFolder}/${fileName}`;
}

function closeViewer() {
    document.getElementById('viewer-modal').style.display = 'none';
}

async function downloadFile(fileName, source, fileSize) {
    const user = auth.getCurrentUser();
    if (!user.downloadPermission) {
        showToast('您暂无下载权限，请联系管理员', 'error');
        return;
    }

    // 扣减秒点
    const success = await auth.consumePoints(CONFIG.POINTS_RULES.downloadCost);
    if (!success) return;

    // 记录下载
    recordDownload(fileName, fileSize);

    // 触发下载
    const url = getFileUrl(fileName);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();

    showToast(`下载开始：${fileName}`, 'success');
    auth.updateUI();
}

// ===== SMS 验证 =====
function showSMSModal(callback) {
    const user = auth.getCurrentUser();
    if (!user) return;

    document.getElementById('sms-phone').textContent = maskPhone(user.phone);
    document.getElementById('sms-modal').style.display = 'block';
    window.smsCallback = callback;
}

function maskPhone(phone) {
    if (!phone) return '***';
    return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
}

function sendSMS() {
    const user = auth.getCurrentUser();
    if (user) {
        auth.sendCaptcha(user.phone);
    }
}

function verifySMS() {
    const code = document.getElementById('sms-code').value;
    const user = auth.getCurrentUser();
    if (!user) return;

    const saved = auth.smsCodes.get(user.phone);
    if (!saved || saved.code !== code) {
        showToast('验证码错误，请重新输入', 'error');
        return;
    }
    if (Date.now() - saved.time > 5 * 60 * 1000) {
        showToast('验证码已过期，请重新获取', 'error');
        return;
    }

    auth.verifiedSMS = true;
    closeSMSModal();
    if (window.smsCallback) window.smsCallback();
}

function closeSMSModal() {
    document.getElementById('sms-modal').style.display = 'none';
}

// ===== AI 问答 =====
function screenshotQuestion() {
    // 模拟截图提问
    const chat = document.getElementById('ai-chat');
    chat.innerHTML += `
        <div class="ai-message user">
            <i class="fas fa-user"></i>
            <div class="msg-content">[截图] 这个问题怎么理解？</div>
        </div>
        <div class="ai-message bot">
            <i class="fas fa-robot"></i>
            <div class="msg-content">
                <p>这是一个很好的问题！让我通过动画来为你演示...</p>
                <div class="ai-video-placeholder"><i class="fas fa-film"></i> 动画视频生成中...</div>
                <div class="ai-voice-placeholder"><i class="fas fa-volume-up"></i> 语音朗读中...</div>
            </div>
        </div>
    `;
    chat.scrollTop = chat.scrollHeight;
}

function voiceQuestion() {
    showToast('语音识别功能需要浏览器麦克风权限', 'info');
    // 模拟语音识别
    setTimeout(() => {
        const chat = document.getElementById('ai-chat');
        chat.innerHTML += `
            <div class="ai-message user">
                <i class="fas fa-microphone"></i>
                <div class="msg-content">[语音] 请解释一下这个概念</div>
            </div>
            <div class="ai-message bot">
                <i class="fas fa-robot"></i>
                <div class="msg-content">
                    <p>好的，我来为你详细解答...</p>
                    <div class="ai-video-placeholder"><i class="fas fa-film"></i> 动画视频生成中...</div>
                </div>
            </div>
        `;
        chat.scrollTop = chat.scrollHeight;
    }, 1500);
}

// ===== 购买中心 =====
function loadPurchasePage() {
    // 默认加载会员套餐
    switchPurchaseTab('vip');
}

async function switchPurchaseTab(tab) {
    document.querySelectorAll('.purchase-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.purchase-tab[data-tab="${tab}"]`).classList.add('active');

    const container = document.getElementById('purchase-content');
    const user = auth.getCurrentUser();

    if (tab === 'vip') {
        const packages = await storage.getPackages();
        container.innerHTML = `
            <div class="user-info-card">
                <span>当前等级：${user.vipLevel}</span>
                <span>剩余秒点：${(user.points || 0) + (user.monthlyPoints || 0) + (user.pointPackPoints || 0)}</span>
            </div>
            <div class="package-grid">
                ${packages.filter(p => p.status === 'active').map(p => `
                    <div class="package-card vip-${p.id}">
                        <h3>${p.name}</h3>
                        <div class="price">¥${p.price}<span>/${p.duration}</span></div>
                        <p class="points-grant">${p.pointsType === 'daily' ? '每日' : '每月'}赠送 ${p.dailyPoints} 秒点</p>
                        <ul class="benefits">
                            ${p.benefits.map(b => `<li><i class="fas fa-check"></i> ${b}</li>`).join('')}
                        </ul>
                        <div class="auto-renew">
                            <label><input type="checkbox" ${user.autoRenew ? 'checked' : ''} onchange="toggleAutoRenew('${p.id}')"> 开启自动续费</label>
                        </div>
                        <button class="btn btn-primary" onclick="buyPackage('${p.id}', 'vip')">立即购买</button>
                    </div>
                `).join('')}
            </div>
        `;
    } else if (tab === 'points') {
        const pointPacks = await storage.getPointPacks();
        const groups = { recommend: [], value: [] };
        pointPacks.filter(p => p.status === 'active').forEach(p => groups[p.group].push(p));

        container.innerHTML = Object.entries(groups).map(([groupName, packs]) => `
            <h3>${groupName === 'recommend' ? '🔥 常用推荐' : '💎 更具性价比'}</h3>
            <div class="point-pack-grid">
                ${packs.map(p => `
                    <div class="point-pack-card">
                        <div class="points-num">${p.points.toLocaleString()} <small>秒点</small></div>
                        ${p.originalPrice ? `<div class="original-price">¥${p.originalPrice}</div>` : ''}
                        <div class="price">¥${p.price}</div>
                        <button class="btn btn-primary" onclick="buyPackage('${p.id}', 'points')">立即购买</button>
                    </div>
                `).join('')}
            </div>
        `).join('');
    } else if (tab === 'coupon') {
        container.innerHTML = `
            <div class="coupon-tabs">
                <button class="btn btn-primary" onclick="showBuyCoupon()">购买卡券</button>
                <button class="btn btn-outline" onclick="showGiftCoupon()">赠送卡券</button>
                <button class="btn btn-outline" onclick="showRedeemCoupon()">兑换卡券</button>
            </div>
            <div id="coupon-operation-area"></div>
        `;
    }
}

// ===== 订单处理 =====
let currentOrder = null;

function buyPackage(id, type) {
    const user = auth.getCurrentUser();
    let item;

    if (type === 'vip') {
        item = CONFIG.DEFAULT_PACKAGES.find(p => p.id === id) || { name: '套餐', price: 0 };
    } else {
        item = CONFIG.DEFAULT_POINT_PACKS.find(p => p.id === id) || { name: '秒点包', price: 0 };
    }

    currentOrder = { type, itemId: id, name: item.name, price: item.price, details: item };

    document.getElementById('order-details').innerHTML = `
        <div class="order-info">
            <p><strong>订单类型：</strong>${type === 'vip' ? '会员套餐' : '秒点包'}</p>
            <p><strong>名称：</strong>${item.name}</p>
            <p><strong>原价：</strong>¥${item.price}</p>
            <p><strong>折扣后价格：</strong><span id="final-price">¥${item.price}</span></p>
        </div>
    `;
    document.getElementById('coupon-code').value = '';
    document.getElementById('order-modal').style.display = 'block';
}

function applyCoupon() {
    const code = document.getElementById('coupon-code').value;
    if (!code) return;

    // 异步校验优惠码
    storage.getCoupons().then(coupons => {
        const coupon = coupons.find(c => c.code === code);
        if (!coupon) { showToast('优惠码无效或已过期', 'error'); return; }
        if (coupon.status !== 'active') { showToast('优惠码已停用', 'error'); return; }

        const now = new Date();
        if (now < new Date(coupon.validFrom) || now > new Date(coupon.validTo)) {
            showToast('优惠码不在有效期内', 'error'); return;
        }
        if (coupon.usedCount >= coupon.maxUses) {
            showToast('优惠码使用次数已达上限', 'error'); return;
        }

        const originalPrice = currentOrder.price;
        const discounted = (originalPrice * coupon.discount).toFixed(2);
        document.getElementById('final-price').textContent = `¥${discounted}`;
        currentOrder.discountedPrice = parseFloat(discounted);
        currentOrder.couponCode = code;

        showToast(`优惠码已应用！节省 ¥${(originalPrice - discounted).toFixed(2)}`, 'success');
    });
}

async function submitOrder() {
    const proofFile = document.getElementById('payment-proof').files[0];
    if (!proofFile) {
        showToast('请上传付款凭证后再提交订单', 'error');
        return;
    }

    const user = auth.getCurrentUser();
    const order = {
        id: 'ORD' + Date.now(),
        userId: user.id,
        username: user.username,
        type: currentOrder.type === 'vip' ? '会员套餐' : currentOrder.type === 'points' ? '秒点包' : '卡券',
        itemName: currentOrder.name,
        price: currentOrder.price,
        discountedPrice: currentOrder.discountedPrice || currentOrder.price,
        couponCode: currentOrder.couponCode || '',
        paymentProof: proofFile.name, // 实际应上传到 GitHub
        status: 'pending',
        createdAt: new Date().toISOString(),
        refundStatus: null,
    };

    const orders = await storage.getOrders();
    orders.push(order);
    await storage.saveOrders(orders);

    showToast('订单已提交，请等待管理员审批', 'success');
    closeOrderModal();
    navigateTo('orders');
}

function closeOrderModal() {
    document.getElementById('order-modal').style.display = 'none';
}

// ===== 我的订单 =====
async function loadOrdersPage() {
    const container = document.getElementById('orders-list');
    const user = auth.getCurrentUser();
    const orders = await storage.getOrders();
    const userOrders = orders.filter(o => o.userId === user.id);

    if (userOrders.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-receipt"></i><p>暂无订单</p></div>';
        return;
    }

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>订单号</th><th>类型</th><th>名称</th><th>价格</th>
                    <th>优惠码</th><th>提交时间</th><th>状态</th><th>操作</th>
                </tr>
            </thead>
            <tbody>
                ${userOrders.map(o => `
                    <tr>
                        <td>${o.id}</td>
                        <td>${o.type}</td>
                        <td>${o.itemName}</td>
                        <td>¥${o.discountedPrice || o.price}</td>
                        <td>${o.couponCode || '-'}</td>
                        <td>${new Date(o.createdAt).toLocaleString()}</td>
                        <td><span class="status-badge status-${o.status}">${getStatusText(o.status)}</span></td>
                        <td>
                            ${o.status === 'approved' ? `<button class="btn btn-sm btn-outline" onclick="requestRefund('${o.id}')">申请退款</button>` : ''}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function getStatusText(status) {
    const map = { pending: '待审批', approved: '已通过', rejected: '已拒绝', refunding: '退款中', refunded: '已退款', refundRejected: '退款拒绝' };
    return map[status] || status;
}

async function requestRefund(orderId) {
    const reason = prompt('请输入退款原因：');
    if (!reason) return;

    const orders = await storage.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (order) {
        order.status = 'refunding';
        order.refundReason = reason;
        order.refundRequestedAt = new Date().toISOString();
        await storage.saveOrders(orders);

        // 添加到退款列表
        const refunds = await storage.getRefunds();
        refunds.push({
            orderId, userId: order.userId, type: order.type,
            itemName: order.itemName, price: order.price,
            reason, requestedAt: new Date().toISOString(), status: 'refunding',
        });
        await storage.saveRefunds(refunds);

        showToast('退款申请已提交，等待管理员审批', 'success');
        loadOrdersPage();
    }
}

// ===== 公告 =====
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

// ===== 搜索 =====
async function performSearch() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const resultsEl = document.getElementById('search-results');

    if (!query) { resultsEl.style.display = 'none'; return; }

    // 搜索仓库文件 + 本地收藏/标签
    const contents = await storage.getRepoContents(storage.mainRepo, '');
    const matches = contents.filter(i =>
        i.name.toLowerCase().includes(query) ||
        (i.description && i.description.toLowerCase().includes(query))
    );

    // 搜索收藏中的自定义标签
    const user = auth.getCurrentUser();
    const favorites = JSON.parse(localStorage.getItem('piggy__data/favorites.json') || '{}');
    const userFavs = favorites[user?.id] || [];
    const tagMatches = userFavs.filter(f => f.tags?.some(t => t.toLowerCase().includes(query)));

    resultsEl.innerHTML = `
        ${matches.map(m => `<div class="search-result-item" onclick="goToSearchResult('${m.name}')"><i class="fas ${getFileIcon(m.name)}"></i> ${m.name}</div>`).join('')}
        ${tagMatches.map(f => `<div class="search-result-item" onclick="goToSearchResult('${f.name}')"><i class="fas fa-tag"></i> ${f.name} <small>${f.tags.join(',')}</small></div>`).join('')}
    `;
    resultsEl.style.display = matches.length || tagMatches.length ? 'block' : 'none';

    if (!matches.length && !tagMatches.length) {
        resultsEl.innerHTML = '<div class="search-empty">未找到相关资源，请尝试其他关键词</div>';
        resultsEl.style.display = 'block';
    }
}

function goToSearchResult(name) {
    document.getElementById('search-results').style.display = 'none';
    document.getElementById('search-input').value = '';
    showToast(`正在定位：${name}`, 'info');
}

// ===== 下载队列 =====
let downloadQueue = JSON.parse(localStorage.getItem('download_queue') || '[]');

function addToQueue(fileName, size) {
    downloadQueue.push({ name: fileName, size, status: 'waiting', progress: 0 });
    localStorage.setItem('download_queue', JSON.stringify(downloadQueue));
    updateQueueUI();
    showToast(`${fileName} 已加入下载队列`, 'success');
}

function updateQueueUI() {
    const list = document.getElementById('queue-list');
    const count = document.getElementById('queue-count');
    if (count) count.textContent = downloadQueue.length;

    if (list) {
        list.innerHTML = downloadQueue.slice(-5).map(item => `
            <div class="queue-item">
                <span class="queue-name">${item.name}</span>
                <span class="queue-status ${item.status}">${getQueueStatus(item.status)}</span>
            </div>
        `).join('');
    }
}

function getQueueStatus(status) {
    const map = { waiting: '等待中', downloading: '下载中', completed: '已完成', failed: '失败' };
    return map[status] || status;
}

// ===== 收藏 =====
async function addToFavorites(fileName) {
    const user = auth.getCurrentUser();
    if (!user) return;

    const favorites = JSON.parse(localStorage.getItem('piggy__data/favorites.json') || '{}');
    if (!favorites[user.id]) favorites[user.id] = [];

    if (favorites[user.id].find(f => f.name === fileName)) {
        showToast('该资源已在收藏夹中', 'info');
        return;
    }

    const tags = prompt('添加标签（逗号分隔，可选）：') || '';
    favorites[user.id].push({
        name: fileName,
        addedAt: new Date().toISOString(),
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    });

    localStorage.setItem('piggy__data/favorites.json', JSON.stringify(favorites));
    showToast('已添加到收藏夹', 'success');
}

async function loadFavoritesPage() {
    const container = document.getElementById('favorites-content');
    const user = auth.getCurrentUser();
    const favorites = JSON.parse(localStorage.getItem('piggy__data/favorites.json') || '{}');
    const userFavs = favorites[user.id] || [];

    if (userFavs.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-heart"></i><p>暂无收藏</p></div>';
        return;
    }

    // 获取所有标签用于筛选
    const allTags = [...new Set(userFavs.flatMap(f => f.tags || []))];

    container.innerHTML = `
        <div class="tag-filter">
            <button class="tag-chip active" onclick="filterFavorites('')">全部</button>
            ${allTags.map(t => `<button class="tag-chip" onclick="filterFavorites('${t}')">${t}</button>`).join('')}
        </div>
        <div class="favorites-grid" id="favorites-grid">
            ${userFavs.map(f => `
                <div class="favorite-card">
                    <i class="fas ${getFileIcon(f.name)}"></i>
                    <span class="fav-name">${f.name}</span>
                    <span class="fav-date">${new Date(f.addedAt).toLocaleDateString()}</span>
                    <div class="fav-tags">${(f.tags || []).map(t => `<span class="tag">${t}</span>`).join('')}</div>
                    <button class="btn btn-sm btn-outline" onclick="removeFavorite('${f.name}')"><i class="fas fa-times"></i></button>
                </div>
            `).join('')}
        </div>
    `;
}

function filterFavorites(tag) {
    document.querySelectorAll('.tag-chip').forEach(c => c.classList.remove('active'));
    event.target.classList.add('active');

    const user = auth.getCurrentUser();
    const favorites = JSON.parse(localStorage.getItem('piggy__data/favorites.json') || '{}');
    const userFavs = favorites[user.id] || [];

    const filtered = tag ? userFavs.filter(f => (f.tags || []).includes(tag)) : userFavs;

    document.getElementById('favorites-grid').innerHTML = filtered.map(f => `
        <div class="favorite-card">
            <i class="fas ${getFileIcon(f.name)}"></i>
            <span class="fav-name">${f.name}</span>
            <span class="fav-date">${new Date(f.addedAt).toLocaleDateString()}</span>
            <div class="fav-tags">${(f.tags || []).map(t => `<span class="tag">${t}</span>`).join('')}</div>
            <button class="btn btn-sm btn-outline" onclick="removeFavorite('${f.name}')"><i class="fas fa-times"></i></button>
        </div>
    `).join('');
}

function removeFavorite(name) {
    const user = auth.getCurrentUser();
    const favorites = JSON.parse(localStorage.getItem('piggy__data/favorites.json') || '{}');
    favorites[user.id] = (favorites[user.id] || []).filter(f => f.name !== name);
    localStorage.setItem('piggy__data/favorites.json', JSON.stringify(favorites));
    loadFavoritesPage();
}

// ===== AI 推荐 =====
async function loadRecommendations() {
    const container = document.getElementById('recommend-list');
    if (!container) return;

    const user = auth.getCurrentUser();
    if (!user) return;

    // 基于下载历史和收藏推荐
    const favorites = JSON.parse(localStorage.getItem('piggy__data/favorites.json') || '{}');
    const userFavs = favorites[user.id] || [];
    const downloadLogs = JSON.parse(localStorage.getItem('piggy__download-logs') || '[]');
    const userDownloads = downloadLogs.filter(d => d.userId === user.id);

    // 模拟推荐逻辑
    const allFiles = await storage.getRepoContents(storage.mainRepo, '');
    const favNames = userFavs.map(f => f.name);
    const downloadedNames = userDownloads.map(d => d.fileName);

    const recommendations = allFiles
        .filter(f => f.type === 'file')
        .filter(f => !favNames.includes(f.name) && !downloadedNames.includes(f.name))
        .slice(0, 5)
        .map(f => ({
            name: f.name,
            reason: generateRecommendReason(f, userFavs),
            rating: (Math.random() * 2 + 3).toFixed(1),
        }));

    container.innerHTML = recommendations.map(r => `
        <div class="recommend-item" onclick="goToSearchResult('${r.name}')">
            <i class="fas ${getFileIcon(r.name)}"></i>
            <div class="recommend-info">
                <span class="rec-name">${r.name}</span>
                <span class="rec-reason">${r.reason}</span>
                <span class="rec-rating">★ ${r.rating}</span>
            </div>
        </div>
    `).join('');
}

function generateRecommendReason(file, favorites) {
    const reasons = ['基于你的收藏推荐', '热门下载', '同类资源推荐', '新上传资源', '教师推荐'];
    return reasons[Math.floor(Math.random() * reasons.length)];
}

// ===== 评价 =====
let currentReviewFile = '';

function showReviewModal(fileName) {
    currentReviewFile = fileName;
    document.getElementById('review-text').value = '';
    document.querySelectorAll('.rating-input .star').forEach(s => s.classList.remove('active'));
    document.getElementById('review-modal').style.display = 'block';
}

let currentRating = 0;
document.querySelectorAll('.rating-input .star')?.forEach(star => {
    star.addEventListener('click', () => {
        currentRating = parseInt(star.dataset.rating);
        document.querySelectorAll('.rating-input .star').forEach((s, i) => {
            s.classList.toggle('active', i < currentRating);
        });
    });
});

async function submitReview() {
    if (currentRating === 0) { showToast('请先打分后再提交评价', 'error'); return; }

    const user = auth.getCurrentUser();
    const reviews = JSON.parse(localStorage.getItem('piggy__data/reviews.json') || '{}');

    if (!reviews[currentReviewFile]) reviews[currentReviewFile] = [];

    reviews[currentReviewFile].push({
        userId: user.id,
        username: user.username,
        rating: currentRating,
        comment: document.getElementById('review-text').value,
        createdAt: new Date().toISOString(),
    });

    localStorage.setItem('piggy__data/reviews.json', JSON.stringify(reviews));
    showToast('评价提交成功', 'success');
    closeReviewModal();

    // 完成任务
    completeTask('review_resource');
}

function closeReviewModal() {
    document.getElementById('review-modal').style.display = 'none';
}

// ===== 学习进度 =====
function recordLearningProgress(fileName) {
    const user = auth.getCurrentUser();
    if (!user) return;

    const progress = JSON.parse(localStorage.getItem('piggy__learning-progress.json') || '{}');
    if (!progress[user.id]) progress[user.id] = {};

    if (!progress[user.id][fileName]) {
        progress[user.id][fileName] = {
            totalTime: 0,
            completion: 0,
            lastStudy: new Date().toISOString(),
        };
    }

    // 模拟学习时间累计
    setInterval(() => {
        if (document.getElementById('viewer-modal').style.display === 'block') {
            progress[user.id][fileName].totalTime += 1;
            progress[user.id][fileName].completion = Math.min(100, Math.round(progress[user.id][fileName].totalTime / 60 * 10));
            progress[user.id][fileName].lastStudy = new Date().toISOString();
            localStorage.setItem('piggy__learning-progress.json', JSON.stringify(progress));
        }
    }, 60000); // 每分钟更新

    localStorage.setItem('piggy__learning-progress.json', JSON.stringify(progress));
}

// ===== 下载记录 =====
function recordDownload(fileName, fileSize) {
    const user = auth.getCurrentUser();
    if (!user) return;

    const logs = JSON.parse(localStorage.getItem('piggy__download-logs') || '[]');
    logs.push({
        userId: user.id,
        userName: user.username,
        fileName,
        fileSize,
        downloadedAt: new Date().toISOString(),
    });
    localStorage.setItem('piggy__download-logs', JSON.stringify(logs));
}

// ===== 个人中心 =====
function loadProfilePage() {
    switchProfileTab('invite');
}

function switchProfileTab(tab) {
    document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.profile-tab[data-tab="${tab}"]`).classList.add('active');

    const container = document.getElementById('profile-content');

    if (tab === 'invite') loadInviteSection(container);
    else if (tab === 'progress') loadProgressSection(container);
    else if (tab === 'favorites') loadProfileFavorites(container);
    else if (tab === 'dashboard') loadDashboard(container);
    else if (tab === 'settings') loadSettings(container);
    else if (tab === 'bookmarks') loadBookmarks(container);
    else if (tab === 'renewal') loadRenewal(container);
}

function loadInviteSection(container) {
    const user = auth.getCurrentUser();
    const invitations = JSON.parse(localStorage.getItem('piggy__data/invitations.json') || '{}');
    const userInvites = invitations[user.id] || [];

    const inviteUrl = `${location.origin}${location.pathname}?invite=${user.inviteCode}`;

    container.innerHTML = `
        <div class="invite-card">
            <h3>我的邀请码</h3>
            <div class="invite-code-display">
                <code>${user.inviteCode}</code>
                <button class="btn btn-sm btn-outline" onclick="copyText('${user.inviteCode}')"><i class="fas fa-copy"></i> 复制邀请码</button>
            </div>
            <div class="invite-link">
                <input type="text" value="${inviteUrl}" readonly>
                <button class="btn btn-sm btn-primary" onclick="copyText('${inviteUrl}')"><i class="fas fa-copy"></i> 复制链接</button>
            </div>
        </div>
        <div class="invite-stats">
            <div class="stat-item"><span class="stat-num">${userInvites.length}</span><span>累计邀请</span></div>
            <div class="stat-item"><span class="stat-num">${userInvites.filter(i => i.status === 'rewarded').reduce((s, i) => s + (i.rewardPoints || 0), 0)}</span><span>获得秒点</span></div>
        </div>
        <h3>邀请记录</h3>
        <table class="data-table">
            <thead><tr><th>被邀请人</th><th>注册时间</th><th>首次购买</th><th>奖励秒点</th><th>状态</th></tr></thead>
            <tbody>
                ${userInvites.map(i => `
                    <tr>
                        <td>${i.inviteeName}</td>
                        <td>${new Date(i.registeredAt).toLocaleDateString()}</td>
                        <td>${i.firstPurchaseAt ? new Date(i.firstPurchaseAt).toLocaleDateString() : '-'}</td>
                        <td>${i.rewardPoints || 0}</td>
                        <td>${i.status === 'rewarded' ? '已发放' : '待发放'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function loadProgressSection(container) {
    const user = auth.getCurrentUser();
    const progress = JSON.parse(localStorage.getItem('piggy__learning-progress.json') || '{}');
    const userProgress = progress[user.id] || {};

    const items = Object.entries(userProgress).map(([name, data]) => ({ name, ...data }));

    container.innerHTML = `
        <div class="progress-search">
            <input type="text" placeholder="搜索资源..." oninput="filterProgress(this.value)">
        </div>
        <table class="data-table">
            <thead><tr><th>资源名称</th><th>累计学习时长</th><th>完成度</th><th>最后学习</th></tr></thead>
            <tbody id="progress-tbody">
                ${items.map(item => `
                    <tr>
                        <td>${item.name}</td>
                        <td>${Math.floor(item.totalTime / 60)}分${item.totalTime % 60}秒</td>
                        <td>
                            <div class="progress-bar"><div class="progress-fill" style="width:${item.completion}%"></div></div>
                            ${item.completion}%
                        </td>
                        <td>${new Date(item.lastStudy).toLocaleDateString()}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function loadDashboard(container) {
    container.innerHTML = `
        <div class="dashboard-grid">
            <div class="dashboard-card">
                <h4>累计学习时长</h4>
                <div class="chart-placeholder"><i class="fas fa-chart-line"></i> 折线图区域</div>
                <div class="time-dim-switch">
                    <button class="active">日</button><button>周</button><button>月</button>
                </div>
            </div>
            <div class="dashboard-card">
                <h4>累计下载量</h4>
                <div class="chart-placeholder"><i class="fas fa-chart-bar"></i> 柱状图区域</div>
            </div>
            <div class="dashboard-card">
                <h4>累计积分</h4>
                <div class="chart-placeholder"><i class="fas fa-star"></i> 趋势图区域</div>
            </div>
            <div class="dashboard-card">
                <h4>会员信息</h4>
                <p>等级：<span id="dash-vip">免费版</span></p>
                <p>有效期至：<span id="dash-expire">-</span></p>
                <p>剩余秒点：<span id="dash-points">0</span></p>
            </div>
        </div>
    `;
}

function loadSettings(container) {
    container.innerHTML = `
        <div class="settings-section">
            <h3>夜间模式</h3>
            <label class="switch">
                <input type="checkbox" ${document.documentElement.getAttribute('data-theme') === 'dark' ? 'checked' : ''} onchange="toggleNightMode()">
                <span class="slider"></span>
            </label>
        </div>
        <div class="settings-section">
            <h3>字体大小</h3>
            <input type="range" min="12" max="24" value="16" oninput="adjustFontSize(this.value)">
            <span id="font-size-display">16px</span>
        </div>
    `;
}

function loadBookmarks(container) {
    const user = auth.getCurrentUser();
    const bookmarks = JSON.parse(localStorage.getItem('piggy__data/bookmarks.json') || '{}');
    const userBookmarks = bookmarks[user.id] || [];

    container.innerHTML = `
        <table class="data-table">
            <thead><tr><th>资源名称</th><th>书签位置</th><th>设备</th><th>同步时间</th><th>操作</th></tr></thead>
            <tbody>
                ${userBookmarks.map(b => `
                    <tr>
                        <td>${b.resourceName}</td>
                        <td>${b.position}</td>
                        <td>${b.device}</td>
                        <td>${new Date(b.syncedAt).toLocaleString()}</td>
                        <td><button class="btn btn-sm btn-outline" onclick="deleteBookmark('${b.id}')"><i class="fas fa-trash"></i></button></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function loadRenewal(container) {
    const user = auth.getCurrentUser();
    container.innerHTML = `
        <div class="renewal-list">
            <div class="renewal-item">
                <span>当前套餐：${user.vipLevel}</span>
                <label class="switch">
                    <input type="checkbox" ${user.autoRenew ? 'checked' : ''} onchange="toggleAutoRenewGlobal(this.checked)">
                    <span class="slider"></span>
                </label>
                <span>${user.autoRenew ? '已开启自动续费' : '未开启'}</span>
            </div>
        </div>
    `;
}

function toggleAutoRenewGlobal(enabled) {
    const user = auth.getCurrentUser();
    user.autoRenew = enabled;
    auth.setCurrentUser(user);
    showToast(enabled ? '自动续费已开启' : '自动续费已关闭', 'success');
}

// ===== 学习小组 =====
async function loadGroupsPage() {
    const container = document.getElementById('groups-list');
    const groups = JSON.parse(localStorage.getItem('piggy__data/groups.json') || '[]');

    container.innerHTML = `
        <div class="groups-grid">
            ${groups.map(g => `
                <div class="group-card" onclick="openGroup('${g.id}')">
                    <h4>${g.name}</h4>
                    <p><i class="fas fa-users"></i> ${g.members?.length || 0} 成员</p>
                    <p><i class="fas fa-calendar"></i> ${new Date(g.createdAt).toLocaleDateString()}</p>
                </div>
            `).join('')}
        </div>
    `;
}

function createGroup() {
    const name = prompt('请输入小组/班级名称：');
    if (!name) return;

    const user = auth.getCurrentUser();
    const groups = JSON.parse(localStorage.getItem('piggy__data/groups.json') || '[]');

    if (groups.find(g => g.name === name)) {
        showToast('该小组/班级名称已存在，请更换', 'error');
        return;
    }

    groups.push({
        id: Date.now().toString(),
        name,
        ownerId: user.id,
        members: [{ id: user.id, name: user.username, role: 'owner' }],
        resources: [],
        assignments: [],
        createdAt: new Date().toISOString(),
    });

    localStorage.setItem('piggy__data/groups.json', JSON.stringify(groups));
    showToast('小组创建成功', 'success');
    loadGroupsPage();
}

// ===== 积分任务 =====
async function loadTasksPage() {
    const user = auth.getCurrentUser();
    const completedTasks = JSON.parse(localStorage.getItem('completed_tasks') || '{}');
    const userCompleted = completedTasks[user.id] || [];

    // 计算总积分
    const totalPoints = userCompleted.reduce((sum, t) => sum + (t.points || 0), 0);
    const totalEl = document.getElementById('total-points');
    if (totalEl) totalEl.textContent = totalPoints;

    // 使用默认任务列表
    const allTasks = DEFAULT_DATA.tasks || [
        { id: 'daily_checkin', name: '每日签到', description: '每天登录签到', points: 5, icon: 'fas fa-calendar-check' },
        { id: 'share_resource', name: '分享资源', description: '分享一个资源给好友', points: 10, icon: 'fas fa-share' },
        { id: 'review_resource', name: '评价资源', description: '对资源进行评分和评价', points: 15, icon: 'fas fa-star' },
        { id: 'invite_friend', name: '邀请好友', description: '成功邀请一位好友注册', points: 50, icon: 'fas fa-user-plus' },
        { id: 'complete_profile', name: '完善资料', description: '完善个人资料信息', points: 20, icon: 'fas fa-user-edit' },
    ];

    document.getElementById('tasks-list').innerHTML = allTasks.map(task => {
        const isCompleted = userCompleted.find(t => t.taskId === task.id);
        return `
            <div class="task-card ${isCompleted ? 'completed' : ''}">
                <i class="${task.icon}"></i>
                <div class="task-info">
                    <h4>${task.name}</h4>
                    <p>${task.description}</p>
                </div>
                <div class="task-points">+${task.points} 积分</div>
                ${isCompleted
                    ? '<span class="task-status completed"><i class="fas fa-check"></i> 已完成</span>'
                    : `<button class="btn btn-sm btn-primary" onclick="completeTask('${task.id}')">完成</button>`
                }
            </div>
        `;
    }).join('');

    // 兑换列表
    document.getElementById('exchange-list').innerHTML = `
        <div class="exchange-grid">
            <div class="exchange-card">
                <h4>100 秒点</h4>
                <p>消耗 200 积分</p>
                <button class="btn btn-primary" onclick="exchangePoints(200, 100)">兑换</button>
            </div>
            <div class="exchange-card">
                <h4>专业版 1天</h4>
                <p>消耗 500 积分</p>
                <button class="btn btn-primary" onclick="exchangePoints(500, 'vip_day')">兑换</button>
            </div>
            <div class="exchange-card">
                <h4>旗舰版 1天</h4>
                <p>消耗 1000 积分</p>
                <button class="btn btn-primary" onclick="exchangePoints(1000, 'flagship_day')">兑换</button>
            </div>
        </div>
    `;
}

function completeTask(taskId) {
    const user = auth.getCurrentUser();
    const completedTasks = JSON.parse(localStorage.getItem('completed_tasks') || '{}');

    if (!completedTasks[user.id]) completedTasks[user.id] = [];

    if (completedTasks[user.id].find(t => t.taskId === taskId)) {
        showToast('该任务已完成', 'info');
        return;
    }

    const allTasks = [
        { id: 'daily_checkin', name: '每日签到', points: 5 },
        { id: 'share_resource', name: '分享资源', points: 10 },
        { id: 'review_resource', name: '评价资源', points: 15 },
        { id: 'invite_friend', name: '邀请好友', points: 50 },
        { id: 'complete_profile', name: '完善资料', points: 20 },
    ];
    const task = allTasks.find(t => t.id === taskId);

    if (task) {
        completedTasks[user.id].push({
            taskId: task.id,
            name: task.name,
            points: task.points,
            completedAt: new Date().toISOString(),
        });
        localStorage.setItem('completed_tasks', JSON.stringify(completedTasks));
        showToast(`任务完成！获得 ${task.points} 积分`, 'success');
        loadTasksPage();
    }
}

function exchangePoints(requiredPoints, reward) {
    const user = auth.getCurrentUser();
    const completedTasks = JSON.parse(localStorage.getItem('completed_tasks') || '{}');
    const userCompleted = completedTasks[user.id] || [];
    const totalPoints = userCompleted.reduce((sum, t) => sum + (t.points || 0), 0);

    if (totalPoints < requiredPoints) {
        showToast('积分不足，请完成更多任务后再兑换', 'error');
        return;
    }

    // 扣减积分（从后往前扣）
    let remaining = requiredPoints;
    for (let i = userCompleted.length - 1; i >= 0 && remaining > 0; i--) {
        if (userCompleted[i].points > 0) {
            if (userCompleted[i].points <= remaining) {
                remaining -= userCompleted[i].points;
                userCompleted[i].points = 0;
            } else {
                userCompleted[i].points -= remaining;
                remaining = 0;
            }
        }
    }

    // 移除积分为0的记录
    completedTasks[user.id] = userCompleted.filter(t => t.points > 0);
    localStorage.setItem('completed_tasks', JSON.stringify(completedTasks));

    // 发放奖励
    if (reward === 100) {
        user.pointPackPoints = (user.pointPackPoints || 0) + 100;
    }
    auth.setCurrentUser(user);

    showToast(`兑换成功！`, 'success');
    loadTasksPage();
}

// ===== 消息通知 =====
async function loadNotificationsPage() {
    const container = document.getElementById('notifications-list');
    const user = auth.getCurrentUser();

    // 从订单状态生成通知
    const orders = await storage.getOrders();
    const userOrders = orders.filter(o => o.userId === user.id);

    const notifications = userOrders.map(o => ({
        id: o.id,
        title: `订单 ${getStatusText(o.status)}`,
        content: `${o.type} - ${o.itemName} - ¥${o.discountedPrice || o.price}`,
        time: o.createdAt,
        type: 'order',
        read: false,
    }));

    if (notifications.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-bell"></i><p>暂无通知</p></div>';
        return;
    }

    container.innerHTML = `
        <div class="notification-filters">
            <button class="active" onclick="filterNotifications('all')">全部</button>
            <button onclick="filterNotifications('order')">订单</button>
            <button onclick="filterNotifications('announcement')">公告</button>
        </div>
        <div class="notification-list">
            ${notifications.map(n => `
                <div class="notification-item ${n.read ? 'read' : ''}" onclick="markNotificationRead('${n.id}')">
                    <div class="notif-icon"><i class="fas fa-${n.type === 'order' ? 'receipt' : 'bullhorn'}"></i></div>
                    <div class="notif-content">
                        <h5>${n.title}</h5>
                        <p>${n.content}</p>
                        <span class="notif-time">${new Date(n.time).toLocaleString()}</span>
                    </div>
                    ${n.read ? '' : '<span class="unread-dot"></span>'}
                </div>
            `).join('')}
        </div>
    `;
}

function markAllRead() {
    showToast('已全部标记为已读', 'success');
    loadNotificationsPage();
}

function updateNotificationBadge() {
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    // 简单统计未读数量
    badge.textContent = '2';
    badge.style.display = 'block';
}

// ===== 卡券操作 =====
function showBuyCoupon() {
    const area = document.getElementById('coupon-operation-area');
    area.innerHTML = `
        <div class="coupon-buy-section">
            <h4>购买卡券</h4>
            <div class="coupon-buy-tabs">
                <button class="active" onclick="showMemberCoupons()">会员卡券</button>
                <button onclick="showPointsCoupons()">秒点卡券</button>
            </div>
            <div id="coupon-buy-content">
                ${CONFIG.DEFAULT_PACKAGES.filter(p => p.id !== 'free').map(p => `
                    <div class="coupon-card-item">
                        <h5>${p.name}</h5>
                        <p>¥${p.price} / ${p.duration}</p>
                        <button class="btn btn-primary btn-sm" onclick="buyCoupon('member', '${p.id}')">立即购买</button>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function showPointsCoupons() {
    document.getElementById('coupon-buy-content').innerHTML = `
        ${CONFIG.DEFAULT_POINT_PACKS.slice(0, 3).map(p => `
            <div class="coupon-card-item">
                <h5>${p.points} 秒点</h5>
                <p>¥${p.price}</p>
                <button class="btn btn-primary btn-sm" onclick="buyCoupon('points', '${p.id}')">立即购买</button>
            </div>
        `).join('')}
    `;
}

function showMemberCoupons() {
    document.getElementById('coupon-buy-content').innerHTML = `
        ${CONFIG.DEFAULT_PACKAGES.filter(p => p.id !== 'free').map(p => `
            <div class="coupon-card-item">
                <h5>${p.name}</h5>
                <p>¥${p.price} / ${p.duration}</p>
                <button class="btn btn-primary btn-sm" onclick="buyCoupon('member', '${p.id}')">立即购买</button>
            </div>
        `).join('')}
    `;
}

function buyCoupon(type, id) {
    showToast('卡券购买流程已启动，请按提示操作', 'info');
    // 复用订单提交流程
    const item = type === 'member'
        ? CONFIG.DEFAULT_PACKAGES.find(p => p.id === id)
        : CONFIG.DEFAULT_POINT_PACKS.find(p => p.id === id);

    currentOrder = { type: 'coupon', itemId: id, name: `${item.name}卡券`, price: item.price, details: item };
    document.getElementById('order-details').innerHTML = `
        <div class="order-info">
            <p><strong>订单类型：</strong>卡券</p>
            <p><strong>名称：</strong>${item.name}卡券</p>
            <p><strong>价格：</strong>¥${item.price}</p>
        </div>
    `;
    document.getElementById('order-modal').style.display = 'block';
}

function showGiftCoupon() {
    const area = document.getElementById('coupon-operation-area');
    area.innerHTML = `
        <div class="coupon-gift-section">
            <h4>赠送卡券</h4>
            <div class="form-group">
                <label>选择卡券</label>
                <select id="gift-coupon-select">
                    <option value="pro_1month">专业版 1个月</option>
                    <option value="flagship_1month">旗舰版 1个月</option>
                    <option value="points_1000">1000秒点</option>
                </select>
            </div>
            <div class="form-group">
                <label>接收人（用户名或手机号）</label>
                <input type="text" id="gift-recipient" placeholder="请输入接收人信息">
            </div>
            <button class="btn btn-primary" onclick="giftCoupon()">赠送</button>
        </div>
    `;
}

async function giftCoupon() {
    const recipient = document.getElementById('gift-recipient').value;
    if (!recipient) { showToast('请输入接收人信息', 'error'); return; }

    const users = await storage.getUsers();
    const target = users.find(u => u.username === recipient || u.phone === recipient);

    if (!target) {
        showToast('接收人不存在，请检查用户名或手机号后重试', 'error');
        return;
    }

    showToast('卡券赠送成功！', 'success');
    document.getElementById('coupon-operation-area').innerHTML = '';
}

function showRedeemCoupon() {
    const area = document.getElementById('coupon-operation-area');
    area.innerHTML = `
        <div class="coupon-redeem-section">
            <h4>兑换卡券</h4>
            <div class="form-group">
                <label>卡券兑换码</label>
                <input type="text" id="redeem-code" placeholder="请输入兑换码">
            </div>
            <button class="btn btn-primary" onclick="redeemCoupon()">兑换</button>
        </div>
    `;
}

async function redeemCoupon() {
    const code = document.getElementById('redeem-code').value;
    if (!code) { showToast('请输入兑换码', 'error'); return; }

    // 模拟兑换逻辑
    if (code.startsWith('PRO') || code.startsWith('FLAG') || code.startsWith('PTS')) {
        const user = auth.getCurrentUser();
        if (code.startsWith('PRO')) {
            user.vipLevel = 'pro';
            showToast('兑换成功！已升级为专业版', 'success');
        } else if (code.startsWith('FLAG')) {
            user.vipLevel = 'flagship';
            showToast('兑换成功！已升级为旗舰版', 'success');
        } else {
            user.pointPackPoints = (user.pointPackPoints || 0) + 1000;
            showToast('兑换成功！已获得1000秒点', 'success');
        }
        auth.setCurrentUser(user);
    } else {
        showToast('兑换码不存在，请检查后重试', 'error');
    }
}

// ===== 工具函数 =====
function copyText(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('已复制到剪贴板', 'success');
    }).catch(() => {
        // fallback
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('已复制到剪贴板', 'success');
    });
}

function adjustFontSize(size) {
    document.getElementById('font-size-display').textContent = `${size}px`;
    document.documentElement.style.setProperty('--font-size-base', `${size}px`);
}

// ===== 离线缓存（IndexedDB） =====
const offlineDB = {
    dbName: 'piggy_offline',
    version: 1,

    async open() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('resources')) {
                    db.createObjectStore('resources', { keyPath: 'name' });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async save(name, data) {
        try {
            const db = await this.open();
            const tx = db.transaction('resources', 'readwrite');
            tx.objectStore('resources').put({ name, data, savedAt: new Date().toISOString() });
        } catch (e) {
            console.warn('IndexedDB not available, using localStorage fallback');
            const cache = JSON.parse(localStorage.getItem('offline_cache') || '{}');
            cache[name] = { data, savedAt: new Date().toISOString() };
            localStorage.setItem('offline_cache', JSON.stringify(cache));
        }
    },

    async get(name) {
        try {
            const db = await this.open();
            return new Promise((resolve) => {
                const tx = db.transaction('resources', 'readonly');
                const request = tx.objectStore('resources').get(name);
                request.onsuccess = () => resolve(request.result);
            });
        } catch (e) {
            const cache = JSON.parse(localStorage.getItem('offline_cache') || '{}');
            return cache[name] || null;
        }
    },

    async getAll() {
        try {
            const db = await this.open();
            return new Promise((resolve) => {
                const tx = db.transaction('resources', 'readonly');
                const request = tx.objectStore('resources').getAll();
                request.onsuccess = () => resolve(request.result);
            });
        } catch (e) {
            const cache = JSON.parse(localStorage.getItem('offline_cache') || '{}');
            return Object.entries(cache).map(([name, data]) => ({ name, ...data }));
        }
    },

    async delete(name) {
        try {
            const db = await this.open();
            const tx = db.transaction('resources', 'readwrite');
            tx.objectStore('resources').delete(name);
        } catch (e) {
            const cache = JSON.parse(localStorage.getItem('offline_cache') || '{}');
            delete cache[name];
            localStorage.setItem('offline_cache', JSON.stringify(cache));
        }
    },
};

// 记录访问统计
function recordVisit() {
    const today = new Date().toDateString();
    const stats = JSON.parse(localStorage.getItem('piggy__data/visitor-stats.json') || '[]');
    let todayStat = stats.find(s => s.date === today);

    if (!todayStat) {
        todayStat = { date: today, uv: 0, pv: 0 };
        stats.push(todayStat);
    }

    // PV +1
    todayStat.pv++;

    // UV：检查是否是今日新访客
    const lastVisit = localStorage.getItem('last_visit_date');
    if (lastVisit !== today) {
        todayStat.uv++;
        localStorage.setItem('last_visit_date', today);
    }

    localStorage.setItem('piggy__data/visitor-stats.json', JSON.stringify(stats));
}

// 初始化访问统计
recordVisit();
updateQueueUI();
