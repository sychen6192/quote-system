import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { DatabaseError } from '../../shared/errors/error-handler';

export class DatabaseService {
  private static instance: DatabaseService;
  private client: postgres.Sql | null = null;
  private db: ReturnType<typeof drizzle> | null = null;

  private constructor() {
    // 私有建構子，強制使用單例模式
  }

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  async connect(): Promise<ReturnType<typeof drizzle>> {
    if (this.db) {
      return this.db;
    }

    try {
      const databaseUrl = process.env.DATABASE_URL;

      if (!databaseUrl) {
        throw new Error('DATABASE_URL environment variable is not set');
      }

      // 創建 PostgreSQL 客戶端
      this.client = postgres(databaseUrl, {
        max: 10, // 最大連接數
        idle_timeout: 20, // 空閒超時時間（秒）
        connect_timeout: 10, // 連接超時時間（秒）
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      });

      // 創建 Drizzle 實例
      this.db = drizzle(this.client);

      // 測試連接
      await this.testConnection();

      console.log('Database connection established successfully');
      return this.db;
    } catch (error) {
      console.error('Failed to connect to database:', error);
      throw new DatabaseError('Failed to connect to database', { originalError: error });
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.end();
        console.log('Database connection closed');
      } catch (error) {
        console.error('Error closing database connection:', error);
      } finally {
        this.client = null;
        this.db = null;
      }
    }
  }

  getDb(): ReturnType<typeof drizzle> {
    if (!this.db) {
      throw new DatabaseError('Database not connected. Call connect() first.');
    }
    return this.db;
  }

  async testConnection(): Promise<boolean> {
    try {
      const db = this.getDb();
      // 執行簡單的查詢來測試連接
      await db.execute('SELECT 1');
      return true;
    } catch (error) {
      console.error('Database connection test failed:', error);
      throw new DatabaseError('Database connection test failed', { originalError: error });
    }
  }

  async withTransaction<T>(
    callback: (db: ReturnType<typeof drizzle>) => Promise<T>
  ): Promise<T> {
    const db = this.getDb();

    try {
      // 注意：Drizzle ORM 使用不同的方式處理交易
      // 這裡我們使用 execute 來開始交易
      await db.execute('BEGIN');

      const result = await callback(db);

      await db.execute('COMMIT');
      return result;
    } catch (error) {
      await db.execute('ROLLBACK').catch(rollbackError => {
        console.error('Failed to rollback transaction:', rollbackError);
      });

      throw error;
    }
  }

  async executeQuery<T>(query: string, params?: any[]): Promise<T[]> {
    try {
      const db = this.getDb();
      const result = await db.execute(query, params);
      return result as T[];
    } catch (error) {
      console.error('Database query failed:', error);
      throw new DatabaseError('Database query failed', {
        query,
        params,
        originalError: error,
      });
    }
  }

  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: {
      connected: boolean;
      lastCheck: string;
      latency?: number;
    };
  }> {
    const startTime = Date.now();

    try {
      const isConnected = await this.testConnection();
      const latency = Date.now() - startTime;

      return {
        status: isConnected ? 'healthy' : 'unhealthy',
        details: {
          connected: isConnected,
          lastCheck: new Date().toISOString(),
          latency,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          connected: false,
          lastCheck: new Date().toISOString(),
        },
      };
    }
  }

  // 連接池統計資訊
  async getPoolStats(): Promise<{
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    waitingClients: number;
  }> {
    // 注意：PostgreSQL.js 不提供連接池統計資訊
    // 這裡返回基本資訊
    return {
      totalConnections: this.client ? 10 : 0, // 最大連接數
      activeConnections: 0, // 需要實際監控
      idleConnections: 0, // 需要實際監控
      waitingClients: 0, // 需要實際監控
    };
  }

  // 清理資源
  async cleanup(): Promise<void> {
    await this.disconnect();
  }
}

// 導出單例實例
export const databaseService = DatabaseService.getInstance();