import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { validateRepo, getBranchInfo, getDiffSummary, getCommitRange, createTags } from '../src/git.js';

const g = (cmd, cwd) => execSync(cmd, { cwd, encoding: 'utf8' }).trim();

let repoDir;
let remoteDir;
let originalCwd;

before(() => {
  originalCwd = process.cwd();
  repoDir = mkdtempSync(join(tmpdir(), 'rcc-git-test-'));
  remoteDir = mkdtempSync(join(tmpdir(), 'rcc-remote-'));

  // Bare repo acts as remote origin
  g('git init --bare', remoteDir);

  g('git init', repoDir);
  g('git config user.email "test@test.com"', repoDir);
  g('git config user.name "Tester"', repoDir);
  g('git config commit.gpgsign false', repoDir);
  g(`git remote add origin file://${remoteDir}`, repoDir);

  // Initial commit on main
  writeFileSync(join(repoDir, 'README.md'), 'initial');
  g('git add README.md', repoDir);
  g('git commit -m "initial commit"', repoDir);

  // RQ feature branch with two commits
  g('git checkout -b RQ1234-feature', repoDir);
  mkdirSync(join(repoDir, 'src'), { recursive: true });
  writeFileSync(join(repoDir, 'src/app.js'), 'v1');
  g('git add src/app.js', repoDir);
  g('git commit -m "add app"', repoDir);

  writeFileSync(join(repoDir, 'src/app.js'), 'v2');
  g('git add src/app.js', repoDir);
  g('git commit -m "update app"', repoDir);

  // GP hotfix branch (from main)
  g('git checkout main', repoDir);
  g('git checkout -b GP5678-hotfix', repoDir);
  writeFileSync(join(repoDir, 'fix.js'), 'fix');
  g('git add fix.js', repoDir);
  g('git commit -m "hotfix"', repoDir);

  // Leave repo on RQ branch as default state for tests
  g('git checkout RQ1234-feature', repoDir);

  // Push all branches to remote
  g('git push origin main RQ1234-feature GP5678-hotfix', repoDir);

  process.chdir(repoDir);
});

after(() => {
  process.chdir(originalCwd);
  rmSync(repoDir, { recursive: true, force: true });
  rmSync(remoteDir, { recursive: true, force: true });
});

// ─── validateRepo ────────────────────────────────────────────────────────────

describe('validateRepo', () => {
  it('does not throw inside a git repository', () => {
    assert.doesNotThrow(() => validateRepo());
  });

  it('throws when not inside a git repository', () => {
    const noGitDir = mkdtempSync(join(tmpdir(), 'rcc-nogit-'));
    const prev = process.cwd();
    try {
      process.chdir(noGitDir);
      assert.throws(() => validateRepo(), /Not inside a git repository/);
    } finally {
      process.chdir(repoDir);
      rmSync(noGitDir, { recursive: true, force: true });
    }
  });
});

// ─── getBranchInfo ───────────────────────────────────────────────────────────

describe('getBranchInfo', () => {
  it('parses RQ branch → code=RQ1234, type=dev', () => {
    // repo is already on RQ1234-feature
    const { code, type } = getBranchInfo();
    assert.equal(code, 'RQ1234');
    assert.equal(type, 'dev');
  });

  it('parses GP branch → code=GP5678, type=hot', () => {
    g('git checkout GP5678-hotfix', repoDir);
    try {
      const { code, type } = getBranchInfo();
      assert.equal(code, 'GP5678');
      assert.equal(type, 'hot');
    } finally {
      g('git checkout RQ1234-feature', repoDir);
    }
  });

  it('is case-insensitive (lowercase rq → RQ)', () => {
    g('git checkout -b rq0042-lowercase', repoDir);
    try {
      const { code, type } = getBranchInfo();
      assert.equal(code, 'RQ0042');
      assert.equal(type, 'dev');
    } finally {
      g('git checkout RQ1234-feature', repoDir);
      g('git branch -D rq0042-lowercase', repoDir);
    }
  });

  it('throws on branch that does not match RQ/GP pattern', () => {
    g('git checkout main', repoDir);
    try {
      assert.throws(() => getBranchInfo(), /does not match expected pattern/);
    } finally {
      g('git checkout RQ1234-feature', repoDir);
    }
  });
});

