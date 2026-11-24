"""
高考必背古诗文数据文件生成器
为32篇高考必背古诗文收集全文+翻译+注释+背诵要点，输出JSON。
两阶段并发：Phase1 搜索+抓取(Semaphore 5) → Phase2 LLM提取(Semaphore 3)
"""
import asyncio
import json
import os
import sys
from codeact_sdk import CodeActSDK
from pydantic import BaseModel, Field

# ── Schema Versions ──
TOOL_SCHEMA_VERSIONS = {
    "codeact_search_web": "v1_5ac1b0eba8c26f2a",
    "codeact_fetch_web": "v1_2c8d0580b3f93a58",
}

# ── Pydantic Models ──
class PoemNote(BaseModel):
    word: str
    meaning: str

class PoemExtraction(BaseModel):
    original: str = Field(description="古诗文的原文全文，必须完整，不省略任何段落")
    translation: str = Field(description="白话译文，必须完整通顺，与原文对应")
    notes: list[PoemNote] = Field(description="重点字词注释，至少5-8个关键字词")
    key_points: str = Field(description="背诵要点提示：易错字、通假字、重点句、文学常识等")

# ── 32篇古诗文信息 ──
POEMS_INFO = [
    {"id": "1",  "title": "静女",              "author": "佚名",   "dynasty": "先秦", "query": "静女 诗经 邶风 原文 翻译 注释"},
    {"id": "2",  "title": "无衣",              "author": "佚名",   "dynasty": "先秦", "query": "无衣 诗经 秦风 原文 翻译 注释"},
    {"id": "3",  "title": "涉江采芙蓉",        "author": "佚名",   "dynasty": "汉代", "query": "涉江采芙蓉 古诗十九首 原文 翻译 注释"},
    {"id": "4",  "title": "山居秋暝",          "author": "王维",   "dynasty": "唐",   "query": "山居秋暝 王维 原文 翻译 注释"},
    {"id": "5",  "title": "登高",              "author": "杜甫",   "dynasty": "唐",   "query": "登高 杜甫 原文 翻译 注释"},
    {"id": "6",  "title": "客至",              "author": "杜甫",   "dynasty": "唐",   "query": "客至 杜甫 原文 翻译 注释"},
    {"id": "7",  "title": "蜀相",              "author": "杜甫",   "dynasty": "唐",   "query": "蜀相 杜甫 原文 翻译 注释"},
    {"id": "8",  "title": "登岳阳楼",          "author": "杜甫",   "dynasty": "唐",   "query": "登岳阳楼 杜甫 原文 翻译 注释"},
    {"id": "9",  "title": "书愤",              "author": "陆游",   "dynasty": "宋",   "query": "书愤 陆游 原文 翻译 注释"},
    {"id": "10", "title": "虞美人·春花秋月何时了", "author": "李煜",   "dynasty": "五代", "query": "虞美人 春花秋月何时了 李煜 原文 翻译 注释"},
    {"id": "11", "title": "鹊桥仙·纤云弄巧",   "author": "秦观",   "dynasty": "宋",   "query": "鹊桥仙 纤云弄巧 秦观 原文 翻译 注释"},
    {"id": "12", "title": "青玉案·元夕",       "author": "辛弃疾", "dynasty": "宋",   "query": "青玉案 元夕 辛弃疾 原文 翻译 注释"},
    {"id": "13", "title": "短歌行",            "author": "曹操",   "dynasty": "东汉", "query": "短歌行 曹操 原文 翻译 注释"},
    {"id": "14", "title": "归园田居·其一",     "author": "陶渊明", "dynasty": "东晋", "query": "归园田居 其一 陶渊明 原文 翻译 注释"},
    {"id": "15", "title": "锦瑟",              "author": "李商隐", "dynasty": "唐",   "query": "锦瑟 李商隐 原文 翻译 注释"},
    {"id": "16", "title": "声声慢·寻寻觅觅",   "author": "李清照", "dynasty": "宋",   "query": "声声慢 寻寻觅觅 李清照 原文 翻译 注释"},
    {"id": "17", "title": "念奴娇·赤壁怀古",   "author": "苏轼",   "dynasty": "宋",   "query": "念奴娇 赤壁怀古 苏轼 原文 翻译 注释"},
    {"id": "18", "title": "永遇乐·京口北固亭怀古", "author": "辛弃疾", "dynasty": "宋", "query": "永遇乐 京口北固亭怀古 辛弃疾 原文 翻译 注释"},
    {"id": "19", "title": "望海潮·东南形胜",   "author": "柳永",   "dynasty": "宋",   "query": "望海潮 东南形胜 柳永 原文 翻译 注释"},
    {"id": "20", "title": "扬州慢·淮左名都",   "author": "姜夔",   "dynasty": "宋",   "query": "扬州慢 淮左名都 姜夔 原文 翻译 注释"},
    {"id": "21", "title": "春江花月夜",        "author": "张若虚", "dynasty": "唐",   "query": "春江花月夜 张若虚 原文 全文 翻译 注释"},
    {"id": "22", "title": "琵琶行",            "author": "白居易", "dynasty": "唐",   "query": "琵琶行 白居易 原文 全文 翻译 注释"},
    {"id": "23", "title": "将进酒",            "author": "李白",   "dynasty": "唐",   "query": "将进酒 李白 原文 翻译 注释"},
    {"id": "24", "title": "蜀道难",            "author": "李白",   "dynasty": "唐",   "query": "蜀道难 李白 原文 全文 翻译 注释"},
    {"id": "25", "title": "劝学",              "author": "荀子",   "dynasty": "先秦", "query": "劝学 荀子 原文 全文 翻译 注释"},
    {"id": "26", "title": "师说",              "author": "韩愈",   "dynasty": "唐",   "query": "师说 韩愈 原文 全文 翻译 注释"},
    {"id": "27", "title": "六国论",            "author": "苏洵",   "dynasty": "宋",   "query": "六国论 苏洵 原文 全文 翻译 注释"},
    {"id": "28", "title": "赤壁赋",            "author": "苏轼",   "dynasty": "宋",   "query": "前赤壁赋 苏轼 原文 全文 翻译 注释"},
    {"id": "29", "title": "项脊轩志",          "author": "归有光", "dynasty": "明",   "query": "项脊轩志 归有光 原文 全文 翻译 注释"},
    {"id": "30", "title": "过秦论",            "author": "贾谊",   "dynasty": "西汉", "query": "过秦论 贾谊 上篇 原文 全文 翻译 注释"},
    {"id": "31", "title": "陈情表",            "author": "李密",   "dynasty": "西晋", "query": "陈情表 李密 原文 全文 翻译 注释"},
    {"id": "32", "title": "离骚",              "author": "屈原",   "dynasty": "先秦", "query": "离骚 屈原 高中课文 原文 翻译 注释"},
]

