"""Local-only, ruleset-scoped PDF reference indexing and search.

Reference PDFs are user-supplied and never ship with the app. In the packaged
app the library root comes from GM_WORKBENCH_REFERENCE_DIR (Electron points it
at the per-user data directory); in development it defaults to the repo's
gitignored artifacts/local/reference_library tree.
"""

import hashlib
import json
import os
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from pypdf import PdfReader


class ReferenceLibrary:
    def __init__(self, root_dir: Optional[Path] = None):
        repository_dir = Path(__file__).resolve().parent.parent
        env_dir = os.environ.get("GM_WORKBENCH_REFERENCE_DIR")
        default_dir = Path(env_dir) if env_dir else repository_dir / "artifacts" / "local" / "reference_library"
        self.root_dir = Path(root_dir) if root_dir else default_dir

    def available_sources(self, ruleset: str, source_directory: Optional[str] = None) -> List[str]:
        source_dir = self._source_dir(source_directory or ruleset)
        if not source_dir.exists():
            return []
        return sorted(path.name for path in source_dir.glob("*.pdf"))

    def get_source_path(self, ruleset: str, filename: str, source_directory: Optional[str] = None) -> Optional[Path]:
        """Return a PDF only when it is directly inside the configured source directory."""
        source_dir = self._source_dir(source_directory or ruleset).resolve()
        source_path = (source_dir / filename).resolve()
        if source_path.parent != source_dir or source_path.suffix.lower() != ".pdf" or not source_path.is_file():
            return None
        return source_path

    def import_source(self, ruleset: str, filename: str, source_directory: Optional[str] = None) -> Dict[str, Any]:
        source_path = self.get_source_path(ruleset, filename, source_directory)
        if not source_path:
            raise FileNotFoundError("Reference PDF not found")

        reader = PdfReader(str(source_path))
        pages = [page.extract_text() or "" for page in reader.pages]
        return self.index_pages(ruleset, filename, source_path.stem.replace("_", " ").title(), pages, source_path)

    def index_pages(
        self,
        ruleset: str,
        filename: str,
        title: str,
        pages: List[str],
        source_path: Optional[Path] = None,
    ) -> Dict[str, Any]:
        source_path = source_path or self._source_dir(ruleset) / filename
        checksum = self._checksum(source_path) if source_path.is_file() else "synthetic"
        indexed_at = datetime.now(timezone.utc).isoformat()
        database = self._database_path(ruleset)
        database.parent.mkdir(parents=True, exist_ok=True)

        with sqlite3.connect(database) as connection:
            self._initialize_database(connection)
            row = connection.execute("select id from documents where filename = ?", (filename,)).fetchone()
            if row:
                connection.execute("delete from chunks where document_id = ?", (row[0],))
                connection.execute("delete from documents where id = ?", (row[0],))
            cursor = connection.execute(
                "insert into documents (filename, title, checksum, page_count, indexed_at) values (?, ?, ?, ?, ?)",
                (filename, title, checksum, len(pages), indexed_at),
            )
            document_id = cursor.lastrowid
            for page_number, page_text in enumerate(pages, start=1):
                for content in self._chunk_page(page_text):
                    connection.execute(
                        "insert into chunks (document_id, page_number, content) values (?, ?, ?)",
                        (document_id, page_number, content),
                    )

        record = {"filename": filename, "title": title, "checksum": checksum, "page_count": len(pages), "indexed_at": indexed_at}
        self._write_manifest_record(ruleset, record)
        return record

    def list_documents(self, ruleset: str) -> List[Dict[str, Any]]:
        database = self._database_path(ruleset)
        if not database.exists():
            return []
        with sqlite3.connect(database) as connection:
            self._initialize_database(connection)
            rows = connection.execute(
                "select filename, title, checksum, page_count, indexed_at from documents order by title"
            ).fetchall()
        return [dict(zip(["filename", "title", "checksum", "page_count", "indexed_at"], row)) for row in rows]

    def search(self, ruleset: str, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        terms = re.findall(r"[A-Za-z0-9_]+", query)
        if not terms:
            return []
        database = self._database_path(ruleset)
        if not database.exists():
            return []
        match_query = " AND ".join(f'"{term}"' for term in terms)
        with sqlite3.connect(database) as connection:
            self._initialize_database(connection)
            rows = connection.execute(
                """
                select documents.title, documents.filename, chunks.page_number,
                       snippet(chunks, 2, '', '', '...', 36)
                  from chunks
                  join documents on documents.id = chunks.document_id
                 where chunks match ?
                 limit ?
                """,
                (match_query, max(1, min(limit, 50))),
            ).fetchall()
        return [
            {"title": row[0], "filename": row[1], "page_number": row[2], "excerpt": row[3]}
            for row in rows
        ]

    def _source_dir(self, ruleset: str) -> Path:
        return self.root_dir / "sources" / ruleset

    def _database_path(self, ruleset: str) -> Path:
        return self.root_dir / "index" / ruleset / "references.sqlite3"

    def _manifest_path(self, ruleset: str) -> Path:
        return self.root_dir / "manifests" / f"{ruleset}.json"

    @staticmethod
    def _initialize_database(connection: sqlite3.Connection) -> None:
        connection.execute(
            "create table if not exists documents (id integer primary key, filename text unique, title text, checksum text, page_count integer, indexed_at text)"
        )
        connection.execute(
            "create virtual table if not exists chunks using fts5(document_id unindexed, page_number unindexed, content)"
        )

    @staticmethod
    def _chunk_page(page_text: str, maximum_length: int = 1400) -> List[str]:
        paragraphs = [paragraph.strip() for paragraph in re.split(r"\n\s*\n", page_text) if paragraph.strip()]
        chunks: List[str] = []
        current = ""
        for paragraph in paragraphs:
            if current and len(current) + len(paragraph) + 1 > maximum_length:
                chunks.append(current)
                current = ""
            current = f"{current}\n{paragraph}".strip()
        if current:
            chunks.append(current)
        return chunks

    @staticmethod
    def _checksum(source_path: Path) -> str:
        digest = hashlib.sha256()
        with source_path.open("rb") as source_file:
            for block in iter(lambda: source_file.read(1024 * 1024), b""):
                digest.update(block)
        return digest.hexdigest()

    def _write_manifest_record(self, ruleset: str, record: Dict[str, Any]) -> None:
        manifest_path = self._manifest_path(ruleset)
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        records = []
        if manifest_path.exists():
            records = json.loads(manifest_path.read_text())
        records = [existing for existing in records if existing["filename"] != record["filename"]]
        manifest_path.write_text(json.dumps(records + [record], indent=2) + "\n")