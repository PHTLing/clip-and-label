import { useState, useCallback } from "react";
import { Annotation } from "./VideoAnnotationTool";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Download, FileSpreadsheet, Video, Package } from "lucide-react";
import { toast } from "sonner";
import { videoProcessor } from "@/lib/videoProcessor";

interface ExportManagerProps {
  annotations: Annotation[];
  videoFile: File | null;
}

export const ExportManager = ({ annotations, videoFile }: ExportManagerProps) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const generateExcelData = useCallback(() => {
    const headers = ['Filename', 'Label', 'Start Time (s)', 'End Time (s)', 'Duration (s)', 'Crop X', 'Crop Y', 'Crop Width', 'Crop Height', 'Created At'];
    const rows = annotations.map(annotation => [
      annotation.filename,
      annotation.label,
      annotation.timeRange.start.toFixed(2),
      annotation.timeRange.end.toFixed(2),
      (annotation.timeRange.end - annotation.timeRange.start).toFixed(2),
      Math.round(annotation.cropArea.x),
      Math.round(annotation.cropArea.y),
      Math.round(annotation.cropArea.width),
      Math.round(annotation.cropArea.height),
      annotation.createdAt.toISOString()
    ]);

    return [headers, ...rows];
  }, [annotations]);

  const downloadExcel = useCallback(() => {
    const data = generateExcelData();
    const csvContent = data.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `annotations_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast("Excel file downloaded successfully!");
  }, [generateExcelData]);

  const processVideos = useCallback(async () => {
    if (!videoFile) return;

    setIsExporting(true);
    setExportProgress(0);

    try {
      // Process all annotations into video clips
      const results = await videoProcessor.processMultipleAnnotations(
        videoFile,
        annotations,
        (progress, currentIndex) => {
          setExportProgress(progress);
          if (currentIndex >= 0) {
            toast(`Processing clip ${currentIndex + 1}/${annotations.length}...`);
          }
        }
      );

      // Download all processed videos
      for (const result of results) {
        const link = document.createElement('a');
        const url = URL.createObjectURL(result.blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', result.filename);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
      }

      toast(`Successfully exported ${results.length} video clips!`);
    } catch (error) {
      console.error('Video processing error:', error);
      toast("Video processing failed", { 
        description: "Please check console for details" 
      });
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  }, [videoFile, annotations]);

  const exportAll = useCallback(async () => {
    if (annotations.length === 0) {
      toast("No annotations to export");
      return;
    }

    try {
      // Download Excel first
      downloadExcel();
      
      // Then process videos
      await processVideos();
      
      toast("Export completed successfully!");
    } catch (error) {
      toast("Export failed");
      setIsExporting(false);
      setExportProgress(0);
    }
  }, [annotations.length, downloadExcel, processVideos]);

  const getTotalDuration = useCallback(() => {
    return annotations.reduce((sum, ann) => sum + (ann.timeRange.end - ann.timeRange.start), 0);
  }, [annotations]);

  const getEstimatedFileSize = useCallback(() => {
    const totalDuration = getTotalDuration();
    const avgBitrate = 5; // MB per minute (rough estimate)
    return (totalDuration / 60) * avgBitrate;
  }, [getTotalDuration]);

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Package className="w-4 h-4" />
          Export Manager
        </h3>

        {/* Export Statistics */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="space-y-1">
            <div className="text-muted-foreground">Total Clips</div>
            <Badge variant="outline" className="w-full justify-center">
              {annotations.length}
            </Badge>
          </div>
          
          <div className="space-y-1">
            <div className="text-muted-foreground">Duration</div>
            <Badge variant="outline" className="w-full justify-center">
              {getTotalDuration().toFixed(1)}s
            </Badge>
          </div>
          
          <div className="space-y-1">
            <div className="text-muted-foreground">Est. Size</div>
            <Badge variant="outline" className="w-full justify-center">
              ~{getEstimatedFileSize().toFixed(1)}MB
            </Badge>
          </div>
          
          <div className="space-y-1">
            <div className="text-muted-foreground">Format</div>
            <Badge variant="outline" className="w-full justify-center">
              MP4 + CSV
            </Badge>
          </div>
        </div>

        {/* Export Progress */}
        {isExporting && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Processing videos...</span>
              <span>{Math.round(exportProgress)}%</span>
            </div>
            <Progress value={exportProgress} className="w-full" />
          </div>
        )}

        {/* Export Actions */}
        <div className="space-y-2">
          <Button
            onClick={downloadExcel}
            variant="outline"
            className="w-full"
            disabled={annotations.length === 0 || isExporting}
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Download Excel Only
          </Button>
          
          <Button
            onClick={exportAll}
            className="w-full shadow-glow"
            disabled={annotations.length === 0 || isExporting || !videoFile}
          >
            {isExporting ? (
              <>
                <Video className="w-4 h-4 mr-2 animate-pulse" />
                Processing...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export All
              </>
            )}
          </Button>
        </div>

        {/* Export Info */}
        <div className="text-xs text-muted-foreground space-y-1">
          <div>• Excel file contains all annotation metadata</div>
          <div>• Videos will be cropped and trimmed as specified</div>
          <div>• Files are automatically named and organized</div>
          {!videoFile && (
            <div className="text-destructive">• Video file required for video export</div>
          )}
        </div>

        {/* Processing Notice */}
        <div className="p-3 bg-gradient-accent border border-accent/30 rounded-lg">
          <div className="text-xs text-accent-foreground space-y-1">
            <div><strong>🎬 Video Processing:</strong> Real video cropping and trimming with FFmpeg.js</div>
            <div>💾 <strong>Output:</strong> Downloads CSV metadata + individual MP4 clips</div>
            <div>⚡ <strong>Performance:</strong> Processing happens in your browser - no server required</div>
          </div>
        </div>
      </div>
    </Card>
  );
};