# 优先选择的域名（古诗文权威网站）
PREFERRED_DOMAINS = ["gushiwen", "gushici", "shici", "meirishici", "so.gushiwen"]


# ── Phase 1: 搜索 + 抓取 ──
async def search_and_fetch(sdk: CodeActSDK, poem: dict, sem: asyncio.Semaphore) -> tuple[str, str]:
    """搜索古诗文并抓取网页内容，返回 (poem_id, content)。"""
    async with sem:
        title = poem["title"]
        pid = poem["id"]
        print(f"  [S1] 搜索: {title}")
        try:
            search_result = await sdk.call_tool(
                "codeact_search_web",
                {"query": poem["query"], "response_length": "long"},
                schema_version=TOOL_SCHEMA_VERSIONS["codeact_search_web"],
            )

            # 从搜索结果中找到最佳 URL
            best_url = None
            results = search_result.get("results", [])
            for r in results:
                url = r.get("url", "")
                if any(d in url for d in PREFERRED_DOMAINS):
                    best_url = url
                    break
            if not best_url and results:
                best_url = results[0].get("url")

            # 抓取网页
            content = ""
            if best_url:
                print(f"  [F1] 抓取: {title} -> {best_url[:80]}")
                fetch_result = await sdk.call_tool(
                    "codeact_fetch_web",
                    {"url": best_url},
                    schema_version=TOOL_SCHEMA_VERSIONS["codeact_fetch_web"],
                )
                if fetch_result.get("is_success"):
                    content = fetch_result.get("content", "")
                    print(f"  [F1✓] {title}: {len(content)} 字符")
                else:
                    print(f"  [F1✗] {title}: 抓取失败 - {fetch_result.get('error', '?')}")

            # 兜底：使用搜索摘要
            if not content:
                content = search_result.get("content", "")
                if content:
                    print(f"  [FB] {title}: 使用搜索摘要 ({len(content)} 字符)")

            return pid, content

        except Exception as e:
            print(f"  [S1✗] {title}: {e}")
            return pid, ""


