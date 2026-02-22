import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getOrCreateConversation = mutation({
  args: { currentUserId: v.id("users"), otherUserId: v.id("users") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("conversations").collect();
    const found = existing.find(
      (c) =>
        c.participants.includes(args.currentUserId) &&
        c.participants.includes(args.otherUserId) &&
        c.participants.length === 2
    );
    if (found) return found._id;
    return await ctx.db.insert("conversations", {
      participants: [args.currentUserId, args.otherUserId],
      lastMessageTime: Date.now(),
    });
  },
});

export const getUserConversations = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const allConvos = await ctx.db.query("conversations").collect();
    const userConvos = allConvos.filter((c) => c.participants.includes(args.userId));
    const result = await Promise.all(
      userConvos.map(async (convo) => {
        const otherUserId = convo.participants.find((p) => p !== args.userId)!;
        const otherUser = await ctx.db.get(otherUserId);
        return { ...convo, otherUser };
      })
    );
    return result.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
  },
});