import uvicorn
import os
import tempfile
import uuid
from pathlib import Path
from typing import List, Dict, Optional
import asyncio
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

import pdfplumber
import torch
from transformers import pipeline, AutoTokenizer, AutoModelForSequenceClassification
from TTS.api import TTS
import soundfile as sf
import re
import json

# Global variables for models
tts_model = None
text_analyzer = None
device = "cuda" if torch.cuda.is_available() else "cpu"

# Storage for processing jobs
processing_jobs = {}
audio_files = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global tts_model, text_analyzer

    print(f"Using device: {device}")

    # Initialize TTS model (using Coqui TTS)
    try:
        print("Loading TTS model...")
        tts_model = TTS(
            "tts_models/en/ljspeech/tacotron2-DDC", gpu=torch.cuda.is_available()
        )
        print("TTS model loaded successfully")
    except Exception as e:
        print(f"Error loading TTS model: {e}")
        # Fallback to a simpler model
        try:
            tts_model = TTS(
                "tts_models/en/ljspeech/glow-tts", gpu=torch.cuda.is_available()
            )
        except Exception as e2:
            print(f"Error loading fallback TTS model: {e2}")
            tts_model = None

    # Initialize text analyzer for figure detection
    try:
        print("Loading text analyzer...")
        text_analyzer = pipeline(
            "text-classification",
            model="microsoft/DialoGPT-medium",
            device=0 if torch.cuda.is_available() else -1,
        )
        print("Text analyzer loaded successfully")
    except Exception as e:
        print(f"Error loading text analyzer: {e}")
        text_analyzer = None

    yield

    # Shutdown
    print("Shutting down...")


app = FastAPI(title="PDF Voice Processor", lifespan=lifespan)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ProcessingStatus(BaseModel):
    stage: str
    progress: int
    message: Optional[str] = None


class TextSegment(BaseModel):
    text: str
    page: int
    has_figure_reference: bool
    figure_references: List[str] = []


class ProcessingResult(BaseModel):
    job_id: str
    segments: List[TextSegment]
    total_pages: int
    status: str


def extract_text_from_pdf(pdf_path: str) -> List[Dict]:
    """Extract text from PDF with page information"""
    segments = []

    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            text = page.extract_text()
            if text and text.strip():
                # Clean and segment the text
                paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

                for paragraph in paragraphs:
                    if len(paragraph) > 50:  # Filter out very short segments
                        segments.append(
                            {
                                "text": paragraph,
                                "page": page_num,
                                "total_pages": len(pdf.pages),
                            }
                        )

    return segments


def detect_figure_references(text: str) -> Dict:
    """Detect if text references figures, tables, or charts"""
    # Simple regex-based detection for now
    figure_patterns = [
        r"[Ff]igure\s+\d+",
        r"[Tt]able\s+\d+",
        r"[Cc]hart\s+\d+",
        r"[Gg]raph\s+\d+",
        r"[Dd]iagram\s+\d+",
        r"see\s+above",
        r"see\s+below",
        r"as\s+shown",
        r"illustrated\s+in",
    ]

    references = []
    for pattern in figure_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        references.extend(matches)

    return {
        "has_figure_reference": len(references) > 0,
        "figure_references": references,
    }


def process_text_segments(segments: List[Dict]) -> List[TextSegment]:
    """Process text segments and detect figure references"""
    processed_segments = []

    for segment in segments:
        # Detect figure references
        ref_info = detect_figure_references(segment["text"])

        # Clean text for better TTS
        cleaned_text = clean_text_for_tts(segment["text"])

        processed_segments.append(
            TextSegment(
                text=cleaned_text,
                page=segment["page"],
                has_figure_reference=ref_info["has_figure_reference"],
                figure_references=ref_info["figure_references"],
            )
        )

    return processed_segments


def clean_text_for_tts(text: str) -> str:
    """Clean text to make it more suitable for TTS"""
    # Remove excessive whitespace
    text = re.sub(r"\s+", " ", text)

    # Add pauses for better speech rhythm
    text = re.sub(r"\.([A-Z])", r". \1", text)
    text = re.sub(r",([A-Z])", r", \1", text)

    # Handle common abbreviations
    abbreviations = {
        "et al.": "et al",
        "e.g.": "for example",
        "i.e.": "that is",
        "vs.": "versus",
        "etc.": "et cetera",
    }

    for abbr, replacement in abbreviations.items():
        text = text.replace(abbr, replacement)

    return text.strip()


