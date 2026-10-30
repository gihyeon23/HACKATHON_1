"""SQLite 저장소: 문서 키(keys)와 서버 열람 로그(open_log). hck.KEY_STORE 를 이 저장소로 교체한다."""
import json
import sqlite3
from collections.abc import MutableMapping
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "storage" / "traceguard.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS keys (
  doc_id TEXT PRIMARY KEY, key_hex TEXT NOT NULL, title TEXT, genesis_hash TEXT,
  created_by TEXT, created_at TEXT
);
CREATE TABLE IF NOT EXISTS open_log (
  hash TEXT PRIMARY KEY, doc_id TEXT NOT NULL, seq INTEGER NOT NULL, event TEXT NOT NULL,
  actor TEXT NOT NULL, at TEXT NOT NULL, parent_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS open_log_backup (
  hash TEXT PRIMARY KEY, doc_id TEXT NOT NULL, seq INTEGER NOT NULL, event TEXT NOT NULL,
  actor TEXT NOT NULL, at TEXT NOT NULL, parent_hash TEXT NOT NULL
);
"""


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return conn


class SqliteKeyStore(MutableMapping):
    """hck.py 가 dict 처럼 쓰는 KEY_STORE 자리에 꽂는다. 서버를 재시작해도 키가 남는다."""

    def __getitem__(self, doc_id):
        with connect() as c:
            row = c.execute("SELECT key_hex FROM keys WHERE doc_id=?", (doc_id,)).fetchone()
        if row is None:
            raise KeyError(doc_id)
        return bytes.fromhex(row["key_hex"])

    def __setitem__(self, doc_id, key):
        with connect() as c:
            c.execute("INSERT OR REPLACE INTO keys(doc_id, key_hex) VALUES(?, ?)", (doc_id, key.hex()))

    def __delitem__(self, doc_id):
        with connect() as c:
            c.execute("DELETE FROM keys WHERE doc_id=?", (doc_id,))

    def __iter__(self):
        with connect() as c:
            return iter([r["doc_id"] for r in c.execute("SELECT doc_id FROM keys")])

    def __len__(self):
        with connect() as c:
            return c.execute("SELECT COUNT(*) FROM keys").fetchone()[0]


def save_document(doc_id: str, title: str, genesis_hash: str, created_by: dict, created_at: str):
    with connect() as c:
        c.execute("UPDATE keys SET title=?, genesis_hash=?, created_by=?, created_at=? WHERE doc_id=?",
                  (title, genesis_hash, json.dumps(created_by, ensure_ascii=False), created_at, doc_id))


def get_document(doc_id: str):
    with connect() as c:
        row = c.execute("SELECT doc_id, title, genesis_hash, created_by, created_at FROM keys WHERE doc_id=?",
                        (doc_id,)).fetchone()
    return dict(row) if row else None


def list_documents() -> list[dict]:
    with connect() as c:
        rows = c.execute(
            """SELECT k.doc_id, k.title, k.created_by, k.created_at,
                      (SELECT COUNT(*) FROM open_log o WHERE o.doc_id=k.doc_id AND o.event='open') AS opens
               FROM keys k ORDER BY k.created_at DESC""").fetchall()
    return [{**dict(r), "created_by": json.loads(r["created_by"] or "{}")} for r in rows]


def append_log(doc_id: str, entry: dict):
    with connect() as c:
        c.execute("INSERT OR IGNORE INTO open_log VALUES(?,?,?,?,?,?,?)",
                  (entry["hash"], doc_id, entry["seq"], entry["event"],
                   json.dumps(entry["actor"], ensure_ascii=False), entry["at"], entry["parent_hash"]))


def _row(r) -> dict:
    return {**dict(r), "actor": json.loads(r["actor"])}


def logs_for(doc_id: str) -> list[dict]:
    with connect() as c:
        rows = c.execute("SELECT * FROM open_log WHERE doc_id=? ORDER BY at, seq", (doc_id,)).fetchall()
    return [_row(r) for r in rows]


def recent_logs(limit: int = 12) -> list[dict]:
    with connect() as c:
        rows = c.execute(
            """SELECT o.*, k.title FROM open_log o LEFT JOIN keys k ON k.doc_id=o.doc_id
               ORDER BY o.at DESC, o.seq DESC LIMIT ?""", (limit,)).fetchall()
    return [_row(r) for r in rows]


def stats() -> dict:
    with connect() as c:
        rows = c.execute("SELECT actor, event FROM open_log").fetchall()
        docs = c.execute("SELECT COUNT(*) FROM keys").fetchone()[0]
        backup = c.execute("SELECT COUNT(*) FROM open_log_backup").fetchone()[0]
    opens = [json.loads(r["actor"]) for r in rows if r["event"] == "open"]
    return {"documents": docs, "opens": len(opens), "external_opens": sum("외부" in a.get("org", "") for a in opens),
            "log_rows": len(rows), "logs_wiped": backup > 0}


def wipe_logs() -> int:
    """데모: 서버 로그를 지운다. 다음 시연을 위해 백업 테이블로 옮겨 둔다."""
    with connect() as c:
        n = c.execute("SELECT COUNT(*) FROM open_log").fetchone()[0]
        c.execute("INSERT OR REPLACE INTO open_log_backup SELECT * FROM open_log")
        c.execute("DELETE FROM open_log")
    return n


def restore_logs() -> int:
    with connect() as c:
        n = c.execute("SELECT COUNT(*) FROM open_log_backup").fetchone()[0]
        c.execute("INSERT OR REPLACE INTO open_log SELECT * FROM open_log_backup")
        c.execute("DELETE FROM open_log_backup")
    return n


def reset_all():
    with connect() as c:
        c.executescript("DELETE FROM keys; DELETE FROM open_log; DELETE FROM open_log_backup;")
