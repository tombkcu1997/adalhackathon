# Ticket Dashboard (AI Smart Scheduler)

A lightweight ticket dashboard where you can paste natural-language tasks and let AI suggest deadlines, priority, and reminders.

## Features
- Manual ticket creation (title, description, due date, reminder, priority)
- AI Smart Planner:
  - Paste a messy task list
  - Click **Suggest Schedule with AI**
  - Get tickets with suggested due dates, priority, and reminders
- Priority badges (high / medium / low)
- Open-ticket dashboard sorted by due date
- Mark done / delete
- Browser reminder notifications (with alert fallback)
- Local persistence with `localStorage`

## Project Structure
- `index.html` — app UI
- `styles.css` — dashboard styles
- `app.js` — frontend logic
- `api/schedule.js` — serverless API route for LLM scheduling
- `.env.example` — environment variable template

## Run Locally
Because AI scheduling needs a backend endpoint, use a local dev server that supports API routes (recommended: Vercel CLI).

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. In this folder, set env vars (PowerShell example):
   ```powershell
   $env:OPENAI_API_KEY="your_key_here"
   $env:OPENAI_MODEL="gpt-4o-mini"
   ```

3. Start local dev:
   ```bash
   vercel dev
   ```

4. Open the local URL shown by Vercel CLI.

## Deploy to Vercel (Recommended)
1. Push this project to GitHub.
2. In Vercel: **Add New Project** → import your GitHub repo.
3. In Vercel project settings, add environment variables:
   - `OPENAI_API_KEY` (required)
   - `OPENAI_MODEL` (optional, default: `gpt-4o-mini`)
4. Deploy.

After deploy, your frontend calls `/api/schedule` automatically.

## Notes
- API key stays server-side (never exposed in browser JS).
- If the AI returns malformed data, the app uses safe defaults for due date/priority/reminders.