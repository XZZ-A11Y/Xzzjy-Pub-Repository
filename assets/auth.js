/**
 * 小猪猪教育数字资源库 - 认证模块
 * 支持：GitHub OAuth 登录 + 账号密码登录
 */

class Auth {
    constructor() {
        this.currentUser = null;
        this.smsCodes = new Map(); // 模拟短信验证码
        this.verifiedSMS = false;
    }

    // ===== GitHub OAuth 登录 =====
    async githubLogin() {
        // 在 GitHub Pages 静态托管场景下，使用 Personal Access Token 方式
        // 弹出输入 Token 的对话框
        const token = prompt(
            '请输入您的 GitHub Personal Access Token\n\n' +
            '获取方式：GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)\n' +
            '需要勾选 repo 权限'
        );

        if (!token) return;

        try {
            githubAPI.setToken(token);
            const userInfo = await githubAPI.getUserInfo();

            if (userInfo) {
                // 检查是否已有该用户
                let users = await storage.getUsers();
                let user = users.find(u => u.githubId === userInfo.id);

                if (!user) {
                    // 自动注册
                    user = {
                        id: Date.now(),
                        username: userInfo.login,
                        githubId: userInfo.id,
                        avatar: userInfo.avatar_url,
                        phone: '',
                        loginPermission: true,
                        previewPermission: true,
                        downloadPermission: true,
                        vipLevel: 'free',
                        points: 0,
                        monthlyPoints: 0,
                        pointPackPoints: 0,
                        registeredAt: new Date().toISOString(),
                        autoRenew: false,
                        githubLogin: true,
                    };
                    users.push(user);
                    await storage.saveUsers(users);
                }

                this.setCurrentUser(user);
                showToast(`欢迎回来，${user.username}！`, 'success');
                showApp();
            } else {
                showToast('Token 无效，请检查后重试', 'error');
            }
        } catch (e) {
            showToast('GitHub 登录失败：' + e.message, 'error');
        }
    }

    // ===== 账号密码登录 =====
    async login(username, password) {
        const users = await storage.getUsers();
        const user = users.find(u => u.username === username);

        if (!user) {
            showToast('账号或密码错误', 'error');
            return false;
        }

        // 检查密码（简单 base64 编码，实际应使用哈希）
        const hashedPassword = btoa(password);
        if (user.password !== hashedPassword && user.password !== password) {
            // 兼容明文和 base64
            if (user.password !== password && btoa(password) !== user.password) {
                showToast('账号或密码错误', 'error');
                return false;
            }
        }

        // 检查登录权限
        if (!user.loginPermission) {
            showToast('您的账号暂无登录权限，请联系管理员', 'error');
            return false;
        }

        // 重置每日/每月秒点
        this.resetPeriodicPoints(user);

        this.setCurrentUser(user);
        showToast(`欢迎回来，${username}！`, 'success');
        return true;
    }

