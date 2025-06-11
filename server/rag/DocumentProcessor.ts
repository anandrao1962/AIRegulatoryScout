import OpenAI from "openai";
import { Document, InsertDocument } from '@shared/schema';
import { storage } from '../storage';
import { vectorStore } from './VectorStore';

export class DocumentProcessor {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
    });
  }

  async processDocument(documentData: Omit<InsertDocument, 'embedding'>): Promise<Document> {
    try {
      // Check if content needs chunking (approximate token count)
      const approximateTokens = documentData.content.length / 4; // rough estimate: 4 chars per token
      
      if (approximateTokens > 7000) { // Leave buffer for safety
        // Split into chunks and process each
        const chunks = this.chunkText(documentData.content, 6000); // Conservative chunk size
        const documents = [];
        
        for (let i = 0; i < chunks.length; i++) {
          const chunkData = {
            ...documentData,
            title: `${documentData.title} (Part ${i + 1}/${chunks.length})`,
            content: chunks[i],
          };
          
          const embedding = await this.generateEmbedding(chunkData.content);
          
          const document = await storage.createDocument({
            ...chunkData,
            embedding: JSON.stringify(embedding),
          });

          await vectorStore.addDocument(document);
          documents.push(document);
        }
        
        console.log(`Processed document in ${chunks.length} chunks: ${documentData.title} (${documentData.jurisdiction})`);
        // Return the first chunk as the primary document
        return documents[0];
      } else {
        // Process normally for smaller documents
        const embedding = await this.generateEmbedding(documentData.content);
        
        const document = await storage.createDocument({
          ...documentData,
          embedding: JSON.stringify(embedding),
        });

        await vectorStore.addDocument(document);
        
        console.log(`Processed document: ${document.title} (${document.jurisdiction})`);
        return document;
      }
    } catch (error) {
      console.error('Error processing document:', error);
      throw error;
    }
  }

  async processMultipleDocuments(documents: Array<Omit<InsertDocument, 'embedding'>>): Promise<Document[]> {
    const results = await Promise.allSettled(
      documents.map(doc => this.processDocument(doc))
    );

    const successful = results
      .filter((result): result is PromiseFulfilledResult<Document> => result.status === 'fulfilled')
      .map(result => result.value);

    const failed = results.filter(result => result.status === 'rejected');
    
    if (failed.length > 0) {
      console.warn(`Failed to process ${failed.length} documents`);
      failed.forEach((failure, index) => {
        console.error(`Document ${index} failed:`, failure.reason);
      });
    }

    return successful;
  }

  private chunkText(text: string, maxChars: number): string[] {
    const chunks: string[] = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    let currentChunk = '';
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (!trimmedSentence) continue;
      
      // If adding this sentence would exceed the limit, save current chunk and start new one
      if (currentChunk.length + trimmedSentence.length + 1 > maxChars && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = trimmedSentence + '.';
      } else {
        currentChunk += (currentChunk ? ' ' : '') + trimmedSentence + '.';
      }
    }
    
    // Add the last chunk if it has content
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }
    
    // If no chunks were created (edge case), split by character count
    if (chunks.length === 0) {
      for (let i = 0; i < text.length; i += maxChars) {
        chunks.push(text.slice(i, i + maxChars));
      }
    }
    
    return chunks;
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: "text-embedding-3-large",
        input: text,
      });

      return response.data[0].embedding;
    } catch (error: any) {
      console.error('Error generating embedding:', error);
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  async initializeVectorStore(): Promise<void> {
    console.log('Initializing vector store with existing documents...');
    
    // Initialize in background to prevent startup delays
    setImmediate(async () => {
      try {
        const allDocuments = await this.getAllDocuments();
        console.log(`Loading ${allDocuments.length} documents into vector store...`);
        
        // Process in smaller batches to reduce memory usage
        const batchSize = 50;
        for (let i = 0; i < allDocuments.length; i += batchSize) {
          const batch = allDocuments.slice(i, i + batchSize);
          await Promise.all(batch.map(doc => vectorStore.addDocument(doc)));
          
          // Force garbage collection between batches
          if (global.gc) {
            global.gc();
          }
          
          // Longer delay between batches to prevent memory buildup
          if (i + batchSize < allDocuments.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        
        console.log(`Vector store initialized with ${allDocuments.length} documents`);
      } catch (error) {
        console.error('Error initializing vector store:', error);
      }
    });
    
    console.log('Vector store initialization started in background');
  }

  private async getAllDocuments(): Promise<Document[]> {
    // Get all documents from all jurisdictions
    const jurisdictions = ['us-federal', 'california', 'colorado', 'eu', 'uk', 'germany'];
    const allDocs: Document[] = [];

    for (const jurisdiction of jurisdictions) {
      const docs = await storage.getDocumentsByJurisdiction(jurisdiction);
      allDocs.push(...docs);
    }

    return allDocs;
  }
}

export const documentProcessor = new DocumentProcessor();
