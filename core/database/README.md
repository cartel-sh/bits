Kuhaku uses Drizzle for database operations. The database schema is defined in TypeScript, providing type-safe access to the database.

## Setup

1. Ensure you have a PostgreSQL database running and accessible.
2. Set the `DATABASE_URL` environment variable to your database connection string.

## Schema

The database schema is defined in `core/database/schema.ts`. This file defines all tables, indexes, and relationships using Drizzle's type-safe schema definition API.

## Database Operations

### Initialization

To initialize the database and run all migrations:

```bash
bun run db:init
```

### Migrations

Migrations are managed through Drizzle Kit. To generate migrations after schema changes:

```bash
bun run db:drizzle
```

To apply pending migrations:

```bash
bun run db:migrate
```

## Usage in Code

Import the database client and schema objects to perform database operations:

```typescript
import { db, users, userIdentities } from '../../../core/database/client';
import { eq, and, isNull } from 'drizzle-orm';

// Example query
const user = await db.query.users.findFirst({
  where: eq(users.id, 'some-id'),
  with: {
    identities: true
  }
});
```

## Type Safety

Drizzle provides complete type safety for all database operations. TypeScript infers the types from your schema definition:

```typescript
// Types are automatically inferred from your schema
const result: PracticeSession = await db.insert(practiceSessions)
  .values({
    userId: 'user-id',
    startTime: new Date(),
    date: '2023-09-01'
  })
  .returning();
```

## Database Client

The database client is initialized in `core/database/client.ts`. This file sets up the connection to PostgreSQL and exports the Drizzle database object for use throughout the codebase. 