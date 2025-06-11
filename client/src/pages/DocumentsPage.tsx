import { DocumentUpload } from "@/components/DocumentUpload";
import { OCRTestComponent } from "@/components/OCRTestComponent";
import { AgentSidebar } from "@/components/AgentSidebar";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { Menu, FileText, Trash2, ArrowLeft, MessageSquare, Eye, X, Download } from "lucide-react";
import { Link } from "wouter";
import { JURISDICTION_INFO } from "@/types/agents";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function DocumentsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'load' | 'view'>('load');
  const [selectedJurisdictions, setSelectedJurisdictions] = useState<string[]>([]);
  const [selectedDocumentsForBulkDelete, setSelectedDocumentsForBulkDelete] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [documentsPerPage] = useState(20);
  const [showDocuments, setShowDocuments] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [showDocumentViewer, setShowDocumentViewer] = useState(false);
  const [fullDocumentContent, setFullDocumentContent] = useState<string>('');
  const [loadingFullContent, setLoadingFullContent] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch documents for selected jurisdictions
  const { data: documents = [], isLoading: documentsLoading } = useQuery<any[]>({
    queryKey: ['/api/documents', selectedJurisdictions],
    queryFn: async () => {
      if (selectedJurisdictions.length === 0 || !showDocuments) return [];
      
      const promises = selectedJurisdictions.map(jurisdiction => 
        fetch(`/api/documents?jurisdiction=${jurisdiction}`).then(res => res.json())
      );
      
      const results = await Promise.all(promises);
      return results.flat();
    },
    enabled: showDocuments && selectedJurisdictions.length > 0,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (documentIds: number[]) => {
      const deletePromises = documentIds.map(id =>
        fetch(`/api/documents/${id}`, { method: 'DELETE' }).then(res => {
          if (!res.ok) throw new Error('Delete failed');
          return res.json();
        })
      );
      await Promise.all(deletePromises);
    },
    onSuccess: () => {
      toast({
        title: "Documents deleted",
        description: `Successfully deleted ${selectedDocumentsForBulkDelete.length} documents.`,
      });
      setSelectedDocumentsForBulkDelete([]);
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
    },
    onError: (error: any) => {
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete documents",
        variant: "destructive",
      });
    },
  });

  // Pagination logic
  const totalPages = Math.ceil(documents.length / documentsPerPage);
  const paginatedDocuments = documents.slice(
    (currentPage - 1) * documentsPerPage,
    currentPage * documentsPerPage
  );

  // Handle jurisdiction selection
  const handleJurisdictionToggle = (jurisdiction: string) => {
    setSelectedJurisdictions(prev => 
      prev.includes(jurisdiction) 
        ? prev.filter(j => j !== jurisdiction)
        : [...prev, jurisdiction]
    );
    setCurrentPage(1);
    setShowDocuments(false);
  };

  // Load documents for selected jurisdictions
  const handleLoadDocuments = () => {
    if (selectedJurisdictions.length > 0) {
      setShowDocuments(true);
      setCurrentPage(1);
    }
  };

  const handleBulkDelete = () => {
    if (selectedDocumentsForBulkDelete.length > 0) {
      bulkDeleteMutation.mutate(selectedDocumentsForBulkDelete);
    }
  };

  const handleSelectAll = () => {
    if (selectedDocumentsForBulkDelete.length === documents.length) {
      setSelectedDocumentsForBulkDelete([]);
    } else {
      setSelectedDocumentsForBulkDelete(documents.map((doc: any) => doc.id));
    }
  };

  const handleDocumentSelect = (documentId: number) => {
    setSelectedDocumentsForBulkDelete(prev =>
      prev.includes(documentId)
        ? prev.filter(id => id !== documentId)
        : [...prev, documentId]
    );
  };

  const handleViewDocument = async (document: any) => {
    setSelectedDocument(document);
    setShowDocumentViewer(true);
    setLoadingFullContent(true);
    setFullDocumentContent('');

    try {
      const response = await fetch(`/api/documents/full/${document.id}`);
      
      // Get response text first to debug
      const responseText = await response.text();
      console.log('Raw response:', responseText);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Try to parse JSON
      let fullDoc;
      try {
        fullDoc = JSON.parse(responseText);
        console.log('Parsed document response:', fullDoc);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        throw new Error('Invalid JSON response from server');
      }
      
      if (fullDoc.content) {
        setFullDocumentContent(fullDoc.content);
      } else {
        setFullDocumentContent(document.content || 'No content available for this document.');
      }
    } catch (error: any) {
      console.error('Error fetching full document:', error);
      setFullDocumentContent(document.content || 'Error loading full document content. Showing preview instead.');
      toast({
        title: "Error loading document",
        description: error.message || "Could not load the full document content.",
        variant: "destructive",
      });
    } finally {
      setLoadingFullContent(false);
    }
  };

  const closeDocumentViewer = () => {
    setSelectedDocument(null);
    setShowDocumentViewer(false);
    setFullDocumentContent('');
    setLoadingFullContent(false);
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Document Viewer Modal */}
      {showDocumentViewer && selectedDocument && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl h-full max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center space-x-3">
                <FileText className="h-6 w-6 text-blue-500" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{selectedDocument.title}</h2>
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <Badge variant="outline">{selectedDocument.jurisdiction}</Badge>
                    <Badge variant="secondary">{selectedDocument.documentType}</Badge>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={closeDocumentViewer}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Document Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingFullContent ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading full document content...</p>
                  </div>
                </div>
              ) : (
                <div className="prose max-w-none">
                  <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
                    {fullDocumentContent || selectedDocument?.content || 'No content available for this document.'}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t p-4 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Document ID: {selectedDocument.id} | 
                {selectedDocument.createdAt && ` Added: ${new Date(selectedDocument.createdAt).toLocaleDateString()}`}
                {fullDocumentContent && ` | ${Math.round(fullDocumentContent.length / 1000)}k characters`}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={closeDocumentViewer}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AgentSidebar className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden"
            >
              <Menu size={20} />
            </Button>
            <h1 className="text-xl font-semibold text-gray-900">Document Manager</h1>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/chat">
              <Button variant="outline" size="sm">
                <MessageSquare size={16} className="mr-2" />
                Chat
              </Button>
            </Link>
            <div className="flex border rounded-lg p-1">
              <Button
                variant={activeTab === 'load' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('load')}
              >
                Load Documents
              </Button>
              <Button
                variant={activeTab === 'view' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('view')}
              >
                View Documents
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {activeTab === 'load' ? (
              <div className="space-y-8">
                <DocumentUpload />
                <OCRTestComponent />
              </div>
            ) : (
              <div className="space-y-6">
                {!showDocuments ? (
                  <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-8">
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">Select Jurisdictions</h2>
                      <p className="text-gray-600">Choose one or more jurisdictions to view their documents</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                      {Object.entries(JURISDICTION_INFO).map(([key, info]) => (
                        <div
                          key={key}
                          className={`p-6 border-2 rounded-lg cursor-pointer transition-all hover:shadow-md ${
                            selectedJurisdictions.includes(key)
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => handleJurisdictionToggle(key)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="text-2xl">{info.flag}</div>
                              <div>
                                <h3 className="font-semibold text-gray-900">{info.name}</h3>
                                <p className="text-sm text-gray-600">{info.description}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                checked={selectedJurisdictions.includes(key)}
                                onChange={() => {}}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {selectedJurisdictions.length > 0 && (
                      <div className="text-center">
                        <div className="mb-4">
                          <p className="text-sm text-gray-600">
                            Selected: {selectedJurisdictions.map(j => (JURISDICTION_INFO as any)[j].name).join(', ')}
                          </p>
                        </div>
                        <Button onClick={handleLoadDocuments} size="lg">
                          <FileText className="mr-2 h-4 w-4" />
                          Load Documents ({selectedJurisdictions.length} jurisdiction{selectedJurisdictions.length > 1 ? 's' : ''})
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowDocuments(false)}
                        >
                          <ArrowLeft className="mr-2 h-4 w-4" />
                          Back to Selection
                        </Button>
                        <h2 className="text-lg font-semibold text-gray-900">
                          Documents: {selectedJurisdictions.map(j => (JURISDICTION_INFO as any)[j].name).join(', ')}
                        </h2>
                      </div>

                      {selectedDocumentsForBulkDelete.length > 0 && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              <Trash2 size={16} className="mr-2" />
                              Delete Selected ({selectedDocumentsForBulkDelete.length})
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Selected Documents</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete {selectedDocumentsForBulkDelete.length} selected documents? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={handleBulkDelete}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Delete Documents
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>

                    {documentsLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="text-gray-500">Loading documents...</div>
                      </div>
                    ) : documents.length === 0 ? (
                      <div className="text-center py-12">
                        <FileText size={48} className="mx-auto text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No documents found</h3>
                        <p className="text-gray-500">
                          Try selecting different jurisdictions or upload some documents first.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center space-x-2 pb-2 border-b">
                          <Checkbox
                            checked={selectedDocumentsForBulkDelete.length === documents.length && documents.length > 0}
                            onChange={handleSelectAll}
                          />
                          <span className="text-sm text-gray-600">
                            Select All ({documents.length} documents)
                          </span>
                        </div>

                        <div className="grid gap-4">
                          {paginatedDocuments.map((document: any) => (
                            <Card key={document.id} className="p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex items-start space-x-3 flex-1">
                                  <Checkbox
                                    checked={selectedDocumentsForBulkDelete.includes(document.id)}
                                    onChange={() => handleDocumentSelect(document.id)}
                                  />
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-2 mb-2">
                                      <h3 className="font-medium text-gray-900">{document.title}</h3>
                                      <Badge variant="outline" className="text-xs">
                                        {document.jurisdiction}
                                      </Badge>
                                      <Badge variant="secondary" className="text-xs">
                                        {document.documentType || 'Unknown'}
                                      </Badge>
                                    </div>
                                    <p className="text-sm text-gray-600 mb-2">
                                      {document.content ? 
                                        document.content.substring(0, 200) + (document.content.length > 200 ? '...' : '') 
                                        : 'No content preview available'
                                      }
                                    </p>
                                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                                      <span>ID: {document.id}</span>
                                      {document.createdAt && (
                                        <span>Added: {new Date(document.createdAt).toLocaleDateString()}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => handleViewDocument(document)}
                                    title="View document content"
                                  >
                                    <Eye size={16} className="text-blue-500" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="sm">
                                        <Trash2 size={16} className="text-red-500" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Document</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to delete "{document.title}"? This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => bulkDeleteMutation.mutate([document.id])}
                                          className="bg-red-600 hover:bg-red-700"
                                        >
                                          Delete
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>

                        {totalPages > 1 && (
                          <div className="flex items-center justify-between border-t pt-4">
                            <div className="text-sm text-gray-600">
                              Showing {((currentPage - 1) * documentsPerPage) + 1} to {Math.min(currentPage * documentsPerPage, documents.length)} of {documents.length} documents
                            </div>
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                disabled={currentPage === 1}
                              >
                                Previous
                              </Button>
                              <span className="text-sm text-gray-600">
                                Page {currentPage} of {totalPages}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                disabled={currentPage === totalPages}
                              >
                                Next
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}