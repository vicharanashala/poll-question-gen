"""
FastAPI server for Whisper Tiny transcription API
Supports GPU acceleration via CUDA
"""

from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import torch
import os
import tempfile
import logging
from pathlib import Path
import time
import shutil

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Find ffmpeg and add to PATH if needed
def setup_ffmpeg_path():
    """Ensure ffmpeg is in PATH"""
    # Check if ffmpeg is already available
    if shutil.which("ffmpeg"):
        logger.info(f"✅ ffmpeg found in PATH: {shutil.which('ffmpeg')}")
        return
    
    # Common locations for user-installed ffmpeg
    possible_paths = [
        os.path.expanduser("~/.local/ffmpeg/ffmpeg"),
        os.path.expanduser("~/.local/bin/ffmpeg"),
        os.path.expanduser("~/ffmpeg/ffmpeg"),
        "/usr/local/bin/ffmpeg",
        "/usr/bin/ffmpeg",
    ]
    
    for ffmpeg_path in possible_paths:
        if os.path.exists(ffmpeg_path) and os.access(ffmpeg_path, os.X_OK):
            ffmpeg_dir = os.path.dirname(ffmpeg_path)
            if ffmpeg_dir not in os.environ.get("PATH", "").split(":"):
                os.environ["PATH"] = f"{ffmpeg_dir}:{os.environ.get('PATH', '')}"
                logger.info(f"✅ Added ffmpeg to PATH: {ffmpeg_dir}")
                return
    
    # If still not found, check if we can find it in common static build locations
    home_ffmpeg = os.path.expanduser("~/.local/ffmpeg")
    if os.path.exists(home_ffmpeg):
        if home_ffmpeg not in os.environ.get("PATH", "").split(":"):
            os.environ["PATH"] = f"{home_ffmpeg}:{os.environ.get('PATH', '')}"
            logger.info(f"✅ Added {home_ffmpeg} to PATH")
    
    # Final check
    if shutil.which("ffmpeg"):
        logger.info(f"✅ ffmpeg now available: {shutil.which('ffmpeg')}")
    else:
        logger.warning("⚠️  ffmpeg not found. Audio processing may fail.")
        logger.warning("   Make sure ffmpeg is installed and in PATH")
        logger.warning("   Or add it to PATH: export PATH=$PATH:~/.local/ffmpeg")

# Setup ffmpeg path on import
setup_ffmpeg_path()

# Use openai-whisper (more stable, better compatibility)
try:
    import whisper
    USE_OPENAI_WHISPER = True
    logger.info("Using openai-whisper")
except ImportError:
    USE_OPENAI_WHISPER = False
    try:
        from faster_whisper import WhisperModel
        USE_FASTER_WHISPER = True
        logger.warning("openai-whisper not found, falling back to faster-whisper")
    except ImportError:
        logger.error("Neither openai-whisper nor faster-whisper is installed!")
        raise

app = FastAPI(
    title="Whisper Transcription API",
    description="API for transcribing audio files using Whisper Tiny model",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model instance
model = None
model_name = "tiny"
device = "cuda" if torch.cuda.is_available() else "cpu"
compute_type = "int8"  # Only used for faster-whisper fallback

# Response models
class TranscriptionResponse(BaseModel):
    text: str

class HealthResponse(BaseModel):
    status: str
    device: str
    model_loaded: bool
    cuda_available: bool

@app.on_event("startup")
async def load_model():
    """Load Whisper model on startup"""
    global model, device, compute_type
    
    logger.info("=" * 60)
    logger.info("Initializing Whisper Model")
    logger.info("=" * 60)
    
    # Allow forcing CPU mode via environment variable (useful for cuDNN issues)
    force_cpu = os.environ.get("FORCE_CPU", "false").lower() == "true"
    
    if force_cpu:
        logger.info("⚠️  FORCE_CPU environment variable set - using CPU mode")
        device = "cpu"
        compute_type = "int8"
    elif torch.cuda.is_available():
        device = "cuda"
        compute_type = "int8"  # Default to int8 to avoid cuDNN issues
        logger.info(f"CUDA available: True")
        logger.info(f"GPU: {torch.cuda.get_device_name(0)}")
        logger.info(f"GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.2f} GB")
        logger.info("Using GPU with int8 compute type (more compatible)")
    else:
        device = "cpu"
        compute_type = "int8"
        logger.info("CUDA not available - using CPU")
    
    try:
        if USE_OPENAI_WHISPER:
            logger.info(f"Loading openai-whisper model: {model_name} on {device}")
            try:
                model = whisper.load_model(model_name, device=device)
                logger.info(f"✅ Model loaded successfully on {device}")
            except Exception as e:
                logger.warning(f"GPU load failed: {e}, falling back to CPU")
                device = "cpu"
                model = whisper.load_model(model_name, device="cpu")
                logger.info("✅ Model loaded on CPU as fallback")
        elif USE_FASTER_WHISPER:
            logger.info(f"Loading faster-whisper model: {model_name} on {device}")
            # Try different compute types if cuDNN fails
            compute_types_to_try = ["int8", "float16", "float32"] if device == "cuda" else ["int8"]
            
            for ct in compute_types_to_try:
                try:
                    logger.info(f"Trying compute_type: {ct}")
                    model = WhisperModel(model_name, device=device, compute_type=ct)
                    compute_type = ct
                    logger.info(f"✅ Model loaded with compute_type: {ct}")
                    break
                except Exception as e:
                    logger.warning(f"Failed with compute_type {ct}: {e}")
                    if ct == compute_types_to_try[-1]:
                        # Last attempt failed, fallback to CPU
                        logger.warning("Falling back to CPU...")
                        device = "cpu"
                        model = WhisperModel(model_name, device="cpu", compute_type="int8")
                        compute_type = "int8"
                        break
                    continue
        
        logger.info("✅ Model loaded successfully!")
        logger.info(f"Final device: {device}")
        if not USE_OPENAI_WHISPER:
            logger.info(f"Compute type: {compute_type}")
        logger.info("=" * 60)
    except Exception as e:
        logger.error(f"❌ Error loading model: {e}")
        logger.error("Trying CPU fallback...")
        try:
            device = "cpu"
            if USE_OPENAI_WHISPER:
                model = whisper.load_model(model_name, device="cpu")
            elif USE_FASTER_WHISPER:
                model = WhisperModel(model_name, device="cpu", compute_type="int8")
            logger.info("✅ Model loaded on CPU as fallback")
        except Exception as fallback_error:
            logger.error(f"❌ CPU fallback also failed: {fallback_error}")
            raise

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "device": device,
        "model_loaded": model is not None,
        "cuda_available": torch.cuda.is_available()
    }

