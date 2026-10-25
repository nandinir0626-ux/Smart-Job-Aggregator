const Redis = require('ioredis');

class CacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.memoryFallback = new Map();
    this.memoryExpiry = new Map();
    this.init();
  }

  init() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
      this.client = new Redis(redisUrl, {
        retryStrategy: (times) => {
          if (times > 3) {
            return null; // Stop reconnecting after 3 retries, rely on memory fallback
          }
          return Math.min(times * 100, 2000);
        },
        maxRetriesPerRequest: 2,
        connectTimeout: 3000,
        lazyConnect: false,
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        console.log('[Redis Cache] Connected to Redis server at 127.0.0.1:6379');
      });

      this.client.on('ready', () => {
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        if (this.isConnected) {
          console.warn('[Redis Cache] Redis connection interrupted, switching to in-memory fallback:', err.message);
        }
        this.isConnected = false;
      });

      this.client.on('close', () => {
        this.isConnected = false;
      });
    } catch (err) {
      console.warn('[Redis Cache] Could not initialize Redis client, using in-memory cache:', err.message);
      this.isConnected = false;
    }
  }

  async get(key) {
    const fullKey = `smartjobs:${key}`;
    if (this.isConnected && this.client) {
      try {
        const raw = await this.client.get(fullKey);
        if (raw) {
          return JSON.parse(raw);
        }
        return null;
      } catch (err) {
        // Fallback to memory on read failure
      }
    }

    // In-memory fallback
    const exp = this.memoryExpiry.get(fullKey);
    if (exp && Date.now() > exp) {
      this.memoryFallback.delete(fullKey);
      this.memoryExpiry.delete(fullKey);
      return null;
    }
    const val = this.memoryFallback.get(fullKey);
    return val ? JSON.parse(val) : null;
  }

  async set(key, value, ttlSeconds = 600) {
    const fullKey = `smartjobs:${key}`;
    const serialized = JSON.stringify(value);

    if (this.isConnected && this.client) {
      try {
        await this.client.set(fullKey, serialized, 'EX', ttlSeconds);
        return true;
      } catch (err) {
        // Fallback to memory on write failure
      }
    }

    // In-memory fallback
    this.memoryFallback.set(fullKey, serialized);
    this.memoryExpiry.set(fullKey, Date.now() + ttlSeconds * 1000);
    return true;
  }

  async del(key) {
    const fullKey = `smartjobs:${key}`;
    if (this.isConnected && this.client) {
      try {
        await this.client.del(fullKey);
      } catch (e) {}
    }
    this.memoryFallback.delete(fullKey);
    this.memoryExpiry.delete(fullKey);
  }

  async invalidatePrefix(prefix) {
    const matchPattern = `smartjobs:${prefix}*`;
    if (this.isConnected && this.client) {
      try {
        const keys = await this.client.keys(matchPattern);
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      } catch (e) {}
    }

    // Clean in-memory keys
    for (const k of this.memoryFallback.keys()) {
      if (k.startsWith(`smartjobs:${prefix}`)) {
        this.memoryFallback.delete(k);
        this.memoryExpiry.delete(k);
      }
    }
  }

  status() {
    return {
      connected: this.isConnected,
      provider: this.isConnected ? 'redis' : 'memory_fallback',
      memoryKeysCount: this.memoryFallback.size,
    };
  }
}

module.exports = new CacheService();
