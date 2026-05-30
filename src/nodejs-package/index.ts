import {
  convertTextToMarkdown,
  convertFileToMarkdown as convertFromPath,
  generateMarkdown,
  inferOutputPath,
} from "../core";

export interface ConvertOptions {
  outputPath?: string;
}

export async function convertFileToMarkdown(filePath: string, options: ConvertOptions = {}): Promise<string> {
  return convertFromPath(filePath, options.outputPath);
}

export async function convertAndReturnMarkdown(filePath: string): Promise<string> {
  return generateMarkdown(filePath);
}

export { convertTextToMarkdown, generateMarkdown, inferOutputPath };
