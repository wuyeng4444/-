# 无影 · 个人设定集网站

无影的个人世界观设定归档站，目前收录《帝国示录：我们是始嗣》。

## 功能

- 首页 / 目录 / 文章列表 / 文章详情 / 标签 / 关于
- Markdown 渲染（本地 `marked.js`，离线可用）
- 关键词搜索 + 分类筛选 + 标签云
- 随机角色立绘（页面左右两侧，每次刷新随机）
- 图片点击放大（lightbox）
- 本地文本编辑（密钥开启，存浏览器 localStorage）

## 目录结构

```
wuyeng/
├── build_articles.py        # 从设定集 txt 生成文章数据
└── website/                 # 静态站点（纯 HTML/CSS/JS，无后端）
    ├── index.html           # 首页
    ├── contents.html        # 目录
    ├── articles.html        # 文章列表
    ├── article.html         # 文章详情
    ├── tags.html            # 标签
    ├── about.html           # 关于
    ├── favicon.jpg
    └── assets/
        ├── css/style.css
        ├── js/
        │   ├── app.js       # 站点逻辑
        │   ├── articles.js  # 文章数据（由脚本生成）
        │   ├── characters.js# 角色立绘池
        │   └── marked.min.js# Markdown 渲染库
        └── img/             # 立绘、配图、头像
```

## 本地预览

```bash
cd website
python -m http.server 8123
# 浏览器打开 http://localhost:8123
```

## 更新内容

1. 修改源设定集 txt（`build_articles.py` 里的 `SRC` 路径指向它）
2. 重新生成数据：

   ```bash
   python build_articles.py
   ```

3. 刷新站点即可。

## 部署

纯静态站，可部署到任意静态托管：

- **Netlify**：把 `website/` 文件夹拖到 [app.netlify.com/drop](https://app.netlify.com/drop)
- **GitHub Pages**：仓库 Settings → Pages → 发布源选 `website/` 目录
- **Vercel**：导入仓库，输出目录设为 `website`

## 说明

- 文章内容存于 `website/assets/js/articles.js`（由脚本自动生成，不要手动改这个文件）。
- 站内编辑功能的数据存于浏览器 localStorage，仅对当前浏览器生效；要长期修改请直接改源 txt 后重跑脚本。
