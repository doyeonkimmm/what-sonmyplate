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
  mealType: text("meal_type", { enum: ["delivery", "dining", "home"] }).notNull().default("home"),
  expense: integer("expense").notNull().default(0),
  memo: text("memo").notNull().default(""),
  imageKey: text("image_key"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const friendships = sqliteTable("friendships", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  friendEmail: text("friend_email").notNull(),
  favorite: integer("favorite", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const suggestions = sqliteTable("suggestions", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  ownerUsername: text("owner_username").notNull(),
  ownerNickname: text("owner_nickname").notNull(),
  content: text("content").notNull(),
  status: text("status", { enum: ["pending", "done"] }).notNull().default("pending"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});
