# Backend Coding Notes - Known Pitfalls

**Purpose**: Document issues that have caused recurring bugs. Read before modifying these areas.

---

## 1. Console Output - No Emoji (Windows Encoding)

**Problem**: `print(f"✅ Success")` causes `UnicodeEncodeError` on Windows (cp1252). The process crashes *after* successful operations when it hits the emoji.

**Historical**: SO 3106 "5 items" bug - parsing was correct, but `print(f"💾 Cached SO data...")` in `get_so_data_from_system` crashed the flow on Windows.

**Rule**: Use ASCII only in print statements. Use `[OK]`, `[WARN]`, `[FAIL]`, `[INFO]` - never ✅❌⚠️💾📧📋🔀⚡.

**Files**: `logistics_automation.py` (and any backend code that runs on Windows)

---

## 2. SO Parser - Merged Table Fallback

**Problem**: Some SO PDFs (e.g. SO 3106) have merged table cells - all items in one row, newline-separated. GPT often returns fewer items than the raw table (drops the 4X4L line).

**Solution**: `raw_so_extractor.py` - when `len(fallback_items) > len(gpt_items)`, use raw table result instead of GPT.

**Rule**: Do NOT remove `parse_merged_table_items()` or the fallback comparison logic in `extract_so_data_from_pdf()`.

**Reference**: `.cursor/rules/canoil.mdc` section 6c

---

## 3. Exception Handler Indentation

**Problem**: Error-handling code (import traceback, print, return) was indented at the wrong level - outside the `except` block. Caused `UnboundLocalError` when exceptions occurred.

**Rule**: Ensure all error-handling code is indented INSIDE the except block. The `except Exception as e:` variable `e` is only in scope within that block.

---

## 4. Regression Test - SO 3106

**Test**: `python backend/test_so3106_cloud.py` - hits Render API, verifies 6 items including 4X4L.

**When to run**: Before deploying changes to logistics/SO parsing. Ensures cloud flow still works.

---

*Last updated: Feb 2025*
