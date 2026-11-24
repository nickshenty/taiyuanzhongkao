import csv
import json
from pathlib import Path

import pdfplumber


PDFS = {
    "admission_plan": Path("/Users/shenzheng/Documents/家庭文档/申奇峰/2025年普通高中学校招生计划.pdf"),
    "quota_plan": Path("/Users/shenzheng/Documents/家庭文档/申奇峰/奇奇学习/2025年普通高中定向招生计划.pdf"),
    "quota_allocations": Path("/Users/shenzheng/Documents/家庭文档/申奇峰/奇奇学习/附件：太原市2025年优质普通高中招生指标到校分配表.pdf"),
}

OUT_DIR = Path("data/extracted/2025")


def clean_cell(value):
    if value is None:
        return ""
    return " ".join(str(value).replace("\n", " ").split())


def extract_pdf(name, path):
    pdf_dir = OUT_DIR / name
    pdf_dir.mkdir(parents=True, exist_ok=True)
    manifest = []

    with pdfplumber.open(path) as pdf:
        for index, page in enumerate(pdf.pages, start=1):
            text = page.extract_text(x_tolerance=1, y_tolerance=3) or ""
            text_path = pdf_dir / f"page-{index:02d}.txt"
            text_path.write_text(text, encoding="utf-8")

            tables = page.extract_tables()
            manifest.append({
                "page": index,
                "text_chars": len(text),
                "tables": len(tables),
            })

            for table_index, table in enumerate(tables, start=1):
                csv_path = pdf_dir / f"page-{index:02d}-table-{table_index:02d}.csv"
                with csv_path.open("w", encoding="utf-8", newline="") as handle:
                    writer = csv.writer(handle)
                    for row in table:
                        writer.writerow([clean_cell(cell) for cell in row])

    return manifest


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for name, path in PDFS.items():
      manifest[name] = extract_pdf(name, path)
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
