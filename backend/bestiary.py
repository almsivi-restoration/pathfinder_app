"""Local-only, ruleset-scoped bestiary (monster CSV) parsing, indexing, and search.

The bestiary CSV is user-supplied reference material and never ships with the
app. It lives in the same per-ruleset source directory as the reference PDFs
(reference_library/sources/<directory>/) under a fixed filename, and is
imported into a per-ruleset SQLite database alongside the PDF FTS index.

Column handling notes for the "Pathfinder 1e Initiative Screen" export:
- list/structured cells are Python-repr literals (single quotes), parsed with
  ast.literal_eval; malformed cells are recorded as parse warnings, not fatal.
- empty cells mean "no value" (e.g. constructs have no CON) and import as absent.
- known misspelled/legacy columns are folded onto canonical names via
  COLUMN_ALIASES; 3.5-only columns are ignored.
"""

import ast
import csv
import hashlib
import json
import os
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

BESTIARY_FILENAME = "bestiary.csv"

# Known misspelled/duplicated columns folded onto a canonical name. Only
# mappings that are unambiguous belong here; anything else passes through as-is
# so unexpected columns remain visible in the raw record.
COLUMN_ALIASES = {
    "resistances/electricty": "resistances/electricity",
    "resistances/cid": "resistances/acid",
    "skills/Knowledge (naturel)": "skills/Knowledge (nature)",
    "skills/Know. (arcana)": "skills/Knowledge (arcana)",
    "skills/Know. (dungeoneering)": "skills/Knowledge (dungeoneering)",
    "skills/Know. (engineering)": "skills/Knowledge (engineering)",
    "skills/Know. (geography)": "skills/Knowledge (geography)",
    "skills/Know. (history)": "skills/Knowledge (history)",
    "skills/Know. (local)": "skills/Knowledge (local)",
    "skills/Know. (nature)": "skills/Knowledge (nature)",
    "skills/Know. (nobility)": "skills/Knowledge (nobility)",
    "skills/Know. (planes)": "skills/Knowledge (planes)",
    "skills/Know. (religion)": "skills/Knowledge (religion)",
    "skills/Intimidation": "skills/Intimidate",
}

# 3.5-legacy columns ignored on import (the CSV is a mixed 1e/3.5 dump).
IGNORED_PREFIXES = ("ecology/advancement_3.5", "grapple_3.5", "asterisk/")
IGNORED_COLUMNS = {"is_3.5", "second_statblock", "title1"}

SKILL_NAME_RE = re.compile(r"^skills/(.+)$")


def _parse_number(value: str) -> Optional[Any]:
    """Parse a CSV cell as int or float; returns None for blank/non-numeric."""
    value = (value or "").strip()
    if not value:
        return None
    try:
        return int(value)
    except ValueError:
        pass
    try:
        return float(value)
    except ValueError:
        return None


def _parse_literal(value: str, warnings: List[str], context: str) -> Any:
    """Parse a Python-repr cell; on failure record a warning and keep raw text."""
    value = (value or "").strip()
    if not value:
        return None
    if value[0] not in "[{(":
        return value
    try:
        return ast.literal_eval(value)
    except (ValueError, SyntaxError) as error:
        warnings.append(f"{context}: unparsable literal kept as text ({error.msg if hasattr(error, 'msg') else error})")
        return value


# Columns whose values already pass through _parse_literal during record
# construction; the suspicious-literal scan skips them to avoid double warnings.
_LITERAL_PARSED_PREFIXES = (
    "attacks/", "speeds/", "senses/", "resistances/",
)
_LITERAL_PARSED_COLUMNS = {
    "feats", "special_abilities", "special_qualities",
    "spell_like_abilities/entries", "spells/entries",
}


def _scan_suspicious_literals(row: Dict[str, str], warnings: List[str], context: str) -> None:
    """Warn on any repr-looking cell that fails to parse, even in plain-text columns.

    Truncated upstream exports (e.g. "(+4 armor, +4 Dex,") otherwise pass
    silently through columns that are copied verbatim.
    """
    for column, value in row.items():
        if column in _LITERAL_PARSED_COLUMNS or column.startswith(_LITERAL_PARSED_PREFIXES):
            continue
        value = (value or "").strip()
        if len(value) > 1 and value[0] in "[{(":
            try:
                ast.literal_eval(value)
            except (ValueError, SyntaxError):
                warnings.append(f"{context} {column}: repr-looking value does not parse")


