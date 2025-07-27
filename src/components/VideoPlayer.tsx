import { useRef, useEffect, useState, useCallback } from "react";
import { CropArea } from "./VideoAnnotationTool";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw } from "lucide-react";

interface VideoPlayerProps {
  videoUrl: string;
  cropArea: CropArea;
  onCropAreaChange: (area: CropArea) => void;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  isPlaying: boolean;
  onPlayStateChange: (playing: boolean) => void;
  // Props
  onResolutionChange?: (res: {
    videoWidth: number;
    videoHeight: number;
    canvasWidth: number;
    canvasHeight: number;
  }) => void;

}

interface DragState {
  isDragging: boolean;
  isResizing: boolean;
  dragStart: { x: number; y: number };
  initialCrop: CropArea;
  resizeHandle?: string;
}

export const VideoPlayer = ({
  videoUrl,
  cropArea,
  onCropAreaChange,
  currentTime,
  onTimeUpdate,
  onDurationChange,
  isPlaying,
  onPlayStateChange,
  onResolutionChange
}: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
  const [videoResolution, setVideoResolution] = useState<{ width: number, height: number }>({ width: 0, height: 0 });
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    isResizing: false,
    dragStart: { x: 0, y: 0 },
    initialCrop: cropArea
  });

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;

      setVideoResolution({ width, height });

      onResolutionChange?.({
        videoWidth: width,
        videoHeight: height,
        canvasWidth: width,
        canvasHeight: height,
      });
      onDurationChange(video.duration);
    };

    const handleTimeUpdate = () => {
      onTimeUpdate(video.currentTime);
    };

    const handlePlay = () => onPlayStateChange(true);
    const handlePause = () => onPlayStateChange(false);

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [onTimeUpdate, onDurationChange, onPlayStateChange]);

  // Sync video time with currentTime prop
  useEffect(() => {
    const video = videoRef.current;
    if (!video || Math.abs(video.currentTime - currentTime) < 0.1) return;
    video.currentTime = currentTime;
  }, [currentTime]);

  // Play/pause control
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  }, [isPlaying]);

  // Reset video to start
  const resetVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    onTimeUpdate(0);
  }, [onTimeUpdate]);

  // Mouse event handlers for crop area
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if clicking on resize handles
    const handleSize = 8;
    const { x: cropX, y: cropY, width, height } = cropArea;
    
    let resizeHandle = '';
    if (Math.abs(x - cropX) < handleSize && Math.abs(y - cropY) < handleSize) {
      resizeHandle = 'nw';
    } else if (Math.abs(x - (cropX + width)) < handleSize && Math.abs(y - cropY) < handleSize) {
      resizeHandle = 'ne';
    } else if (Math.abs(x - cropX) < handleSize && Math.abs(y - (cropY + height)) < handleSize) {
      resizeHandle = 'sw';
    } else if (Math.abs(x - (cropX + width)) < handleSize && Math.abs(y - (cropY + height)) < handleSize) {
      resizeHandle = 'se';
    }

    setDragState({
      isDragging: !resizeHandle,
      isResizing: !!resizeHandle,
      dragStart: { x, y },
      initialCrop: cropArea,
      resizeHandle
    });
  }, [cropArea]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState.isDragging && !dragState.isResizing) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const deltaX = x - dragState.dragStart.x;
    const deltaY = y - dragState.dragStart.y;

    if (dragState.isDragging) {
      // Dragging the entire crop area
      const newX = Math.max(0, Math.min(rect.width - dragState.initialCrop.width, dragState.initialCrop.x + deltaX));
      const newY = Math.max(0, Math.min(rect.height - dragState.initialCrop.height, dragState.initialCrop.y + deltaY));

      onCropAreaChange({
        ...dragState.initialCrop,
        x: newX,
        y: newY
      });
    } else if (dragState.isResizing) {
      // Resizing the crop area
      let newCrop = { ...dragState.initialCrop };

      switch (dragState.resizeHandle) {
        case 'nw':
          newCrop.x = Math.max(0, dragState.initialCrop.x + deltaX);
          newCrop.y = Math.max(0, dragState.initialCrop.y + deltaY);
          newCrop.width = Math.max(50, dragState.initialCrop.width - deltaX);
          newCrop.height = Math.max(50, dragState.initialCrop.height - deltaY);
          break;
        case 'ne':
          newCrop.y = Math.max(0, dragState.initialCrop.y + deltaY);
          newCrop.width = Math.max(50, dragState.initialCrop.width + deltaX);
          newCrop.height = Math.max(50, dragState.initialCrop.height - deltaY);
          break;
        case 'sw':
          newCrop.x = Math.max(0, dragState.initialCrop.x + deltaX);
          newCrop.width = Math.max(50, dragState.initialCrop.width - deltaX);
          newCrop.height = Math.max(50, dragState.initialCrop.height + deltaY);
          break;
        case 'se':
          newCrop.width = Math.max(50, dragState.initialCrop.width + deltaX);
          newCrop.height = Math.max(50, dragState.initialCrop.height + deltaY);
          break;
      }

      onCropAreaChange(newCrop);
    }
  }, [dragState, onCropAreaChange]);

  const handleMouseUp = useCallback(() => {
    setDragState({
      isDragging: false,
      isResizing: false,
      dragStart: { x: 0, y: 0 },
      initialCrop: cropArea
    });
  }, [cropArea]);

  return (
  <Card className="p-4 bg-video-bg border-border/50 flex flex-col items-center space-y-4">
    {/* Video Container */}
    <div 
      className="flex justify-center items-center bg-black rounded-lg shadow-elegant overflow-hidden"
      style={{ maxWidth: '100%', maxHeight: '80vh' }}
    >
      <div
        ref={containerRef}
        className="relative"
        style={{
          width: `${videoResolution.width}px`,
          height: `${videoResolution.height}px`,
          cursor: dragState.isDragging ? 'grabbing' : 'default'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          width={videoResolution.width}
          height={videoResolution.height}
          style={{ display: 'block' }}
          onContextMenu={e => e.preventDefault()}
        />

        {/* Crop Overlay */}
        <div 
          className="absolute border-2 border-crop-overlay bg-crop-overlay/10"
          style={{
            left: cropArea.x,
            top: cropArea.y,
            width: cropArea.width,
            height: cropArea.height,
            cursor: 'grab'
          }}
        >
          {/* Resize Handles */}
          {['nw', 'ne', 'sw', 'se'].map(handle => (
            <div
              key={handle}
              className="absolute w-3 h-3 bg-crop-overlay border border-background rounded-full"
              style={{
                top: handle.includes('n') ? -6 : cropArea.height - 6,
                left: handle.includes('w') ? -6 : cropArea.width - 6,
                cursor: `${handle}-resize`
              }}
            />
          ))}

          {/* Crop Info */}
          <div className="absolute -top-8 left-0 bg-crop-overlay text-primary-foreground px-2 py-1 rounded text-xs">
            {Math.round(cropArea.width)}×{Math.round(cropArea.height)}
          </div>
        </div>
      </div>
    </div>

    {/* Video Controls */}
    <div className="flex items-center justify-center gap-4 mt-2">
      <Button variant="outline" size="sm" onClick={resetVideo}>
        <RotateCcw className="w-4 h-4" />
      </Button>
      
      <Button variant="outline" size="sm" onClick={() => onTimeUpdate(Math.max(currentTime - 1, 0))}>
        ⏪ -1s
      </Button>

      <Button onClick={togglePlay} size="lg" className="shadow-glow">
        {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
      </Button>

      <Button variant="outline" size="sm" onClick={() => onTimeUpdate(Math.min(currentTime + 1, videoRef.current?.duration || 0))}>
        +1s ⏩
      </Button>

      <div className="text-sm text-muted-foreground min-w-[100px] text-center">
        {Math.floor(currentTime / 60)}:{(currentTime % 60).toFixed(1).padStart(4, '0')}
      </div>
    </div>
  </Card>
);
};
