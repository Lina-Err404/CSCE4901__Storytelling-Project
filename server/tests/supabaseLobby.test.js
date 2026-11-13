const { clientStatus, databaseStatus } = require('../src/supabaseLobby');

describe('lobby status mapping', () => {
  test.each([
    ['open', 'waiting'],
    ['locked', 'active'],
    ['closed', 'closed'],
  ])('maps client status %s to database status %s', (client, database) => {
    expect(databaseStatus(client)).toBe(database);
  });

  test.each([
    ['waiting', 'open'],
    ['active', 'locked'],
    ['closed', 'closed'],
  ])('maps database status %s to client status %s', (database, client) => {
    expect(clientStatus(database)).toBe(client);
  });
});
