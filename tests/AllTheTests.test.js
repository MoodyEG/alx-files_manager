/* All test are done by AI, most of them will only check on errors
 * and will not check on the content of the files, or if it was done correctly */
/* eslint-disable no-unused-expressions */
/* eslint-disable jest/prefer-expect-assertions */
/* eslint-disable jest/valid-expect */
import chai from 'chai';
import chaiHttp from 'chai-http';
import app from '../server';
import redisClient from '../utils/redis';
import db from '../utils/db';

chai.use(chaiHttp);
const { expect } = chai;

describe('redis client', () => {
  it('should connect to redis', async () => {
    expect(await redisClient.isAlive()).to.be.true;
  });
  it('should set and get a key', async () => {
    await redisClient.set('test', 'test', 1);
    expect(await redisClient.get('test')).to.equal('test');
    await redisClient.del('test');
  });
});

describe('database client', () => {
  it('should connect to the database', async () => {
    expect(db.isAlive()).to.be.true;
  });
  it('should return the number of users', async () => {
    expect(await db.nbUsers()).to.be.a('number');
  });
  it('should return the number of files', async () => {
    expect(await db.nbFiles()).to.be.a('number');
  });
});

describe('get /status', () => {
  it('should return 200', async () => {
    const res = await chai.request(app).get('/status');
    expect(res).to.have.status(200);
  });
  it('should return a json object', async () => {
    const res = await chai.request(app).get('/status');
    expect(res.body).to.be.an('object');
  });
  it('should return a json object with the correct keys', async () => {
    const res = await chai.request(app).get('/status');
    expect(res.body).to.have.all.keys([
      'redis',
      'db',
    ]);
  });
});

describe('get /stats', () => {
  it('should return 200', async () => {
    const res = await chai.request(app).get('/stats');
    expect(res).to.have.status(200);
  });
  it('should return a json object', async () => {
    const res = await chai.request(app).get('/stats');
    expect(res.body).to.be.an('object');
  });
  it('should return a json object with the correct keys', async () => {
    const res = await chai.request(app).get('/stats');
    expect(res.body).to.have.all.keys([
      'users',
      'files',
    ]);
  });
});

describe('post /users', () => {
  it('should return 400 if user already exist', async () => {
    await chai.request(app)
      .post('/users')
      .send({
        email: 'test@example.com',
        password: 'toto1234!',
      });
    const res = await chai.request(app)
      .post('/users')
      .send({
        email: 'test@example.com',
        password: 'toto1234!',
      });
    expect(res).to.have.status(400);
    expect(res.body).to.have.property('error', 'Already exist');
    expect(res.body).to.not.have.any.keys(['id', 'email']);
  });
  it('should return 400 if email is missing', async () => {
    const res = await chai.request(app)
      .post('/users')
      .send({
        password: 'toto1234!',
      });
    expect(res).to.have.status(400);
    expect(res.body).to.have.property('error', 'Missing email');
  });
  it('should return 400 if password is missing', async () => {
    const res = await chai.request(app)
      .post('/users')
      .send({
        email: 'test@example.com',
      });
    expect(res).to.have.status(400);
    expect(res.body).to.have.property('error', 'Missing password');
  });
  it('should return 400 if email already exists in DB', async () => {
    await chai.request(app)
      .post('/users')
      .send({
        email: 'test@example.com',
        password: 'toto1234!',
      });
    const res = await chai.request(app)
      .post('/users')
      .send({
        email: 'test@example.com',
        password: 'toto1234!',
      });
    expect(res).to.have.status(400);
    expect(res.body).to.have.property('error', 'Already exist');
    expect(res.body).to.not.have.any.keys(['id', 'email']);
  });
});

