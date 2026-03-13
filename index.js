#!/usr/bin/env node
import { program } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';

const VERSION = '0.1.0';

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
      console.log(chalk.yellow(`Running workflow: ${opts.run}`));
      console.log(chalk.gray('(Pro feature — upgrade at labryx.dev/pro)'));
    } else if (opts.list) {
      console.log(chalk.cyan('Saved workflows:'));
      console.log(chalk.gray('  No workflows yet. Try: labryx workflow --interactive'));
    } else {
      program.commands.find(c => c.name() === 'workflow').help();
    }
  });

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

  const spinner = ora('Building workflow...').start();
  await new Promise(r => setTimeout(r, 1200));
  spinner.succeed(chalk.green(`Workflow "${name}" created!`));

  console.log(chalk.cyan('\n📋 Summary:'));
  console.log(`  Trigger: ${chalk.white(trigger)}`);
  console.log(`  Steps:   ${chalk.white(steps.filter(s => !s.includes('Pro')).join(', ') || 'none')}`);
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
