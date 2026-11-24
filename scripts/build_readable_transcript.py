import json
import re
import sys
from pathlib import Path


def timestamp(seconds: float) -> str:
    total = max(0, int(seconds))
    hours, remainder = divmod(total, 3600)
    minutes, secs = divmod(remainder, 60)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}"


def join_phrases(phrases: list[str]) -> str:
    text = ""
    for phrase in phrases:
        phrase = phrase.strip()
        if not phrase:
            continue
        if not text:
            text = phrase
        elif re.match(r"^[，。！？；：、,.!?;:]", phrase):
            text += phrase
        elif re.search(r"[。！？；!?]$", text):
            text += phrase
        else:
            text += "，" + phrase
    if text and not re.search(r"[。！？!?]$", text):
        text += "。"
    return text


def main() -> None:
    source = Path(sys.argv[1])
    target = Path(sys.argv[2])
    data = json.loads(source.read_text(encoding="utf-8"))
    segments = data["segments"]

    blocks: list[tuple[float, float, list[str]]] = []
    start = end = 0.0
    phrases: list[str] = []

    for segment in segments:
        if not phrases:
            start = float(segment["start"])
        end = float(segment["end"])
        phrases.append(segment["text"])
        duration = end - start
        sentence_end = bool(re.search(r"[。！？!?]$", segment["text"].strip()))
        if duration >= 30 and (sentence_end or duration >= 40):
            blocks.append((start, end, phrases))
            phrases = []

    if phrases:
        blocks.append((start, end, phrases))

    lines = [
        "# 362-20260711 音频文字稿",
        "",
        "- 音频时长：约 63 分钟",
        "- 识别语言：中文",
        "- 说明：由语音识别生成，已按时间合并短句；专有名词和同音词可能需要结合原音复核。",
        "",
    ]
    for block_start, block_end, block_phrases in blocks:
        lines.append(f"### {timestamp(block_start)} - {timestamp(block_end)}")
        lines.append("")
        lines.append(join_phrases(block_phrases))
        lines.append("")

    target.write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    main()
