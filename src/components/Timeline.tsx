import { useCallback, useMemo } from "react";
import { TimeRange, Annotation } from "./VideoAnnotationTool";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";

interface TimelineProps {
  duration: number;
  currentTime: number;
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  onCurrentTimeChange: (time: number) => void;
  annotations: Annotation[];
}

export const Timeline = ({
  duration,
  currentTime,
  timeRange,
  onTimeRangeChange,
  onCurrentTimeChange,
  annotations
}: TimelineProps) => {
  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const handleCurrentTimeChange = useCallback((value: number[]) => {
    onCurrentTimeChange(value[0]);
  }, [onCurrentTimeChange]);

  const handleStartTimeChange = useCallback((value: number[]) => {
    const newStart = value[0];
    if (newStart < timeRange.end) {
      onTimeRangeChange({ ...timeRange, start: newStart });
    }
  }, [timeRange, onTimeRangeChange]);

  const handleEndTimeChange = useCallback((value: number[]) => {
    const newEnd = value[0];
    if (newEnd > timeRange.start) {
      onTimeRangeChange({ ...timeRange, end: newEnd });
    }
  }, [timeRange, onTimeRangeChange]);

  const annotationBlocks = useMemo(() => {
    if (duration === 0) return [];
    
    return annotations.map(annotation => ({
      ...annotation,
      leftPercent: (annotation.timeRange.start / duration) * 100,
      widthPercent: ((annotation.timeRange.end - annotation.timeRange.start) / duration) * 100
    }));
  }, [annotations, duration]);

  const timeRangePercent = useMemo(() => {
    if (duration === 0) return { left: 0, width: 0 };
    
    return {
      left: (timeRange.start / duration) * 100,
      width: ((timeRange.end - timeRange.start) / duration) * 100
    };
  }, [timeRange, duration]);

  if (duration === 0) {
    return (
      <Card className="p-4 bg-timeline-bg">
        <div className="text-center text-muted-foreground">
          Load a video to see timeline
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-timeline-bg space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Timeline</h3>
        
        {/* Main Timeline */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>0:00</span>
            <span>Current: {formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          
          {/* Timeline Track */}
          <div className="relative">
            {/* Background track */}
            <div className="h-12 bg-secondary/30 rounded-lg relative overflow-hidden">
              {/* Annotation blocks */}
              {annotationBlocks.map((annotation, index) => (
                <div
                  key={annotation.id}
                  className="absolute top-0 h-3 bg-accent/60 rounded"
                  style={{
                    left: `${annotation.leftPercent}%`,
                    width: `${annotation.widthPercent}%`
                  }}
                  title={`${annotation.label} (${formatTime(annotation.timeRange.start)} - ${formatTime(annotation.timeRange.end)})`}
                />
              ))}
              
              {/* Selection range */}
              <div
                className="absolute top-3 h-6 bg-primary/40 border-2 border-primary rounded"
                style={{
                  left: `${timeRangePercent.left}%`,
                  width: `${timeRangePercent.width}%`
                }}
              />
              
              {/* Current time indicator */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-crop-overlay shadow-glow z-10"
                style={{
                  left: `${(currentTime / duration) * 100}%`
                }}
              />
            </div>
            
            {/* Current time slider */}
            <div className="mt-2">
              <Slider
                value={[currentTime]}
                onValueChange={handleCurrentTimeChange}
                max={duration}
                step={0.1}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Time Range Controls */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Start Time</label>
            <div className="space-y-1">
              <Slider
                value={[timeRange.start]}
                onValueChange={handleStartTimeChange}
                max={Math.min(duration, timeRange.end - 0.1)}
                step={0.1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatTime(timeRange.start)}</span>
                <span>{formatTime(timeRange.end - timeRange.start)} duration</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">End Time</label>
            <div className="space-y-1">
              <Slider
                value={[timeRange.end]}
                onValueChange={handleEndTimeChange}
                min={Math.max(0, timeRange.start + 0.1)}
                max={duration}
                step={0.1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatTime(timeRange.end)}</span>
                <span>Max: {formatTime(duration)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Annotation List */}
        {annotations.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Annotations ({annotations.length})</h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {annotations.map((annotation, index) => (
                <div
                  key={annotation.id}
                  className="flex items-center justify-between text-xs p-2 bg-secondary/20 rounded"
                >
                  <span className="font-medium truncate flex-1">{annotation.label}</span>
                  <span className="text-muted-foreground ml-2">
                    {formatTime(annotation.timeRange.start)} - {formatTime(annotation.timeRange.end)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};