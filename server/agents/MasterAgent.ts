import { BaseAgent, AgentConfig, AgentResponse } from './BaseAgent';
import { JurisdictionAgent } from './JurisdictionAgent';
import { QueryRequest } from '@shared/schema';

export interface MasterAgentConfig extends AgentConfig {
  jurisdictionAgents: Map<string, JurisdictionAgent>;
}

export interface RoutingDecision {
  selectedJurisdictions: string[];
  rationale: string;
  autoRouted: boolean;
}

export interface MasterAgentResponse {
  responses: Array<{
    agentId: string;
    agentName: string;
    content: string;
    sources: Array<{
      title: string;
      relevance: number;
      tokens: number;
    }>;
  }>;
  masterSummary?: string;
  routingInfo: RoutingDecision;
  suggestedQuestions?: string[];
}

export class MasterAgent extends BaseAgent {
  private jurisdictionAgents: Map<string, JurisdictionAgent>;

  constructor(config: MasterAgentConfig) {
    super(config);
    this.jurisdictionAgents = config.jurisdictionAgents;
  }

  async processQueryWithRequest(query: string, request: QueryRequest): Promise<MasterAgentResponse> {
    try {
      console.log(`[MasterAgent] Processing query: ${query.substring(0, 100)}...`);

      // Determine which jurisdictions to query
      const routingDecision = await this.routeQuery(query, request);
      
      // Check if clarification is needed
      if (routingDecision.selectedJurisdictions.includes('CLARIFICATION_NEEDED')) {
        const clarificationResponse = await this.generateClarificationResponse(query);
        return {
          responses: [{
            agentId: 'master',
            agentName: 'Master Agent',
            content: clarificationResponse,
            sources: []
          }],
          masterSummary: undefined,
          routingInfo: {
            selectedJurisdictions: ['CLARIFICATION_NEEDED'],
            autoRouted: true,
            rationale: routingDecision.rationale
          }
        };
      }
      
      // Query relevant jurisdiction agents
      const agentResponses = await this.queryJurisdictionAgents(
        query, 
        routingDecision.selectedJurisdictions,
        request
      );
      
      // Generate master summary if multiple jurisdictions
      const masterSummary = agentResponses.length > 1 
        ? await this.generateMasterSummary(query, agentResponses)
        : undefined;

      // Generate suggested follow-up questions
      console.log('[MasterAgent] Generating suggested questions for query:', query);
      const suggestedQuestions = await this.generateSuggestedQuestions(
        query, 
        agentResponses, 
        routingDecision.selectedJurisdictions
      );
      console.log('[MasterAgent] Generated suggested questions:', suggestedQuestions);

      return {
        responses: agentResponses,
        masterSummary,
        routingInfo: routingDecision,
        suggestedQuestions,
      };
    } catch (error) {
      console.error('[MasterAgent] Error processing query:', error);
      throw error;
    }
  }

  private async generateClarificationResponse(query: string): Promise<string> {
    const clarificationPrompt = `The user asked: "${query}"

This query could apply to multiple jurisdictions and would benefit from clarification. Generate a helpful response that:

1. Acknowledges their question
2. Explains that AI regulations vary by jurisdiction
3. Asks them to specify which jurisdiction(s) they're interested in
4. Lists the available options with brief descriptions

Available jurisdictions:
- 🇺🇸 US Federal: Federal AI regulations, NIST AI RMF, Executive Orders
- 🏛️ California: California state AI regulations, SB-1001, Consumer Privacy Act
- 🇪🇺 European Union: EU AI Act, GDPR, comprehensive AI governance
- 🇬🇧 United Kingdom: UK AI White Paper, Data Protection regulations

Keep the response friendly and helpful, encouraging them to specify their jurisdiction of interest.`;

    return await this.generateResponse([
      {
        role: 'system',
        content: 'You are a helpful AI regulation assistant that guides users to specify jurisdictions for more accurate answers.'
      },
      {
        role: 'user',
        content: clarificationPrompt
      }
    ]);
  }

  private async routeQuery(query: string, request: QueryRequest): Promise<RoutingDecision> {
    // If jurisdictions are explicitly specified, use them
    if (request.jurisdictions && request.jurisdictions.length > 0) {
      return {
        selectedJurisdictions: request.jurisdictions,
        rationale: 'Jurisdictions explicitly specified by user',
        autoRouted: false,
      };
    }

    // If auto-routing is disabled, default to all jurisdictions
    if (!request.autoRoute) {
      return {
        selectedJurisdictions: Array.from(this.jurisdictionAgents.keys()),
        rationale: 'Auto-routing disabled, querying all jurisdictions',
        autoRouted: false,
      };
    }

    // Auto-route based on query content
    const routingDecision = await this.autoRouteQuery(query, request.queryType);
    return {
      ...routingDecision,
      autoRouted: true,
    };
  }

