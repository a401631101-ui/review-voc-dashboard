#!/usr/bin/env python3
"""Build dashboard data from the 评论 sheet in the source workbook.

Usage:
  python scripts/build_dashboard_data.py 评论.xlsx data
"""
import json
import re
import sys
from collections import Counter
from pathlib import Path

import pandas as pd

THEMES = {
    "质量做工": ["质量", "做工", "材质", "厚实", "结实", "耐用", "不锈钢", "铜", "阀芯", "毛刺", "破损", "坏", "裂", "漏水"],
    "颜色外观": ["颜色", "色差", "外观", "颜值", "质感", "好看", "漂亮", "发黄", "掉色", "褪色", "光泽"],
    "效果性能": ["效果", "性能", "防水", "防臭", "排水", "粘", "牢", "覆盖", "遮盖", "耐磨", "防风", "隔音", "漏风", "起皮", "脱落", "起泡"],
    "安装施工": ["安装", "施工", "师傅", "打孔", "免打孔", "刷", "滚", "配比", "基层", "尺寸", "开孔", "不好装"],
    "气味环保": ["气味", "味道", "刺鼻", "环保", "甲醛", "净味", "无味", "入住", "有味"],
    "客服售后": ["客服", "售后", "服务", "退货", "退款", "补发", "赔偿", "处理", "推脱", "态度"],
    "物流包装": ["物流", "快递", "包装", "运输", "漏液", "破损", "少发", "漏发", "发货", "到货"],
}
CATEGORY_THEMES = {
    "地漏": ["质量做工", "颜色外观", "效果性能", "安装施工"], "艺术漆": ["效果性能", "颜色外观", "气味环保", "安装施工"],
    "水槽套餐": ["质量做工", "颜色外观", "安装施工", "客服售后"], "内墙乳胶漆": ["气味环保", "客服售后", "颜色外观", "效果性能"],
    "环氧漆(地坪漆)": ["效果性能", "安装施工", "客服售后", "质量做工"], "密封条": ["效果性能", "质量做工", "安装施工", "物流包装"],
    "外墙乳胶漆": ["颜色外观", "效果性能", "物流包装", "质量做工"], "瓷砖胶": ["质量做工", "物流包装", "效果性能", "客服售后"],
    "腻子": ["效果性能", "物流包装", "质量做工", "气味环保"], "毛巾架": ["质量做工", "颜色外观", "安装施工", "客服售后"],
    "角阀": ["质量做工", "颜色外观", "安装施工", "效果性能"], "金属漆": ["物流包装", "质量做工", "效果性能", "颜色外观"],
}
POSITIVE = ["满意", "不错", "很好", "好用", "漂亮", "好看", "质感", "结实", "厚实", "方便", "顺滑", "牢固", "没味", "无味", "低味", "值得", "推荐", "专业", "及时", "耐用", "省心", "效果好"]
NEGATIVE = ["差", "失望", "不好", "难用", "破损", "漏", "掉色", "色差", "起皮", "脱落", "起泡", "发黄", "刺鼻", "难闻", "少发", "漏发", "退货", "退款", "投诉", "推脱", "不理", "不符", "坏", "裂", "溢", "返味", "关不上", "不够", "误导", "麻烦"]
PEOPLE = {"装修业主": ["装修", "新房", "家装"], "DIY用户": ["自己动手", "自己刷", "自己装", "DIY", "新手"], "施工师傅": ["师傅", "工人", "瓦工", "油工"], "儿童/老人家庭": ["儿童", "孩子", "宝宝", "老人"], "租住用户": ["租房", "出租房", "房东"], "工程用户": ["工程", "车间", "工厂", "仓库"]}
SCENES = {"卫生间": ["卫生间", "浴室", "淋浴"], "厨房": ["厨房", "水槽", "洗碗机"], "阳台": ["阳台", "洗衣机"], "墙面翻新": ["旧墙", "墙面", "补墙", "翻新"], "地面施工": ["地面", "车库", "水泥地", "地坪"], "门窗改善": ["门窗", "门缝", "窗户", "漏风"], "户外环境": ["外墙", "围墙", "户外", "天井"], "金属翻新": ["暖气", "铁门", "铁艺", "彩钢瓦"]}
PURPOSES = {"改色美化": ["改色", "颜色", "美化", "好看", "漂亮"], "防水防漏": ["防水", "漏水", "防漏"], "防臭排水": ["防臭", "返味", "排水"], "牢固耐用": ["牢固", "耐用", "结实", "粘性"], "低味环保": ["环保", "无味", "低味", "甲醛"], "修补翻新": ["修补", "翻新", "补墙", "遮盖"], "安装省事": ["安装方便", "免打孔", "自己装", "省事"], "收纳省空间": ["收纳", "折叠", "省空间"]}
KEYWORDS = {"质量": ["质量"], "做工": ["做工", "毛刺"], "颜色": ["颜色", "色差", "掉色"], "效果": ["效果", "好用"], "安装": ["安装", "施工"], "客服": ["客服", "售后"], "物流": ["物流", "快递"], "包装": ["包装", "破损", "漏液"], "气味": ["气味", "味道", "刺鼻"], "环保": ["环保", "甲醛", "净味"], "材质": ["材质", "不锈钢", "黄铜", "全铜"], "尺寸适配": ["尺寸", "开孔", "适配", "太厚", "太薄"], "耐用": ["耐用", "结实", "牢固"], "防水": ["防水"], "防臭排水": ["防臭", "返味", "排水"], "遮盖力": ["遮盖", "覆盖"], "用量": ["用量", "不够", "面积"], "工具配套": ["工具", "刷子", "手套"], "性价比": ["性价比", "划算", "价格"], "品牌信任": ["品牌", "旗舰店", "正品"]}

