import { knowledgeRepo, type KnowledgeItemRecord } from "../database/db.js";
import { pineconeService } from "./pineconeService.js";

export interface SearchResult {
    item: KnowledgeItemRecord;
    score: number;
    matchReasons: string[];
    source?: "pinecone" | "local";
}

export class RagService {
    /**
     * Chuẩn hóa từ khóa tiếng Việt: chuyển chữ thường, loại bỏ ký tự đặc biệt thừa
     */
    private normalizeText(text: string): string {
        return text
            .toLowerCase()
            .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'<>+@]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    /**
     * Mở rộng truy vấn (Query Expansion): Đồng bộ tương đương giữa số La Mã và số Ả Rập
     * Ví dụ: "khu vực 5" -> mở rộng thêm "khu vực V", "khu vực VII" -> mở rộng thêm "khu vực 7"
     */
    public expandQuery(text: string): string {
        let expanded = text;
        const romanToArabic: [RegExp, string][] = [
            [/\bkhu\s+vực\s+viii\b/gi, "khu vực VIII khu vực 8"],
            [/\bkhu\s+vực\s+vii\b/gi, "khu vực VII khu vực 7"],
            [/\bkhu\s+vực\s+vi\b/gi, "khu vực VI khu vực 6"],
            [/\bkhu\s+vực\s+iv\b/gi, "khu vực IV khu vực 4"],
            [/\bkhu\s+vực\s+v\b/gi, "khu vực V khu vực 5"],
            [/\bkhu\s+vực\s+iii\b/gi, "khu vực III khu vực 3"],
            [/\bkhu\s+vực\s+ii\b/gi, "khu vực II khu vực 2"],
            [/\bkhu\s+vực\s+i\b/gi, "khu vực I khu vực 1"],
            [/\bkhu\s+vực\s+8\b/gi, "khu vực 8 khu vực VIII"],
            [/\bkhu\s+vực\s+7\b/gi, "khu vực 7 khu vực VII"],
            [/\bkhu\s+vực\s+6\b/gi, "khu vực 6 khu vực VI"],
            [/\bkhu\s+vực\s+5\b/gi, "khu vực 5 khu vực V"],
            [/\bkhu\s+vực\s+4\b/gi, "khu vực 4 khu vực IV"],
            [/\bkhu\s+vực\s+3\b/gi, "khu vực 3 khu vực III"],
            [/\bkhu\s+vực\s+2\b/gi, "khu vực 2 khu vực II"],
            [/\bkhu\s+vực\s+1\b/gi, "khu vực 1 khu vực I"],
            [/\btt\s*5\b/gi, "TT5 khu vực V khu vực 5"],
            [/\btt\s*4\b/gi, "TT4 khu vực IV khu vực 4"],
            [/\btt\s*7\b/gi, "TT7 khu vực VII khu vực 7"],
            [/\btt\s*8\b/gi, "TT8 khu vực VIII khu vực 8"],
            [/\btt\s*1\b/gi, "TT1 khu vực I khu vực 1"],
            [/\btt\s*2\b/gi, "TT2 khu vực II khu vực 2"],
        ];

        for (const [pattern, replacement] of romanToArabic) {
            if (pattern.test(expanded)) {
                expanded = expanded.replace(pattern, replacement);
                break;
            }
        }

        return expanded;
    }

    /**
     * Tách văn bản thành danh sách token/từ đơn và từ đôi (bigram) để tăng độ chính xác tiếng Việt
     */
    private tokenize(text: string): string[] {
        const words = this.normalizeText(text).split(" ").filter(Boolean);
        const tokens = new Set<string>(words);

        for (let i = 0; i < words.length - 1; i++) {
            tokens.add(`${words[i]} ${words[i + 1]}`);
        }

        return Array.from(tokens);
    }

    /**
     * Thuật toán tìm kiếm từ khóa cục bộ (Fallback khi offline hoặc không có mạng)
     */
    public searchLocalKnowledge(query: string, topK = 10, groupName?: string): SearchResult[] {
        let activeItems = knowledgeRepo.getActive();
        if (groupName) {
            activeItems = activeItems.filter((i) => i.category === groupName);
        }

        if (activeItems.length === 0) {
            return [];
        }

        const expandedQuery = this.expandQuery(query);
        const queryNormalized = this.normalizeText(expandedQuery);
        const queryTokens = this.tokenize(expandedQuery);
        const results: SearchResult[] = [];

        for (const item of activeItems) {
            let score = 0;
            const matchReasons: string[] = [];

            const titleNorm = this.normalizeText(item.title);
            const contentNorm = this.normalizeText(item.content);
            const keywordsNorm = this.normalizeText(item.keywords || "");

            // 1. Khớp toàn bộ chuỗi
            if (titleNorm.includes(queryNormalized) && queryNormalized.length > 5) {
                score += 15;
                matchReasons.push("Khớp tiêu đề câu hỏi");
            } else if (queryNormalized.includes(titleNorm) && titleNorm.length > 5) {
                score += 12;
                matchReasons.push("Tiêu đề nằm trong câu hỏi");
            }

            // 2. Khớp từ khóa
            if (keywordsNorm) {
                const itemKeywords = keywordsNorm.split(",").map((k) => k.trim()).filter(Boolean);
                for (const kw of itemKeywords) {
                    if (queryNormalized.includes(kw) && kw.length > 1) {
                        score += 8;
                        matchReasons.push(`Khớp từ khóa [${kw}]`);
                    }
                }
            }

            // 3. Chấm điểm token
            let titleTokenHits = 0;
            let contentTokenHits = 0;

            for (const token of queryTokens) {
                if (token.length < 2) continue;

                if (titleNorm.includes(token)) {
                    titleTokenHits++;
                    score += token.includes(" ") ? 4 : 2;
                }
                if (contentNorm.includes(token)) {
                    contentTokenHits++;
                    score += token.includes(" ") ? 2 : 1;
                }
            }

            if (titleTokenHits > 0) {
                matchReasons.push(`${titleTokenHits} từ khóa trong tiêu đề`);
            }
            if (contentTokenHits > 0) {
                matchReasons.push(`${contentTokenHits} từ khóa trong nội dung`);
            }

            if (item.type === "faq" && score > 0) {
                score *= 1.25;
            }

            if (score > 1.5) {
                results.push({
                    item,
                    score: Math.round(score * 10) / 10,
                    matchReasons,
                    source: "local",
                });
            }
        }

        results.sort((a, b) => b.score - a.score);
        return results.slice(0, topK);
    }

    /**
     * Tìm kiếm tri thức kết hợp:
     * 1. Mở rộng truy vấn (số La Mã <-> số thường)
     * 2. Lấy danh sách ứng viên từ Pinecone Vector DB (llama-text-embed-v2, topK tăng lên 10, ngưỡng >= 0.30)
     * 3. Tái xếp hạng chuẩn xác bằng mô hình bge-reranker-v2-m3
     * 4. Fallback cục bộ an toàn nếu Pinecone ngoại tuyến
     */
    public async searchKnowledge(query: string, topK = 10, groupName?: string): Promise<SearchResult[]> {
        const expandedQuery = this.expandQuery(query);

        // 1. Thử tìm kiếm vector qua Pinecone (lấy tối đa 12 ứng viên để rerank)
        try {
            const retrieveCandidatesCount = Math.max(topK, 12);
            const pineconeMatches = await pineconeService.query(expandedQuery, retrieveCandidatesCount, groupName);

            if (pineconeMatches && pineconeMatches.length > 0) {
                // Lọc những kết quả đạt ngưỡng độ tương đồng cosine >= 0.30 (30%)
                const qualifiedMatches = pineconeMatches.filter((m) => m.score >= 0.30);

                if (qualifiedMatches.length > 0) {
                    // Chuẩn bị tài liệu để gửi vào mô hình bge-reranker-v2-m3
                    const docsForRerank = qualifiedMatches.map((m) => {
                        const meta = m.metadata;
                        const existingDbItem = knowledgeRepo.getById(m.id);
                        const text = `${meta?.title || ""}\n${existingDbItem?.content || meta?.content || ""}`;
                        return { id: m.id, text: text.slice(0, 2000) };
                    });

                    // Gọi bge-reranker-v2-m3 từ Pinecone Inference
                    const rerankScores = await pineconeService.rerank(query, docsForRerank, topK);
                    const rerankMap = new Map<string, number>();
                    rerankScores.forEach((r) => rerankMap.set(r.id, r.score));

                    const results: SearchResult[] = [];

                    for (const m of qualifiedMatches) {
                        const meta = m.metadata;
                        const existingDbItem = knowledgeRepo.getById(m.id);

                        const item: KnowledgeItemRecord = existingDbItem || {
                            id: m.id,
                            title: meta?.title || "Tài liệu",
                            content: meta?.content || "",
                            type: (meta?.type as any) || "doc",
                            category: meta?.category || groupName || "Chung",
                            keywords: meta?.keywords || "",
                            enabled: 1,
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                        };

                        const vectorScore = Math.round(m.score * 100);
                        const rerankScore = rerankMap.get(m.id);

                        let finalScore = vectorScore;
                        const matchReasons: string[] = [];

                        if (rerankScore !== undefined) {
                            const rerankPercent = Math.round(rerankScore * 100);
                            finalScore = rerankPercent;
                            matchReasons.push(`BGE-Reranker-v2-m3: ${rerankPercent}% (Vector: ${vectorScore}%)`);
                        } else {
                            matchReasons.push(`Pinecone Vector (llama-text-embed-v2): ${vectorScore}%`);
                        }

                        results.push({
                            item,
                            score: finalScore,
                            matchReasons,
                            source: "pinecone",
                        });
                    }

                    // Sắp xếp theo điểm Reranker (hoặc điểm vector) giảm dần và lấy topK
                    results.sort((a, b) => b.score - a.score);
                    return results.slice(0, topK);
                }
            }
        } catch (pineconeErr: any) {
            console.warn("⚠️ [RAG] Lỗi truy vấn Pinecone, tự động chuyển sang tìm kiếm cục bộ:", pineconeErr?.message || pineconeErr);
        }

        // 2. Fallback tìm kiếm từ khóa cục bộ nếu Pinecone không có hoặc lỗi
        return this.searchLocalKnowledge(query, topK, groupName);
    }

    /**
     * Tạo đoạn văn bản ngữ cảnh tri thức để nhúng vào Prompt của LLM
     */
    public async buildKnowledgeContext(query: string, topK = 10, groupName?: string): Promise<string> {
        const matches = await this.searchKnowledge(query, topK, groupName);

        if (matches.length === 0) {
            return "Không tìm thấy tài liệu hay câu hỏi FAQ nào khớp với câu hỏi này trong kho tri thức.";
        }

        let context = "DƯỚI ĐÂY LÀ THÔNG TIN TRI THỨC ĐƯỢC TRÍCH XUẤT TỪ HỆ THỐNG (PINECONE VECTOR & KNOWLEDGE BASE):\n\n";

        matches.forEach((m, idx) => {
            const item = m.item;
            const sourceLabel = m.source === "pinecone" ? "Pinecone Vector (BGE Reranker)" : "Knowledge Base";
            context += `[Tài liệu ${idx + 1} - Nhóm: ${item.category}] (${item.type === "faq" ? "Hỏi đáp FAQ" : "Tài liệu"}) [Nguồn: ${sourceLabel} - Độ khớp: ${m.score}%]\n`;
            context += `Tiêu đề: ${item.title}\n`;
            context += `Nội dung: ${item.content}\n`;
            context += "--------------------------------------------------\n";
        });

        return context;
    }
}

export const ragService = new RagService();
