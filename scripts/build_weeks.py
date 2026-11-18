"""Build site/data/weeks.json from 52-week-plan.csv and 52-skills-list.csv.

Run from anywhere:  python3 scripts/build_weeks.py
Safe to re-run: videoId, journal and completedOn you've filled in are kept.

Sunday update: open site/data/weeks.json, find the week, fill in
  "videoId": the YouTube ID (the part after watch?v=)
  "journal": your write-up (blank line between paragraphs)
  "completedOn": "YYYY-MM-DD"
"""
import csv
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLAN = os.path.join(ROOT, "52-week-plan.csv")
SKILLS = os.path.join(ROOT, "52-skills-list.csv")
OUT = os.path.join(ROOT, "site", "data", "weeks.json")
KEEP = ("videoId", "journal", "completedOn")


def main():
    with open(SKILLS, newline="", encoding="utf-8") as f:
        category = {r["Skill"].strip(): r["Category"].strip() for r in csv.DictReader(f)}

    old = {}
    if os.path.exists(OUT):
        with open(OUT, encoding="utf-8") as f:
            for w in json.load(f).get("weeks", []):
                old[w["week"]] = w

    weeks, habits = [], []
    with open(PLAN, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            skill = r["Skill"].strip()
            item = {
                "skill": skill,
                "category": category.get(skill, ""),
                "doneWhen": r["Done when"].strip(),
                "plan": [line.strip() for line in r["Plan"].splitlines() if line.strip()],
                "resources": r["Resources"].strip(),
                "cost": r["Cost"].strip(),
            }
            if r["Week"].strip() == "BG":
                habits.append(item)
                continue
            n = int(r["Week"])
            prev = old.get(n, {})
            weeks.append({"week": n, "starts": r["Starts"].strip(), **item,
                          **{k: prev.get(k, "") for k in KEEP}})

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"weeks": weeks, "habits": habits}, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"wrote {len(weeks)} weeks and {len(habits)} habits to {OUT}")


if __name__ == "__main__":
    main()
