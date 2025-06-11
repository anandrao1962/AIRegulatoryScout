import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  role: text("role").notNull(), // 'user', 'assistant', 'system'
  content: text("content").notNull(),
  agentId: text("agent_id"), // which agent responded
  metadata: jsonb("metadata"), // for storing agent-specific data
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  jurisdiction: text("jurisdiction").notNull(),
  documentType: text("document_type").notNull(),
  sourceUrl: text("source_url"),
  embedding: text("embedding"), // JSON string of vector
  originalDocumentId: integer("original_document_id"), // References parent document for chunks
  chunkIndex: integer("chunk_index"), // Index of chunk within original document
  isChunk: boolean("is_chunk").default(false), // True if this is a chunk, false if original
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agentSessions = pgTable("agent_sessions", {
  id: serial("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  status: text("status").notNull(), // 'active', 'idle', 'updating'
  lastActive: timestamp("last_active").defaultNow().notNull(),
  documentsCount: integer("documents_count").default(0),
  embeddingsCount: integer("embeddings_count").default(0),
});

// Zod schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertConversationSchema = createInsertSchema(conversations).pick({
  userId: true,
  title: true,
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  conversationId: true,
  role: true,
  content: true,
  agentId: true,
  metadata: true,
});

export const insertDocumentSchema = createInsertSchema(documents).pick({
  title: true,
  content: true,
  jurisdiction: true,
  documentType: true,
  sourceUrl: true,
  embedding: true,
});

export const insertAgentSessionSchema = createInsertSchema(agentSessions).pick({
  agentId: true,
  status: true,
  documentsCount: true,
  embeddingsCount: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

export type AgentSession = typeof agentSessions.$inferSelect;
export type InsertAgentSession = z.infer<typeof insertAgentSessionSchema>;

// Query types
export const QueryRequestSchema = z.object({
  message: z.string().min(1),
  conversationId: z.number().optional(),
  jurisdictions: z.array(z.string()).optional(),
  queryType: z.enum(['general', 'compliance', 'comparison', 'legal']).default('general'),
  autoRoute: z.boolean().default(true),
});

export type QueryRequest = z.infer<typeof QueryRequestSchema>;

export const QueryResponseSchema = z.object({
  conversationId: z.number(),
  responses: z.array(z.object({
    agentId: z.string(),
    agentName: z.string(),
    content: z.string(),
    sources: z.array(z.object({
      title: z.string(),
      relevance: z.number(),
      tokens: z.number(),
    })),
  })),
  masterSummary: z.string().optional(),
  routingInfo: z.object({
    selectedJurisdictions: z.array(z.string()),
    autoRouted: z.boolean(),
    rationale: z.string(),
  }),
  suggestedQuestions: z.array(z.string()).optional(),
});

export type QueryResponse = z.infer<typeof QueryResponseSchema>;
