import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { AgentSession, JURISDICTION_INFO } from "@/types/agents";
import { Gavel, Database, Activity, Clock, BarChart3, MessageSquare, Upload, FileText } from "lucide-react";
import { Link, useLocation } from "wouter";

interface AgentSidebarProps {
  className?: string;
}

export function AgentSidebar({ className }: AgentSidebarProps) {
  const [location] = useLocation();
  const { data: agentSessions, isLoading } = useQuery({
    queryKey: ['/api/agents'],
    queryFn: () => apiClient.getAgentSessions(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'updating':
        return 'bg-yellow-500';
      case 'idle':
        return 'bg-gray-400';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'READY';
      case 'updating':
        return 'UPDATING';
      case 'idle':
        return 'IDLE';
      default:
        return 'UNKNOWN';
    }
  };

  const totalQueries = 1247;
  const avgResponseTime = 2.3;
  const multiJurisdictionPercent = 34;

  return (
    <div className={`w-80 bg-white border-r border-gray-200 flex flex-col ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <Gavel className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">AI Reg Assistant</h1>
            <p className="text-sm text-gray-500">Multi-Jurisdiction RAG</p>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex flex-col gap-2 mb-4">
          <Link href="/">
            <Button 
              variant={location === "/" ? "default" : "ghost"} 
              className="w-full justify-start gap-2"
            >
              <MessageSquare className="h-4 w-4" />
              Chat Interface
            </Button>
          </Link>
          <Link href="/documents">
            <Button 
              variant={location === "/documents" ? "default" : "ghost"} 
              className="w-full justify-start gap-2"
            >
              <FileText className="h-4 w-4" />
              Document Management
            </Button>
          </Link>
        </div>
        
        {/* Master Agent Status */}
        <Card className="bg-accent/10 border-accent/20 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Master Agent</span>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-accent rounded-full animate-pulse"></div>
              <Badge variant="secondary" className="text-accent font-mono text-xs">
                ACTIVE
              </Badge>
            </div>
          </div>
          <p className="text-xs text-gray-600">Routing queries and aggregating responses</p>
        </Card>
      </div>

      {/* Jurisdiction Agents */}
      <div className="flex-1 overflow-y-auto p-6">
        <h3 className="text-sm font-medium text-gray-900 mb-4">Jurisdiction Agents</h3>
        
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-4 bg-gray-50 rounded-lg animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {agentSessions?.map((session: AgentSession) => {
              const jurisdictionInfo = JURISDICTION_INFO[session.agentId as keyof typeof JURISDICTION_INFO];
              
              return (
                <Card key={session.agentId} className="p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <img 
                        src={jurisdictionInfo?.flag} 
                        alt={`${jurisdictionInfo?.name} Flag`} 
                        className="w-6 h-4 rounded object-cover"
                      />
                      <span className="text-sm font-medium text-gray-800">
                        {jurisdictionInfo?.name || session.agentId}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(session.status)}`}></div>
                      <Badge 
                        variant={session.status === 'active' ? 'default' : 'secondary'} 
                        className="font-mono text-xs"
                      >
                        {getStatusText(session.status)}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mb-2">
                    {jurisdictionInfo?.description || 'AI Regulation Specialist'}
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center space-x-1">
                      <Database size={12} />
                      <span>Documents: {session.documentsCount.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Activity size={12} />
                      <span>Embeddings: {(session.embeddingsCount / 1000).toFixed(1)}K</span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="p-6 border-t border-gray-200 bg-gray-50">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <div className="flex items-center space-x-2">
              <BarChart3 size={12} />
              <span>Total Queries Today:</span>
            </div>
            <span className="font-mono font-medium">{totalQueries.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-600">
            <div className="flex items-center space-x-2">
              <Clock size={12} />
              <span>Avg Response Time:</span>
            </div>
            <span className="font-mono font-medium">{avgResponseTime}s</span>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-600">
            <div className="flex items-center space-x-2">
              <Activity size={12} />
              <span>Multi-Jurisdiction:</span>
            </div>
            <span className="font-mono font-medium">{multiJurisdictionPercent}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