@app.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
    task: str = Form("transcribe"),
    beam_size: int = Form(5),
    best_of: int = Form(5),
    temperature: float = Form(0.0),
    vad_filter: bool = Form(False),
):
    """
    Transcribe audio file
    
    Parameters:
    - file: Audio file (mp3, wav, m4a, etc.)
    - language: Language code (e.g., 'en', 'hi', 'es'). If None, auto-detect
    - task: 'transcribe' or 'translate'
    - beam_size: Beam size for beam search (default: 5)
    - best_of: Number of candidates (default: 5)
    - temperature: Sampling temperature (default: 0.0 for greedy)
    - vad_filter: Enable voice activity detection filter (faster-whisper only)
    """
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    start_time = time.time()
    
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp_file:
        try:
            # Write uploaded file to temp file
            content = await file.read()
            tmp_file.write(content)
            tmp_file_path = tmp_file.name
            
            logger.info(f"Processing file: {file.filename} ({len(content)} bytes)")
            
            # Transcribe
            if USE_OPENAI_WHISPER:
                # OpenAI Whisper
                result_dict = model.transcribe(
                    tmp_file_path,
                    language=language,
                    task=task,
                    beam_size=beam_size,
                    best_of=best_of,
                    temperature=temperature,
                )
                
                result = {
                    "text": result_dict.get("text", "").strip()
                }
            elif USE_FASTER_WHISPER:
                try:
                    segments, info = model.transcribe(
                        tmp_file_path,
                        language=language,
                        task=task,
                        beam_size=beam_size,
                        best_of=best_of,
                        temperature=temperature,
                        vad_filter=vad_filter,
                    )
                except Exception as e:
                    # If cuDNN error occurs during transcription, log and re-raise
                    if "cudnn" in str(e).lower() or "Invalid handle" in str(e):
                        logger.error(f"cuDNN error during transcription: {e}")
                        logger.error("This usually indicates cuDNN compatibility issues")
                        raise HTTPException(
                            status_code=500,
                            detail=f"GPU processing error (cuDNN issue). Try restarting with CPU mode or fix cuDNN installation."
                        )
                    raise
                
                # Collect text from segments
                full_text_parts = []
                
                for segment in segments:
                    full_text_parts.append(segment.text)
                
                full_text = " ".join(full_text_parts)
                
                result = {
                    "text": full_text.strip()
                }
            
            logger.info(f"Transcription completed in {time.time() - start_time:.2f}s")
            logger.info(f"Text length: {len(result['text'])} characters")
            
            return result
            
        except Exception as e:
            logger.error(f"Error during transcription: {e}")
            raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
        
        finally:
            # Clean up temp file
            if os.path.exists(tmp_file_path):
                os.unlink(tmp_file_path)

@app.post("/transcribe/url")
async def transcribe_from_url(
    url: str = Form(...),
    language: Optional[str] = Form(None),
    task: str = Form("transcribe"),
):
    """
    Transcribe audio from URL
    
    Note: This downloads the file first, so use with caution for large files
    """
    import urllib.request
    
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    start_time = time.time()
    
    # Download file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp_file:
        try:
            logger.info(f"Downloading audio from URL: {url}")
            urllib.request.urlretrieve(url, tmp_file.name)
            tmp_file_path = tmp_file.name
            
            # Use same transcription logic as file upload
            if USE_OPENAI_WHISPER:
                result_dict = model.transcribe(tmp_file_path, language=language, task=task)
                result = {
                    "text": result_dict.get("text", "").strip()
                }
            elif USE_FASTER_WHISPER:
                segments, info = model.transcribe(
                    tmp_file_path,
                    language=language,
                    task=task,
                )
                
                full_text_parts = []
                for segment in segments:
                    full_text_parts.append(segment.text)
                
                result = {
                    "text": " ".join(full_text_parts).strip()
                }
            
            return result
            
        except Exception as e:
            logger.error(f"Error transcribing from URL: {e}")
            raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
        
        finally:
            if os.path.exists(tmp_file_path):
                os.unlink(tmp_file_path)

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.environ.get("PORT", 8082))
    host = os.environ.get("HOST", "0.0.0.0")
    
    logger.info(f"Starting server on {host}:{port}")
    uvicorn.run(app, host=host, port=port)

