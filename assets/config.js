/**
 * 小猪猪教育数字资源库 - 配置文件
 * 使用 GitHub 仓库作为后端存储
 */

const CONFIG = {
    // GitHub 仓库配置（用户需自行修改）
    GITHUB: {
        owner: 'YOUR_USERNAME',       // 替换为你的 GitHub 用户名
        mainRepo: 'resource-main',     // 主仓库名
        shareRepo: 'Every-day-Share',  // 分享仓库名
        branch: 'main',
        // GitHub OAuth 配置
        clientId: 'YOUR_CLIENT_ID',    // 替换为你的 OAuth App Client ID
        redirectUri: window.location.origin + window.location.pathname,
    },

    // 数据存储路径（在 GitHub 仓库中）
    DATA_PATHS: {
        users: '_data/users.json',
        orders: '_data/orders.json',
        coupons: '_data/coupons.json',
        packages: '_data/packages.json',
        pointPacks: '_data/point-packs.json',
        announcements: '_data/announcements.json',
        favorites: '_data/favorites.json',
        reviews: '_data/reviews.json',
        downloadLogs: '_data/download-logs.json',
        trafficStats: '_data/traffic-stats.json',
        visitorStats: '_data/visitor-stats.json',
        groups: '_data/groups.json',
        tasks: '_data/tasks.json',
        notifications: '_data/notifications.json',
        bookmarks: '_data/bookmarks.json',
        learningProgress: '_data/learning-progress.json',
        invitations: '_data/invitations.json',
        coupons: '_data/coupons.json',
        refunds: '_data/refunds.json',
        config: '_data/config.json',
    },

    // 默认套餐
    DEFAULT_PACKAGES: [
        { id: 'free', name: '免费版', price: 0, duration: '永久', dailyPoints: 3, pointsType: 'daily', benefits: ['基础资源访问', '每日3秒点'], status: 'active' },
        { id: 'pro', name: '专业版', price: 14.90, duration: '1个月', dailyPoints: 100, pointsType: 'monthly', benefits: ['全部资源访问', '每月100秒点', '优先客服', '去水印'], status: 'active' },
        { id: 'flagship', name: '旗舰版', price: 65, duration: '1个月', dailyPoints: 500, pointsType: 'monthly', benefits: ['全部资源无限制', '每月500秒点', 'VIP客服', '去水印', '自定义域名', 'API访问'], status: 'active' },
    ],

    // 默认秒点包
    DEFAULT_POINT_PACKS: [
        { id: 'pp1', points: 1000, price: 9.9, group: 'recommend', status: 'active' },
        { id: 'pp2', points: 2000, price: 19.9, originalPrice: 29.9, group: 'recommend', status: 'active' },
        { id: 'pp3', points: 4000, price: 39.9, originalPrice: 59.9, group: 'value', status: 'active' },
        { id: 'pp4', points: 8000, price: 79.9, originalPrice: 119.9, group: 'value', status: 'active' },
        { id: 'pp5', points: 16000, price: 149.9, originalPrice: 239.9, group: 'value', status: 'active' },
        { id: 'pp6', points: 28000, price: 249.9, originalPrice: 399.9, group: 'value', status: 'active' },
    ],

    // 管理端密码
    ADMIN_PASSWORD: '123456',

    // API 配置
    API: {
        baseUrl: 'https://api.github.com',
        // 使用 jsDelivr CDN 加速 raw 文件访问
        cdnBase: 'https://cdn.jsdelivr.net/gh',
        rawBase: 'https://raw.githubusercontent.com',
    },

    // 秒点规则
    POINTS_RULES: {
        downloadCost: 1,  // 每次下载消耗1秒点
    },
};

// 默认数据初始化
const DEFAULT_DATA = {
    users: [],
    orders: [],
    coupons: [
        { code: 'WELCOME10', discount: 0.9, validFrom: '2024-01-01', validTo: '2027-12-31', maxUses: 100, usedCount: 0, status: 'active' },
        { code: 'SAVE20', discount: 0.8, validFrom: '2024-01-01', validTo: '2027-12-31', maxUses: 50, usedCount: 0, status: 'active' },
    ],
    packages: CONFIG.DEFAULT_PACKAGES,
    pointPacks: CONFIG.DEFAULT_POINT_PACKS,
    announcements: [
        { id: '1', title: '欢迎使用小猪猪教育数字资源库', content: '我们致力于为您提供最优质的教育资源！', enabled: true, sort: 1, createdAt: '2024-01-01T00:00:00Z' },
    ],
    favorites: {},
    reviews: {},
    downloadLogs: [],
    trafficStats: [],
    visitorStats: [],
    groups: [],
    tasks: [
        { id: 'daily_checkin', name: '每日签到', description: '每天登录签到', points: 5, icon: 'fas fa-calendar-check' },
        { id: 'share_resource', name: '分享资源', description: '分享一个资源给好友', points: 10, icon: 'fas fa-share' },
        { id: 'review_resource', name: '评价资源', description: '对资源进行评分和评价', points: 15, icon: 'fas fa-star' },
        { id: 'invite_friend', name: '邀请好友', description: '成功邀请一位好友注册', points: 50, icon: 'fas fa-user-plus' },
        { id: 'complete_profile', name: '完善资料', description: '完善个人资料信息', points: 20, icon: 'fas fa-user-edit' },
    ],
    notifications: {},
    bookmarks: {},
    learningProgress: {},
    invitations: {},
    refunds: [],
    config: {
        inviteReward: 100,  // 邀请奖励秒点
    },
};
