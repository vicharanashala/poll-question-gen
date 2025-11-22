// https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_AudioWorklet
class AudioBufferProcessor extends AudioWorkletProcessor {
  sample_rate;
  buffer_size_ms = 10;

  buffer_size;
  buffer = [];

  constructor(options) {
    super(options);

    this.sample_rate = options.processorOptions.sampleRate;
    this.buffer_size_ms =
      options.processorOptions.bufferSizeMs ?? this.buffer_size_ms;
    this.buffer_size = (this.sample_rate * this.buffer_size_ms) / 1000;
  }

  post(cmd, data) {
    this.port.postMessage({
      cmd,
      data,
    });
  }

  process(inputs, outputs, parameters) {
    // Check if input exists
    if (!inputs || !inputs[0] || !inputs[0].length) {
      return true;
    }

    // buffer input data
    if (this.buffer.length < this.buffer_size) {
      try {
        const inputChannel = inputs[0][0];
        if (inputChannel) {
          this.buffer.push(...inputChannel);
        }
      } catch (error) {
        // just catch
      }

      return true;
    }

    this.post("buffer", {
      pcmf32: this.buffer,
    });

    this.buffer = [];

    return true;
  }
}

registerProcessor("buffer", AudioBufferProcessor);
