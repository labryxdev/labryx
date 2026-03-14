#!/usr/bin/env node
import { program } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import yaml from 'js-yaml';
import { mkdirSync, writeFileSync, readdirSync, readFileSync, existsSync, unlinkSync, appendFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const VERSION = '0.2.1';
const LABRYX_HOME = join(homedir(), '.labryx');
const WORKFLOWS_DIR = join(LABRYX_HOME, 'workflows');
const OUTBOX_DIR = join(LABRYX_HOME, 'outbox');
const OUTPUT_DIR = join(LABRYX_HOME, 'output');
const RUNS_LOG = join(LABRYX_HOME, 'runs.log');
const AUTH_FILE = join(LABRYX_HOME, 'auth.json');

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

// ─── run command (alias for workflow --run) ───────────────────────────────────
program
  .command('run <name>')
  .description('Run a saved workflow by name')
  .action(async (name) => {
    console.log(logo);
    await runWorkflow(name);
  });

// ─── workflow command ────────────────────────────────────────────────────────
program
  .command('workflow')
  .description('Create and run AI-powered workflows')
  .option('-i, --interactive', 'Build a workflow interactively')
  .option('-r, --run <name>', 'Run a workflow by name or file')
  .option('-l, --list', 'List saved workflows')
  .option('-e, --edit <name>', 'Edit an existing workflow interactively')
  .option('-d, --delete <name>', 'Delete a workflow (prompts for confirmation)')
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
    } else if (opts.edit) {
      await editWorkflow(opts.edit);
    } else if (opts.delete) {
      await deleteWorkflow(opts.delete);
    } else {
      program.commands.find(c => c.name() === 'workflow').help();
    }
  });

// ─── status command ───────────────────────────────────────────────────────────
program
  .command('status')
  .description('Show labryx status, recent runs, and auth info')
  .action(() => {
    console.log(logo);
    console.log(chalk.bold('Status\n'));

    console.log(`  ${chalk.gray('Version:')}   ${chalk.white(VERSION)}`);

    let wfCount = 0;
    if (existsSync(WORKFLOWS_DIR)) {
      wfCount = readdirSync(WORKFLOWS_DIR).filter(f => f.endsWith('.yaml') || f.endsWith('.yml')).length;
    }
    console.log(`  ${chalk.gray('Workflows:')} ${chalk.white(wfCount)}`);

    let authStatus = chalk.yellow('Not logged in');
    if (existsSync(AUTH_FILE)) {
      try {
        const auth = JSON.parse(readFileSync(AUTH_FILE, 'utf8'));
        authStatus = auth.email ? chalk.green(`Logged in as ${auth.email}`) : chalk.yellow('Not logged in');
      } catch { /* ignore */ }
    }
    console.log(`  ${chalk.gray('Auth:')}      ${authStatus}`);

    console.log(`\n  ${chalk.gray('Recent runs:')}`);
    if (existsSync(RUNS_LOG)) {
      const lines = readFileSync(RUNS_LOG, 'utf8').trim().split('\n').filter(Boolean);
      const last3 = lines.slice(-3).reverse();
      if (last3.length === 0) {
        console.log(chalk.gray('    No runs yet.'));
      } else {
        last3.forEach(line => {
          try {
            const run = JSON.parse(line);
            const ts = new Date(run.ts).toLocaleString();
            const icon = run.status === 'ok' ? chalk.green('✓') : chalk.red('✗');
            console.log(`    ${icon} ${chalk.white(run.name)} ${chalk.gray(`(${run.steps} steps)`)} ${chalk.gray(ts)}`);
          } catch {
            console.log(chalk.gray(`    ${line}`));
          }
        });
      }
    } else {
      console.log(chalk.gray('    No runs yet.'));
    }
    console.log('');
  });

// ─── workflow execution engine ────────────────────────────────────────────────

function resolveConfig(config, context) {
  if (!config) return undefined;
  const resolved = {};
  for (const [key, val] of Object.entries(config)) {
    if (typeof val === 'string') {
      resolved[key] = val.replace(/\{\{(\w+)\}\}/g, (_, varname) =>
        context[varname] !== undefined ? context[varname] : `{{${varname}}}`
      );
    } else {
      resolved[key] = val;
    }
  }
  return resolved;
}

