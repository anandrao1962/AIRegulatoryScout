import { Document } from '@shared/schema';

export interface VectorSearchResult {
  document: Document;
  similarity: number;
}

export class VectorStore {
  private documents: Map<number, Document> = new Map();
  private embeddings: Map<number, number[]> = new Map();

  async addDocument(document: Document): Promise<void> {
    this.documents.set(document.id, document);
    
    if (document.embedding) {
      try {
        const embedding = JSON.parse(document.embedding);
        this.embeddings.set(document.id, embedding);
      } catch (error) {
        console.error(`Failed to parse embedding for document ${document.id}:`, error);
      }
    }
  }

  async searchSimilar(queryEmbedding: number[], limit = 10, jurisdictions?: string[]): Promise<VectorSearchResult[]> {
    const results: VectorSearchResult[] = [];

    for (const [docId, docEmbedding] of this.embeddings) {
      const document = this.documents.get(docId);
      if (!document) continue;

      // Filter by jurisdiction if specified
      if (jurisdictions && jurisdictions.length > 0 && !jurisdictions.includes(document.jurisdiction)) {
        continue;
      }

      const similarity = this.cosineSimilarity(queryEmbedding, docEmbedding);
      results.push({ document, similarity });
    }

    // Sort by similarity and return top results
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  async getDocumentCount(jurisdiction?: string): Promise<number> {
    if (!jurisdiction) {
      return this.documents.size;
    }

    let count = 0;
    for (const document of this.documents.values()) {
      if (document.jurisdiction === jurisdiction) {
        count++;
      }
    }
    return count;
  }

  async getEmbeddingCount(jurisdiction?: string): Promise<number> {
    if (!jurisdiction) {
      return this.embeddings.size;
    }

    let count = 0;
    for (const [docId] of this.embeddings) {
      const document = this.documents.get(docId);
      if (document && document.jurisdiction === jurisdiction) {
        count++;
      }
    }
    return count;
  }
}

export const vectorStore = new VectorStore();
