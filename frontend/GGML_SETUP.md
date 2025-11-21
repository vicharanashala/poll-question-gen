# GGML Transcription Setup

## Files Copied

The following files have been copied from `/home/aic_u2/Shubhankar/Pop/spandan/transcribejs`:

1. **WASM Files** (copied to `public/`):
   - `shout.wasm.js` - Main WASM module
   - `shout.wasm.worker.mjs` - Worker file for WASM

## NPM Packages Added

The following packages have been added to `package.json`:
- `@transcribe/shout@^1.0.6`
- `@transcribe/transcriber@^3.0.0`

## Installation Steps

1. **Install npm packages:**
   ```bash
   cd frontend
   npm install
   ```

2. **Verify WASM files are in place:**
   ```bash
   ls public/shout.wasm.js
   ls public/shout.wasm.worker.mjs
   ```

## Vite Configuration

The `vite.config.ts` has been updated with an alias to map `@transcribe/shout` to the WASM file.

## How It Works

- The GGML worker (`worker-ggml.js`) uses `@transcribe/transcriber` and `@transcribe/shout`
- The WASM files are served from the `public/` directory
- Vite's alias configuration maps the package import to the WASM file
- Models are downloaded and cached in IndexedDB

## Notes

- The first time you use GGML, it will download the model (default: `ggml-tiny.en.bin`)
- Models are cached in IndexedDB for faster subsequent loads
- The worker handles audio conversion from Float32Array to WAV format automatically

