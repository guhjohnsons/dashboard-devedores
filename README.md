# Dashboard de Devedores / Dívidas

> Uma pequena aplicação web (HTML/CSS/JS) para gerenciar devedores e dívidas com controle de parcelas, histórico de pagamentos, estatísticas e exportação/importação de dados.

---

## 🧩 Visão Geral

Este dashboard permite que você:

- Cadastre **devedores (o que você recebe)** e **dívidas (o que você paga)** via um moderno formulário **Off-Canvas (Gaveta Lateral)**.
- Controle o progresso de pagamento por parcela com transições suaves e design premium.
- Veja **estatísticas em tempo real** (total a receber/pagar, progresso absoluto).
- Ferramenta de Análises Inteligente: Gráfico de Balanço Geral (Receber vs Pagar) e Gráfico de Top 5 Dinâmico (Horizontal com Chart.js).
- Layout focado em acessibilidade **WCAG AA** para Dark Mode nativo (Tipografia Outfit + Plus Jakarta Sans).
- Exporte seus dados para **CSV** e **JSON**
- Motor Assíncrono com **IndexedDB**: Performance garantida para milhares de dívidas e histórico, não causando engasgos (Jank) na renderização do cursor.
- Use filtros, buscas e ordenação na tabela

---

## ▶️ Como usar (modo rápido)

1. Abra o arquivo `index.html` no navegador (ou rode um servidor local).
2. Use o formulário `➕ Novo Cadastro` para adicionar um registro.
3. Clique em **Ver** para abrir o modal com detalhes e controlar parcelas.
4. Use os botões no topo para:
   - **Resetar**: apagar tudo
   - **Exportar CSV**: gerar dois arquivos (lista + histórico)
   - **Backup JSON**: exportar tudo em JSON
   - **Restaurar**: importar arquivo JSON gerado por backup

> 🔒 A base de dados principal roda internamente e assincronamente através do serviço `IndexedDB` do próprio navegador, suportando dados massivos e altíssima performance. Fechar a guia não apaga suas informações.

---

## 🗂️ Estrutura de arquivos

- `index.html`: interface principal + layout
- `dashboard.css`: estilos e tema dark
- `app.js`: lógica de cadastro, filtros, gráficos, export/import, armazenamento

---

## 📌 Funcionalidades detalhadas

### 📝 Cadastro Inteligente (Drawer Off-Canvas)
- Invés de espremer o conteúdo na lateral, os dados se abrem em uma "gaveta" deslizante que sai por cima de toda a interface.
- Edições recuperam a janela sem travar seu *scrollbar* original.

### 👑 Tipografia & Acessibilidade Visual
- Cores de fundo e opacidades foram padronizadas nas escalas da W3C.
- Integração de vetores SVG puros através do pacote `Lucide Icons` no lugar de tradicionais emojis.

### 📊 Estatísticas Funcionais (Gráficos)
- Painel de totais com devedores e dívidas no topo.
- Gráfico interativo "Doughnut" focando no ratio/volume entre **Dinheiro Entrante vs Saínte** (A Receber / A Pagar).
- Gráfico de barras na horizontal facilitando o entendimento visual do **Top 5 Nomes mais custosos**.

### 🔎 Filtros e ordenação
- Filtro por **nome**, **tipo** e **status**
- Ordenação clicável nas colunas: **Nome**, **Valor Estimado**, **Progresso**

### 💾 Exportar / Importar
- **Exportar CSV**: gera dois arquivos CSV:
  - lista de registros
  - histórico de pagamentos
- **Backup JSON**: exporta todos os dados exatamente como estão (para restauração)
- **Restaurar**: importa um arquivo JSON (substitui todos os dados atuais)

### ♻️ Reset
- Botão **Resetar** apaga todos os registros e limpa o `localStorage`.

---

## 🔧 Customização / Desenvolvimento

### Executar localmente (recomendado)
Você pode abrir `index.html` diretamente, mas se quiser rodar em um servidor local (para evitar limites de CORS ou facilitar debugging):

```sh
# Python 3
python -m http.server 8000
```

Acesse no navegador:

```
http://localhost:8000
```

### Dependências
- [Chart.js](https://www.chartjs.org/) (carregado via CDN em `index.html`)

---

## 🧩 Arquitetura de Software (IndexedDB)

A engine passou por refatoração de alta escala para sair do formato String/Síncrono do Storage para Promessas do IDB. Há scripts automáticos que processam essa migração retroativamente.

- **Nome DB Principal**: `DebtManagerDB`
- **Tabela**: `debtsStore` -> `main_records`
- A estrutura de fallback em caso de bloqueio local mantém a aplicação responsiva rodando de forma pura e reativa na memória.
---

## ✅ Próximas melhorias sugeridas

- Autenticação/usuários (multi-usuário)
- Armazenamento em nuvem (Firebase, Supabase, etc.)
- Exportação para PDF
- Importação/validação de XLSX
- Suporte a várias moedas

---

## 🎯 Licença
Use e modifique livremente — não há licença especificada (use conforme desejar).
