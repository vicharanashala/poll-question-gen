import { injectable } from 'inversify';

export interface RAGChunk {
  id: string;
  text: string;
  vector: Record<string, number>;
}

@injectable()
export class RAGService {
  private chunks: RAGChunk[] = [];

  chunkText(text: string): string[] {
    return text.match(/.{1,300}/g) || [];
  }

  embed(text: string): Record<string, number> {
    const vec: Record<string, number> = {};
    text.split(/\s+/).forEach(word => {
      vec[word] = (vec[word] || 0) + 1;
    });
    return vec;
  }

  ingest(text: string) {
    const parts = this.chunkText(text);

    this.chunks = parts.map((p, i) => ({
      id: `chunk_${i}`,
      text: p,
      vector: this.embed(p)
    }));

    console.log("[RAG] Chunks created:", this.chunks.length);
  }

  similarity(a: Record<string, number>, b: Record<string, number>) {
    let score = 0;
    for (const key in a) {
      if (b[key]) score += a[key] * b[key];
    }
    return score;
  }

  retrieve(query: string, topK = 3): RAGChunk[] {
    const qVec = this.embed(query);

    const scored = this.chunks.map(c => ({
      chunk: c,
      score: this.similarity(qVec, c.vector)
    }));

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(s => s.chunk);
  }
}