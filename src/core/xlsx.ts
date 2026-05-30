import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import { appendMarkdownTable, normalizeMarkdownHeading } from "./markdown-utils";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: false,
});

export async function convertXlsxData(data: ArrayBuffer | Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(data);
  const workbookXml = await readZipText(zip, "xl/workbook.xml");

  if (!workbookXml) {
    throw new Error("Invalid XLSX file: missing workbook.xml");
  }

  const workbook = xmlParser.parse(workbookXml);
  const relationships = await readWorkbookRelationships(zip);
  const sharedStrings = await readSharedStrings(zip);
  const sheets = toArray(workbook?.workbook?.sheets?.sheet);

  const markdown: string[] = [];

  for (const sheet of sheets) {
    const sheetName = normalizeMarkdownHeading(String(sheet?.["@_name"] || "Sheet"));
    const relationshipId = sheet?.["@_r:id"];
    const sheetPath = relationshipId ? relationships.get(String(relationshipId)) : undefined;

    if (markdown.length > 0) {
      markdown.push("");
    }

    markdown.push(`## ${sheetName}`, "");

    if (!sheetPath) {
      continue;
    }

    const worksheetXml = await readZipText(zip, sheetPath);
    if (!worksheetXml) {
      continue;
    }

    const worksheet = xmlParser.parse(worksheetXml);
    const rows = toArray(worksheet?.worksheet?.sheetData?.row);
    const tableRows = rows.map((row) => readXlsxRow(row, sharedStrings));

    appendMarkdownTable(markdown, tableRows);
  }

  return markdown.join("\n").trimEnd();
}

async function readWorkbookRelationships(zip: JSZip): Promise<Map<string, string>> {
  const relationships = new Map<string, string>();
  const relsXml = await readZipText(zip, "xl/_rels/workbook.xml.rels");

  if (!relsXml) {
    return relationships;
  }

  const rels = xmlParser.parse(relsXml);
  for (const relationship of toArray(rels?.Relationships?.Relationship)) {
    const id = relationship?.["@_Id"];
    const target = relationship?.["@_Target"];

    if (id && target) {
      relationships.set(String(id), resolveWorkbookTarget(String(target)));
    }
  }

  return relationships;
}

async function readSharedStrings(zip: JSZip): Promise<string[]> {
  const sharedStringsXml = await readZipText(zip, "xl/sharedStrings.xml");

  if (!sharedStringsXml) {
    return [];
  }

  const sharedStrings = xmlParser.parse(sharedStringsXml);
  return toArray(sharedStrings?.sst?.si).map(readRichText);
}

async function readZipText(zip: JSZip, filePath: string): Promise<string | undefined> {
  const file = zip.file(filePath);
  return file ? file.async("text") : undefined;
}

function readXlsxRow(row: any, sharedStrings: string[]): string[] {
  const values: string[] = [];
  let nextColumn = 1;

  for (const cell of toArray(row?.c)) {
    const cellRef = cell?.["@_r"];
    const column = cellRef ? columnIndexFromCellRef(String(cellRef)) : nextColumn;

    while (values.length < column - 1) {
      values.push("");
    }

    values.push(readXlsxCell(cell, sharedStrings));
    nextColumn = column + 1;
  }

  return values;
}

function readXlsxCell(cell: any, sharedStrings: string[]): string {
  const type = cell?.["@_t"];

  if (type === "inlineStr") {
    return readRichText(cell?.is);
  }

  const rawValue = readRichText(cell?.v);

  if (type === "s") {
    const sharedStringIndex = rawValue.trim() === "" ? NaN : Number(rawValue);
    return Number.isInteger(sharedStringIndex) && sharedStringIndex >= 0 ? sharedStrings[sharedStringIndex] || "" : "";
  }

  if (type === "b") {
    return rawValue === "1" ? "TRUE" : "FALSE";
  }

  return rawValue;
}

function readRichText(value: any): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(readRichText).join("");
  }

  if (value.t !== undefined) {
    return readRichText(value.t);
  }

  if (value.r !== undefined) {
    return toArray(value.r)
      .map((run) => readRichText(run.t))
      .join("");
  }

  if (value["#text"] !== undefined) {
    return String(value["#text"]);
  }

  return "";
}

function resolveWorkbookTarget(target: string): string {
  const normalized = target.replace(/\\/g, "/");

  if (normalized.startsWith("/")) {
    return normalized.replace(/^\/+/, "");
  }

  return normalizePosixPath(["xl", normalized]);
}

function normalizePosixPath(parts: string[]): string {
  const resolved: string[] = [];

  for (const part of parts.join("/").split("/")) {
    if (!part || part === ".") {
      continue;
    }

    if (part === "..") {
      resolved.pop();
      continue;
    }

    resolved.push(part);
  }

  return resolved.join("/");
}

function columnIndexFromCellRef(cellRef: string): number {
  const columnLetters = cellRef.match(/^[A-Z]+/i)?.[0]?.toUpperCase() || "A";

  return columnLetters.split("").reduce((index, char) => {
    return index * 26 + char.charCodeAt(0) - 64;
  }, 0);
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}
