import { neon } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";

const emails: string[] = [];
const eventIds: string[] = [];

/** A unique throwaway address. Orders are deleted by these addresses, so parallel tests never touch each other's. */
export function newTestEmail(): string {
  const e = `buyer-${randomUUID().slice(0, 10)}@e2e.test`;
  emails.push(e);
  return e;
}

/** A unique webhook event id, remembered so only this test's records are removed afterwards. */
export function newEventId(): string {
  const id = `e2e-evt-${randomUUID()}`;
  eventIds.push(id);
  return id;
}

/** Remembers an address (e.g. a test customer's) whose orders should be removed after the test. */
export function trackEmail(email: string): string {
  emails.push(email.toLowerCase());
  return email;
}

export function sql() {
  return neon(process.env.DATABASE_URL!);
}

/** Deletes the orders (and webhook records) this worker's tests created. */
export async function cleanupOrders() {
  const mine = emails.splice(0);
  const db = sql();
  if (mine.length) await db.query('DELETE FROM "Order" WHERE "email" = ANY($1)', [mine]);
  const events = eventIds.splice(0);
  if (events.length)
    await db.query('DELETE FROM "PaymentEvent" WHERE "eventId" = ANY($1)', [events]);
}

export async function orderCountFor(email: string): Promise<number> {
  const r = await sql().query('SELECT count(*)::int AS n FROM "Order" WHERE "email" = $1', [email]);
  return r[0].n as number;
}
