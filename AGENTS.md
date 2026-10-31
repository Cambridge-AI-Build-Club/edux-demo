# Project rules

You are helping a beginner build a personal website. After each step, explain what you did in plain English.

## Stack

- Plain HTML, CSS and JavaScript. No framework and no build step.
- The site must work when deployed to Vercel from the repository root.
- Keep the page in `index.html`. Do not add a dependency unless these rules ask for it.

## Working style

- Before changing code, share a short plan and wait for approval.
- Make small changes and tell me how to check each one.
- Use the words in `content.md`. Do not invent facts about me.

## Preview

- In a Codespace, the site is already served on port 3000. Do not start another server.
- After a change, tell me to refresh the "Your website" preview.
- The chat box only works on the deployed Vercel site, not in the preview.

## AI feature

- The server code goes in `api/chat.js`, a Vercel Function using `export async function POST(request)`.
- Return JSON from the function using `Response.json(...)`.
- The function reads `API_KEY`, `API_TYPE`, `BASE_URL` and `MODEL` from the environment. Never hard-code them.
- `API_TYPE` is `anthropic-messages` (the default), `openai-chat-completions` or `openai-responses`.
- For `anthropic-messages`, use the official `@anthropic-ai/sdk` package. It is already in `package.json`, so do not change its version. For the OpenAI types, use `fetch`, so no other package is needed.
- The default model is `claude-haiku-5-5`. Change it with `MODEL`, not in the code.
- Limit replies to 1024 tokens. For `anthropic-messages`, also set `output_config` to `{ effort: "low" }`.
- Do not send `temperature`, `top_p`, `top_k` or `thinking`.
- Read only the text from a reply, because the first block may not be text.
- Keep the system prompt in `api/system-prompt.txt` so I can edit it.
- Load it with `readFileSync(new URL("./system-prompt.txt", import.meta.url), "utf8")`.
- The chat must remember the conversation. The browser sends `{ messages: [...] }` with every `user` and `assistant` turn, and the function passes the latest 20 to Claude.
- Reject any message longer than 2000 characters.
- Show visitors a friendly message when something goes wrong.

## Safety

- Never put an API key in HTML, JavaScript, Markdown or any committed file.
- If I paste a key into chat, tell me not to and do not use it.
- This site is public. Never add personal contact details that are not in `content.md`.
