import { sql } from "bun";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const initializeDatabase = async () => {
  try {
    console.log("Starting database initialization...");

    // Run initial schema
    const schemaPath = new URL("schema.sql", import.meta.url);
    const schema = await Bun.file(schemaPath).text();
    await sql.unsafe(schema);
    console.log("Database schema initialized successfully");

    // Run migrations
    const migrationsPath = new URL("migrations.sql", import.meta.url);
    const migrations = await Bun.file(migrationsPath).text();
    await sql.unsafe(migrations);
    console.log("Database migrations completed successfully");

    console.log("Database initialization completed");
  } catch (error) {
    console.error("Error initializing database:", error);
    process.exit(1);
  }
};

if (process.argv[1] === import.meta.path) {
  initializeDatabase();
}

export { initializeDatabase }; 