# ── Phase 2: LLM 提取 ──
async def llm_extract(sdk: CodeActSDK, poem: dict, content: str, sem: asyncio.Semaphore) -> tuple[str, dict | None]:
    """用 LLM 从网页内容中提取结构化古诗文数据。"""
    async with sem:
        title = poem["title"]
        pid = poem["id"]
        if not content or len(content) < 50:
            print(f"  [S2✗] {title}: 无有效内容")
            return pid, None

        try:
            # 控制输入长度（长诗文需要更多空间）
            max_content = 20000
            truncated = content[:max_content] if len(content) > max_content else content

            prompt = f"""请从以下网页内容中提取古诗文《{title}》的完整信息。

已知信息：
- 篇名：{title}
- 作者：{poem['author']}
- 朝代：{poem['dynasty']}

网页内容：
{truncated}

请提取并返回以下信息：
1. original: 原文全文（必须完整，包含所有段落和句子，长篇诗文不能省略任何段落）
2. translation: 白话译文（必须完整通顺，与原文一一对应）
3. notes: 重点字词注释（至少5-8个关键字词，包括通假字、古今异义、词类活用等，每个注释含word和meaning）
4. key_points: 背诵要点提示（易错字、通假字、重点名句、文学常识等）

重要要求：
- 原文必须完整准确，不能有遗漏或省略
- 翻译要通顺易懂，覆盖全文
- 注释要覆盖关键字词
- 背诵要点要具体实用，帮助学生记忆
"""

            messages = [
                {"role": "system", "content": "你是古诗文专家，擅长提取和整理古诗文数据。请确保原文和翻译完整准确，不省略任何内容。"},
                {"role": "user", "content": prompt},
            ]

            response = await sdk.call_llm(messages, response_format=PoemExtraction)

            # 验证提取结果
            if not response.original or len(response.original) < 10:
                print(f"  [S2✗] {title}: 原文过短或为空")
                return pid, None
            if not response.translation:
                print(f"  [S2✗] {title}: 翻译为空")
                return pid, None
            if not response.notes or len(response.notes) < 3:
                print(f"  [S2⚠] {title}: 注释不足 ({len(response.notes) if response.notes else 0} 个)")

            result = {
                "title": poem["title"],
                "author": poem["author"],
                "dynasty": poem["dynasty"],
                "original": response.original.strip(),
                "translation": response.translation.strip(),
                "notes": [{"word": n.word, "meaning": n.meaning} for n in response.notes],
                "key_points": response.key_points.strip(),
            }

            print(f"  [S2✓] {title}: 原文{len(result['original'])}字, 翻译{len(result['translation'])}字, 注释{len(result['notes'])}个")
            return pid, result

        except Exception as e:
            print(f"  [S2✗] {title}: {e}")
            return pid, None


