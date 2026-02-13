# Fix glchemtec-openwebui: no such column tool.access_control

## Option 1: Run in Render Shell (no file needed)

1. Render Dashboard → **glchemtec-openwebui** → **Shell**
2. Paste and run (DB path may vary):

```bash
python3 -c "
import sqlite3, os
p = os.environ.get('DB_PATH', '/data/webui.db')
if not os.path.exists(p): p = 'webui.db'
conn = sqlite3.connect(p)
cur = conn.cursor()
cur.execute('PRAGMA table_info(tool)')
cols = [r[1] for r in cur.fetchall()]
if 'access_control' not in cols:
    cur.execute('ALTER TABLE tool ADD COLUMN access_control TEXT')
    conn.commit()
    print('Added access_control')
else:
    print('Already exists')
conn.close()
"
```

3. **Manual Deploy** → Restart the service

## Option 2: Use the script file

1. Add `fix_tool_access_control.py` to your glchemtec-openwebui repo
2. Deploy, then in Render Shell: `python fix_tool_access_control.py`
3. Restart

## Option 2: One-off Job on Render

1. Create a **Background Worker** or **Cron Job** that runs this script once
2. Add `fix_tool_access_control.py` to your repo
3. Set `DB_PATH` in environment if needed
4. Run once, then delete the job

## Option 3: Build command (runs before every deploy)

Add to your **Render Build Command**:
```bash
python fix_tool_access_control.py || true
```
(The `|| true` avoids failing the build if column already exists.)

---

**Why you have to run it:** The database lives on Render's servers. No one can change it except by running commands there (Shell, deploy, or job).
