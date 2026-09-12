# -*- coding: utf-8 -*-
"""
解析《帝国示录：我们是始嗣》txt，生成网站文章数据 assets/js/articles.js
"""
import json
import re
import os
from datetime import date, timedelta

SRC = r"C:\Users\无影\Downloads\帝国示录：我们是始嗣 - 无影.txt"
OUT_DIR = r"C:\Users\无影\Desktop\wuyeng\website\assets\js"
OUT = os.path.join(OUT_DIR, "articles.js")

# 顶级标题前缀 -> (分类, 标签)
CATEGORY_PREFIXES = [
    ("始嗣", "始嗣", ["始嗣", "角色", "核心设定"]),
    ("帝国", "帝国", ["帝国", "政治", "组织"]),
    ("空间", "空间", ["空间", "世界观", "法则"]),
    ("▇▇", "暗网", ["暗网", "势力", "反派"]),
    ("异空间诸国", "异空间", ["异空间", "势力"]),
    ("特殊事件", "特殊事件", ["事件", "历史"]),
    ("特殊道具", "特殊道具", ["道具", "科技"]),
    ("人物", "人物", ["人物", "角色"]),
]

# 独立标题（无空格前缀）
SPECIAL = {
    "假设": ("其他", ["假设", "IF线"]),
    "死与魔": ("其他", ["死", "魔", "背景故事"]),
    "终末": ("其他", ["终末", "结局"]),
}


def clean_title(t):
    t = t.strip()
    t = re.sub(r"[：:]\s*$", "", t)
    return t.strip()


# 人物档案等字段名（加粗用）。按长度降序匹配，避免"备注"命中"特殊备注"
FIELD_KEYS = [
    "最喜欢的食物", "最讨厌的食物", "最过厌的事", "喜观的人", "手下人员代号",
    "核心特质", "性格分析", "关键词", "机械类型", "机械核心", "战斗服装",
    "日常便服", "日常服装", "特殊服装", "特殊职务", "特殊部件", "特殊性",
    "特殊备注", "特殊标明", "权力部署", "权限等级", "任命职务", "相关事件",
    "暗网排名", "灵魂性别", "主武器", "副武器", "备用武器", "擅长的事", "不擅长的事",
    "身份", "实力", "精神力", "战力", "种族", "性格", "天赋", "别称", "假名",
    "代号", "灵魂", "躯体", "任职", "神格", "神系", "武器", "异能", "称号",
    "定位", "特征", "理念", "身高", "道具", "器具", "官定CP", "他人评价",
    "数据档案", "备注", "注",
    "极恶", "欢颂", "命定",
]
FIELD_RE = re.compile(
    r"^[「]?(?:(?:[（(][^）)]*[）)])\s*)?[“\"]?("
    + "|".join(sorted(FIELD_KEYS, key=len, reverse=True))
    + r")[”\"]?：(.*)$"
)


def to_markdown(lines, title):
    # 去除首尾空行
    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and not lines[-1].strip():
        lines.pop()

    # 第一遍：逐行分类为 (type, text)
    items = []
    first = True  # 尚未遇到第一个非空内容行
    for ln in lines:
        s = re.sub(r"^[\u3000 ]+", "", ln).rstrip()
        st = s.strip()
        if st == "":
            items.append(("blank", ""))
            continue
        # 正文开头重复的标题直接丢弃（详情页 h1 已展示 title）
        if first and st == title:
            first = False
            continue
        first = False

        # HTML 块（如 <div>、<figure>、<img>，用于图片网格等）
        if st.startswith('<'):
            items.append(("html", st))
            continue
        # 纯分隔线（只有破折号）
        if re.match(r"^[-—–]{3,}$", st):
            items.append(("hr", ""))
            continue
        # 带文字的分隔线（如 ————警告————）
        m = re.match(r"^[—\-]{2,}(.+?)[—\-]{2,}$", st)
        if m:
            items.append(("quote", "⚠️ " + m.group(1).strip()))
            continue
        # 金句引用【……】
        m = re.match(r"^【(.+)】$", st)
        if m:
            items.append(("quote", m.group(1).strip()))
            continue
        # 正文中独立出现的"始嗣-X"子标题
        if re.match(r"^始嗣-[壹贰叁肆伍陆柒捌玖矢尹貳貮]$", st):
            items.append(("h2", st))
            continue
        # 字段行：白名单字段名加粗（支持「前缀、括号说明前缀）
        m = FIELD_RE.match(st)
        if m:
            key = m.group(1)
            val = m.group(2).strip()
            # 属性区以「称号：xxx」收尾，去掉闭合的「」
            if key == "称号":
                val = val.rstrip("」")
            prefix = st[:m.start(1)]          # 含开引号「 / 括号说明
            close = st[m.end(1):m.start(2)]   # 闭引号（若有）+ 冒号
            if val:
                items.append(("field", prefix + "**" + key + "**" + close + val))
            else:
                items.append(("field", prefix + "**" + key + "**" + close.rstrip("：")))
            continue
        items.append(("para", st))

    # 第二遍：组装，段落间加空行，连续字段行转紧凑列表
    out = []
    i = 0
    n = len(items)

    def push_blank():
        if out and out[-1] != "":
            out.append("")

    while i < n:
        typ, txt = items[i]
        if typ == "blank":
            push_blank()
            i += 1
        elif typ == "field":
            j = i
            while j < n and items[j][0] == "field":
                j += 1
            push_blank()
            if j - i >= 2:  # 连续字段 → 无序列表
                for k in range(i, j):
                    out.append("- " + items[k][1])
            else:           # 孤立字段 → 独立段落
                out.append(txt)
            i = j
        elif typ == "html":
            push_blank()
            out.append(txt)
            i += 1
            while i < n and items[i][0] == "html":
                out.append(items[i][1])
                i += 1
            continue
        elif typ == "hr":
            push_blank()
            out.append("---")
            i += 1
        elif typ == "h2":
            push_blank()
            out.append("## " + txt)
            i += 1
        elif typ == "quote":
            push_blank()
            out.append("> " + txt)
            i += 1
        else:  # para
            push_blank()
            out.append(txt)
            i += 1

    # 折叠连续空行，去掉首尾空行
    res = []
    prev_blank = False
    for ln in out:
        if ln == "":
            if not prev_blank:
                res.append("")
            prev_blank = True
        else:
            res.append(ln)
            prev_blank = False
    return "\n".join(res).strip()


