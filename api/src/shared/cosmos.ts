import { Container, CosmosClient } from '@azure/cosmos';

// Same app setting name the legacy site uses, so one connection string works for both.
// Read lazily so the health endpoint and unit tests do not need Cosmos configured.
const DATABASE_NAME = 'acderby';

let client: CosmosClient | undefined;

export function getContainer(containerName: string): Container {
  const connectionString = process.env.CosmosDbConnectionString;
  if (!connectionString) {
    throw new Error('CosmosDbConnectionString is not configured');
  }
  client ??= new CosmosClient(connectionString);
  return client.database(DATABASE_NAME).container(containerName);
}
