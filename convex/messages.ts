import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const sendMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    senderId: v.id("users"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("messages", {
      ...args,
      isDeleted: false,
    });
    await ctx.db.patch(args.conversationId, {
      lastMessageTime: Date.now(),
      lastMessageText: args.text,
    });
    return id;
  },
});

export const getMessages = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const msgs = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();
    return await Promise.all(
      msgs.map(async (msg) => {
        const sender = await ctx.db.get(msg.senderId);
        return { ...msg, sender };
      })
    );
  },
});

export const deleteMessage = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, { isDeleted: true, text: "This message was deleted" });
  },
});

export const setTyping = mutation({
  args: { conversationId: v.id("conversations"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("typingIndicators")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { lastTyped: Date.now() });
    } else {
      await ctx.db.insert("typingIndicators", { ...args, lastTyped: Date.now() });
    }
  },
});

export const getTypingUsers = query({
  args: { conversationId: v.id("conversations"), currentUserId: v.id("users") },
  handler: async (ctx, args) => {
    const twoSecondsAgo = Date.now() - 2000;
    const typing = await ctx.db
      .query("typingIndicators")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .filter((q) =>
        q.and(
          q.neq(q.field("userId"), args.currentUserId),
          q.gt(q.field("lastTyped"), twoSecondsAgo)
        )
      )
      .collect();
    return await Promise.all(typing.map(async (t) => ctx.db.get(t.userId)));
  },
});

export const markAsRead = mutation({
  args: { conversationId: v.id("conversations"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("readReceipts")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", args.conversationId).eq("userId", args.userId)
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { lastReadTime: Date.now() });
    } else {
      await ctx.db.insert("readReceipts", { ...args, lastReadTime: Date.now() });
    }
  },
});

export const getUnreadCount = query({
  args: { conversationId: v.id("conversations"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const receipt = await ctx.db
      .query("readReceipts")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", args.conversationId).eq("userId", args.userId)
      )
      .first();
    const lastRead = receipt?.lastReadTime ?? 0;
    const allMsgs = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();
    return allMsgs.filter(
      (m) => m._creationTime > lastRead && m.senderId !== args.userId
    ).length;
  },
});