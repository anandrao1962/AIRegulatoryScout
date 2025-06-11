import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileText, File, FilePenLine } from "lucide-react";
import { exportToPDF, exportToMarkdown, exportToDocx, type ExportData } from "@/lib/exportUtils";
import { useToast } from "@/hooks/use-toast";

interface ExportDropdownProps {
  data: ExportData;
  className?: string;
}

export function ExportDropdown({ data, className }: ExportDropdownProps) {
  const { toast } = useToast();

  const handleExport = async (format: 'pdf' | 'markdown' | 'docx') => {
    try {
      switch (format) {
        case 'pdf':
          await exportToPDF(data);
          break;
        case 'markdown':
          exportToMarkdown(data);
          break;
        case 'docx':
          await exportToDocx(data);
          break;
      }
      
      toast({
        title: "Export Successful",
        description: `Response exported as ${format.toUpperCase()}`,
      });
    } catch (error) {
      console.error(`Export error (${format}):`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: "Export Failed",
        description: `Failed to export as ${format.toUpperCase()}: ${errorMessage}`,
        variant: "destructive",
      });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          <Download className="h-4 w-4 mr-2" />
          Save
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport('pdf')}>
          <File className="h-4 w-4 mr-2" />
          Export as PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('markdown')}>
          <FileText className="h-4 w-4 mr-2" />
          Export as Markdown
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('docx')}>
          <FilePenLine className="h-4 w-4 mr-2" />
          Export as DOCX
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}