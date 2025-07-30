import { useState, useCallback } from "react";
import { Annotation } from "./VideoAnnotationTool";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Download, FileSpreadsheet, Video, Package } from "lucide-react";
import { toast } from "sonner";
import { videoProcessor } from "@/lib/videoProcessor";

interface ExportManagerProps {
  annotations: Annotation[];
  videoFile: File | null;
  videoFileName: string;
  resolutionInfo: {
    videoWidth: number;
    videoHeight: number;
    canvasWidth: number;
    canvasHeight: number;
  };
  driveFolderId?: string;
  driveFolderName?: string;
}

export const ExportManager = ({ annotations, videoFile, resolutionInfo, driveFolderId, driveFolderName }: ExportManagerProps) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const generateExcelData = useCallback(() => {
    const headers = ['ID_video', 'Meaning', 'Pos-tag', 'SideView','Video-File', 'Start Time (s)', 'End Time (s)', 'Duration (s)', 'Crop X', 'Crop Y', 'Crop Width', 'Crop Height', 'Created At'];
    const rows = annotations.map(annotation => [
      annotation.filename,
      annotation.label,
      annotation.postag || "",
      annotation.sideView ? "true" : "false", // ✅ xuất giá trị
      videoFile?.name || "",
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
    
    const bom = "\uFEFF"; // Byte Order Mark cho UTF-8
    const csvWithBom = bom + csvContent;
    const csvBlob = new Blob([csvWithBom], { type: 'text/csv;charset=utf-8;' });
    const blob = new Blob([csvBlob], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
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
      toast("Initializing FFmpeg...", { description: "This may take a moment on first use" });
      
      const { videoWidth, videoHeight, canvasWidth, canvasHeight } = resolutionInfo;

      const scaleX = videoWidth / canvasWidth;
      const scaleY = videoHeight / canvasHeight;

      const scaledAnnotations = annotations.map(annotation => ({
        ...annotation,
        cropArea: {
          x: annotation.cropArea.x * scaleX,
          y: annotation.cropArea.y * scaleY,
          width: annotation.cropArea.width * scaleX,
          height: annotation.cropArea.height * scaleY,
        },
      }));

      // Process all annotations into video clips
      const results = await videoProcessor.processMultipleAnnotations(
        videoFile,
        scaledAnnotations,
        { width: canvasWidth, height: canvasHeight },
        { width: videoWidth, height: videoHeight },
        (progress, currentIndex) => {
          setExportProgress(progress);
          if (currentIndex >= 0) {
            toast(`Processing clip ${currentIndex + 1}/${annotations.length}...`);
          }
        }
      );

      // Upload to Google Drive or download locally
      if (driveFolderId) {
        await uploadToDrive(results);
      } else {
        // Download all processed videos with a small delay between downloads
        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          
          // Create download link
          const link = document.createElement('a');
          const url = URL.createObjectURL(result.blob);
          
          link.href = url;
          link.download = result.filename;
          link.style.display = 'none';
          
          // Trigger download
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          // Clean up URL and add small delay
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          
          // Small delay between downloads to avoid browser blocking
          if (i < results.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }

      if (driveFolderId) {
        toast(`Successfully exported ${results.length} video clips to Google Drive!`, { 
          description: `Uploaded to: ${driveFolderName}` 
        });
      } else {
        toast(`Successfully exported ${results.length} video clips!`, { 
          description: "Check your downloads folder" 
        });
      }
    } catch (error) {
      console.error('Video processing error:', error);
      toast("Video processing failed", { 
        description: error instanceof Error ? error.message : "Unknown error occurred" 
      });
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  }, [videoFile, annotations, resolutionInfo, driveFolderId]);

  const uploadToDrive = useCallback(async (results: Array<{filename: string, blob: Blob}>) => {
    const token = localStorage.getItem('gdrive_token');
    if (!token || !driveFolderId) {
      throw new Error('Google Drive not connected');
    }

    toast(`Uploading ${results.length} files to Google Drive...`);

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      
      try {
        const formData = new FormData();
        formData.append('file', result.blob);
        
        const metadata = {
          name: result.filename,
          parents: [driveFolderId]
        };
        
        const uploadResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: (() => {
            const boundary = '-------314159265358979323846';
            const delimiter = '\r\n--' + boundary + '\r\n';
            const close_delim = '\r\n--' + boundary + '--';
            
            let body = delimiter +
              'Content-Type: application/json\r\n\r\n' +
              JSON.stringify(metadata) + delimiter +
              'Content-Type: ' + result.blob.type + '\r\n\r\n';
            
            return new Blob([body, result.blob, close_delim], {type: 'multipart/related; boundary="' + boundary + '"'});
          })()
        });

        if (!uploadResponse.ok) {
          throw new Error(`Failed to upload ${result.filename}`);
        }

        toast(`Uploaded ${i + 1}/${results.length}: ${result.filename}`);
      } catch (error) {
        console.error(`Error uploading ${result.filename}:`, error);
        toast(`Failed to upload ${result.filename}`, { description: "Continuing with remaining files..." });
      }
    }

    toast(`Successfully uploaded ${results.length} files to ${driveFolderName}!`);
  }, [driveFolderId, driveFolderName]);

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
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
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
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirm Export</AlertDialogTitle>
                <AlertDialogDescription>
                  This will process and download {annotations.length} video clips plus metadata Excel file. 
                  The process may take several minutes depending on clip length and complexity.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={exportAll}>
                  Start Export
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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