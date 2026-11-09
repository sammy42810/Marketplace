import {execFile} from 'node:child_process';

// Runs `magick` inside the compose container. Paths are relative to storage/ (/work there).
// execFile passes args without a shell, so file names can't inject commands. Pick output
// names in our code: the policy refuses a bad format but still leaves an empty file behind.
export function runMagick(args) {
  return new Promise((resolve, reject) => {
    execFile(
      'docker',
      ['compose', 'exec', '-T', 'imagemagick', 'magick', ...args],
      {timeout: 60_000},
      (error, stdout, stderr) => {
        if (error) reject(new Error(`ImageMagick failed: ${stderr.trim() || error.message}`));
        else resolve(stdout);
      }
    );
  });
}
