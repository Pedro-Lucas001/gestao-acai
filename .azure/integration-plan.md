# Integração — Netuno Açaí

A integração da Fase 1 foi implementada em `FinanceEndpoints`, no cliente HTTP `services/web/src/api/index.ts` e nos formulários `Forms.tsx`. Consulte o README para configuração e regras financeiras.

## Rotas da API local, sem login

Uso pessoal: não há autenticação nem rota de login. O Compose publica a API somente em `127.0.0.1:7071`.

- `GET, POST /api/ingredients`; `PUT, DELETE /api/ingredients/{id}`.
- `GET, POST /api/products`; `GET, PUT, DELETE /api/products/{id}`.
- `GET, PUT /api/pricing/{productId}`. PUT usa `price`, `feePercent`, `feePerUnit`; alterações de receita ficam em products.
- `GET, POST /api/sales`; `GET /api/sales/{id}`.
- `GET, POST /api/expenses`; `DELETE /api/expenses/{id}`.
- `GET, PUT /api/fixed-costs`, corpo `{ "monthlyAmount": 0 }`.
- `GET /api/dashboard`.
- `POST /api/calculations/break-even` com `monthlyFixedCosts` e `averageContribution`.

`GET /api/health` é público. Listas de vendas, despesas e dashboard aceitam `?from=YYYY-MM-DD&to=YYYY-MM-DD`, inclusivos. A interface sempre informa o período; sem parâmetros, a API usa o mês UTC atual. Insumos e produtos são catálogos sem filtro temporal.

## Modelos de gravação

- Insumo: `name`, `unit` (`g`, `ml`, `un`), `purchaseQuantity`, `purchasePrice`.
- Produto: `name`, `size`, `price`, `feePercent`, `feePerUnit`, `recipe: [{ ingredientId, quantity }]`.
- Venda: `date`, `productId`, `quantity`, `price`, `channel`, `paymentMethod`, `feePercent`, `feePerUnit`. Uma linha de produto por registro.
- Despesa: `description`, `category`, `date`, `amount`, `isFixed`.

Valores financeiros/quantidades não negativos, com até 6 casas; compra, consumo, quantidade de venda, preço e despesa devem ser positivos. Percentual entre 0 e 100. Textos têm limites e a ficha exige insumos existentes sem duplicidade.

## Persistência e ambiente

- PostgreSQL fora do Supabase; EF Core + Npgsql; variável `POSTGRESQL_CONNECTION_STRING`.
- Migrações em `services/api/Data/Migrations`. Sem dados de exemplo e sem migração automática no início.
- Sem usuário, senha ou token no aplicativo; a senha interna do banco permanece no ambiente do servidor.
- Backend e frontend são serviços separados; em produção encaminhar `/api` ou configurar API HTTPS/CORS antes do build.
- Aplicação destinada ao uso pessoal local. Atualizações do modo anterior preservam a senha e os dados do PostgreSQL, removendo as antigas credenciais do aplicativo.
