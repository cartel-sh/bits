import { and, count, eq, isNull } from "drizzle-orm";
import { db, practiceSessions, userIdentities, users } from "./client";

async function testDrizzle() {
  try {
    console.log("Testing Drizzle ORM connection...");

    const userCount = await db.select({ count: count() }).from(users);
    console.log(`Total users: ${userCount[0].count}`);

    const identityCount = await db
      .select({ count: count() })
      .from(userIdentities);
    console.log(`Total user identities: ${identityCount[0].count}`);

    const sessionCount = await db
      .select({ count: count() })
      .from(practiceSessions);
    console.log(`Total practice sessions: ${sessionCount[0].count}`);

    const activeSessions = await db
      .select({ count: count() })
      .from(practiceSessions)
      .where(isNull(practiceSessions.endTime));
    console.log(`Active practice sessions: ${activeSessions[0].count}`);

    console.log("Drizzle ORM test completed successfully!");
  } catch (error) {
    console.error("Error testing Drizzle:", error);
  } finally {
    process.exit(0);
  }
}

testDrizzle();