def usable(value):
    text = str(value).strip()
    return bool(text and text.lower() != "nan" and not re.fullmatch(r"[\W_\d]+", text) and len(re.sub(r"\s+", "", text)) >= 4)

def rates(rows, mapping, limit):
    result, n = [], len(rows)
    for label, terms in mapping.items():
        count = int(rows["text"].map(lambda text: any(term in text for term in terms)).sum())
        if count:
            result.append([label, count, round(count * 100 / n, 1)])
    return sorted(result, key=lambda item: (-item[1], item[0]))[:limit]

def theme_detail(theme, rows):
    words = THEMES[theme]
    matched = rows[rows["text"].map(lambda text: any(word in text for word in words))].copy()
    count, total = len(matched), len(rows)
    rate = round(count * 100 / total, 1) if total else 0
    if not count:
        return {"count": 0, "rate": 0, "summary": "当前筛选范围内未检出足够的明确主题表达。", "quotes": []}
    positive = Counter(word for text in matched["text"] for word in POSITIVE if word in text)
    negative = Counter(word for text in matched["text"] for word in NEGATIVE if word in text)
    positive_text = "、".join(word for word, _ in positive.most_common(3)) or "功能达到预期"
    negative_text = "、".join(word for word, _ in negative.most_common(3)) or "风险表达较分散"
    confidence = "可优先跟踪" if count >= 100 else "方向性信号" if count >= 30 else "探索性信号"
    summary = f"命中{count}条去重评论，占当前筛选评论{rate}%，属于{confidence}。认可集中在“{positive_text}”，风险集中在“{negative_text}”；提及率不等于满意度。"
    candidates = matched[(matched["text"].str.len() >= 12) & (matched["text"].str.len() <= 220)].copy()
    if candidates.empty:
        candidates = matched.copy()
    candidates["rank"] = candidates.apply(lambda row: sum(row["text"].count(word) for word in words) * 3 + sum(word in row["text"] for word in POSITIVE + NEGATIVE) + min(float(row["helpful"]), 10) / 10, axis=1)
    quotes = []
    for _, row in candidates.sort_values("rank", ascending=False).head(2).iterrows():
        text = row["text"] if len(row["text"]) <= 180 else row["text"][:177] + "…"
        quotes.append({"text": text, "shop": row["shop"], "month": row["month"]})
    return {"count": count, "rate": rate, "summary": summary, "quotes": quotes}

