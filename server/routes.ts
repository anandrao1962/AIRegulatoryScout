import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import multer from "multer";
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
import { createWorker } from "tesseract.js";
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { storage } from "./storage";
import { MasterAgent, type MasterAgentResponse } from "./agents/MasterAgent";
import { JurisdictionAgent } from "./agents/JurisdictionAgent";
import { documentProcessor } from "./rag/DocumentProcessor";
import { QueryRequestSchema, QueryResponseSchema, type QueryRequest } from "@shared/schema";
import { googleDriveService } from './services/GoogleDriveService';

// Initialize agents
const jurisdictionAgents = new Map<string, JurisdictionAgent>();

// US Federal Agent
jurisdictionAgents.set('us-federal', new JurisdictionAgent({
  id: 'us-federal',
  name: 'US Federal Agent',
  jurisdiction: 'us-federal',
  specialization: ['NIST', 'executive orders', 'federal AI policy', 'risk management'],
  systemPrompt: `You are a specialized AI regulation expert focused on US Federal AI policies and regulations. You have deep knowledge of:
- NIST AI Risk Management Framework (AI RMF 1.0)
- Executive Orders on AI (particularly EO 14110)
- Federal agency guidance on AI
- Sector-specific AI regulations in the US
- Voluntary AI standards and best practices

Provide accurate, detailed responses based on official US federal AI regulations and guidance. Always cite specific documents and requirements when available.`,
  temperature: 0.3,
  maxTokens: 1000,
}));

// California Agent
jurisdictionAgents.set('california', new JurisdictionAgent({
  id: 'california',
  name: 'California Agent',
  jurisdiction: 'california',
  specialization: ['SB-1001', 'CCPA', 'state privacy laws', 'bot disclosure'],
  systemPrompt: `You are a specialized AI regulation expert focused on California state AI and privacy laws. You have deep knowledge of:
- SB-1001 (Bot Disclosure Law)
- California Consumer Privacy Act (CCPA) and its AI implications
- California privacy regulations affecting AI
- State-level AI governance initiatives
- Consumer protection laws related to AI

Provide accurate, detailed responses based on California state laws and regulations affecting AI systems. Always cite specific statutes and requirements when available.`,
  temperature: 0.3,
  maxTokens: 1000,
}));

// Colorado Agent
jurisdictionAgents.set('colorado', new JurisdictionAgent({
  id: 'colorado',
  name: 'Colorado Agent',
  jurisdiction: 'colorado',
  specialization: ['SB25-318', 'HB25-1212', 'AI consumer protections', 'biometric technologies', 'pricing coordination'],
  systemPrompt: `You are a specialized AI regulation expert focused on Colorado state AI and consumer protection laws. You have deep knowledge of:
- SB25-318 (AI Consumer Protections)
- HB25-1212 (Public Safety Protections Artificial Intelligence)
- HB24-1468 (Artificial Intelligence & Biometric Technologies)
- HB25-1004 (No Pricing Coordination Between Landlords)
- HB25-1264 (Prohibit Surveillance Data to Set Prices and Wages)
- Colorado consumer protection laws related to AI
- State-level AI governance and public safety initiatives

Provide accurate, detailed responses based on Colorado state laws and regulations affecting AI systems. Always cite specific statutes and requirements when available.`,
  temperature: 0.3,
  maxTokens: 1000,
}));

// EU Agent
jurisdictionAgents.set('eu', new JurisdictionAgent({
  id: 'eu',
  name: 'European Union Agent',
  jurisdiction: 'eu',
  specialization: ['AI Act', 'GDPR', 'high-risk AI', 'conformity assessment'],
  systemPrompt: `You are a specialized AI regulation expert focused on European Union AI regulations. You have deep knowledge of:
- EU AI Act (Regulation 2024/1689)
- GDPR implications for AI systems
- High-risk AI system requirements
- CE marking and conformity assessments
- AI governance across EU member states
- Prohibited AI practices under EU law

Provide accurate, detailed responses based on official EU AI regulations and directives. Always cite specific articles and requirements when available.`,
  temperature: 0.3,
  maxTokens: 1000,
}));

// UK Agent
jurisdictionAgents.set('uk', new JurisdictionAgent({
  id: 'uk',
  name: 'United Kingdom Agent',
  jurisdiction: 'uk',
  specialization: ['AI White Paper', 'principles-based regulation', 'data protection'],
  systemPrompt: `You are a specialized AI regulation expert focused on United Kingdom AI governance. You have deep knowledge of:
- UK AI White Paper and pro-innovation approach
- Principles-based AI regulation
- UK Data Protection Act and AI implications
- Sectoral AI guidance from UK regulators
- AI governance frameworks in the UK
- Cross-border AI regulation considerations

Provide accurate, detailed responses based on official UK AI policies and guidance. Always cite specific documents and principles when available.`,
  temperature: 0.3,
  maxTokens: 1000,
}));