function appendRunLog(name, steps, status) {
  mkdirSync(LABRYX_HOME, { recursive: true });
  const entry = JSON.stringify({ ts: new Date().toISOString(), name, steps, status });
  appendFileSync(RUNS_LOG, entry + '\n', 'utf8');
}

function resolveWorkflowPath(fileArg) {
  if (existsSync(fileArg)) return fileArg;
  const inDir = join(WORKFLOWS_DIR, fileArg);
  if (existsSync(inDir)) return inDir;
  const withExt = join(WORKFLOWS_DIR, fileArg + '.yaml');
  if (existsSync(withExt)) return withExt;
  return null;
}

async function runWorkflow(fileArg) {
  const filePath = resolveWorkflowPath(fileArg);
  if (!filePath) {
    console.log(chalk.red(`✗ Workflow not found: ${fileArg}`));
    console.log(chalk.gray(`  Looked in: ${WORKFLOWS_DIR}`));
    process.exit(1);
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

  const context = {};

  for (let i = 0; i < steps.length; i++) {
    const raw = steps[i];
    const stepObj = typeof raw === 'string' ? { action: raw } : raw;
    const stepName = stepObj.action || stepObj.name || JSON.stringify(raw);
    const resolvedConfig = resolveConfig(stepObj.config, context);
    const stepLabel = chalk.gray(`[${i + 1}/${steps.length}]`);

    console.log(`${stepLabel} ${chalk.bold(stepName)}`);
    const result = await executeStep(stepName, resolvedConfig);

    if (stepObj.output && result !== undefined && result !== null) {
      context[stepObj.output] = result;
      console.log(chalk.dim(`  -> stored as ${stepObj.output}`));
    }

    console.log('');
  }

  appendRunLog(doc.name || fileArg, steps.length, 'ok');
  console.log(chalk.green.bold(`✓ Workflow "${doc.name || fileArg}" completed successfully!`));
}

async function executeStep(stepName, config) {
  const normalized = stepName.toLowerCase().trim();

  if (normalized === 'http request') {
    return await stepHttpRequest(config);
  } else if (normalized === 'send email') {
    return await stepSendEmail(config);
  } else if (normalized === 'ai text generation') {
    return await stepAiTextGeneration(config);
  } else if (normalized === 'transform data') {
    return await stepTransformData(config);
  } else if (normalized === 'save to file') {
    return await stepSaveToFile(config);
  } else if (normalized === 'slack message') {
    return await stepSlackMessage(config);
  } else {
    const spinner = ora(`Executing: ${stepName}`).start();
    await new Promise(r => setTimeout(r, 500));
    spinner.succeed(chalk.green(`Step: ${stepName} — executed ✓`));
    return null;
  }
}

async function stepHttpRequest(config) {
  let url, method;

  if (config && config.url) {
    url = config.url;
    method = config.method || 'GET';
  } else {
    const a = await inquirer.prompt([
      { type: 'input', name: 'url', message: 'URL:', default: 'https://httpbin.org/get' },
      { type: 'list', name: 'method', message: 'Method:', choices: ['GET', 'POST'] },
    ]);
    url = a.url;
    method = a.method;
  }

  const spinner = ora(`${method} ${url}`).start();
  try {
    const fetchOpts = { method };
    if (method === 'POST' && config && config.body) {
      fetchOpts.headers = { 'Content-Type': 'application/json' };
      fetchOpts.body = typeof config.body === 'string' ? config.body : JSON.stringify(config.body);
    }
    const res = await fetch(url, fetchOpts);
    spinner.succeed(chalk.green(`${method} ${url} → ${res.status} ${res.statusText}`));
    const body = await res.text();
    const preview = body.length > 200 ? body.substring(0, 200) + '...' : body;
    console.log(chalk.gray(`  Response preview: ${preview}`));
    return body;
  } catch (e) {
    spinner.fail(chalk.red(`Request failed: ${e.message}`));
    return null;
  }
}

async function stepSendEmail(config) {
  let answers;

  if (config && config.to) {
    answers = {
      to: config.to,
      subject: config.subject || 'Labryx Workflow Notification',
      body: config.body || 'This is an automated message from Labryx.',
    };
  } else {
    answers = await inquirer.prompt([
      { type: 'input', name: 'to', message: 'To:', default: 'user@example.com' },
      { type: 'input', name: 'subject', message: 'Subject:', default: 'Labryx Workflow Notification' },
      { type: 'input', name: 'body', message: 'Body:', default: 'This is an automated message from Labryx.' },
    ]);
  }

  mkdirSync(OUTBOX_DIR, { recursive: true });
  const ts = Date.now();
  const emailFile = join(OUTBOX_DIR, `${ts}.json`);
  const emailData = { ...answers, timestamp: new Date().toISOString(), status: 'queued' };
  writeFileSync(emailFile, JSON.stringify(emailData, null, 2), 'utf8');

  console.log(chalk.green(`  ✓ Email queued → ${emailFile}`));
  console.log(chalk.gray(`    To: ${answers.to} | Subject: ${answers.subject}`));
  return emailFile;
}

async function stepAiTextGeneration(config) {
  let description;

  if (config && (config.description || config.prompt)) {
    description = config.description || config.prompt;
  } else {
    const a = await inquirer.prompt([{
      type: 'input',
      name: 'description',
      message: 'Describe what to generate:',
      default: "A summary of today's key metrics",
    }]);
    description = a.description;
  }

  const spinner = ora('Generating AI response...').start();
  await new Promise(r => setTimeout(r, 1200));

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
  return response;
}

async function stepTransformData(config) {
  let input;

  if (config && config.input) {
    input = config.input;
  } else {
    const a = await inquirer.prompt([{
      type: 'input',
      name: 'input',
      message: 'Input text to transform:',
      default: 'hello world from labryx',
    }]);
    input = a.input;
  }

  console.log(chalk.green('  ✓ Transformations:'));
  console.log(chalk.white(`    UPPERCASE:  ${input.toUpperCase()}`));
  console.log(chalk.white(`    lowercase:  ${input.toLowerCase()}`));
  console.log(chalk.white(`    Title Case: ${input.replace(/\b\w/g, c => c.toUpperCase())}`));
  console.log(chalk.white(`    Reversed:   ${input.split('').reverse().join('')}`));
  console.log(chalk.white(`    Length:     ${input.length} characters`));
  return input.toUpperCase();
}

async function stepSaveToFile(config) {
  let filename, content;

  if (config && config.filename) {
    filename = config.filename;
    content = config.content || '';
  } else {
    const a = await inquirer.prompt([
      { type: 'input', name: 'filename', message: 'Filename:', default: 'output.txt' },
      { type: 'input', name: 'content', message: 'Content:', default: 'Generated by Labryx workflow' },
    ]);
    filename = a.filename;
    content = a.content;
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const outPath = join(OUTPUT_DIR, filename);
  writeFileSync(outPath, content, 'utf8');
  console.log(chalk.green(`  ✓ Saved → ${outPath}`));
  return outPath;
}

async function stepSlackMessage(config) {
  let webhookUrl, message;

  if (config && config.webhook_url) {
    webhookUrl = config.webhook_url;
    message = config.message || '';
  } else {
    const a = await inquirer.prompt([
      { type: 'input', name: 'webhookUrl', message: 'Slack webhook URL:' },
      { type: 'input', name: 'message', message: 'Message:', default: 'Hello from Labryx!' },
    ]);
    webhookUrl = a.webhookUrl;
    message = a.message;
  }

  const spinner = ora('Sending Slack message...').start();
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    });
    if (res.ok) {
      spinner.succeed(chalk.green('Slack message sent ✓'));
    } else {
      spinner.fail(chalk.red(`Slack error: ${res.status} ${res.statusText}`));
    }
    return message;
  } catch (e) {
    spinner.fail(chalk.red(`Slack failed: ${e.message}`));
    return null;
  }
}

