import { PDFDocument } from 'pdf-lib';

export async function splitPdf(pdfBuffer: Buffer): Promise<Buffer[]> {
    const srcDoc = await PDFDocument.load(pdfBuffer);
    const pageCount = srcDoc.getPageCount();
    const pages: Buffer[] = [];

    for (let i = 0; i < pageCount; i++) {
        const singlePageDoc = await PDFDocument.create();
        const [copiedPage] = await singlePageDoc.copyPages(srcDoc, [i]);
        singlePageDoc.addPage(copiedPage);
        const bytes = await singlePageDoc.save();
        pages.push(Buffer.from(bytes));
    }

    return pages;
}

export async function getPageCount(pdfBuffer: Buffer): Promise<number> {
    const doc = await PDFDocument.load(pdfBuffer);
    return doc.getPageCount();
}
