import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("index.html", "utf8");

test("the page has one main heading", () => {
  assert.equal(page.match(/<h1[ >]/g)?.length, 1);
});

test("the page has a title and a description", () => {
  assert.match(page, /<title>[^<]+<\/title>/);
  assert.match(page, /<meta name="description" content="[^"]+"/);
});

test("the page works on a phone", () => {
  assert.match(page, /<meta name="viewport"/);
});

test("the page says Ada is fictional", () => {
  assert.match(page, /fictional/);
});

test("the chat box has a label", () => {
  assert.match(page, /<label for="chat-input">/);
  assert.match(page, /<textarea id="chat-input"/);
});

test("the guide has a system prompt", () => {
  assert.match(readFileSync("api/system-prompt.txt", "utf8"), /Socratic guide/);
});

test("the site contains no API key", () => {
  for (const file of ["index.html", "api/chat.js", "api/system-prompt.txt"]) {
    assert.doesNotMatch(readFileSync(file, "utf8"), /sk-ant-/, file);
  }
});