// Germany Agent
jurisdictionAgents.set('germany', new JurisdictionAgent({
  id: 'germany',
  name: 'Germany Agent',
  jurisdiction: 'germany',
  specialization: ['BDSG', 'AGG', 'ProdHaftG', 'UrhG', 'AI Act implementation'],
  systemPrompt: `You are a specialized AI regulation expert focused on German AI and data protection laws. You have deep knowledge of:
- German implementation of the EU AI Act
- Bundesdatenschutzgesetz (BDSG) - Federal Data Protection Act
- Allgemeines Gleichbehandlungsgesetz (AGG) - General Equal Treatment Act
- Produkthaftungsgesetz (ProdHaftG) - Product Liability Act
- Urheberrechtsgesetz (UrhG) - Copyright Act
- German federal and state AI governance initiatives
- Consumer protection and liability laws affecting AI systems

Provide accurate, detailed responses based on German laws and regulations affecting AI systems. Always cite specific statutes and requirements when available.`,
  temperature: 0.3,
  maxTokens: 1000,
}));

// Master Agent
const masterAgent = new MasterAgent({
  id: 'master',
  name: 'Master Agent',
  jurisdictionAgents,
  systemPrompt: `You are a master AI regulation analyst with expertise across multiple jurisdictions. Your role is to:
- Coordinate queries between jurisdiction-specific agents
- Provide comprehensive comparative analysis
- Identify key differences and similarities across jurisdictions
- Offer strategic insights for cross-border AI compliance
- Synthesize complex regulatory information into actionable guidance

You work with specialized agents for US Federal, California, EU, and UK regulations. Provide clear, comparative insights that help users understand the regulatory landscape across jurisdictions.`,
  temperature: 0.5,
  maxTokens: 1500,
});

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for large regulatory documents
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

// Simplified OCR function using system pdftoppm command
async function extractTextWithOCR(pdfBuffer: Buffer, filename: string): Promise<string> {
  console.log(`[OCR] Starting OCR processing for ${filename}`);
  
  const tempDir = path.join(os.tmpdir(), 'pdf-ocr-' + Date.now());
  const pdfPath = path.join(tempDir, filename);
  
  try {
    // Create temporary directory
    await fs.promises.mkdir(tempDir, { recursive: true });
    
    // Write PDF buffer to temporary file
    await fs.promises.writeFile(pdfPath, pdfBuffer);
    console.log(`[OCR] Saved PDF to temporary file: ${pdfPath}`);
    
    // Use system command to convert PDF to images
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    console.log(`[OCR] Converting PDF to images using pdftoppm...`);
    const outputPrefix = path.join(tempDir, 'page');
    
    // Convert first 3 pages to PNG images (limit for performance and cost)
    try {
      await execAsync(`pdftoppm -png -f 1 -l 3 -r 150 "${pdfPath}" "${outputPrefix}"`);
    } catch (conversionError: any) {
      console.log(`[OCR] PDF conversion failed: ${conversionError.message}`);
      // Try with just the first page if full conversion fails
      try {
        console.log(`[OCR] Retrying with first page only...`);
        await execAsync(`pdftoppm -png -f 1 -l 1 -r 150 "${pdfPath}" "${outputPrefix}"`);
      } catch (singlePageError: any) {
        throw new Error(`PDF to image conversion failed: ${singlePageError.message}`);
      }
    }
    
    // Find generated image files
    const files = await fs.promises.readdir(tempDir);
    const imageFiles = files.filter(f => f.endsWith('.png')).sort();
    console.log(`[OCR] Generated ${imageFiles.length} image files`);
    
    if (imageFiles.length === 0) {
      throw new Error('No images were generated from PDF');
    }
    
    // Initialize Tesseract worker with German and English support
    console.log(`[OCR] Initializing Tesseract worker for German and English text recognition...`);
    const worker = await createWorker(['deu', 'eng'], 1, {
      logger: m => {
        if (m.status === 'recognizing text') {
          console.log(`[OCR] Text recognition progress: ${Math.round(m.progress * 100)}%`);
        } else if (m.status === 'loading language traineddata') {
          console.log(`[OCR] Loading language models: ${m.userJobId}`);
        }
      }
    });
    
    let allText = '';
    
    // Process each image with OCR
    for (let i = 0; i < imageFiles.length; i++) {
      const imagePath = path.join(tempDir, imageFiles[i]);
      console.log(`[OCR] Processing page ${i + 1}/${imageFiles.length}: ${imageFiles[i]}`);
      
      try {
        const { data: { text } } = await worker.recognize(imagePath);
        const cleanPageText = text.trim();
        
        if (cleanPageText.length > 0) {
          allText += cleanPageText + '\n\n';
          console.log(`[OCR] Page ${i + 1}: extracted ${cleanPageText.length} characters`);
        }
      } catch (pageError: any) {
        console.log(`[OCR] Failed to process page ${i + 1}: ${pageError.message}`);
      }
    }
    
    await worker.terminate();
    
    const finalText = allText.trim();
    console.log(`[OCR] Total extracted text: ${finalText.length} characters from ${filename}`);
    
    return finalText;
    
  } catch (error: any) {
    console.error(`[OCR] Error processing ${filename}:`, error.message);
    throw new Error(`OCR processing failed: ${error.message}`);
  } finally {
    // Clean up temporary files
    try {
      if (fs.existsSync(tempDir)) {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
        console.log(`[OCR] Cleaned up temporary directory: ${tempDir}`);
      }
    } catch (cleanupError: any) {
      console.log(`[OCR] Warning: Failed to clean up temporary files: ${cleanupError.message}`);
    }
  }
}

