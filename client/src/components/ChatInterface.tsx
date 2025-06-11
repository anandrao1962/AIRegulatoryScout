import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { QueryRequest, AgentResponse, JURISDICTION_INFO } from "@/types/agents";
import type { QueryResponse } from "@shared/schema";
import { 
  Send, 
  Bot, 
  User, 
  Route, 
  Settings, 
  Shield,
  ExternalLink,
  MessageSquare,
  Sparkles
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ExportDropdown } from "@/components/ExportDropdown";
import type { ExportData } from "@/lib/exportUtils";

interface ChatInterfaceProps {
  className?: string;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'agent' | 'master' | 'routing' | 'system';
  content: string;
  agentId?: string;
  agentName?: string;
  sources?: Array<{
    title: string;
    relevance: number;
    tokens: number;
  }>;
  timestamp: Date;
  routingInfo?: {
    selectedJurisdictions: string[];
    autoRouted: boolean;
    rationale: string;
  };
  suggestedQuestions?: string[];
}

export function ChatInterface({ className }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'system',
      content: "Welcome! I can help you understand AI regulations across different jurisdictions. I'll automatically route your questions to the relevant agents or ask for clarification if needed.",
      timestamp: new Date(),
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [selectedJurisdictions, setSelectedJurisdictions] = useState<string[]>([]);
  const [queryType, setQueryType] = useState<'general' | 'compliance' | 'comparison' | 'legal'>('general');
  const [autoRoute, setAutoRoute] = useState(true);
  const [currentConversationId, setCurrentConversationId] = useState<number | undefined>();
  const [lastUserQuery, setLastUserQuery] = useState<string>("");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const queryMutation = useMutation({
    mutationFn: (request: QueryRequest) => apiClient.query(request),
    onSuccess: (response: QueryResponse) => {
      console.log('Query response received:', response);
      console.log('Suggested questions:', response.suggestedQuestions);
      setCurrentConversationId(response.conversationId);
      
      // Add routing notification
      const routingMessage: ChatMessage = {
        id: `routing-${Date.now()}`,
        type: 'routing',
        content: `Routing query to ${response.routingInfo.selectedJurisdictions.map(j => 
          JURISDICTION_INFO[j as keyof typeof JURISDICTION_INFO]?.name || j
        ).join(' and ')}`,
        timestamp: new Date(),
        routingInfo: response.routingInfo,
      };
      setMessages(prev => [...prev, routingMessage]);

      // Add agent responses
      response.responses.forEach((agentResponse, index) => {
        setTimeout(() => {
          const isLastResponse = index === response.responses.length - 1;
          const agentMessage: ChatMessage = {
            id: `agent-${Date.now()}-${index}`,
            type: 'agent',
            content: agentResponse.content,
            agentId: agentResponse.agentId,
            agentName: agentResponse.agentName,
            sources: agentResponse.sources,
            timestamp: new Date(),
            // Add suggested questions to the last agent response if no master summary
            suggestedQuestions: (isLastResponse && !response.masterSummary) ? response.suggestedQuestions : undefined,
          };
          setMessages(prev => [...prev, agentMessage]);
        }, index * 1000);
      });

      // Add master summary if available
      if (response.masterSummary) {
        setTimeout(() => {
          const masterMessage: ChatMessage = {
            id: `master-${Date.now()}`,
            type: 'master',
            content: response.masterSummary!,
            agentId: 'master',
            agentName: 'Master Agent Summary',
            timestamp: new Date(),
            suggestedQuestions: response.suggestedQuestions,
          };
          setMessages(prev => [...prev, masterMessage]);
        }, response.responses.length * 1000);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Query Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!inputMessage.trim() || queryMutation.isPending) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: inputMessage,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setLastUserQuery(inputMessage); // Track the query for export functionality

    const request: QueryRequest = {
      message: inputMessage,
      conversationId: currentConversationId,
      jurisdictions: selectedJurisdictions.length > 0 ? selectedJurisdictions : undefined,
      queryType,
      autoRoute,
    };

    queryMutation.mutate(request);
    setInputMessage("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleQuickAction = (action: string) => {
    setInputMessage(action);
    textareaRef.current?.focus();
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getAgentIcon = (type: string, agentId?: string) => {
    switch (type) {
      case 'user':
        return <User size={16} className="text-gray-600" />;
      case 'agent':
        return (
          <img 
            src={JURISDICTION_INFO[agentId as keyof typeof JURISDICTION_INFO]?.flag}
            alt=""
            className="w-4 h-3 rounded object-cover"
          />
        );
      case 'master':
        return <Sparkles size={16} className="text-accent" />;
      case 'system':
        return <Bot size={16} className="text-primary" />;
      default:
        return <MessageSquare size={16} className="text-gray-400" />;
    }
  };

  const getAgentColor = (type: string, agentId?: string) => {
    switch (type) {
      case 'user':
        return 'bg-primary';
      case 'agent':
        return JURISDICTION_INFO[agentId as keyof typeof JURISDICTION_INFO]?.color || 'bg-gray-600';
      case 'master':
        return 'bg-accent';
      case 'system':
        return 'bg-primary';
      default:
        return 'bg-gray-600';
    }
  };

  return (
    <div className={`flex-1 flex flex-col ${className}`}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Global AI Regulatory Intelligence</h2>
            <p className="text-sm text-gray-600">Navigate AI regulations across jurisdictions worldwide</p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <Label htmlFor="auto-route" className="text-sm text-gray-600">Auto-Route</Label>
              <Switch
                id="auto-route"
                checked={autoRoute}
                onCheckedChange={setAutoRoute}
              />
            </div>
            <Button variant="ghost" size="sm">
              <Settings size={16} />
            </Button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((message) => {
          if (message.type === 'user') {
            return (
              <div key={message.id} className="flex items-start space-x-3 justify-end">
                <div className="flex-1 max-w-2xl">
                  <div className="bg-primary rounded-lg p-4 text-white">
                    <p>{message.content}</p>
                  </div>
                  <div className="text-xs text-gray-500 mt-1 text-right">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
                <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                  {getAgentIcon(message.type)}
                </div>
              </div>
            );
          }

          if (message.type === 'routing') {
            return (
              <div key={message.id} className="flex justify-center">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center space-x-2">
                  <Route className="text-blue-500" size={16} />
                  <span className="text-sm text-blue-700">{message.content}</span>
                </div>
              </div>
            );
          }

          return (
            <div key={message.id} className="flex items-start space-x-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getAgentColor(message.type, message.agentId)}`}>
                {getAgentIcon(message.type, message.agentId)}
              </div>
              <div className="flex-1">
                <Card className="p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-900">
                        {message.agentName || 'System'}
                      </span>
                      <Badge 
                        variant={message.type === 'master' ? 'default' : 'secondary'}
                        className="text-xs font-mono"
                      >
                        {message.type === 'master' ? 'AGGREGATED' : 
                         message.type === 'agent' ? 'JURISDICTION' : 'SYSTEM'}
                      </Badge>
                    </div>
                    {(message.type === 'agent' || message.type === 'master') && (
                      <ExportDropdown 
                        data={{
                          content: message.content,
                          agentName: message.agentName || 'System',
                          query: lastUserQuery || 'Query',
                          timestamp: message.timestamp,
                          sources: message.sources
                        }}
                      />
                    )}
                  </div>
                  
                  <div className="prose prose-sm max-w-none">
                    <p className="text-gray-700 whitespace-pre-wrap">{message.content}</p>
                  </div>

                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <div className="flex items-center space-x-2 mb-2">
                        <ExternalLink size={12} className="text-gray-400" />
                        <span className="text-xs font-medium text-gray-600">Referenced Documents</span>
                      </div>
                      <div className="space-y-1">
                        {message.sources.map((source, index) => (
                          <div key={index} className="text-xs text-gray-600 bg-gray-50 rounded p-2">
                            <span className="font-mono">{source.title}</span>
                            <span className="text-gray-500"> • Relevance: {Math.round(source.relevance * 100)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {message.suggestedQuestions && message.suggestedQuestions.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <div className="flex items-center space-x-2 mb-3">
                        <Sparkles size={12} className="text-blue-500" />
                        <span className="text-xs font-medium text-gray-600">Related Questions</span>
                      </div>
                      <div className="space-y-2">
                        {message.suggestedQuestions.map((question, index) => (
                          <Button
                            key={index}
                            variant="outline"
                            size="sm"
                            className="text-left text-xs h-auto p-2 whitespace-normal break-words"
                            onClick={() => {
                              setInputMessage(question);
                              handleSubmit();
                            }}
                            disabled={queryMutation.isPending}
                          >
                            {question}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          );
        })}
        
        {queryMutation.isPending && (
          <div className="flex items-center space-x-2 text-gray-500">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
            <span className="text-sm">Processing query...</span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 p-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-start space-x-3">
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                placeholder="Ask about AI regulations across jurisdictions..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                className="min-h-[60px] pr-12 resize-none"
                disabled={queryMutation.isPending}
              />
              <Button
                type="submit"
                size="sm"
                className="absolute right-2 top-2"
                disabled={!inputMessage.trim() || queryMutation.isPending}
              >
                <Send size={16} />
              </Button>
            </div>
            
            <div className="flex flex-col space-y-2">
              <Select value={selectedJurisdictions.join(',')} onValueChange={(value) => 
                setSelectedJurisdictions(value === 'auto' ? [] : value.split(',').filter(Boolean))
              }>
                <SelectTrigger className="w-40 text-sm">
                  <SelectValue placeholder="Auto-Route" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto-Route</SelectItem>
                  <SelectItem value="us-federal">US Federal Only</SelectItem>
                  <SelectItem value="california">California Only</SelectItem>
                  <SelectItem value="eu">EU Only</SelectItem>
                  <SelectItem value="uk">UK Only</SelectItem>
                  <SelectItem value="us-federal,california,eu,uk">All Jurisdictions</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={queryType} onValueChange={(value: any) => setQueryType(value)}>
                <SelectTrigger className="w-40 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General Query</SelectItem>
                  <SelectItem value="compliance">Compliance Check</SelectItem>
                  <SelectItem value="comparison">Comparison</SelectItem>
                  <SelectItem value="legal">Legal Research</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickAction("What are the key differences between EU AI Act and US federal AI guidelines regarding high-risk AI systems?")}
              >
                High-Risk AI Definition
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickAction("What are the compliance requirements for AI systems in my jurisdiction?")}
              >
                Compliance Requirements
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickAction("How do different jurisdictions handle cross-border AI deployment?")}
              >
                Cross-Border Issues
              </Button>
            </div>
            <div className="flex items-center space-x-1 text-xs text-gray-500">
              <Shield size={12} />
              <span>Responses based on latest regulatory documents</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