def _flatten_group(prefix: str, row: Dict[str, str], warnings: List[str]) -> Dict[str, Any]:
    """Collect `prefix/sub` columns into a dict, skipping blanks and ignored columns."""
    group: Dict[str, Any] = {}
    for column, value in row.items():
        if not column.startswith(prefix + "/"):
            continue
        if value is None or str(value).strip() == "":
            continue
        key = column[len(prefix) + 1:]
        value = str(value).strip()
        group[key] = _parse_literal(value, warnings, f"{column}") if value[0] in "[{(" else (_parse_number(value) if _parse_number(value) is not None else value)
    return group


def _collect_numbered(row: Dict[str, str], stem: str, count: int) -> List[str]:
    """Collect numbered columns like auras_1/name..auras_5/name style stems."""
    collected: List[str] = []
    for index in range(1, count + 1):
        value = row.get(f"{stem}_{index}")
        if value and str(value).strip():
            collected.append(str(value).strip())
    return collected


def parse_bestiary_row(row: Dict[str, str], row_number: int) -> Tuple[Optional[Dict[str, Any]], List[str]]:
    """Normalize one CSV row into a monster record.

    Returns (record, warnings); record is None when the row is unusable
    (missing a name). Warnings describe non-fatal data problems.
    """
    warnings: List[str] = []
    canonical: Dict[str, str] = {}
    for column, value in row.items():
        if column in IGNORED_COLUMNS or any(column.startswith(p) for p in IGNORED_PREFIXES):
            continue
        canonical.setdefault(COLUMN_ALIASES.get(column, column), value or "")

    name = canonical.get("Monster", "").strip()
    if not name:
        return None, [f"row {row_number}: missing Monster name; skipped"]

    context = f"row {row_number} ({name})"
    _scan_suspicious_literals(row, warnings, context)

    def literal(column: str) -> Any:
        return _parse_literal(canonical.get(column, ""), warnings, f"{context} {column}")

    # Attacks: melee_1..5 and ranged_1..3 are repr lists of attack dicts.
    attacks: List[Dict[str, Any]] = []
    for column in [f"attacks/melee_{i}" for i in range(1, 6)] + [f"attacks/ranged_{i}" for i in range(1, 4)]:
        parsed = literal(column)
        if isinstance(parsed, list):
            category = "melee" if "melee" in column else "ranged"
            for attack in parsed:
                if isinstance(attack, dict):
                    attacks.append({
                        "category": category,
                        "name": attack.get("attack", ""),
                        "text": attack.get("text", ""),
                        "count": attack.get("count"),
                    })
        elif parsed:
            attacks.append({"category": "melee" if "melee" in column else "ranged", "name": "", "text": str(parsed), "count": None})
    special_attacks = literal("attacks/special")
    if isinstance(special_attacks, list):
        special_attacks = [str(item) for item in special_attacks]
    elif special_attacks:
        special_attacks = [str(special_attacks)]

    # Skills: skills/<Name> columns hold totals (or repr dicts for conditional
    # modifiers, e.g. {'Stealth': {'in water': 12}}). Keep name + total + notes.
    skills: List[Dict[str, Any]] = []
    for column, value in canonical.items():
        match = SKILL_NAME_RE.match(column)
        if not match or not str(value).strip():
            continue
        skill_name = match.group(1)
        total = _parse_number(str(value))
        note = ""
        if total is None:
            parsed = _parse_literal(str(value), warnings, f"{context} {column}")
            if isinstance(parsed, dict):
                total = None
                note = json.dumps(parsed)
            else:
                note = str(value).strip()
        skills.append({"name": skill_name, "total": total, "note": note})
    skills.sort(key=lambda skill: skill["name"])

    # Feats may be a comma string or a repr list.
    feats_raw = literal("feats")
    if isinstance(feats_raw, list):
        feats = [str(feat) for feat in feats_raw]
    elif feats_raw:
        feats = [feat.strip() for feat in str(feats_raw).split(",") if feat.strip()]
    else:
        feats = []

    # Special abilities / defensive abilities are repr lists of text.
    def text_list(column: str) -> List[str]:
        parsed = literal(column)
        if isinstance(parsed, list):
            return [str(item) for item in parsed]
        return [str(parsed)] if parsed else []

    # Spell-like abilities / spells keep their repr entries as display text.
    def entry_text(column: str) -> List[str]:
        parsed = literal(column)
        if isinstance(parsed, list):
            rendered = []
            for entry in parsed:
                if isinstance(entry, dict):
                    rendered.append(str(entry.get("name", entry)))
                else:
                    rendered.append(str(entry))
            return rendered
        return [str(parsed)] if parsed else []

    cr_raw = canonical.get("CR", "").strip()
    cr_value = _parse_number(cr_raw)
    if cr_raw and cr_value is None:
        cr_display = {"1/2": "1/2", "1/3": "1/3", "1/4": "1/4", "1/6": "1/6", "1/8": "1/8"}.get(cr_raw, cr_raw)
        cr_value = {"1/2": 0.5, "1/3": 1 / 3, "1/4": 0.25, "1/6": 1 / 6, "1/8": 0.125}.get(cr_raw)
    else:
        cr_display = cr_raw

    speeds = _flatten_group("speeds", canonical, warnings)
    senses = _flatten_group("senses", canonical, warnings)
    resistances = _flatten_group("resistances", canonical, warnings)

    auras: List[Dict[str, Any]] = []
    for index in range(1, 6):
        aura_name = canonical.get(f"auras_{index}/name", "").strip()
        if aura_name:
            auras.append({
                "name": aura_name,
                "radius": canonical.get(f"auras_{index}/radius", "").strip(),
                "dc": canonical.get(f"auras_{index}/DC", "").strip(),
                "other": canonical.get(f"auras_{index}/other", "").strip(),
            })

    sources = []
    for index in range(1, 4):
        source_name = canonical.get(f"sources_{index}/name", "").strip()
        if source_name:
            sources.append({
                "name": source_name,
                "page": canonical.get(f"sources_{index}/page", "").strip(),
                "link": canonical.get(f"sources_{index}/link", "").strip(),
            })

    damage_reduction = []
    for index in range(1, 3):
        amount = canonical.get(f"DR_{index}/amount", "").strip()
        weakness = canonical.get(f"DR_{index}/weakness", "").strip()
        if amount or weakness:
            damage_reduction.append({"amount": amount, "weakness": weakness})

    record = {
        "name": name,
        "cr": cr_value,
        "cr_display": cr_display,
        "type": canonical.get("type", "").strip(),
        "subtypes": _collect_numbered(canonical, "subtypes", 6),
        "size": canonical.get("size", "").strip(),
        "alignment": canonical.get("alignment", "").strip(),
        "url": canonical.get("URL", "").strip(),
        "xp": _parse_number(canonical.get("XP", "")),
        "ac": {
            "total": _parse_number(canonical.get("AC/AC", "")),
            "touch": _parse_number(canonical.get("AC/touch", "")),
            "flat_footed": _parse_number(canonical.get("AC/flat_footed", "")),
            "other": canonical.get("AC/other", "").strip(),
        },
        "hp": {
            "total": _parse_number(canonical.get("HP/HP", "")),
            "hd": canonical.get("HP/HD", "").strip() or canonical.get("HP/long", "").strip(),
            "fast_healing": _parse_number(canonical.get("HP/fast_healing", "")),
            "regeneration": _parse_number(canonical.get("HP/regeneration", "")),
            "other": canonical.get("HP/other", "").strip(),
        },
        "saves": {
            "fort": _parse_number(canonical.get("saves/fort", "")),
            "ref": _parse_number(canonical.get("saves/ref", "")),
            "will": _parse_number(canonical.get("saves/will", "")),
            "other": canonical.get("saves/other", "").strip(),
        },
        "abilities": {
            ability: _parse_number(canonical.get(f"ability_scores/{ability.upper()}", ""))
            for ability in ["str", "dex", "con", "int", "wis", "cha"]
        },
        "bab": _parse_number(canonical.get("BAB", "")),
        "cmb": _parse_number(canonical.get("CMB", "")),
        "cmb_other": canonical.get("CMB_other", "").strip(),
        "cmd": _parse_number(canonical.get("CMD", "")),
        "cmd_other": canonical.get("CMD_other", "").strip(),
        "initiative": {
            "bonus": _parse_number(canonical.get("initiative/bonus", "")),
            "other": canonical.get("initiative/other", "").strip(),
        },
        "sr": _parse_number(canonical.get("SR", "")),
        "mr": _parse_number(canonical.get("MR", "")),
        "damage_reduction": damage_reduction,
        "immunities": canonical.get("immunities", "").strip(),
        "resistances": resistances,
        "weaknesses": _collect_numbered(canonical, "weaknesses", 4),
        "defensive_abilities": _collect_numbered(canonical, "defensive_abilities", 7),
        "attacks": attacks,
        "special_attacks": special_attacks or [],
        "spell_like_abilities": entry_text("spell_like_abilities/entries"),
        "spells": entry_text("spells/entries"),
        "special_abilities": text_list("special_abilities"),
        "special_qualities": text_list("special_qualities"),
        "skills": skills,
        "feats": feats,
        "languages": canonical.get("languages", "").strip(),
        "senses": senses,
        "speeds": speeds,
        "space": canonical.get("space", "").strip(),
        "reach": canonical.get("reach", "").strip(),
        "reach_other": canonical.get("reach_other", "").strip(),
        "auras": auras,
        "environment": canonical.get("ecology/environment", "").strip(),
        "organization": canonical.get("ecology/organization", "").strip(),
        "treasure": canonical.get("ecology/treasure", "").strip(),
        "desc_short": canonical.get("desc_short", "").strip(),
        "desc_long": canonical.get("desc_long", "").strip(),
        "sources": sources,
    }
    return record, warnings


