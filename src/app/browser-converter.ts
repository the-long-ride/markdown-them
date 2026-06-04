import { parseOffice, terminateOcr } from "officeparser";
import { convertTextToMarkdown, htmlToMarkdown, officeAstToMarkdown } from "../core/markdown-utils";
import { convertPptxData } from "../core/pptx";
import { convertXlsxData } from "../core/xlsx";
import { getFileExtension, markdownOutputName } from "../shared/formats";

export interface BrowserConversionResult {
  fileName: string;
  markdown: string;
  outputName: string;
}

const browserOfficeExtensions = new Set([".docx", ".pdf", ".odt", ".odp", ".ods", ".rtf"]);

export async function convertBrowserFile(file: File): Promise<BrowserConversionResult> {
  const extension = getFileExtension(file.name);
  let markdown: string;

  switch (extension) {
    case ".html":
    case ".htm":
      markdown = htmlToMarkdown(await file.text());
      break;
    case ".md":
    case ".markdown":
    case ".txt":
      markdown = convertTextToMarkdown(await file.text());
      break;
    case ".xlsx":
      markdown = await convertXlsxData(await file.arrayBuffer());
      break;
    case ".pptx":
      markdown = await convertPptxData(await file.arrayBuffer());
      break;
    case ".rtf":
      markdown = await convertRtfFile(file);
      break;
    default:
      if (!browserOfficeExtensions.has(extension)) {
        throw new Error(`Unsupported file type: ${extension || "unknown"}`);
      }

      markdown = await convertOfficeFile(file);
      break;
  }

  return {
    fileName: file.name,
    markdown,
    outputName: markdownOutputName(file.name),
  };
}

export { convertTextToMarkdown };

async function convertOfficeFile(file: File): Promise<string> {
  const ast = await parseOffice(await file.arrayBuffer(), {
    extractAttachments: false,
    includeRawContent: false,
    ocr: false,
    outputErrorToConsole: false,
    pdfWorkerSrc: new URL("assets/pdf.worker.min.mjs", window.location.href).toString(),
  });

  await terminateOcr().catch(() => undefined);
  return officeAstToMarkdown(ast);
}

async function convertRtfFile(file: File): Promise<string> {
  try {
    return await convertOfficeFile(file);
  } catch {
    return rtfToMarkdown(await file.text());
  }
}

function rtfToMarkdown(rtf: string): string {
  const text = rtf
    .replace(/\\par[d]?/g, "\n")
    .replace(/\\line/g, "\n")
    .replace(/\\'[0-9a-fA-F]{2}/g, (match) => String.fromCharCode(parseInt(match.slice(2), 16)))
    .replace(/[{}]/g, "")
    .replace(/\\[a-zA-Z]+-?\d* ?/g, "")
    .replace(/\\./g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return convertTextToMarkdown(text);
}
