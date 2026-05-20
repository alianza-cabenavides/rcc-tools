import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

export async function generateRCC({ code, title, developer, repository, tagInitial, tagFinal, files, templatePath, outputPath }) {
  const resolvedTemplate = path.resolve(templatePath);
  if (!fs.existsSync(resolvedTemplate)) {
    throw new Error(`Template not found at: ${resolvedTemplate}`);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(resolvedTemplate);

  const sheet1 = workbook.getWorksheet(1);
  const sheet3 = workbook.getWorksheet(3);

  if (!sheet1) throw new Error('Template is missing sheet 1.');
  if (!sheet3) throw new Error('Template is missing sheet 3.');

  // Format date as DD/MM/YYYY
  const d = new Date();
  const fecha = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

  // Sheet 1: fill header fields
  sheet1.getCell('B9').value = title;
  sheet1.getCell('B17').value = code;
  sheet1.getCell('B19').value = developer;
  sheet1.getCell('B16').value = fecha;

  // Sheet 3: tags with merge and alignment
  const cellTagIni = sheet3.getCell('F8');
  cellTagIni.value = tagInitial;
  sheet3.mergeCells('F8:J8');
  cellTagIni.alignment = { horizontal: 'center' };

  const cellTagEnd = sheet3.getCell('F9');
  cellTagEnd.value = tagFinal;
  sheet3.mergeCells('F9:J9');
  cellTagEnd.alignment = { horizontal: 'center' };

  // File table starts at row 16
  files.forEach(({ action, file }, i) => {
    const rowIndex = 16 + i;
    const row = sheet3.getRow(rowIndex);
    row.height = 27;
    row.getCell(1).value = 'N/A';
    row.getCell(2).value = 'Realizar merge con la rama master\nLanzar Job';
    row.getCell(3).value = action;
    const cell4 = row.getCell(4);
    cell4.value = file;
    sheet3.mergeCells(rowIndex, 4, rowIndex, 7);
    cell4.alignment = { horizontal: 'center', vertical: 'top', wrapText: true };
    row.getCell(9).value = tagFinal;
    row.commit();
  });

  fs.mkdirSync(path.resolve(outputPath), { recursive: true });

  const fileName = `FM-RG-CONTROL DE CAMBIOS ${code} V1 Front ${repository}.xlsx`;
  const outFile = path.resolve(outputPath, fileName);
  await workbook.xlsx.writeFile(outFile);

  return outFile;
}
