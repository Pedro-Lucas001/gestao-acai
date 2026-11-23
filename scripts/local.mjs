import { randomBytes } from "node:crypto";
import {
  readFile,
  writeFile,
  mkdir,
  chmod,
  access,
  constants,
} from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const jsonFile = ".local/settings.json";
const envFile = ".local/compose.env";
const composeFile = "compose.local.yaml";
const apiBase = "http://127.0.0.1:7071/api";

export function validateSettings(settings) {
  if (
    typeof settings?.databasePassword !== "string" ||
    !/^[A-Za-z0-9_-]{20,128}$/.test(settings.databasePassword)
  ) {
    throw new Error(
      "A configuração .local/settings.json está inválida. Corrija o arquivo; a senha do banco não foi alterada.",
    );
  }
  // Retain the existing PostgreSQL password when upgrading from the login-based setup.
  return { databasePassword: settings.databasePassword };
}
function parseSettings(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(
      "O arquivo .local/settings.json não contém JSON válido. Corrija o arquivo; as credenciais não foram alteradas.",
    );
  }
  return validateSettings(parsed);
}
export async function readSettings(directory = root) {
  try {
    return parseSettings(await readFile(resolve(directory, jsonFile), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT")
      throw new Error(
        "Execute npm run setup primeiro para preparar o banco local.",
      );
    throw error;
  }
}
export async function configure(directory = root) {
  const local = resolve(directory, ".local");
  await mkdir(local, { recursive: true, mode: 0o700 });
  let settings;
  try {
    settings = parseSettings(
      await readFile(resolve(directory, jsonFile), "utf8"),
    );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    // If the Docker env already exists, do not rotate its database password by accident.
    try {
      await access(resolve(directory, envFile), constants.F_OK);
      throw new Error(
        "Existe .local/compose.env sem settings.json. Restaure o arquivo settings.json para preservar as credenciais do banco local.",
      );
    } catch (envError) {
      if (envError.code !== "ENOENT") throw envError;
    }
    settings = {
      databasePassword: randomBytes(32).toString("base64url"),
    };
    await writeFile(
      resolve(directory, jsonFile),
      JSON.stringify(settings, null, 2) + "\n",
      { flag: "wx", mode: 0o600 },
    );
  }
  // Remove obsolete application credentials without changing the database password.
  await writeFile(
    resolve(directory, jsonFile),
    JSON.stringify(settings, null, 2) + "\n",
    { mode: 0o600 },
  );
  const environment = `POSTGRES_PASSWORD=${settings.databasePassword}\n`;
  await writeFile(resolve(directory, envFile), environment, { mode: 0o600 });
  // Windows controls access through the user's directory ACL; POSIX gets explicit modes.
  if (process.platform !== "win32") {
    await chmod(local, 0o700);
    await Promise.all(
      [jsonFile, envFile].map((path) => chmod(resolve(directory, path), 0o600)),
    );
  }
  return settings;
}
export function composeArgs(args) {
  return ["compose", "--env-file", envFile, "-f", composeFile, ...args];
}

export function run(program, args, { cwd = root, quiet = false } = {}) {
  return new Promise((accept, reject) => {
    // No shell expansion of arguments or credentials. npm's Windows shim needs cmd.exe.
    const windowsNpm = process.platform === "win32" && program === "npm";
    const child = spawn(
      windowsNpm ? process.env.ComSpec || "cmd.exe" : program,
      windowsNpm ? ["/d", "/s", "/c", "npm", ...args] : args,
      { cwd, stdio: quiet ? "ignore" : "inherit", windowsHide: true },
    );
    child.once("error", () =>
      reject(
        new Error(
          `${program} não foi encontrado. Instale Node.js 22+ e Docker Desktop e abra um novo terminal.`,
        ),
      ),
    );
    child.once("exit", (code, signal) =>
      code === 0
        ? accept()
        : reject(
            new Error(
              `${program} terminou com código ${code ?? signal}. Confira a mensagem acima.`,
            ),
          ),
    );
  });
}
const docker = (args, options) => run("docker", composeArgs(args), options);
export async function checkDocker() {
  if (Number(process.versions.node.split(".")[0]) < 22)
    throw new Error("Instale o Node.js 22 ou superior.");
  await run("docker", ["compose", "version"]);
  try {
    await run("docker", ["info", "--format", "{{.ServerVersion}}"], {
      quiet: true,
    });
  } catch {
    throw new Error(
      "Abra o Docker Desktop, aguarde ele iniciar e execute o comando novamente. Use contêineres Linux.",
    );
  }
}
export async function waitForApi({ timeout = 90000, fetcher = fetch } = {}) {
  const deadline = Date.now() + timeout;
  do {
    try {
      const response = await fetcher(apiBase + "/health", {
        signal: AbortSignal.timeout(3000),
      });
      if (response.ok) return;
    } catch {
      /* host still booting */
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  } while (Date.now() < deadline);
  throw new Error(
    "A API não iniciou em http://localhost:7071. Consulte npm run logs:api. Confira se a porta 7071 já está em uso.",
  );
}
export async function verify(fetcher = fetch) {
  const call = (path) =>
    fetcher(apiBase + path, { signal: AbortSignal.timeout(15000) });
  for (const path of [
    "/ingredients",
    "/products",
    "/sales",
    "/expenses",
    "/fixed-costs",
    "/dashboard",
  ]) {
    const response = await call(path);
    if (!response.ok)
      throw new Error(
        `A consulta ${path} falhou (${response.status}). Consulte npm run logs:api.`,
      );
    const data = await response.json();
    if (
      ["/ingredients", "/products", "/sales", "/expenses"].includes(path) &&
      !Array.isArray(data)
    )
      throw new Error(`A resposta de ${path} é inválida.`);
  }
}
export async function main(command) {
  if (command === "setup") {
    await checkDocker();
    await configure();
    console.log(
      "Preparando PostgreSQL, emulador de armazenamento e API locais…",
    );
    await docker([
      "up",
      "-d",
      "--wait",
      "--wait-timeout",
      "90",
      "postgres",
      "azurite",
    ]);
    await docker(["build", "api"]);
    await docker([
      "run",
      "--rm",
      "--no-deps",
      "--entrypoint",
      "dotnet",
      "api",
      "/home/site/wwwroot/GestaoAcai.Api.dll",
      "--migrate",
    ]);
    await docker(["up", "-d", "api"]);
    await waitForApi();
    await verify();
    await run("npm", ["ci"], { cwd: resolve(root, "services/web") });
    console.log(
      "\nPronto: acesso direto ao painel e consultas ao PostgreSQL validados. Execute npm run dev e abra http://localhost:5173.",
    );
    return;
  }
  if (command === "dev") {
    await readSettings();
    await checkDocker();
    await docker([
      "up",
      "-d",
      "--wait",
      "--wait-timeout",
      "90",
      "postgres",
      "azurite",
      "api",
    ]);
    await waitForApi();
    await verify();
    console.log(
      "Abra http://localhost:5173. A abertura entra no painel automaticamente.",
    );
    await run(
      "npm",
      [
        "run",
        "dev",
        "--",
        "--host",
        "127.0.0.1",
        "--port",
        "5173",
        "--strictPort",
      ],
      { cwd: resolve(root, "services/web") },
    );
    return;
  }
  if (command === "verify") {
    await readSettings();
    await verify();
    console.log(
      "Acesso direto e consultas ao banco validados. Nenhum registro foi criado.",
    );
    return;
  }
  if (command === "stop" || command === "logs") {
    await readSettings();
    await docker(
      command === "stop" ? ["stop"] : ["logs", "--tail", "100", "api"],
    );
    return;
  }
  throw new Error(
    "Use npm run setup, npm run dev, npm run verify:local, npm run stop ou npm run logs:api.",
  );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main(process.argv[2]).catch((error) => {
    console.error("\n" + error.message);
    process.exitCode = 1;
  });
}
