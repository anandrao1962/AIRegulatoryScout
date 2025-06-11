import { QueryRequest, QueryResponse, AgentSession, Message, Conversation } from '../types/agents';

export class APIClient {
  private baseURL = '';

  async query(request: QueryRequest): Promise<QueryResponse> {
    const response = await fetch('/api/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || error.error || 'Query failed');
    }

    return response.json();
  }

  async getAgentSessions(): Promise<AgentSession[]> {
    const response = await fetch('/api/agents');
    
    if (!response.ok) {
      throw new Error('Failed to fetch agent sessions');
    }

    return response.json();
  }

  async getConversations(): Promise<Conversation[]> {
    const response = await fetch('/api/conversations');
    
    if (!response.ok) {
      throw new Error('Failed to fetch conversations');
    }

    return response.json();
  }

  async getConversationMessages(conversationId: number): Promise<Message[]> {
    const response = await fetch(`/api/conversations/${conversationId}/messages`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch conversation messages');
    }

    return response.json();
  }

  async healthCheck(): Promise<{ status: string; agents: string[]; timestamp: string }> {
    const response = await fetch('/api/health');
    
    if (!response.ok) {
      throw new Error('Health check failed');
    }

    return response.json();
  }

  async delete(url: string): Promise<any> {
    const response = await fetch(url, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || error.error || 'Delete failed');
    }

    return response.json();
  }
}

export const apiClient = new APIClient();
