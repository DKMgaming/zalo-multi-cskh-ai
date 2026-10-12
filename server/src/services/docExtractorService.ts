import { createRequire } from "node:module";
import path from "node:path";
import mammoth from "mammoth";
import * as xlsx from "xlsx";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

export interface ExtractedKnowledgeItem {
    title: string;
    content: string;
    type: "faq" | "doc";
    category: string;
    keywords: string;
}

export class DocExtractorService {
    /**
     * Tách văn bản dài thành các đoạn nhỏ (RAG Text Chunking) giữ vẹn toàn câu
     */
    public chunkText(text: string, maxWords = 500, overlapWords = 50): string[] {
        const paragraphs = text
            .split(/\n\s*\n/)
            .map((p) => p.trim())
            .filter((p) => p.length > 0);

        const chunks: string[] = [];
        let currentChunkWords: string[] = [];

        for (const p of paragraphs) {
            const words = p.split(/\s+/).filter(Boolean);

            if (currentChunkWords.length + words.length <= maxWords) {
                currentChunkWords.push(...words);
            } else {
                if (currentChunkWords.length > 0) {
                    chunks.push(currentChunkWords.join(" "));
                    // Giữ lại phần overlap từ cuối đoạn trước
                    const overlap = currentChunkWords.slice(-overlapWords);
                    currentChunkWords = [...overlap, ...words];
                } else {
                    // Nếu 1 đoạn văn quá dài vượt quá maxWords, cắt nhỏ
                    for (let i = 0; i < words.length; i += maxWords - overlapWords) {
                        chunks.push(words.slice(i, i + maxWords).join(" "));
                    }
                    currentChunkWords = [];
                }
            }
        }

        if (currentChunkWords.length > 0) {
            chunks.push(currentChunkWords.join(" "));
        }

        return chunks;
    }

    /**
     * Bóc tách file PDF (Hỗ trợ pdf-parse v2, pdf-parse v1 và officeparser fallback)
     */
    private async extractPdf(buffer: Buffer): Promise<string> {
        // 1. Thử với pdf-parse v2 (Class PDFParse)
        try {
            const ParserClass = pdfParse?.PDFParse || (pdfParse as any)?.default?.PDFParse;
            if (ParserClass) {
                const parser = new ParserClass({ data: buffer });
                const res = await parser.getText();
                if (res?.text && res.text.trim()) {
                    return res.text;
                }
            }
        } catch (v2Err: any) {
            console.warn("⚠️ [PDF Extractor] PDFParse v2 error:", v2Err?.message || v2Err);
        }

        // 2. Thử với pdf-parse v1 (Function trực tiếp)
        try {
            if (typeof pdfParse === "function") {
                const data = await pdfParse(buffer);
                if (data?.text && data.text.trim()) {
                    return data.text;
                }
            }
            if (pdfParse?.default && typeof pdfParse.default === "function") {
                const data = await pdfParse.default(buffer);
                if (data?.text && data.text.trim()) {
                    return data.text;
                }
            }
        } catch (v1Err: any) {
            console.warn("⚠️ [PDF Extractor] pdf-parse v1 error:", v1Err?.message || v1Err);
        }

        // 3. Fallback sang officeparser
        try {
            const officeParser = require("officeparser");
            const res = await officeParser.parseOffice(buffer);
            if (typeof res === "string" && res.trim()) {
                return res;
            } else if (res && typeof res === "object") {
                if (Array.isArray(res.content)) {
                    const text = res.content.map((c: any) => c.text || "").join("\n");
                    if (text.trim()) return text;
                }
            }
        } catch (opErr: any) {
            console.warn("⚠️ [PDF Extractor] officeparser fallback error:", opErr?.message || opErr);
        }

        throw new Error("Không thể bóc tách nội dung từ file PDF này (file có thể là dạng scan ảnh hoặc đã bị đặt mật khẩu).");
    }

    /**
     * Bóc tách file Word (.docx)
     */
    private async extractDocx(buffer: Buffer): Promise<string> {
        const result = await mammoth.extractRawText({ buffer });
        return result.value || "";
    }

