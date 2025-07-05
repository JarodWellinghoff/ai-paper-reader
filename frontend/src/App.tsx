import React, { useState, useRef, useEffect } from "react";
import { FileUpload } from "./components/FileUpload";
import { ProcessingStatusComponent } from "./components/ProcessingStatus";
import { PDFViewer } from "./components/PDFViewer";
import { VoiceControls } from "./components/VoiceControls";

interface ProcessingStatus {
  stage: string;
  progress: number;
  message?: string;
}

interface TextSegment {
  text: string;
  page: number;
  has_figure_reference: boolean;
  figure_references: string[];
}

interface ProcessingResult {
  job_id: string;
  segments: TextSegment[];
  total_pages: number;
  status: string;
}

const API_BASE = "http://localhost:8000/api";

const App = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    stage: "",
    progress: 0,
  });
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [voiceSpeed, setVoiceSpeed] = useState(1);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [currentJobId, setCurrentJobId] = useState<string>("");
  const [segments, setSegments] = useState<TextSegment[]>([]);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [audioElements, setAudioElements] = useState<HTMLAudioElement[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Update position tracking when playing
    if (isPlaying && audioRef.current) {
      intervalRef.current = setInterval(() => {
        if (audioRef.current) {
          const progress =
            (audioRef.current.currentTime / audioRef.current.duration) * 100;
          setCurrentPosition(isNaN(progress) ? 0 : progress);
        }
      }, 100);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying]);

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setPdfUrl("");
    setCurrentPosition(0);
    setSegments([]);
    setCurrentSegmentIndex(0);
  };

  const processWithBackend = async () => {
    if (!file) return;

    setIsProcessing(true);

    try {
      // Upload and start processing
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_BASE}/process-pdf`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload file");
      }

      const { job_id } = await response.json();
      setCurrentJobId(job_id);

      // Poll for status updates
      const pollStatus = async () => {
        try {
          const statusResponse = await fetch(`${API_BASE}/status/${job_id}`);
          if (!statusResponse.ok) return;

          const status = await statusResponse.json();

          // Check if it's a final result
          if (status.segments && status.status === "completed") {
            setSegments(status.segments);
            setProcessingStatus({ stage: "Complete!", progress: 100 });

            // Create PDF URL
            const url = URL.createObjectURL(file);
            setPdfUrl(url);

            // Preload audio elements
            const audioPromises = status.segments.map(
              (_: any, index: number) => {
                const audio = new Audio(`${API_BASE}/audio/${job_id}/${index}`);
                audio.preload = "metadata";
                return audio;
              }
            );

            setAudioElements(audioPromises);
            setIsProcessing(false);
            return;
          }

          // Update processing status
          setProcessingStatus({
            stage: status.stage || "Processing...",
            progress: status.progress || 0,
            message: status.message,
          });

          // Continue polling if not complete
          setTimeout(pollStatus, 1000);
        } catch (error) {
          console.error("Error polling status:", error);
          setProcessingStatus({
            stage: "Error occurred",
            progress: 0,
            message: "Failed to process PDF",
          });
          setIsProcessing(false);
        }
      };

      pollStatus();
    } catch (error) {
      console.error("Error processing file:", error);
      setProcessingStatus({
        stage: "Error occurred",
        progress: 0,
        message: "Failed to upload file",
      });
      setIsProcessing(false);
    }
  };

  const handlePlayPause = async () => {
    if (!audioElements.length) return;

    if (isPlaying) {
      // Pause current audio
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
    } else {
      // Play current segment
      const currentAudio = audioElements[currentSegmentIndex];
      if (currentAudio) {
        audioRef.current = currentAudio;

        // Set playback rate
        currentAudio.playbackRate = voiceSpeed;

        // Handle when segment ends
        currentAudio.onended = () => {
          if (currentSegmentIndex < audioElements.length - 1) {
            setCurrentSegmentIndex((prev) => prev + 1);
            // Auto-play next segment
            setTimeout(() => {
              handlePlayPause();
            }, 500);
          } else {
            setIsPlaying(false);
            setCurrentPosition(0);
          }
        };

        try {
          await currentAudio.play();
          setIsPlaying(true);
        } catch (error) {
          console.error("Error playing audio:", error);
          setIsPlaying(false);
        }
      }
    }
  };

  const handleSpeedChange = (speed: number) => {
    setVoiceSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  const handlePositionChange = (position: number) => {
    if (audioRef.current) {
      const newTime = (position / 100) * audioRef.current.duration;
      audioRef.current.currentTime = newTime;
      setCurrentPosition(position);
    }
  };

  const resetApp = () => {
    // Stop and cleanup audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // Cleanup audio elements
    audioElements.forEach((audio) => {
      audio.pause();
      audio.src = "";
    });

    setFile(null);
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
    }
    setPdfUrl("");
    setIsProcessing(false);
    setIsPlaying(false);
    setCurrentPosition(0);
    setVoiceSpeed(1);
    setSegments([]);
    setCurrentSegmentIndex(0);
    setAudioElements([]);
    setCurrentJobId("");
  };

  return (
    <div className='min-h-screen bg-gray-50 p-6'>
      <div className='max-w-6xl mx-auto'>
        {/* Header */}
        <div className='text-center mb-8'>
          <h1 className='text-4xl font-bold text-gray-900 mb-2'>
            PDF Voice Processor
          </h1>
          <p className='text-gray-600'>
            Upload a PDF and listen to its content with AI voice controls
          </p>
        </div>

        {/* File Upload */}
        {!isProcessing && !pdfUrl && (
          <FileUpload
            file={file}
            onFileSelect={handleFileSelect}
            onProcess={processWithBackend}
            onCancel={resetApp}
          />
        )}

        {/* Processing Status */}
        {isProcessing && (
          <ProcessingStatusComponent status={processingStatus} />
        )}

        {/* PDF Display and Controls */}
        {pdfUrl && segments.length > 0 && (
          <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
            <PDFViewer pdfUrl={pdfUrl} onReset={resetApp} />
            <VoiceControls
              isPlaying={isPlaying}
              voiceSpeed={voiceSpeed}
              currentPosition={currentPosition}
              onPlayPause={handlePlayPause}
              onSpeedChange={handleSpeedChange}
              onPositionChange={handlePositionChange}
            />

            {/* Current Segment Info */}
            <div className='bg-white rounded-lg shadow-lg p-6'>
              <h3 className='text-lg font-semibold text-gray-900 mb-4'>
                Current Segment
              </h3>
              <div className='text-sm text-gray-600 mb-2'>
                Page {segments[currentSegmentIndex]?.page} of{" "}
                {segments[0]?.page
                  ? Math.max(...segments.map((s) => s.page))
                  : "N/A"}
              </div>
              <div className='text-sm text-gray-600 mb-2'>
                Segment {currentSegmentIndex + 1} of {segments.length}
              </div>
              {segments[currentSegmentIndex]?.has_figure_reference && (
                <div className='bg-blue-50 border border-blue-200 rounded p-3 mb-4'>
                  <p className='text-sm text-blue-800 font-medium'>
                    📊 This section references figures:
                  </p>
                  <p className='text-xs text-blue-600 mt-1'>
                    {segments[currentSegmentIndex].figure_references.join(", ")}
                  </p>
                </div>
              )}
              <div className='text-sm text-gray-700 bg-gray-50 rounded p-3 max-h-32 overflow-y-auto'>
                {segments[currentSegmentIndex]?.text.substring(0, 200)}
                {segments[currentSegmentIndex]?.text.length > 200 && "..."}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
