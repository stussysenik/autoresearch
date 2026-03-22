/**
 * Storage monitoring utilities.
 *
 * Guards against filling disk during overnight runs.
 * All output is .md/.json so this is defensive — total output should be <1MB.
 */

import { execSync } from 'child_process'

const MIN_FREE_GB = 2

/**
 * Get available disk space in GB on the root volume.
 */
export function getFreeDiskGB(): number {
  try {
    const output = execSync('df -g /').toString()
    const lines = output.trim().split('\n')
    const fields = lines[1].split(/\s+/)
    return parseInt(fields[3], 10)
  } catch {
    return 999 // If we can't check, assume it's fine
  }
}

/**
 * Get size of a directory in MB.
 */
export function getDirSizeMB(dir: string): number {
  try {
    const output = execSync(`du -sm "${dir}"`).toString()
    return parseInt(output.split('\t')[0], 10)
  } catch {
    return 0
  }
}

/**
 * Check if we have enough free disk space to continue.
 */
export function isStorageSafe(): boolean {
  return getFreeDiskGB() >= MIN_FREE_GB
}
