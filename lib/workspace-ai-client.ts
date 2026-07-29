/**
 * Leverandør-spesifikke chat-kall for workspace-KI.
 * Brukes fra Convex Node-actions (fetch).
 */

import type { WorkspaceAiProviderId } from "./ros-ai-models";

export type AiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return trimmed;
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) return fence[1].trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

async function callOpenAiCompatible(opts: {
  baseUrl: string;
  token: string;
  model: string;
  messages: AiChatMessage[];
  temperature: number;
  jsonMode: boolean;
}): Promise<string> {
  const url = `${opts.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      temperature: opts.temperature,
      ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
      messages: opts.messages,
    }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `AI-kall feilet (${response.status}): ${errText.slice(0, 280)}`,
    );
  }
  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic(opts: {
  token: string;
  model: string;
  messages: AiChatMessage[];
  temperature: number;
}): Promise<string> {
  const system = opts.messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const anthropicMessages = opts.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    }));

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": opts.token,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: 4096,
      temperature: opts.temperature,
      ...(system ? { system } : {}),
      messages: anthropicMessages,
    }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `Claude-kall feilet (${response.status}): ${errText.slice(0, 280)}`,
    );
  }
  const json = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  return (json.content ?? [])
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text!)
    .join("\n");
}

async function callGoogleGemini(opts: {
  token: string;
  model: string;
  messages: AiChatMessage[];
  temperature: number;
}): Promise<string> {
  const system = opts.messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const contents = opts.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(opts.model)}:generateContent` +
    `?key=${encodeURIComponent(opts.token)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(system
        ? { systemInstruction: { parts: [{ text: system }] } }
        : {}),
      contents,
      generationConfig: {
        temperature: opts.temperature,
        responseMimeType: "application/json",
      },
    }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `Gemini-kall feilet (${response.status}): ${errText.slice(0, 280)}`,
    );
  }
  const json = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  return (
    json.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("") ?? ""
  );
}

export async function workspaceAiChatJson(opts: {
  provider: WorkspaceAiProviderId;
  token: string;
  model: string;
  baseUrl?: string;
  messages: AiChatMessage[];
  temperature?: number;
}): Promise<unknown> {
  const temperature = opts.temperature ?? 0.3;
  let raw = "";

  if (opts.provider === "anthropic") {
    raw = await callAnthropic({
      token: opts.token,
      model: opts.model,
      messages: opts.messages,
      temperature,
    });
  } else if (opts.provider === "google") {
    raw = await callGoogleGemini({
      token: opts.token,
      model: opts.model,
      messages: opts.messages,
      temperature,
    });
  } else {
    const baseUrl =
      opts.provider === "openai_compatible" && opts.baseUrl
        ? opts.baseUrl
        : "https://api.openai.com/v1";
    raw = await callOpenAiCompatible({
      baseUrl,
      token: opts.token,
      model: opts.model,
      messages: opts.messages,
      temperature,
      jsonMode: true,
    });
  }

  const jsonText = extractJsonObject(raw);
  try {
    return JSON.parse(jsonText);
  } catch {
    throw new Error("AI returnerte ugyldig JSON. Prøv igjen.");
  }
}
