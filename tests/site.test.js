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

test("the page contains no API key", () => {
  assert.doesNotMatch(page, /sk-ant-/);
});
