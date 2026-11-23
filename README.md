# Netuno Açaí · Gestão

MVP financeiro para um negócio e um administrador, com identidade visual da Netuno Açaí: roxo `#491a50`, turquesa `#12afc0` e amarelo `#ffd34f`. A logo original está em `services/web/public/netuno-logo.jpg`.

## Funcionalidades

- Login administrativo; token apenas na memória do navegador e saída da conta.
- Insumos em g, ml ou unidade, com quantidade/preço de compra e custo unitário. Edição e exclusão com proteção de vínculos.
- Produtos com tamanho, ficha técnica por garrafa, preço e taxas padrão. Custos recalculados a partir dos insumos vigentes.
- Vendas com preço e taxas editáveis por operação. Quantidade, nome, preço, CMV e taxa unitária ficam preservados no histórico.
- Despesas fixas/variáveis por data e categoria, com exclusão confirmada.
- Dashboard, gráfico diário, busca, filtros por período e comparação de rentabilidade dos produtos.
- Custos fixos mensais previstos e ponto de equilíbrio baseado na contribuição média das vendas do período.
- Interface responsiva em pt-BR/BRL, estados de carregamento/erro e formulários que preservam o preenchimento se a gravação falhar.

A interface usa a API real. Banco indisponível aparece como erro; não há dados fictícios nem preenchimento automático de vendas. Estoque, produção, validade, contas a receber e emissão fiscal continuam fora deste MVP.

## Começar pelo VS Code (Windows)