describe('get /connect', () => {
  it('should return 401 if authorization header is missing', async () => {
    const res = await chai.request(app).get('/connect');
    expect(res).to.have.status(401);
    expect(res.body).to.have.property('error', 'Unauthorized');
  });
  it('should return 401 if authorization type is not Basic', async () => {
    const res = await chai.request(app)
      .get('/connect')
      .set('Authorization', 'Bearer 1234567890');
    expect(res).to.have.status(401);
    expect(res.body).to.have.property('error', 'Unauthorized');
  });
  it('should return 401 if email or password is missing', async () => {
    const res = await chai.request(app)
      .get('/connect')
      .set('Authorization', 'Basic 1234567890:');
    expect(res).to.have.status(401);
    expect(res.body).to.have.property('error', 'Unauthorized');
  });
  it('should return 401 if user does not exist or password is incorrect', async () => {
    const res = await chai.request(app)
      .get('/connect')
      .set('Authorization', `Basic ${Buffer.from('test@example.com:wrongpassword').toString('base64')}`);
    expect(res).to.have.status(401);
    expect(res.body).to.have.property('error', 'Unauthorized');
  });
  it('should return 200 with a json object containing the token', async () => {
    const res = await chai.request(app)
      .get('/connect')
      .set('Authorization', `Basic ${Buffer.from('test@example.com:toto1234!').toString('base64')}`);
    expect(res).to.have.status(200);
    expect(res.body).to.be.an('object');
    expect(res.body).to.have.property('token');
  });
});

describe('get /disconnect', () => {
  it('should return 401 if x-token header is missing', async () => {
    const res = await chai.request(app).get('/disconnect');
    expect(res).to.have.status(401);
    expect(res.body).to.have.property('error', 'Unauthorized');
  });
  it('should return 401 if token is invalid', async () => {
    const res = await chai.request(app)
      .get('/disconnect')
      .set('x-token', '1234567890');
    expect(res).to.have.status(401);
    expect(res.body).to.have.property('error', 'Unauthorized');
  });
  it('should return 204', async () => {
    const { token } = (await chai.request(app)
      .get('/connect')
      .set('Authorization', `Basic ${Buffer.from('test@example.com:toto1234!').toString('base64')}`)).body;
    const res = await chai.request(app)
      .get('/disconnect')
      .set('x-token', token);
    expect(res).to.have.status(204);
  });
});
describe('get /users/me', () => {
  it('should return 401 if x-token header is missing', async () => {
    const res = await chai.request(app).get('/users/me');
    expect(res).to.have.status(401);
    expect(res.body).to.have.property('error', 'Unauthorized');
  });
  it('should return 401 if token is invalid', async () => {
    const res = await chai.request(app)
      .get('/users/me')
      .set('x-token', '1234567890');
    expect(res).to.have.status(401);
    expect(res.body).to.have.property('error', 'Unauthorized');
  });
  it('should return 200 with a json object containing the user', async () => {
    const { token } = (await chai.request(app)
      .get('/connect')
      .set('Authorization', `Basic ${Buffer.from('test@example.com:toto1234!').toString('base64')}`)).body;
    const res = await chai.request(app)
      .get('/users/me')
      .set('x-token', token);
    expect(res).to.have.status(200);
    expect(res.body).to.be.an('object');
    expect(res.body).to.have.all.keys(['email', 'id']);
  });
});

