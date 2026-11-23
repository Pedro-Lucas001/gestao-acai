import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  writeFile,
  mkdir,
  rm,
  stat,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configure, readSettings, composeArgs, verify } from "./local.mjs";

async function temporary(work) {
  const directory = await mkdtemp(join(tmpdir(), "netuno-setup-"));
  try {
    await work(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
test("creates a private local login once, preserves it on rerun, and keeps Docker credentials consistent", async () =>
  temporary(async (directory) => {
    const first = await configure(directory);
    assert.equal(first.username, "admin");
    assert.ok(first.password.length >= 24);
    assert.notEqual(first.password, first.apiToken);
    const saved = await readFile(
      join(directory, ".local/settings.json"),
      "utf8",
    );
    assert.deepEqual(await configure(directory), first);
    assert.equal(
      await readFile(join(directory, ".local/settings.json"), "utf8"),
      saved,
    );
    const env = await readFile(join(directory, ".local/compose.env"), "utf8");
    assert.ok(env.includes(`ADMIN_PASSWORD=${first.password}\n`));
    assert.ok(env.includes(`POSTGRES_PASSWORD=${first.databasePassword}\n`));
    assert.ok(env.includes(`ADMIN_API_TOKEN=${first.apiToken}\n`));
    if (process.platform !== "win32") {
      assert.equal(
        (await stat(join(directory, ".local/settings.json"))).mode & 0o777,
        0o600,
      );
      assert.equal(
        (await stat(join(directory, ".local/compose.env"))).mode & 0o777,
        0o600,
      );
    }
  }));
test("different installations receive different credentials", async () =>
  temporary(async (a) =>
    temporary(async (b) => {
      const one = await configure(a),
        two = await configure(b);
      assert.notEqual(one.password, two.password);
      assert.notEqual(one.databasePassword, two.databasePassword);
      assert.notEqual(one.apiToken, two.apiToken);
    }),
  ));
test("refuses to replace malformed settings and does not include file contents in its error", async () =>
  temporary(async (directory) => {
    await mkdir(join(directory, ".local"));
    const content = "private-password-should-not-be-in-logs";
    await writeFile(join(directory, ".local/settings.json"), content);
    await assert.rejects(
      configure(directory),
      (error) =>
        !error.message.includes(content) &&
        error.message.includes("JSON válido"),
    );
    assert.equal(
      await readFile(join(directory, ".local/settings.json"), "utf8"),
      content,
    );
  }));
test("does not silently replace a missing password when a Docker environment already exists", async () =>
  temporary(async (directory) => {
    await mkdir(join(directory, ".local"));
    const path = join(directory, ".local/compose.env");
    await writeFile(path, "POSTGRES_PASSWORD=existing-local-password\n");
    await assert.rejects(configure(directory), /Restaure o arquivo/);
    assert.equal(
      await readFile(path, "utf8"),
      "POSTGRES_PASSWORD=existing-local-password\n",
    );
  }));
test("missing settings point to the initial setup command", async () =>
  temporary(async (directory) => {
    await assert.rejects(readSettings(directory), /npm run setup primeiro/);
  }));
test("Docker commands explicitly use the private local env file", () => {
  assert.deepEqual(composeArgs(["stop"]), [
    "compose",
    "--env-file",
    ".local/compose.env",
    "-f",
    "compose.local.yaml",
    "stop",
  ]);
});
test("access verification refuses a server that leaves protected data open", async () => {
  await assert.rejects(
    verify(
      { username: "admin", password: "local" },
      async () => new Response("[]", { status: 200 }),
    ),
    /sem autenticação/,
  );
});
test("access verification checks wrong password and then real credentials without creating business records", async () => {
  const settings = { username: "admin", password: "local-test-password" };
  const calls = [];
  await verify(settings, async (url, options) => {
    const path = new URL(url).pathname.slice(4);
    calls.push({ path, method: options.method ?? "GET" });
    if (path === "/auth/login") {
      const body = JSON.parse(options.body);
      return body.password === settings.password
        ? Response.json({ accessToken: "test-session" })
        : new Response("{}", { status: 401 });
    }
    if (!options.headers?.Authorization)
      return new Response("{}", { status: 401 });
    assert.equal(options.headers.Authorization, "Bearer test-session");
    return Response.json(
      ["/fixed-costs", "/dashboard"].includes(path) ? {} : [],
    );
  });
  assert.equal(calls.filter((x) => x.path === "/auth/login").length, 2);
  assert.ok(calls.every((x) => x.method === "GET" || x.path === "/auth/login"));
});
