"use client";
import { useUser, UserButton } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState, useEffect, useRef } from "react";
import { Id } from "../../convex/_generated/dataModel";

function formatTime(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString([], { month: "short", day: "numeric" }) + ", " +
      d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
}

export default function Home() {
  const { user } = useUser();
  const [search, setSearch] = useState("");
  const [selectedConvoId, setSelectedConvoId] = useState<Id<"conversations"> | null>(null);
  const [messageText, setMessageText] = useState("");
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [userScrolled, setUserScrolled] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const convexUser = useQuery(api.users.getUserByClerkId, user ? { clerkId: user.id } : "skip");
  const allUsers = useQuery(api.users.getAllUsers, user ? { currentClerkId: user.id } : "skip");
  const conversations = useQuery(api.conversations.getUserConversations,
    convexUser ? { userId: convexUser._id } : "skip");
  const messages = useQuery(api.messages.getMessages,
    selectedConvoId ? { conversationId: selectedConvoId } : "skip");
  const typingUsers = useQuery(api.messages.getTypingUsers,
    selectedConvoId && convexUser
      ? { conversationId: selectedConvoId, currentUserId: convexUser._id }
      : "skip");

  const getOrCreate = useMutation(api.conversations.getOrCreateConversation);
  const sendMessage = useMutation(api.messages.sendMessage);
  const deleteMessage = useMutation(api.messages.deleteMessage);
  const setTyping = useMutation(api.messages.setTyping);
  const markAsRead = useMutation(api.messages.markAsRead);
  const upsertUser = useMutation(api.users.upsertUser);
  const setOnlineStatus = useMutation(api.users.setOnlineStatus);

  // Sync user to Convex
  useEffect(() => {
  if (!user) return;
  const sync = async () => {
    let retries = 5;
    while (retries > 0) {
      try {
        await upsertUser({
          clerkId: user.id,
          name: user.fullName ?? user.username ?? "Anonymous",
          email: user.emailAddresses[0]?.emailAddress ?? "",
          imageUrl: user.imageUrl,
        });
        await setOnlineStatus({ clerkId: user.id, isOnline: true });
        console.log("User synced!");
        break;
      } catch (err) {
        retries--;
        console.log("Retrying...", retries);
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  };
  sync();
  const handleOffline = () => setOnlineStatus({ clerkId: user.id, isOnline: false });
  window.addEventListener("beforeunload", handleOffline);
  return () => window.removeEventListener("beforeunload", handleOffline);
}, [user, upsertUser, setOnlineStatus]);

  // Auto scroll
  useEffect(() => {
    if (!userScrolled) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Mark as read
  useEffect(() => {
    if (selectedConvoId && convexUser) {
      markAsRead({ conversationId: selectedConvoId, userId: convexUser._id });
    }
  }, [selectedConvoId, messages?.length]);

  const handleSelectUser = async (otherUser: any) => {
    if (!convexUser) return;
    const convoId = await getOrCreate({ currentUserId: convexUser._id, otherUserId: otherUser._id });
    setSelectedConvoId(convoId);
    setShowMobileChat(true);
    setUserScrolled(false);
  };

  const handleSend = async () => {
    if (!messageText.trim() || !selectedConvoId || !convexUser) return;
    await sendMessage({ conversationId: selectedConvoId, senderId: convexUser._id, text: messageText });
    setMessageText("");
    setUserScrolled(false);
  };

  const handleTyping = (val: string) => {
    setMessageText(val);
    if (selectedConvoId && convexUser) {
      setTyping({ conversationId: selectedConvoId, userId: convexUser._id });
    }
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    setUserScrolled(!atBottom);
  };

  const selectedConvo = conversations?.find((c) => c._id === selectedConvoId);
  const filteredUsers = allUsers?.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase())
  );

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!convexUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Setting up your account...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className={`w-full md:w-80 bg-white border-r flex flex-col ${showMobileChat ? "hidden md:flex" : "flex"}`}>
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between bg-indigo-600 text-white">
          <h1 className="text-xl font-bold">💬 ChatApp</h1>
          <UserButton afterSignOutUrl="/sign-in" />
        </div>

        {/* Search */}
        <div className="p-3 border-b">
          <input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        {/* User list when searching */}
        {search && (
          <div className="overflow-y-auto max-h-48 border-b">
            {filteredUsers?.length === 0 ? (
              <p className="text-center text-gray-500 py-4 text-sm">No users found</p>
            ) : (
              filteredUsers?.map((u) => (
                <div
                  key={u._id}
                  onClick={() => handleSelectUser(u)}
                  className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer"
                >
                  <div className="relative">
                    <img src={u.imageUrl} className="w-9 h-9 rounded-full" />
                    <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${u.isOnline ? "bg-green-500" : "bg-gray-400"}`} />
                  </div>
                  <span className="text-sm font-medium">{u.name}</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto">
          {conversations?.length === 0 && !search && (
            <div className="text-center text-gray-400 py-10 px-4">
              <p className="text-4xl mb-2">💬</p>
              <p className="text-sm">No conversations yet. Search for a user to start chatting!</p>
            </div>
          )}
          {conversations?.map((convo) => (
            <ConversationItem
              key={convo._id}
              convo={convo}
              currentUserId={convexUser?._id}
              isActive={convo._id === selectedConvoId}
              onClick={() => {
                setSelectedConvoId(convo._id);
                setShowMobileChat(true);
                setUserScrolled(false);
              }}
            />
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col ${!showMobileChat ? "hidden md:flex" : "flex"}`}>
        {!selectedConvoId ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <p className="text-5xl mb-3">👈</p>
              <p>Select a conversation or search for a user</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b bg-white flex items-center gap-3 shadow-sm">
              <button
                className="md:hidden text-indigo-600 font-bold mr-2"
                onClick={() => setShowMobileChat(false)}
              >← Back</button>
              {selectedConvo?.otherUser && (
                <>
                  <div className="relative">
                    <img src={selectedConvo.otherUser.imageUrl} className="w-10 h-10 rounded-full" />
                    <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${selectedConvo.otherUser.isOnline ? "bg-green-500" : "bg-gray-400"}`} />
                  </div>
                  <div>
                    <p className="font-semibold">{selectedConvo.otherUser.name}</p>
                    <p className="text-xs text-gray-500">{selectedConvo.otherUser.isOnline ? "Online" : "Offline"}</p>
                  </div>
                </>
              )}
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50"
            >
              {messages?.length === 0 && (
                <div className="text-center text-gray-400 py-10">
                  <p className="text-4xl mb-2">👋</p>
                  <p>No messages yet. Say hello!</p>
                </div>
          )}
              {messages?.map((msg) => {
                const isMe = msg.senderId === convexUser?._id;
                return (
                  <div key={msg._id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div className="max-w-xs lg:max-w-md">
                      <div className={`px-4 py-2 rounded-2xl text-sm relative group ${
                        isMe ? "bg-indigo-500 text-white" : "bg-white text-gray-800 shadow"
                      } ${msg.isDeleted ? "opacity-60 italic" : ""}`}>
                        {msg.text}
                        {isMe && !msg.isDeleted && (
                          <button
                            onClick={() => deleteMessage({ messageId: msg._id })}
                            className="absolute -top-5 right-0 hidden group-hover:block text-xs text-red-400 hover:text-red-600"
                          >delete</button>
                        )}
                      </div>
                      <p className={`text-xs text-gray-400 mt-1 ${isMe ? "text-right" : "text-left"}`}>
                        {formatTime(msg._creationTime)}
                      </p>
                    </div>
                  </div>
                );
              })}

              {/* Typing Indicator */}
              {typingUsers && typingUsers.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  <span>{typingUsers[0]?.name} is typing...</span>
                </div>
              )}

              {userScrolled && (
                <button
                  onClick={() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); setUserScrolled(false); }}
                  className="fixed bottom-24 right-6 bg-indigo-500 text-white px-3 py-1.5 rounded-full shadow text-sm"
                >↓ New messages</button>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t bg-white flex gap-2">
              <input
                value={messageText}
                onChange={(e) => handleTyping(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Type a message..."
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button
                onClick={handleSend}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >Send</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ConversationItem({ convo, currentUserId, isActive, onClick }: any) {
  const unreadCount = useQuery(api.messages.getUnreadCount,
    currentUserId ? { conversationId: convo._id, userId: currentUserId } : "skip");

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 border-b ${isActive ? "bg-indigo-50" : ""}`}
    >
      <div className="relative">
        <img src={convo.otherUser?.imageUrl} className="w-10 h-10 rounded-full" />
        <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${convo.otherUser?.isOnline ? "bg-green-500" : "bg-gray-400"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{convo.otherUser?.name}</p>
        <p className="text-xs text-gray-500 truncate">{convo.lastMessageText ?? "Start a conversation"}</p>
      </div>
      {unreadCount ? (
        <span className="bg-indigo-600 text-white text-xs px-1.5 py-0.5 rounded-full">{unreadCount}</span>
      ) : null}
    </div>
  );
}