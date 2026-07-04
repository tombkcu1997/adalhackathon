const STORAGE_KEY = "ticket_dashboard_v1";
const reminderTimers = new Map();

const form = document.getElementById("ticket-form");
const ticketList = document.getElementById("ticket-list");
const emptyState = document.getElementById("empty-state");
const enableNotificationsBtn = document.getElementById("enable-notifications");

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

  const formData = new FormData(form);
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const dueAtInput = String(formData.get("dueAt") || "").trim();
  const remindBeforeMins = Number(formData.get("remindBeforeMins"));

  if (!title || !dueAtInput || Number.isNaN(remindBeforeMins) || remindBeforeMins < 0) {
    alert("Please fill out title, due date, and a valid reminder value.");
    return;
  }

  const dueAt = new Date(dueAtInput).getTime();
  if (Number.isNaN(dueAt)) {
    alert("Invalid due date.");
    return;
  }

  const ticket = {
    id: createId(),
    title,
    description,
    dueAt,
    remindBeforeMins,
    status: "open",
    reminderSentAt: null,
    createdAt: Date.now(),
  };

  tickets.push(ticket);
  persistTickets();
  form.reset();
  document.getElementById("remindBeforeMins").value = "10";
  render();
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
    return parsed.filter((item) => item && item.id && item.title && item.dueAt && item.status);
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

    const title = document.createElement("h3");
    title.textContent = ticket.title;

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
    card.append(title, description, due, reminder, actions);
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
  if (Notification.permission === "granted") {
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