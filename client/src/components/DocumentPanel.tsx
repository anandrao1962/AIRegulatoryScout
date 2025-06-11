import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useState, useEffect } from "react";
import { JURISDICTION_INFO } from "@/types/agents";
import { 
  FileText, 
  Database, 
  Search, 
  Clock, 
  Zap,
  ExternalLink,
  Activity
} from "lucide-react";

interface DocumentPanelProps {
  className?: string;
}

interface DocumentReference {
  id: string;
  title: string;
  jurisdiction: string;
  description: string;
  similarity: number;
  tokens: number;
  url?: string;
}

export function DocumentPanel({ className }: DocumentPanelProps) {
  const [referencedDocuments, setReferencedDocuments] = useState<DocumentReference[]>([
    {
      id: '1',
      title: 'EU AI Act - Article 6-8',
      jurisdiction: 'eu',
      description: 'High-risk AI systems classification and requirements for market placement.',
      similarity: 0.94,
      tokens: 347,
      url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689'
    },
    {
      id: '2',
      title: 'NIST AI RMF 1.0',
      jurisdiction: 'us-federal',
      description: 'Risk management framework for artificial intelligence systems governance.',
      similarity: 0.96,
      tokens: 289,
      url: 'https://www.nist.gov/itl/ai-risk-management-framework'
    },
    {
      id: '3',
      title: 'Annex III - High-Risk',
      jurisdiction: 'eu',
      description: 'Comprehensive list of high-risk AI system categories under EU regulation.',
      similarity: 0.91,
      tokens: 412,
      url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689'
    }
  ]);

  const [searchStats, setSearchStats] = useState({
    queryEmbeddings: '1,536 dim',
    documentsSearched: '60,945',
    topKRetrieved: '15',
    searchTime: '0.34s'
  });

  const [vectorDbStatus, setVectorDbStatus] = useState({
    status: 'Healthy',
    lastUpdate: '2h ago',
    embeddingModel: 'text-3-large'
  });

  const getJurisdictionInfo = (jurisdiction: string) => {
    return JURISDICTION_INFO[jurisdiction as keyof typeof JURISDICTION_INFO] || {
      name: jurisdiction,
      flag: '',
      color: 'bg-gray-600'
    };
  };

  return (
    <div className={`w-80 bg-white border-l border-gray-200 flex flex-col ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Document Context</h3>
        <p className="text-sm text-gray-600">RAG sources for current query</p>
      </div>
      
      {/* Retrieved Documents */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {referencedDocuments.map((doc) => {
          const jurisdictionInfo = getJurisdictionInfo(doc.jurisdiction);
          
          return (
            <Card key={doc.id} className="p-3 hover:shadow-sm transition-shadow cursor-pointer">
              <div className="flex items-center space-x-2 mb-2">
                <img 
                  src={jurisdictionInfo.flag} 
                  alt={`${jurisdictionInfo.name} Flag`} 
                  className="w-4 h-3 rounded object-cover"
                />
                <span className="text-sm font-medium text-gray-900 truncate">
                  {doc.title}
                </span>
                {doc.url && (
                  <a 
                    href={doc.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
              
              <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                {doc.description}
              </p>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary" className="text-xs">
                    Similarity: {Math.round(doc.similarity * 100)}%
                  </Badge>
                </div>
                <span className="text-xs text-gray-500 font-mono">
                  {doc.tokens} tokens
                </span>
              </div>
            </Card>
          );
        })}

        {/* Search Analytics */}
        <Card className="bg-gray-50 p-3 mt-4">
          <div className="flex items-center space-x-2 mb-2">
            <Search size={14} className="text-gray-600" />
            <h4 className="text-sm font-medium text-gray-900">Search Analytics</h4>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs text-gray-600">
              <span>Query Embeddings:</span>
              <span className="font-mono">{searchStats.queryEmbeddings}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-gray-600">
              <span>Documents Searched:</span>
              <span className="font-mono">{searchStats.documentsSearched}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-gray-600">
              <span>Top-K Retrieved:</span>
              <span className="font-mono">{searchStats.topKRetrieved}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-gray-600">
              <span>Search Time:</span>
              <span className="font-mono">{searchStats.searchTime}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* RAG Pipeline Status */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2 text-gray-600">
              <Database size={12} />
              <span>Vector DB Status:</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-green-600 font-medium">{vectorDbStatus.status}</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-xs text-gray-600">
            <div className="flex items-center space-x-2">
              <Clock size={12} />
              <span>Last Index Update:</span>
            </div>
            <span className="font-mono text-gray-700">{vectorDbStatus.lastUpdate}</span>
          </div>
          
          <div className="flex items-center justify-between text-xs text-gray-600">
            <div className="flex items-center space-x-2">
              <Zap size={12} />
              <span>Embedding Model:</span>
            </div>
            <span className="font-mono text-gray-700">{vectorDbStatus.embeddingModel}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