class BestiaryLibrary:
    """Per-ruleset bestiary import/search backed by SQLite + FTS5."""

    def __init__(self, root_dir: Optional[Path] = None):
        repository_dir = Path(__file__).resolve().parent.parent
        env_dir = os.environ.get("GM_WORKBENCH_REFERENCE_DIR")
        default_dir = Path(env_dir) if env_dir else repository_dir / "artifacts" / "local" / "reference_library"
        self.root_dir = Path(root_dir) if root_dir else default_dir

    def get_source_path(self, source_directory: str) -> Optional[Path]:
        """Return the bestiary CSV only when it sits directly in the source directory."""
        source_dir = (self.root_dir / "sources" / source_directory).resolve()
        source_path = (source_dir / BESTIARY_FILENAME).resolve()
        if source_path.parent != source_dir or not source_path.is_file():
            return None
        return source_path

    def status(self, ruleset: str, source_directory: str) -> Dict[str, Any]:
        """Report whether the CSV is present and how many entries are indexed."""
        database = self._database_path(ruleset)
        entry_count = 0
        indexed_checksum = None
        if database.exists():
            with sqlite3.connect(database) as connection:
                self._initialize_database(connection)
                row = connection.execute("select count(*), max(indexed_checksum) from monsters").fetchone()
                entry_count = row[0]
                indexed_checksum = row[1]
        source_path = self.get_source_path(source_directory)
        source_checksum = self._checksum(source_path) if source_path else None
        return {
            "filename": BESTIARY_FILENAME,
            "source_present": source_path is not None,
            "source_checksum": source_checksum,
            "imported": entry_count > 0,
            "entry_count": entry_count,
            "stale": bool(source_path) and entry_count > 0 and source_checksum != indexed_checksum,
        }

    def import_source(self, ruleset: str, source_directory: str) -> Dict[str, Any]:
        """Parse and index the bestiary CSV. Idempotent: reimport replaces all rows."""
        source_path = self.get_source_path(source_directory)
        if not source_path:
            raise FileNotFoundError(f"Bestiary CSV not found; drop {BESTIARY_FILENAME} into the ruleset sources directory")

        checksum = self._checksum(source_path)
        records: List[Dict[str, Any]] = []
        warnings: List[str] = []
        with source_path.open("r", encoding="utf-8-sig", newline="") as source_file:
            reader = csv.DictReader(source_file)
            for row_number, row in enumerate(reader, start=2):  # header is line 1
                record, row_warnings = parse_bestiary_row(row, row_number)
                warnings.extend(row_warnings)
                if record:
                    records.append(record)

        indexed_at = datetime.now(timezone.utc).isoformat()
        database = self._database_path(ruleset)
        database.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(database) as connection:
            self._initialize_database(connection)
            connection.execute("delete from monster_search")
            connection.execute("delete from monsters")
            for row_id, record in enumerate(records, start=1):
                search_text = " ".join(filter(None, [
                    record["name"], record["type"], record["alignment"],
                    record["desc_short"], record["desc_long"],
                ]))
                connection.execute(
                    "insert into monsters (id, name, cr, cr_display, type, size, alignment, source, page, indexed_checksum, indexed_at, data) "
                    "values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        row_id, record["name"], record["cr"], record["cr_display"],
                        record["type"], record["size"], record["alignment"],
                        record["sources"][0]["name"] if record["sources"] else "",
                        record["sources"][0]["page"] if record["sources"] else "",
                        checksum, indexed_at, json.dumps(record),
                    ),
                )
                connection.execute(
                    "insert into monster_search (rowid, content) values (?, ?)",
                    (row_id, search_text),
                )

        return {
            "filename": BESTIARY_FILENAME,
            "checksum": checksum,
            "entry_count": len(records),
            "indexed_at": indexed_at,
            "warnings": warnings,
        }

    def search(
        self,
        ruleset: str,
        query: str = "",
        cr_min: Optional[float] = None,
        cr_max: Optional[float] = None,
        monster_type: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """Search indexed monsters; filters are ANDed, query is optional FTS5."""
        database = self._database_path(ruleset)
        if not database.exists():
            return []

        clauses: List[str] = []
        params: List[Any] = []
        terms = re.findall(r"[A-Za-z0-9_']+", query or "")
        if terms:
            clauses.append("monsters.id in (select rowid from monster_search where monster_search match ?)")
            params.append(" AND ".join(f'"{term}"' for term in terms))
        if cr_min is not None:
            clauses.append("monsters.cr >= ?")
            params.append(cr_min)
        if cr_max is not None:
            clauses.append("monsters.cr <= ?")
            params.append(cr_max)
        if monster_type:
            clauses.append("lower(monsters.type) = lower(?)")
            params.append(monster_type.strip())

        sql = (
            "select monsters.id, monsters.name, monsters.cr_display, monsters.type, "
            "monsters.size, monsters.alignment, monsters.source, monsters.page from monsters"
        )
        if clauses:
            sql += " where " + " and ".join(clauses)
        sql += " order by monsters.cr, monsters.name limit ?"
        params.append(max(1, min(limit, 200)))

        with sqlite3.connect(database) as connection:
            self._initialize_database(connection)
            rows = connection.execute(sql, params).fetchall()
        return [
            {
                "id": row[0], "name": row[1], "cr_display": row[2], "type": row[3],
                "size": row[4], "alignment": row[5], "source": row[6], "page": row[7],
            }
            for row in rows
        ]

    def get_entry(self, ruleset: str, entry_id: int) -> Optional[Dict[str, Any]]:
        """Return one full normalized monster record."""
        database = self._database_path(ruleset)
        if not database.exists():
            return None
        with sqlite3.connect(database) as connection:
            self._initialize_database(connection)
            row = connection.execute("select id, data from monsters where id = ?", (entry_id,)).fetchone()
        if not row:
            return None
        record = json.loads(row[1])
        record["id"] = row[0]
        return record

    def _database_path(self, ruleset: str) -> Path:
        return self.root_dir / "index" / ruleset / "bestiary.sqlite3"

    @staticmethod
    def _initialize_database(connection: sqlite3.Connection) -> None:
        connection.execute(
            "create table if not exists monsters ("
            "id integer primary key, name text, cr real, cr_display text, type text, "
            "size text, alignment text, source text, page text, "
            "indexed_checksum text, indexed_at text, data text)"
        )
        connection.execute(
            "create virtual table if not exists monster_search using fts5(content)"
        )

    @staticmethod
    def _checksum(source_path: Path) -> str:
        digest = hashlib.sha256()
        with source_path.open("rb") as source_file:
            for block in iter(lambda: source_file.read(1024 * 1024), b""):
                digest.update(block)
        return digest.hexdigest()
