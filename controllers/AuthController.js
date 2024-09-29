/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable class-methods-use-this */
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

export default class AuthController {
  static async getConnect(req, res) {
    try {
      const [email, password] = Buffer.from(req.headers.authorization.split(' ')[1], 'base64').toString().split(':');
      const user = await dbClient.dataClient.db().collection('users').findOne({ email });
      if (!user || crypto.createHash('sha1').update(password).digest('hex') !== user.password) {
        return res.status(401).send({ error: 'Unauthorized' });
      }
      const token = uuidv4();
      await redisClient.client.setex(`auth_${token}`, 24 * 60 * 60, user._id);
      return res.send({ token });
    } catch (err) {
      console.error(err);
      return res.status(500).send({ error: 'Internal Server Error' });
    }
  }

  static async getDisconnect(req, res) {
    try {
      const token = req.headers['x-token'];
      const userId = await redisClient.client.get(`auth_${token}`);
      if (!userId) {
        return res.status(401).send({ error: 'Unauthorized' });
      }
      await redisClient.client.del(`auth_${token}`);
      return res.status(204).send();
    } catch (err) {
      // eslint-disable-next-line no-undef
      return next(err);
    }
  }
}
