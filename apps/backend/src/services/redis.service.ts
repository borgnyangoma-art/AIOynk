import { createClient, RedisClientType } from 'redis';
import config from '../utils/config';

class RedisService {
  private client: RedisClientType;
  private isConnected: boolean = false;

  constructor() {
    this.client = createClient({
      url: config.REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 1000),
      },
    });

    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      console.log('✅ Redis connected');
      this.isConnected = true;
    });

    this.client.on('disconnect', () => {
      console.log('❌ Redis disconnected');
      this.isConnected = false;
    });
  }

  async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.client.connect();
    }
  }

  getClient(): RedisClientType {
    return this.client;
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.disconnect();
    }
  }

  async get(key: string): Promise<string | null> {
    await this.connect();
    return this.client.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    await this.connect();
    if (ttl) {
      await this.client.setEx(key, ttl, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async delete(key: string): Promise<void> {
    await this.connect();
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    await this.connect();
    const result = await this.client.exists(key);
    return result === 1;
  }

  async setSession(sessionId: string, data: any, ttl: number): Promise<void> {
    await this.connect();
    await this.client.setEx(`session:${sessionId}`, ttl, JSON.stringify(data));
  }

  async getSession(sessionId: string): Promise<any | null> {
    await this.connect();
    const data = await this.client.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.connect();
    await this.client.del(`session:${sessionId}`);
  }

  async setContext(sessionId: string, context: any): Promise<void> {
    await this.connect();
    await this.client.setEx(`context:${sessionId}`, config.REDIS_SESSION_TTL, JSON.stringify(context));
  }

  async getContext(sessionId: string): Promise<any | null> {
    await this.connect();
    const data = await this.client.get(`context:${sessionId}`);
    return data ? JSON.parse(data) : null;
  }

  async incrementTokenCount(sessionId: string): Promise<number> {
    await this.connect();
    return this.client.incr(`tokens:${sessionId}`);
  }

  async getTokenCount(sessionId: string): Promise<number> {
    await this.connect();
    const count = await this.client.get(`tokens:${sessionId}`);
    return count ? parseInt(count, 10) : 0;
  }
}

export default new RedisService();
