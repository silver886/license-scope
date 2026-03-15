import { execFile } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function cloneRepo(
  repoUrl: string,
  destPath: string
): Promise<string> {
  try {
    await execFileAsync(
      'git',
      ['clone', '--depth', '1', '-c', 'core.longpaths=true', repoUrl, destPath],
      { timeout: 60_000 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to clone repository "${repoUrl}": ${message}`
    );
  }

  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
      cwd: destPath,
      timeout: 10_000,
    });
    return stdout.trim();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to get commit SHA for repository "${repoUrl}": ${message}`
    );
  }
}

export async function cleanupRepo(repoPath: string): Promise<void> {
  try {
    await rm(repoPath, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup; ignore errors
  }
}
