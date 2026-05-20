#!/usr/bin/env node
import { createRequire } from 'module';
import { createInterface } from 'readline';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { program } from 'commander';

import { validateRepo, getBranchInfo, getDiffSummary, createTags } from './git.js';
import { generateRCC } from './excel.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const config = require(path.join(__dirname, '..', 'config.json'));

function prompt(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

function getGitUserName() {
  try {
    return execSync('git config user.name', { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function getRepositoryName() {
  try {
    const url = execSync('git config --get remote.origin.url', { encoding: 'utf8' }).trim();
    return url.replace(/\.git$/, '').split('/').pop();
  } catch {
    return '';
  }
}

program
  .name('rcc')
  .description('RCC Tools — Automatización de Registro de Control de Cambios')
  .version('1.0.0');

program
  .command('generate')
  .description('Genera el documento RCC y crea los tags de git')
  .action(async () => {
    try {
      // 1. Validate git repo
      validateRepo();

      // 2. Branch info
      const { code, type } = getBranchInfo();
      console.log(`\nRama detectada → código: ${code}, tipo: ${type}`);

      // 3. Diff summary
      const files = getDiffSummary(config.baseBranch);
      if (files.length === 0) {
        console.warn(`\nAdvertencia: no se detectaron cambios respecto a "${config.baseBranch}".`);
      } else {
        console.log(`Archivos modificados: ${files.length}`);
      }

      // 4. Interactive prompts
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const defaultDeveloper = getGitUserName();
      const repository = getRepositoryName();

      const title = (await prompt(rl, '\nTítulo del requerimiento: ')).trim();
      const developerInput = (await prompt(rl, `Desarrollador [${defaultDeveloper}]: `)).trim();
      const developer = developerInput || defaultDeveloper;
      
      if (!title) { rl.close(); throw new Error('El título es requerido.'); }

      const repositoryConfirm = (await prompt(rl, `\n¿Incluir el repositorio [${repository}] al nombre del RCC? [S/n]: `)).trim().toLowerCase();
      rl.close();
      const withoutRepository = repositoryConfirm === 'n' || repositoryConfirm === 'no';

      let tagInitial = '';
      let tagFinal = '';

      ({ tagInitial, tagFinal } = createTags(code, type));

      // 5. Generate Excel
      console.log('Generando documento RCC...');
      const outFileFinal = await generateRCC({
        code,
        title,
        developer,
        repository: withoutRepository ? '' : repository,
        tagInitial,
        tagFinal,
        files,
        templatePath: path.resolve(__dirname, '..', config.templatePath),
        outputPath: path.resolve(__dirname, '..', config.outputPath),
      });

      // 6. Summary
      console.log('\n✔ Proceso completado:');
      console.log(`  Documento : ${outFileFinal}`);
      console.log(`  Archivos   : ${files.length}`);
    } catch (err) {
      console.error(`\nError: ${err.message}`);
      process.exit(1);
    }
  });

program.parse();