    // ===== 注册 =====
    async register(userData) {
        const { username, phone, password, confirmPassword, inviteCode } = userData;

        // 验证
        if (password !== confirmPassword) {
            showToast('两次输入的密码不一致', 'error');
            return false;
        }

        if (!/^1[3-9]\d{9}$/.test(phone)) {
            showToast('请输入正确的手机号', 'error');
            return false;
        }

        // 验证短信验证码
        const code = this.smsCodes.get(phone);
        if (!code || code.code !== userData.captcha) {
            showToast('验证码错误，请重新输入', 'error');
            return false;
        }
        if (Date.now() - code.time > 5 * 60 * 1000) {
            showToast('验证码已过期，请重新获取', 'error');
            return false;
        }

        let users = await storage.getUsers();

        if (users.find(u => u.username === username)) {
            showToast('该用户名已被注册，请更换', 'error');
            return false;
        }

        // 处理邀请码
        let inviterId = null;
        if (inviteCode) {
            const inviter = users.find(u => u.inviteCode === inviteCode);
            if (inviter) {
                inviterId = inviter.id;
            } else {
                showToast('邀请码无效，请检查后重试', 'warning');
            }
        }

        const newUser = {
            id: Date.now(),
            username,
            phone,
            password: btoa(password),
            loginPermission: true,
            previewPermission: true,
            downloadPermission: true,
            vipLevel: 'free',
            points: 0,
            monthlyPoints: 0,
            pointPackPoints: 0,
            registeredAt: new Date().toISOString(),
            autoRenew: false,
            inviteCode: this.generateInviteCode(),
            inviterId,
            githubLogin: false,
        };

        users.push(newUser);
        await storage.saveUsers(users);

        // 创建邀请记录
        if (inviterId) {
            const invitations = JSON.parse(localStorage.getItem('piggy__data/invitations.json') || '{}');
            if (!invitations[inviterId]) invitations[inviterId] = [];
            invitations[inviterId].push({
                inviteeId: newUser.id,
                inviteeName: username,
                registeredAt: new Date().toISOString(),
                firstPurchaseAt: null,
                rewardPoints: 0,
                status: 'pending',
            });
            localStorage.setItem('piggy__data/invitations.json', JSON.stringify(invitations));
        }

        showToast('注册成功！请登录', 'success');
        return true;
    }

    // ===== 找回密码 =====
    async forgotPassword(userData) {
        const { username, phone, newPassword, confirmPassword, captcha } = userData;

        if (newPassword !== confirmPassword) {
            showToast('两次输入的密码不一致', 'error');
            return false;
        }

        const users = await storage.getUsers();
        const user = users.find(u => u.username === username && u.phone === phone);

        if (!user) {
            showToast('用户名与手机号不匹配，请核实后重试', 'error');
            return false;
        }

        const code = this.smsCodes.get(phone);
        if (!code || code.code !== captcha) {
            showToast('验证码错误，请重新输入', 'error');
            return false;
        }

        user.password = btoa(newPassword);
        await storage.saveUsers(users);

        showToast('密码重置成功！请登录', 'success');
        return true;
    }