Abra **a pasta raiz `gestao-acai`** no VS Code. Instale [Node.js 22 ou superior](https://nodejs.org/pt/download) e [Docker Desktop](https://www.docker.com/products/docker-desktop/), mantenha o Docker aberto em modo de contêineres Linux e abra um novo terminal.

```sh
npm run setup
npm run dev
```

O primeiro comando cria o usuário **admin** com senha e token aleatórios exclusivos do seu computador, prepara PostgreSQL 16 e Azurite, compila a API, aplica as migrações e verifica o login e as consultas protegidas. Depois instala as dependências da interface. A primeira execução demora mais porque baixa as imagens e compila o backend. Não precisa instalar .NET nem Azure Functions Core Tools no computador para este modo.

O segundo comando inicia a interface em **http://localhost:5173**. A senha é mostrada ao concluir o setup; para consultá-la novamente, em outro terminal:

```sh
npm run login:local
```

No PowerShell, se `npm.ps1` for bloqueado pela política de execução, use `npm.cmd run setup`, `npm.cmd run dev` e `npm.cmd run login:local`. Não é necessário mudar a política do Windows.

Também é possível usar **Terminal → Executar Tarefa** e escolher `Netuno: preparar banco e login`, `Netuno: iniciar sistema` ou `Netuno: mostrar login local`.

- A senha fica em `.local/settings.json` e o Compose recebe `.local/compose.env`. Ambos são ignorados pelo Git e excluídos da imagem Docker. Não compartilhe esses arquivos nem a saída do comando de login.
- Executar o setup novamente **preserva** as credenciais existentes e o banco. Guarde a pasta `.local` junto do ambiente local; uma instalação nova gera credenciais diferentes. O script recusa configurações incompletas em vez de trocar a senha do banco silenciosamente.
- O PostgreSQL é um contêiner local, fora do Supabase, com volume persistente. Ele atende em `127.0.0.1:55432`, a API em `127.0.0.1:7071` e a interface em `127.0.0.1:5173`. Dados e credenciais não são publicados.
- `npm run stop` para os contêineres sem apagar os dados. `Ctrl+C` encerra a interface; use `npm run stop` depois para encerrar o restante.
- `npm run verify:local` valida autenticação e consultas sem inserir registros. `npm run logs:api` mostra os logs recentes do backend para diagnóstico.
- Este modo usa um banco dedicado do Compose; não utiliza nem substitui `services/api/local.settings.json` de uma configuração manual existente. Para usar PostgreSQL instalado diretamente ou depurar a API C#, siga a seção de execução manual abaixo.
- Se uma porta estiver ocupada, feche a outra instância antes de iniciar. Para atualizar o backend depois de alterar C#, execute `npm run setup` novamente; a interface atualiza pelo Vite.

## Arquitetura

- `services/web`: React 18, TypeScript, Vite, Lucide.
- `services/api`: Azure Functions v4 isolated, .NET 8, EF Core/Npgsql.
- PostgreSQL externo ao Supabase. A aplicação não provisiona nem altera um servidor de produção automaticamente.
- `services/api.Tests`: testes unitários e de integração com PostgreSQL.
- `services/web/tests`: testes de contrato e interação no navegador para desktop e celular.

## Preparação do banco

Use PostgreSQL 16 ou compatível. Crie um banco dedicado e configure `POSTGRESQL_CONNECTION_STRING` no ambiente do backend, com host, porta, database, usuário e senha reais. Para um servidor remoto, siga a configuração TLS do provedor; não desabilite a validação de certificado. Nenhuma credencial vai no frontend.

```sh
dotnet tool restore
# Exporte POSTGRESQL_CONNECTION_STRING no seu terminal/gerenciador de segredos.
# Revise o SQL antes de aplicar em um servidor existente:
dotnet ef migrations script --idempotent --project services/api --output /tmp/netuno-migrations.sql
dotnet ef database update --project services/api
```

O script contém apenas estrutura, sem seed. A migração inicial pressupõe que as tabelas do sistema ainda não existem. Não a aplique sobre tabelas legadas sem revisar a compatibilidade. A conta de migração precisa criar tabelas; o usuário de execução pode ter somente leitura/escrita nas tabelas da aplicação. O backend nunca aplica migrações no início normal. Para aplicar as migrações a partir de uma distribuição compilada, existe o comando explícito `dotnet GestaoAcai.Api.dll --migrate`.

## Executar localmente sem Docker (configuração manual)

Requisitos: Node.js 22, SDK .NET 8, Azure Functions Core Tools v4 e PostgreSQL acessível. Configure armazenamento do Functions com Azurite local ou uma conta Azure apropriada.

1. Copie `services/api/local.settings.example.json` para `services/api/local.settings.json`.
2. Configure `POSTGRESQL_CONNECTION_STRING`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` e `ADMIN_API_TOKEN`. Gere senha e token longos/aleatórios; não use valores de exemplo. Não publique o arquivo.
3. Aplique a migração conforme a seção anterior. `dotnet ef` lê a variável do terminal, não `local.settings.json`.
4. Execute a API dentro de `services/api`: `func start --port 7071`.
5. Execute `npm ci --prefix services/web` e `npm run dev --prefix services/web`.
6. Abra a URL mostrada pelo Vite e entre com o administrador configurado.

O Vite encaminha `/api` para `http://127.0.0.1:7071`. Em produção, configure um proxy de mesma origem de `/api` para a Function App. Como alternativa, defina `VITE_API_BASE_URL` antes do build para a URL HTTPS da API e permita somente a origem exata da interface no CORS da Function App. Nunca inclua token ou senha em variáveis `VITE_*`.

A autenticação é a de administrador único do MVP: a API entrega o token estático de ambiente após validar usuário e senha. Ele não expira por sessão; para revogar sessões, altere `ADMIN_API_TOKEN` no servidor. A renovação da página exige novo login. Em hospedagem pública, configure HTTPS e limitação de tentativas de login no gateway da API. Isto não implementa identidade multiusuário.

## Regras financeiras

- Quantidades da compra e da ficha usam a mesma unidade base. Converta 1 kg para 1.000 g e 1 L para 1.000 ml.
- CMV unitário = soma de quantidade usada × preço de compra / quantidade comprada.
- Taxa por garrafa = preço praticado × percentual / 100 + taxa fixa por garrafa.
- Contribuição = receita − CMV − taxas; resultado estimado = contribuição − despesas registradas no período.
- Não registre CMV e taxas novamente como despesas: isso duplicaria a dedução.
- Custos fixos previstos alimentam **somente a projeção** de ponto de equilíbrio. Registre as despesas reais na aba Despesas para que componham o resultado. Não se desconta a previsão novamente.
- Ponto de equilíbrio mensal = teto dos custos fixos previstos / contribuição média por garrafa nas vendas filtradas. Sem vendas ou com contribuição não positiva, não se exibe uma projeção viável. Com previsão zero, o resultado será zero.
- Preço, CMV, taxa e nome preservados na venda não mudam ao editar o catálogo. O dashboard agrupa as vendas por data informada.
- O navegador apresenta BRL arredondado a centavos; o banco guarda quantidades e valores em `numeric(18,6)` e os cálculos do servidor usam `decimal`.

## Verificação

```sh
npm ci --prefix services/web
npm run build --prefix services/web
cd services/web
npx playwright install chromium
npm test
```

Os testes do navegador usam fixtures isoladas para conferir login, formulários, erros, filtros e navegação em desktop/celular. Não são dados da aplicação. Para usar Chromium instalado localmente, defina `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

```sh
dotnet build services/api/GestaoAcai.Api.csproj
# Defina TEST_POSTGRESQL_CONNECTION_STRING para um PostgreSQL de testes.
dotnet test services/api.Tests/GestaoAcai.Api.Tests.csproj
```

A integração cria um banco temporário `acai_test_<uuid>`, aplica migrações, testa cadastro → produto → venda → despesa → dashboard e remove somente esse banco temporário. A conta de teste precisa de `CREATE DATABASE`; o banco indicado na conexão não é apagado. Os testes também conferem validações, autenticação, proteção de vínculos, filtros e preservação do histórico.

`npm run test:setup` verifica geração/preservação de credenciais, permissões dos arquivos e falhas de autenticação.

`.github/workflows/validate.yml` executa builds e testes, com PostgreSQL 16 temporário, e sobe o ambiente Docker completo para conferir o acesso real sem expor as credenciais nos logs. Deploy e conexão com um banco real são configurações posteriores: nenhum ambiente de produção foi alterado por este código.
