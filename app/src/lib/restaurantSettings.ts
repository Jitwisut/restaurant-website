import { getDB } from "./connect";

const db = getDB();

const defaultBusinessHours = {
  monday: { open: "09:00", close: "22:00", closed: false },
  tuesday: { open: "09:00", close: "22:00", closed: false },
  wednesday: { open: "09:00", close: "22:00", closed: false },
  thursday: { open: "09:00", close: "22:00", closed: false },
  friday: { open: "09:00", close: "22:00", closed: false },
  saturday: { open: "09:00", close: "22:00", closed: false },
  sunday: { open: "09:00", close: "22:00", closed: false },
};

export function buildDefaultSettings(restaurant: any = {}) {
  return {
    profile: {
      name: restaurant.name || "",
      slug: restaurant.slug || "",
      logoDataUrl: "",
      contactEmail: "",
      phone: "",
      address: "",
      timezone: "Asia/Bangkok",
    },
    business_hours: defaultBusinessHours,
    account_security: {
      sessionTimeoutMinutes: 720,
      requireStrongPasswords: true,
      allowEmailLogin: true,
    },
    team_settings: {
      ownerCanManageBilling: true,
      adminCanManageMenu: true,
      adminCanManageTables: true,
      kitchenCanAccessOrdersOnly: true,
      staffCanAccessTables: true,
    },
    order_settings: {
      serviceChargePercent: 0,
      taxPercent: 0,
      discountEnabled: true,
      promptPayId: "",
      promptPayType: "phone",
      promptPayAccountName: "",
      bankName: "",
      bankAccountNumber: "",
      paymentMethods: {
        cash: true,
        bankTransfer: true,
        qrPromptPay: false,
        card: false,
      },
    },
    table_qr_settings: {
      qrTheme: "standard",
      customerWelcomeMessage: "Welcome. Scan, order, and relax.",
      autoCloseSessionMinutes: 180,
      enforceBusinessHours: false,
      requireStaffToCloseTable: true,
    },
    menu_settings: {
      categoryDefaults: ["appetizer", "main", "dessert", "drink"],
      hideUnavailableFromQr: true,
      placeholderImageUrl: "",
    },
    notification_settings: {
      callStaffSound: true,
      orderAlertSound: true,
      kitchenAlertSound: true,
      browserNotifications: false,
    },
    danger_zone: {
      temporaryClosed: false,
      archiveRequested: false,
      exportRequestedAt: null,
    },
  };
}

export async function ensureRestaurantSettingsSchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS restaurant_settings (
      restaurant_id INTEGER PRIMARY KEY REFERENCES restaurants(id) ON DELETE CASCADE,
      profile JSONB NOT NULL DEFAULT '{}'::jsonb,
      business_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
      account_security JSONB NOT NULL DEFAULT '{}'::jsonb,
      team_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      order_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      table_qr_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      menu_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      notification_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      danger_zone JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function mergeSettings(restaurant: any, row: any = {}) {
  const defaults = buildDefaultSettings(restaurant);
  return {
    profile: { ...defaults.profile, ...(row.profile || {}) },
    business_hours: {
      ...defaults.business_hours,
      ...(row.business_hours || {}),
    },
    account_security: {
      ...defaults.account_security,
      ...(row.account_security || {}),
    },
    team_settings: {
      ...defaults.team_settings,
      ...(row.team_settings || {}),
    },
    order_settings: {
      ...defaults.order_settings,
      ...(row.order_settings || {}),
      paymentMethods: {
        ...defaults.order_settings.paymentMethods,
        ...(row.order_settings?.paymentMethods || {}),
      },
    },
    table_qr_settings: {
      ...defaults.table_qr_settings,
      ...(row.table_qr_settings || {}),
    },
    menu_settings: {
      ...defaults.menu_settings,
      ...(row.menu_settings || {}),
    },
    notification_settings: {
      ...defaults.notification_settings,
      ...(row.notification_settings || {}),
    },
    danger_zone: {
      ...defaults.danger_zone,
      ...(row.danger_zone || {}),
    },
  };
}

export async function getRestaurantSettings(restaurantId: number) {
  await ensureRestaurantSettingsSchema();
  const restaurantResult = await db.query(
    "SELECT id, name, slug, status, plan FROM restaurants WHERE id=$1",
    [restaurantId],
  );
  if (restaurantResult.rowCount === 0) return null;

  const restaurant = restaurantResult.rows[0];
  const settingsResult = await db.query(
    "SELECT * FROM restaurant_settings WHERE restaurant_id=$1",
    [restaurantId],
  );

  return {
    restaurant,
    settings: mergeSettings(restaurant, settingsResult.rows[0] || {}),
  };
}

export async function updateRestaurantSettings(
  restaurantId: number,
  settings: Record<string, any>,
) {
  await ensureRestaurantSettingsSchema();
  const current = await getRestaurantSettings(restaurantId);
  if (!current) return null;

  const merged = mergeSettings(current.restaurant, settings);

  await db.query(
    `INSERT INTO restaurant_settings (
       restaurant_id,
       profile,
       business_hours,
       account_security,
       team_settings,
       order_settings,
       table_qr_settings,
       menu_settings,
       notification_settings,
       danger_zone,
       updated_at
     )
     VALUES ($1,$2::jsonb,$3::jsonb,$4::jsonb,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,NOW())
     ON CONFLICT (restaurant_id) DO UPDATE
       SET profile = EXCLUDED.profile,
           business_hours = EXCLUDED.business_hours,
           account_security = EXCLUDED.account_security,
           team_settings = EXCLUDED.team_settings,
           order_settings = EXCLUDED.order_settings,
           table_qr_settings = EXCLUDED.table_qr_settings,
           menu_settings = EXCLUDED.menu_settings,
           notification_settings = EXCLUDED.notification_settings,
           danger_zone = EXCLUDED.danger_zone,
           updated_at = NOW()`,
    [
      restaurantId,
      JSON.stringify(merged.profile),
      JSON.stringify(merged.business_hours),
      JSON.stringify(merged.account_security),
      JSON.stringify(merged.team_settings),
      JSON.stringify(merged.order_settings),
      JSON.stringify(merged.table_qr_settings),
      JSON.stringify(merged.menu_settings),
      JSON.stringify(merged.notification_settings),
      JSON.stringify(merged.danger_zone),
    ],
  );

  const updated = await getRestaurantSettings(restaurantId);
  return updated;
}

function timeToMinutes(value: unknown) {
  if (typeof value !== "string") return null;
  const [hour, minute] = value.split(":").map((part) => Number(part));
  if (
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }
  return hour * 60 + minute;
}

function getLocalParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    dayKey: String(map.weekday || "").toLowerCase(),
    minutes:
      Number(map.hour || 0) * 60 + Number(map.minute || 0),
  };
}

export function isWithinBusinessHours(settings: any, now = new Date()) {
  if (!settings?.table_qr_settings?.enforceBusinessHours) {
    return { open: true, reason: null };
  }

  const timeZone = settings?.profile?.timezone || "Asia/Bangkok";
  const { dayKey, minutes } = getLocalParts(now, timeZone);
  const day = settings?.business_hours?.[dayKey];
  if (!day) return { open: true, reason: null };
  if (day.closed) return { open: false, reason: "Restaurant is closed today" };

  const open = timeToMinutes(day.open);
  const close = timeToMinutes(day.close);
  if (open === null || close === null) {
    return { open: true, reason: null };
  }

  const inRange =
    close <= open
      ? minutes >= open || minutes < close
      : minutes >= open && minutes < close;

  return {
    open: inRange,
    reason: inRange ? null : "Restaurant is outside business hours",
  };
}

export function isTableSessionExpired(session: any, settings: any, now = new Date()) {
  const configuredMinutes = Number(
    settings?.table_qr_settings?.autoCloseSessionMinutes,
  );
  if (
    !Number.isFinite(configuredMinutes) ||
    configuredMinutes <= 0 ||
    !session?.opened_at
  ) {
    return false;
  }

  const openedAt = new Date(session.opened_at).getTime();
  if (!Number.isFinite(openedAt)) return false;
  const ageMs = now.getTime() - openedAt;
  if (ageMs < 0) return false;

  // Prevent bad or legacy settings (for example 1 minute) from locking out
  // customers immediately after staff opens a table.
  const minutes = Math.max(configuredMinutes, 15);
  return now.getTime() - openedAt > minutes * 60 * 1000;
}
