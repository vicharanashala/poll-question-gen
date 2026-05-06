import { injectable } from 'inversify';
import axios from 'axios';
import { aiConfig } from '#root/config/ai.js';

@injectable()
export class EmbeddingService {
  
  private readonly apiUrl = `http://${aiConfig.serverIP}:${aiConfig.serverPort}/api/embeddings`;
  private readonly model = 'llama3.2'; 

  public async embedText(text: string): Promise<number[]> {
    try {
      const response = await axios.post(this.apiUrl, {
        model: this.model,
        prompt: text,
      });

      if (!response.data?.embedding) {
        throw new Error('Ollama returned an empty embedding.');
      }

      return response.data.embedding;
    } catch (error: any) {
      console.error('[EmbeddingService] Ollama Error:', error.message);
      throw new Error(`Ollama Embedding failed: ${error.message}`);
    }
  }

  public async embedBatch(texts: string[]): Promise<number[][]> {
    console.log(`[EmbeddingService] Generating embeddings for ${texts.length} chunks via Ollama...`);
    return Promise.all(texts.map(t => this.embedText(t)));
  }
}