import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  TestTube
} from "lucide-react";

interface OCRTestProps {
  className?: string;
}

interface TestResult {
  filename: string;
  method: string;
  confidence: number;
  textLength: number;
  preview: string;
  success: boolean;
  error?: string;
  details?: string;
}

export function OCRTestComponent({ className }: OCRTestProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast({
        title: "Invalid File",
        description: "Please select a PDF file.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setTestResult(null);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('pdf', file);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const response = await fetch('/api/test-ocr', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const result = await response.json();

      if (response.ok) {
        setTestResult(result);
        toast({
          title: "OCR Test Complete",
          description: `Extracted ${result.textLength} characters using ${result.method}`,
          variant: "default",
        });
      } else {
        setTestResult({
          filename: file.name,
          method: 'failed',
          confidence: 0,
          textLength: 0,
          preview: '',
          success: false,
          error: result.error,
          details: result.details
        });
        toast({
          title: "OCR Test Failed",
          description: result.error || "Unknown error occurred",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      setTestResult({
        filename: file.name,
        method: 'failed',
        confidence: 0,
        textLength: 0,
        preview: '',
        success: false,
        error: 'Network error',
        details: error.message
      });
      toast({
        title: "Test Failed",
        description: "Failed to connect to server",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Clear input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const getMethodBadgeColor = (method: string) => {
    switch (method) {
      case 'standard':
      case 'alternative':
      case 'raw':
      case 'minimal':
        return 'bg-green-100 text-green-800';
      case 'tesseract-ocr':
        return 'bg-blue-100 text-blue-800';
      case 'fallback':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    if (confidence >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <Card className={`p-6 ${className}`}>
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
          <TestTube className="text-white" size={20} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">OCR Test Tool</h2>
          <p className="text-sm text-gray-600">Test PDF text extraction and OCR functionality</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* File Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select PDF for Testing
          </label>
          <div 
            className="border-2 border-dashed border-purple-300 rounded-lg p-6 text-center transition-colors cursor-pointer hover:border-purple-400"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mx-auto text-purple-400 mb-2" size={24} />
            <p className="text-sm text-gray-600 mb-1">
              Click to select a PDF file for OCR testing
            </p>
            <p className="text-xs text-gray-500">
              Test both regular PDFs and scanned documents
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />
        </div>

        {/* Upload Progress */}
        {isUploading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Processing PDF...</span>
              <span className="text-sm text-gray-500">{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="w-full" />
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Loader2 className="animate-spin" size={16} />
              <span>Analyzing document and extracting text</span>
            </div>
          </div>
        )}

        {/* Test Results */}
        {testResult && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-md font-semibold text-gray-900">Test Results</h3>
              {testResult.success ? (
                <CheckCircle className="text-green-500" size={20} />
              ) : (
                <AlertCircle className="text-red-500" size={20} />
              )}
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">File</label>
                  <p className="text-sm text-gray-900 truncate">{testResult.filename}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Method</label>
                  <div className="flex items-center space-x-2">
                    <Badge className={getMethodBadgeColor(testResult.method)}>
                      {testResult.method}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Confidence</label>
                  <p className={`text-sm font-medium ${getConfidenceColor(testResult.confidence)}`}>
                    {testResult.confidence}%
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Text Length</label>
                  <p className="text-sm text-gray-900">{testResult.textLength.toLocaleString()} characters</p>
                </div>
              </div>

              {testResult.success && testResult.preview && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                    Extracted Text Preview
                  </label>
                  <div className="bg-white border rounded p-3 max-h-40 overflow-y-auto">
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap">{testResult.preview}</pre>
                  </div>
                </div>
              )}

              {!testResult.success && (
                <div>
                  <label className="text-xs font-medium text-red-500 uppercase tracking-wide mb-2 block">
                    Error Details
                  </label>
                  <div className="bg-red-50 border border-red-200 rounded p-3">
                    <p className="text-sm text-red-700">{testResult.error}</p>
                    {testResult.details && (
                      <p className="text-xs text-red-600 mt-1">{testResult.details}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Method Descriptions */}
        <div className="bg-blue-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-900 mb-2">Extraction Methods</h4>
          <div className="text-xs text-blue-700 space-y-1">
            <p><strong>Standard/Alternative/Raw/Minimal:</strong> Direct PDF text extraction (fast, high quality)</p>
            <p><strong>Tesseract OCR:</strong> Image-based text recognition for scanned documents (slower, good for images)</p>
            <p><strong>Fallback:</strong> Minimal text recovery when other methods fail</p>
          </div>
        </div>
      </div>
    </Card>
  );
}