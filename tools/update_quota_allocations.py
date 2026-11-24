import csv
import re
from pathlib import Path


DATA_FILE = Path("data/years/2025.js")
CSV_DIR = Path("data/extracted/2025/quota_allocations")
QUOTA_CODES = [
    "65903",
    "66903",
    "65905",
    "66905",
    "65906",
    "65912",
    "66912",
    "65915",
    "65918",
    "66918",
    "65926",
    "65948",
    "65904",
    "65925",
    "65910",
    "65901",
    "66901",
    "65928",
    "65914",
    "65936",
    "65934",
]


def js_string(value):
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def read_rows():
    rows = []
    seen = set()
    for path in sorted(CSV_DIR.glob("page-*-table-01.csv")):
        with path.open(encoding="utf-8", newline="") as handle:
            reader = csv.reader(handle)
            next(reader, None)
            for row in reader:
                if len(row) < 24:
                    continue
                serial = row[0].strip()
                if not serial.isdigit():
                    continue
                name = row[1].strip()
                if not name or name in seen:
                    continue
                seen.add(name)
                quota_total = int(row[2].strip() or "0")
                values = row[3:3 + len(QUOTA_CODES)]
                allocations = {}
                for code, value in zip(QUOTA_CODES, values):
                    value = value.strip()
                    if value:
                        allocations[code] = int(value)
                rows.append({
                    "serial": int(serial),
                    "id": f"junior_{int(serial):03d}",
                    "name": name,
                    "quotaTotal": quota_total,
                    "allocations": allocations,
                })
    return rows


def build_block(rows):
    lines = []
    lines.append("  quotaSchoolCodes: [")
    for code in QUOTA_CODES:
        lines.append(f"    {js_string(code)},")
    lines[-1] = lines[-1].rstrip(",")
    lines.append("  ],")
    lines.append("  juniorSchools: [")
    for row in rows:
        lines.append(
            f"    {{ id: {js_string(row['id'])}, name: {js_string(row['name'])}, quotaTotal: {row['quotaTotal']} }},"
        )
    lines[-1] = lines[-1].rstrip(",")
    lines.append("  ],")
    lines.append("  quotaAllocations: {")
    for row in rows:
        pairs = ", ".join(f"{js_string(code)}: {value}" for code, value in row["allocations"].items())
        lines.append(f"    {row['id']}: {{ {pairs} }},")
    lines[-1] = lines[-1].rstrip(",")
    lines.append("  },")
    return "\n".join(lines)


def main():
    rows = read_rows()
    source = DATA_FILE.read_text(encoding="utf-8")
    replacement = build_block(rows)
    updated = re.sub(
        r"  quotaSchoolCodes: \[[\s\S]*?\n  schools: \[",
        replacement + "\n  schools: [",
        source,
        count=1,
    )
    if updated == source:
        raise RuntimeError("Failed to replace quota allocation block")
    DATA_FILE.write_text(updated, encoding="utf-8")
    print(f"Updated {len(rows)} junior schools")


if __name__ == "__main__":
    main()
