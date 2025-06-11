import { 
  users, conversations, messages, documents, agentSessions,
  type User, type InsertUser,
  type Conversation, type InsertConversation,
  type Message, type InsertMessage,
  type Document, type InsertDocument,
  type AgentSession, type InsertAgentSession
} from "@shared/schema";
import { db } from './db';
import { eq, sql, ilike } from 'drizzle-orm';

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Conversation operations
  getConversation(id: number): Promise<Conversation | undefined>;
  getConversationsByUser(userId: number): Promise<Conversation[]>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;

  // Message operations
  getMessage(id: number): Promise<Message | undefined>;
  getMessagesByConversation(conversationId: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;

  // Document operations
  getDocument(id: number): Promise<Document | undefined>;
  getDocumentsByJurisdiction(jurisdiction: string): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  deleteDocument(id: number): Promise<void>;
  deleteDocumentsByJurisdiction(jurisdiction: string): Promise<void>;
  searchDocuments(query: string, jurisdictions: string[], limit?: number): Promise<Document[]>;

  // Agent session operations
  getAgentSession(agentId: string): Promise<AgentSession | undefined>;
  getAllAgentSessions(): Promise<AgentSession[]>;
  createOrUpdateAgentSession(session: InsertAgentSession): Promise<AgentSession>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User> = new Map();
  private conversations: Map<number, Conversation> = new Map();
  private messages: Map<number, Message> = new Map();
  private documents: Map<number, Document> = new Map();
  private agentSessions: Map<string, AgentSession> = new Map();
  
  private currentUserId = 1;
  private currentConversationId = 1;
  private currentMessageId = 1;
  private currentDocumentId = 1;

  constructor() {
    this.initializeSampleData();
  }

  private initializeSampleData() {
    // Initialize agent sessions with zero documents
    const agents = [
      { id: 'us-federal', name: 'US Federal', docs: 0, embeddings: 0 },
      { id: 'california', name: 'California', docs: 0, embeddings: 0 },
      { id: 'colorado', name: 'Colorado', docs: 0, embeddings: 0 },
      { id: 'eu', name: 'European Union', docs: 0, embeddings: 0 },
      { id: 'uk', name: 'United Kingdom', docs: 0, embeddings: 0 },
    ];

    agents.forEach(agent => {
      this.agentSessions.set(agent.id, {
        id: 0,
        agentId: agent.id,
        status: 'idle',
        lastActive: new Date(),
        documentsCount: agent.docs,
        embeddingsCount: agent.embeddings,
      });
    });

    // No sample documents - start with empty document store
    console.log('Document store initialized empty - ready for custom document loading');
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Conversation operations
  async getConversation(id: number): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }

  async getConversationsByUser(userId: number): Promise<Conversation[]> {
    return Array.from(this.conversations.values()).filter(conv => conv.userId === userId);
  }

  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    const id = this.currentConversationId++;
    const conversation: Conversation = { 
      ...insertConversation, 
      id, 
      createdAt: new Date(),
      userId: insertConversation.userId ?? null
    };
    this.conversations.set(id, conversation);
    return conversation;
  }

  // Message operations
  async getMessage(id: number): Promise<Message | undefined> {
    return this.messages.get(id);
  }

  async getMessagesByConversation(conversationId: number): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(msg => msg.conversationId === conversationId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = this.currentMessageId++;
    const message: Message = { 
      ...insertMessage, 
      id, 
      createdAt: new Date(),
      agentId: insertMessage.agentId ?? null,
      metadata: insertMessage.metadata ?? null
    };
    this.messages.set(id, message);
    return message;
  }

  // Document operations
  async getDocument(id: number): Promise<Document | undefined> {
    return this.documents.get(id);
  }

  async getDocumentsByJurisdiction(jurisdiction: string): Promise<Document[]> {
    return Array.from(this.documents.values()).filter(doc => 
      doc.jurisdiction.toLowerCase() === jurisdiction.toLowerCase()
    );
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const id = this.currentDocumentId++;
    const document: Document = { 
      ...insertDocument, 
      id, 
      createdAt: new Date(),
      sourceUrl: insertDocument.sourceUrl ?? null,
      embedding: insertDocument.embedding ?? null,
      originalDocumentId: null,
      chunkIndex: null,
      isChunk: false
    };
    this.documents.set(id, document);
    return document;
  }

  async deleteDocument(id: number): Promise<void> {
    this.documents.delete(id);
  }

  async deleteDocumentsByJurisdiction(jurisdiction: string): Promise<void> {
    const documentsToDelete: number[] = [];
    const entries = Array.from(this.documents.entries());
    for (const [id, doc] of entries) {
      if (doc.jurisdiction.toLowerCase() === jurisdiction.toLowerCase()) {
        documentsToDelete.push(id);
      }
    }
    documentsToDelete.forEach(id => this.documents.delete(id));
  }

  async searchDocuments(query: string, jurisdictions: string[], limit = 10): Promise<Document[]> {
    const queryLower = query.toLowerCase();
    const allDocs = Array.from(this.documents.values());
    
    const filteredDocs = allDocs.filter(doc => 
      jurisdictions.length === 0 || jurisdictions.includes(doc.jurisdiction)
    );

    const scoredDocs = filteredDocs.map(doc => ({
      doc,
      score: this.calculateRelevanceScore(doc, queryLower)
    }));

    return scoredDocs
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.doc);
  }

  private calculateRelevanceScore(doc: Document, query: string): number {
    const titleScore = doc.title.toLowerCase().includes(query) ? 2 : 0;
    const contentScore = doc.content.toLowerCase().includes(query) ? 1 : 0;
    return titleScore + contentScore;
  }

  // Agent session operations
  async getAgentSession(agentId: string): Promise<AgentSession | undefined> {
    return this.agentSessions.get(agentId);
  }

  async getAllAgentSessions(): Promise<AgentSession[]> {
    return Array.from(this.agentSessions.values());
  }

  async createOrUpdateAgentSession(insertSession: InsertAgentSession): Promise<AgentSession> {
    const existing = this.agentSessions.get(insertSession.agentId);
    const session: AgentSession = {
      id: existing?.id || 0,
      ...insertSession,
      lastActive: new Date(),
      documentsCount: insertSession.documentsCount ?? null,
      embeddingsCount: insertSession.embeddingsCount ?? null,
    };
    this.agentSessions.set(insertSession.agentId, session);
    return session;
  }
}

