import redis from 'redis';

class RedisClient {
  constructor() {
    this.client = redis.createClient();
    this.client.connected = true;
    this.client.on('error', (err) => {
      this.client.connected = false;
      console.error(err);
    });
  }

  isAlive() {
    try {
      return this.client.connected;
    } catch (err) {
      return false;
    }
  }

  async get(key) {
    return new Promise((resolve, reject) => {
      this.client.get(key, (err, reply) => {
        if (err) {
          reject(err);
        } else {
          resolve(reply);
        }
      });
    });
  }

  async set(key, value, duration) {
    return new Promise((resolve, reject) => {
      this.client.setex(key, duration, value, (err, reply) => {
        if (err) {
          reject(err);
        } else {
          resolve(reply);
        }
      });
    });
  }

  async del(key) {
    return new Promise((resolve, reject) => {
      this.client.del(key, (err, reply) => {
        if (err) {
          reject(err);
        } else {
          resolve(reply);
        }
      });
    });
  }
}

const redisClient = new RedisClient();
export default redisClient;
