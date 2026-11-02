import * as vscode from 'vscode';
import * as path from 'path';
import { convertFileToMarkdown, generateMarkdown } from '../core';

export function activate(context: vscode.ExtensionContext) {
  const disposable1 = vscode.commands.registerCommand(
    'markdown-them.convertToMarkdown',
    async (...args) => {
      const uris = getCommandFileUris(args);

      if (uris.length === 0) {
        vscode.window.showInformationMessage(
          'Please select files in the Explorer or open a file to convert.',
        );
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Converting to Markdown',
          cancellable: false,
        },
        async (progress) => {
          const config = vscode.workspace.getConfiguration('markdown-them');
          const maxConcurrent = Math.min(
            16,
            Math.max(1, config.get<number>('maxConcurrentConversions', 6)),
          );
          const total = uris.length;
          let completed = 0;
          let succeeded = 0;
          let failed = 0;
          let singleConvertedPath: string | undefined;

          progress.report({ message: `0/${total}` });

          await runLimited(uris, maxConcurrent, async (uri) => {
            try {
              const mdPath = await convertFileToMarkdown(uri.fsPath);
              succeeded++;
              singleConvertedPath = mdPath;
              console.log(`Successfully converted: ${uri.fsPath} to ${mdPath}`);
            } catch (error) {
              failed++;
              console.error(`Failed to convert ${uri.fsPath}:`, error);
            } finally {
              completed++;
              progress.report({
                increment: 100 / total,
                message: `${completed}/${total}`,
              });
            }
          });

          if (failed === 0) {
            if (succeeded === 1 && singleConvertedPath) {
              vscode.window.showInformationMessage(
                `Markdown Them: Converted ${singleConvertedPath}.`,
              );
            } else {
              vscode.window.showInformationMessage(
                `Markdown Them: Converted ${succeeded} ${succeeded === 1 ? 'file' : 'files'}.`,
              );
            }
          } else {
            if (succeeded === 1 && singleConvertedPath) {
              vscode.window.showWarningMessage(
                `Markdown Them: Converted ${singleConvertedPath}, ${failed} failed. Check Developer Tools for details.`,
              );
            } else {
              vscode.window.showWarningMessage(
                `Markdown Them: Converted ${succeeded} ${succeeded === 1 ? 'file' : 'files'}, ${failed} failed. Check Developer Tools for details.`,
              );
            }
          }

          if (succeeded > 0) {
            await checkConversionSupportPrompt(context);
          }
        },
      );
    },
  );

  const disposable2 = vscode.commands.registerCommand(
    'markdown-them.convertCurrentToMarkdown',
    async () => {
      const filePath = getActiveFilePath();

      if (!filePath) {
        vscode.window.showErrorMessage('No active file to convert.');
        return;
      }

      try {
        const mdContent = await generateMarkdown(filePath);
        console.log(`Successfully converted current file: ${filePath}`);
        const doc = await vscode.workspace.openTextDocument({
          content: mdContent,
          language: 'markdown',
        });
        await vscode.window.showTextDocument(doc, {
          preview: false,
          viewColumn: vscode.ViewColumn.Beside,
        });
        await checkConversionSupportPrompt(context);
      } catch (error) {
        console.error(`Failed to convert ${filePath}:`, error);
        vscode.window.showErrorMessage(
          `Failed to convert ${path.basename(filePath)}: ${getErrorMessage(error)}`,
        );
      }
    },
  );

  const disposable3 = vscode.commands.registerCommand(
    'markdown-them.setMaxConcurrentConversions',
    async () => {
      const config = vscode.workspace.getConfiguration('markdown-them');
      const current = config.get<number>('maxConcurrentConversions', 6);

      const input = await vscode.window.showInputBox({
        title: 'Set Max Concurrent Conversions',
        prompt: 'Number of files converted simultaneously (1 - 16)',
        value: String(current),
        validateInput: (raw) => {
          const value = raw.trim();
          if (!/^\d+$/.test(value)) {
            return 'Please enter a whole number.';
          }

          const n = Number(value);
          if (n < 1 || n > 16) {
            return 'Value must be between 1 and 16.';
          }
          return null;
        },
      });

      if (input === undefined) {
        return;
      }

      const value = Number(input.trim());
      await config.update('maxConcurrentConversions', value, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(
        `Markdown Them: Max concurrent conversions set to ${value}.`,
      );
    },
  );

  context.subscriptions.push(disposable1, disposable2, disposable3);
}

const REPO_URL = 'https://github.com/the-long-ride/markdown-them';
const DONATE_URL = 'https://github.com/the-long-ride';
const CONVERSION_COUNT_KEY = 'markdownThem.conversionCount';
const NEVER_SHOW_AGAIN_KEY = 'markdownThem.neverShowSupportPrompt';

async function checkConversionSupportPrompt(context: vscode.ExtensionContext): Promise<void> {
  const neverShow = context.globalState.get<boolean>(NEVER_SHOW_AGAIN_KEY, false);
  if (neverShow) {
    return;
  }

  const currentCount = context.globalState.get<number>(CONVERSION_COUNT_KEY, 0) + 1;
  await context.globalState.update(CONVERSION_COUNT_KEY, currentCount);

  if (currentCount === 1 || currentCount % 20 === 0) {
    const starAction = '⭐ Star on GitHub';
    const donateAction = '❤️ Donate';
    const dontShowAction = "Don't Show Again";

    void vscode.window
      .showInformationMessage(
        'Enjoying Markdown Them? A star on GitHub or a small donation helps support ongoing maintenance and new features!',
        starAction,
        donateAction,
        dontShowAction,
      )
      .then(async (selection) => {
        if (selection === starAction) {
          await vscode.env.openExternal(vscode.Uri.parse(REPO_URL));
        } else if (selection === donateAction) {
          await vscode.env.openExternal(vscode.Uri.parse(DONATE_URL));
        } else if (selection === dontShowAction) {
          await context.globalState.update(NEVER_SHOW_AGAIN_KEY, true);
        }
      });
  }
}

export function deactivate() {}

function getCommandFileUris(args: unknown[]): vscode.Uri[] {
  let candidates: unknown[] = [];
  if (Array.isArray(args[1])) {
    candidates = args[1];
  } else if (Array.isArray(args[0])) {
    candidates = args[0];
  } else if (args[0] instanceof vscode.Uri) {
    candidates = [args[0]];
  }

  const seen = new Set<string>();
  const uris: vscode.Uri[] = [];

  for (const candidate of candidates) {
    if (
      !(candidate instanceof vscode.Uri) ||
      candidate.scheme !== 'file' ||
      seen.has(candidate.fsPath)
    ) {
      continue;
    }

    seen.add(candidate.fsPath);
    uris.push(candidate);
  }

  if (uris.length === 0) {
    const activePath = getActiveFilePath();
    if (activePath) {
      uris.push(vscode.Uri.file(activePath));
    }
  }

  return uris;
}

function getActiveFilePath(): string | undefined {
  const editorUri = vscode.window.activeTextEditor?.document.uri;
  if (editorUri?.scheme === 'file') {
    return editorUri.fsPath;
  }

  const activeTabInput = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
  if (activeTabInput instanceof vscode.TabInputText && activeTabInput.uri.scheme === 'file') {
    return activeTabInput.uri.fsPath;
  }

  return undefined;
}

async function runLimited<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;
  const workerCount = Math.min(limit, items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (index < items.length) {
        const item = items[index++];
        await worker(item);
      }
    }),
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
