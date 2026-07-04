# Ticket Dashboard (Simple Starter)

A lightweight browser app for task tickets with reminder notifications.

## Features
- Create tickets with:
  - title
  - description
  - due date/time
  - reminder lead time (minutes)
- Dashboard list of open tickets (sorted by due date)
- Mark ticket as done
- Delete ticket
- Local persistence with `localStorage`
- Browser notification reminder (or alert fallback)

## Run
Because this app has no backend/dependencies, you can run it by opening `index.html` in a browser.

For best notification behavior:
1. Click **Enable Notifications**
2. Allow browser notification permission

## Notes
- Reminders are scheduled in-browser and work while the page is open.
- Data is stored in your browser local storage on this machine.