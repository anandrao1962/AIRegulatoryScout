import { AgentSidebar } from "@/components/AgentSidebar";
import { ChatInterface } from "@/components/ChatInterface";
import { DocumentPanel } from "@/components/DocumentPanel";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, FileText, MessageSquare } from "lucide-react";
import { Link } from "wouter";

export default function HomePage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [documentPanelOpen, setDocumentPanelOpen] = useState(true);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 bg-gray-900/50 z-50">
          <div className="absolute inset-y-0 left-0 w-80 bg-white">
            <div className="p-4 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(false)}
              >
                <X size={20} />
              </Button>
            </div>
            <AgentSidebar />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <AgentSidebar />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <div className="lg:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </Button>
          <h1 className="text-lg font-semibold">Global AI Regulatory Navigator</h1>
          <div className="flex items-center space-x-2">
            <Link href="/documents">
              <Button variant="ghost" size="sm">
                <FileText size={16} className="mr-1" />
                Manage
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDocumentPanelOpen(!documentPanelOpen)}
            >
              Docs
            </Button>
          </div>
        </div>

        {/* Desktop header */}
        <div className="hidden lg:block bg-white border-b border-gray-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold text-gray-900">Global AI Regulatory Navigator</h1>
              <div className="flex items-center space-x-1">
                <MessageSquare size={16} className="text-blue-600" />
                <span className="text-sm text-gray-600">Chat</span>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Link href="/documents">
                <Button variant="outline" size="sm">
                  <FileText size={16} className="mr-2" />
                  Manage Documents
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDocumentPanelOpen(!documentPanelOpen)}
              >
                {documentPanelOpen ? 'Hide' : 'Show'} Document Panel
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex">
          <ChatInterface className="flex-1" />
          
          {/* Desktop document panel */}
          {documentPanelOpen && (
            <div className="hidden lg:block">
              <DocumentPanel />
            </div>
          )}
        </div>
      </div>

      {/* Mobile document panel */}
      {documentPanelOpen && (
        <div className="lg:hidden fixed inset-0 bg-white z-40 flex flex-col">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Documents</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDocumentPanelOpen(false)}
            >
              <X size={20} />
            </Button>
          </div>
          <div className="flex-1">
            <DocumentPanel />
          </div>
        </div>
      )}
    </div>
  );
}
