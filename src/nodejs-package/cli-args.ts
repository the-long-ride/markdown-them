import * as path from 'node:path';
import * as fs from 'node:fs';

export const SUPPORTED_EXTENSIONS = new Set<string>([
  '.docx',
  '.doc',
  '.pdf',
  '.html',
  '.htm',
  '.xlsx',
  '.xls',
  '.xlm',
  '.pptx',
  '.odt',
  '.odp',
  '.ods',
  '.rtf',
  '.txt',
  '.text',
  '.md',
  '.markdown',
  '.mdx',
]);

export interface CliOptions {
  source?: string;
  destination?: string;
  all: boolean;
  help: boolean;
  version: boolean;
  unknownArgs: string[];
  pendingError?: string;
}

export function cleanPath(p: string): string {
  if (typeof p !== 'string') return '';
  let trimmed = p.trim();
  while (trimmed.startsWith('\\"') && trimmed.endsWith('\\"') && trimmed.length >= 4) {
    trimmed = trimmed.slice(2, -2).trim();
  }
  while (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function parseCliArgs(argv: string[]): CliOptions {
  let pendingOption: 'source' | 'destination' | null = null;
  let source: string | undefined = undefined;
  let destination: string | undefined = undefined;
  let all = false;
  let help = false;
  let version = false;
  const unknownArgs: string[] = [];
  let endOfOptions = false;
  let pendingError: string | undefined = undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (!endOfOptions && arg === '--') {
      endOfOptions = true;
      continue;
    }

    if (!endOfOptions) {
      if (arg === '-h' || arg === '--help' || arg === '-help') {
        help = true;
        continue;
      }

      if (arg === '-v' || arg === '--version' || arg === '-version') {
        version = true;
        continue;
      }

      if (arg === '-a' || arg === '--all' || arg === '-all') {
        all = true;
        continue;
      }

      if (arg.startsWith('--source=')) {
        source = cleanPath(arg.slice('--source='.length));
        pendingOption = null;
        continue;
      }
      if (arg.startsWith('-s=')) {
        source = cleanPath(arg.slice('-s='.length));
        pendingOption = null;
        continue;
      }

      if (arg.startsWith('--destination=')) {
        destination = cleanPath(arg.slice('--destination='.length));
        pendingOption = null;
        continue;
      }
      if (arg.startsWith('-d=')) {
        destination = cleanPath(arg.slice('-d='.length));
        pendingOption = null;
        continue;
      }

      if (arg === '-s' || arg === '--source') {
        if (pendingOption === 'source' && !source) {
          pendingError = 'Missing required argument: -s, --source <path>';
        } else if (pendingOption === 'destination' && !destination) {
          pendingError = 'Missing value for option: -d, --destination <path>';
        }
        pendingOption = 'source';
        continue;
      }
      if (arg === '-d' || arg === '--destination') {
        if (pendingOption === 'source' && !source) {
          pendingError = 'Missing required argument: -s, --source <path>';
        } else if (pendingOption === 'destination' && !destination) {
          pendingError = 'Missing value for option: -d, --destination <path>';
        }
        pendingOption = 'destination';
        continue;
      }
    }

    if (pendingOption === 'source') {
      source = cleanPath(arg);
      pendingOption = null;
      continue;
    }
    if (pendingOption === 'destination') {
      destination = cleanPath(arg);
      pendingOption = null;
      continue;
    }

    unknownArgs.push(arg);
  }

  if (!pendingError) {
    if (pendingOption === 'destination' && !destination) {
      pendingError = 'Missing value for option: -d, --destination <path>';
    } else if (pendingOption === 'source' && !source) {
      pendingError = 'Missing required argument: -s, --source <path>';
    }
  }

  return { source, destination, all, help, version, unknownArgs, pendingError };
}

export function getPackageVersion(): string {
  try {
    const candidates = [
      path.resolve(__dirname, '../../package.json'),
      path.resolve(__dirname, '../package.json'),
      path.resolve(__dirname, '../../../package.json'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf-8');
        const pkg = JSON.parse(content);
        if (pkg.name === '@the-long-ride/markdown-them' && pkg.version) {
          return pkg.version;
        }
      }
    }
  } catch {
    // Fallback if filesystem error occurs
  }
  return '1.4.0';
}

export function printHelp(): void {
  const version = getPackageVersion();
  console.log(`mdthem v${version} - Document to Markdown converter

Usage:
  mdthem -s <source> [options]

Arguments:
  -s, --source <path>         Source file or directory to convert (required)
  -d, --destination <path>    Destination file or directory (optional)
  -a, --all, -all             Recursively convert all subdirectories (when source is a directory)
  -h, --help                  Show this help message and exit
  -v, --version               Show version number and exit

Default Output Behavior:
  - Single file mode:
    If -d is omitted, writes to <file-dir>/<file-name>.md (or _converted.md if source is .md)
    If -d is an existing directory or ends with a slash, writes to <dest-dir>/<file-name>.md
  - Directory mode:
    If -d is omitted, writes converted files to <source-dir>/results/
    Non-existent destination directories are automatically created.
  - Recursion:
    When -a / --all / -all is omitted, converts top-level files in the source directory only.
    When -a / --all / -all is specified, converts supported files in all subdirectories.
    Directories named results, .git, and node_modules are automatically skipped during traversal.
  - File filtering:
    Unsupported files in directory mode are skipped without halting batch processing.

Examples:
  mdthem -s document.docx
  mdthem -s document.docx -d converted.md
  mdthem -s ./my-docs
  mdthem -s ./my-docs -d ./output
  mdthem -s ./my-docs -a -d ./output
  mdthem -s ./my-docs --all
  mdthem -s -all ./my-docs -d ./output
`);
}

export function printVersion(): void {
  console.log(getPackageVersion());
}

export function isSupportedFileName(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext);
}
