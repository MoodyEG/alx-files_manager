import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { promises as fs, existsSync } from 'fs';
import path from 'path';
import mime from 'mime-types';
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

  static async getShow(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).send({ error: 'Unauthorized' });
    }
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).send({ error: 'Unauthorized' });
    }
    const { id } = req.params;
    const file = await dbClient.dataClient.db().collection('files').findOne({ _id: new ObjectId(id), userId: new ObjectId(userId) });
    if (!file) {
      return res.status(404).send({ error: 'Not found' });
    }
    file.id = file._id;
    delete file._id;
    return res.status(200).send(file);
  }

  static async getIndex(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).send({ error: 'Unauthorized' });
    }
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).send({ error: 'Unauthorized' });
    }
    const { parentId } = req.query;
    const page = Number(req.query.page) || 0;
    const match = {
      userId: new ObjectId(userId),
    };
    if (!parentId) {
      match.$or = [
        { parentId: 0 },
        { parentId: { $ne: 0 } },
      ];
    } else {
      match.parentId = parentId ? new ObjectId(parentId) : 0;
    }
    const files = await dbClient.dataClient.db().collection('files').aggregate([
      {
        $match: match,
      },
      {
        $project: {
          _id: 0,
          id: '$_id',
          userId: 1,
          name: 1,
          type: 1,
          isPublic: 1,
          parentId: 1,
        },
      },
      {
        $skip: page * 20,
      },
      {
        $limit: 20,
      },
    ]).toArray();
    return res.status(200).send(files);
  }

  static async putPublish(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).send({ error: 'Unauthorized' });
    }
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).send({ error: 'Unauthorized' });
    }
    const { id } = req.params;
    const file = await dbClient.dataClient.db().collection('files').findOneAndUpdate(
      { _id: new ObjectId(id), userId: new ObjectId(userId) },
      { $set: { isPublic: true } },
      { returnOriginal: false },
    );
    if (!file.value) {
      return res.status(404).send({ error: 'Not found' });
    }
    file.value.id = file.value._id;
    delete file.value._id;
    return res.status(200).send(file.value);
  }

  static async putUnpublish(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).send({ error: 'Unauthorized' });
    }
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).send({ error: 'Unauthorized' });
    }
    const { id } = req.params;
    const file = await dbClient.dataClient.db().collection('files').findOneAndUpdate(
      { _id: new ObjectId(id), userId: new ObjectId(userId) },
      { $set: { isPublic: false } },
      { returnOriginal: false },
    );
    if (!file.value) {
      return res.status(404).send({ error: 'Not found' });
    }
    file.value.id = file.value._id;
    delete file.value._id;
    return res.status(200).send(file.value);
  }
  static async getFile(req, res) {
    try {
      const { id } = req.params;
      const token = req.headers['x-token'];
      const file = await dbClient.dataClient.db().collection('files').findOne({ _id: new ObjectId(id) });
      if (!file) {
        return res.status(404).send({ error: 'Not found' });
      }
      if (!file.isPublic) {
        if (!token) {
          return res.status(404).send({ error: 'Not found' });
        }
        const userId = await redisClient.get(`auth_${token}`);
        if (!userId || file.userId.toString() !== userId) {
          return res.status(404).send({ error: 'Not found' });
        }
      }
      if (file.type === 'folder') {
        return res.status(400).send({ error: 'A folder doesn\'t have content' });
      }
      if (!file.localPath) {
        return res.status(404).send({ error: 'Not found' });
      }
      const fileExist = existsSync(file.localPath);
      if (!fileExist) {
        return res.status(404).send({ error: 'Not found' });
      }
      // const fileExist = await fs.access(file.localPath).then(() => true).catch(() => false);
      const type = mime.lookup(file.name);
      if (!type) {
        return res.status(404).send({ error: 'Not found' });
      }
      const data = await fs.readFile(file.localPath);
      return res.header('Content-Type', type).status(200).send(data);
    } catch (err) {
      console.error(err);
      return res.status(404).send({ error: 'Not found' });
    }
  }
}
