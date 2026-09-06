/**
 * 小猪猪教育数字资源库 - 初始化脚本
 * 确保演示模式开箱即用
 */

// 在 storage.js 加载后、app.js 加载前执行
(function () {
    'use strict';

    // 等待 DOM 加载后初始化演示数据
    document.addEventListener('DOMContentLoaded', function () {
        initDemoData();
    });

    function initDemoData() {
        // 初始化默认数据到 LocalStorage（如果不存在）
        const defaults = {
            'piggy__data/users.json': [
                {
                    id: 1, username: 'admin_user', phone: '13800138000', password: btoa('123456'),
                    loginPermission: true, previewPermission: true, downloadPermission: true,
                    vipLevel: 'flagship', points: 500, monthlyPoints: 500, pointPackPoints: 2800,
                    registeredAt: '2024-01-01T00:00:00Z', autoRenew: true,
                    inviteCode: 'ADMIN001', githubLogin: false, vipExpireAt: '2027-12-31T00:00:00Z'
                },
                {
                    id: 2, username: 'demo_student', phone: '13900139000', password: btoa('123456'),
                    loginPermission: true, previewPermission: true, downloadPermission: true,
                    vipLevel: 'pro', points: 50, monthlyPoints: 100, pointPackPoints: 2000,
                    registeredAt: '2024-02-01T00:00:00Z', autoRenew: false,
                    inviteCode: 'DEMO001', githubLogin: false, vipExpireAt: '2027-03-01T00:00:00Z'
                },
                {
                    id: 3, username: 'test_user', phone: '13700137000', password: btoa('123456'),
                    loginPermission: true, previewPermission: false, downloadPermission: true,
                    vipLevel: 'free', points: 3, monthlyPoints: 0, pointPackPoints: 0,
                    registeredAt: '2024-03-01T00:00:00Z', autoRenew: false,
                    inviteCode: 'TEST001', githubLogin: false
                }
            ],
            'piggy__data/packages.json': CONFIG.DEFAULT_PACKAGES,
            'piggy__data/point-packs.json': CONFIG.DEFAULT_POINT_PACKS,
            'piggy__data/coupons.json': DEFAULT_DATA.coupons,
            'piggy__data/announcements.json': DEFAULT_DATA.announcements,
            'piggy__data/tasks.json': DEFAULT_DATA.tasks,
            'piggy__data/config.json': DEFAULT_DATA.config,
            'piggy__data/orders.json': [
                {
                    id: 'ORD1700000000', userId: 2, username: 'demo_student',
                    type: '会员套餐', itemName: '专业版', price: 14.90, discountedPrice: 11.92,
                    couponCode: 'WELCOME10', paymentProof: 'proof_demo.png',
                    status: 'approved', createdAt: '2024-06-01T10:00:00Z',
                    approvedAt: '2024-06-01T12:00:00Z'
                }
            ],
            'piggy__data/refunds.json': [],
            'piggy__data/groups.json': [
                {
                    id: '1', name: '高等数学学习小组', ownerId: 1,
                    members: [{ id: 1, name: 'admin_user', role: 'owner' }, { id: 2, name: 'demo_student', role: 'member' }],
                    resources: [], assignments: [],
                    createdAt: '2024-05-01T00:00:00Z'
                },
                {
                    id: '2', name: '英语四级备考班', ownerId: 2,
                    members: [{ id: 2, name: 'demo_student', role: 'owner' }],
                    resources: [], assignments: [],
                    createdAt: '2024-05-15T00:00:00Z'
                }
            ],
            'piggy__data/visitor-stats.json': [
                { date: new Date().toDateString(), uv: 42, pv: 156 }
            ]
        };

        // 只在首次访问时初始化
        let isFirstVisit = false;
        for (const [key, value] of Object.entries(defaults)) {
            if (!localStorage.getItem(key)) {
                localStorage.setItem(key, JSON.stringify(value));
                isFirstVisit = true;
            }
        }

        // 设置 GitHub 配置（演示用默认值）
        if (!localStorage.getItem('github_owner')) {
            localStorage.setItem('github_owner', CONFIG.GITHUB.owner);
            localStorage.setItem('github_main_repo', CONFIG.GITHUB.mainRepo);
            localStorage.setItem('github_share_repo', CONFIG.GITHUB.shareRepo);
        }

        if (isFirstVisit) {
            console.log('%c🐷 小猪猪教育数字资源库 - 演示数据已初始化', 'color: #FF6B6B; font-size: 14px; font-weight: bold;');
            console.log('演示账号：admin_user / 123456（旗舰版）');
            console.log('演示账号：demo_student / 123456（专业版）');
            console.log('演示账号：test_user / 123456（免费版，预览权限关闭）');
        }
    }
})();