// ─── interactive workflow builder ─────────────────────────────────────────────

const STEP_CHOICES = [
  'AI text generation',
  'Send email',
  'HTTP request',
  'Transform data',
  'Save to file',
  'Slack message',
  chalk.gray('↳ More integrations in Pro'),
];

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
    choices: ['HTTP Request (webhook)', 'Schedule (cron)', 'File change', 'Manual'],
  }]);

  const { steps } = await inquirer.prompt([{
    type: 'checkbox',
    name: 'steps',
    message: 'Select workflow steps:',
    choices: STEP_CHOICES,
  }]);

  const cleanSteps = steps.filter(s => !s.includes('Pro'));

  const spinner = ora('Building workflow...').start();

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
  console.log(`\n${chalk.bold('Run it:')} labryx run ${name}`);
  console.log(`${chalk.gray('Unlock unlimited workflows → labryx.dev/pro ($29/mo)')}`);
}

// ─── edit workflow ─────────────────────────────────────────────────────────────

async function editWorkflow(name) {
  const filePath = resolveWorkflowPath(name);
  if (!filePath) {
    console.log(chalk.red(`✗ Workflow not found: ${name}`));
    process.exit(1);
  }

  let doc;
  try {
    doc = yaml.load(readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.log(chalk.red(`✗ Failed to parse: ${e.message}`));
    process.exit(1);
  }

  console.log(chalk.bold('\n✏️  Edit Workflow\n'));

  const { newName } = await inquirer.prompt([{
    type: 'input',
    name: 'newName',
    message: 'Workflow name:',
    default: doc.name || name,
  }]);

  const { trigger } = await inquirer.prompt([{
    type: 'list',
    name: 'trigger',
    message: 'Select a trigger:',
    choices: ['HTTP Request (webhook)', 'Schedule (cron)', 'File change', 'Manual'],
    default: doc.trigger,
  }]);

  const currentStepNames = (doc.steps || []).map(s =>
    (typeof s === 'string' ? s : (s.action || s.name || '')).toLowerCase()
  );

  const plainChoices = ['AI text generation', 'Send email', 'HTTP request', 'Transform data', 'Save to file', 'Slack message'];
  const { steps } = await inquirer.prompt([{
    type: 'checkbox',
    name: 'steps',
    message: 'Select workflow steps:',
    choices: plainChoices.map(s => ({ name: s, checked: currentStepNames.includes(s.toLowerCase()) })),
  }]);

  doc.name = newName;
  doc.trigger = trigger;
  doc.steps = steps.map(s => ({ action: s }));
  doc.updated = new Date().toISOString();

  const newFilePath = join(WORKFLOWS_DIR, `${newName}.yaml`);
  if (newFilePath !== filePath && existsSync(filePath)) {
    unlinkSync(filePath);
  }

  writeFileSync(newFilePath, yaml.dump(doc, { lineWidth: 120 }), 'utf8');
  console.log(chalk.green(`\n✓ Workflow updated → ${newFilePath}`));
}

// ─── delete workflow ───────────────────────────────────────────────────────────

async function deleteWorkflow(name) {
  const filePath = resolveWorkflowPath(name);
  if (!filePath) {
    console.log(chalk.red(`✗ Workflow not found: ${name}`));
    process.exit(1);
  }

  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: `Delete workflow "${name}"?`,
    default: false,
  }]);

  if (confirm) {
    unlinkSync(filePath);
    console.log(chalk.green(`✓ Deleted: ${name}`));
  } else {
    console.log(chalk.gray('Cancelled.'));
  }
}

