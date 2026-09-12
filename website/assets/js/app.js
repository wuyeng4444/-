/* =========================================================
   无影 · 个人设定集网站 — 共享逻辑
   ========================================================= */

(function () {
  const DATA = window.SITE_DATA || { articles: [], tags: [] };
  const CHARS = window.CHARACTERS || [];

  const EDIT_KEY = "wuyeng"; // 开启文本编辑的密钥
  const STORE_KEY = "site_overrides";

  function readStore() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); } catch (e) { return {}; }
  }
  function writeStore(d) {
    localStorage.setItem(STORE_KEY, JSON.stringify(d));
  }

  // 从 localStorage 加载本地文章管理数据（修改 / 删除 / 新增）
  (function loadLocalData() {
    const d = readStore();
    const edits = d.edits || {};
    const deleted = d.deleted || [];

    DATA.articles.forEach(function (a) {
      const e = edits[a.id];
      if (!e) return;
      if (e.title != null) a.title = e.title;
      if (e.content != null) a.content = e.content;
      if (e.summary != null) a.summary = e.summary;
      if (e.category != null) a.category = e.category;
      if (e.tags != null) a.tags = e.tags;
    });

    // 新增：edits 里存在、但原始列表里没有的 id（完整对象）
    Object.keys(edits).forEach(function (id) {
      if (!DATA.articles.some(function (a) { return a.id === id; })) {
        DATA.articles.push(edits[id]);
      }
    });

    if (deleted.length) {
      DATA.articles = DATA.articles.filter(function (a) { return deleted.indexOf(a.id) === -1; });
    }
  })();

  // ---------- 工具 ----------
  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // 按 id 取文章
  function byId(id) {
    return DATA.articles.find(function (a) { return a.id === id; });
  }

  // 从 URL 读取参数
  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  // 导航激活态
  function highlightNav(key) {
    document.querySelectorAll(".nav-links a").forEach(function (a) {
      a.classList.toggle("active", a.dataset.nav === key);
    });
  }

  // ---------- 随机角色立绘 ----------
  // 每次打开页面：左右两侧各随机抽一张（按 side 分组）
  function renderCharacter() {
    if (!CHARS.length) return;
    // 移除已有的（防止重复注入）
    document.querySelectorAll(".kiana-side").forEach(function (el) { el.remove(); });

    const lefts = CHARS.filter(function (c) { return c.side === "left"; });
    const rights = CHARS.filter(function (c) { return c.side === "right"; });
    const pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };

    const chosen = [];
    if (lefts.length) chosen.push({ c: pick(lefts), cls: "left" });
    if (rights.length) chosen.push({ c: pick(rights), cls: "right" });

    chosen.forEach(function (item) {
      const aside = document.createElement("aside");
      aside.className = "kiana-side " + item.cls;
      aside.setAttribute("aria-hidden", "true");
      aside.innerHTML =
        '<div class="kiana-figure">' +
        '<img class="kiana-img" src="' + esc(item.c.src) + '" alt="角色立绘">' +
        '</div>';
      document.body.insertBefore(aside, document.body.firstChild);
    });

    document.body.classList.add("char-both");
  }

  // ---------- 首页门户 ----------
  function renderHome() {
    highlightNav("home");

    // 统计
    const statsEl = document.getElementById("stats-row");
    if (statsEl) {
      const cats = {};
      DATA.articles.forEach(function (a) { cats[a.category] = (cats[a.category] || 0) + 1; });
      statsEl.innerHTML =
        '<div class="stat"><div class="num">' + DATA.total + '</div><div class="label">设定条目</div></div>' +
        '<div class="stat"><div class="num">' + Object.keys(cats).length + '</div><div class="label">分类</div></div>' +
        '<div class="stat"><div class="num">' + DATA.tags.length + '</div><div class="label">标签</div></div>';
    }

    // 分类导航卡片
    const gridEl = document.getElementById("cat-grid");
    if (gridEl) {
      const cats = {};
      DATA.articles.forEach(function (a) { cats[a.category] = (cats[a.category] || 0) + 1; });
      const CAT_ORDER = [
        "始嗣", "帝国", "空间", "暗网", "异空间",
        "特殊事件", "特殊道具", "人物", "其他"
      ];
      const names = Object.keys(cats).sort(function (a, b) {
        const ia = CAT_ORDER.indexOf(a); const ib = CAT_ORDER.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });
      gridEl.innerHTML = names.map(function (c) {
        return (
          '<a class="cat-card" href="articles.html?cat=' + encodeURIComponent(c) + '">' +
            '<span class="cat-name">' + esc(c) + "</span>" +
            '<span class="cat-num">' + cats[c] + " 篇</span>" +
          "</a>"
        );
      }).join("");
    }

  }

  // ---------- 文章列表页 ----------
  function renderArticles() {
    highlightNav("articles");

    // 新建文章按钮（需密钥）
    const newBtn = document.getElementById("new-article-btn");
    if (newBtn) newBtn.addEventListener("click", function () { openKeyModal(createArticle); });

    const listEl = document.getElementById("article-list");
    if (!listEl) return;

    const searchEl = document.getElementById("search-input");
    const catEl = document.getElementById("cat-filter");
    const countEl = document.getElementById("result-count");

    // 填充分类下拉
    const cats = [];
    DATA.articles.forEach(function (a) {
      if (cats.indexOf(a.category) === -1) cats.push(a.category);
    });
    cats.forEach(function (c) {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      catEl.appendChild(opt);
    });

    // 支持 ?cat= 参数预选
    const initCat = getParam("cat");
    if (initCat) catEl.value = initCat;

    function render() {
      const kw = (searchEl.value || "").trim().toLowerCase();
      const cat = catEl.value || "";

      const filtered = DATA.articles.filter(function (a) {
        // 默认隐藏"待补全"占位条目（有搜索或分类筛选时显示全部匹配项）
        if (a.is_placeholder && !kw && !cat) return false;
        const hitKw = !kw ||
          a.title.toLowerCase().indexOf(kw) !== -1 ||
          a.summary.toLowerCase().indexOf(kw) !== -1 ||
          a.content.toLowerCase().indexOf(kw) !== -1 ||
          a.tags.some(function (t) { return t.toLowerCase().indexOf(kw) !== -1; });
        const hitCat = !cat || a.category === cat;
        return hitKw && hitCat;
      });

      if (countEl) countEl.textContent = filtered.length + " 篇";

      if (filtered.length === 0) {
        listEl.innerHTML = '<div class="empty-state">没有找到匹配的内容</div>';
        return;
      }

      listEl.innerHTML = filtered.map(function (a) {
        return (
          '<a class="article-card" href="article.html?id=' + encodeURIComponent(a.id) + '">' +
            '<div class="card-top">' +
              '<h2 class="card-title">' + esc(a.title) + "</h2>" +
              '<span class="card-date">' + esc(a.date) + "</span>" +
            "</div>" +
            '<p class="card-summary">' + esc(a.summary) + "</p>" +
            '<div class="card-meta">' +
              '<span class="cat-chip">' + esc(a.category) + "</span>" +
              a.tags.map(function (t) { return '<span class="tag-chip">' + esc(t) + "</span>"; }).join("") +
            "</div>" +
          "</a>"
        );
      }).join("");
    }

    searchEl.addEventListener("input", render);
    catEl.addEventListener("change", render);
    render();
  }

  // ---------- 文章详情 ----------
  function renderArticle() {
    highlightNav("articles");

    const id = getParam("id");
    const a = byId(id) || DATA.articles[0];

    const titleEl = document.getElementById("article-title");
    const bodyEl = document.getElementById("article-body");

    if (!titleEl || !bodyEl) return;

    document.title = a.title + " · 无影";

    titleEl.textContent = a.title;

    const catEl = document.getElementById("article-category");
    if (catEl) catEl.textContent = a.category;

    const metaEl = document.getElementById("article-meta");
    if (metaEl) {
      metaEl.innerHTML =
        '<span>发布于 ' + esc(a.date) + "</span>" +
        a.tags.map(function (t) {
          return '<a class="tag-chip" href="tags.html?tag=' + encodeURIComponent(t) + '">' + esc(t) + "</a>";
        }).join("");
    }

    // Markdown 渲染
    if (window.marked && typeof marked.parse === "function") {
      bodyEl.innerHTML = marked.parse(a.content);
    } else {
      // 兜底：纯文本按段落
      bodyEl.innerHTML = a.content.split("\n").map(function (line) {
        if (!line.trim()) return "";
        if (/^##\s/.test(line)) return "<h2>" + esc(line.replace(/^##\s/, "")) + "</h2>";
        if (/^---/.test(line)) return "<hr>";
        return "<p>" + esc(line) + "</p>";
      }).join("");
    }

    // 上一篇 / 下一篇
    const idx = DATA.articles.indexOf(a);
    const prev = DATA.articles[idx - 1];
    const next = DATA.articles[idx + 1];
    const navEl = document.getElementById("prev-next");
    if (navEl) {
      navEl.innerHTML =
        (prev ? '<a href="article.html?id=' + prev.id + '">← ' + esc(prev.title) + "</a>" : "<span></span>") +
        (next ? '<a href="article.html?id=' + next.id + '">' + esc(next.title) + " →</a>" : "<span></span>");
    }

    setupEditor(a, bodyEl);
  }

  // ---------- 文本编辑（密钥开启） ----------
  function localSummary(md) {
    const t = md
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^---\s*$/gm, "")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/[*_`>#\[\]()\-—]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return t.slice(0, 100) + (t.length > 100 ? "……" : "");
  }

  function saveArticle(a) {
    const d = readStore();
    d.edits = d.edits || {};
    d.edits[a.id] = {
      id: a.id,
      title: a.title,
      content: a.content,
      summary: a.summary,
      category: a.category,
      tags: a.tags,
      date: a.date,
      word_count: a.word_count || 0,
      is_placeholder: a.is_placeholder || false,
    };
    writeStore(d);
  }

  function deleteArticle(a) {
    if (!confirm("确定删除《" + a.title + "》？\n（改动仅存于当前浏览器，删除后跳回列表）")) return;
    const d = readStore();
    d.deleted = d.deleted || [];
    if (d.deleted.indexOf(a.id) === -1) d.deleted.push(a.id);
    if (d.edits && d.edits[a.id]) delete d.edits[a.id];
    writeStore(d);
    window.location.href = "articles.html";
  }

  function createArticle() {
    const d = readStore();
    d.edits = d.edits || {};
    const id = "local-" + Date.now().toString(36);
    const article = {
      id: id,
      slug: id,
      title: "未命名文章",
      content: "",
      summary: "",
      category: "其他",
      tags: ["其他"],
      date: new Date().toISOString().slice(0, 10),
      word_count: 0,
      is_placeholder: false,
    };
    d.edits[id] = article;
    writeStore(d);
    window.location.href = "article.html?id=" + encodeURIComponent(id);
  }

  function renderBody(a, bodyEl) {
    if (window.marked && typeof marked.parse === "function") {
      bodyEl.innerHTML = marked.parse(a.content);
    } else {
      bodyEl.innerHTML = a.content.split("\n").map(function (line) {
        if (!line.trim()) return "";
        if (/^##\s/.test(line)) return "<h2>" + esc(line.replace(/^##\s/, "")) + "</h2>";
        if (/^---/.test(line)) return "<hr>";
        return "<p>" + esc(line) + "</p>";
      }).join("");
    }
    bodyEl.querySelectorAll("img").forEach(function (img) { img.loading = "lazy"; });
  }

  function openKeyModal(onSuccess) {
    const mask = document.createElement("div");
    mask.className = "key-modal-mask";
    mask.innerHTML =
      '<div class="key-modal">' +
        "<h3>编辑需要密钥</h3>" +
        '<input type="password" class="key-input" placeholder="请输入密钥" autocomplete="off">' +
        '<div class="key-modal-actions">' +
          '<button type="button" class="key-cancel">取消</button>' +
          '<button type="button" class="key-ok">确认</button>' +
        "</div>" +
      "</div>";
    document.body.appendChild(mask);

    const input = mask.querySelector(".key-input");
    const okBtn = mask.querySelector(".key-ok");
    const cancelBtn = mask.querySelector(".key-cancel");
    const close = function () { mask.remove(); };

    function trySubmit() {
      if (input.value === EDIT_KEY) {
        close();
        onSuccess();
      } else {
        input.value = "";
        input.placeholder = "密钥错误，请重试";
        input.classList.add("error");
      }
    }

    okBtn.addEventListener("click", trySubmit);
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") trySubmit(); });
    cancelBtn.addEventListener("click", close);
    mask.addEventListener("click", function (e) { if (e.target === mask) close(); });
    input.focus();
  }

  function startEditing(a, bodyEl) {
    const original = a.content;
    const wrapper = document.createElement("div");
    wrapper.className = "editor-wrap";
    wrapper.innerHTML =
      '<input class="edit-title" type="text" placeholder="文章标题">' +
      '<div class="md-help">' +
        '<span class="md-help-title">标记说明：</span>' +
        '<span><code>**文字**</code>=加粗</span>' +
        '<span><code>## 文字</code>=标题</span>' +
        '<span><code>- 文字</code>=列表</span>' +
        '<span><code>&gt; 文字</code>=引用</span>' +
        '<span><code>"文字"</code>=台词/名称</span>' +
        '<span><code>![图](链接)</code>=图片</span>' +
        '<span><code>---</code>=分隔线</span>' +
      "</div>" +
      '<div class="editor-panes">' +
        '<textarea class="edit-textarea" spellcheck="false"></textarea>' +
        '<div class="edit-preview"></div>' +
      "</div>" +
      '<div class="editor-actions">' +
        '<span class="editor-hint">左改右预览 · 支持 Markdown · 保存后仅存于当前浏览器</span>' +
        '<button type="button" class="editor-cancel">取消</button>' +
        '<button type="button" class="editor-save">保存</button>' +
      "</div>";

    bodyEl.innerHTML = "";
    bodyEl.appendChild(wrapper);

    const ta = wrapper.querySelector(".edit-textarea");
    const preview = wrapper.querySelector(".edit-preview");
    const titleInput = wrapper.querySelector(".edit-title");
    ta.value = a.content;
    titleInput.value = a.title;

    function refreshPreview() {
      if (window.marked && typeof marked.parse === "function") {
        preview.innerHTML = marked.parse(ta.value);
      } else {
        preview.textContent = ta.value;
      }
    }

    ta.addEventListener("input", refreshPreview);
    refreshPreview();

    // 左右同步滚动
    function syncScroll(from, to) {
      const fromMax = from.scrollHeight - from.clientHeight;
      const toMax = to.scrollHeight - to.clientHeight;
      if (fromMax <= 0 || toMax <= 0) return;
      to.scrollTop = (toMax * from.scrollTop) / fromMax;
    }
    let syncing = false;
    ta.addEventListener("scroll", function () {
      if (syncing) return;
      syncing = true;
      syncScroll(ta, preview);
      syncing = false;
    });
    preview.addEventListener("scroll", function () {
      if (syncing) return;
      syncing = true;
      syncScroll(preview, ta);
      syncing = false;
    });

    ta.addEventListener("keydown", function (e) {
      if (e.key === "Tab") {
        e.preventDefault();
        const s = ta.selectionStart;
        ta.value = ta.value.slice(0, s) + "  " + ta.value.slice(ta.selectionEnd);
        ta.selectionStart = ta.selectionEnd = s + 2;
        refreshPreview();
      }
    });

    wrapper.querySelector(".editor-cancel").addEventListener("click", function () {
      a.content = original;
      renderBody(a, bodyEl);
    });
    wrapper.querySelector(".editor-save").addEventListener("click", function () {
      const newTitle = titleInput.value.trim();
      if (newTitle) {
        a.title = newTitle;
        const h1 = document.getElementById("article-title");
        if (h1) h1.textContent = newTitle;
        document.title = newTitle + " · 无影";
      }
      a.content = ta.value;
      a.summary = localSummary(a.content);
      saveArticle(a);
      renderBody(a, bodyEl);
    });
  }

  function setupEditor(a, bodyEl) {
    const headerEl = document.querySelector(".article-header");
    if (!headerEl) return;

    // 编辑按钮
    const editBtn = document.createElement("button");
    editBtn.className = "edit-btn";
    editBtn.type = "button";
    editBtn.textContent = "编辑";
    editBtn.title = "修改本文（需密钥）";
    headerEl.appendChild(editBtn);
    editBtn.addEventListener("click", function () {
      openKeyModal(function () { startEditing(a, bodyEl); });
    });

    // 删除按钮
    const delBtn = document.createElement("button");
    delBtn.className = "edit-btn del-btn";
    delBtn.type = "button";
    delBtn.textContent = "删除";
    delBtn.title = "删除本文（需密钥）";
    headerEl.appendChild(delBtn);
    delBtn.addEventListener("click", function () {
      openKeyModal(function () { deleteArticle(a); });
    });
  }

  // ---------- 标签页 ----------
  function renderTags() {
    highlightNav("tags");

    const cloudEl = document.getElementById("tag-cloud");
    const listEl = document.getElementById("tag-articles");
    if (!cloudEl || !listEl) return;

    const initial = getParam("tag") || "";
    let activeTag = initial;

    // 标签云
    cloudEl.innerHTML = DATA.tags.map(function (t) {
      return (
        '<button class="tag-cloud-item' + (t.name === activeTag ? " active" : "") + '" data-tag="' + esc(t.name) + '">' +
          esc(t.name) + '<span class="count">' + t.count + "</span>" +
        "</button>"
      );
    }).join("");

    function renderList() {
      const titleEl = document.getElementById("tag-title");
      if (activeTag) {
        const matched = DATA.articles.filter(function (a) {
          return a.tags.indexOf(activeTag) !== -1;
        });
        if (titleEl) titleEl.textContent = "「" + activeTag + "」相关 · " + matched.length + " 篇";
        listEl.innerHTML = matched.map(function (a) {
          return (
            '<a class="article-card" href="article.html?id=' + encodeURIComponent(a.id) + '">' +
              '<div class="card-top">' +
                '<h2 class="card-title">' + esc(a.title) + "</h2>" +
                '<span class="card-date">' + esc(a.date) + "</span>" +
              "</div>" +
              '<p class="card-summary">' + esc(a.summary) + "</p>" +
              '<div class="card-meta">' +
                '<span class="cat-chip">' + esc(a.category) + "</span>" +
                a.tags.map(function (t) { return '<span class="tag-chip">' + esc(t) + "</span>"; }).join("") +
              "</div>" +
            "</a>"
          );
        }).join("");
      } else {
        if (titleEl) titleEl.textContent = "选择一个标签查看相关文章";
        listEl.innerHTML = '<div class="empty-state">点击上方任意标签，查看该分类下的全部文章</div>';
      }
    }

    cloudEl.addEventListener("click", function (e) {
      const btn = e.target.closest(".tag-cloud-item");
      if (!btn) return;
      activeTag = btn.dataset.tag;
      cloudEl.querySelectorAll(".tag-cloud-item").forEach(function (b) {
        b.classList.toggle("active", b.dataset.tag === activeTag);
      });
      renderList();
    });

    renderList();
  }

  // ---------- 关于页 ----------
  function renderAbout() {
    highlightNav("about");

    const barsEl = document.getElementById("cat-bars");
    if (!barsEl) return;

    const cats = {};
    DATA.articles.forEach(function (a) {
      cats[a.category] = (cats[a.category] || 0) + 1;
    });
    const max = Math.max.apply(null, Object.keys(cats).map(function (k) { return cats[k]; }));

    barsEl.innerHTML = Object.keys(cats).map(function (c) {
      const pct = Math.round((cats[c] / max) * 100);
      return (
        '<div class="cat-bar-row">' +
          '<span class="cat-bar-name">' + esc(c) + "</span>" +
          '<div class="cat-bar-track"><div class="cat-bar-fill" style="width:' + pct + '%"></div></div>' +
          '<span class="cat-bar-count">' + cats[c] + "</span>" +
        "</div>"
      );
    }).join("");
  }

  // ---------- 目录页 ----------
  function renderContents() {
    highlightNav("contents");
    const el = document.getElementById("toc-list");
    const totalEl = document.getElementById("toc-total");
    const totalsEl = document.getElementById("toc-totals");
    if (!el) return;

    // 按出现顺序分组
    const byCat = {};
    DATA.articles.forEach(function (a) {
      if (!byCat[a.category]) byCat[a.category] = [];
      byCat[a.category].push(a);
    });
    const catOrder = [];
    DATA.articles.forEach(function (a) {
      if (catOrder.indexOf(a.category) === -1) catOrder.push(a.category);
    });

    // 标题排序映射：希望显示的顺序（与设定集原结构一致）
    const CAT_ORDER = [
      "始嗣", "帝国", "空间", "暗网", "异空间",
      "特殊事件", "特殊道具", "人物", "其他"
    ];
    catOrder.sort(function (a, b) {
      const ia = CAT_ORDER.indexOf(a); const ib = CAT_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

    let total = 0;
    let totalWords = 0;

    const html = catOrder.map(function (cat) {
      const items = byCat[cat];
      total += items.length;
      const itemHtml = items.map(function (a, i) {
        totalWords += a.word_count || 0;
        const ph = a.is_placeholder
          ? '<span class="ph-tag">待补全</span>'
          : "";
        return (
          '<a class="toc-item' + (a.is_placeholder ? " placeholder" : "") + '" href="article.html?id=' + encodeURIComponent(a.id) + '">' +
            '<span class="toc-num">' + (i + 1) + ".</span>" +
            '<span class="toc-title">' + esc(a.title) + "</span>" +
            '<span class="toc-meta">' + (a.word_count || 0) + " 字" + ph + "</span>" +
          "</a>"
        );
      }).join("");

      return (
        '<section class="toc-section">' +
          "<h2>" + esc(cat) + '<span class="toc-count">' + items.length + " 章</span></h2>" +
          '<div class="toc-items">' + itemHtml + "</div>" +
        "</section>"
      );
    }).join("");

    el.innerHTML = html;
    if (totalEl) totalEl.textContent = total;
    if (totalsEl) totalsEl.textContent = "合计 " + total + " 章 · 约 " + totalWords.toLocaleString() + " 字";
  }

  // ---------- 路由 ----------
  const page = document.body.dataset.page;
  // 详情页（article）不放立绘，其他页都随机抽两张
  if (page !== "article") renderCharacter();
  if (page === "home") renderHome();
  else if (page === "articles") renderArticles();
  else if (page === "article") renderArticle();
  else if (page === "tags") renderTags();
  else if (page === "about") renderAbout();
  else if (page === "contents") renderContents();
})();

// ---------- 图片点击放大（lightbox） ----------
(function () {
  let overlay = null;
  function close() {
    if (overlay) overlay.classList.remove("show");
    document.body.style.overflow = "";
  }
  function open(src) {
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "lightbox";
      const img = document.createElement("img");
      img.alt = "预览";
      overlay.appendChild(img);
      overlay.addEventListener("click", close);
      document.body.appendChild(overlay);
    }
    overlay.querySelector("img").src = src;
    overlay.classList.add("show");
    document.body.style.overflow = "hidden";
  }
  document.addEventListener("click", function (e) {
    const img = e.target.closest(".article-body img");
    if (img && img.src) open(img.src);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") close();
  });
})();
