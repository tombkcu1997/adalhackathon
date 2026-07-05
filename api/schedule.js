module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "OPENAI_API_KEY is not configured." });
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const body = req.body || {};
  const text = String(body.text || "").trim();
  const timezone = String(body.timezone || "UTC");
  const nowIso = String(body.nowIso || new Date().toISOString());

  if (!text) {
    return res.status(400).json({ error: "text is required." });
  }

  const systemPrompt = [
    "You are a task scheduling assistant.",
    "Return ONLY valid JSON with this shape:",
    "{",
    '  "tasks": [',
    "    {",
    '      "title": "string",',
    '      "description": "string",',
    '      "dueAt": "ISO-8601 datetime string",',
    '      "priority": "low|medium|high",',
    '      "remindBeforeMins": 10',
    "    }",
    "  ]",
    "}",
    "Rules:",
    "- Break the user's text into actionable tasks.",
    "- Choose realistic dueAt times based on urgency.",
    "- dueAt must be in the future relative to nowIso.",
    "- Keep tasks concise and practical.",
    "- Use integers for remindBeforeMins between 0 and 10080."
  ].join("\n");

  const userPrompt = JSON.stringify({
    nowIso,
    timezone,
    request: text
  });

  try {
    const llmResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    });

    if (!llmResponse.ok) {
      const errorText = await llmResponse.text();
      return res.status(502).json({ error: `LLM request failed: ${errorText}` });
    }

    const completion = await llmResponse.json();
    const content = completion?.choices?.[0]?.message?.content;
    if (!content) {
      return res.status(502).json({ error: "LLM response was empty." });
    }

    const parsed = extractJson(content);
    if (!parsed || !Array.isArray(parsed.tasks)) {
      return res.status(502).json({ error: "Could not parse valid JSON tasks from LLM response." });
    }

    const tasks = parsed.tasks
      .slice(0, 20)
      .map((task) => normalizeTask(task))
      .filter(Boolean);

    return res.status(200).json({ tasks });
  } catch (error) {
    return res.status(500).json({ error: `Server error: ${error.message}` });
  }
};

function extractJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    // Try extracting the first JSON object from mixed text.
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    const candidate = text.slice(start, end + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      return null;
    }
  }
}

function normalizeTask(task) {
  if (!task || typeof task !== "object") return null;

  const title = String(task.title || "").trim();
  if (!title) return null;

  const description = String(task.description || "").trim();
  const priority = normalizePriority(task.priority);
  const remindBeforeMins = normalizeReminder(task.remindBeforeMins, priority);
  const dueAt = normalizeDueAt(task.dueAt);

  return {
    title,
    description,
    dueAt,
    priority,
    remindBeforeMins
  };
}

function normalizePriority(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "high" || normalized === "medium" || normalized === "low") {
    return normalized;
  }
  return "medium";
}

function normalizeReminder(value, priority) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 0) {
    return Math.min(Math.round(numeric), 10080);
  }

  if (priority === "high") return 30;
  if (priority === "low") return 5;
  return 10;
}

function normalizeDueAt(value) {
  const parsed = new Date(value).getTime();
  if (!Number.isNaN(parsed) && parsed > Date.now()) {
    return new Date(parsed).toISOString();
  }

  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
}