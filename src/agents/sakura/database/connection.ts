import postgres from "postgres";
import { readFileSync } from "fs";
import { join } from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

console.log("Initializing database connection...");

let dbConnected = false;
let connectionError: Error | null = null;
let connectionReadyPromise: Promise<void>;

export const sql = postgres(process.env.DATABASE_URL, {
  ssl: false,
  connect_timeout: 10,
  idle_timeout: 20,
  max_lifetime: 60 * 30,
  connection: {
    application_name: 'sakura_bot'
  },
  onnotice: (notice) => {
    console.log('[DB NOTICE]', notice);
  },
  transform: {
    undefined: null,
  },
  debug: (connection_id, query) => {
    console.log(`[DB DEBUG] Connection ${connection_id} executing:`, query.split('\n')[0]);
  }
});

connectionReadyPromise = new Promise((resolve, reject) => {
  const tryConnect = async () => {
    try {
      await sql`SELECT 1`;
      console.log('[DB] Initial connection successful');
      dbConnected = true;
      connectionError = null;
      resolve();
    } catch (err) {
      console.error('[DB] Initial connection failed:', err);
      dbConnected = false;
      connectionError = err instanceof Error ? err : new Error(String(err));
      setTimeout(tryConnect, 5000);
    }
  };
  
  tryConnect();
});

const monitorConnection = async () => {
  try {
    await sql`SELECT 1`;
    if (!dbConnected) {
      console.log('[DB] Connection re-established');
      dbConnected = true;
      connectionError = null;
    }
  } catch (err) {
    if (dbConnected) {
      console.error('[DB] Connection lost:', err);
      dbConnected = false;
      connectionError = err instanceof Error ? err : new Error(String(err));
    }
  }
};

connectionReadyPromise.then(() => {
  setInterval(monitorConnection, 30000);
}).catch(err => {
  console.error("Failed to establish initial database connection:", err);
});

export const checkDbConnection = async () => {
  await connectionReadyPromise;
  if (!dbConnected) {
    const error = new Error(
      connectionError 
        ? `Database connection failed: ${connectionError.message}` 
        : "Database connection is not established"
    );
    console.error("[DB] Connection check failed:", error);
    throw error;
  }
};

export const initializeDatabase = async () => {
  try {
    const schemaPath = join(__dirname, "schema.sql");
    const schema = readFileSync(schemaPath, "utf-8");
    await sql.unsafe(schema);
    console.log("Database schema initialized successfully");
  } catch (error) {
    console.error("Error initializing database schema:", error);
    throw error;
  }
};

export const cleanup = async () => {
  console.log("Cleaning up database connection...");
  await sql.end();
}; 