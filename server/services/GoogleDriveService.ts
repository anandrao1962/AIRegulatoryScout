import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import { documentProcessor } from '../rag/DocumentProcessor';
import { storage } from '../storage';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size: string;
}

export interface SyncResult {
  downloaded: number;
  processed: number;
  errors: string[];
  newFiles: string[];
  updatedFiles: string[];
}

export class GoogleDriveService {
  private drive: any;
  private oauth2Client: OAuth2Client;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/auth/google/callback'
    );

    this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * Generate OAuth URL for user authentication
   */
  getAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.metadata.readonly'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  /**
   * Set credentials from OAuth callback
   */
  async setCredentials(code: string): Promise<void> {
    const response = await this.oauth2Client.getAccessToken(code);
    const tokens = response.tokens;
    this.oauth2Client.setCredentials(tokens);
    
    // Store refresh token securely (in production, use encrypted storage)
    if (tokens.refresh_token) {
      process.env.GOOGLE_REFRESH_TOKEN = tokens.refresh_token;
    }
  }

  /**
   * Initialize with stored refresh token
   */
  async initializeWithRefreshToken(refreshToken: string): Promise<void> {
    this.oauth2Client.setCredentials({
      refresh_token: refreshToken
    });
    
    // Refresh access token
    await this.oauth2Client.getAccessToken();
  }

  /**
   * List files in a Google Drive folder
   */
  async listFilesInFolder(folderId: string): Promise<DriveFile[]> {
    try {
      const response = await this.drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'files(id,name,mimeType,modifiedTime,size)',
        orderBy: 'modifiedTime desc'
      });

      return response.data.files || [];
    } catch (error) {
      console.error('Error listing Drive files:', error);
      throw new Error('Failed to list files from Google Drive');
    }
  }

  /**
   * Download and process files from Google Drive folder
   */
  async syncFolderDocuments(folderId: string, jurisdiction: string): Promise<SyncResult> {
    const result: SyncResult = {
      downloaded: 0,
      processed: 0,
      errors: [],
      newFiles: [],
      updatedFiles: []
    };

    try {
      const files = await this.listFilesInFolder(folderId);
      console.log(`Found ${files.length} files in Google Drive folder`);

      // Filter for supported document types
      const supportedFiles = files.filter(file => 
        this.isSupportedFileType(file.mimeType) && 
        parseInt(file.size || '0') > 0 // Skip empty files
      );

      console.log(`Processing ${supportedFiles.length} supported files`);

      for (const file of supportedFiles) {
        try {
          // Check if file already exists and is up to date
          const existingDocs = await storage.searchDocuments(
            file.name, 
            [jurisdiction], 
            1
          );
          
          const existingDoc = existingDocs.find(doc => 
            doc.title === file.name && doc.jurisdiction === jurisdiction
          );

          // Skip if file hasn't been modified since last sync
          if (existingDoc) {
            const driveModified = new Date(file.modifiedTime);
            const localModified = existingDoc.createdAt;
            
            if (driveModified <= localModified) {
              console.log(`Skipping ${file.name} - no changes detected`);
              continue;
            }
            
            result.updatedFiles.push(file.name);
          } else {
            result.newFiles.push(file.name);
          }

          // Download and process the file
          const content = await this.downloadFileContent(file.id, file.mimeType);
          result.downloaded++;

          // Create document record
          const documentData = {
            title: file.name,
            content,
            jurisdiction,
            documentType: this.getDocumentType(file.mimeType),
            sourceUrl: `https://drive.google.com/file/d/${file.id}/view`
          };

          // Delete existing document if updating
          if (existingDoc) {
            await storage.deleteDocument(existingDoc.id);
          }

          // Process and store the document
          await documentProcessor.processDocument(documentData);
          result.processed++;

          console.log(`Successfully processed: ${file.name}`);
          
        } catch (error) {
          const errorMsg = `Failed to process ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(errorMsg);
          result.errors.push(errorMsg);
        }
      }

    } catch (error) {
      const errorMsg = `Failed to sync folder: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMsg);
      result.errors.push(errorMsg);
    }

    return result;
  }

  /**
   * Download file content from Google Drive
   */
  private async downloadFileContent(fileId: string, mimeType: string): Promise<string> {
    try {
      let response;

      // Handle Google Docs formats by exporting to text
      if (mimeType === 'application/vnd.google-apps.document') {
        response = await this.drive.files.export({
          fileId,
          mimeType: 'text/plain'
        });
      } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
        response = await this.drive.files.export({
          fileId,
          mimeType: 'text/csv'
        });
      } else {
        // Download regular files
        response = await this.drive.files.get({
          fileId,
          alt: 'media'
        });
      }

      if (typeof response.data === 'string') {
        return response.data;
      } else if (Buffer.isBuffer(response.data)) {
        return response.data.toString('utf-8');
      } else {
        throw new Error('Unexpected response format');
      }

    } catch (error) {
      console.error(`Error downloading file ${fileId}:`, error);
      throw new Error(`Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if file type is supported
   */
  private isSupportedFileType(mimeType: string): boolean {
    const supportedTypes = [
      'text/plain',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.google-apps.document',
      'application/vnd.google-apps.spreadsheet'
    ];

    return supportedTypes.includes(mimeType);
  }

  /**
   * Get document type from MIME type
   */
  private getDocumentType(mimeType: string): string {
    switch (mimeType) {
      case 'application/pdf':
        return 'PDF';
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/msword':
        return 'Word Document';
      case 'application/vnd.google-apps.document':
        return 'Google Doc';
      case 'application/vnd.google-apps.spreadsheet':
        return 'Google Sheet';
      case 'text/plain':
        return 'Text File';
      default:
        return 'Document';
    }
  }

  /**
   * Test Google Drive connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.drive.about.get({ fields: 'user' });
      return true;
    } catch (error) {
      console.error('Google Drive connection test failed:', error);
      return false;
    }
  }
}

export const googleDriveService = new GoogleDriveService();