// ─── getDiffSummary ──────────────────────────────────────────────────────────

describe('getDiffSummary', () => {
  it('returns changed files relative to base branch', () => {
    const files = getDiffSummary('main');
    assert.ok(files.length > 0);
    const appFile = files.find(f => f.file.includes('app.js'));
    assert.ok(appFile, 'src/app.js should appear in the diff');
    assert.ok(['A', 'M'].includes(appFile.action), `action "${appFile.action}" should be A or M`);
  });

  it('returns empty array when branch has no changes vs base', () => {
    g('git checkout main', repoDir);
    try {
      const files = getDiffSummary('main');
      assert.deepEqual(files, []);
    } finally {
      g('git checkout RQ1234-feature', repoDir);
    }
  });
});

// ─── getCommitRange ──────────────────────────────────────────────────────────

describe('getCommitRange', () => {
  it('returns initial (oldest) and final (newest) commits', () => {
    const { initial, final } = getCommitRange('main');
    assert.equal(initial.message, 'add app');
    assert.equal(final.message, 'update app');
    assert.ok(initial.hash.length >= 7);
    assert.ok(final.hash.length >= 7);
  });

  it('throws when there are no commits ahead of base', () => {
    g('git checkout main', repoDir);
    try {
      assert.throws(() => getCommitRange('main'), /No commits found/);
    } finally {
      g('git checkout RQ1234-feature', repoDir);
    }
  });
});

// ─── createTags ──────────────────────────────────────────────────────────────

describe('createTags', () => {
  let initial, final;

  before(() => {
    ({ initial, final } = getCommitRange('main'));
  });

  it('creates both tags on first run and returns tagsToPush with 2 entries', () => {
    const { tagInitial, tagFinal, tagsToPush } = createTags('RQ1234', 'dev', initial.hash, final.hash);

    assert.match(tagInitial, /^devRQ1234_\d{8}_\d+_initial$/);
    assert.match(tagFinal,   /^devRQ1234_\d{8}_\d+_final$/);
    assert.equal(tagsToPush.length, 2);

    const tags = g('git tag -l', repoDir).split('\n');
    assert.ok(tags.includes(tagInitial), 'initial tag should exist in repo');
    assert.ok(tags.includes(tagFinal),   'final tag should exist in repo');

    // Push so remote has the tags (required for deleteTag in later tests)
    g(`git push origin ${tagInitial} ${tagFinal}`, repoDir);
  });

  it('updates final tag when it points to a different commit, keeping the same index', () => {
    // Previous test created devRQ1234_..._1_final pointing to final.hash.
    // Call with initial.hash as the new final → should replace it.
    const { tagInitial, tagFinal, tagsToPush } = createTags('RQ1234', 'dev', initial.hash, initial.hash);

    assert.equal(tagsToPush.length, 1, 'only the new final tag should need pushing');
    assert.match(tagFinal, /_1_final$/, 'index must stay at 1, not increment');

    // Old final tag must be gone, new one must exist
    const tags = g('git tag -l', repoDir).split('\n');
    assert.ok(tags.includes(tagFinal),    'new final tag should exist');
    assert.ok(tags.includes(tagInitial),  'initial tag should be untouched');

    // Verify the new final tag points to the new commit
    const resolvedHash = g(`git rev-list -n 1 ${tagFinal}`, repoDir);
    assert.equal(resolvedHash, initial.hash, 'final tag should point to the updated commit');
  });

  it('returns tagsToPush empty when final tag already points to HEAD with today date', () => {
    // Previous test left final pointing to initial.hash. Call again with same hash.
    const { tagFinal, tagsToPush } = createTags('RQ1234', 'dev', initial.hash, initial.hash);

    assert.equal(tagsToPush.length, 0, 'nothing to push when tag is already correct');

    const resolvedHash = g(`git rev-list -n 1 ${tagFinal}`, repoDir);
    assert.equal(resolvedHash, initial.hash, 'final tag should still point to the same commit');
  });

  it('uses local date (YYYYMMDD) in the tag name', () => {
    const { tagInitial } = createTags('GP5678', 'hot', initial.hash, final.hash);
    const today = new Date();
    const expected = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('');
    assert.ok(tagInitial.includes(expected), `tag should contain today's date ${expected}`);
  });
});
