import postgres from "postgres";
import { file } from "bun";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const sql = postgres(process.env.DATABASE_URL, {
  ssl: false,
  connect_timeout: 10,
  idle_timeout: 20,
  max_lifetime: 60 * 30,
  connection: {
    application_name: 'database_init'
  },
  transform: {
    undefined: null,
  },
});

const initializeDatabase = async () => {
  try {
    console.log("Starting database initialization...");

    // Run initial schema
    const schemaPath = new URL("schema.sql", import.meta.url);
    const schema = await file(schemaPath).text();
    await sql.unsafe(schema);
    console.log("Database schema initialized successfully");

    // Run migrations
    const migrationsPath = new URL("migrations.sql", import.meta.url);
    const migrations = await file(migrationsPath).text();
    await sql.unsafe(migrations);
    console.log("Database migrations completed successfully");

    await sql.end();
    console.log("Database initialization completed");
  } catch (error) {
    console.error("Error initializing database:", error);
    await sql.end();
    process.exit(1);
  }
};

if (process.argv[1] === import.meta.path) {
  initializeDatabase();
}

export { initializeDatabase }; 