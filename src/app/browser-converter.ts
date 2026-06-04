import { parseOffice, terminateOcr } from "officeparser";
import { convertTextToMarkdown, htmlToMarkdown, officeAstToMarkdown } from "../core/markdown-utils";
import { convertOdfData } from "../core/odf";
import { convertPptxData } from "../core/pptx";
import { convertRtfToMarkdown } from "../core/rtf";
import { convertXlsxData } from "../core/xlsx";
import { getFileExtension, markdownOutputName } from "../shared/formats";

export interface BrowserConversionResult {
  fileName: string;
  markdown: string;
  outputName: string;
}

const browserOfficeExtensions = new Set([".docx", ".pdf"]);

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
    case ".odt":
    case ".odp":
    case ".ods":
      markdown = await convertOdfFile(file, extension.slice(1) as "odt" | "odp" | "ods");
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
    const markdown = convertRtfToMarkdown(await file.arrayBuffer());
    if (markdown.trim()) {
      return markdown;
    }
  } catch {
    // Fall through to the generic Office parser for unusual RTF files.
  }

  return convertOfficeFile(file);
}

async function convertOdfFile(file: File, kind: "odt" | "odp" | "ods"): Promise<string> {
  try {
    const markdown = await convertOdfData(await file.arrayBuffer(), kind);
    if (markdown.trim()) {
      return markdown;
    }
  } catch {
    // Fall through to the generic Office parser for unusual OpenDocument files.
  }

  return convertOfficeFile(file);
}