def make_summary(md):
    t = re.sub(r"^#{1,6}\s+", "", md, flags=re.M)
    t = re.sub(r"^---\s*$", "", t, flags=re.M)
    t = re.sub(r"[*_`>#\[\]()\-—]", "", t)
    t = re.sub(r"\s+", " ", t).strip()
    if not t:
        return "（此条目内容待补全）"
    return t[:100] + ("……" if len(t) > 100 else "")


def main():
    with open(SRC, encoding="utf-8") as f:
        raw_lines = f.read().split("\n")

    articles = []
    cur = None  # dict(title, category, tags, lines)

    def flush():
        nonlocal cur
        if cur is None:
            return
        md = to_markdown(cur["lines"], cur["title"])
        is_placeholder = not md
        if is_placeholder:
            md = "（此条目内容待补全）"
        articles.append({
            "title": cur["title"],
            "category": cur["category"],
            "tags": cur["tags"],
            "content": md,
            "is_placeholder": is_placeholder,
        })
        cur = None

    for line in raw_lines:
        s = line.rstrip("\n").rstrip("\r")
        matched = False
        if s in SPECIAL:
            flush()
            cat, tags = SPECIAL[s]
            cur = {"title": clean_title(s), "category": cat, "tags": tags, "lines": []}
            matched = True
        else:
            for p, cat, tags in CATEGORY_PREFIXES:
                if s == p:
                    flush()
                    cur = {"title": clean_title(p), "category": cat, "tags": tags, "lines": []}
                    matched = True
                    break
                elif s.startswith(p + " "):
                    flush()
                    title = s[len(p) + 1:]
                    cur = {"title": clean_title(title), "category": cat, "tags": tags, "lines": []}
                    matched = True
                    break
        if matched:
            continue
        if cur is not None:
            cur["lines"].append(s)
    flush()

    # 分配 id / 日期 / 摘要 / 字数
    start = date(2025, 6, 1)
    for i, a in enumerate(articles):
        a["id"] = "article-%03d" % (i + 1)
        a["slug"] = "article-%03d" % (i + 1)
        a["date"] = (start + timedelta(days=i)).isoformat()
        a["summary"] = make_summary(a["content"])
        # 字数（剔除 markdown 标记与空白）
        clean = re.sub(r"^#{1,6}\s+", "", a["content"], flags=re.M)
        clean = re.sub(r"^---\s*$", "", clean, flags=re.M)
        clean = re.sub(r"\s+", "", clean)
        a["word_count"] = len(clean)

    # 标签统计
    tag_count = {}
    for a in articles:
        for t in a["tags"]:
            tag_count[t] = tag_count.get(t, 0) + 1
    tags_sorted = [{"name": k, "count": v} for k, v in sorted(tag_count.items(), key=lambda x: -x[1])]

    payload = {
        "articles": articles,
        "tags": tags_sorted,
        "total": len(articles),
    }

    js = "/* 由 build_articles.py 自动生成 */\n"
    js += "window.SITE_DATA = " + json.dumps(payload, ensure_ascii=False, indent=2) + ";\n"

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(js)

    print("生成文章数：", len(articles))
    print("标签数：", len(tags_sorted))
    print("输出：", OUT)
    print("分类统计：")
    cat_count = {}
    for a in articles:
        cat_count[a["category"]] = cat_count.get(a["category"], 0) + 1
    for k, v in sorted(cat_count.items(), key=lambda x: -x[1]):
        print("  ", k, v)


if __name__ == "__main__":
    main()