    // ===== 发送短信验证码（模拟） =====
    sendCaptcha(phone) {
        if (!/^1[3-9]\d{9}$/.test(phone)) {
            showToast('请输入正确的手机号', 'error');
            return;
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        this.smsCodes.set(phone, { code, time: Date.now() });

        // 模拟发送（实际项目中这里调用短信服务）
        console.log(`[模拟短信] 手机号 ${phone} 的验证码：${code}`);

        // 开发模式下直接显示验证码
        showToast(`验证码已发送（演示模式：${code}）`, 'info');
        startCaptchaCountdown();
    }

    // ===== 工具方法 =====
    setCurrentUser(user) {
        this.currentUser = user;
        localStorage.setItem('current_user', JSON.stringify(user));
        this.updateUI();
    }

    getCurrentUser() {
        if (this.currentUser) return this.currentUser;
        const saved = localStorage.getItem('current_user');
        if (saved) {
            this.currentUser = JSON.parse(saved);
            return this.currentUser;
        }
        return null;
    }

    logout() {
        this.currentUser = null;
        this.verifiedSMS = false;
        localStorage.removeItem('current_user');
        location.reload();
    }

    isLoggedIn() {
        return this.getCurrentUser() !== null;
    }

    // 重置周期性秒点
    resetPeriodicPoints(user) {
        const now = new Date();
        const lastReset = user.lastPointsReset ? new Date(user.lastPointsReset) : null;

        if (user.vipLevel === 'free') {
            // 每日重置
            if (!lastReset || now.toDateString() !== lastReset.toDateString()) {
                user.points = CONFIG.DEFAULT_PACKAGES.find(p => p.id === 'free').dailyPoints;
                user.lastPointsReset = now.toISOString();
            }
        } else {
            // 每月重置
            if (!lastReset || now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
                const pkg = CONFIG.DEFAULT_PACKAGES.find(p => p.id === user.vipLevel);
                if (pkg) {
                    user.monthlyPoints = pkg.dailyPoints; // 这里是每月赠送
                    user.lastPointsReset = now.toISOString();
                }
            }
        }
    }

    // 检查并扣减秒点
    async consumePoints(count = 1) {
        const user = this.getCurrentUser();
        if (!user) return false;

        const totalPoints = (user.points || 0) + (user.pointPackPoints || 0);

        if (totalPoints < count) {
            showToast('秒点已用完，请购买会员套餐或秒点包', 'error');
            return false;
        }

        // 优先扣减赠送秒点
        if ((user.points || 0) >= count) {
            user.points -= count;
        } else {
            const remaining = count - (user.points || 0);
            user.points = 0;
            user.pointPackPoints -= remaining;
        }

        // 更新存储
        const users = await storage.getUsers();
        const idx = users.findIndex(u => u.id === user.id);
        if (idx >= 0) {
            users[idx] = { ...users[idx], ...user };
            await storage.saveUsers(users);
        }

        this.setCurrentUser(user);
        return true;
    }

    generateInviteCode() {
        return Math.random().toString(36).substring(2, 10).toUpperCase();
    }

    updateUI() {
        const user = this.getCurrentUser();
        if (!user) return;

        const usernameEl = document.getElementById('username-display');
        const vipEl = document.getElementById('vip-badge');
        const pointsEl = document.getElementById('points-display');

        if (usernameEl) usernameEl.textContent = user.username;
        if (vipEl) {
            const vipNames = { free: '免费版', pro: '专业版', flagship: '旗舰版' };
            vipEl.textContent = vipNames[user.vipLevel] || '免费版';
            vipEl.className = `vip-badge vip-${user.vipLevel}`;
        }
        if (pointsEl) {
            const total = (user.points || 0) + (user.monthlyPoints || 0) + (user.pointPackPoints || 0);
            pointsEl.textContent = total;
        }
    }
}

// 全局认证实例
const auth = new Auth();

// ===== 工具函数 =====
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'times' : 'info'}"></i> ${message}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
}

function startCaptchaCountdown() {
    const btns = document.querySelectorAll('#send-captcha, #send-forgot-captcha');
    let countdown = 60;
    btns.forEach(btn => btn.disabled = true);
    const timer = setInterval(() => {
        btns.forEach(btn => btn.textContent = `${countdown}s`);
        countdown--;
        if (countdown < 0) {
            clearInterval(timer);
            btns.forEach(btn => { btn.textContent = '获取验证码'; btn.disabled = false; });
        }
    }, 1000);
}

// 页面切换
function switchTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    document.querySelector(`.auth-tab[data-tab="${tab}"]`).classList.add('active');
    document.getElementById(`${tab}-form`).classList.add('active');
}

// 导航
function navigateTo(page) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelector(`.nav-item[data-page="${page}"]`).classList.add('active');
    document.getElementById(`page-${page}`).classList.add('active');

    // 加载页面数据
    if (page === 'home') loadHomePage();
    if (page === 'purchase') loadPurchasePage();
    if (page === 'orders') loadOrdersPage();
    if (page === 'profile') loadProfilePage();
    if (page === 'favorites') loadFavoritesPage();
    if (page === 'groups') loadGroupsPage();
    if (page === 'tasks') loadTasksPage();
    if (page === 'notifications') loadNotificationsPage();
}

function showApp() {
    document.getElementById('auth-area').style.display = 'none';
    document.getElementById('app-area').style.display = 'flex';
    auth.updateUI();
    loadHomePage();
    loadAnnouncements();
    loadRecommendations();
    updateNotificationBadge();
}

function logout() {
    auth.logout();
}

// 夜间模式
function toggleNightMode() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    const newTheme = current === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('night-mode', newTheme);
    document.getElementById('night-icon').className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

// 关闭公告
function closeBanner() {
    document.getElementById('announcement-banner').style.display = 'none';
}