    /**
     * Bóc tách file Excel (.xlsx, .xls, .csv)
     * Tự động nhận diện cột Hỏi - Đáp hoặc bảng dữ liệu sản phẩm / bảng giá
     */
    private extractExcel(buffer: Buffer, category: string, baseFileName: string): ExtractedKnowledgeItem[] {
        const workbook = xlsx.read(buffer, { type: "buffer" });
        const items: ExtractedKnowledgeItem[] = [];

        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const rows: any[] = xlsx.utils.sheet_to_json(sheet, { defval: "" });
            if (rows.length === 0) continue;

            const sampleRow = rows[0];
            const headers = Object.keys(sampleRow);

            // 1. Kiểm tra xem có cột Câu hỏi / Trả lời không (FAQ format)
            const questionKey = headers.find((h) =>
                /^(câu hỏi|hỏi|question|q|cau hoi)$/i.test(h.trim())
            );
            const answerKey = headers.find((h) =>
                /^(câu trả lời|trả lời|đáp|answer|a|tra loi|dap)$/i.test(h.trim())
            );

            if (questionKey && answerKey) {
                console.log(`📊 Phát hiện bảng FAQ trong sheet [${sheetName}] với cột "${questionKey}" & "${answerKey}"`);
                for (const row of rows) {
                    const q = String(row[questionKey] || "").trim();
                    const a = String(row[answerKey] || "").trim();
                    if (q && a) {
                        items.push({
                            title: q,
                            content: a,
                            type: "faq",
                            category,
                            keywords: `${baseFileName}, ${sheetName}`,
                        });
                    }
                }
                continue;
            }

            // 2. Nếu là bảng thông tin thông thường (Bảng giá, Sản phẩm, Tồn kho...)
            console.log(`📊 Bóc tách bảng dữ liệu trong sheet [${sheetName}] (${rows.length} dòng)`);
            let currentGroupRows: string[] = [];

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const rowText = Object.entries(row)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(" | ");

                currentGroupRows.push(`[Dòng ${i + 1}] ${rowText}`);

                // Gom mỗi 15 dòng thành 1 tài liệu để không quá dài
                if (currentGroupRows.length >= 15) {
                    items.push({
                        title: `${baseFileName} - Sheet ${sheetName} (Dòng ${i - 13}-${i + 1})`,
                        content: currentGroupRows.join("\n"),
                        type: "doc",
                        category,
                        keywords: `${baseFileName}, ${sheetName}`,
                    });
                    currentGroupRows = [];
                }
            }

            if (currentGroupRows.length > 0) {
                items.push({
                    title: `${baseFileName} - Sheet ${sheetName} (Dòng cuối)`,
                    content: currentGroupRows.join("\n"),
                    type: "doc",
                    category,
                    keywords: `${baseFileName}, ${sheetName}`,
                });
            }
        }

        return items;
    }

    /**
     * Xử lý file tải lên thành các mục tri thức hoàn chỉnh
     */
    public async processUploadedFile(
        fileBuffer: Buffer,
        originalName: string,
        category: string
    ): Promise<ExtractedKnowledgeItem[]> {
        // Chuẩn hóa tên file tiếng Việt nếu bị lỗi encoding Latin-1 từ multipart form-data
        let normalizedName = originalName;
        try {
            const decoded = Buffer.from(originalName, "latin1").toString("utf8");
            if (decoded && decoded !== originalName) {
                normalizedName = decoded;
            }
        } catch {
            normalizedName = originalName;
        }

        const ext = path.extname(normalizedName).toLowerCase();
        const baseName = path.basename(normalizedName, ext);
        const targetCategory = category.trim() || "Chung";

        console.log(`📂 Đang bóc tách file: ${normalizedName} (Định dạng: ${ext})...`);

        // Xử lý Excel / CSV
        if (ext === ".xlsx" || ext === ".xls" || ext === ".csv") {
            return this.extractExcel(fileBuffer, targetCategory, baseName);
        }

        // Xử lý tài liệu văn bản: PDF, Word, TXT, MD
        let rawText = "";

        if (ext === ".pdf") {
            rawText = await this.extractPdf(fileBuffer);
        } else if (ext === ".docx") {
            rawText = await this.extractDocx(fileBuffer);
        } else if (ext === ".txt" || ext === ".md") {
            rawText = fileBuffer.toString("utf-8");
        } else {
            throw new Error(`Định dạng file không được hỗ trợ: ${ext}. Vui lòng dùng .pdf, .docx, .xlsx, .xls, .csv, .txt`);
        }

        const cleanText = rawText.replace(/\r\n/g, "\n").trim();
        if (!cleanText) {
            throw new Error(`Không trích xuất được nội dung chữ nào từ file "${normalizedName}".`);
        }

        // Thực hiện phân đoạn văn bản (RAG Text Chunking)
        const chunks = this.chunkText(cleanText, 450, 40);
        console.log(`✂️ Đã phân đoạn "${normalizedName}" thành ${chunks.length} đoạn tri thức.`);

        const items: ExtractedKnowledgeItem[] = [];

        if (chunks.length === 1) {
            items.push({
                title: baseName,
                content: chunks[0],
                type: "doc",
                category: targetCategory,
                keywords: baseName,
            });
        } else {
            chunks.forEach((chunk, idx) => {
                items.push({
                    title: `${baseName} (Phần ${idx + 1}/${chunks.length})`,
                    content: chunk,
                    type: "doc",
                    category: targetCategory,
                    keywords: `${baseName}, phần ${idx + 1}`,
                });
            });
        }

        return items;
    }
}

export const docExtractorService = new DocExtractorService();
