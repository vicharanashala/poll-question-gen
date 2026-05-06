import { ChromaClient, Collection } from 'chromadb';
import { injectable } from 'inversify';
import { EmbeddingService } from './EmbeddingService.js'; // Ensure the extension matches your setup (.js or .ts depending on your build)

@injectable()
export class VectorStoreService {
  private readonly client: ChromaClient;
  private readonly embeddingService: EmbeddingService;
  private readonly collectionName = 'transcript_segments';

  constructor(embeddingService: EmbeddingService) {
  this.client = new ChromaClient({ 
    host: 'localhost', 
    port: 8001 
  });
  this.embeddingService = embeddingService;
}

  private async getCollection(): Promise<Collection> {
    return await this.client.getOrCreateCollection({
      name: this.collectionName,
      metadata: { 'hnsw:space': 'cosine' },
    });
  }

  public async storeSegments(
    segments: Record<string, string>,
    roomCode: string
  ): Promise<void> {
    const collection = await this.getCollection();

    const ids: string[] = [];
    const texts: string[] = [];
    const metadatas: Record<string, string>[] = [];

    for (const [segmentId, text] of Object.entries(segments)) {
      ids.push(`${roomCode}_${segmentId}`);
      texts.push(text);
      metadatas.push({ roomCode, segmentId });
    }

    const embeddings = await this.embeddingService.embedBatch(texts);

    await collection.upsert({
      ids,
      embeddings,
      documents: texts,
      metadatas,
    });

    console.log(`[VectorStoreService] Stored ${ids.length} segments for room ${roomCode}`);
  }

  public async retrieveRelevantChunks(
    query: string,
    roomCode: string,
    topK = 3
  ): Promise<{ text: string; segmentId: string }[]> {
    const collection = await this.getCollection();
    const queryEmbedding = await this.embeddingService.embedText(query);

    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: topK,
      // Filtering by roomCode ensures data privacy between different sessions/rooms!
      where: { roomCode },
    });

    const chunks: { text: string; segmentId: string }[] = [];

    if (results.documents?.[0]) {
      results.documents[0].forEach((doc, idx) => {
        if (doc) {
          chunks.push({
            text: doc,
            segmentId: (results.metadatas?.[0]?.[idx] as any)?.segmentId ?? '',
          });
        }
      });
    }

    console.log(`[VectorStoreService] Retrieved ${chunks.length} relevant chunks for query`);
    return chunks;
  }

  public async deleteRoomSegments(roomCode: string): Promise<void> {
    const collection = await this.getCollection();
    const existing = await collection.get({ where: { roomCode } });
    if (existing.ids.length > 0) {
      await collection.delete({ ids: existing.ids });
      console.log(`[VectorStoreService] Deleted ${existing.ids.length} segments for room ${roomCode}`);
    }
  }
  
}