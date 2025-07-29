import { useState, useCallback, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Annotation } from "./VideoAnnotationTool";
import * as XLSX from 'xlsx';

interface ExcelUploaderProps {
  onAnnotationsLoaded: (annotations: Annotation[]) => void;
  disabled?: boolean;
}

export const ExcelUploader = ({ onAnnotationsLoaded, disabled }: ExcelUploaderProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseExcelData = useCallback((data: any[]): Annotation[] => {
    const annotations: Annotation[] = [];
    
    for (const row of data) {
      try {
        // Check if row has required fields
        if (!row['ID_video'] || !row['Meaning'] || 
            row['Start Time (s)'] === undefined || row['End Time (s)'] === undefined ||
            row['Crop X'] === undefined || row['Crop Y'] === undefined ||
            row['Crop Width'] === undefined || row['Crop Height'] === undefined) {
          continue; // Skip invalid rows
        }

        const annotation: Annotation = {
          id: `imported_${Date.now()}_${Math.random()}`,
          label: String(row['Meaning'] || '').trim(),
          postag: String(row['Pos-tag'] || '').trim(),
          sideView: row['SideView'] === 'true' || row['SideView'] === true,
          cropArea: {
            x: Number(row['Crop X']) || 0,
            y: Number(row['Crop Y']) || 0,
            width: Number(row['Crop Width']) || 100,
            height: Number(row['Crop Height']) || 100,
          },
          timeRange: {
            start: Number(row['Start Time (s)']) || 0,
            end: Number(row['End Time (s)']) || 1,
          },
          filename: String(row['ID_video'] || '').trim(),
          createdAt: row['Created At'] ? new Date(row['Created At']) : new Date(),
        };

        // Validate annotation
        if (annotation.timeRange.start >= annotation.timeRange.end) {
          console.warn('Skipping annotation with invalid time range:', annotation);
          continue;
        }

        if (annotation.cropArea.width <= 0 || annotation.cropArea.height <= 0) {
          console.warn('Skipping annotation with invalid crop area:', annotation);
          continue;
        }

        annotations.push(annotation);
      } catch (error) {
        console.warn('Error parsing row:', row, error);
      }
    }

    return annotations;
  }, []);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv' // .csv
    ];

    if (!validTypes.includes(file.type) && !file.name.toLowerCase().endsWith('.csv')) {
      toast("Invalid file type", { 
        description: "Please select an Excel file (.xlsx, .xls) or CSV file" 
      });
      return;
    }

    setIsProcessing(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      let workbook: XLSX.WorkBook;

      if (file.name.toLowerCase().endsWith('.csv')) {
        // Handle CSV files
        const text = new TextDecoder('utf-8').decode(arrayBuffer);
        workbook = XLSX.read(text, { type: 'string' });
      } else {
        // Handle Excel files
        workbook = XLSX.read(arrayBuffer, { type: 'array' });
      }

      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        toast("Empty file", { description: "The selected file contains no data" });
        return;
      }

      const annotations = parseExcelData(jsonData);

      if (annotations.length === 0) {
        toast("No valid annotations found", { 
          description: "Please check that your file has the correct format" 
        });
        return;
      }

      onAnnotationsLoaded(annotations);
      toast(`Successfully loaded ${annotations.length} annotations!`, {
        description: `From file: ${file.name}`
      });

    } catch (error) {
      console.error('Error processing file:', error);
      toast("Failed to process file", { 
        description: "Please check your file format and try again" 
      });
    } finally {
      setIsProcessing(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [parseExcelData, onAnnotationsLoaded]);

  const handleUploadClick = useCallback(() => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  }, [disabled]);

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4" />
          Import Annotations
        </h3>

        <div className="text-sm text-muted-foreground space-y-2">
          <div>• Upload Excel (.xlsx, .xls) or CSV files</div>
          <div>• File should contain exported annotation data</div>
          <div>• Required columns: ID_video, Meaning, Start Time (s), End Time (s), Crop X, Y, Width, Height</div>
        </div>

        {disabled && (
          <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg">
            <AlertCircle className="w-4 h-4 text-warning" />
            <span className="text-sm text-warning-foreground">
              Please load a video first before importing annotations
            </span>
          </div>
        )}

        <Button
          onClick={handleUploadClick}
          variant="outline"
          className="w-full"
          disabled={disabled || isProcessing}
        >
          {isProcessing ? (
            <>
              <div className="w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Import Excel/CSV
            </>
          )}
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
          onChange={handleFileUpload}
          className="hidden"
          disabled={disabled || isProcessing}
        />
      </div>
    </Card>
  );
};