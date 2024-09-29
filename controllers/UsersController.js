import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

export default class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;
    if (!email) {
      return res.status(400).send({ error: 'Missing email' });
    }
    if (!password) {
      return res.status(400).send({ error: 'Missing password' });
    }
    try {
      const user = await dbClient.dataClient.db().collection('users').findOne({ email });
      if (user) {
        return res.status(400).send({ error: 'Already exist' });
      }
      const hashedPassword = crypto.createHash('sha1').update(password).digest('hex');
      const result = await dbClient.dataClient.db().collection('users').insertOne({ email, password: hashedPassword });
      return res.status(201).send({ email, id: result.insertedId });
    } catch (err) {
      console.error(err);
      return res.status(500).send({ error: 'Internal Server Error' });
    }
  }

  static async getMe(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).send({ error: 'Unauthorized' });
    }
    try {
      const userId = await redisClient.get(`auth_${token}`);
      if (!userId) {
        return res.status(401).send({ error: 'Unauthorized' });
      }
      const user = await dbClient.dataClient.db().collection('users')
        .findOne({ _id: new ObjectId(userId) });
      if (!user) {
        return res.status(401).send({ error: 'Unauthorized' });
      }
      return res.send({ email: user.email, id: user._id });
    } catch (err) {
      console.error(err);
      return res.status(401).send({ error: 'Unauthorized' });
    }
  }
}
