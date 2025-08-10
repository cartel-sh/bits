import { eq, and, sql, desc } from "drizzle-orm";
import { db } from "../../../core/database/client";
import {
  applications,
  applicationVotes,
  type NewApplication,
  type NewApplicationVote,
} from "../../../core/database/schema";

export async function getNextApplicationNumber(): Promise<number> {
  const result = await db
    .select({ max: sql<number>`COALESCE(MAX(${applications.applicationNumber}), 0)` })
    .from(applications);
  
  return (result[0]?.max || 0) + 1;
}

export async function createApplication(data: Omit<NewApplication, "id">): Promise<string> {
  const [application] = await db
    .insert(applications)
    .values(data)
    .returning({ id: applications.id });
  
  return application.id;
}

export async function getApplicationByMessageId(messageId: string) {
  const [application] = await db
    .select()
    .from(applications)
    .where(eq(applications.messageId, messageId));
  
  return application;
}

export async function getApplicationByNumber(applicationNumber: number) {
  const [application] = await db
    .select()
    .from(applications)
    .where(eq(applications.applicationNumber, applicationNumber));
  
  return application;
}

export async function addVote(
  applicationId: string,
  userId: string,
  userName: string,
  voteType: "approve" | "reject"
): Promise<void> {
  await db
    .insert(applicationVotes)
    .values({
      applicationId,
      userId,
      userName,
      voteType,
    })
    .onConflictDoUpdate({
      target: [applicationVotes.applicationId, applicationVotes.userId],
      set: {
        voteType,
        createdAt: new Date(),
      },
    });
}

export async function getVotes(applicationId: string) {
  const votes = await db
    .select()
    .from(applicationVotes)
    .where(eq(applicationVotes.applicationId, applicationId));
  
  const approvals = votes.filter(v => v.voteType === "approve");
  const rejections = votes.filter(v => v.voteType === "reject");
  
  return {
    approvals,
    rejections,
    approvalCount: approvals.length,
    rejectionCount: rejections.length,
  };
}

export async function updateApplicationStatus(
  applicationId: string,
  status: "approved" | "rejected"
): Promise<void> {
  await db
    .update(applications)
    .set({
      status,
      decidedAt: new Date(),
    })
    .where(eq(applications.id, applicationId));
}

export async function deleteApplication(applicationId: string): Promise<void> {
  await db
    .delete(applications)
    .where(eq(applications.id, applicationId));
}

export async function getPendingApplications() {
  return await db
    .select()
    .from(applications)
    .where(eq(applications.status, "pending"))
    .orderBy(desc(applications.submittedAt));
}