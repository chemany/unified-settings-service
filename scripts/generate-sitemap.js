const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// 数据库实际路径 (修正后的路径)
const DB_PATH = '/root/code/unified-settings-service/database/settings.db';
const SITEMAP_PATH = '/root/code/cheman.top/notepads/sitemap.xml';

// 基础 URL
const BASE_URL = 'https://www.cheman.top';

// 静态页面配置
const STATIC_PAGES = [
    { loc: '/', priority: '1.0', freq: 'daily' },
    { loc: '/forum.html', priority: '1.0', freq: 'daily' },
    { loc: '/chemcalc.html', priority: '0.9', freq: 'monthly' },
    { loc: '/calculator', priority: '0.8', freq: 'monthly' },
    { loc: '/fluid-dynamics', priority: '0.8', freq: 'monthly' },
    { loc: '/heat-transfer', priority: '0.8', freq: 'monthly' },
    { loc: '/reactor-design', priority: '0.8', freq: 'monthly' },
    { loc: '/distillation', priority: '0.8', freq: 'monthly' },
    { loc: '/property-query', priority: '0.8', freq: 'monthly' },
    { loc: '/gas-absorption', priority: '0.8', freq: 'monthly' },
    { loc: '/safety-relief', priority: '0.8', freq: 'monthly' },
    { loc: '/psychrometrics', priority: '0.8', freq: 'monthly' },
    { loc: '/mixing', priority: '0.8', freq: 'monthly' },
    { loc: '/flash-vle', priority: '0.8', freq: 'monthly' },
    { loc: '/pump-compressor', priority: '0.8', freq: 'monthly' }
];

function generateSitemap() {
    console.log('--- Sitemap 自动生成程序启动 ---');

    if (!fs.existsSync(DB_PATH)) {
        console.error('错误: 数据库文件不存在:', DB_PATH);
        process.exit(1);
    }

    const db = new sqlite3.Database(DB_PATH);
    const today = new Date().toISOString().split('T')[0];

    db.all("SELECT id, updated_at FROM forum_posts ORDER BY id DESC", [], (err, posts) => {
        if (err) {
            console.error('读取数据库失败:', err);
            db.close();
            process.exit(1);
        }

        console.log(`成功从数据库读取 ${posts.length} 个帖子。`);

        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

        // 1. 写入静态页面
        STATIC_PAGES.forEach(page => {
            xml += `    <url>\n`;
            xml += `        <loc>${BASE_URL}${page.loc}</loc>\n`;
            xml += `        <lastmod>${today}</lastmod>\n`;
            xml += `        <changefreq>${page.freq}</changefreq>\n`;
            xml += `        <priority>${page.priority}</priority>\n`;
            xml += `    </url>\n`;
        });

        // 2. 写入动态帖子页面
        posts.forEach(post => {
            const lastmod = (post.updated_at && post.updated_at.length > 10) ? post.updated_at.split(' ')[0] : today;
            xml += `    <url>\n`;
            xml += `        <loc>${BASE_URL}/forum-detail.html?id=${post.id}</loc>\n`;
            xml += `        <lastmod>${lastmod}</lastmod>\n`;
            xml += `        <changefreq>weekly</changefreq>\n`;
            xml += `        <priority>0.6</priority>\n`;
            xml += `    </url>\n`;
        });

        xml += '</urlset>';

        try {
            fs.writeFileSync(SITEMAP_PATH, xml);
            console.log(`Sitemap 已成功更新: ${SITEMAP_PATH} (总计 ${STATIC_PAGES.length + posts.length} 个链接)`);
        } catch (writeErr) {
            console.error('无法写入 Sitemap 文件:', writeErr);
        }

        db.close();
        console.log('--- Sitemap 生成任务完成 ---');
    });
}

generateSitemap();
