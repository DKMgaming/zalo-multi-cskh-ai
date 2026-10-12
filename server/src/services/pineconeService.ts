import { Pinecone } from "@pinecone-database/pinecone";
import type { KnowledgeItemRecord } from "../database/db.js";

export interface PineconeMatchResult {
    id: string;
    score: number;
    metadata: {
        title: string;
        content: string;
        type: string;
        category: string;
        keywords?: string;
    };
}

export class PineconeService {
    private apiKey: string;
    private host: string;
    private indexName: string;
    private embeddingModel: string;
    private rerankModel: string;
    private dimension: number;
    private pc: Pinecone;

    constructor() {
        this.apiKey = process.env.PINECONE_API_KEY || "pcsk_4HbBA_NT38iejn5GS2kyXYemdfbk8oyz5E2J34QzTHaQTJ9JTyMMbdRjbBRi94nZ8xroe";
        this.host = process.env.PINECONE_HOST || "https://semirag-gpxczi5.svc.aped-4627-b74a.pinecone.io";
        this.indexName = process.env.PINECONE_INDEX || "CSKH";
        this.embeddingModel = "llama-text-embed-v2";
        this.rerankModel = "bge-reranker-v2-m3";
        this.dimension = 1024;

        this.pc = new Pinecone({
            apiKey: this.apiKey,
        });
    }

    private getIndex() {
        return this.pc.index(this.indexName, this.host);
    }

    private sanitizeNamespace(groupName?: string): string {
        if (!groupName || !groupName.trim()) {
            return "Chung";
        }
        return groupName.trim();
    }

    /**
     * Sinh vector embedding bằng model llama-text-embed-v2 (1024 dimension)
     */
    public async generateEmbedding(text: string, inputType: "passage" | "query" = "passage"): Promise<number[]> {
        const cleanText = text.trim();
        if (!cleanText) {
            throw new Error("Văn bản embedding không được rỗng");
        }

        const res = await this.pc.inference.embed({
            model: this.embeddingModel,
            inputs: [cleanText],
            parameters: { inputType, truncate: "END" },
        });

        const vector = (res.data[0] as any)?.values;
        if (!vector || !Array.isArray(vector)) {
            throw new Error("Không nhận được vector từ Pinecone Inference");
        }

        return vector;
    }

    /**
     * Nạp / Cập nhật một mục tri thức lên Pinecone theo nhóm (namespace)
     */
    public async upsertItem(item: KnowledgeItemRecord): Promise<void> {
        const namespace = this.sanitizeNamespace(item.category);
        const textToEmbed = `${item.title}\n${item.content}${item.keywords ? `\nTừ khóa: ${item.keywords}` : ""}`;
        const vector = await this.generateEmbedding(textToEmbed, "passage");

        const index = this.getIndex();
        await index.namespace(namespace).upsert({
            records: [
                {
                    id: item.id,
                    values: vector,
                    metadata: {
                        title: item.title,
                        content: item.content,
                        type: item.type,
                        category: item.category || "Chung",
                        keywords: item.keywords || "",
                    },
                },
            ],
        });

        console.log(`🌲 [Pinecone] Đã nạp vector cho [${item.title}] vào nhóm "${namespace}"`);
    }

    /**
     * Xóa 1 tài liệu khỏi Pinecone theo ID và nhóm
     */
    public async deleteItem(id: string, groupName: string): Promise<void> {
        const namespace = this.sanitizeNamespace(groupName);
        const index = this.getIndex();
        try {
            await index.namespace(namespace).deleteOne({ id });
            console.log(`🌲 [Pinecone] Đã xóa vector ${id} khỏi nhóm "${namespace}"`);
        } catch (e: any) {
            console.error(`🌲 [Pinecone] Lỗi xóa vector ${id}:`, e?.message || e);
        }
    }

    /**
     * Xóa toàn bộ tài liệu trong một nhóm (xóa sạch toàn bộ namespace)
     */
    public async deleteGroup(groupName: string): Promise<void> {
        const namespace = this.sanitizeNamespace(groupName);
        const index = this.getIndex();
        try {
            await index.namespace(namespace).deleteAll();
            console.log(`🌲 [Pinecone] Đã xóa toàn bộ dữ liệu trong nhóm "${namespace}"`);
        } catch (e: any) {
            console.error(`🌲 [Pinecone] Lỗi xóa toàn bộ nhóm "${namespace}":`, e?.message || e);
            throw e;
        }
    }

