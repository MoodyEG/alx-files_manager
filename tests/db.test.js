/* eslint-disable import/no-named-as-default */
import dbClient from '../../utils/db';

describe('+ DBClient utility', () => {
  before(function (done) {
    this.timeout(10000);
    Promise.all([dbClient.usersCollection(), dbClient.filesCollection()])
      .then(([usersCollection, filesCollection]) => {
        Promise.all([usersCollection.deleteMany({}), filesCollection.deleteMany({})])
          .then(() => done())
          .catch((deleteErr) => done(deleteErr));
      }).catch((connectErr) => done(connectErr));
  });

  it('+ Client is alive', () => {
    // Just checking if the client exists and is alive according to the current implementation
    expect(dbClient.isAlive()).to.equal(true);
  });

  it('+ nbUsers returns the correct value', async () => {
    const nbUsers = await dbClient.nbUsers();
    expect(nbUsers).to.equal(0);
  });

  it('+ nbFiles returns the correct value', async () => {
    const nbFiles = await dbClient.nbFiles();
    expect(nbFiles).to.equal(0);
  });
});

