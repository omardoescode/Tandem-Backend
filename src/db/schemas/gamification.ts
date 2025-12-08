import {
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { TandemSessionTable } from "./session";
import { sql } from "drizzle-orm";

export const UserStatsTable = pgTable("user_stats", {
  userId: text("user_id")
    .references(() => user.id, { onDelete: "cascade" })
    .notNull()
    .primaryKey(),
  level: integer("level").notNull(),
  currentXP: integer("current_xp").notNull(),
  tillNextLevelXP: integer("till_next_level_xp").notNull(),
  totalAchievements: integer("total_achievements").notNull().default(0),
  totalCoins: integer("total_coins").notNull().default(0),
  currentCoins: integer("current_coins").notNull().default(0),
  totalFocusMinutes: integer("total_focus_minutes").notNull().default(0),
  totalBreakMinutes: integer("total_break_minutes").notNull().default(0),
  totalSessionCount: integer("total_session_count").notNull().default(0),
  disConnectedSessionCount: integer("disconnected_session_count")
    .notNull()
    .default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const GamificationEventTypeEnum = pgEnum("gamification_event_type", [
  "ended session",
  "purchase item",
  "achieved",
]);

export const GamificationHistoryTable = pgTable("gamification_history", {
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  type: GamificationEventTypeEnum(),
  added_coins: integer(),

  // ended session
  added_xp: integer(),
  sessionId: uuid("session_id").references(() => TandemSessionTable.sessionId, {
    onDelete: "cascade",
  }),

  // purchase item
  purchased: uuid("purchase_id").references(() => PurchaseTable.purchaseId, {
    onDelete: "cascade",
  }),

  // achieved
  achieved: varchar("achievement_id").references(
    () => AchievementTable.achievementId,
    { onDelete: "cascade" },
  ),
});

export const StoreItemTable = pgTable("store_item", {
  itemId: varchar("item_id", { length: 255 }).primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  price: integer("price").notNull(),
});

export const PurchaseTable = pgTable("purchase", {
  purchaseId: uuid("purchase_id")
    .default(sql`uuidv7()`)
    .primaryKey(),
  userId: text("user_id")
    .references(() => user.id, { onDelete: "cascade" })
    .notNull(),
  itemId: varchar("item_id")
    .references(() => StoreItemTable.itemId, { onDelete: "cascade" })
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const AchievementTable = pgTable("achievement", {
  achievementId: varchar("achievement_id", { length: 255 }).primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
});

export const UserAchievementTable = pgTable(
  "user_achievement",
  {
    userId: text("userId")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    achievementId: varchar("achievement_id")
      .references(() => AchievementTable.achievementId, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.achievementId] })],
);
