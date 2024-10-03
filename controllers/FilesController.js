import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { promises as fs, existsSync } from 'fs';
import path from 'path';
import mime from 'mime-types';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

export default class FilesController {
  // Task 5 Main Code//
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

  // Task 6 Main
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

  // Task 6 Main
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

  // Task 7 Main
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

  // Task 7 Main
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

  // Task 8 Main, Task 9 modify
  static async getFile(req, res) {
    const token = req.headers['x-token'];
    const fileId = req.params.id;
    const { size } = req.query;

    const file = await dbClient.dataClient.db().collection('files').findOne({ _id: ObjectId(fileId) });
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (!file.isPublic) {
      if (!token) {
        return res.status(404).json({ error: 'Not found' });
      }
      const userId = await redisClient.get(`auth_${token}`);
      if (!userId || userId !== file.userId.toString()) {
        return res.status(404).json({ error: 'Not found' });
      }
    }

    if (file.type === 'folder') {
      return res.status(400).json({ error: "A folder doesn't have content" });
    }

    let filePath = file.localPath;
    if (size && ['100', '250', '500'].includes(size)) {
      filePath = `${file.localPath}_${size}`;
    }

    if (!existsSync(filePath)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const mimeType = mime.lookup(file.name);
    const data = await fs.readFile(filePath);
    return res.header('Content-Type', mimeType).status(200).send(data);
  }
}
