export interface PdfProcessingResult {
  metadata: {
    numPages: number;
    info?: Record<string, any>;
    version?: string;
    textSnippet?: string;
  };
}

export async function processPdf(fileBuffer: Buffer): Promise<PdfProcessingResult> {
  try {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(fileBuffer);
    const textSnippet = data.text
      ? data.text.replace(/\s+/g, ' ').trim().slice(0, 200)
      : undefined;

    return {
      metadata: {
        numPages: data.numpages || 1,
        info: data.info || {},
        version: data.version,
        textSnippet,
      },
    };
  } catch (err: any) {
    console.warn('[PdfProcessor] Error reading PDF details:', err.message);
    return {
      metadata: {
        numPages: 1,
        info: { parseWarning: err.message },
      },
    };
  }
}