def segment(rows, theme_names):
    rows = rows.drop_duplicates("text")
    total = len(rows)
    if not total:
        return None
    positive_count = int(rows["text"].map(lambda text: sum(word in text for word in POSITIVE) > sum(word in text for word in NEGATIVE)).sum())
    risk_count = int(rows["text"].map(lambda text: any(word in text for word in NEGATIVE)).sum())
    positive_rate, risk_rate = round(positive_count * 100 / total, 1), round(risk_count * 100 / total, 1)
    flags = {theme: rows["text"].map(lambda text, words=THEMES[theme]: any(word in text for word in words)) for theme in theme_names}
    co = []
    for index, first in enumerate(theme_names):
        for second in theme_names[index + 1:]:
            count = int((flags[first] & flags[second]).sum())
            if count:
                co.append([f"{first} × {second}", count, round(count * 100 / total, 1)])
    positive_terms = Counter(word for text in rows["text"] for word in POSITIVE if word in text).most_common(4)
    negative_terms = Counter(word for text in rows["text"] for word in NEGATIVE if word in text).most_common(4)
    return {"n": total, "score": round(max(1, min(5, 3 + .02 * (positive_rate - risk_rate))), 1), "positiveRate": positive_rate, "riskRate": risk_rate,
            "confidence": "稳定" if total >= 100 else "方向性" if total >= 30 else "探索性", "themes": {theme: theme_detail(theme, rows) for theme in theme_names},
            "people": rates(rows, PEOPLE, 3), "scenes": rates(rows, SCENES, 3), "purposes": rates(rows, PURPOSES, 4), "keywords": rates(rows, KEYWORDS, 8),
            "co": sorted(co, key=lambda item: -item[1])[:3], "positiveTerms": [[word, count] for word, count in positive_terms], "negativeTerms": [[word, count] for word, count in negative_terms]}

def build(source, output):
    raw = pd.read_excel(source, sheet_name="评论")
    required = {"店铺", "品类", "初评时间", "初评", "有用"}
    missing = required.difference(raw.columns)
    if missing:
        raise ValueError(f"missing columns: {sorted(missing)}")
    raw = raw[raw["初评"].map(usable)].copy()
    raw["text"] = raw["初评"].astype(str).str.strip(); raw["shop"] = raw["店铺"].astype(str).str.strip(); raw["category"] = raw["品类"].astype(str).str.strip()
    raw["month"] = pd.to_datetime(raw["初评时间"]).map(lambda value: f"{value.year}年{value.month}月"); raw["helpful"] = pd.to_numeric(raw["有用"], errors="coerce").fillna(0)
    months = sorted(raw["month"].unique(), key=lambda label: tuple(map(int, re.findall(r"\d+", label))))
    result = {"months": months, "categories": {}}
    for category, theme_names in CATEGORY_THEMES.items():
        category_rows = raw[raw["category"] == category]
        shops = category_rows["shop"].value_counts().index.tolist(); segments = {}
        for month in ["全部时间"] + months:
            month_rows = category_rows if month == "全部时间" else category_rows[category_rows["month"] == month]
            for shop in ["全部店铺"] + shops:
                rows = month_rows if shop == "全部店铺" else month_rows[month_rows["shop"] == shop]
                if not rows.empty:
                    segments[f"{month}|{shop}"] = segment(rows, theme_names)
        result["categories"][category] = {"shops": shops, "segments": segments}
    target = Path(output)
    if target.suffix == ".js":
        target.write_text("window.REVIEW_FILTER_DATA=" + json.dumps(result, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
        return
    category_dir = target / "categories"
    category_dir.mkdir(parents=True, exist_ok=True)
    files = {}
    for index, (name, payload) in enumerate(result["categories"].items()):
        filename = f"category-{index:02d}.json"
        (category_dir / filename).write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        files[name] = f"categories/{filename}"
    manifest = {"months": result["months"], "categories": files}
    (target / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: build_dashboard_data.py SOURCE.xlsx OUTPUT.js")
    build(sys.argv[1], sys.argv[2])
