import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

console.log("Initializing database connection...");

export const sql = postgres(process.env.DATABASE_URL, {
  ssl: false,
  connect_timeout: 10,
  idle_timeout: 20,
  max_lifetime: 60 * 30,
  connection: {
    application_name: 'sakura_bot'
  },
  transform: {
    undefined: null,
  },
});

// Initialize connection
const initConnection = async () => {
  try {
    await sql`SELECT 1`;
    console.log('[DB] Initial connection successful');
  } catch (err) {
    console.error('[DB] Initial connection failed:', err);
    throw err;
  }
};

// Monitor connection health periodically
const monitorConnection = async () => {
  try {
    await sql`SELECT 1`;
  } catch (err) {
    console.error('[DB] Connection error:', err);
  }
};

initConnection().then(() => {
  setInterval(monitorConnection, 30000);
}).catch(err => {
  console.error("Failed to establish initial database connection:", err);
});

export const cleanup = async () => {
  console.log("Cleaning up database connection...");
  await sql.end();
}; 