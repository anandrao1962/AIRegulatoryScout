import { BaseAgent, AgentConfig, AgentResponse } from './BaseAgent';
import { storage } from '../storage';
import { Document } from '@shared/schema';

export interface JurisdictionAgentConfig extends AgentConfig {
  jurisdiction: string;
  specialization: string[];
}

export class JurisdictionAgent extends BaseAgent {
  private jurisdiction: string;
  private specialization: string[];

  constructor(config: JurisdictionAgentConfig) {
    super(config);
    this.jurisdiction = config.jurisdiction;
    this.specialization = config.specialization;
  }

  async processQuery(query: string, context?: any): Promise<AgentResponse> {
    try {
      console.log(`[${this.config.id}] Processing query: ${query.substring(0, 100)}...`);

      // Retrieve relevant documents
      const relevantDocs = await this.retrieveRelevantDocuments(query);
      
      // Generate response using RAG
      const response = await this.generateRAGResponse(query, relevantDocs);
      
      return {
        content: response,
        sources: relevantDocs.map(doc => ({
          title: doc.title,
          relevance: this.calculateRelevance(doc, query),
          tokens: Math.floor(doc.content.length / 4), // Rough token estimate
        })),
        metadata: {
          jurisdiction: this.jurisdiction,
          documentsUsed: relevantDocs.length,
          queryType: context?.queryType || 'general',
        }
      };
    } catch (error) {
      console.error(`[${this.config.id}] Error processing query:`, error);
      throw error;
    }
  }

  private async retrieveRelevantDocuments(query: string, limit = 5): Promise<Document[]> {
    // Get documents for this jurisdiction
    const jurisdictionDocs = await storage.getDocumentsByJurisdiction(this.jurisdiction);
    
    // Simple keyword-based relevance scoring
    const queryLower = query.toLowerCase();
    const scoredDocs = jurisdictionDocs.map(doc => ({
      doc,
      score: this.calculateRelevance(doc, query)
    }));

    // Sort by relevance and return top documents
    return scoredDocs
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.doc);
  }

  private calculateRelevance(doc: Document, query: string): number {
    const queryLower = query.toLowerCase();
    const titleLower = doc.title.toLowerCase();
    const contentLower = doc.content.toLowerCase();
    
    let score = 0;
    
    // Title matches get higher score
    if (titleLower.includes(queryLower)) score += 0.3;
    
    // Content matches
    const queryWords = queryLower.split(' ');
    queryWords.forEach(word => {
      if (word.length > 3) { // Skip short words
        if (titleLower.includes(word)) score += 0.2;
        if (contentLower.includes(word)) score += 0.1;
      }
    });
    
    // Specialization bonus
    this.specialization.forEach(spec => {
      if (contentLower.includes(spec.toLowerCase())) score += 0.15;
    });
    
    return Math.min(score, 1.0); // Cap at 1.0
  }

  private async generateRAGResponse(query: string, documents: Document[]): Promise<string> {
    const context = documents.map(doc => 
      `Document: ${doc.title}\nContent: ${doc.content}\n---`
    ).join('\n');

    const messages = [
      {
        role: 'system' as const,
        content: this.config.systemPrompt
      },
      {
        role: 'user' as const,
        content: `Based on the following documents from ${this.jurisdiction}, please answer the question: ${query}

Context Documents:
${context}

Please provide a comprehensive answer based on the provided documents. If the documents don't contain sufficient information to answer the question, please state this clearly.`
      }
    ];

    return await this.generateResponse(messages);
  }

  getJurisdiction(): string {
    return this.jurisdiction;
  }

  getSpecialization(): string[] {
    return this.specialization;
  }
}
