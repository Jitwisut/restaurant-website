import { beforeEach, describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import jwt from "@elysiajs/jwt";
import { randomUUID } from "crypto";
import { ReportRouter } from "../router/ReportRouter";
import { getTestDB } from "./setup";
import {
  authHeaders,
  ensureTestRestaurant,
  TEST_JWT_SECRET,
} from "./helpers/testUtils";

const db = getTestDB();
const REPORT_RESTAURANT_ID = 902;

const createTestApp = () =>
  new Elysia()
    .use(jwt({ name: "jwt", secret: TEST_JWT_SECRET }))
    .use(ReportRouter);

function todayBangkok() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

beforeEach(async () => {
  await ensureTestRestaurant(REPORT_RESTAURANT_ID, {
    slug: "report-restaurant",
  });
  await db.query("DELETE FROM order_items WHERE restaurant_id=$1", [
    REPORT_RESTAURANT_ID,
  ]);
  await db.query("DELETE FROM orders WHERE restaurant_id=$1", [
    REPORT_RESTAURANT_ID,
  ]);
  await db.query("DELETE FROM sessions WHERE restaurant_id=$1", [
    REPORT_RESTAURANT_ID,
  ]);
});

describe("Daily Closing Report", () => {
  test("counts paid sales and excludes refunded, voided, and unpaid orders", async () => {
    const app = createTestApp();
    const date = todayBangkok();
    const sessionId = randomUUID();
    const paidOrderId = `report-paid-${Date.now()}`;
    const unpaidOrderId = `report-unpaid-${Date.now()}`;
    const refundedOrderId = `report-refund-${Date.now()}`;
    const voidedOrderId = `report-void-${Date.now()}`;

    await db.query(
      `INSERT INTO sessions (session_id, table_number, opened_at, restaurant_id)
       VALUES ($1, 60, NOW(), $2)
       ON CONFLICT DO NOTHING`,
      [sessionId, REPORT_RESTAURANT_ID],
    );
    await db.query(
      `INSERT INTO orders
        (id, table_number, customer_session, status, restaurant_id, grand_total, payment_status, paid_at, refunded_at, voided_at)
       VALUES
        ($1, 60, $5, 'completed', $6, 100, 'paid', NOW(), NULL, NULL),
        ($2, 60, $5, 'served', $6, 70, 'unpaid', NULL, NULL, NULL),
        ($3, 60, $5, 'completed', $6, 50, 'refunded', NOW(), NOW(), NULL),
        ($4, 60, $5, 'completed', $6, 40, 'voided', NOW(), NULL, NOW())`,
      [
        paidOrderId,
        unpaidOrderId,
        refundedOrderId,
        voidedOrderId,
        sessionId,
        REPORT_RESTAURANT_ID,
      ],
    );
    await db.query(
      `INSERT INTO order_items (order_id, menu_item_name, quantity, price, restaurant_id)
       VALUES
        ($1, 'Report Dish', 1, 100, $3),
        ($2, 'Unpaid Dish', 1, 70, $3)`,
      [paidOrderId, unpaidOrderId, REPORT_RESTAURANT_ID],
    );

    const response = await app.handle(
      new Request(`http://localhost/reports/daily-closing?date=${date}`, {
        method: "GET",
        headers: authHeaders({
          role: "admin",
          restaurant_id: REPORT_RESTAURANT_ID,
        }),
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.report.summary.paidSales).toBe(100);
    expect(data.report.summary.unpaidPending).toBe(70);
    expect(data.report.summary.orderCount).toBeGreaterThanOrEqual(4);
    expect(data.report.topMenuItems.some((item: any) => item.name === "Report Dish")).toBe(true);
  });
});
