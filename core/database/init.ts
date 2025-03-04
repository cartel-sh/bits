import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "./schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const initializeDatabase = async () => {
  try {
    console.log("Starting database initialization with Drizzle...");

    const migrationClient = postgres(DATABASE_URL, { max: 1 });

    const tablesExist = await checkTablesExist(migrationClient);

    if (tablesExist) {
      console.log("Database tables already exist. Skipping schema creation.");
    } else {
      const db = drizzle(migrationClient, { schema });

      console.log("Running migrations...");

      const migrationsPath = "./core/database/migrations";
      await migrate(db, { migrationsFolder: migrationsPath });
      console.log("Migrations completed successfully");
    }

    await migrationClient.end();

    console.log("Database initialization completed");
  } catch (error) {
    console.error("Error initializing database:", error);
    process.exit(1);
  }
};

async function checkTablesExist(client) {
  try {
    const result = await client`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `;
    return result[0]?.exists || false;
  } catch (error) {
    console.error("Error checking if tables exist:", error);
    return false;
  }
}

if (process.argv[1]?.endsWith("init.ts")) {
  initializeDatabase();
}

export { initializeDatabase };