    /**
     * Lấy thống kê index, danh sách các nhóm và số lượng vector từ Pinecone
     */
    public async describeStats(): Promise<{
        host: string;
        indexName: string;
        model: string;
        rerankModel: string;
        dimension: number;
        totalRecordCount: number;
        namespaces: Record<string, { recordCount: number }>;
    }> {
        const index = this.getIndex();
        const stats = await index.describeIndexStats();

        return {
            host: this.host,
            indexName: this.indexName,
            model: this.embeddingModel,
            rerankModel: this.rerankModel,
            dimension: stats.dimension || this.dimension,
            totalRecordCount: stats.totalRecordCount || 0,
            namespaces: (stats.namespaces as Record<string, { recordCount: number }>) || {},
        };
    }

    /**
     * Tái xếp hạng (Rerank) danh sách tài liệu bằng mô hình bge-reranker-v2-m3
     * Giúp đưa tài liệu liên quan nhất lên đầu kể cả khi khác biệt token / số La Mã
     */
    public async rerank(
        query: string,
        documents: { id: string; text: string }[],
        topN = 6
    ): Promise<{ id: string; score: number }[]> {
        if (!documents || documents.length === 0) {
            return [];
        }

        try {
            const res = await this.pc.inference.rerank({
                model: this.rerankModel,
                query: query.trim(),
                documents: documents,
                topN: Math.min(topN, documents.length),
                returnDocuments: false,
            });

            return (res.data || []).map((item) => ({
                id: documents[item.index]?.id || "",
                score: item.score || 0,
            })).filter((r) => Boolean(r.id));
        } catch (err: any) {
            console.warn("⚠️ [Pinecone Rerank] Lỗi gọi bge-reranker-v2-m3:", err?.message || err);
            return [];
        }
    }

    /**
     * Tìm kiếm ngữ nghĩa vector từ Pinecone bằng câu hỏi của khách hàng
     */
    public async query(queryText: string, topK = 4, groupName?: string): Promise<PineconeMatchResult[]> {
        const queryVector = await this.generateEmbedding(queryText, "query");
        const index = this.getIndex();

        // Nếu có nhóm cụ thể được chỉ định
        if (groupName) {
            const namespace = this.sanitizeNamespace(groupName);
            const res = await index.namespace(namespace).query({
                vector: queryVector,
                topK,
                includeMetadata: true,
            });

            return (res.matches || []).map((m: any) => ({
                id: m.id,
                score: m.score || 0,
                metadata: m.metadata || {},
            }));
        }

        // Nếu không chỉ định nhóm: Lấy danh sách các nhóm hiện có trên Pinecone và truy vấn
        const stats = await this.describeStats();
        const namespaces = Object.keys(stats.namespaces);

        if (namespaces.length === 0) {
            // Thử truy vấn namespace mặc định "Chung"
            const res = await index.namespace("Chung").query({
                vector: queryVector,
                topK,
                includeMetadata: true,
            });
            return (res.matches || []).map((m: any) => ({
                id: m.id,
                score: m.score || 0,
                metadata: m.metadata || {},
            }));
        }

        // Truy vấn song song tất cả các nhóm
        const queryPromises = namespaces.map((ns) =>
            index
                .namespace(ns)
                .query({
                    vector: queryVector,
                    topK,
                    includeMetadata: true,
                })
                .then((res) => res.matches || [])
                .catch(() => [])
        );

        const resultsByNs = await Promise.all(queryPromises);
        const allMatches: PineconeMatchResult[] = [];

        for (const matches of resultsByNs) {
            for (const m of matches) {
                allMatches.push({
                    id: m.id,
                    score: m.score || 0,
                    metadata: m.metadata as any,
                });
            }
        }

        // Sắp xếp theo score giảm dần và lấy topK
        allMatches.sort((a, b) => b.score - a.score);
        return allMatches.slice(0, topK);
    }

    /**
     * Đồng bộ hàng loạt toàn bộ danh sách tri thức lên Pinecone
     */
    public async syncAll(items: KnowledgeItemRecord[]): Promise<{ syncedCount: number; errors: string[] }> {
        let syncedCount = 0;
        const errors: string[] = [];

        for (const item of items) {
            try {
                await this.upsertItem(item);
                syncedCount++;
            } catch (err: any) {
                errors.push(`[${item.title}]: ${err?.message || err}`);
            }
        }

        return { syncedCount, errors };
    }
}

export const pineconeService = new PineconeService();
