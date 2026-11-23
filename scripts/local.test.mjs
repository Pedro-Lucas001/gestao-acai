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
test("creates only a private database password and preserves it on rerun", async () =>
  temporary(async (directory) => {
    const first = await configure(directory);
    assert.deepEqual(Object.keys(first), ["databasePassword"]);
    assert.ok(first.databasePassword.length >= 24);
    const saved = await readFile(
      join(directory, ".local/settings.json"),
      "utf8",
    );
    assert.deepEqual(await configure(directory), first);
    assert.equal(
      await readFile(join(directory, ".local/settings.json"), "utf8"),
      saved,
    );
    assert.equal(
      await readFile(join(directory, ".local/compose.env"), "utf8"),
      `POSTGRES_PASSWORD=${first.databasePassword}\n`,
    );
    if (process.platform !== "win32")
      for (const name of ["settings.json", "compose.env"]) {
        assert.equal(
          (await stat(join(directory, ".local", name))).mode & 0o777,
          0o600,
        );
      }
  }));
test("upgrade removes application credentials while preserving the existing PostgreSQL password", async () =>
  temporary(async (directory) => {
    await mkdir(join(directory, ".local"));
    const databasePassword = "existing-database-password-123456";
    await writeFile(
      join(directory, ".local/settings.json"),
      JSON.stringify({
        username: "admin",
        password: "obsolete-login-password",
        apiToken: "obsolete-token",
        databasePassword,
      }),
    );
    await writeFile(
      join(directory, ".local/compose.env"),
      "POSTGRES_PASSWORD=" +
        databasePassword +
        "\nADMIN_PASSWORD=obsolete-login-password\n",
    );
    assert.deepEqual(await configure(directory), { databasePassword });
    assert.deepEqual(
      JSON.parse(
        await readFile(join(directory, ".local/settings.json"), "utf8"),
      ),
      { databasePassword },
    );
    assert.equal(
      await readFile(join(directory, ".local/compose.env"), "utf8"),
      `POSTGRES_PASSWORD=${databasePassword}\n`,
    );
  }));
test("different installations receive different database passwords", async () =>
  temporary(async (a) =>
    temporary(async (b) => {
      assert.notEqual(
        (await configure(a)).databasePassword,
        (await configure(b)).databasePassword,
      );
    }),
  ));
test("refuses to replace malformed settings and keeps file contents out of errors", async () =>
  temporary(async (directory) => {
    await mkdir(join(directory, ".local"));
    const content = "private-password-should-not-be-in-logs";
    await writeFile(join(directory, ".local/settings.json"), content);
    await assert.rejects(
      configure(directory),
      (e) => !e.message.includes(content) && e.message.includes("JSON válido"),
    );
    assert.equal(
      await readFile(join(directory, ".local/settings.json"), "utf8"),
      content,
    );
  }));
test("missing settings never silently rotate an existing Docker database password", async () =>
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
test("Docker commands explicitly use the private local database environment", () => {
  assert.deepEqual(composeArgs(["stop"]), [
    "compose",
    "--env-file",
    ".local/compose.env",
    "-f",
    "compose.local.yaml",
    "stop",
  ]);
});
test("verification reads data without a login, credentials, or business writes", async () => {
  const calls = [];
  await verify(async (url, options) => {
    const path = new URL(url).pathname.slice(4);
    calls.push(path);
    assert.equal(options.method, undefined);
    assert.equal(options.headers, undefined);
    return Response.json(
      ["/fixed-costs", "/dashboard"].includes(path) ? {} : [],
    );
  });
  assert.deepEqual(calls, [
    "/ingredients",
    "/products",
    "/sales",
    "/expenses",
    "/fixed-costs",
    "/dashboard",
  ]);
});
test("verification reports an obsolete API still requiring authentication", async () => {
  await assert.rejects(
    verify(async () => new Response("{}", { status: 401 })),
    /401/,
  );
});
