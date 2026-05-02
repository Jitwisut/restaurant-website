import { getDB } from "./connect";

const db = getDB();

export function getDefaultTableCount() {
  const count = Number(Bun.env.DEFAULT_TABLE_COUNT || 12);
  return Number.isFinite(count) && count > 0 ? Math.min(count, 99) : 12;
}

export async function ensureDefaultTablesForRestaurant(
  restaurantId: number | string,
  tableCount = getDefaultTableCount(),
) {
  const normalizedRestaurantId = Number(restaurantId);
  if (!Number.isFinite(normalizedRestaurantId) || normalizedRestaurantId <= 0) {
    return;
  }

  await db.query(
    `
      INSERT INTO tables (table_number, status, restaurant_id)
      SELECT table_number, 'available', $1
      FROM generate_series(1, $2::int) AS table_number
      ON CONFLICT (restaurant_id, table_number) DO NOTHING
    `,
    [normalizedRestaurantId, tableCount],
  );
}
