#!/usr/bin/env node

import * as process from 'node:process';
import {
  SUPPORTED_EXTENSIONS,
  CliOptions,
  cleanPath,
  parseCliArgs,
  getPackageVersion,
  printHelp,
  printVersion,
  isSupportedFileName,
} from './cli-args';
import {
  BatchStats,
  validateSource,
  convertSingleFile,
  shouldSkipDirectory,
  scanDirectory,
  convertDirectory,
} from './cli-runner';

export {
  SUPPORTED_EXTENSIONS,
  CliOptions,
  cleanPath,
  parseCliArgs,
  getPackageVersion,
  printHelp,
  printVersion,
  isSupportedFileName,
  BatchStats,
  validateSource,
  convertSingleFile,
  shouldSkipDirectory,
  scanDirectory,
  convertDirectory,
};

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const options = parseCliArgs(argv);

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  if (options.version) {
    printVersion();
    process.exit(0);
  }

  if (options.pendingError) {
    console.error(`Error: ${options.pendingError}`);
    console.error('Run "mdthem --help" for usage information.');
    process.exit(1);
  }

  if (options.unknownArgs.length > 0) {
    const firstUnknown = options.unknownArgs[0];
    if (firstUnknown.startsWith('-')) {
      console.error(`Error: Unknown option: ${firstUnknown}`);
    } else {
      console.error(`Error: Unexpected argument: ${firstUnknown}`);
    }
    console.error('Run "mdthem --help" for usage information.');
    process.exit(1);
  }

  if (!options.source || options.source.trim() === '') {
    console.error('Error: Missing required argument: -s, --source <path>');
    console.error('Run "mdthem --help" for usage information.');
    process.exit(1);
  }

  let sourceInfo: { resolvedPath: string; isDirectory: boolean };
  try {
    sourceInfo = await validateSource(options.source);
  } catch (err: any) {
    console.error(`Error: ${err?.message || err}`);
    process.exit(1);
  }

  if (sourceInfo.isDirectory) {
    console.log(`Processing directory: ${sourceInfo.resolvedPath} (recursive: ${options.all})`);
    try {
      const stats = await convertDirectory(
        sourceInfo.resolvedPath,
        options.destination,
        options.all,
      );
      console.log(
        `\nConversion summary: ${stats.converted} converted, ${stats.skipped} skipped, ${stats.failed} failed.`,
      );
      process.exit(0);
    } catch (err: any) {
      console.error(`Error: ${err?.message || err}`);
      process.exit(1);
    }
  } else {
    try {
      const outputPath = await convertSingleFile(sourceInfo.resolvedPath, options.destination);
      console.log(`Successfully converted: ${sourceInfo.resolvedPath} -> ${outputPath}`);
      process.exit(0);
    } catch (err: any) {
      console.error(`Error converting file "${sourceInfo.resolvedPath}": ${err?.message || err}`);
      process.exit(1);
    }
  }
}

if (typeof require !== 'undefined' && require.main === module) {
  main().catch((err) => {
    console.error(`Fatal error: ${err?.message || err}`);
    process.exit(1);
  });
}
