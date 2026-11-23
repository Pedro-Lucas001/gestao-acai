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
    settings?.username !== "admin" ||
    !["password", "apiToken", "databasePassword"].every(
      (key) =>
        typeof settings[key] === "string" &&
        /^[A-Za-z0-9_-]{20,128}$/.test(settings[key]),
    )
  ) {
    throw new Error(
      "A configuração .local/settings.json está inválida. Corrija o arquivo; nenhuma credencial existente foi sobrescrita.",
    );
  }
  return settings;
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
        "Execute npm run setup primeiro para criar o acesso local.",
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
      username: "admin",
      password: randomBytes(18).toString("base64url"),
      apiToken: randomBytes(48).toString("base64url"),
      databasePassword: randomBytes(32).toString("base64url"),
    };
    await writeFile(
      resolve(directory, jsonFile),
      JSON.stringify(settings, null, 2) + "\n",
      { flag: "wx", mode: 0o600 },
    );
  }
  const environment = `ADMIN_PASSWORD=${settings.password}\nADMIN_API_TOKEN=${settings.apiToken}\nPOSTGRES_PASSWORD=${settings.databasePassword}\n`;
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
export async function verify(settings, fetcher = fetch) {
  const call = (path, options = {}) =>
    fetcher(apiBase + path, { ...options, signal: AbortSignal.timeout(15000) });
  const denied = await call("/ingredients");
  if (denied.status !== 401)
    throw new Error("A API não bloqueou a consulta sem autenticação.");
  const wrong = await call("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: settings.username,
      password: randomBytes(24).toString("base64url"),
    }),
  });
  if (wrong.status !== 401)
    throw new Error("A API não recusou uma senha incorreta.");
  const login = await call("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: settings.username,
      password: settings.password,
    }),
  });
  if (!login.ok)
    throw new Error(
      "O login local não foi aceito. Confira as configurações do contêiner com npm run logs:api.",
    );
  const { accessToken } = await login.json();
  if (typeof accessToken !== "string" || !accessToken)
    throw new Error("A API não retornou um token válido.");
  for (const path of [
    "/ingredients",
    "/products",
    "/sales",
    "/expenses",
    "/fixed-costs",
    "/dashboard",
  ]) {
    const response = await call(path, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
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
function showLogin(settings) {
  console.log(
    `\nAcesso local Netuno Açaí\nUsuário: ${settings.username}\nSenha: ${settings.password}\n`,
  );
  console.log(
    "A senha fica somente em .local/settings.json no seu computador. Nunca envie esse arquivo ao GitHub.",
  );
}
export async function main(command, { quiet = false } = {}) {
  if (command === "login") {
    showLogin(await readSettings());
    return;
  }
  if (command === "setup") {
    await checkDocker();
    const settings = await configure();
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
    await verify(settings);
    await run("npm", ["ci"], { cwd: resolve(root, "services/web") });
    console.log(
      "\nPronto: login e consultas ao PostgreSQL validados. Execute npm run dev e abra http://localhost:5173.",
    );
    if (!quiet) showLogin(settings);
    return;
  }
  if (command === "dev") {
    const settings = await readSettings();
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
    await verify(settings);
    console.log(
      "Abra http://localhost:5173. Para consultar a senha: npm run login:local.",
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
    await verify(await readSettings());
    console.log(
      "Acesso local e consultas protegidas validados. Nenhum registro foi criado.",
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
    "Use npm run setup, npm run dev, npm run login:local, npm run verify:local, npm run stop ou npm run logs:api.",
  );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main(process.argv[2], { quiet: process.argv.includes("--quiet") }).catch(
    (error) => {
      console.error("\n" + error.message);
      process.exitCode = 1;
    },
  );
}
