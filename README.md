# Netuno Açaí · Gestão

Organizador financeiro de uso pessoal, com identidade visual da Netuno Açaí: roxo `#491a50`, turquesa `#12afc0` e amarelo `#ffd34f`. A logo original está em `services/web/public/netuno-logo.jpg`.

## Funcionalidades

- Abertura animada com a logo e acesso direto ao painel, sem usuário ou senha. A animação pode ser pulada e respeita a preferência por movimento reduzido.
- **PWA instalável** no celular e computador, com suporte offline e ícone da Netuno Açaí.
- **Insumos** em g, ml ou unidade, com cálculo de custo unitário em tempo real, controle leve de estoque com alerta de reposição e baixa automática a cada venda, edição, exportação CSV e exclusão com proteção de vínculos.
- **Produtos** com tamanho, ficha técnica por garrafa, duplicação rápida de receitas, prévia ao vivo de CMV, contribuição e margem, e exportação CSV.
- **Vendas** com suporte a múltiplos sabores no mesmo pedido, atalhos de **Venda rápida (1 toque)**, filtros rápidos por canal e forma de pagamento, prévia ao vivo antes de salvar, exportação CSV e exclusão confirmada.
- **Despesas** fixas/variáveis por data e categoria, com edição, **modelos recorrentes (1 clique por mês)**, filtros rápidos, resumo do período, exportação CSV e exclusão confirmada.
- **Visão geral** com comparativo percentual frente ao período anterior, metas mensais de faturamento e garrafas, gráfico diário, divisão por canal de venda, ranking de sabores mais lucrativos e relatório pronto para impressão/PDF.
- **Precificação** com custos fixos mensais previstos, simulador interativo de preço por margem desejada e ponto de equilíbrio baseado na contribuição média das vendas do período.
- **Modo local automático** no navegador quando publicado como site estático (como Vercel sem backend configurado), com exportação e importação completa de backup JSON (incluindo estoque, metas e modelos recorrentes). Com a API/PostgreSQL ativos localmente, os dados usam o banco real e falhas de servidor continuam sendo exibidas normalmente.

A interface usa a API real quando disponível e não possui dados fictícios nem preenchimento automático de vendas. Emissão fiscal e contas a receber continuam fora deste escopo.

## Começar pelo VS Code (Windows)

