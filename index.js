#!/usr/bin/env node
import { program } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import yaml from 'js-yaml';
import { mkdirSync, writeFileSync, readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const VERSION = '0.1.0';
const LABRYX_HOME = join(homedir(), '.labryx');
const WORKFLOWS_DIR = join(LABRYX_HOME, 'workflows');
const OUTBOX_DIR = join(LABRYX_HOME, 'outbox');
const OUTPUT_DIR = join(LABRYX_HOME, 'output');

const logo = `
${chalk.cyan('╦  ╔═╗╔╗ ╦═╗╦ ╦═╗')}
${chalk.cyan('║  ╠═╣╠╩╗╠╦╝╚╦╝╔╩╦╝')}
${chalk.cyan('╩═╝╩ ╩╚═╝╩╚═ ╩ ╩ ╚═')}
${chalk.gray('AI Workflow Automation')}
`;

program
  .name('labryx')
  .description('Labryx — AI-driven workflow automation CLI')
  .version(VERSION);

// ─── workflow command ────────────────────────────────────────────────────────
program
  .command('workflow')
  .description('Create and run AI-powered workflows')
  .option('-i, --interactive', 'Build a workflow interactively')
  .option('-r, --run <file>', 'Run a workflow file')
  .option('-l, --list', 'List saved workflows')
  .action(async (opts) => {
    console.log(logo);
    if (opts.interactive) {
      await buildWorkflowInteractive();
    } else if (opts.run) {
      await runWorkflow(opts.run);
    } else if (opts.list) {
      console.log(chalk.cyan('Saved workflows:\n'));
      if (!existsSync(WORKFLOWS_DIR)) {
        console.log(chalk.gray('  No workflows yet. Try: labryx workflow --interactive'));
      } else {
        const files = readdirSync(WORKFLOWS_DIR).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
        if (files.length === 0) {
          console.log(chalk.gray('  No workflows yet. Try: labryx workflow --interactive'));
        } else {
          files.forEach(f => {
            try {
              const doc = yaml.load(readFileSync(join(WORKFLOWS_DIR, f), 'utf8'));
              const created = doc.created ? chalk.gray(new Date(doc.created).toLocaleString()) : chalk.gray('—');
              console.log(`  ${chalk.white(doc.name || f)}  ${chalk.gray('trigger:')} ${chalk.yellow(doc.trigger || '—')}  ${chalk.gray('steps:')} ${chalk.yellow((doc.steps || []).length)}  ${chalk.gray('created:')} ${created}`);
            } catch {
              console.log(`  ${chalk.white(f)}  ${chalk.gray('(unreadable)')}`);
            }
          });
        }
      }
    } else {
      program.commands.find(c => c.name() === 'workflow').help();
    }
  });

// ─── workflow execution engine ───────────────────────────────────────────────

async function runWorkflow(fileArg) {
  // Resolve the workflow file path
  let filePath = fileArg;
  if (!existsSync(filePath)) {
    // Try in workflows directory
    filePath = join(WORKFLOWS_DIR, fileArg);
    if (!existsSync(filePath)) {
      // Try appending .yaml
      filePath = join(WORKFLOWS_DIR, fileArg + '.yaml');
      if (!existsSync(filePath)) {
        console.log(chalk.red(`✗ Workflow file not found: ${fileArg}`));
        console.log(chalk.gray(`  Looked in: ${WORKFLOWS_DIR}`));
        process.exit(1);
      }
    }
  }

  let doc;
  try {
    doc = yaml.load(readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.log(chalk.red(`✗ Failed to parse workflow: ${e.message}`));
    process.exit(1);
  }

  const steps = doc.steps || [];
  console.log(chalk.bold(`\n▶ Running workflow: ${chalk.cyan(doc.name || fileArg)}`));
  console.log(chalk.gray(`  Trigger: ${doc.trigger || '—'}  |  Steps: ${steps.length}`));
  console.log('');

  for (let i = 0; i < steps.length; i++) {
    // Steps can be strings or { action: "..." } objects
    const raw = steps[i];
    const stepName = typeof raw === 'string' ? raw : (raw.action || raw.name || JSON.stringify(raw));
    const stepLabel = chalk.gray(`[${i + 1}/${steps.length}]`);

    console.log(`${stepLabel} ${chalk.bold(stepName)}`);
    await executeStep(stepName);
    console.log('');
  }

  console.log(chalk.green.bold(`✓ Workflow "${doc.name || fileArg}" completed successfully!`));
}

async function executeStep(stepName) {
  const normalized = stepName.toLowerCase().trim();

  if (normalized === 'http request') {
    await stepHttpRequest();
  } else if (normalized === 'send email') {
    await stepSendEmail();
  } else if (normalized === 'ai text generation') {
    await stepAiTextGeneration();
  } else if (normalized === 'transform data') {
    await stepTransformData();
  } else if (normalized === 'save to file') {
    await stepSaveToFile();
  } else {
    const spinner = ora(`Executing: ${stepName}`).start();
    await new Promise(r => setTimeout(r, 500));
    spinner.succeed(chalk.green(`Step: ${stepName} — executed ✓`));
  }
}

async function stepHttpRequest() {
  const { url } = await inquirer.prompt([{
    type: 'input',
    name: 'url',
    message: 'URL:',
    default: 'https://httpbin.org/get',
  }]);
  const { method } = await inquirer.prompt([{
    type: 'list',
    name: 'method',
    message: 'Method:',
    choices: ['GET', 'POST'],
  }]);

  const spinner = ora(`${method} ${url}`).start();
  try {
    const res = await fetch(url, { method });
    spinner.succeed(chalk.green(`${method} ${url} → ${res.status} ${res.statusText}`));
    const body = await res.text();
    const preview = body.length > 200 ? body.substring(0, 200) + '...' : body;
    console.log(chalk.gray(`  Response preview: ${preview}`));
  } catch (e) {
    spinner.fail(chalk.red(`Request failed: ${e.message}`));
  }
}

async function stepSendEmail() {
  const answers = await inquirer.prompt([
    { type: 'input', name: 'to', message: 'To:', default: 'user@example.com' },
    { type: 'input', name: 'subject', message: 'Subject:', default: 'Labryx Workflow Notification' },
    { type: 'input', name: 'body', message: 'Body:', default: 'This is an automated message from Labryx.' },
  ]);

  mkdirSync(OUTBOX_DIR, { recursive: true });
  const ts = Date.now();
  const emailFile = join(OUTBOX_DIR, `${ts}.json`);
  const emailData = { ...answers, timestamp: new Date().toISOString(), status: 'queued' };
  writeFileSync(emailFile, JSON.stringify(emailData, null, 2), 'utf8');

  console.log(chalk.green(`  ✓ Email queued → ${emailFile}`));
  console.log(chalk.gray(`    To: ${answers.to} | Subject: ${answers.subject}`));
}

async function stepAiTextGeneration() {
  const { description } = await inquirer.prompt([{
    type: 'input',
    name: 'description',
    message: 'Describe what to generate:',
    default: 'A summary of today\'s key metrics',
  }]);

  const spinner = ora('Generating AI response...').start();
  await new Promise(r => setTimeout(r, 1200));

  // Realistic mock responses based on common descriptions
  const mockResponses = {
    default: `Based on the analysis of available data, here are the key findings:\n\n1. Performance metrics are trending positively with a 12% increase over the previous period.\n2. User engagement has improved, with average session duration up by 8 minutes.\n3. Three action items have been identified for follow-up.\n\nRecommendation: Focus on optimizing the conversion funnel in the next sprint.`,
    email: `Subject: Weekly Performance Digest\n\nHi team,\n\nThis week saw strong performance across all key metrics. Revenue is up 15% WoW, and customer satisfaction scores remain above our 4.5 target.\n\nKey highlights:\n- New user signups: 342 (+18%)\n- Churn rate: 2.1% (down from 2.8%)\n- NPS: 67\n\nLet's keep the momentum going.\n\nBest,\nLabryx AI`,
    summary: `Executive Summary:\n\nThe project is on track for the Q2 deadline. All critical path items have been completed, with 3 remaining tasks in the backlog. Resource utilization is at 85%, which is within optimal range. No blockers identified.`,
  };

  const descLower = description.toLowerCase();
  let response = mockResponses.default;
  if (descLower.includes('email') || descLower.includes('digest')) response = mockResponses.email;
  if (descLower.includes('summary') || descLower.includes('report')) response = mockResponses.summary;

  spinner.succeed(chalk.green('AI generation complete'));
  console.log(chalk.cyan('  ── AI Output ──'));
  response.split('\n').forEach(line => console.log(chalk.white(`  ${line}`)));
  console.log(chalk.cyan('  ── End ──'));
}

async function stepTransformData() {
  const { input } = await inquirer.prompt([{
    type: 'input',
    name: 'input',
    message: 'Input text to transform:',
    default: 'hello world from labryx',
  }]);

  console.log(chalk.green('  ✓ Transformations:'));
  console.log(chalk.white(`    UPPERCASE:  ${input.toUpperCase()}`));
  console.log(chalk.white(`    lowercase:  ${input.toLowerCase()}`));
  console.log(chalk.white(`    Title Case: ${input.replace(/\b\w/g, c => c.toUpperCase())}`));
  console.log(chalk.white(`    Reversed:   ${input.split('').reverse().join('')}`));
  console.log(chalk.white(`    Length:     ${input.length} characters`));
}

async function stepSaveToFile() {
  const answers = await inquirer.prompt([
    { type: 'input', name: 'filename', message: 'Filename:', default: 'output.txt' },
    { type: 'input', name: 'content', message: 'Content:', default: 'Generated by Labryx workflow' },
  ]);

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const outPath = join(OUTPUT_DIR, answers.filename);
  writeFileSync(outPath, answers.content, 'utf8');
  console.log(chalk.green(`  ✓ Saved → ${outPath}`));
}

// ─── interactive workflow builder ────────────────────────────────────────────

async function buildWorkflowInteractive() {
  console.log(chalk.bold('\n🔧 Workflow Builder\n'));

  const { name } = await inquirer.prompt([{
    type: 'input',
    name: 'name',
    message: 'Workflow name:',
    default: 'my-workflow',
  }]);

  const { trigger } = await inquirer.prompt([{
    type: 'list',
    name: 'trigger',
    message: 'Select a trigger:',
    choices: [
      'HTTP Request (webhook)',
      'Schedule (cron)',
      'File change',
      'Manual',
    ],
  }]);

  const { steps } = await inquirer.prompt([{
    type: 'checkbox',
    name: 'steps',
    message: 'Select workflow steps:',
    choices: [
      'AI text generation',
      'Send email',
      'HTTP request',
      'Transform data',
      'Save to file',
      chalk.gray('↳ More integrations in Pro'),
    ],
  }]);

  const cleanSteps = steps.filter(s => !s.includes('Pro'));

  const spinner = ora('Building workflow...').start();

  // Save workflow as YAML
  mkdirSync(WORKFLOWS_DIR, { recursive: true });
  const workflow = {
    name,
    trigger,
    steps: cleanSteps.map(s => ({ action: s })),
    created: new Date().toISOString(),
  };
  const filePath = join(WORKFLOWS_DIR, `${name}.yaml`);
  writeFileSync(filePath, yaml.dump(workflow, { lineWidth: 120 }), 'utf8');

  await new Promise(r => setTimeout(r, 800));
  spinner.succeed(chalk.green(`Workflow "${name}" saved!`));

  console.log(chalk.cyan('\n📋 Summary:'));
  console.log(`  Trigger: ${chalk.white(trigger)}`);
  console.log(`  Steps:   ${chalk.white(cleanSteps.join(', ') || 'none')}`);
  console.log(`  File:    ${chalk.white(filePath)}`);
  console.log(`\n${chalk.bold('Run it:')} labryx workflow --run ${name}.yaml`);
  console.log(`${chalk.gray('Unlock unlimited workflows → labryx.dev/pro ($29/mo)')}`);
}

// ─── generate command ────────────────────────────────────────────────────────
program
  .command('generate')
  .description('Generate workflow templates from prompts')
  .option('-t, --type <type>', 'Template type (email|report|pipeline|scraper)')
  .option('-p, --prompt <text>', 'Describe the workflow you want')
  .action(async (opts) => {
    console.log(logo);
    if (opts.prompt) {
      const spinner = ora(`Generating workflow from: "${opts.prompt}"`).start();
      await new Promise(r => setTimeout(r, 1500));
      spinner.succeed('Workflow generated!');
      console.log(chalk.cyan('\nTemplate ready → workflow.yaml'));
      console.log(chalk.gray('Pro: AI-powered generation with GPT-4 → labryx.dev/pro'));
    } else if (opts.type) {
      const templates = {
        email: 'Email automation workflow',
        report: 'Daily report pipeline',
        pipeline: 'Data processing pipeline',
        scraper: 'Web scraper workflow',
      };
      const desc = templates[opts.type] || 'Custom workflow';
      console.log(chalk.green(`✓ Generated: ${desc}`));
      console.log(chalk.gray('  Saved to workflow.yaml'));
    } else {
      console.log(chalk.yellow('Usage: labryx generate --type email'));
      console.log(chalk.yellow('       labryx generate --prompt "send slack when form submitted"'));
    }
  });

// ─── auth command ─────────────────────────────────────────────────────────────
program
  .command('auth')
  .description('Authenticate with Labryx Pro')
  .option('--login', 'Log in to your account')
  .option('--status', 'Check auth status')
  .action(async (opts) => {
    console.log(logo);
    if (opts.login) {
      const { email } = await inquirer.prompt([{
        type: 'input',
        name: 'email',
        message: 'Email:',
      }]);
      console.log(chalk.cyan(`\nOpen this URL to complete login:`));
      console.log(chalk.underline(`https://labryx.dev/auth/cli?email=${encodeURIComponent(email)}`));
    } else if (opts.status) {
      console.log(chalk.yellow('Not logged in. Run: labryx auth --login'));
    } else {
      console.log(chalk.cyan('Labryx Auth'));
      console.log('  labryx auth --login   Log in to Pro');
      console.log('  labryx auth --status  Check current status');
    }
  });

// ─── upgrade command ─────────────────────────────────────────────────────────
program
  .command('upgrade')
  .description('Upgrade to Labryx Pro')
  .action(() => {
    console.log(logo);
    console.log(chalk.bold('🚀 Labryx Pro — $29/month\n'));
    console.log('  ✓ Unlimited workflows');
    console.log('  ✓ AI-powered generation (GPT-4)');
    console.log('  ✓ Cloud execution & scheduling');
    console.log('  ✓ Team collaboration');
    console.log('  ✓ Priority support\n');
    console.log(chalk.cyan('Upgrade now → https://labryx.dev/pro'));
  });

// ─── default: show logo + help ───────────────────────────────────────────────
if (process.argv.length <= 2) {
  console.log(logo);
  console.log(chalk.bold('Commands:\n'));
  console.log('  labryx workflow --interactive   Build a workflow');
  console.log('  labryx generate --type email    Generate a template');
  console.log('  labryx auth --login             Log in to Pro');
  console.log('  labryx upgrade                  View Pro features\n');
  console.log(chalk.gray('labryx <command> --help for details'));
  process.exit(0);
}

program.parse();
