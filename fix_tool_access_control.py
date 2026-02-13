#!/usr/bin/env python3
"""
Add missing access_control column to tool table.
Run this ON RENDER (Shell or as a one-off job) where the SQLite DB lives.
Usage: python fix_tool_access_control.py
       OR set DB_PATH env var to your DB path.
"""
import os
import sqlite3

# Open WebUI typically uses /data/webui.db or similar on Render
DB_PATH = os.environ.get("DB_PATH", "/data/webui.db")

def fix():
    if not os.path.exists(DB_PATH):
        print(f"DB not found at {DB_PATH}. Set DB_PATH env var if different.")
        return False
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("PRAGMA table_info(tool)")
    cols = [r[1] for r in cur.fetchall()]
    if "access_control" in cols:
        print("Column access_control already exists. OK.")
        conn.close()
        return True
    cur.execute("ALTER TABLE tool ADD COLUMN access_control TEXT")
    conn.commit()
    conn.close()
    print("Added access_control column to tool table. Done.")
    return True

if __name__ == "__main__":
    fix()
