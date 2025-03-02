import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

export const sql = postgres(process.env.DATABASE_URL, {
  ssl: false,
  connect_timeout: 10,
  idle_timeout: 20,
  max_lifetime: 60 * 30,
  connection: {
    application_name: 'kudasai_bot'
  },
  transform: {
    undefined: null,
  },
});

export const cleanup = async () => {
  console.log("Cleaning up Kudasai database connection...");
  await sql.end();
}; 