  private async autoRouteQuery(query: string, queryType: string): Promise<Omit<RoutingDecision, 'autoRouted'>> {
    const routingPrompt = `You are a routing agent for an AI regulations query system. Analyze the following query and determine which jurisdictions should handle it.

Available jurisdictions:
- us-federal: US Federal regulations (NIST AI RMF, Executive Orders)
- california: California state regulations (SB-1001, Consumer Privacy Act)
- eu: European Union regulations (AI Act, GDPR)
- uk: United Kingdom regulations (AI White Paper, Data Protection)

Query: "${query}"
Query Type: ${queryType}

First, determine if the query is jurisdiction-specific or general:
- If the query clearly mentions specific countries, regions, laws, or is asking for jurisdiction-specific information, route to those jurisdictions
- If the query is very general and could benefit from clarification (e.g., "what are the requirements?", "how do I comply?"), respond with "CLARIFICATION_NEEDED"
- If the query is comparative or general but doesn't need clarification, route to relevant jurisdictions

Respond with JSON in this format:
{
  "selectedJurisdictions": ["jurisdiction1", "jurisdiction2"] OR ["CLARIFICATION_NEEDED"],
  "rationale": "Brief explanation of why these jurisdictions were selected or why clarification is needed"
}

Examples of queries needing clarification:
- "What are the compliance requirements?"
- "How do I implement AI governance?"
- "What are the penalties for non-compliance?"
- "What documentation is required?"

Examples of queries that don't need clarification:
- "Compare EU and US AI regulations"
- "What does the EU AI Act say about high-risk systems?"
- "How does California regulate AI?"`;

    try {
      const response = await this.generateResponse([
        {
          role: 'system',
          content: 'You are a routing specialist for AI regulation queries. Respond only with valid JSON.'
        },
        {
          role: 'user',
          content: routingPrompt
        }
      ], true);

      const parsed = JSON.parse(response);
      
      // Validate the response
      if (!parsed.selectedJurisdictions || !Array.isArray(parsed.selectedJurisdictions)) {
        throw new Error('Invalid routing response format');
      }

      // Check if clarification is needed
      if (parsed.selectedJurisdictions.includes('CLARIFICATION_NEEDED')) {
        return {
          selectedJurisdictions: ['CLARIFICATION_NEEDED'],
          rationale: parsed.rationale || 'Query requires jurisdiction clarification'
        };
      }

      // Filter to only valid jurisdictions
      const validJurisdictions = parsed.selectedJurisdictions.filter((j: string) => 
        this.jurisdictionAgents.has(j)
      );

      if (validJurisdictions.length === 0) {
        // Default to US Federal and EU for general queries
        return {
          selectedJurisdictions: ['us-federal', 'eu'],
          rationale: 'Auto-routing failed, using default jurisdictions'
        };
      }

      return {
        selectedJurisdictions: validJurisdictions,
        rationale: parsed.rationale || 'Auto-routed based on query analysis'
      };
    } catch (error) {
      console.error('[MasterAgent] Error in auto-routing:', error);
      // Fallback to default routing
      return {
        selectedJurisdictions: ['us-federal', 'eu'],
        rationale: 'Auto-routing failed, using default jurisdictions'
      };
    }
  }