Abra **a pasta raiz `gestao-acai`** no VS Code. Instale [Node.js 22 ou superior](https://nodejs.org/pt/download) e [Docker Desktop](https://www.docker.com/products/docker-desktop/), mantenha o Docker aberto em modo de contêineres Linux e abra um novo terminal.

```sh
npm run setup
npm run dev
```

O primeiro comando prepara PostgreSQL 16 e Azurite, compila a API, aplica as migrações e verifica as consultas sem autenticação. Depois instala as dependências da interface. A primeira execução demora mais porque baixa as imagens e compila o backend. Não precisa instalar .NET nem Azure Functions Core Tools no computador para este modo.

O segundo comando inicia a interface em **http://localhost:5173**. A logo aparece em uma abertura de aproximadamente dois segundos, seguida do painel automaticamente. Use **Entrar agora** para pular a animação. Com movimento reduzido ativado no sistema, a abertura vai diretamente para o painel. Os dados começam a carregar durante a animação.

No PowerShell, se `npm.ps1` for bloqueado pela política de execução, use `npm.cmd run setup` e `npm.cmd run dev`. Não é necessário mudar a política do Windows.

Também é possível usar **Terminal → Executar Tarefa** e escolher `Netuno: preparar ambiente local` ou `Netuno: iniciar sistema`.

- Não há conta, senha ou token para entrar no aplicativo. A senha interna do PostgreSQL continua somente em `.local/settings.json` e `.local/compose.env`, ignorados pelo Git e excluídos da imagem Docker.
- Executar o setup novamente **preserva** a senha interna do PostgreSQL e o banco. Guarde a pasta `.local` junto do ambiente local; uma instalação nova gera uma senha de banco diferente. O script recusa configurações incompletas em vez de trocar a senha do banco silenciosamente.
- O PostgreSQL é um contêiner local, fora do Supabase, com volume persistente. Ele atende em `127.0.0.1:55432`, a API em `127.0.0.1:7071` e a interface em `127.0.0.1:5173`. Dados e credenciais não são publicados.
- `npm run stop` para os contêineres sem apagar os dados. `Ctrl+C` encerra a interface; use `npm run stop` depois para encerrar o restante.
- `npm run verify:local` valida consultas com acesso direto, sem inserir registros. `npm run logs:api` mostra os logs recentes do backend para diagnóstico.
- Este modo usa um banco dedicado do Compose; não utiliza nem substitui `services/api/local.settings.json` de uma configuração manual existente. Para usar PostgreSQL instalado diretamente ou depurar a API C#, siga a seção de execução manual abaixo.
- Se uma porta estiver ocupada, feche a outra instância antes de iniciar. Para atualizar o backend depois de alterar C#, execute `npm run setup` novamente; a interface atualiza pelo Vite.

## Arquitetura

- `services/web`: React 18, TypeScript, Vite, Lucide.
- `services/api`: Azure Functions v4 isolated, .NET 8, EF Core/Npgsql.
- PostgreSQL externo ao Supabase. A aplicação não provisiona nem altera um servidor de produção automaticamente. Este projeto é destinado ao uso pessoal no computador local.
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
2. Configure `POSTGRESQL_CONNECTION_STRING` e o armazenamento local do Functions. O aplicativo não exige variáveis de administrador. Não publique as credenciais do banco.
3. Aplique a migração conforme a seção anterior. `dotnet ef` lê a variável do terminal, não `local.settings.json`.
4. Execute a API dentro de `services/api`: `func start --port 7071`.
5. Execute `npm ci --prefix services/web` e `npm run dev --prefix services/web`.
6. Abra a URL mostrada pelo Vite. A abertura com a logo leva diretamente ao painel.

O Vite encaminha `/api` para `http://127.0.0.1:7071`. O fluxo local do Compose e do comando `npm run dev` publica os serviços somente em loopback. As rotas financeiras funcionam sem autenticação; a antiga rota `/api/auth/login` foi removida.

Ao atualizar uma instalação anterior, execute `npm run setup` novamente para reconstruir a API. O configurador preserva a senha e os dados do PostgreSQL e remove somente as antigas credenciais de acesso ao aplicativo dos arquivos locais.

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

Os testes do navegador usam fixtures isoladas para conferir abertura automática, atalho de entrada, movimento reduzido, formulários, erros, filtros e navegação em desktop/celular. Não são dados da aplicação. Para usar Chromium instalado localmente, defina `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

```sh
dotnet build services/api/GestaoAcai.Api.csproj
# Defina TEST_POSTGRESQL_CONNECTION_STRING para um PostgreSQL de testes.
dotnet test services/api.Tests/GestaoAcai.Api.Tests.csproj
```

A integração cria um banco temporário `acai_test_<uuid>`, aplica migrações, testa cadastro → produto → venda → despesa → dashboard e remove somente esse banco temporário. A conta de teste precisa de `CREATE DATABASE`; o banco indicado na conexão não é apagado. Os testes também conferem validações sem autenticação, proteção de vínculos, filtros e preservação do histórico.

`npm run test:setup` verifica preservação da senha do banco na atualização sem login, permissões dos arquivos e consultas sem token.

`.github/workflows/validate.yml` executa builds e testes, com PostgreSQL 16 temporário, e sobe o ambiente Docker completo para conferir o acesso direto real sem expor a senha do banco nos logs. Deploy e conexão com um banco real são configurações posteriores: nenhum ambiente de produção foi alterado por este código.
