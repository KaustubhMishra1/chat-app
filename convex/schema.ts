import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
    imageUrl: v.string(),
    isOnline: v.boolean(),
  }).index("by_clerk_id", ["clerkId"]),

  conversations: defineTable({
    participants: v.array(v.id("users")),
    lastMessageTime: v.number(),
    lastMessageText: v.optional(v.string()),
  }),

  messages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.id("users"),
    text: v.string(),
    isDeleted: v.optional(v.boolean()),
  }).index("by_conversation", ["conversationId"]),

  typingIndicators: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    lastTyped: v.number(),
  }).index("by_conversation", ["conversationId"]),

  readReceipts: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    lastReadTime: v.number(),
  }).index("by_conversation_user", ["conversationId", "userId"]),
});