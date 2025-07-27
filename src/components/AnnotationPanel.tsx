import { CropArea, TimeRange, Annotation } from "./VideoAnnotationTool";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit3, Clock, Scissors } from "lucide-react";

interface AnnotationPanelProps {
  label: string;
  onLabelChange: (label: string) => void;
  cropArea: CropArea;
  timeRange: TimeRange;
  onAddAnnotation: () => void;
  annotations: Annotation[];
  onDeleteAnnotation: (id: string) => void;
  onSelectAnnotation?: (annotation: Annotation) => void;
  selectedAnnotation?: string | null;
  startIndex: number;
  postag?: string;
  onPostagChange?: (val: string) => void;
  setStartIndex: (val: number) => void;
}

export const AnnotationPanel = ({
  label,
  onLabelChange,
  cropArea,
  timeRange,
  onAddAnnotation,
  annotations,
  onDeleteAnnotation,
  onSelectAnnotation,
  selectedAnnotation,
  startIndex,
  setStartIndex,
  postag,
  onPostagChange
}: AnnotationPanelProps) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDimensions = (area: CropArea) => {
    return `${Math.round(area.width)}×${Math.round(area.height)}`;
  };

  return (
    <div className="space-y-4">
      {/* Current Selection Info */}
      <Card className="p-4 bg-gradient-accent border-primary/20">
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Edit3 className="w-4 h-4" />
            Current Selection
          </h3>
          
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Scissors className="w-3 h-3" />
                Crop Area
              </div>
              <Badge variant="outline" className="w-full justify-center">
                {formatDimensions(cropArea)}
              </Badge>
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="w-3 h-3" />
                Duration
              </div>
              <Badge variant="outline" className="w-full justify-center">
                {(timeRange.end - timeRange.start).toFixed(1)}s
              </Badge>
            </div>
          </div>
          
          <div className="text-xs text-muted-foreground">
            Time: {formatTime(timeRange.start)} → {formatTime(timeRange.end)}
          </div>
        </div>
      </Card>

      {/* Start Index */}
      <div className="space-y-2">
            <Label htmlFor="startIndex">Start Index</Label>
            <Input
              id="startIndex"
              type="number"
              min={0}
              placeholder="0"
              onChange={(e) => setStartIndex(Number(e.target.value))}
              className="w-full"
            />
          </div>
      {/* Add Annotation */}
      <Card className="p-4">
        <div className="space-y-4">
          <h3 className="font-semibold">Add Annotation</h3>
          
          <div className="space-y-2">
            <Label htmlFor="label">Label</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => onLabelChange(e.target.value)}
              placeholder="Enter description or label..."
              className="w-full"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="postag">POS Tag (optional)</Label>
            <select
              id="postag"
              value={postag}
              onChange={(e) => onPostagChange?.(e.target.value)}
              className="w-full p-2 rounded bg-muted text-white text-sm"
            >
              <option value="">-- Không chọn --</option>
              <option value="N">N — Danh từ chung</option>
              <option value="Np">Np — Danh từ riêng</option>
              <option value="V">V — Động từ chính</option>
              <option value="A">A — Tính từ</option>
              <option value="P">P — Đại từ</option>
              <option value="R">R — Trạng từ</option>
              <option value="L">L — Mạo từ</option>
              <option value="M">M — Số từ</option>
              <option value="E">E — Giới từ</option>
              <option value="C">C — Liên từ</option>
              <option value="T">T — Trợ từ, tiểu từ</option>
              <option value="I">I — Thán từ</option>
              <option value="Y">Y — Từ cảm thán</option>
              <option value="X">X — Từ không phân loại</option>
              <option value="CH">CH — Từ chỉ định</option>
              <option value="B">B — Giới từ bổ nghĩa</option>
              <option value="Z">Z — Dấu câu</option>
            </select>
          </div>

                    
          <Button 
            onClick={onAddAnnotation}
            className="w-full shadow-glow"
            disabled={!label.trim()}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Annotation
          </Button>
        </div>
      </Card>

      {/* Annotations List */}
      <Card className="p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Annotations</h3>
            <Badge variant="secondary">{annotations.length}</Badge>
          </div>
          
          {annotations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Edit3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No annotations yet</p>
              <p className="text-xs">Add your first annotation above</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {annotations.map((annotation, index) => (
                <div key={annotation.id} className="group">
                  <div 
                    className={`p-3 rounded-lg border transition-all cursor-pointer ${
                      selectedAnnotation === annotation.id 
                        ? 'bg-primary/10 border-primary/50 shadow-glow' 
                        : 'bg-secondary/20 border-border/50 hover:border-primary/30'
                    }`}
                    onClick={() => onSelectAnnotation?.(annotation)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate mb-1 flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            selectedAnnotation === annotation.id ? 'bg-primary' : 'bg-muted-foreground'
                          }`} />
                          {annotation.label}
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3" />
                            {formatTime(annotation.timeRange.start)} - {formatTime(annotation.timeRange.end)}
                            <span className="text-accent">({(annotation.timeRange.end - annotation.timeRange.start).toFixed(1)}s)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Scissors className="w-3 h-3" />
                            {formatDimensions(annotation.cropArea)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectAnnotation?.(annotation);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0 hover:bg-accent/20"
                          title="Jump to annotation"
                        >
                          <Edit3 className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteAnnotation(annotation.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0 hover:bg-destructive/20 hover:text-destructive"
                          title="Delete annotation"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="mt-2 pt-2 border-t border-border/30">
                      <div className="text-xs text-muted-foreground truncate">
                        📁 {annotation.filename}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {annotations.length > 0 && (
            <>
              <Separator />
              <div className="text-xs text-muted-foreground">
                Total clips: {annotations.length} • 
                Total duration: {annotations.reduce((sum, ann) => sum + (ann.timeRange.end - ann.timeRange.start), 0).toFixed(1)}s
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
};