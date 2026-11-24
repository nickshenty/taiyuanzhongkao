#!/usr/bin/env python3
"""
合并四部分古诗文数据，生成最终的 poetry_data.json
然后作为 CodeAct 脚本提交结果。
"""
import asyncio
import json
import os
import sys
from codeact_sdk import CodeActSDK

# 导入四部分数据
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from poetry_part1 import POEMS_PART1
from poetry_part2 import POEMS_PART2
from poetry_part3 import POEMS_PART3
from poetry_part4 import POEMS_PART4


async def main():
    result_mode = sys.argv[1] if len(sys.argv) > 1 else "display_only"
    print(f"[参数] result_mode={result_mode}")

    sdk = CodeActSDK()

    try:
        # 合并所有部分
        all_poems = {}
        all_poems.update(POEMS_PART1)
        all_poems.update(POEMS_PART2)
        all_poems.update(POEMS_PART3)
        all_poems.update(POEMS_PART4)

        # 按编号排序
        sorted_poems = dict(sorted(all_poems.items(), key=lambda x: int(x[0])))

        # 验证数据完整性
        expected_ids = [str(i) for i in range(1, 33)]
        actual_ids = list(sorted_poems.keys())
        missing = [id for id in expected_ids if id not in actual_ids]

        # 检查每篇的字段完整性
        field_issues = []
        for pid, poem in sorted_poems.items():
            for field in ["title", "author", "dynasty", "original", "translation", "notes", "key_points"]:
                if field not in poem or not poem[field]:
                    field_issues.append(f"#{pid} 缺少字段: {field}")
            if "notes" in poem and isinstance(poem["notes"], list) and len(poem["notes"]) < 5:
                field_issues.append(f"#{pid} 注释不足5个 (当前{len(poem['notes'])}个)")

        # 保存 JSON
        output_path = "./codeact/scripts/poetry_data.json"
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(sorted_poems, f, ensure_ascii=False, indent=2)

        # 统计信息
        total_poems = len(sorted_poems)
        total_original_chars = sum(len(p["original"]) for p in sorted_poems.values())
        total_translation_chars = sum(len(p["translation"]) for p in sorted_poems.values())
        total_notes = sum(len(p["notes"]) for p in sorted_poems.values())

        print(f"\n{'='*60}")
        print(f"[输出] 已保存 {total_poems} 篇古诗文到 {output_path}")
        print(f"[统计] 原文总字数: {total_original_chars}")
        print(f"[统计] 译文总字数: {total_translation_chars}")
        print(f"[统计] 注释总条数: {total_notes}")
        if missing:
            print(f"[缺失] IDs: {missing}")
        if field_issues:
            print(f"[字段问题] {field_issues}")
        print(f"{'='*60}\n")

        # 列出每篇的基本信息
        for pid, poem in sorted_poems.items():
            title = poem["title"]
            author = poem["author"]
            orig_len = len(poem["original"])
            notes_count = len(poem["notes"])
            print(f"  #{pid:>2s} {title:<20s} {author:<6s} 原文{orig_len:>5d}字 注释{notes_count}个")

        # 提交结果
        actual_mode = result_mode if result_mode != "auto" else "display_only"
        abs_path = os.path.abspath(output_path)

        if missing:
            message = (
                f"古诗文数据文件已生成，但缺少 {len(missing)} 篇（ID: {', '.join(missing)}）\n"
                f"文件：[poetry_data.json](computer://{abs_path})"
            )
            await sdk.submit_result(
                result_mode="notify",
                status="error",
                message=message,
                data={"file_path": output_path, "total": total_poems, "missing": missing},
            )
        else:
            message = (
                f"已生成32篇高考必背古诗文数据文件："
                f"[poetry_data.json](computer://{abs_path})\n\n"
                f"数据概览：\n"
                f"• 篇目数：{total_poems}篇（静女→离骚）\n"
                f"• 原文总字数：{total_original_chars:,}字\n"
                f"• 译文总字数：{total_translation_chars:,}字\n"
                f"• 重点注释：{total_notes}条\n"
                f"• 每篇含：原文全文 + 白话翻译 + 重点字词注释 + 背诵要点\n\n"
                f"涵盖诗经、楚辞、汉乐府、唐诗、宋词及经典文言文。"
            )
            await sdk.submit_result(
                result_mode=actual_mode,
                status="success",
                message=message,
                data={
                    "file_path": output_path,
                    "total": total_poems,
                    "total_original_chars": total_original_chars,
                    "total_notes": total_notes,
                },
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
