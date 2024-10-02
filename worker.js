import Queue from 'bull';
import imgThumbnail from 'image-thumbnail';
import { ObjectId } from 'mongodb';
import { promises as fs } from 'fs';
import dbClient from './utils/db';

const fileQueue = new Queue('thumbnail generation');
const userQueue = new Queue('userQueue');

console.log('Starting worker');
// Task 9 Main
fileQueue.process(async (job, done) => {
  const { fileId, userId } = job.data;

  if (!fileId) {
    throw new Error('Missing fileId');
  }
  if (!userId) {
    throw new Error('Missing userId');
  }
  const file = await dbClient.dataClient.db().collection('files')
    .findOne({ _id: ObjectId(fileId), userId: ObjectId(userId) });
  if (!file) {
    throw new Error('File not found');
  }
  const sizes = [500, 250, 100];
  await Promise.all(
    sizes.map(async (size) => {
      const thumbnail = await imgThumbnail(file.localPath, { width: size });
      await fs.writeFile(`${file.localPath}_${size}`, thumbnail);
    }),
  );
  done();
});

// Task 11 Main
userQueue.process(async (job, done) => {
  const { userId } = job.data;
  if (!userId) {
    throw new Error('Missing userId');
  }
  const user = await dbClient.dataClient.db().collection('users')
    .findOne({ _id: ObjectId(userId) });
  if (!user) {
    throw new Error('User not found');
  }
  console.log(`Welcome ${user.email}!`);
  done();
});
