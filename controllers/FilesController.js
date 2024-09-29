import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

export default class FilesController {
  static async postUpload(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).send({ error: 'Unauthorized' });
    }
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).send({ error: 'Unauthorized' });
    }
    const {
      name, type, parentId, isPublic, data,
    } = req.body;
    if (!name) {
      return res.status(400).send({ error: 'Missing name' });
    }
    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return res.status(400).send({ error: 'Missing type' });
    }
    if (type !== 'folder' && !data) {
      return res.status(400).send({ error: 'Missing data' });
    }
    if (parentId) {
      const parent = await dbClient.dataClient.db().collection('files').findOne({ _id: new ObjectId(parentId) });
      if (!parent) {
        return res.status(400).send({ error: 'Parent not found' });
      }
      if (parent.type !== 'folder') {
        return res.status(400).send({ error: 'Parent is not a folder' });
      }
    }
    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    const folderPathExists = await fs.access(folderPath).then(() => true).catch(() => false);
    if (!folderPathExists) {
      await fs.mkdir(folderPath);
    }
    const localPath = path.join(folderPath, uuidv4());
    if (type !== 'folder') {
      await fs.writeFile(localPath, Buffer.from(data, 'base64'));
    }
    const file = {
      userId: new ObjectId(userId),
      name,
      type,
      isPublic: isPublic || false,
      parentId: parentId ? new ObjectId(parentId) : 0,
      localPath: type === 'file' || type === 'image' ? localPath : undefined,
    };
    const result = await dbClient.dataClient.db().collection('files').insertOne(file);
    delete file._id;
    return res.status(201).send({ ...file, id: result.insertedId });
  }
}
