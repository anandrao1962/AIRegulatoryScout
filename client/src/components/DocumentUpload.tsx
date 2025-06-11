import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { JURISDICTION_INFO } from "@/types/agents";
import { 
  Upload, 
  FileText, 
  X, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  Database,
  Plus
} from "lucide-react";

interface DocumentUploadProps {
  className?: string;
}

interface UploadFile {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

interface UploadProgress {
  totalFiles: number;
  processedFiles: number;
  currentFile?: string;
  isProcessing: boolean;
}

export function DocumentUpload({ className }: DocumentUploadProps) {
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<string>("");
  const [customJurisdiction, setCustomJurisdiction] = useState<string>("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<UploadProgress | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch existing jurisdictions from the database
  const { data: existingJurisdictions = [] } = useQuery<Array<{id: string, name: string, documentCount: number}>>({
    queryKey: ['/api/jurisdictions'],
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ files, jurisdiction }: { files: File[], jurisdiction: string }) => {
      const formData = new FormData();
      formData.append('jurisdiction', jurisdiction);
      
      files.forEach(file => {
        formData.append('pdfs', file);
      });

      // Add timeout for long-running uploads (15 minutes for large batches)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 3600000); // 60 minute timeout for very large batches

      try {
        const response = await fetch('/api/documents/upload', {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.details || error.error || 'Upload failed');
        }

        return response.json();
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error('Upload is taking longer than expected but may still be processing in the background. Please check the documents page in a few minutes to see if they were successfully uploaded.');
        }
        throw error;
      }
    },
    onSuccess: (data) => {
      // Clear processing progress
      setProcessingProgress(null);
      
      toast({
        title: "Upload Successful",
        description: data.message,
        variant: "default",
      });
      
      if (data.errors && data.errors.length > 0) {
        toast({
          title: "Some files had issues",
          description: data.errors.join(', '),
          variant: "destructive",
        });
      }

      // Update file statuses
      setUploadFiles(prev => prev.map(f => ({ 
        ...f, 
        status: 'success' 
      })));

      // Refresh documents list
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      
      // Refresh agent sessions to show updated counts
      queryClient.invalidateQueries({ queryKey: ['/api/agents'] });
      
      // Refresh jurisdictions list to include any new custom jurisdictions
      queryClient.invalidateQueries({ queryKey: ['/api/jurisdictions'] });
      
      // Clear files after a delay
      setTimeout(() => {
        setUploadFiles([]);
        setUploadProgress(0);
      }, 2000);
    },
    onError: (error: Error) => {
      // Clear processing progress
      setProcessingProgress(null);
      
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
      
      setUploadFiles(prev => prev.map(f => ({ 
        ...f, 
        status: 'error',
        error: error.message 
      })));
    },
  });

  const processFiles = (files: File[]) => {
    if (files.length === 0) return;

    // Enforce 50 file maximum
    if (files.length > 50) {
      toast({
        title: "Too Many Files",
        description: `Maximum 50 files allowed per upload. Please select fewer files.`,
        variant: "destructive",
      });
      return;
    }

    // Validate file types
    const pdfFiles = files.filter(file => file.type === 'application/pdf');
    const invalidFiles = files.filter(file => file.type !== 'application/pdf');

    if (invalidFiles.length > 0) {
      toast({
        title: "Invalid Files",
        description: `Only PDF files are allowed. ${invalidFiles.length} files were ignored.`,
        variant: "destructive",
      });
    }

    // Add PDF files to upload list
    const newUploadFiles: UploadFile[] = pdfFiles.map(file => ({
      id: `${file.name}-${Date.now()}`,
      file,
      status: 'pending',
    }));

    setUploadFiles(prev => [...prev, ...newUploadFiles]);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    processFiles(files);
    
    // Clear input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(event.dataTransfer.files);
    processFiles(files);
  };

  const removeFile = (fileId: string) => {
    setUploadFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const handleUpload = async () => {
    const jurisdiction = showCustomInput ? customJurisdiction.trim() : selectedJurisdiction;
    
    if (!jurisdiction) {
      toast({
        title: "Jurisdiction Required",
        description: showCustomInput ? "Please enter a custom jurisdiction name." : "Please select a jurisdiction before uploading.",
        variant: "destructive",
      });
      return;
    }

    if (uploadFiles.length === 0) {
      toast({
        title: "No Files Selected",
        description: "Please select PDF files to upload.",
        variant: "destructive",
      });
      return;
    }

    const filesToUpload = uploadFiles.filter(f => f.status === 'pending').map(f => f.file);
    
    if (filesToUpload.length === 0) {
      toast({
        title: "No New Files",
        description: "All selected files have already been processed.",
        variant: "destructive",
      });
      return;
    }

    // Update file statuses to uploading
    setUploadFiles(prev => prev.map(f => 
      f.status === 'pending' ? { ...f, status: 'uploading' as const } : f
    ));

    // Initialize processing progress
    setProcessingProgress({
      totalFiles: filesToUpload.length,
      processedFiles: 0,
      isProcessing: true
    });

    uploadMutation.mutate({ 
      files: filesToUpload, 
      jurisdiction: jurisdiction 
    });
  };

  const getStatusIcon = (status: UploadFile['status']) => {
    switch (status) {
      case 'pending':
        return <FileText className="text-gray-400" size={16} />;
      case 'uploading':
        return <Loader2 className="text-blue-500 animate-spin" size={16} />;
      case 'success':
        return <CheckCircle className="text-green-500" size={16} />;
      case 'error':
        return <AlertCircle className="text-red-500" size={16} />;
    }
  };

  const getStatusColor = (status: UploadFile['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-gray-100';
      case 'uploading':
        return 'bg-blue-50 border-blue-200';
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
    }
  };

  const jurisdictionInfo = selectedJurisdiction ? 
    JURISDICTION_INFO[selectedJurisdiction as keyof typeof JURISDICTION_INFO] : null;

  return (
    <Card className={`p-6 ${className}`}>
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
          <Database className="text-white" size={20} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Document Upload</h2>
          <p className="text-sm text-gray-600">Upload PDF documents to train jurisdiction agents</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Jurisdiction Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select or Create Jurisdiction
          </label>
          
          <div className="flex items-center space-x-2 mb-3">
            <Button
              type="button"
              variant={!showCustomInput ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setShowCustomInput(false);
                setCustomJurisdiction("");
              }}
            >
              Predefined
            </Button>
            <Button
              type="button"
              variant={showCustomInput ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setShowCustomInput(true);
                setSelectedJurisdiction("");
              }}
            >
              <Plus size={16} className="mr-1" />
              Custom
            </Button>
          </div>

          {!showCustomInput ? (
            <Select value={selectedJurisdiction} onValueChange={setSelectedJurisdiction}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a jurisdiction..." />
              </SelectTrigger>
              <SelectContent>
                {/* Predefined jurisdictions with icons */}
                <SelectItem value="us-federal">🇺🇸 US Federal</SelectItem>
                <SelectItem value="california">🏛️ California</SelectItem>
                <SelectItem value="colorado">🏔️ Colorado</SelectItem>
                <SelectItem value="eu">🇪🇺 European Union</SelectItem>
                <SelectItem value="uk">🇬🇧 United Kingdom</SelectItem>
                <SelectItem value="germany">🇩🇪 Germany</SelectItem>
                
                {/* Dynamically added custom jurisdictions */}
                {(existingJurisdictions as Array<{id: string, name: string, documentCount: number}>)
                  .filter(jurisdiction => jurisdiction.id && !['us-federal', 'california', 'colorado', 'eu', 'uk', 'germany'].includes(jurisdiction.id))
                  .map((jurisdiction) => (
                    <SelectItem key={`custom-${jurisdiction.id}`} value={jurisdiction.id}>
                      📋 {jurisdiction.name.charAt(0).toUpperCase() + jurisdiction.name.slice(1)} ({jurisdiction.documentCount} docs)
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Enter custom jurisdiction name (e.g., Singapore, Canada, etc.)"
                value={customJurisdiction}
                onChange={(e) => setCustomJurisdiction(e.target.value)}
                className="w-full"
              />
              <p className="text-xs text-gray-500">
                Create a new jurisdiction to organize documents by region, country, or organization
              </p>
            </div>
          )}
          
          {jurisdictionInfo && !showCustomInput && (
            <div className="mt-2 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2 mb-1">
                <img 
                  src={jurisdictionInfo.flag} 
                  alt={`${jurisdictionInfo.name} Flag`} 
                  className="w-5 h-3 rounded object-cover"
                />
                <span className="text-sm font-medium text-gray-900">
                  {jurisdictionInfo.name}
                </span>
              </div>
              <p className="text-xs text-gray-600">{jurisdictionInfo.description}</p>
            </div>
          )}

          {showCustomInput && customJurisdiction.trim() && (
            <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center space-x-2 mb-1">
                <Plus size={16} className="text-blue-600" />
                <span className="text-sm font-medium text-blue-900">
                  {customJurisdiction.trim()}
                </span>
              </div>
              <p className="text-xs text-blue-600">New custom jurisdiction will be created</p>
            </div>
          )}
        </div>

        {/* File Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select PDF Files
          </label>
          <div 
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
              isDragOver 
                ? 'border-primary bg-primary/10' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="mx-auto text-gray-400 mb-2" size={24} />
            <p className="text-sm text-gray-600 mb-1">
              Click to select PDF files or drag and drop
            </p>
            <p className="text-xs text-gray-500">
              Maximum 50 files, 100MB each
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* File List */}
        {uploadFiles.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Selected Files ({uploadFiles.length})
            </label>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {uploadFiles.map((uploadFile) => (
                <div 
                  key={uploadFile.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${getStatusColor(uploadFile.status)}`}
                >
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    {getStatusIcon(uploadFile.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {uploadFile.file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(uploadFile.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      {uploadFile.error && (
                        <p className="text-xs text-red-600 mt-1">{uploadFile.error}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Badge 
                      variant={uploadFile.status === 'success' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {uploadFile.status.toUpperCase()}
                    </Badge>
                    {uploadFile.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(uploadFile.id)}
                        className="h-6 w-6 p-0"
                      >
                        <X size={12} />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload Progress */}
        {uploadMutation.isPending && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center space-x-3 mb-3">
              <Loader2 className="animate-spin text-blue-600" size={20} />
              <div>
                <p className="text-sm font-medium text-blue-900">Processing documents...</p>
                <p className="text-xs text-blue-600">Extracting text and generating embeddings</p>
              </div>
            </div>
            <div className="space-y-2">
              {processingProgress ? (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-blue-700">
                    {processingProgress.processedFiles} out of {processingProgress.totalFiles} documents processed
                  </span>
                  <span className="text-blue-600">
                    {Math.round((processingProgress.processedFiles / processingProgress.totalFiles) * 100)}%
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-blue-700">Large documents may take 1-2 minutes</span>
                  <span className="text-blue-600">Please wait...</span>
                </div>
              )}
              <Progress 
                value={processingProgress ? (processingProgress.processedFiles / processingProgress.totalFiles) * 100 : 15} 
                className="w-full h-2" 
              />
            </div>
          </div>
        )}

        {/* Upload Button */}
        <Button
          onClick={handleUpload}
          disabled={(!showCustomInput && !selectedJurisdiction) || (showCustomInput && !customJurisdiction.trim()) || uploadFiles.length === 0 || uploadMutation.isPending}
          className="w-full"
          size="lg"
        >
          {uploadMutation.isPending ? (
            <>
              <Loader2 className="animate-spin mr-2" size={16} />
              Processing {uploadFiles.filter(f => f.status === 'uploading').length} files... (This may take 1-2 minutes)
            </>
          ) : (
            <>
              <Upload className="mr-2" size={16} />
              Upload {uploadFiles.filter(f => f.status === 'pending').length} PDF Files
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}