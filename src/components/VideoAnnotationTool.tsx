import { useState, useRef, useCallback, useEffect } from "react";
import { VideoPlayer } from "./VideoPlayer";
import { Timeline } from "./Timeline";
import { AnnotationPanel } from "./AnnotationPanel";
import { ExportManager } from "./ExportManager";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Upload, Video, FileText, Download } from "lucide-react";
import { toast } from "sonner";

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TimeRange {
  start: number;
  end: number;
}

export interface Annotation {
  id: string;
  label: string;
  postag: string;
  cropArea: CropArea;
  timeRange: TimeRange;
  filename: string;
  createdAt: Date;
  sideView: boolean;
}

export const VideoAnnotationTool = () => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [cropArea, setCropArea] = useState<CropArea>({ x: 50, y: 50, width: 300, height: 200 });
  const [timeRange, setTimeRange] = useState<TimeRange>({ start: 0, end: 5 });
  const [startIndex, setStartIndex] = useState<number>(0);
  const [postag, setPostag] = useState<string>("");
  const [resolutionInfo, setResolutionInfo] = useState<{
    videoWidth: number;
    videoHeight: number;
    canvasWidth: number;
    canvasHeight: number;
  }>({
    videoWidth: 0,
    videoHeight: 0,
    canvasWidth: 0,
    canvasHeight: 0,
  });
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [currentLabel, setCurrentLabel] = useState<string>("");
  const [sideView, setSideView] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState<boolean>(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      toast("Please select a valid video file", { 
        description: "Supported formats: MP4, AVI, MOV, WMV" 
      });
      return;
    }

    if (file.size > 500 * 1024 * 1024) { // 500MB limit
      toast("File too large", { 
        description: "Please select a video smaller than 500MB" 
      });
      return;
    }

    // Check if there are existing annotations
    if (annotations.length > 0) {
      setPendingFile(file);
      setShowConfirmDialog(true);
      return;
    }

    await loadNewVideo(file);
  }, [annotations.length]);

  const loadNewVideo = useCallback(async (file: File) => {
    setIsUploading(true);
    try {
      const url = URL.createObjectURL(file);
      setVideoFile(file);
      setVideoUrl(url);

       // 👇 XÓA localStorage cũ
      localStorage.removeItem('videoAnnotations');
      
      // Reset state
      setCurrentTime(0);
      setTimeRange({ start: 0, end: 5 });
      setAnnotations([]);
      setCurrentLabel("");
      setSelectedAnnotation(null);
      
      toast("Video loaded successfully!", { 
        description: `${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)` 
      });
    } catch (error) {
      toast("Failed to load video", { description: "Please try again" });
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleConfirmNewVideo = useCallback(async () => {
    if (pendingFile) {
      await loadNewVideo(pendingFile);
      setPendingFile(null);
    }
    setShowConfirmDialog(false);
  }, [pendingFile, loadNewVideo]);

  const handleCancelNewVideo = useCallback(() => {
    setPendingFile(null);
    setShowConfirmDialog(false);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const generateFilename = useCallback((label: string, index: number) => {
    const number = (startIndex + index).toString().padStart(4, '0');
    return `VTV${number}.mp4`;
  }, [startIndex]);

  const handleAddAnnotation = useCallback(() => {
    if (!currentLabel.trim()) {
      toast("Please enter a label for the annotation");
      return;
    }

    if (timeRange.start >= timeRange.end) {
      toast("Invalid time range");
      return;
    }
    if (selectedAnnotation) {
      // Update existing annotation
      console.log("DEBUG: sideView value when update annotation:", sideView);
      setAnnotations(prev =>
        prev.map(ann =>
          ann.id === selectedAnnotation
            ? {
                ...ann,
                label: currentLabel.trim(),
                postag: postag || undefined,
                cropArea: { ...cropArea },
                timeRange: { ...timeRange },
                sideView: sideView
              }
            : ann
        )
      );
      setSelectedAnnotation(null);
      setCurrentLabel("");
      setSideView(false);
      toast("Annotation updated successfully!", { 
        description: `Updated: ${currentLabel.trim()}` 
      });
    } else {
      const newAnnotation: Annotation = {
        id: Date.now().toString(),
        label: currentLabel.trim(),
        postag: postag || undefined,
        cropArea: { ...cropArea },
        timeRange: { ...timeRange },
        filename: generateFilename(currentLabel, annotations.length),
        createdAt: new Date(),
        sideView: sideView
      };
      console.log("DEBUG: sideView value when adding annotation:", sideView);
      setAnnotations(prev => [...prev, newAnnotation]);
      setCurrentLabel("");
      setSideView(false);
      toast("Annotation added successfully!", { 
        description: `Label: ${newAnnotation.label}` 
      });
    }
    }, [currentLabel, cropArea, timeRange, annotations.length, generateFilename, selectedAnnotation, postag, sideView]);

  const handleDeleteAnnotation = useCallback((id: string) => {
    setAnnotations(prev => prev.filter(ann => ann.id !== id));
    setSelectedAnnotation(null);
    toast("Annotation deleted");
  }, []);

  const handleSelectAnnotation = useCallback((annotation: Annotation) => {
    setSelectedAnnotation(annotation.id);
    setCropArea(annotation.cropArea);
    setTimeRange(annotation.timeRange);
    setCurrentTime(annotation.timeRange.start);
    setCurrentLabel(annotation.label);
    setSideView(annotation.sideView || false);
    setPostag(annotation.postag || "");
    toast("Annotation selected", { description: `Jumped to: ${annotation.label}` });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      
      switch (e.key) {
        case ' ':
          e.preventDefault();
          setIsPlaying(prev => !prev);
          break;
        case 'r':
          e.preventDefault();
          setCurrentTime(0);
          break;
        case 'Enter':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleAddAnnotation();
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setCurrentTime((prev) => Math.max(0, prev - 1));
          break;
        case 'ArrowRight':
          e.preventDefault();
          setCurrentTime((prev) => Math.min(duration, prev + 1));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleAddAnnotation]);

  // // Auto-save to localStorage
  // useEffect(() => {
  //   if (annotations.length > 0) {
  //     localStorage.setItem('videoAnnotations', JSON.stringify(annotations));
  //   }
  // }, [annotations]);

  // // Load saved annotations
  // useEffect(() => {
  //   const saved = localStorage.getItem('videoAnnotations');
  //   if (saved) {
  //     try {
  //       const parsed = JSON.parse(saved);
  //       // Only load if we have a video file
  //       if (videoFile && parsed.length > 0) {
  //         setAnnotations(parsed.map((ann: any) => ({
  //           ...ann,
  //           createdAt: new Date(ann.createdAt)
  //         })));
  //       }
  //     } catch (error) {
  //       console.error('Failed to load saved annotations:', error);
  //     }
  //   }
  // }, [videoFile]);

  // Prevent accidental page leave
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (annotations.length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [annotations.length]);

  // Cleanup video URL when component unmounts
  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Video Annotation Tool
          </h1>
          <p className="text-muted-foreground text-lg">
            Create labeled video clips for your dataset
          </p>
          
          {/* Stats */}
          {videoFile && (
            <div className="flex justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                <span>{annotations.length} annotations</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-accent rounded-full"></div>
                <span>{(annotations.reduce((sum, ann) => sum + (ann.timeRange.end - ann.timeRange.start), 0)).toFixed(1)}s total</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-secondary rounded-full"></div>
                <span>{videoFile.name}</span>
              </div>
            </div>
          )}
          
          
        </div>

        {/* Upload Section */}
        {!videoFile && (
          <Card className="p-8 border-dashed border-2 border-primary/30 bg-gradient-accent hover:border-primary/50 transition-colors">
            <div className="text-center space-y-4">
              {isUploading ? (
                <>
                  <div className="h-16 w-16 mx-auto rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Processing Video...</h3>
                    <p className="text-muted-foreground">Please wait while we load your video</p>
                  </div>
                </>
              ) : (
                <>
                  <Upload className="h-16 w-16 text-primary mx-auto hover-scale" />
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Upload Video File</h3>
                    <p className="text-muted-foreground mb-4">
                      Drag & drop or click to select • Max 500MB • MP4, AVI, MOV supported
                    </p>
                    <Button 
                      onClick={handleUploadClick} 
                      size="lg" 
                      className="shadow-glow"
                      disabled={isUploading}
                    >
                      <Video className="w-5 h-5 mr-2" />
                      Choose Video File
                    </Button>
                  </div>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isUploading}
              />
            </div>
          </Card>
        )}

        {/* Main Interface */}
        {videoFile && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Video Player Section */}
            <div className="xl:col-span-2 space-y-4">
              <VideoPlayer
                videoUrl={videoUrl}
                cropArea={cropArea}
                onCropAreaChange={setCropArea}
                onResolutionChange={setResolutionInfo}
                currentTime={currentTime}
                onTimeUpdate={setCurrentTime}
                onDurationChange={setDuration}
                isPlaying={isPlaying}
                onPlayStateChange={setIsPlaying}
              />
              {/* Timeline Component */}
              <Timeline
                duration={duration}
                currentTime={currentTime}
                timeRange={timeRange}
                onTimeRangeChange={setTimeRange}
                onCurrentTimeChange={setCurrentTime}
                annotations={annotations}
              />
            </div>

            {/* Control Panel */}
            <div className="space-y-4">
              <AnnotationPanel
                label={currentLabel}
                onLabelChange={setCurrentLabel}
                cropArea={cropArea}
                timeRange={timeRange}
                onAddAnnotation={handleAddAnnotation}
                annotations={annotations}
                onDeleteAnnotation={handleDeleteAnnotation}
                onSelectAnnotation={handleSelectAnnotation}
                selectedAnnotation={selectedAnnotation}
                startIndex={startIndex}
                setStartIndex={setStartIndex}
                postag={postag}
                onPostagChange={setPostag}
                sideView={sideView}
                onSideViewChange={setSideView}
              />
              
              <ExportManager
                annotations={annotations}
                videoFile={videoFile}
                resolutionInfo={resolutionInfo}
                videoFileName={videoFile?.name || ""}
              />
            </div>
          </div>
        )}

        {/* Confirmation Dialog */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Replace current video?</AlertDialogTitle>
              <AlertDialogDescription>
                You have {annotations.length} unsaved annotations. Loading a new video will remove all current annotations. 
                Make sure to export your work first if you want to keep it.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleCancelNewVideo}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmNewVideo}>
                Replace Video
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};