import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";

// Set these in Vercel. Only API_KEY is required.
//   API_KEY   the key for your provider
//   API_TYPE  anthropic-messages (default), openai-chat-completions or openai-responses
//   BASE_URL  the provider's address, if it is not Anthropic or OpenAI itself
//   MODEL     the model ID. Set this for any provider that does not offer the default.
const DEFAULT_MODEL = "claude-haiku-5-5";
const DEFAULT_OPENAI_URL = "https://api.openai.com/v1";
const MAX_MESSAGE_LENGTH = 2000;
const MAX_REPLY_LENGTH = 8000;
const MAX_MESSAGES = 20;
const MAX_TOKENS = 1024;
const REFUSAL = "The guide can't help with that one. Try a question about the printing press.";

const systemPrompt = readFileSync(new URL("./system-prompt.txt", import.meta.url), "utf8");

function fail(status, error) {
  return Response.json({ error }, { status });
}

function isValid(message) {
  const limit = message?.role === "assistant" ? MAX_REPLY_LENGTH : MAX_MESSAGE_LENGTH;
  return (
    (message?.role === "user" || message?.role === "assistant") &&
    typeof message.content === "string" &&
    message.content.trim().length > 0 &&
    message.content.length <= limit
  );
}

function model() {
  return process.env.MODEL || DEFAULT_MODEL;
}

function baseURL() {
  return process.env.BASE_URL?.replace(/\/+$/, "");
}

async function askAnthropic(messages) {
  // The SDK adds /v1 itself, so a BASE_URL ending in /v1 would double it.
  const client = new Anthropic({
    apiKey: process.env.API_KEY,
    baseURL: baseURL()?.replace(/\/v1$/, ""),
  });
  const response = await client.messages.create({
    model: model(),
    max_tokens: MAX_TOKENS,
    output_config: { effort: "low" },
    system: systemPrompt,
    messages,
  });

  if (response.stop_reason === "refusal") return { refused: true };

  const reply = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
  return { reply };
}

async function postToOpenAI(path, body) {
  const response = await fetch(`${baseURL() || DEFAULT_OPENAI_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = new Error(`${path} returned ${response.status}: ${await response.text()}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

async function askChatCompletions(messages) {
  // OpenAI's newer models reject max_tokens, but many compatible providers only know max_tokens.
  const isOpenAI = !baseURL() || baseURL().includes("api.openai.com");
  const data = await postToOpenAI("/chat/completions", {
    model: model(),
    [isOpenAI ? "max_completion_tokens" : "max_tokens"]: MAX_TOKENS,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
  });

  const choice = data.choices?.[0];
  if (choice?.message?.refusal || choice?.finish_reason === "content_filter") return { refused: true };
  return { reply: choice?.message?.content ?? "" };
}

async function askResponses(messages) {
  const data = await postToOpenAI("/responses", {
    model: model(),
    max_output_tokens: MAX_TOKENS,
    instructions: systemPrompt,
    input: messages,
    store: false,
  });

  const parts = (data.output ?? [])
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content);
  if (parts.some((part) => part.type === "refusal")) return { refused: true };

  const reply = parts
    .filter((part) => part.type === "output_text")
    .map((part) => part.text)
    .join("\n");
  return { reply };
}

const providers = {
  "anthropic-messages": askAnthropic,
  "openai-chat-completions": askChatCompletions,
  "openai-responses": askResponses,
};

export async function POST(request) {
  let messages;
  try {
    ({ messages } = await request.json());
  } catch {
    return fail(400, "That message could not be read. Send it again.");
  }

  if (!Array.isArray(messages) || messages.length === 0 || messages[0]?.role !== "user") {
    return fail(400, "That message could not be read. Send it again.");
  }
  if (!messages.every(isValid)) {
    return fail(400, `Keep each message under ${MAX_MESSAGE_LENGTH} characters.`);
  }

  // Claude needs the conversation to start with the visitor, so cutting it must not leave a reply first.
  const recent = messages.slice(-MAX_MESSAGES);
  if (recent[0].role === "assistant") recent.shift();

  const apiType = process.env.API_TYPE || "anthropic-messages";
  const ask = providers[apiType];
  if (!ask) {
    console.error(`Unknown API_TYPE "${apiType}". Use one of: ${Object.keys(providers).join(", ")}`);
    return fail(500, "The guide is not working right now. Try again later.");
  }

  try {
    const { reply, refused } = await ask(recent);
    if (refused) return Response.json({ reply: REFUSAL });
    if (!reply?.trim()) return fail(500, "The guide sent an empty reply. Send your message again.");
    return Response.json({ reply });
  } catch (error) {
    console.error(error);
    if (error.status === 429) {
      return fail(429, "The guide has too many visitors right now. Wait a moment, then send your message again.");
    }
    return fail(500, "The guide is not working right now. Try again later.");
  }
}
