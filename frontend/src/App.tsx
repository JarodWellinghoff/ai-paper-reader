import React, { useState } from "react";
import { FileUpload } from "./components/FileUpload";
import { ProcessingStatusComponent } from "./components/ProcessingStatus";
import { PDFViewer } from "./components/PDFViewer";
import { VoiceControls } from "./components/VoiceControls";

interface ProcessingStatus {
  stage: string;
  progress: number;
}

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

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setPdfUrl("");
    setCurrentPosition(0);
  };

  const simulateProcessing = async () => {
    setIsProcessing(true);
    const stages = [
      { stage: "Uploading file...", progress: 20 },
      { stage: "Processing PDF...", progress: 40 },
      { stage: "Extracting content for audio...", progress: 60 },
      { stage: "Generating AI voice...", progress: 80 },
      { stage: "Finalizing...", progress: 100 },
    ];

    for (const status of stages) {
      setProcessingStatus(status);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (file) {
      const url = URL.createObjectURL(file);
      setPdfUrl(url);
    }

    setIsProcessing(false);
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSpeedChange = (speed: number) => {
    setVoiceSpeed(speed);
  };

  const handlePositionChange = (position: number) => {
    setCurrentPosition(position);
  };

  const resetApp = () => {
    setFile(null);
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
    }
    setPdfUrl("");
    setIsProcessing(false);
    setIsPlaying(false);
    setCurrentPosition(0);
    setVoiceSpeed(1);
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
            onProcess={simulateProcessing}
            onCancel={resetApp}
          />
        )}

        {/* Processing Status */}
        {isProcessing && (
          <ProcessingStatusComponent status={processingStatus} />
        )}

        {/* PDF Display and Controls */}
        {pdfUrl && (
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
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
