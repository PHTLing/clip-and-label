import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { Annotation } from '@/components/VideoAnnotationTool';

export class VideoProcessor {
  private ffmpeg: FFmpeg;
  private isLoaded = false;

  constructor() {
    this.ffmpeg = new FFmpeg();
  }

  async load() {
    if (this.isLoaded) return;

    try {
      const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm';
      
      this.ffmpeg.on('log', ({ message }) => {
        console.log(message);
      });

      // Load FFmpeg with JSDelivr CDN (better CORS policy)
      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
      });

      this.isLoaded = true;
    } catch (error) {
      console.error('Failed to load FFmpeg:', error);
      throw error;
    }
  }

  async processAnnotation(
    videoFile: File, 
    annotation: Annotation, 
    canvasResolution: { width: number; height: number },
    videoResolution: { width: number; height: number },
    onProgress?: (progress: number) => void
  ): Promise<Blob> {
    if (!this.isLoaded) {
      await this.load();
    }

    try {
      // Write video file to FFmpeg
      await this.ffmpeg.writeFile('input.mp4', await fetchFile(videoFile));

      const { timeRange, cropArea } = annotation;

      if (!videoResolution || !canvasResolution || !canvasResolution.width || !canvasResolution.height) {
        throw new Error('Missing resolution info');
      }

      // Calculate scale factors
      const scaleX = videoResolution.width / canvasResolution.width;
      const scaleY = videoResolution.height / canvasResolution.height;

      // Ensure crop doesn't exceed boundaries and has minimum size
      const minSize = 32; // Minimum crop size to avoid memory issues
      const cropX = Math.floor(Math.max(0, Math.min(cropArea.x * scaleX, videoResolution.width - minSize)));
      const cropY = Math.floor(Math.max(0, Math.min(cropArea.y * scaleY, videoResolution.height - minSize)));
      const cropW = Math.floor(Math.max(minSize, Math.min(cropArea.width * scaleX, videoResolution.width - cropX)));
      const cropH = Math.floor(Math.max(minSize, Math.min(cropArea.height * scaleY, videoResolution.height - cropY)));
      
      // Ensure even dimensions (required by many codecs)
      const finalCropW = cropW % 2 === 0 ? cropW : cropW - 1;
      const finalCropH = cropH % 2 === 0 ? cropH : cropH - 1;
      
      // FFmpeg command to crop and trim video
      const duration = timeRange.end - timeRange.start;
      
      // Validate duration
      if (duration <= 0 || duration > 3600) { // Max 1 hour
        throw new Error('Invalid duration');
      }

      console.log('Debug Final Crop:', {
        scaleX, scaleY,
        cropArea,
        cropX, cropY, 
        cropW: finalCropW, 
        cropH: finalCropH,
        videoResolution,
        canvasResolution,
        duration
      });

      await this.ffmpeg.exec([
        '-i', 'input.mp4',
        '-ss', timeRange.start.toString(),
        '-t', duration.toString(),
        '-filter:v', `crop=${finalCropW}:${finalCropH}:${cropX}:${cropY}`,
        '-c:v', 'libx264',
        '-preset', 'ultrafast', // Faster encoding
        '-crf', '23', // Quality setting
        '-c:a', 'aac',
        '-avoid_negative_ts', 'make_zero',
        '-y',
        'output.mp4'
      ]);

      // Read the processed video
      const data = await this.ffmpeg.readFile('output.mp4');
      
      if (onProgress) {
        onProgress(100);
      }

      return new Blob([data], { type: 'video/mp4' });

    } catch (error) {
      console.error('FFmpeg processing error:', error);
      throw new Error(`Video processing failed: ${error.message || 'Unknown error'}`);
    } finally {
      // Always cleanup, even on error
      try {
        await this.ffmpeg.deleteFile('input.mp4');
        await this.ffmpeg.deleteFile('output.mp4');
      } catch (cleanupError) {
        console.warn('Cleanup error:', cleanupError);
      }
    }
  }

  async processMultipleAnnotations(
    videoFile: File,
    annotations: Annotation[],
    canvasResolution: { width: number; height: number },
    videoResolution: { width: number; height: number },
    onProgress?: (progress: number, currentIndex: number) => void
  ): Promise<{ filename: string; blob: Blob }[]> {
    const results: { filename: string; blob: Blob }[] = [];

    for (let i = 0; i < annotations.length; i++) {
      const annotation = annotations[i];
      
      if (onProgress) {
        onProgress((i / annotations.length) * 100, i);
      }

      const blob = await this.processAnnotation(videoFile, annotation, canvasResolution,videoResolution);
      results.push({
        filename: annotation.filename,
        blob
      });
    }

    if (onProgress) {
      onProgress(100, annotations.length);
    }

    return results;
  }

  async terminate() {
    if (this.isLoaded) {
      await this.ffmpeg.terminate();
      this.isLoaded = false;
    }
  }
}

// Singleton instance
export const videoProcessor = new VideoProcessor();