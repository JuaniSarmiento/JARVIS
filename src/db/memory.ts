import Database from 'better-sqlite3';
import { config } from '../config/env.js';

interface MessageRow {
    id?: number;
    userId: string;
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    name?: string;
    toolCallId?: string;
    timestamp?: string;
}

class MemoryDB {
    private db: Database.Database;

    constructor() {
        this.db = new Database(config.dbPath);
        this.init();
    }

    private init() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        name TEXT,
        toolCallId TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    }

    public addMessage(msg: MessageRow) {
        const stmt = this.db.prepare(`
      INSERT INTO messages (userId, role, content, name, toolCallId)
      VALUES (?, ?, ?, ?, ?)
    `);
        stmt.run(msg.userId, msg.role, msg.content, msg.name || null, msg.toolCallId || null);
    }

    public getHistory(userId: string, limit: number = 20): any[] {
        const stmt = this.db.prepare(`
      SELECT * FROM messages 
      WHERE userId = ? 
      ORDER BY id DESC 
      LIMIT ?
    `);
        const rows = stmt.all(userId, limit) as any;
        // Reverse to chronological order
        return rows.reverse().map((row: any) => {
            // reconstruct OpenAI message format
            const msg: any = {
                role: row.role,
                content: row.content,
            };
            if (row.name) msg.name = row.name;
            if (row.toolCallId) msg.tool_call_id = row.toolCallId;
            return msg;
        });
    }

    public clearHistory(userId: string) {
        const stmt = this.db.prepare(`DELETE FROM messages WHERE userId = ?`);
        stmt.run(userId);
    }
}

export const memoryDb = new MemoryDB();