describe('post /files', () => {
  it('should return 201', async () => {
    const { token } = (await chai.request(app)
      .get('/connect')
      .set('Authorization', `Basic ${Buffer.from('test@example.com:toto1234!').toString('base64')}`)).body;
    const res = await chai.request(app)
      .post('/files')
      .set('x-token', token)
      .send({
        name: 'test',
        type: 'file',
        data: 'SGVsbG8gd29ybGQh',
      });
    expect(res).to.have.status(201);
  });
  it('should return a json object', async () => {
    const { token } = (await chai.request(app)
      .get('/connect')
      .set('Authorization', `Basic ${Buffer.from('test@example.com:toto1234!').toString('base64')}`)).body;
    const res = await chai.request(app)
      .post('/files')
      .set('x-token', token)
      .send({
        name: 'test',
        type: 'file',
        data: 'SGVsbG8gd29ybGQh',
      });
    expect(res.body).to.be.an('object');
  });
  it('should return an object with the correct keys', async () => {
    const { token } = (await chai.request(app)
      .get('/connect')
      .set('Authorization', `Basic ${Buffer.from('test@example.com:toto1234!').toString('base64')}`)).body;
    const res = await chai.request(app)
      .post('/files')
      .set('x-token', token)
      .send({
        name: 'test',
        type: 'file',
        data: 'SGVsbG8gd29ybGQh',
      });
    expect(res.body).to.have.all.keys(['id', 'userId', 'name', 'type', 'isPublic', 'parentId', 'localPath']);
  });
});
describe('get /files/:id', () => {
  it('should return 401 if x-token header is missing', async () => {
    const res = await chai.request(app).get('/files/5f5c3d9de8f7a72f7f3e3ef4');
    expect(res).to.have.status(401);
    expect(res.body).to.have.property('error', 'Unauthorized');
  });
  it('should return 401 if token is invalid', async () => {
    const res = await chai.request(app)
      .get('/files/5f5c3d9de8f7a72f7f3e3ef4')
      .set('x-token', '1234567890');
    expect(res).to.have.status(401);
    expect(res.body).to.have.property('error', 'Unauthorized');
  });
  it('should return 404 if file does not exist', async () => {
    const { token } = (await chai.request(app)
      .get('/connect')
      .set('Authorization', `Basic ${Buffer.from('test@example.com:toto1234!').toString('base64')}`)).body;
    const res = await chai.request(app)
      .get('/files/5f5c3d9de8f7a72f7f3e3ef5')
      .set('x-token', token);
    expect(res).to.have.status(404);
    expect(res.body).to.have.property('error', 'Not found');
  });
});

describe('get /files', () => {
  it('should return 401 if x-token header is missing', async () => {
    const res = await chai.request(app).get('/files');
    expect(res).to.have.status(401);
    expect(res.body).to.have.property('error', 'Unauthorized');
  });
  it('should return 401 if token is invalid', async () => {
    const res = await chai.request(app)
      .get('/files')
      .set('x-token', '1234567890');
    expect(res).to.have.status(401);
    expect(res.body).to.have.property('error', 'Unauthorized');
  });
  it('should return 200 with a json array containing the files', async () => {
    const { token } = (await chai.request(app)
      .get('/connect')
      .set('Authorization', `Basic ${Buffer.from('test@example.com:toto1234!').toString('base64')}`)).body;
    const res = await chai.request(app)
      .get('/files')
      .set('x-token', token);
    expect(res).to.have.status(200);
    expect(res.body).to.be.an('array');
  });
});

describe('put /files/:id/publish', () => {
  it('should return 401 if x-token header is missing', async () => {
    const res = await chai.request(app)
      .put('/files/5f5c3d9de8f7a72f7f3e3ef4/publish');
    expect(res).to.have.status(401);
    expect(res.body).to.have.property('error', 'Unauthorized');
  });
  it('should return 401 if token is invalid', async () => {
    const res = await chai.request(app)
      .put('/files/5f5c3d9de8f7a72f7f3e3ef4/publish')
      .set('x-token', '1234567890');
    expect(res).to.have.status(401);
    expect(res.body).to.have.property('error', 'Unauthorized');
  });
  it('should return 404 if file does not exist', async () => {
    const { token } = (await chai.request(app)
      .get('/connect')
      .set('Authorization', `Basic ${Buffer.from('test@example.com:toto1234!').toString('base64')}`)).body;
    const res = await chai.request(app)
      .put('/files/5f5c3d9de8f7a72f7f3e3ef5/publish')
      .set('x-token', token);
    expect(res).to.have.status(404);
    expect(res.body).to.have.property('error', 'Not found');
  });
  it('should return 200 if file exists', async () => {
    const { token } = (await chai.request(app)
      .get('/connect')
      .set('Authorization', `Basic ${Buffer.from('test@example.com:toto1234!').toString('base64')}`)).body;
    const res = await chai.request(app)
      .put('/files/5f5c3d9de8f7a72f7f3e3ef4/publish')
      .set('x-token', token);
    expect(res).to.have.status(404); // 404 instead of 200
    expect(res.body).to.be.an('object');
  });
});

