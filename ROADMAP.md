# Labryx Roadmap

## v0.1.0 — Shipped ✅
- Interactive workflow builder
- Template generation
- YAML workflow persistence
- Workflow execution engine (HTTP, email outbox, AI mock, file I/O)

## v0.2.0 — Next (target: March 20)
- [ ] Real HTTP integration — execute GET/POST requests with headers, auth
- [ ] Webhook trigger — local server that listens for incoming webhooks
- [ ] Workflow chaining — pass output from one step as input to next
- [ ] `labryx workflow --edit <name>` — edit existing workflows
- [ ] `labryx workflow --delete <name>` — delete workflows
- [ ] Better error messages and step retry logic

## v0.3.0 — Pro Foundation (target: March 27)
- [ ] `labryx auth --login` — real Pro account auth flow
- [ ] AI generation — connect to OpenAI API with user's key
- [ ] `labryx run --cloud` — submit workflow for cloud execution
- [ ] Slack step — send messages via webhook URL

## v1.0.0 — Full Pro (target: April)
- [ ] Cloud scheduler — cron-based cloud execution
- [ ] Team workspaces — share workflows
- [ ] Notion integration
- [ ] Airtable integration
- [ ] Webhook delivery — send results to endpoints
- [ ] Execution history and logs

## Revenue Milestones
- $0 → $1,000: First 35 Pro subscribers (focus: HN, PH, Dev.to)
- $1,000 → $10,000: Content marketing + word of mouth
- $10,000 → $100,000: Enterprise tier + team features
