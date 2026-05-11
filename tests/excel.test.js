import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { generateRCC } from '../src/excel.js';

let tmpDir;
let templatePath;

const PARAMS = {
  code: 'RQ9999',
  title: 'Test Feature Title',
  developer: 'Dev Tester',
  type: 'dev',
  tagInitial: 'devRQ9999_20260101_1_initial',
  tagFinal:   'devRQ9999_20260101_1_final',
  files: [
    { action: 'A', file: 'src/new-file.js' },
    { action: 'M', file: 'src/existing.js' },
  ],
};

async function createMinimalTemplate(filePath) {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet('Sheet1');
  wb.addWorksheet('Sheet2');
  wb.addWorksheet('Sheet3');
  await wb.xlsx.writeFile(filePath);
}

before(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'rcc-excel-test-'));
  templatePath = join(tmpDir, 'template.xlsx');
  await createMinimalTemplate(templatePath);
});

after(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ─── generateRCC ─────────────────────────────────────────────────────────────

describe('generateRCC', () => {
  it('creates the output file with the correct name', async () => {
    const outDir = join(tmpDir, 'out1');
    await generateRCC({ ...PARAMS, templatePath, outputPath: outDir });

    const expected = join(outDir, `FM-RG-CONTROL DE CAMBIOS ${PARAMS.code} V1 Front.xlsx`);
    assert.ok(existsSync(expected), 'output file should exist at expected path');
  });

  it('writes title, code and developer in sheet 1', async () => {
    const outDir = join(tmpDir, 'out2');
    const outFile = await generateRCC({ ...PARAMS, templatePath, outputPath: outDir });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outFile);
    const sheet1 = wb.getWorksheet(1);

    assert.equal(sheet1.getCell('B9').value,  PARAMS.title);
    assert.equal(sheet1.getCell('B17').value, PARAMS.code);
    assert.equal(sheet1.getCell('B19').value, PARAMS.developer);
  });

  it('writes a date string in B16 of sheet 1', async () => {
    const outDir = join(tmpDir, 'out3');
    const outFile = await generateRCC({ ...PARAMS, templatePath, outputPath: outDir });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outFile);
    const sheet1 = wb.getWorksheet(1);

    const fecha = sheet1.getCell('B16').value;
    assert.ok(typeof fecha === 'string', 'date cell should be a string');
    assert.match(fecha, /^\d{2}\/\d{2}\/\d{4}$/, 'date format should be DD/MM/YYYY');
  });

  it('writes tag values in sheet 3 (F8, F9)', async () => {
    const outDir = join(tmpDir, 'out4');
    const outFile = await generateRCC({ ...PARAMS, templatePath, outputPath: outDir });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outFile);
    const sheet3 = wb.getWorksheet(3);

    assert.equal(sheet3.getCell('F8').value, PARAMS.tagInitial);
    assert.equal(sheet3.getCell('F9').value, PARAMS.tagFinal);
  });

  it('writes each file into the table starting at row 16', async () => {
    const outDir = join(tmpDir, 'out5');
    const outFile = await generateRCC({ ...PARAMS, templatePath, outputPath: outDir });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outFile);
    const sheet3 = wb.getWorksheet(3);

    PARAMS.files.forEach(({ action, file }, i) => {
      const row = sheet3.getRow(16 + i);
      assert.equal(row.getCell(1).value, 'N/A',        `row ${16 + i}: col A should be N/A`);
      assert.equal(row.getCell(3).value, action,       `row ${16 + i}: col C should be action`);
      assert.equal(row.getCell(4).value, file,         `row ${16 + i}: col D should be filename`);
      assert.equal(row.getCell(9).value, PARAMS.tagFinal, `row ${16 + i}: col I should be tagFinal`);
    });
  });

  it('throws when template file does not exist', async () => {
    await assert.rejects(
      () => generateRCC({ ...PARAMS, templatePath: '/nonexistent/template.xlsx', outputPath: tmpDir }),
      /Template not found/,
    );
  });
});
