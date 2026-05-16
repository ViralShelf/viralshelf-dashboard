/**
 * better-sqlite3 compatibility shim using sql.js
 * 
 * Provides the same synchronous API as better-sqlite3
 * but uses sql.js (pure JavaScript, no native compilation).
 *
 * Supported methods:
 *   db.pragma(str)        — set pragma (best-effort)
 *   db.exec(sql)          — execute multiple statements
 *   db.prepare(sql)       — returns Statement
 *   db.close()            — persist + close
 *   stmt.run(...params)   — execute, returns { changes }
 *   stmt.get(...params)   — get single row as object
 *   stmt.all(...params)   — get all rows as array of objects
 */

import initSqlJs from 'sql.js';
import fs   from 'node:fs';
import path from 'node:path';

// Initialize sql.js once at module load (top-level await works in ESM)
const SQL = await initSqlJs();

// ── prepared Statement ───────────────────────────────────────────────────
class Statement {
  #db;
  #stmt;

  constructor(db, sqlText) {
    this.#db  = db;
    this.#stmt = db.prepare(sqlText);
  }

  /** Convert undefined to null for sql.js compatibility */
  #sanitize(args) {
    return args.map(a => a === undefined ? null : a);
  }

  run(...params) {
    this.#stmt.bind(this.#sanitize(params));
    this.#stmt.step();
    this.#stmt.reset();
    return { changes: this.#db.getRowsModified(), lastInsertRowid: null };
  }

  get(...params) {
    this.#stmt.bind(this.#sanitize(params));
    if (this.#stmt.step()) {
      const row = this.#stmt.getAsObject();
      this.#stmt.reset();
      return row;
    }
    this.#stmt.reset();
    return undefined;
  }

  all(...params) {
    this.#stmt.bind(this.#sanitize(params));
    const rows = [];
    while (this.#stmt.step()) {
      rows.push(this.#stmt.getAsObject());
    }
    this.#stmt.reset();
    return rows;
  }
}

// ── Database ────────────────────────────────────────────────────────────
export default class Database {
  #db;
  #filePath;

  constructor(filePath) {
    this.#filePath = filePath;

    // Load existing DB if it exists, otherwise create new
    let buffer = null;
    try {
      if (fs.existsSync(filePath)) {
        buffer = fs.readFileSync(filePath);
      }
    } catch (_) { /* new database */ }

    this.#db = new SQL.Database(buffer);
  }

  pragma(str) {
    // sql.js supports pragma strings directly
    try { this.#db.run(`PRAGMA ${str}`); } catch (_) { /* best-effort */ }
  }

  exec(sql) {
    this.#db.run(sql);
  }

  prepare(sqlText) {
    return new Statement(this.#db, sqlText);
  }

  close() {
    // Persist to disk before closing
    try {
      const dir = path.dirname(this.#filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const data = this.#db.export();
      fs.writeFileSync(this.#filePath, Buffer.from(data));
    } catch (e) {
      console.error('[DB] Failed to persist database:', e.message);
    }
    this.#db.close();
  }
}
