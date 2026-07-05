const STORAGE_KEY = "ticket_dashboard_v1";
const reminderTimers = new Map();

const form = document.getElementById("ticket-form");
const ticketList = document.getElementById("ticket-list");
const emptyState = document.getElementById("empty-state");
const enableNotificationsBtn = document.getElementById("enable-notifications");
const suggestScheduleBtn = document.getElementById("suggest-schedule");
const quickInput = document.getElementById("quick-input");

let tickets = loadTickets();
render();

enableNotificationsBtn.addEventListener("click", async () => {
  if (!("Notification" in window)) {
    alert("This browser does not support notifications.");
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    alert("Notifications enabled!");
  } else {
    alert("Notification permission was not granted.");
  }
});

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const ticket = buildTicketFromForm();
  if (!ticket) return;

  tickets.push(ticket);
  persistTickets();
  form.reset();
  document.getElementById("remindBeforeMins").value = "10";
  document.getElementById("priority").value = "medium";
  render();
});

suggestScheduleBtn.addEventListener("click", async () => {
  const text = String(quickInput.value || "").trim();
  if (!text) {
    alert("Please enter your task list first.");
    return;
  }

  suggestScheduleBtn.disabled = true;
  const originalLabel = suggestScheduleBtn.textContent;
  suggestScheduleBtn.textContent = "Thinking...";

  try {
    const response = await fetch("/api/schedule", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        nowIso: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const errorPayload = await safeJson(response);
      const message = errorPayload?.error || `Request failed (${response.status})`;
      throw new Error(message);
    }

    const payload = await response.json();
    const suggestedTickets = Array.isArray(payload.tasks) ? payload.tasks : [];
    if (suggestedTickets.length === 0) {
      alert("AI did not return any tasks. Try adding more detail.");
      return;
    }

    const created = suggestedTickets
      .map((task, index) => buildTicketFromSuggestion(task, index))
      .filter(Boolean);

    if (created.length === 0) {
      alert("Could not parse valid tasks from AI response.");
      return;
    }

    tickets.push(...created);
    persistTickets();
    render();

    quickInput.value = "";
    alert(`Added ${created.length} AI-scheduled ticket(s).`);
  } catch (error) {
    alert(`Could not suggest schedule: ${error.message}`);
  } finally {
    suggestScheduleBtn.disabled = false;
    suggestScheduleBtn.textContent = originalLabel;
  }
});

function createId() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function loadTickets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && item.id && item.title && item.dueAt && item.status)
      .map((item) => ({
        ...item,
        priority: normalizePriority(item.priority),
      }));
  } catch {
    return [];
  }
}

function persistTickets() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
}

function render() {
  reminderTimers.forEach((timeoutId) => clearTimeout(timeoutId));
  reminderTimers.clear();

  ticketList.innerHTML = "";

  const openTickets = tickets
    .filter((ticket) => ticket.status === "open")
    .sort((a, b) => a.dueAt - b.dueAt);

  emptyState.style.display = openTickets.length === 0 ? "block" : "none";

  openTickets.forEach((ticket) => {
    const card = document.createElement("li");
    card.className = "ticket-card";

    const header = document.createElement("div");
    header.className = "ticket-header";

    const title = document.createElement("h3");
    title.textContent = ticket.title;

    const priority = document.createElement("span");
    priority.className = `priority-badge priority-${normalizePriority(ticket.priority)}`;
    priority.textContent = normalizePriority(ticket.priority).toUpperCase();

    header.append(title, priority);

    const description = document.createElement("p");
    description.className = "meta";
    description.textContent = ticket.description || "No description";

    const due = document.createElement("p");
    due.className = "meta";
    due.textContent = `Due: ${formatDate(ticket.dueAt)}`;

    const reminder = document.createElement("p");
    reminder.className = "meta";
    reminder.textContent = `Reminder: ${ticket.remindBeforeMins} minute(s) before`;

    const actions = document.createElement("div");
    actions.className = "ticket-actions";

    const doneBtn = document.createElement("button");
    doneBtn.type = "button";
    doneBtn.textContent = "Mark Done";
    doneBtn.addEventListener("click", () => markDone(ticket.id));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "danger";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => deleteTicket(ticket.id));

    actions.append(doneBtn, deleteBtn);
    card.append(header, description, due, reminder, actions);
    ticketList.appendChild(card);

    scheduleReminder(ticket);
  });
}