async def generate_audio_for_segment(
    segment: TextSegment, output_dir: str, segment_index: int
) -> str:
    """Generate audio for a single text segment"""
    global tts_model

    if not tts_model:
        raise HTTPException(status_code=500, detail="TTS model not available")

    # Add figure reference announcements
    text_to_speak = segment.text
    if segment.has_figure_reference:
        reference_text = f"Please refer to {', '.join(segment.figure_references)} mentioned in this section. "
        text_to_speak = reference_text + text_to_speak

    # Generate audio
    output_file = os.path.join(output_dir, f"segment_{segment_index:04d}.wav")

    try:
        # Run TTS in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        with ThreadPoolExecutor() as executor:
            await loop.run_in_executor(
                executor,
                lambda: tts_model.tts_to_file(
                    text=text_to_speak, file_path=output_file
                ),
            )
        return output_file
    except Exception as e:
        print(f"Error generating audio for segment {segment_index}: {e}")
        raise


@app.post("/api/process-pdf")
async def process_pdf(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """Process uploaded PDF and return job ID for tracking"""

    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    # Generate job ID
    job_id = str(uuid.uuid4())

    # Initialize job status
    processing_jobs[job_id] = ProcessingStatus(stage="Uploading file...", progress=0)

    # Save uploaded file
    temp_dir = tempfile.mkdtemp()
    pdf_path = os.path.join(temp_dir, file.filename)

    with open(pdf_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)

    # Start background processing
    background_tasks.add_task(process_pdf_background, job_id, pdf_path)

    return {"job_id": job_id}


async def process_pdf_background(job_id: str, pdf_path: str):
    """Background task to process PDF"""
    try:
        # Stage 1: Extract text
        processing_jobs[job_id] = ProcessingStatus(
            stage="Extracting text from PDF...", progress=20
        )

        segments = extract_text_from_pdf(pdf_path)

        # Stage 2: Process text segments
        processing_jobs[job_id] = ProcessingStatus(
            stage="Analyzing content for voice processing...", progress=40
        )

        processed_segments = process_text_segments(segments)

        # Stage 3: Generate audio
        processing_jobs[job_id] = ProcessingStatus(
            stage="Generating AI voice...", progress=60
        )

        # Create output directory for audio files
        audio_dir = tempfile.mkdtemp()
        audio_files[job_id] = []

        total_segments = len(processed_segments)
        for i, segment in enumerate(processed_segments):
            try:
                audio_file = await generate_audio_for_segment(segment, audio_dir, i)
                audio_files[job_id].append(audio_file)

                # Update progress
                progress = 60 + (30 * (i + 1) / total_segments)
                processing_jobs[job_id] = ProcessingStatus(
                    stage=f"Generating audio segment {i+1}/{total_segments}...",
                    progress=int(progress),
                )
            except Exception as e:
                print(f"Error processing segment {i}: {e}")
                continue

        # Stage 4: Finalize
        processing_jobs[job_id] = ProcessingStatus(stage="Finalizing...", progress=100)

        # Store final result
        processing_jobs[job_id] = ProcessingResult(
            job_id=job_id,
            segments=processed_segments,
            total_pages=segments[0]["total_pages"] if segments else 0,
            status="completed",
        )

    except Exception as e:
        processing_jobs[job_id] = ProcessingStatus(
            stage=f"Error: {str(e)}", progress=0, message=str(e)
        )
        print(f"Error processing PDF for job {job_id}: {e}")


@app.get("/api/status/{job_id}")
async def get_processing_status(job_id: str):
    """Get processing status for a job"""
    if job_id not in processing_jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    return processing_jobs[job_id]


@app.get("/api/audio/{job_id}/{segment_index}")
async def get_audio_segment(job_id: str, segment_index: int):
    """Get audio file for a specific segment"""
    if job_id not in audio_files:
        raise HTTPException(status_code=404, detail="Audio files not found")

    if segment_index >= len(audio_files[job_id]):
        raise HTTPException(status_code=404, detail="Segment not found")

    audio_file = audio_files[job_id][segment_index]

    if not os.path.exists(audio_file):
        raise HTTPException(status_code=404, detail="Audio file not found")

    return FileResponse(
        audio_file, media_type="audio/wav", filename=f"segment_{segment_index}.wav"
    )


@app.post("/api/synthesize-text")
async def synthesize_text(text: str, speed: float = 1.0):
    """Synthesize speech for arbitrary text"""
    global tts_model

    if not tts_model:
        raise HTTPException(status_code=500, detail="TTS model not available")

    # Generate unique filename
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")

    try:
        # Clean text
        cleaned_text = clean_text_for_tts(text)

        # Generate audio in thread pool
        loop = asyncio.get_event_loop()
        with ThreadPoolExecutor() as executor:
            await loop.run_in_executor(
                executor,
                lambda: tts_model.tts_to_file(
                    text=cleaned_text, file_path=temp_file.name
                ),
            )

        return FileResponse(
            temp_file.name, media_type="audio/wav", filename="synthesized_audio.wav"
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating audio: {str(e)}")


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "device": device,
        "cuda_available": torch.cuda.is_available(),
        "tts_model_loaded": tts_model is not None,
        "text_analyzer_loaded": text_analyzer is not None,
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