// Enhanced PDF text extraction with detailed diagnostics
async function analyzeAndExtractPDF(pdfBuffer: Buffer, filename: string): Promise<{ text: string; method: string; confidence: number }> {
  try {
    // Method 1: Enhanced pdf-parse with multiple attempts
    const results = [];
    const diagnostics = [];
    
    // Try different parsing configurations
    const parseConfigs = [
      { name: 'standard', config: { normalizeWhitespace: true, disableCombineTextItems: false } },
      { name: 'alternative', config: { normalizeWhitespace: false, disableCombineTextItems: true } },
      { name: 'raw', config: { normalizeWhitespace: false, disableCombineTextItems: false } },
      { name: 'minimal', config: {} },
    ];
    
    for (const { name, config } of parseConfigs) {
      try {
        const pdfData = await pdfParse(pdfBuffer, config);
        const extractedText = pdfData.text || '';
        const cleanText = extractedText.trim();
        
        diagnostics.push({
          method: name,
          textLength: extractedText.length,
          cleanTextLength: cleanText.length,
          pages: pdfData.numpages || 0,
          info: pdfData.info || {},
          sample: extractedText.substring(0, 100)
        });
        
        if (cleanText.length > 50) {
          // Analyze text quality
          const wordCount = cleanText.split(/\s+/).length;
          const averageWordLength = cleanText.replace(/\s+/g, '').length / wordCount;
          
          // Good text typically has reasonable word lengths and structure
          const confidence = Math.min(100, (wordCount * averageWordLength) / cleanText.length * 100);
          
          results.push({
            text: cleanText,
            method: `pdf-parse-${name}`,
            confidence: confidence,
            wordCount: wordCount
          });
        }
      } catch (configError: any) {
        diagnostics.push({
          method: name,
          error: configError.message,
          textLength: 0,
          cleanTextLength: 0
        });
        continue;
      }
    }
    
    // Log detailed diagnostics
    console.log(`[PDF] Extraction diagnostics for ${filename}:`);
    diagnostics.forEach(diag => {
      if (diag.error) {
        console.log(`  ${diag.method}: ERROR - ${diag.error}`);
      } else {
        console.log(`  ${diag.method}: ${diag.textLength} chars (${diag.cleanTextLength} clean), ${diag.pages} pages`);
        if (diag.sample) {
          console.log(`    Sample: "${diag.sample}"`);
        }
        if (diag.info) {
          console.log(`    PDF Info:`, JSON.stringify(diag.info, null, 2));
        }
      }
    });
    
    // Return the best result
    if (results.length > 0) {
      const bestResult = results.sort((a, b) => b.confidence - a.confidence)[0];
      console.log(`[PDF] Successfully extracted ${bestResult.text.length} characters with confidence ${bestResult.confidence.toFixed(1)}%`);
      return bestResult;
    }
    
    // If no good text found, try basic fallback
    const bestDiagnostic = diagnostics.find(d => d.textLength > 0) || diagnostics[0];
    console.log(`[PDF] Standard extraction yielded minimal text for: ${filename}`);
    
    // Try OCR for scanned documents (but don't crash if it fails)
    try {
      console.log(`[PDF] Attempting OCR extraction for scanned document: ${filename}`);
      const ocrText = await extractTextWithOCR(pdfBuffer, filename);
      if (ocrText && ocrText.trim().length > 50) { // Lower threshold for OCR text
        console.log(`[PDF] OCR successful! Extracted ${ocrText.length} characters from ${filename}`);
        return {
          text: ocrText.trim(),
          method: 'tesseract-ocr',
          confidence: 85 // OCR confidence estimate
        };
      } else {
        console.log(`[PDF] OCR extracted only ${ocrText?.length || 0} characters, not sufficient`);
      }
    } catch (ocrError: any) {
      console.log(`[PDF] OCR failed: ${ocrError.message}`);
    }
    
    // Return whatever we have, even if it's minimal
    const fallbackText = bestDiagnostic?.sample || `Document: ${filename} (text extraction failed)`;
    console.log(`[PDF] Returning fallback text for ${filename}: ${fallbackText.length} characters`);
    
    return {
      text: fallbackText,
      method: 'fallback',
      confidence: 10 // Low confidence for fallback
    };
    
  } catch (error: any) {
    console.error(`[PDF] Enhanced extraction failed for ${filename}:`, error.message);
    throw error;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Priority routes - must be registered first to avoid Vite middleware conflicts
  
  // Health check endpoint for monitoring
  app.get("/api/health", async (req, res) => {
    try {
      // Check database connection
      const agents = await storage.getAllAgentSessions();
      res.json({ 
        status: "healthy", 
        timestamp: new Date().toISOString(),
        database: "connected",
        agents: agents.length,
        version: "1.0.0"
      });
    } catch (error: any) {
      res.status(503).json({ 
        status: "unhealthy", 
        timestamp: new Date().toISOString(),
        error: error.message 
      });
    }
  });

  // Get full document content by ID
  app.get("/api/documents/full/:id", async (req, res) => {
    try {
      console.log(`[API] Full document request for ID: ${req.params.id}`);
      const documentId = parseInt(req.params.id);
      
      if (isNaN(documentId)) {
        return res.status(400).json({ error: 'Invalid document ID' });
      }

      const document = await storage.getDocument(documentId);
      
      if (!document) {
        console.log(`[API] Document ${documentId} not found`);
        return res.status(404).json({ error: 'Document not found' });
      }

      console.log(`[API] Found document: ${document.title} (${document.jurisdiction})`);

      // Get all chunks for this document
      const allDocuments = await storage.searchDocuments('', [], 50000);
      const originalTitle = document.title.replace(/ \(Part \d+\/\d+\)$/, '');
      const documentChunks = allDocuments.filter((doc: any) => 
        doc.jurisdiction.toLowerCase() === document.jurisdiction.toLowerCase() && 
        (doc.title === originalTitle || doc.title.startsWith(originalTitle + ' (Part'))
      );

      // Sort chunks by part number if they exist
      documentChunks.sort((a, b) => {
        const aMatch = a.title.match(/\(Part (\d+)\/\d+\)$/);
        const bMatch = b.title.match(/\(Part (\d+)\/\d+\)$/);
        
        if (aMatch && bMatch) {
          return parseInt(aMatch[1]) - parseInt(bMatch[1]);
        }
        return 0;
      });

      // Combine all content
      const fullContent = documentChunks.map(chunk => chunk.content || '').join('\n\n');

      console.log(`[API] Full document for ID ${documentId}: found ${documentChunks.length} chunks, total content length: ${fullContent.length}`);

      const responseData = {
        id: document.id,
        title: originalTitle,
        jurisdiction: document.jurisdiction,
        documentType: document.documentType,
        sourceUrl: document.sourceUrl,
        createdAt: document.createdAt,
        content: fullContent,
        chunkCount: documentChunks.length
      };

      res.setHeader('Content-Type', 'application/json');
      res.json(responseData);
    } catch (error: any) {
      console.error('[API] Error fetching full document:', error);
      res.status(500).json({ 
        error: 'Failed to fetch full document',
        details: error.message 
      });
    }
  });

  app.delete("/api/documents/jurisdiction/:jurisdiction", async (req, res) => {
    try {
      console.log('[API] DELETE route handler called for jurisdiction:', req.params.jurisdiction);
      res.setHeader('Content-Type', 'application/json');
      
      const jurisdiction = req.params.jurisdiction;
      
      // Get all documents for this jurisdiction first (case-insensitive)
      const allDocuments = await storage.searchDocuments("", [], 1000); // Get all documents
      console.log(`[API] All jurisdiction values:`, allDocuments.map(d => `"${d.jurisdiction}"`).slice(0, 20));
      
      const documents = await storage.getDocumentsByJurisdiction(jurisdiction);
      const documentCount = documents.length;
      
      console.log(`[API] Found ${documentCount} documents for jurisdiction "${jurisdiction}"`);
      
      if (documentCount === 0) {
        return res.status(200).json({ 
          success: true,
          message: 'No documents found for this jurisdiction',
          deletedCount: 0 
        });
      }

      // Delete all documents for the jurisdiction
      await storage.deleteDocumentsByJurisdiction(jurisdiction);
      
      // Reset agent session counts
      await storage.createOrUpdateAgentSession({
        agentId: jurisdiction,
        status: 'inactive',
        documentsCount: 0,
        embeddingsCount: 0,
      });

      console.log(`[API] Successfully deleted ${documentCount} documents for ${jurisdiction}`);
      
      res.status(200).json({ 
        success: true,
        message: `Successfully deleted ${documentCount} documents for ${jurisdiction}`,
        deletedCount: documentCount 
      });
    } catch (error: any) {
      console.error('[API] Error deleting jurisdiction documents:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to delete jurisdiction documents',
        details: error.message 
      });
    }
  });

  // Get all unique jurisdictions from the database
  app.get("/api/jurisdictions", async (req, res) => {
    try {
      const documents = await storage.searchDocuments("", [], 10000); // Get all documents
      const jurisdictions = new Set<string>();
      
      documents.forEach(doc => {
        jurisdictions.add(doc.jurisdiction);
      });
      
      const jurisdictionList = Array.from(jurisdictions).map(jurisdiction => ({
        id: jurisdiction,
        name: jurisdiction,
        documentCount: documents.filter(doc => doc.jurisdiction === jurisdiction).length
      })).sort((a, b) => a.name.localeCompare(b.name));
      
      res.json(jurisdictionList);
    } catch (error: any) {
      console.error('[API] Error fetching jurisdictions:', error);
      res.status(500).json({ 
        error: 'Failed to fetch jurisdictions',
        details: error.message 
      });
    }
  });

  // Get unique document titles for a jurisdiction
  app.get("/api/documents/unique/:jurisdiction", async (req, res) => {
    try {
      const jurisdiction = req.params.jurisdiction.toLowerCase();
      const documents = await storage.getDocumentsByJurisdiction(jurisdiction);
      
      // Extract unique document titles
      const uniqueTitles = new Set<string>();
      documents.forEach(doc => {
        const originalTitle = doc.title.replace(/ \(Part \d+\/\d+\)$/, '');
        uniqueTitles.add(originalTitle);
      });

      const sortedTitles = Array.from(uniqueTitles).sort();
      res.json({
        jurisdiction,
        totalChunks: documents.length,
        uniqueDocuments: sortedTitles.length,
        documents: sortedTitles
      });
    } catch (error: any) {
      console.error('[API] Error fetching unique documents:', error);
      res.status(500).json({ 
        error: 'Failed to fetch unique documents',
        details: error.message 
      });
    }
  });

  // Initialize vector store
  await documentProcessor.initializeVectorStore();

  // Test endpoint for OCR functionality
  app.post("/api/test-ocr", upload.single('pdf'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No PDF file provided' });
      }

      console.log(`[TEST-OCR] Testing OCR on file: ${req.file.originalname}`);
      
      const result = await analyzeAndExtractPDF(req.file.buffer, req.file.originalname);
      
      res.json({
        filename: req.file.originalname,
        method: result.method,
        confidence: result.confidence,
        textLength: result.text.length,
        preview: result.text.substring(0, 500) + (result.text.length > 500 ? '...' : ''),
        success: true
      });
      
    } catch (error: any) {
      console.error('[TEST-OCR] Error:', error.message);
      res.status(500).json({ 
        error: 'OCR test failed',
        details: error.message 
      });
    }
  });

  // Query endpoint
  app.post("/api/query", async (req, res) => {
    try {
      const queryData = QueryRequestSchema.parse(req.body);
      console.log(`[API] Received query: ${queryData.message.substring(0, 100)}...`);

      // Create or get conversation
      let conversationId = queryData.conversationId;
      if (!conversationId) {
        const conversation = await storage.createConversation({
          userId: 1, // Default user for now
          title: queryData.message.substring(0, 50) + "...",
        });
        conversationId = conversation.id;
      }

      // Store user message
      await storage.createMessage({
        conversationId,
        role: 'user',
        content: queryData.message,
      });

      // Process query with master agent
      const response: MasterAgentResponse = await masterAgent.processQueryWithRequest(queryData.message, queryData);

      // Store agent responses
      for (const agentResponse of response.responses) {
        await storage.createMessage({
          conversationId,
          role: 'assistant',
          content: agentResponse.content,
          agentId: agentResponse.agentId,
          metadata: {
            sources: agentResponse.sources,
            agentName: agentResponse.agentName,
          },
        });
      }

      // Store master summary if available
      if (response.masterSummary) {
        await storage.createMessage({
          conversationId,
          role: 'assistant',
          content: response.masterSummary,
          agentId: 'master',
          metadata: {
            type: 'summary',
            routingInfo: response.routingInfo,
          },
        });
      }

      const queryResponse = {
        conversationId,
        responses: response.responses,
        masterSummary: response.masterSummary,
        routingInfo: response.routingInfo,
        suggestedQuestions: response.suggestedQuestions,
      };

      res.json(queryResponse);
    } catch (error: any) {
      console.error('[API] Error processing query:', error);
      res.status(500).json({ 
        error: 'Failed to process query',
        details: error.message 
      });
    }
  });

  // Get agent sessions
  app.get("/api/agents", async (req, res) => {
    try {
      const sessions = await storage.getAllAgentSessions();
      res.json(sessions);
    } catch (error: any) {
      console.error('[API] Error fetching agent sessions:', error);
      res.status(500).json({ 
        error: 'Failed to fetch agent sessions',
        details: error.message 
      });
    }
  });

  // Get conversation history
  app.get("/api/conversations/:id/messages", async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const messages = await storage.getMessagesByConversation(conversationId);
      res.json(messages);
    } catch (error: any) {
      console.error('[API] Error fetching conversation messages:', error);
      res.status(500).json({ 
        error: 'Failed to fetch conversation messages',
        details: error.message 
      });
    }
  });

  // Get user conversations
  app.get("/api/conversations", async (req, res) => {
    try {
      const userId = 1; // Default user for now
      const conversations = await storage.getConversationsByUser(userId);
      res.json(conversations);
    } catch (error: any) {
      console.error('[API] Error fetching conversations:', error);
      res.status(500).json({ 
        error: 'Failed to fetch conversations',
        details: error.message 
      });
    }
  });

  // PDF upload endpoint with progress reporting
  app.post("/api/documents/upload", upload.array('pdfs', 50), async (req, res) => {
    try {
      const { jurisdiction } = req.body;
      
      if (!jurisdiction) {
        return res.status(400).json({ 
          error: 'Jurisdiction is required' 
        });
      }

      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({ 
          error: 'No PDF files provided' 
        });
      }

      const files = req.files as Express.Multer.File[];
      const totalFiles = files.length;
      const normalizedJurisdiction = jurisdiction.toLowerCase();
      const documents = [];
      const errors = [];

      console.log(`[API] Starting upload of ${totalFiles} files for jurisdiction: ${normalizedJurisdiction}`);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const currentFileNum = i + 1;
        
        console.log(`[API] Processing file ${currentFileNum}/${totalFiles}: ${file.originalname}`);
        
        try {
          // Use enhanced PDF extraction with confidence analysis
          const extractionResult = await analyzeAndExtractPDF(file.buffer, file.originalname);
          
          console.log(`[API] Successfully extracted ${extractionResult.text.length} characters from ${file.originalname} (confidence: ${extractionResult.confidence.toFixed(1)}%)`);
          
          const document = await documentProcessor.processDocument({
            title: file.originalname.replace('.pdf', ''),
            content: extractionResult.text,
            jurisdiction: normalizedJurisdiction,
            documentType: 'pdf-upload',
            sourceUrl: null,
          });

          documents.push(document);
          console.log(`[API] Successfully processed ${currentFileNum}/${totalFiles}: ${file.originalname}`);
          continue;
          
        } catch (error: any) {
          const errorMsg = `${file.originalname}: ${error.message}`;
          errors.push(errorMsg);
          console.error(`[API] Error processing file ${currentFileNum}/${totalFiles}:`, errorMsg);
        }
      }

      // Update agent session counts
      if (documents.length > 0) {
        const agentSession = await storage.getAgentSession(normalizedJurisdiction);
        if (agentSession) {
          await storage.createOrUpdateAgentSession({
            agentId: normalizedJurisdiction,
            status: 'active',
            documentsCount: (agentSession.documentsCount || 0) + documents.length,
            embeddingsCount: (agentSession.embeddingsCount || 0) + documents.length,
          });
        }
      }

      console.log(`[API] Upload complete: ${documents.length} documents processed, ${errors.length} errors`);

      res.json({ 
        message: `Successfully processed ${documents.length} out of ${totalFiles} PDF files`,
        documents,
        errors: errors.length > 0 ? errors : undefined,
        totalFiles,
        processedFiles: documents.length
      });
    } catch (error: any) {
      console.error('[API] Error uploading PDFs:', error);
      res.status(500).json({ 
        error: 'Failed to process PDF uploads',
        details: error.message 
      });
    }
  });

  // Document management endpoints
  app.post("/api/documents", async (req, res) => {
    try {
      const { title, content, jurisdiction, documentType, sourceUrl } = req.body;
      
      if (!title || !content || !jurisdiction || !documentType) {
        return res.status(400).json({ 
          error: 'Missing required fields: title, content, jurisdiction, documentType' 
        });
      }

      // Process document with embeddings
      const document = await documentProcessor.processDocument({
        title,
        content,
        jurisdiction,
        documentType,
        sourceUrl: sourceUrl || null,
      });

      // Update agent session counts
      const agentSession = await storage.getAgentSession(jurisdiction);
      if (agentSession) {
        await storage.createOrUpdateAgentSession({
          agentId: jurisdiction,
          status: 'active',
          documentsCount: (agentSession.documentsCount || 0) + 1,
          embeddingsCount: (agentSession.embeddingsCount || 0) + 1,
        });
      }

      res.json(document);
    } catch (error: any) {
      console.error('[API] Error creating document:', error);
      res.status(500).json({ 
        error: 'Failed to create document',
        details: error.message 
      });
    }
  });



  app.get("/api/documents", async (req, res) => {
    try {
      const { jurisdiction } = req.query;
      
      // Get all documents (this includes chunks)
      const allDocuments = await storage.searchDocuments('', [], 50000);
      
      // Group chunks by original document and show only unique original documents
      const originalDocuments = new Map();
      
      allDocuments.forEach((doc: any) => {
        // Extract original title (remove " (Part X/Y)" suffix if present)
        const originalTitle = doc.title.replace(/ \(Part \d+\/\d+\)$/, '');
        const normalizedJurisdiction = doc.jurisdiction.toLowerCase();
        const key = `${normalizedJurisdiction}-${originalTitle}`;
        
        if (!originalDocuments.has(key)) {
          // Count total chunks for this original document
          const chunkCount = allDocuments.filter((d: any) => 
            d.jurisdiction.toLowerCase() === normalizedJurisdiction && 
            (d.title === originalTitle || d.title.startsWith(originalTitle + ' (Part'))
          ).length;
          
          originalDocuments.set(key, {
            id: doc.id,
            title: originalTitle,
            jurisdiction: normalizedJurisdiction,
            documentType: doc.documentType,
            sourceUrl: doc.sourceUrl,
            createdAt: doc.createdAt,
            content: doc.content.substring(0, 500) + '...', // Preview content
            chunkCount: chunkCount
          });
        }
      });
      
      let result = Array.from(originalDocuments.values());
      
      // Filter by jurisdiction if specified (case-insensitive)
      if (jurisdiction && typeof jurisdiction === 'string') {
        const normalizedFilter = jurisdiction.toLowerCase();
        result = result.filter((doc: any) => doc.jurisdiction === normalizedFilter);
      }
      
      res.json(result);
    } catch (error: any) {
      console.error('[API] Error fetching documents:', error);
      res.status(500).json({ 
        error: 'Failed to fetch documents',
        details: error.message 
      });
    }
  });

  // Get all jurisdictions with document counts
  app.get("/api/jurisdictions", async (req, res) => {
    try {
      const allDocuments = await storage.searchDocuments('', [], 1000);
      
      // Group by jurisdiction (case-insensitive) and count unique documents
      const jurisdictions = new Map();
      
      allDocuments.forEach((doc: any) => {
        const originalTitle = doc.title.replace(/ \(Part \d+\/\d+\)$/, '');
        const normalizedJurisdiction = doc.jurisdiction.toLowerCase();
        const key = `${normalizedJurisdiction}-${originalTitle}`;
        
        if (!jurisdictions.has(normalizedJurisdiction)) {
          jurisdictions.set(normalizedJurisdiction, {
            name: normalizedJurisdiction,
            documentCount: 0,
            uniqueDocuments: new Set()
          });
        }
        
        const jurisdictionData = jurisdictions.get(normalizedJurisdiction);
        if (!jurisdictionData.uniqueDocuments.has(key)) {
          jurisdictionData.uniqueDocuments.add(key);
          jurisdictionData.documentCount++;
        }
      });
      
      // Convert to array and clean up
      const result = Array.from(jurisdictions.values()).map((j: any) => ({
        name: j.name,
        documentCount: j.documentCount
      }));
      
      res.json(result);
    } catch (error: any) {
      console.error('[API] Error fetching jurisdictions:', error);
      res.status(500).json({ 
        error: 'Failed to fetch jurisdictions',
        details: error.message 
      });
    }
  });

  app.delete("/api/documents/:id", async (req, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const document = await storage.getDocument(documentId);
      
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      await storage.deleteDocument(documentId);
      
      // Update agent session counts
      const agentSession = await storage.getAgentSession(document.jurisdiction);
      if (agentSession && agentSession.documentsCount && agentSession.documentsCount > 0) {
        await storage.createOrUpdateAgentSession({
          agentId: document.jurisdiction,
          status: agentSession.status,
          documentsCount: agentSession.documentsCount - 1,
          embeddingsCount: (agentSession.embeddingsCount || 0) - 1,
        });
      }

      res.json({ message: 'Document deleted successfully' });
    } catch (error: any) {
      console.error('[API] Error deleting document:', error);
      res.status(500).json({ 
        error: 'Failed to delete document',
        details: error.message 
      });
    }
  });



  app.post("/api/documents/bulk", async (req, res) => {
    try {
      const { documents } = req.body;
      
      if (!Array.isArray(documents)) {
        return res.status(400).json({ error: 'documents must be an array' });
      }

      const results = await documentProcessor.processMultipleDocuments(documents);
      
      // Update agent session counts for all affected jurisdictions
      const jurisdictionCounts: Record<string, number> = {};
      results.forEach(doc => {
        jurisdictionCounts[doc.jurisdiction] = (jurisdictionCounts[doc.jurisdiction] || 0) + 1;
      });

      for (const [jurisdiction, count] of Object.entries(jurisdictionCounts)) {
        const agentSession = await storage.getAgentSession(jurisdiction);
        if (agentSession) {
          await storage.createOrUpdateAgentSession({
            agentId: jurisdiction,
            status: 'active',
            documentsCount: (agentSession.documentsCount || 0) + count,
            embeddingsCount: (agentSession.embeddingsCount || 0) + count,
          });
        }
      }

      res.json({ 
        message: `Successfully processed ${results.length} documents`,
        documents: results 
      });
    } catch (error: any) {
      console.error('[API] Error bulk creating documents:', error);
      res.status(500).json({ 
        error: 'Failed to bulk create documents',
        details: error.message 
      });
    }
  });

  // Google Drive integration endpoints
  app.get("/api/google-drive/auth-url", (req, res) => {
    try {
      const authUrl = googleDriveService.getAuthUrl();
      res.json({ authUrl });
    } catch (error: any) {
      console.error('[API] Error generating Google Drive auth URL:', error);
      res.status(500).json({ 
        error: 'Failed to generate authentication URL',
        details: error.message 
      });
    }
  });

  app.post("/api/google-drive/authorize", async (req, res) => {
    try {
      const { code } = req.body;
      
      if (!code) {
        return res.status(400).json({ error: 'Authorization code is required' });
      }

      await googleDriveService.setCredentials(code);
      res.json({ message: 'Google Drive authorization successful' });
    } catch (error: any) {
      console.error('[API] Error setting Google Drive credentials:', error);
      res.status(500).json({ 
        error: 'Failed to authorize Google Drive',
        details: error.message 
      });
    }
  });

  app.post("/api/google-drive/sync", async (req, res) => {
    try {
      const { folderId, jurisdiction, refreshToken } = req.body;
      
      if (!folderId || !jurisdiction) {
        return res.status(400).json({ 
          error: 'folderId and jurisdiction are required' 
        });
      }

      // Initialize with refresh token if provided
      if (refreshToken) {
        await googleDriveService.initializeWithRefreshToken(refreshToken);
      }

      // Test connection before syncing
      const connectionOk = await googleDriveService.testConnection();
      if (!connectionOk) {
        return res.status(401).json({ 
          error: 'Google Drive authentication failed. Please re-authorize.' 
        });
      }

      // Sync documents from the folder
      const syncResult = await googleDriveService.syncFolderDocuments(folderId, jurisdiction);
      
      // Update agent session counts
      if (syncResult.processed > 0) {
        const agentSession = await storage.getAgentSession(jurisdiction);
        if (agentSession) {
          await storage.createOrUpdateAgentSession({
            agentId: jurisdiction,
            status: 'active',
            documentsCount: (agentSession.documentsCount || 0) + syncResult.processed,
            embeddingsCount: (agentSession.embeddingsCount || 0) + syncResult.processed,
          });
        }
      }

      res.json({
        message: `Sync completed: ${syncResult.processed} documents processed`,
        result: syncResult
      });
    } catch (error: any) {
      console.error('[API] Error syncing Google Drive folder:', error);
      res.status(500).json({ 
        error: 'Failed to sync Google Drive folder',
        details: error.message 
      });
    }
  });

  app.get("/api/google-drive/folders/:folderId/files", async (req, res) => {
    try {
      const { folderId } = req.params;
      const { refreshToken } = req.query;

      if (refreshToken) {
        await googleDriveService.initializeWithRefreshToken(refreshToken as string);
      }

      const files = await googleDriveService.listFilesInFolder(folderId);
      res.json({ files });
    } catch (error: any) {
      console.error('[API] Error listing Google Drive files:', error);
      res.status(500).json({ 
        error: 'Failed to list files from Google Drive folder',
        details: error.message 
      });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: 'healthy',
      agents: Array.from(jurisdictionAgents.keys()),
      timestamp: new Date().toISOString()
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}
