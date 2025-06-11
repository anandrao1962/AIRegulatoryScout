export interface AgentSession {
  id: number;
  agentId: string;
  status: 'active' | 'idle' | 'updating';
  lastActive: string;
  documentsCount: number;
  embeddingsCount: number;
}

export interface AgentResponse {
  agentId: string;
  agentName: string;
  content: string;
  sources: Array<{
    title: string;
    relevance: number;
    tokens: number;
  }>;
}

export interface QueryResponse {
  conversationId: number;
  responses: AgentResponse[];
  masterSummary?: string;
  routingInfo: {
    selectedJurisdictions: string[];
    autoRouted: boolean;
    rationale: string;
  };
  suggestedQuestions?: string[];
}

export interface QueryRequest {
  message: string;
  conversationId?: number;
  jurisdictions?: string[];
  queryType?: 'general' | 'compliance' | 'comparison' | 'legal';
  autoRoute?: boolean;
}

export interface Message {
  id: number;
  conversationId: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  agentId?: string;
  metadata?: any;
  createdAt: string;
}

export interface Conversation {
  id: number;
  userId?: number;
  title: string;
  createdAt: string;
}

export const JURISDICTION_INFO = {
  'us-federal': {
    name: 'US Federal',
    flag: '🇺🇸',
    description: 'NIST AI Risk Management, Executive Orders',
    color: 'bg-red-600',
  },
  'california': {
    name: 'California',
    flag: '🏖️',
    description: 'SB-1001, Consumer Privacy Act Extensions',
    color: 'bg-blue-600',
  },
  'colorado': {
    name: 'Colorado',
    flag: '🏔️',
    description: 'AI Consumer Protections, Biometric Technologies',
    color: 'bg-purple-600',
  },
  'eu': {
    name: 'European Union',
    flag: '🇪🇺',
    description: 'AI Act, GDPR Integration Guidelines',
    color: 'bg-blue-600',
  },
  'uk': {
    name: 'United Kingdom',
    flag: '🇬🇧',
    description: 'AI White Paper, Data Protection Guidelines',
    color: 'bg-red-600',
  },
  'germany': {
    name: 'Germany',
    flag: '🇩🇪',
    description: 'BDSG, AGG, AI Act Implementation',
    color: 'bg-yellow-600',
  },
} as const;
