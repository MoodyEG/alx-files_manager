import sha1 from 'sha1';
import { v4 as uuidv4 } from 'uuid';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

export default class AuthController {
  static async getConnect(req, res) {
    try {
      if (!req.headers.authorization) {
        return res.status(401).send({ error: 'Unauthorized' });
      }
      const authType = req.headers.authorization.split(' ')[0];
      if (authType !== 'Basic') {
        return res.status(401).send({ error: 'Unauthorized' });
      }
      const [email, password] = Buffer.from(req.headers.authorization.split(' ')[1], 'base64').toString().split(':');
      if (!email || !password) {
        return res.status(401).send({ error: 'Unauthorized' });
      }
      const user = await dbClient.dataClient.db().collection('users').findOne({ email });
      if (!user || sha1(password) !== user.password) {
        return res.status(401).send({ error: 'Unauthorized' });
      }
      const token = uuidv4();
      await redisClient.set(`auth_${token}`, user._id.toString(), 24 * 60 * 60);
      return res.status(200).json({ token });
    } catch (err) {
      console.error(err);
      return res.status(500).send({ error: 'Internal Server Error' });
    }
  }

  static async getDisconnect(req, res) {
    try {
      const token = req.headers['x-token'];
      if (!token) {
        return res.status(401).send({ error: 'Unauthorized' });
      }
      const userId = await redisClient.get(`auth_${token}`);
      if (!userId) {
        return res.status(401).send({ error: 'Unauthorized' });
      }
      await redisClient.del(`auth_${token}`);
      return res.status(204).send();
    } catch (err) {
      console.error(err);
      return res.status(500).send({ error: 'Internal Server Error' });
    }
  }
}