  private async queryJurisdictionAgents(
    query: string, 
    jurisdictions: string[], 
    request: QueryRequest
  ): Promise<MasterAgentResponse['responses']> {
    const responses = await Promise.allSettled(
      jurisdictions.map(async (jurisdictionId) => {
        const agent = this.jurisdictionAgents.get(jurisdictionId);
        if (!agent) {
          throw new Error(`Agent not found for jurisdiction: ${jurisdictionId}`);
        }

        const response = await agent.processQuery(query, { queryType: request.queryType });
        return {
          agentId: jurisdictionId,
          agentName: agent.getName(),
          content: response.content,
          sources: response.sources,
        };
      })
    );

    // Handle any failed responses
    const successfulResponses = responses
      .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
      .map(result => result.value);

    // Log any failures
    responses.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`[MasterAgent] Failed to query ${jurisdictions[index]}:`, result.reason);
      }
    });

    return successfulResponses;
  }

  private async generateMasterSummary(
    query: string, 
    responses: MasterAgentResponse['responses']
  ): Promise<string> {
    const responseContext = responses.map(r => 
      `${r.agentName} Response:\n${r.content}\n---`
    ).join('\n');

    const summaryPrompt = `You are a master AI regulation analyst. You have received responses from multiple jurisdiction agents about the following query: "${query}"

Here are the responses from different jurisdictions:
${responseContext}

Please provide a comprehensive summary that:
1. Highlights key differences between jurisdictions
2. Identifies common themes and approaches
3. Provides actionable insights for the user
4. Notes any conflicting or complementary requirements

Keep the summary concise but informative, focusing on the most important comparative insights.`;

    return await this.generateResponse([
      {
        role: 'system',
        content: this.config.systemPrompt
      },
      {
        role: 'user',
        content: summaryPrompt
      }
    ]);
  }

  private async generateSuggestedQuestions(
    originalQuery: string,
    agentResponses: MasterAgentResponse['responses'],
    jurisdictions: string[]
  ): Promise<string[]> {
    console.log('[MasterAgent] generateSuggestedQuestions called with:', { originalQuery, jurisdictions });
    
    // Return immediate test questions to verify the function works
    console.log('[MasterAgent] Returning test questions');
    return [
      "What are the specific compliance requirements?",
      "What penalties apply for non-compliance?",
      "How do implementation timelines work?",
      "What technical standards are required?",
      "Are there exemptions available?"
    ];
    
    if (queryLower.includes('compliance') || queryLower.includes('requirement')) {
      return [
        "What are the key documentation requirements?",
        "What testing and validation is required?",
        "Are there certification processes involved?",
        "What ongoing monitoring obligations exist?",
        "How often must compliance be reviewed?"
      ];
    }
    
    if (queryLower.includes('timeline') || queryLower.includes('deadline') || queryLower.includes('effective')) {
      return [
        "What are the key implementation milestones?",
        "Are there grace periods for existing systems?",
        "What happens if deadlines are missed?",
        "Are there different timelines for different AI types?",
        "How should organizations prepare for these deadlines?"
      ];
    }
    
    if (queryLower.includes('difference') || queryLower.includes('compare') || queryLower.includes('versus')) {
      return [
        "How do the regulatory approaches fundamentally differ?",
        "Which jurisdiction has the strictest requirements?",
        "Are there conflicts between different regulations?",
        "How do international companies handle multiple jurisdictions?",
        "What are the common themes across all jurisdictions?"
      ];
    }

    // Default questions based on content analysis
    try {
      const responseContent = agentResponses.map(r => r.content).join('\n\n');
      const jurisdictionNames = jurisdictions.map(j => {
        const mapping: Record<string, string> = {
          'us-federal': 'US Federal',
          'california': 'California',
          'eu': 'European Union',
          'uk': 'United Kingdom'
        };
        return mapping[j] || j;
      }).join(', ');

      const questionPrompt = `Based on the original query "${originalQuery}" and the following AI regulation response content, generate exactly 5 specific, actionable follow-up questions that would help the user explore related regulatory topics in more depth.

Response content:
${responseContent}

Jurisdictions covered: ${jurisdictionNames}

Generate 5 follow-up questions that:
1. Explore specific implementation details or requirements
2. Ask about compliance procedures or timelines
3. Inquire about penalties, enforcement, or consequences
4. Compare different jurisdictional approaches
5. Dive deeper into technical requirements or definitions

Format your response as a JSON array of exactly 5 strings, like:
["Question 1", "Question 2", "Question 3", "Question 4", "Question 5"]

Make questions specific to AI regulations and directly relevant to the response content.`;

      const questionsResponse = await this.generateResponse([
        {
          role: 'system',
          content: 'You are an AI regulation expert who generates insightful follow-up questions. You MUST respond with valid JSON containing exactly 5 questions. Your response should be ONLY the JSON array, nothing else.'
        },
        {
          role: 'user',
          content: questionPrompt
        }
      ], true);

      // Clean the response to ensure it's valid JSON
      const cleanedResponse = questionsResponse.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
      const parsedQuestions = JSON.parse(cleanedResponse);
      
      if (Array.isArray(parsedQuestions) && parsedQuestions.length === 5) {
        return parsedQuestions;
      }
      
      // Fallback questions if parsing fails
      return [
        "What are the specific compliance requirements for this regulation?",
        "What penalties apply for non-compliance?",
        "How do implementation timelines differ across jurisdictions?",
        "What technical standards must AI systems meet?",
        "Are there exemptions for certain types of AI applications?"
      ];
    } catch (error) {
      console.error('[MasterAgent] Error generating suggested questions:', error);
      
      // Return contextual fallback questions
      return [
        "What are the key compliance requirements?",
        "What are the enforcement mechanisms?",
        "How do different jurisdictions compare?",
        "What are the implementation deadlines?",
        "Are there industry-specific provisions?"
      ];
    }
  }

  async processQuery(query: string, context?: any): Promise<AgentResponse> {
    // This method is required by BaseAgent but we redirect to the proper method
    if (context && typeof context === 'object' && 'message' in context) {
      const response = await this.processQueryWithRequest(query, context as QueryRequest);
      // Convert MasterAgentResponse to AgentResponse format for compatibility
      return {
        content: response.masterSummary || response.responses[0]?.content || 'No response available',
        sources: response.responses.flatMap(r => r.sources || []),
        metadata: {
          routingInfo: response.routingInfo,
          responses: response.responses,
          masterSummary: response.masterSummary,
          suggestedQuestions: response.suggestedQuestions
        }
      };
    }
    
    // Fallback for simple queries without full context
    const simpleRequest: QueryRequest = {
      message: query,
      queryType: 'general',
      autoRoute: true
    };
    
    const response = await this.processQueryWithRequest(query, simpleRequest);
    return {
      content: response.masterSummary || response.responses[0]?.content || 'No response available',
      sources: response.responses.flatMap(r => r.sources || []),
      metadata: {
        routingInfo: response.routingInfo,
        responses: response.responses,
        masterSummary: response.masterSummary,
        suggestedQuestions: response.suggestedQuestions
      }
    };
  }
}