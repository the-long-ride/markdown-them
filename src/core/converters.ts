import { restoreWorker } from "./polyfill";
import * as path from "path";
import * as fs from "fs/promises";
import * as os from "os";
import * as mammoth from "mammoth";
import { convertTextToMarkdown, htmlToMarkdown, officeAstToMarkdown } from "./markdown-utils";
import { convertOdfData } from "./odf";
import { convertPptxData } from "./pptx";
import { convertRtfToMarkdown } from "./rtf";
import { convertXlsxData } from "./xlsx";

const pdf2md = require("@opendocsg/pdf2md");
const officeParser = require("officeparser");

restoreWorker();

export async function generateMarkdown(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case ".doc":
      return await runWithRenamedExtension(filePath, ".docx");
    case ".xls":
    case ".xlm":
      return await runWithRenamedExtension(filePath, ".xlsx");
    case ".docx": {
      const result = await mammoth.convertToHtml({ path: filePath });
      return htmlToMarkdown(result.value);
    }
    case ".html": {
      const htmlContent = await fs.readFile(filePath, "utf-8");
      return htmlToMarkdown(htmlContent);
    }
    case ".pdf": {
      const dataBuffer = await fs.readFile(filePath);
      return await pdf2md(dataBuffer);
    }
    case ".xlsx":
      return await convertXlsx(filePath);
    case ".pptx": {
      const data = await fs.readFile(filePath);
      return await convertPptxData(data);
    }
    case ".odt":
    case ".odp":
    case ".ods":
      return await convertOdf(filePath, ext.slice(1) as "odt" | "odp" | "ods");
    case ".rtf":
      return await convertRtf(filePath);
    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }
}

export { convertTextToMarkdown };

export async function convertFileToMarkdown(filePath: string, outputPath?: string): Promise<string> {
  const mdContent = await generateMarkdown(filePath);

  if (!outputPath) {
    outputPath = inferOutputPath(filePath);
  }

  await fs.writeFile(outputPath, mdContent, "utf-8");
  return outputPath;
}

export function inferOutputPath(filePath: string): string {
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const basename = path.basename(filePath, ext);
  return path.join(dir, ext.toLowerCase() === ".md" ? `${basename}_converted.md` : `${basename}.md`);
}

async function convertXlsx(filePath: string): Promise<string> {
  const data = await fs.readFile(filePath);
  return convertXlsxData(data);
}

async function convertOdf(filePath: string, kind: "odt" | "odp" | "ods"): Promise<string> {
  const data = await fs.readFile(filePath);

  try {
    const markdown = await convertOdfData(data, kind);
    if (markdown.trim()) {
      return markdown;
    }
  } catch {
    // Fall through to the generic Office parser for unusual OpenDocument files.
  }

  return convertOfficeFallback(filePath);
}

async function convertRtf(filePath: string): Promise<string> {
  const data = await fs.readFile(filePath);

  try {
    const markdown = convertRtfToMarkdown(data);
    if (markdown.trim()) {
      return markdown;
    }
  } catch {
    // Fall through to the generic Office parser for unusual RTF files.
  }

  return convertOfficeFallback(filePath);
}

async function convertOfficeFallback(filePath: string): Promise<string> {
  const officeResult: unknown = await officeParser.parseOffice(filePath);
  return officeAstToMarkdown(officeResult as any);
}

async function runWithRenamedExtension(filePath: string, newExt: string): Promise<string> {
  const tempDir = os.tmpdir();
  const randomId = Math.random().toString(36).substring(2, 15);
  const tempFilePath = path.join(tempDir, `temp_${randomId}${newExt}`);
  try {
    await fs.copyFile(filePath, tempFilePath);
    return await generateMarkdown(tempFilePath);
  } finally {
    await fs.rm(tempFilePath, { force: true }).catch(() => {});
  }
}
