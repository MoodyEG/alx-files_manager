import { MongoClient } from 'mongodb';

class DBClient {
  constructor() {
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbPort = process.env.DB_PORT || 27017;
    const dbName = process.env.DB_DATABASE || 'files_manager';
    this.dataClient = new MongoClient(`mongodb://${dbHost}:${dbPort}/${dbName}`, { useUnifiedTopology: true });
    this.dataClient.connect();
  }

  isAlive() {
    try {
      return this.dataClient.isConnected();
    } catch (err) {
      return false;
    }
  }

  async nbUsers() {
    return new Promise((resolve, reject) => {
      this.dataClient
        .db()
        .collection('users')
        .countDocuments({}, (err, count) => {
          if (err) {
            reject(err);
          } else {
            resolve(count);
          }
        });
    });
  }

  async nbFiles() {
    return new Promise((resolve, reject) => {
      this.dataClient
        .db()
        .collection('files')
        .countDocuments({}, (err, count) => {
          if (err) {
            reject(err);
          } else {
            resolve(count);
          }
        });
    });
  }
}

const dbClient = new DBClient();
export default dbClient;
