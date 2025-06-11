import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { CloudDownload, ExternalLink, FileText, Loader2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

interface GoogleDriveSyncProps {
  onSyncComplete?: () => void;
}

interface SyncResult {
  downloaded: number;
  processed: number;
  errors: string[];
  newFiles: string[];
  updatedFiles: string[];
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size: string;
}

export function GoogleDriveSync({ onSyncComplete }: GoogleDriveSyncProps) {
  const [folderId, setFolderId] = useState('');
  const [jurisdiction, setJurisdiction] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [refreshToken, setRefreshToken] = useState('');
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  // Get available jurisdictions
  const { data: jurisdictions } = useQuery({
    queryKey: ['/api/jurisdictions'],
  });

  // Get authorization URL
  const authUrlMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/google-drive/auth-url');
      return response.json();
    },
    onSuccess: (response: { authUrl: string }) => {
      window.open(response.authUrl, '_blank', 'width=500,height=600');
    },
  });

  // Preview files in folder
  const previewFilesMutation = useMutation({
    mutationFn: async ({ folderId, refreshToken }: { folderId: string; refreshToken: string }) => {
      const response = await fetch(`/api/google-drive/folders/${folderId}/files?refreshToken=${encodeURIComponent(refreshToken)}`);
      return response.json();
    },
  });

  // Sync documents from Google Drive
  const syncMutation = useMutation({
    mutationFn: async ({ folderId, jurisdiction, refreshToken }: { folderId: string; jurisdiction: string; refreshToken: string }) => {
      const response = await fetch('/api/google-drive/sync', {
        method: 'POST',
        body: JSON.stringify({ folderId, jurisdiction, refreshToken }),
        headers: { 'Content-Type': 'application/json' },
      });
      return response.json();
    },
    onSuccess: (response: { result: SyncResult }) => {
      setSyncResult(response.result);
      onSyncComplete?.();
    },
  });

  const handleAuthorize = () => {
    authUrlMutation.mutate();
  };

  const handlePreviewFiles = () => {
    if (!folderId || !refreshToken) return;
    previewFilesMutation.mutate({ folderId, refreshToken });
  };

  const handleSync = () => {
    if (!folderId || !jurisdiction || !refreshToken) return;
    syncMutation.mutate({ folderId, jurisdiction, refreshToken });
  };

  const extractFolderIdFromUrl = (url: string): string => {
    const match = url.match(/folders\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : url;
  };

  const handleFolderIdChange = (value: string) => {
    const extractedId = extractFolderIdFromUrl(value);
    setFolderId(extractedId);
  };

  const formatFileSize = (size: string): string => {
    const bytes = parseInt(size || '0');
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileTypeIcon = (mimeType: string) => {
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('document')) return '📝';
    if (mimeType.includes('spreadsheet')) return '📊';
    if (mimeType.includes('text')) return '📋';
    return '📁';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CloudDownload size={20} />
          Google Drive Integration
        </CardTitle>
        <CardDescription>
          Sync documents directly from your Google Drive folder to automatically update your regulatory knowledge base.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Step 1: Authorization */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
              isAuthorized ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
            }`}>
              {isAuthorized ? <CheckCircle size={16} /> : '1'}
            </div>
            <Label className="text-sm font-medium">Authorize Google Drive Access</Label>
          </div>
          
          {!isAuthorized ? (
            <div className="ml-8">
              <Button
                onClick={handleAuthorize}
                disabled={authUrlMutation.isPending}
                variant="outline"
                size="sm"
              >
                {authUrlMutation.isPending ? (
                  <Loader2 size={16} className="mr-2 animate-spin" />
                ) : (
                  <ExternalLink size={16} className="mr-2" />
                )}
                Authorize Google Drive
              </Button>
              <p className="text-xs text-gray-600 mt-1">
                Opens a new window for secure Google authentication
              </p>
            </div>
          ) : (
            <div className="ml-8">
              <Badge variant="secondary" className="text-green-700 bg-green-50">
                <CheckCircle size={12} className="mr-1" />
                Authorized
              </Badge>
            </div>
          )}
        </div>

        <Separator />

        {/* Step 2: Refresh Token */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
              refreshToken ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
            }`}>
              {refreshToken ? <CheckCircle size={16} /> : '2'}
            </div>
            <Label className="text-sm font-medium">Authentication Token</Label>
          </div>
          
          <div className="ml-8 space-y-2">
            <Input
              type="password"
              placeholder="Paste your Google Drive refresh token here"
              value={refreshToken}
              onChange={(e) => {
                setRefreshToken(e.target.value);
                setIsAuthorized(!!e.target.value);
              }}
              className="font-mono text-xs"
            />
            <p className="text-xs text-gray-600">
              After authorization, copy the refresh token from the callback URL or your application settings
            </p>
          </div>
        </div>

        <Separator />

        {/* Step 3: Folder Configuration */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
              folderId && jurisdiction ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
            }`}>
              {folderId && jurisdiction ? <CheckCircle size={16} /> : '3'}
            </div>
            <Label className="text-sm font-medium">Configure Sync Settings</Label>
          </div>
          
          <div className="ml-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="folder-id" className="text-xs">Google Drive Folder</Label>
              <Input
                id="folder-id"
                placeholder="Paste folder URL or folder ID"
                value={folderId}
                onChange={(e) => handleFolderIdChange(e.target.value)}
              />
              <p className="text-xs text-gray-600">
                Example: https://drive.google.com/drive/folders/1AbC2DeFgHiJkLmNoPqRsTuVwXyZ
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="jurisdiction" className="text-xs">Target Jurisdiction</Label>
              <Select value={jurisdiction} onValueChange={setJurisdiction}>
                <SelectTrigger>
                  <SelectValue placeholder="Select jurisdiction for these documents" />
                </SelectTrigger>
                <SelectContent>
                  {jurisdictions?.map((j: any) => (
                    <SelectItem key={j.name} value={j.name}>
                      {j.name.toUpperCase().replace('-', ' ')} ({j.documentCount} docs)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {folderId && refreshToken && (
              <Button
                onClick={handlePreviewFiles}
                disabled={previewFilesMutation.isPending}
                variant="outline"
                size="sm"
              >
                {previewFilesMutation.isPending ? (
                  <Loader2 size={16} className="mr-2 animate-spin" />
                ) : (
                  <FileText size={16} className="mr-2" />
                )}
                Preview Files
              </Button>
            )}
          </div>
        </div>

        {/* File Preview */}
        {previewFilesMutation.data && (
          <div className="ml-8 mt-4">
            <h4 className="text-sm font-medium mb-2">Files in Folder:</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {(previewFilesMutation.data.files as DriveFile[]).map((file) => (
                <div key={file.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs">
                  <div className="flex items-center gap-2">
                    <span>{getFileTypeIcon(file.mimeType)}</span>
                    <span className="font-medium">{file.name}</span>
                  </div>
                  <span className="text-gray-500">{formatFileSize(file.size)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* Step 4: Sync */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-medium">
              <RefreshCw size={16} />
            </div>
            <Label className="text-sm font-medium">Sync Documents</Label>
          </div>
          
          <div className="ml-8">
            <Button
              onClick={handleSync}
              disabled={!folderId || !jurisdiction || !refreshToken || syncMutation.isPending}
              className="w-full"
            >
              {syncMutation.isPending ? (
                <Loader2 size={16} className="mr-2 animate-spin" />
              ) : (
                <CloudDownload size={16} className="mr-2" />
              )}
              Sync Documents from Google Drive
            </Button>
          </div>
        </div>

        {/* Sync Results */}
        {syncResult && (
          <Alert>
            <CheckCircle size={16} />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">Sync completed successfully!</p>
                <div className="text-sm space-y-1">
                  <p>• Downloaded: {syncResult.downloaded} files</p>
                  <p>• Processed: {syncResult.processed} documents</p>
                  {syncResult.newFiles.length > 0 && (
                    <p>• New files: {syncResult.newFiles.join(', ')}</p>
                  )}
                  {syncResult.updatedFiles.length > 0 && (
                    <p>• Updated files: {syncResult.updatedFiles.join(', ')}</p>
                  )}
                  {syncResult.errors.length > 0 && (
                    <div className="text-red-600">
                      <p>• Errors:</p>
                      <ul className="list-disc ml-4">
                        {syncResult.errors.map((error, i) => (
                          <li key={i} className="text-xs">{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Error Display */}
        {(authUrlMutation.error || previewFilesMutation.error || syncMutation.error) && (
          <Alert variant="destructive">
            <XCircle size={16} />
            <AlertDescription>
              {authUrlMutation.error?.message || 
               previewFilesMutation.error?.message || 
               syncMutation.error?.message}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}