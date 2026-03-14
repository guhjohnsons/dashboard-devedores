# Dashboard de Devedores / Dívidas

> Uma pequena aplicação web (HTML/CSS/JS) para gerenciar devedores e dívidas com controle de parcelas, histórico de pagamentos, estatísticas e exportação/importação de dados.

---

## 🧩 Visão Geral

Este dashboard permite que você:

- Cadastre **devedores (o que você recebe)** e **dívidas (o que você paga)**
- Controle o progresso de pagamento por parcela
- Veja **estatísticas em tempo real** (total a receber/pagar, progresso total)
- Visualize **gráficos** de status e maiores valores (Chart.js)
- Exporte seus dados para **CSV** e **JSON**
- Importe um backup JSON para restaurar o estado
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

> 🔒 Os dados são salvos no `localStorage` do navegador. Fechar o navegador não apaga os dados.

---

## 🗂️ Estrutura de arquivos

- `index.html`: interface principal + layout
- `dashboard.css`: estilos e tema dark
- `app.js`: lógica de cadastro, filtros, gráficos, export/import, armazenamento

---

## 📌 Funcionalidades detalhadas

### 📝 Cadastro e edição
- Campos obrigatórios: **tipo**, **nome**, **valor**, **parcelas**, **descrição**
- Permite editar registros existentes via modal de detalhes

### 📊 Estatísticas e gráficos
- Painel com totais de devedores, dívidas, valores e progresso geral
- Gráfico de status (Aberto / Pagando / Pago)
- Gráfico de top 5 valores (cores por tipo)

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

## 🧩 Estrutura de Dados (localStorage)

Os dados são armazenados como um array de objetos no `localStorage` com a chave:

- `debtManagerDebts`

Cada registro tem, no mínimo:

- `id`: número único
- `tipo`: `devedor` ou `divida`
- `nome`: nome do devedor/credor
- `valor`: valor total
- `parcelas`: número de parcelas
- `parcelsPagas`: parcelas pagas
- `desc`: descrição livre
- `dataCriacao`: ISO string
- `historico`: array com logs de ações

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
