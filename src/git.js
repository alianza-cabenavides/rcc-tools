import { execSync } from 'child_process';

function exec(cmd, cwd = process.cwd()) {
  return execSync(cmd, { cwd, encoding: 'utf8' }).trim();
}

export function validateRepo() {
  try {
    exec('git rev-parse --is-inside-work-tree');

  } catch {
    throw new Error('Not inside a git repository.');
  }
}

export function getBranchInfo() {
  const branch = exec('git branch --show-current');
  const match = branch.match(/^(RQ|GP)(\d+)/i);

  if (!match) {
    throw new Error(`Branch "${branch}" does not match expected pattern RQ#### or GP####.`);
  }

  const prefix = match[1].toUpperCase();
  const code = prefix + match[2];
  const type = prefix === 'GP' ? 'hot' : 'dev';

  return { branch, code, type };
}

export function getDiffSummary(base) {
  let output;

  try {
    output = exec(`git diff ${base}...HEAD --name-status`);

  } catch {
    throw new Error(`Failed to diff against base branch "${base}". Make sure "${base}" exists.`);
  }

  if (!output) return [];

  return output.split('\n').map(line => {
    const [action, ...rest] = line.split('\t');
    return { action: action.trim(), file: rest.join('\t').trim() };
  }).filter(e => e.file);
}

export function getCommitRange(base) {
  let output;

  try {
    output = exec(`git log ${base}..HEAD --pretty=format:"%H %s" --no-merges`);

  } catch {
    throw new Error(`Failed to get commit log from "${base}".`);
  }

  if (!output) throw new Error('No commits found ahead of base branch.');

  const lines = output.split('\n').filter(Boolean);

  const parseLine = (line) => {
    const spaceIdx = line.indexOf(' ');
    return { hash: line.slice(0, spaceIdx), message: line.slice(spaceIdx + 1) };
  };

  const initial = parseLine(lines[lines.length - 1]);
  const final = parseLine(lines[0]);

  return { initial, final };
}

function localDateStamp() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');

  return `${yyyy}${mm}${dd}`;
}

export function createTags(code, type) {
  const dateStamp = localDateStamp();
  const tagInitial = `${type}${code}`;
  const tagFinal = `${type}${code}_${dateStamp}_1`;

  return { tagInitial, tagFinal, tagsToPush: [tagInitial, tagFinal] };
}