function markDone(ticketId) {
  const target = tickets.find((ticket) => ticket.id === ticketId);
  if (!target) return;

  target.status = "done";
  persistTickets();
  render();
}

function deleteTicket(ticketId) {
  tickets = tickets.filter((ticket) => ticket.id !== ticketId);
  persistTickets();
  render();
}

function scheduleReminder(ticket) {
  if (ticket.reminderSentAt) return;
  if (!("Notification" in window)) return;

  const reminderTime = ticket.dueAt - ticket.remindBeforeMins * 60 * 1000;
  const delayMs = reminderTime - Date.now();

  if (delayMs <= 0) {
    sendReminder(ticket);
    return;
  }

  const timeoutId = setTimeout(() => sendReminder(ticket), delayMs);
  reminderTimers.set(ticket.id, timeoutId);
}

function sendReminder(ticket) {
  if (ticket.reminderSentAt) return;

  const target = tickets.find((item) => item.id === ticket.id);
  if (!target || target.status !== "open") return;

  const message = `Ticket due at ${formatDate(target.dueAt)}`;
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(target.title, { body: message });
  } else {
    alert(`Reminder: ${target.title}\n${message}`);
  }

  target.reminderSentAt = Date.now();
  persistTickets();
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString();
}

function buildTicketFromForm() {
  const formData = new FormData(form);
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const dueAtInput = String(formData.get("dueAt") || "").trim();
  const remindBeforeMins = Number(formData.get("remindBeforeMins"));
  const priority = normalizePriority(formData.get("priority"));

  if (!title || !dueAtInput || Number.isNaN(remindBeforeMins) || remindBeforeMins < 0) {
    alert("Please fill out title, due date, and a valid reminder value.");
    return null;
  }

  const dueAt = new Date(dueAtInput).getTime();
  if (Number.isNaN(dueAt)) {
    alert("Invalid due date.");
    return null;
  }

  return {
    id: createId(),
    title,
    description,
    dueAt,
    remindBeforeMins: clampReminderMinutes(remindBeforeMins),
    priority,
    status: "open",
    reminderSentAt: null,
    createdAt: Date.now(),
  };
}

function buildTicketFromSuggestion(task, index) {
  const title = String(task?.title || "").trim();
  if (!title) return null;

  const description = String(task?.description || "").trim();
  const dueAt = parseDueAt(task?.dueAt, index);
  const priority = normalizePriority(task?.priority);
  const remindBeforeMins = clampReminderMinutes(
    Number.isFinite(Number(task?.remindBeforeMins))
      ? Number(task?.remindBeforeMins)
      : defaultReminderForPriority(priority)
  );

  return {
    id: createId(),
    title,
    description,
    dueAt,
    remindBeforeMins,
    priority,
    status: "open",
    reminderSentAt: null,
    createdAt: Date.now(),
  };
}

function parseDueAt(rawDueAt, index) {
  const parsed = new Date(rawDueAt).getTime();
  if (!Number.isNaN(parsed) && parsed > Date.now()) return parsed;
  return Date.now() + (index + 1) * 24 * 60 * 60 * 1000;
}

function normalizePriority(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "high" || normalized === "medium" || normalized === "low") return normalized;
  return "medium";
}

function clampReminderMinutes(value) {
  if (!Number.isFinite(value) || value < 0) return 10;
  return Math.min(Math.round(value), 10080);
}

function defaultReminderForPriority(priority) {
  if (priority === "high") return 30;
  if (priority === "low") return 5;
  return 10;
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}