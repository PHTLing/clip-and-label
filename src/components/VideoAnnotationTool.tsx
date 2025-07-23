import { useState, useRef, useCallback, useEffect } from "react";
import { VideoPlayer } from "./VideoPlayer";
import { Timeline } from "./Timeline";
import { AnnotationPanel } from "./AnnotationPanel";
import { ExportManager } from "./ExportManager";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  cropArea: CropArea;
  timeRange: TimeRange;
  filename: string;
  createdAt: Date;
}

export const VideoAnnotationTool = () => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [cropArea, setCropArea] = useState<CropArea>({ x: 0, y: 0, width: 200, height: 200 });
  const [timeRange, setTimeRange] = useState<TimeRange>({ start: 0, end: 5 });
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [currentLabel, setCurrentLabel] = useState<string>("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      toast("Video loaded successfully!", { description: `File: ${file.name}` });
    } else {
      toast("Please select a valid video file");
    }
  }, []);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const generateFilename = useCallback((label: string, index: number) => {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const cleanLabel = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    return `clip_${timestamp}_${cleanLabel || 'unlabeled'}_${index + 1}.mp4`;
  }, []);

  const handleAddAnnotation = useCallback(() => {
    if (!currentLabel.trim()) {
      toast("Please enter a label for the annotation");
      return;
    }

    if (timeRange.start >= timeRange.end) {
      toast("Invalid time range");
      return;
    }

    const newAnnotation: Annotation = {
      id: Date.now().toString(),
      label: currentLabel.trim(),
      cropArea: { ...cropArea },
      timeRange: { ...timeRange },
      filename: generateFilename(currentLabel, annotations.length),
      createdAt: new Date()
    };

    setAnnotations(prev => [...prev, newAnnotation]);
    setCurrentLabel("");
    toast("Annotation added successfully!", { 
      description: `Label: ${newAnnotation.label}` 
    });
  }, [currentLabel, cropArea, timeRange, annotations.length, generateFilename]);

  const handleDeleteAnnotation = useCallback((id: string) => {
    setAnnotations(prev => prev.filter(ann => ann.id !== id));
    toast("Annotation deleted");
  }, []);

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
        </div>

        {/* Upload Section */}
        {!videoFile && (
          <Card className="p-8 border-dashed border-2 border-primary/30 bg-gradient-accent">
            <div className="text-center space-y-4">
              <Upload className="h-16 w-16 text-primary mx-auto" />
              <div>
                <h3 className="text-xl font-semibold mb-2">Upload Video File</h3>
                <p className="text-muted-foreground mb-4">
                  Select a video file to start creating annotations
                </p>
                <Button onClick={handleUploadClick} size="lg" className="shadow-glow">
                  <Video className="w-5 h-5 mr-2" />
                  Choose Video File
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileUpload}
                className="hidden"
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
                currentTime={currentTime}
                onTimeUpdate={setCurrentTime}
                onDurationChange={setDuration}
                isPlaying={isPlaying}
                onPlayStateChange={setIsPlaying}
              />
              
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
              />
              
              <ExportManager
                annotations={annotations}
                videoFile={videoFile}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};