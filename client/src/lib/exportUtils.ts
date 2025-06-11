import jsPDF from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

export interface ExportData {
  content: string;
  agentName: string;
  query: string;
  timestamp: Date;
  sources?: Array<{
    title: string;
    relevance: number;
    tokens: number;
  }>;
}

export const exportToPDF = async (data: ExportData) => {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 20;
  const lineHeight = 7;
  let yPosition = margin;

  // Helper function to add text with word wrapping
  const addText = (text: string, fontSize = 11, isBold = false) => {
    pdf.setFontSize(fontSize);
    if (isBold) {
      pdf.setFont('helvetica', 'bold');
    } else {
      pdf.setFont('helvetica', 'normal');
    }

    const lines = pdf.splitTextToSize(text, pageWidth - 2 * margin);
    
    // Check if we need a new page
    if (yPosition + lines.length * lineHeight > pdf.internal.pageSize.getHeight() - margin) {
      pdf.addPage();
      yPosition = margin;
    }

    lines.forEach((line: string) => {
      pdf.text(line, margin, yPosition);
      yPosition += lineHeight;
    });
    
    yPosition += 3; // Extra spacing
  };

  // Title
  addText(`Global AI Regulatory Navigator - Query Response`, 16, true);
  yPosition += 5;

  // Metadata
  addText(`Agent: ${data.agentName}`, 12, true);
  addText(`Query: ${data.query}`, 12, true);
  addText(`Generated: ${data.timestamp.toLocaleString()}`, 10);
  yPosition += 10;

  // Content
  addText('Response:', 14, true);
  addText(data.content);

  // Sources
  if (data.sources && data.sources.length > 0) {
    yPosition += 10;
    addText('Sources:', 14, true);
    data.sources.forEach((source, index) => {
      addText(`${index + 1}. ${source.title} (Relevance: ${(source.relevance * 100).toFixed(1)}%)`);
    });
  }

  // Save the PDF
  const filename = `ai-regulation-response-${data.agentName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.pdf`;
  pdf.save(filename);
};

export const exportToMarkdown = (data: ExportData) => {
  let markdown = `# AI Regulation Query Response\n\n`;
  markdown += `**Agent:** ${data.agentName}\n\n`;
  markdown += `**Query:** ${data.query}\n\n`;
  markdown += `**Generated:** ${data.timestamp.toLocaleString()}\n\n`;
  markdown += `## Response\n\n${data.content}\n\n`;

  if (data.sources && data.sources.length > 0) {
    markdown += `## Sources\n\n`;
    data.sources.forEach((source, index) => {
      markdown += `${index + 1}. **${source.title}** (Relevance: ${(source.relevance * 100).toFixed(1)}%)\n`;
    });
  }

  const blob = new Blob([markdown], { type: 'text/markdown' });
  const filename = `ai-regulation-response-${data.agentName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.md`;
  saveAs(blob, filename);
};

export const exportToDocx = async (data: ExportData) => {
  try {
    // Split content into paragraphs to handle long text properly
    const contentParagraphs = data.content.split('\n\n').filter(p => p.trim().length > 0);
    
    const children = [
      new Paragraph({
        text: "AI Regulation Query Response",
        heading: HeadingLevel.TITLE,
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Agent: ", bold: true }),
          new TextRun({ text: data.agentName }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Query: ", bold: true }),
          new TextRun({ text: data.query }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Generated: ", bold: true }),
          new TextRun({ text: data.timestamp.toLocaleString() }),
        ],
      }),
      new Paragraph({ text: "" }), // Empty line
      new Paragraph({
        text: "Response",
        heading: HeadingLevel.HEADING_1,
      }),
      // Add content as multiple paragraphs
      ...contentParagraphs.map(paragraph => 
        new Paragraph({
          text: paragraph,
        })
      ),
    ];

    // Add sources if available
    if (data.sources && data.sources.length > 0) {
      children.push(
        new Paragraph({ text: "" }), // Empty line
        new Paragraph({
          text: "Sources",
          heading: HeadingLevel.HEADING_1,
        }),
        ...data.sources.map((source, index) => 
          new Paragraph({
            children: [
              new TextRun({ text: `${index + 1}. `, bold: true }),
              new TextRun({ text: `${source.title} ` }),
              new TextRun({ text: `(Relevance: ${(source.relevance * 100).toFixed(1)}%)`, italics: true }),
            ],
          })
        )
      );
    }

    const doc = new Document({
      sections: [{
        properties: {},
        children: children,
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const filename = `ai-regulation-response-${data.agentName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.docx`;
    saveAs(blob, filename);
  } catch (error) {
    console.error('DOCX export error:', error);
    throw new Error(`Failed to create DOCX document: ${error.message || 'Unknown error'}`);
  }
};