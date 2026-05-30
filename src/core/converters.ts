import { restoreWorker } from "./polyfill";
import * as path from "path";
import * as fs from "fs/promises";
import * as mammoth from "mammoth";
import { convertTextToMarkdown, htmlToMarkdown, officeAstToMarkdown } from "./markdown-utils";
import { convertXlsxData } from "./xlsx";

const pdf2md = require("@opendocsg/pdf2md");
const officeParser = require("officeparser");

restoreWorker();

export async function generateMarkdown(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
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
    case ".pptx":
    case ".odt":
    case ".odp":
    case ".ods":
    case ".rtf": {
      const officeResult: unknown = await officeParser.parseOffice(filePath);
      return officeAstToMarkdown(officeResult as any);
    }
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
