import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
const MAX_MESSAGE_LENGTH = 2000;
const MAX_REPLY_LENGTH = 8000;
const MAX_MESSAGES = 20;

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

  try {
    // Reads ANTHROPIC_API_KEY and ANTHROPIC_BASE_URL from the environment.
    const client = new Anthropic();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      output_config: { effort: "low" },
      system: systemPrompt,
      messages: recent,
    });

    if (response.stop_reason === "refusal") {
      return Response.json({ reply: "The guide can't help with that one. Try a question about the printing press." });
    }

    const reply = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    if (!reply.trim()) return fail(500, "The guide sent an empty reply. Send your message again.");

    return Response.json({ reply });
  } catch (error) {
    console.error(error);
    if (error instanceof Anthropic.RateLimitError) {
      return fail(429, "The guide has too many visitors right now. Wait a moment, then send your message again.");
    }
    return fail(500, "The guide is not working right now. Try again later.");
  }
}