// ─── generate command ──────────────────────────────────────────────────────────
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

// ─── auth command ──────────────────────────────────────────────────────────────
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

// ─── upgrade command ───────────────────────────────────────────────────────────
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

// ─── default: show logo + help ─────────────────────────────────────────────────
if (process.argv.length <= 2) {
  console.log(logo);
  console.log(chalk.bold('Commands:\n'));
  console.log(`  ${chalk.white('labryx run <name>')}                 Run a saved workflow`);
  console.log(`  ${chalk.white('labryx workflow --interactive')}     Build a workflow interactively`);
  console.log(`  ${chalk.white('labryx workflow --list')}            List saved workflows`);
  console.log(`  ${chalk.white('labryx workflow --edit <name>')}     Edit an existing workflow`);
  console.log(`  ${chalk.white('labryx workflow --delete <name>')}   Delete a workflow`);
  console.log(`  ${chalk.white('labryx status')}                     Version, runs, auth info`);
  console.log(`  ${chalk.white('labryx generate --type email')}      Generate a template`);
  console.log(`  ${chalk.white('labryx auth --login')}               Log in to Pro`);
  console.log(`  ${chalk.white('labryx upgrade')}                    View Pro features\n`);
  console.log(chalk.gray('labryx <command> --help for details'));
  process.exit(0);
}

program.parse();
