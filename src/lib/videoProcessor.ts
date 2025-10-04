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

      // Add progress monitoring and error handling
      this.ffmpeg.on('progress', ({ progress }) => {
        console.log('FFmpeg loading progress:', progress);
      });

      // Load FFmpeg with better error handling
      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
      });

      this.isLoaded = true;
      console.log('FFmpeg loaded successfully');
    } catch (error) {
      console.error('Failed to load FFmpeg:', error);
      this.isLoaded = false;
      throw new Error(`FFmpeg initialization failed: ${error.message}`);
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

    // Memory check before processing
    try {
      const memoryInfo = (performance as any).memory;
      if (memoryInfo && memoryInfo.usedJSHeapSize > 500 * 1024 * 1024) {
        console.warn('High memory usage detected, attempting cleanup');
        if (typeof (window as any).gc === 'function') {
          (window as any).gc();
        }
      }
    } catch (e) {
      // Memory API not available
    }

    try {
      console.log('Starting video processing:', {
        filename: annotation.filename,
        fileSize: Math.round(videoFile.size / 1024 / 1024) + 'MB',
        cropArea: annotation.cropArea,
        timeRange: annotation.timeRange
      });

      // Write video file to FFmpeg with better error handling
      await this.ffmpeg.writeFile('input.mp4', await fetchFile(videoFile));
      console.log('Video file written to FFmpeg successfully');

      const { timeRange, cropArea } = annotation;

      if (!videoResolution || !canvasResolution || !canvasResolution.width || !canvasResolution.height) {
        throw new Error('Missing resolution info');
      }

      // Calculate scale factors - should be identical for both axes if aspect ratio preserved
      const scaleX = videoResolution.width / canvasResolution.width;
      const scaleY = videoResolution.height / canvasResolution.height;

      // Ensure crop doesn't exceed boundaries and has minimum size
      const minSize = 32; // Minimum crop size to avoid memory issues
      
      // Use precise scaling, then round to even numbers (required by codecs)
      const preciseX = cropArea.x * scaleX;
      const preciseY = cropArea.y * scaleY;
      const preciseW = cropArea.width * scaleX;
      const preciseH = cropArea.height * scaleY;
      
      // Round to nearest even number to maintain codec compatibility
      const cropX = Math.max(0, Math.round(preciseX / 2) * 2);
      const cropY = Math.max(0, Math.round(preciseY / 2) * 2);
      const cropW = Math.max(minSize, Math.round(preciseW / 2) * 2);
      const cropH = Math.max(minSize, Math.round(preciseH / 2) * 2);
      
      // Final boundary check
      const finalCropW = Math.min(cropW, videoResolution.width - cropX);
      const finalCropH = Math.min(cropH, videoResolution.height - cropY);
      
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

      // Add progress monitoring for FFmpeg execution
      let progressCallback: (() => void) | undefined;
      if (onProgress) {
        progressCallback = () => {
          const currentProgress = Math.min(95, (Date.now() % 10000) / 100);
          onProgress(currentProgress);
        };
        const progressInterval = setInterval(progressCallback, 100);
        setTimeout(() => clearInterval(progressInterval), 5000);
      }

      console.log('Executing FFmpeg command with parameters:', {
        start: timeRange.start,
        duration,
        crop: `${finalCropW}:${finalCropH}:${cropX}:${cropY}`
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
        '-movflags', '+faststart', // Optimize for web playback
        '-avoid_negative_ts', 'make_zero',
        '-y',
        'output.mp4'
      ]);

      console.log('FFmpeg processing completed');

      // Verify output file exists
      const files = await this.ffmpeg.listDir('/');
      const outputExists = files.some(file => file.name === 'output.mp4');
      if (!outputExists) {
        throw new Error('Output file was not created');
      }

      // Read the processed video
      const data = await this.ffmpeg.readFile('output.mp4');
      
      if (!data || data.length === 0) {
        throw new Error('Output file is empty');
      }

      console.log('Video processing successful, output size:', Math.round(data.length / 1024) + 'KB');
      
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