import * as vscode from "vscode";
import * as path from "path";
import { convertFileToMarkdown, generateMarkdown } from "../core";

export function activate(context: vscode.ExtensionContext) {
  const disposable1 = vscode.commands.registerCommand(
    "markdown-them.convertToMarkdown",
    async (...args) => {
      const uris = getCommandFileUris(args);

      if (uris.length === 0) {
        vscode.window.showInformationMessage("Please right-click on files in the Explorer to convert.");
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Converting to Markdown",
          cancellable: false,
        },
        async (progress) => {
          const config = vscode.workspace.getConfiguration("markdown-them");
          const maxConcurrent = Math.min(16, Math.max(1, config.get<number>("maxConcurrentConversions", 6)));
          const total = uris.length;
          let completed = 0;
          let succeeded = 0;
          let failed = 0;

          progress.report({ message: `0/${total}` });

          await runLimited(uris, maxConcurrent, async (uri) => {
            try {
              const mdPath = await convertFileToMarkdown(uri.fsPath);
              succeeded++;
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
            vscode.window.showInformationMessage(
              `Markdown Them: Converted ${succeeded} ${succeeded === 1 ? "file" : "files"}.`,
            );
          } else {
            vscode.window.showWarningMessage(
              `Markdown Them: Converted ${succeeded} ${succeeded === 1 ? "file" : "files"}, ${failed} failed. Check Developer Tools for details.`,
            );
          }
        },
      );
    },
  );

  const disposable2 = vscode.commands.registerCommand("markdown-them.convertCurrentToMarkdown", async () => {
    const filePath = getActiveFilePath();

    if (!filePath) {
      vscode.window.showErrorMessage("No active file to convert.");
      return;
    }

    try {
      const mdContent = await generateMarkdown(filePath);
      console.log(`Successfully converted current file: ${filePath}`);
      const doc = await vscode.workspace.openTextDocument({
        content: mdContent,
        language: "markdown",
      });
      await vscode.window.showTextDocument(doc, {
        preview: false,
        viewColumn: vscode.ViewColumn.Beside,
      });
    } catch (error) {
      console.error(`Failed to convert ${filePath}:`, error);
      vscode.window.showErrorMessage(`Failed to convert ${path.basename(filePath)}: ${getErrorMessage(error)}`);
    }
  });

  const disposable3 = vscode.commands.registerCommand("markdown-them.setMaxConcurrentConversions", async () => {
    const config = vscode.workspace.getConfiguration("markdown-them");
    const current = config.get<number>("maxConcurrentConversions", 6);

    const input = await vscode.window.showInputBox({
      title: "Set Max Concurrent Conversions",
      prompt: "Number of files converted simultaneously (1 - 16)",
      value: String(current),
      validateInput: (raw) => {
        const value = raw.trim();
        if (!/^\d+$/.test(value)) {
          return "Please enter a whole number.";
        }

        const n = Number(value);
        if (n < 1 || n > 16) {
          return "Value must be between 1 and 16.";
        }
        return null;
      },
    });

    if (input === undefined) {
      return;
    }

    const value = Number(input.trim());
    await config.update("maxConcurrentConversions", value, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage(`Markdown Them: Max concurrent conversions set to ${value}.`);
  });

  context.subscriptions.push(disposable1, disposable2, disposable3);
}

export function deactivate() {}

function getCommandFileUris(args: unknown[]): vscode.Uri[] {
  const candidates = Array.isArray(args[1]) ? args[1] : args[0] instanceof vscode.Uri ? [args[0]] : [];
  const seen = new Set<string>();
  const uris: vscode.Uri[] = [];

  for (const candidate of candidates) {
    if (!(candidate instanceof vscode.Uri) || candidate.scheme !== "file" || seen.has(candidate.fsPath)) {
      continue;
    }

    seen.add(candidate.fsPath);
    uris.push(candidate);
  }

  return uris;
}

function getActiveFilePath(): string | undefined {
  const editorUri = vscode.window.activeTextEditor?.document.uri;
  if (editorUri?.scheme === "file") {
    return editorUri.fsPath;
  }

  const activeTabInput = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
  if (activeTabInput instanceof vscode.TabInputText && activeTabInput.uri.scheme === "file") {
    return activeTabInput.uri.fsPath;
  }

  return undefined;
}

async function runLimited<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
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