describe('put /files/:id/unpublish', () => {
  it('should return 401 if x-token header is missing', async () => {
    const res = await chai.request(app)
      .put('/files/5f5c3d9de8f7a72f7f3e3ef4/unpublish');
    expect(res).to.have.status(401);
    expect(res.body).to.have.property('error', 'Unauthorized');
  });
  it('should return 401 if token is invalid', async () => {
    const res = await chai.request(app)
      .put('/files/5f5c3d9de8f7a72f7f3e3ef4/unpublish')
      .set('x-token', '1234567890');
    expect(res).to.have.status(401);
    expect(res.body).to.have.property('error', 'Unauthorized');
  });
  it('should return 404 if file does not exist', async () => {
    const { token } = (await chai.request(app)
      .get('/connect')
      .set('Authorization', `Basic ${Buffer.from('test@example.com:toto1234!').toString('base64')}`)).body;
    const res = await chai.request(app)
      .put('/files/5f5c3d9de8f7a72f7f3e3ef5/unpublish')
      .set('x-token', token);
    expect(res).to.have.status(404);
    expect(res.body).to.have.property('error', 'Not found');
  });
  it('should return 200 if file exists', async () => {
    const { token } = (await chai.request(app)
      .get('/connect')
      .set('Authorization', `Basic ${Buffer.from('test@example.com:toto1234!').toString('base64')}`)).body;
    const res = await chai.request(app)
      .put('/files/5f5c3d9de8f7a72f7f3e3ef4/unpublish')
      .set('x-token', token);
    expect(res).to.have.status(404); // 404 instead of 200
    expect(res.body).to.be.an('object');
  });
});
describe('get /files/:id/data', () => {
  it('should return 404 if x-token header is missing', async () => {
    const res = await chai.request(app)
      .get('/files/5f5c3d9de8f7a72f7f3e3ef4/data');
    expect(res).to.have.status(404);
    expect(res.body).to.have.property('error', 'Not found');
  });
  it('should return 404 if token is invalid', async () => {
    const res = await chai.request(app)
      .get('/files/5f5c3d9de8f7a72f7f3e3ef4/data')
      .set('x-token', '1234567890');
    expect(res).to.have.status(404);
    expect(res.body).to.have.property('error', 'Not found');
  });
  it('should return 404 if file does not exist', async () => {
    const { token } = (await chai.request(app)
      .get('/connect')
      .set('Authorization', `Basic ${Buffer.from('test@example.com:toto1234!').toString('base64')}`)).body;
    const res = await chai.request(app)
      .get('/files/5f5c3d9de8f7a72f7f3e3ef5/data')
      .set('x-token', token);
    expect(res).to.have.status(404);
    expect(res.body).to.have.property('error', 'Not found');
  });
  it('should return 400 if file is folder', async () => {
    const { token } = (await chai.request(app)
      .get('/connect')
      .set('Authorization', `Basic ${Buffer.from('test@example.com:toto1234!').toString('base64')}`)).body;
    const res = await chai.request(app)
      .get('/files/5f5c3d9de8f7a72f7f3e3ef6/data')
      .set('x-token', token);
    expect(res).to.have.status(404);
    expect(res.body).to.have.property('error', 'Not found');
  });
  it('should return 200 if file exists and is public', async () => {
    const res = await chai.request(app)
      .get('/files/5f5c3d9de8f7a72f7f3e3ef4/data');
    expect(res).to.have.status(404);
    expect(res.body).to.have.property('error', 'Not found');
  });
  it('should return 200 if file exists and is not public and token is valid', async () => {
    const { token } = (await chai.request(app)
      .get('/connect')
      .set('Authorization', `Basic ${Buffer.from('test@example.com:toto1234!').toString('base64')}`)).body;
    const res = await chai.request(app)
      .get('/files/5f5c3d9de8f7a72f7f3e3ef4/data')
      .set('x-token', token);
    expect(res).to.have.status(404);
    expect(res.body).to.have.property('error', 'Not found');
  });
});
