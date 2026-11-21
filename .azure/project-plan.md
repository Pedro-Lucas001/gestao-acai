# Plano do projeto — Gestão Açaí

## Objetivo

Construir uma aplicação web responsiva, em português do Brasil e com valores em BRL, para um negócio de açaí engarrafado operado por um usuário administrador. O sistema deve mostrar o lucro real por produto e apoiar a operação, começando por um MVP financeiro e evoluindo para estoque e escala.

## Usuário e escopo

- Um negócio e um usuário administrador autenticado.
- Interface utilizável em desktop e celular.
- Implementação inicial limitada à Fase 1; as Fases 2 e 3 ficam documentadas como evolução, sem antecipar funcionalidades ao MVP.

## Arquitetura proposta

- **Frontend:** React e TypeScript, aplicação web responsiva.
- **Backend:** API em C# com Azure Functions; cálculos e regras financeiras centralizados no servidor.
- **Persistência:** PostgreSQL para dados transacionais. Blob Storage fica reservado a anexos/exportações quando necessário, sem ser dependência de funcionalidades do MVP.
- **Autenticação:** acesso protegido para o administrador.
- **Formato regional:** pt-BR, moeda BRL e datas no padrão brasileiro.

## Fase 1 — MVP: descobrir o lucro real

1. **Insumos e custos:** cadastrar insumos/unidades de medida, preço e quantidade de compra; derivar custo unitário e permitir atualizar o preço de um insumo em um só lugar.
2. **Produtos e fichas técnicas:** cadastrar tamanhos e sabores, associando quantidades de insumos por unidade. Alterações no custo de insumos atualizam os custos calculados das fichas.
3. **Precificação e margem:** informar preço de venda e custos variáveis por canal ou forma de venda; apresentar CMV, taxas, contribuição/lucro por garrafa e margem. Permitir registrar custos fixos mensais e estimar ponto de equilíbrio.
4. **Vendas básicas:** registrar data, produto, quantidade, preço praticado, canal e forma de pagamento; manter um histórico consultável.
5. **Despesas:** registrar despesas fixas e variáveis com data, categoria e valor, evitando contar taxas duas vezes quando já calculadas na venda.
6. **Visão inicial:** resumo de vendas, custos e lucro estimado por período, com indicação clara dos pressupostos do cálculo.

## Fases seguintes

- **Fase 2 — Operação:** estoque de insumos com baixa automática ao registrar produção, níveis mínimos e alertas, registro de perdas/desperdício, dashboard mais completo e ponto de equilíbrio baseado nos dados operacionais.
- **Fase 3 — Escala:** lotes com data de produção e validade e alertas de vencimento; preços de varejo/combos/atacado; contas a receber; simulador de cenários e metas diárias; ranking de rentabilidade por tamanho e sabor.

## Regras de negócio e critérios de aceite do MVP

- Valores monetários são persistidos com precisão decimal adequada, sem usar ponto flutuante binário para cálculos financeiros.
- O CMV unitário corresponde à soma das quantidades da ficha técnica multiplicadas pelo custo unitário vigente de cada insumo.
- O resultado por venda separa receita, CMV e taxas variáveis. A contribuição não é apresentada como lucro líquido: despesas fixas do período também são consideradas para estimar o lucro líquido.
- O ponto de equilíbrio é calculado como custos fixos mensais divididos pela contribuição média por unidade; quando a contribuição é nula ou negativa, o sistema informa que não há ponto de equilíbrio viável em vez de mostrar um número enganoso.
- O simulador e as telas distinguem valores reais registrados de projeções e deixam explícito o período considerado.
- Vendas preservam o preço e o custo calculados no momento do registro para que alterações futuras em preços de insumos não reescrevam o histórico financeiro.
- O MVP não baixa estoque automaticamente nem gerencia validade; essas capacidades pertencem às fases futuras.

## Modelo de dados inicial

- Insumo e unidade de medida, incluindo quantidade/preço de compra e custo unitário.
- Produto (tamanho e sabor) e itens da ficha técnica (insumo e quantidade).
- Preço de venda por produto e configuração de taxas variáveis por canal/meio de pagamento.
- Custos fixos mensais e despesas variáveis registradas.
- Venda e itens da venda, preservando quantidades e snapshots dos valores unitários relevantes no momento da operação.

## Fora do MVP

Controle de estoque e produção, lotes e validade, perdas, contas a receber, múltiplos usuários/negócios, integração com adquirentes ou plataformas de delivery, emissão fiscal e armazenamento de anexos. Esses itens não devem ser simulados como se estivessem implementados.

## Verificação

- Testes unitários para custo unitário, CMV, taxas, margem/contribuição, lucro do período e ponto de equilíbrio, incluindo contribuição nula/negativa.
- Testes de integração para persistência e fluxo de cadastro de insumos, ficha técnica, venda e despesa.
- Validação manual do fluxo responsivo de cadastro e consulta financeira, além de build e testes do frontend e backend.
