import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

const SKILL_NAME = 'markdown-them';
const SKILL_BODY = `---
name: markdown-them
description: Convert Word, PDF, Office, HTML, OpenDocument and plain-text files to Markdown with the mdthem CLI.
---

# Markdown Them

Use the locally installed \`mdthem\` command to convert documents into Markdown without sending files to a remote service.

## Usage

- Convert a file beside its source: \`mdthem "./docs/report.docx"\` produces \`./docs/report.md\`.
- Explicit output path: \`mdthem "./docs/report.docx" -d "./notes/report.md"\`.
- Convert a folder: \`mdthem "./docs"\` writes to \`./docs/results/\`.
- Recursive batch: \`mdthem "./docs" --all\`.
- Get usage information: \`mdthem --help\`.
- Install the skill for an agent: \`mdthem --skill claude\`.
- Remove an agent's managed link: \`mdthem --skill --uninstall claude\`.

Prefer quoted paths. Supported file types include DOC, DOCX, PDF, HTML, XLS, XLSX, XLM, PPTX, ODT, ODP, ODS, RTF, TXT, MD, MDX. DOC/XLS legacy formats may have reduced fidelity. Never overwrite an unrelated file intentionally; check whether the inferred output already exists.
`;

const AGENT_DIRS: Record<string, string[]> = {
  claude: ['.claude', 'skills'],
  'claude-code': ['.claude', 'skills'],
  antigravity: ['.gemini', 'config', 'skills'],
  hermes: ['.hermes', 'skills'],
  codex: ['.codex', 'skills'],
  opencode: ['.config', 'opencode', 'skills'],
  grok: ['.grok', 'skills'],
};

async function statOrNull(p: string) {
  try {
    return await fs.lstat(p);
  } catch (e: any) {
    if (e?.code === 'ENOENT') return null;
    throw e;
  }
}

async function managedLink(link: string, target: string): Promise<boolean> {
  const stat = await statOrNull(link);
  if (!stat?.isSymbolicLink()) return false;
  const actual = await fs.readlink(link);
  return path.resolve(path.dirname(link), actual) === path.resolve(target);
}

function agentName(name: string): string {
  const value = name.toLowerCase();
  if (!AGENT_DIRS[value]) {
    throw new Error(
      `Unknown agent "${name}". Supported agents: claude, antigravity, hermes, codex, opencode, grok.`,
    );
  }
  return value;
}

export async function manageSkill(argv: string[]): Promise<void> {
  const skillFlags = argv.filter((a) => a === '--skill');
  if (skillFlags.length !== 1) throw new Error('Specify --skill exactly once.');
  const rest = argv.filter((a) => a !== '--skill');
  const uninstall = rest.includes('--uninstall');
  const selectors = rest.filter((a) => a !== '--uninstall');
  if (selectors.length > 1 || selectors.some((a) => a.startsWith('-'))) {
    throw new Error('Usage: mdthem --skill [agent] or mdthem --skill --uninstall [agent]');
  }
  const agent = selectors[0] ? agentName(selectors[0]) : null;
  const home = os.homedir();
  const globalSkill = path.join(home, '.agents', 'skills', SKILL_NAME);
  const globalFile = path.join(globalSkill, 'SKILL.md');

  if (!uninstall) {
    await fs.mkdir(globalSkill, { recursive: true });
    const existing = await statOrNull(globalFile);
    if (existing?.isSymbolicLink() || (existing && !existing.isFile())) {
      throw new Error(`Cannot replace non-file skill: ${globalFile}`);
    }
    // Only overwrite a skill previously installed by this command.
    if (existing) {
      const old = await fs.readFile(globalFile, 'utf8');
      if (old !== SKILL_BODY && !old.includes('name: markdown-them')) {
        throw new Error(`Refusing to overwrite unmanaged skill: ${globalFile}`);
      }
    }
    await fs.writeFile(globalFile, SKILL_BODY, 'utf8');
    console.log(`Installed skill: ${globalFile}`);
  }

  const targets = agent ? [agent] : uninstall ? Object.keys(AGENT_DIRS) : [];
  for (const selected of new Set(targets)) {
    const dest = path.join(home, ...AGENT_DIRS[selected], 'markdown-them');
    if (uninstall) {
      if (await managedLink(dest, globalSkill)) {
        await fs.unlink(dest);
        console.log(`Removed managed ${selected} skill link: ${dest}`);
      } else if (await statOrNull(dest)) {
        console.log(`Preserved unmanaged ${selected} skill entry: ${dest}`);
      }
      continue;
    }
    if (await managedLink(dest, globalSkill)) {
      console.log(`Already linked: ${dest}`);
      continue;
    }
    if (await statOrNull(dest)) {
      throw new Error(`Refusing to replace existing agent skill: ${dest}`);
    }
    await fs.mkdir(path.dirname(dest), { recursive: true });
    try {
      await fs.symlink(globalSkill, dest, process.platform === 'win32' ? 'junction' : 'dir');
    } catch (error: any) {
      throw new Error(
        `Could not create symlink for ${selected} at ${dest}: ${error?.message || error}`,
      );
    }
    console.log(`Linked ${selected} skill: ${dest}`);
  }

  if (uninstall && !agent) {
    const fileStat = await statOrNull(globalFile);
    if (fileStat?.isFile() && !fileStat.isSymbolicLink()) {
      const text = await fs.readFile(globalFile, 'utf8');
      if (text === SKILL_BODY) {
        await fs.unlink(globalFile);
        await fs.rmdir(globalSkill).catch((error: any) => {
          if (error?.code !== 'ENOTEMPTY') throw error;
        });
        console.log(`Removed global skill: ${globalSkill}`);
      } else {
        console.log(`Preserved modified skill file: ${globalFile}`);
      }
    }
  }
}
