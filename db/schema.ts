import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const records = sqliteTable("records", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  recordDate: text("record_date").notNull(),
  recordTime: text("record_time").notNull(),
  location: text("location").notNull().default(""),
  showLocation: integer("show_location", { mode: "boolean" }).notNull().default(true),
  visibility: text("visibility", { enum: ["private", "friends"] }).notNull().default("private"),
  food: text("food").notNull(),
  memo: text("memo").notNull().default(""),
  imageKey: text("image_key"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const friendships = sqliteTable("friendships", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  friendEmail: text("friend_email").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});