// DatabaseStorage implementation for persistent document storage
export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getConversation(id: number): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conversation || undefined;
  }

  async getConversationsByUser(userId: number): Promise<Conversation[]> {
    return await db.select().from(conversations).where(eq(conversations.userId, userId));
  }

  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    const [conversation] = await db
      .insert(conversations)
      .values(insertConversation)
      .returning();
    return conversation;
  }

  async getMessage(id: number): Promise<Message | undefined> {
    const [message] = await db.select().from(messages).where(eq(messages.id, id));
    return message || undefined;
  }

  async getMessagesByConversation(conversationId: number): Promise<Message[]> {
    return await db.select().from(messages).where(eq(messages.conversationId, conversationId));
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const [message] = await db
      .insert(messages)
      .values(insertMessage)
      .returning();
    return message;
  }

  async getDocument(id: number): Promise<Document | undefined> {
    const [document] = await db.select().from(documents).where(eq(documents.id, id));
    return document || undefined;
  }

  async getDocumentsByJurisdiction(jurisdiction: string): Promise<Document[]> {
    return await db.select().from(documents).where(
      ilike(documents.jurisdiction, jurisdiction)
    );
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const [document] = await db
      .insert(documents)
      .values(insertDocument)
      .returning();
    return document;
  }

  async deleteDocument(id: number): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }

  async deleteDocumentsByJurisdiction(jurisdiction: string): Promise<void> {
    await db.delete(documents).where(
      ilike(documents.jurisdiction, jurisdiction)
    );
  }

  async searchDocuments(query: string, jurisdictions: string[], limit = 10): Promise<Document[]> {
    const queryLower = query.toLowerCase();
    
    // Get all documents first, then filter in memory for simplicity
    const allDocs = await db.select().from(documents);
    
    const filteredDocs = jurisdictions.length > 0 
      ? allDocs.filter(doc => jurisdictions.includes(doc.jurisdiction))
      : allDocs;
    
    const scoredDocs = filteredDocs.map(doc => ({
      doc,
      score: this.calculateRelevanceScore(doc, queryLower)
    }));

    return scoredDocs
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.doc);
  }

  private calculateRelevanceScore(doc: Document, query: string): number {
    const titleScore = doc.title.toLowerCase().includes(query) ? 2 : 0;
    const contentScore = doc.content.toLowerCase().includes(query) ? 1 : 0;
    return titleScore + contentScore;
  }

  async getAgentSession(agentId: string): Promise<AgentSession | undefined> {
    const [session] = await db.select().from(agentSessions).where(eq(agentSessions.agentId, agentId));
    return session || undefined;
  }

  async getAllAgentSessions(): Promise<AgentSession[]> {
    return await db.select().from(agentSessions);
  }

  async createOrUpdateAgentSession(insertSession: InsertAgentSession): Promise<AgentSession> {
    const existing = await this.getAgentSession(insertSession.agentId);
    
    if (existing) {
      const [updated] = await db
        .update(agentSessions)
        .set({ 
          ...insertSession, 
          lastActive: new Date() 
        })
        .where(eq(agentSessions.agentId, insertSession.agentId))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(agentSessions)
        .values({ 
          ...insertSession, 
          lastActive: new Date() 
        })
        .returning();
      return created;
    }
  }
}

export const storage = new DatabaseStorage();