# ── 主流程 ──
async def main():
    result_mode = sys.argv[1] if len(sys.argv) > 1 else "display_only"
    print(f"[参数] result_mode={result_mode}")
    print(f"[任务] 收集 {len(POEMS_INFO)} 篇古诗文数据\n")

    sdk = CodeActSDK()

    try:
        # ── Phase 1: 并发搜索+抓取 ──
        print("=" * 60)
        print("Phase 1: 搜索 + 抓取 (并发=5)")
        print("=" * 60)
        tool_sem = asyncio.Semaphore(5)
        fetch_tasks = [search_and_fetch(sdk, p, tool_sem) for p in POEMS_INFO]
        fetch_results = await asyncio.gather(*fetch_tasks, return_exceptions=True)

        # 收集内容
        contents = {}
        for item in fetch_results:
            if isinstance(item, Exception):
                print(f"  [Phase1 异常] {item}")
                continue
            pid, content = item
            contents[pid] = content

        has_content = sum(1 for c in contents.values() if c)
        print(f"\n[Phase 1 完成] {has_content}/{len(POEMS_INFO)} 篇有内容\n")

        # ── Phase 2: 并发 LLM 提取 ──
        print("=" * 60)
        print("Phase 2: LLM 提取 (并发=3)")
        print("=" * 60)
        llm_sem = asyncio.Semaphore(3)
        extract_tasks = [
            llm_extract(sdk, p, contents.get(p["id"], ""), llm_sem)
            for p in POEMS_INFO
        ]
        extract_results = await asyncio.gather(*extract_tasks, return_exceptions=True)

        # 构建 JSON
        data = {}
        failed = []
        for item in extract_results:
            if isinstance(item, Exception):
                print(f"  [Phase2 异常] {item}")
                continue
            pid, poem_data = item
            if poem_data:
                data[pid] = poem_data
            else:
                failed.append(pid)

        # 保存 JSON
        output_path = "./codeact/scripts/poetry_data.json"
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        print(f"\n{'=' * 60}")
        print(f"[输出] 已保存 {len(data)}/{len(POEMS_INFO)} 篇到 {output_path}")
        if failed:
            print(f"[失败] ID: {', '.join(failed)}")
        print(f"{'=' * 60}\n")

        # 提交结果
        actual_mode = result_mode if result_mode != "auto" else "display_only"
        abs_path = os.path.abspath(output_path)

        if failed:
            failed_titles = [p["title"] for p in POEMS_INFO if p["id"] in failed]
            message = (
                f"古诗文数据文件已生成，成功 {len(data)}/32 篇，"
                f"失败 {len(failed)} 篇：{', '.join(failed_titles)}\n"
                f"文件：[poetry_data.json](computer://{abs_path})"
            )
            await sdk.submit_result(
                result_mode="notify",
                status="success",
                message=message,
                data={"file_path": output_path, "total": len(data), "failed_ids": failed},
            )
        else:
            # 统计信息
            total_original = sum(len(d["original"]) for d in data.values())
            total_notes = sum(len(d["notes"]) for d in data.values())
            message = (
                f"已生成32篇高考必背古诗文数据文件："
                f"[poetry_data.json](computer://{abs_path})\n\n"
                f"包含内容：\n"
                f"• 32篇古诗文原文全文（共{total_original}字）\n"
                f"• 每篇白话翻译\n"
                f"• 重点字词注释（共{total_notes}条）\n"
                f"• 背诵要点提示"
            )
            await sdk.submit_result(
                result_mode=actual_mode,
                status="success",
                message=message,
                data={"file_path": output_path, "total": len(data)},
            )

    except Exception as e:
        import traceback
        print(f"[FATAL] {e}")
        traceback.print_exc()
        await sdk.submit_result(
            result_mode="notify",
            status="error",
            message=f"执行失败: {e}",
            data={"error_type": type(e).__name__},
        )


if __name__ == "__main__":
    asyncio.run(main())
