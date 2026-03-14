let debts = JSON.parse(localStorage.getItem('debtManagerDebts')) || [];
let currentDebtIndex = null;
let charts = { status: null, values: null };
let currentSort = { campo: null, direcao: 'asc' };

// Garantir ID, histórico e dataCriacao
debts = debts.map(d => {
    if (!d.id) d.id = Date.now() + Math.floor(Math.random() * 1000);
    if (!d.historico) d.historico = [];
    if (!d.dataCriacao) d.dataCriacao = new Date().toISOString();
    return d;
});
saveDebts();

const formatMoney = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatDateObj = (dateStringISO) => {
    if (!dateStringISO) return '--/--/----';
    return new Date(dateStringISO).toLocaleString('pt-BR');
};

const formatDateShort = (dateStringISO) => {
    if (!dateStringISO) return '--/--/--';
    return new Date(dateStringISO).toLocaleDateString('pt-BR');
};

function calcularStatus(debt) {
    const totalParc = parseInt(debt.parcelas) || 0;
    const pagas = parseInt(debt.parcelsPagas) || 0;
    if (totalParc === 0 || pagas === 0) return 'aberto';
    return pagas < totalParc ? 'pagando' : 'pago';
}

function addHistoryLog(debtIndex, actionMessage) {
    if (!debts[debtIndex].historico) debts[debtIndex].historico = [];
    debts[debtIndex].historico.unshift({
        id_registro: Date.now() + Math.random().toString(36).substr(2, 5),
        acao: actionMessage,
        data: new Date().toISOString()
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    renderDebts();
    updateStats();
    updateCharts();
});

function initEventListeners() {
    // Top bar
    document.getElementById('btnReset').addEventListener('click', requestResetData);
    document.getElementById('btnExportCsv').addEventListener('click', () => exportData('csv'));
    document.getElementById('btnExportJson').addEventListener('click', () => exportData('json'));
    document.getElementById('btnImport').addEventListener('click', () => document.getElementById('fileInput').click());
    document.getElementById('fileInput').addEventListener('change', importData);

    // Filters
    document.getElementById('searchName').addEventListener('keyup', renderDebts);
    document.getElementById('filterStatus').addEventListener('change', renderDebts);
    document.getElementById('filterTipo').addEventListener('change', renderDebts);

    // Form
    document.getElementById('debtForm').addEventListener('submit', handleDebtSubmit);
    document.getElementById('btnCancelEdit').addEventListener('click', cancelEdit);

    // Modal Details
    document.getElementById('btnCloseDetails').addEventListener('click', () => fecharModal('modalDetails'));
    document.getElementById('btnEditDebt').addEventListener('click', prepararEdicao);
    document.getElementById('btnDeleteDebt').addEventListener('click', requestDelete);

    // Fechar modal ao clicar no overlay (#2)
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                fecharModal(overlay.id);
            }
        });
    });

    // Atalho Escape para fechar modais (#13)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.active').forEach(modal => {
                fecharModal(modal.id);
            });
        }
    });

    // Ordenação de tabela (#6)
    document.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const campo = th.dataset.sort;
            if (currentSort.campo === campo) {
                currentSort.direcao = currentSort.direcao === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.campo = campo;
                currentSort.direcao = 'asc';
            }
            // Atualizar visual dos cabeçalhos
            document.querySelectorAll('th.sortable').forEach(h => h.classList.remove('sort-active'));
            th.classList.add('sort-active');
            th.querySelector('.sort-icon').textContent = currentSort.direcao === 'asc' ? '↑' : '↓';
            renderDebts();
        });
    });
}

function renderDebts() {
    const tbody = document.getElementById('debtTableBody');
    const emptyState = document.getElementById('emptyState');
    const searchName = document.getElementById('searchName').value.toLowerCase();
    const filterStatus = document.getElementById('filterStatus').value;
    const filterTipo = document.getElementById('filterTipo').value;

    let filtered = debts.filter(debt => {
        const status = calcularStatus(debt);
        const matchName = debt.nome.toLowerCase().includes(searchName);
        let matchStatus = true;
        if (filterStatus === 'aberto') matchStatus = (status === 'aberto' || status === 'pagando');
        else if (filterStatus === 'pago') matchStatus = status === 'pago';
        let matchTipo = true;
        if (filterTipo !== 'todos') matchTipo = (debt.tipo || 'devedor') === filterTipo;
        return matchName && matchStatus && matchTipo;
    });

    // Ordenação (#6)
    if (currentSort.campo) {
        filtered.sort((a, b) => {
            let valA, valB;
            switch (currentSort.campo) {
                case 'nome':
                    valA = a.nome.toLowerCase();
                    valB = b.nome.toLowerCase();
                    break;
                case 'valor':
                    valA = parseFloat(a.valor) || 0;
                    valB = parseFloat(b.valor) || 0;
                    break;
                case 'progresso':
                    valA = (a.parcelsPagas || 0) / (parseInt(a.parcelas) || 1);
                    valB = (b.parcelsPagas || 0) / (parseInt(b.parcelas) || 1);
                    break;
                default:
                    return 0;
            }
            if (valA < valB) return currentSort.direcao === 'asc' ? -1 : 1;
            if (valA > valB) return currentSort.direcao === 'asc' ? 1 : -1;
            return 0;
        });
    }

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    tbody.innerHTML = filtered.map(debt => {
        const realIndex = debts.indexOf(debt);
        const total = parseInt(debt.parcelas);
        const pagas = debt.parcelsPagas || 0;
        const perc = total > 0 ? Math.round((pagas / total) * 100) : 0;
        const status = calcularStatus(debt);
        let barClass = perc === 100 ? 'progress-bar-paid' : 'progress-bar-unpaid';
        const isPago = pagas >= total;

        return `<tr>
            <td><strong>${debt.nome}</strong></td>
            <td><span class="status status-${debt.tipo || 'devedor'}">${(debt.tipo || 'devedor').toUpperCase()}</span></td>
            <td>${formatMoney(debt.valor)}</td>
            <td>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div class="progress-container" style="width: 80px;">
                        <div class="progress-bar ${barClass}" style="width: ${perc}%"></div>
                    </div>
                </div>
                <small>${pagas}/${total} (${perc}%)</small>
            </td>
            <td><span class="status status-${status}">${status.toUpperCase()}</span></td>
            <td><small>${formatDateShort(debt.dataCriacao)}</small></td>
            <td>
                <div style="display: flex; gap: 6px;">
                    <button class="btn btn-success btn-sm btn-quick-add" data-index="${realIndex}" ${isPago ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>+1 Parc.</button>
                    <button class="btn btn-info btn-sm btn-details" data-index="${realIndex}">👁️ Ver</button>
                </div>
            </td>
        </tr>`;
    }).join('');

    // Re-bind buttons
    document.querySelectorAll('.btn-details').forEach(btn => {
        btn.addEventListener('click', (e) => verDetalhes(parseInt(e.target.dataset.index)));
    });
    document.querySelectorAll('.btn-quick-add').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            // Micro-feedback visual (#7)
            e.target.classList.remove('btn-quick-flash');
            void e.target.offsetWidth; // force reflow
            e.target.classList.add('btn-quick-flash');
            adicionarParcela(index, 1);
        });
    });
}

function updateStats() {
    const qtdDevedores = debts.filter(d => (d.tipo || 'devedor') === 'devedor').length;
    const qtdDividas = debts.filter(d => d.tipo === 'divida').length;
    document.getElementById('totalDevedores').textContent = qtdDevedores;
    document.getElementById('totalDividas').textContent = qtdDividas;
    let totalReceber = 0;
    let totalPagar = 0;
    let totalParcelas = 0;
    let totalPagas = 0;

    debts.forEach(debt => {
        const val = parseFloat(debt.valor) || 0;
        if (debt.tipo === 'divida') {
            totalPagar += val;
        } else {
            totalReceber += val;
        }
        totalParcelas += parseInt(debt.parcelas) || 0;
        totalPagas += parseInt(debt.parcelsPagas) || 0;
    });

    const totalValorElem = document.getElementById('totalValor');
    if (totalValorElem) {
        totalValorElem.textContent = formatMoney(totalReceber);
    }

    const pagarElem = document.getElementById('totalPagar');
    if (pagarElem) pagarElem.textContent = formatMoney(totalPagar);

    document.getElementById('parcelasProgresso').textContent = `${totalPagas}/${totalParcelas}`;
    const pgGlobal = totalParcelas > 0 ? (totalPagas / totalParcelas) * 100 : 0;
    document.getElementById('progressGeral').style.width = `${pgGlobal}%`;
}

function handleDebtSubmit(e) {
    e.preventDefault();
    const editId = document.getElementById('editId').value;
    const divida = {
        tipo: document.getElementById('tipo').value,
        nome: document.getElementById('nome').value,
        valor: parseFloat(document.getElementById('valor').value),
        parcelas: parseInt(document.getElementById('parcelas').value),
        desc: document.getElementById('desc').value,
    };

    if (editId !== '') {
        const idToEdit = parseInt(editId);
        const index = debts.findIndex(d => d.id === idToEdit);
        if (index !== -1) {
            divida.id = idToEdit;
            divida.parcelsPagas = Math.min(debts[index].parcelsPagas || 0, divida.parcelas);
            divida.historico = debts[index].historico || [];
            divida.dataCriacao = debts[index].dataCriacao || new Date().toISOString();
            debts[index] = divida;
            addHistoryLog(index, 'Registro Atualizado (Edição)');
            showToast('Registro atualizado!', 'success');
        }
        cancelEdit();
    } else {
        divida.id = Date.now() + Math.floor(Math.random() * 1000);
        divida.parcelsPagas = 0;
        divida.historico = [];
        divida.dataCriacao = new Date().toISOString();
        debts.push(divida);
        addHistoryLog(debts.length - 1, 'Registro Criado');
        showToast('Novo registro adicionado!', 'success');
        e.target.reset();
    }

    saveDebts();
    renderDebts();
    updateStats();
    updateCharts();
}

function prepararEdicao() {
    if (currentDebtIndex === null) return;
    const debt = debts[currentDebtIndex];
    document.getElementById('editId').value = debt.id;
    document.getElementById('tipo').value = debt.tipo || 'devedor';
    document.getElementById('nome').value = debt.nome;
    document.getElementById('valor').value = debt.valor;
    document.getElementById('parcelas').value = debt.parcelas;
    document.getElementById('desc').value = debt.desc;
    document.getElementById('btnSubmitForm').textContent = 'Salvar Alterações';
    document.getElementById('btnCancelEdit').style.display = 'inline-block';
    fecharModal('modalDetails');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEdit() {
    document.getElementById('editId').value = '';
    document.getElementById('debtForm').reset();
    document.getElementById('btnSubmitForm').textContent = 'Cadastrar';
    document.getElementById('btnCancelEdit').style.display = 'none';
}

function verDetalhes(index) {
    currentDebtIndex = index;
    const debt = debts[index];
    const valorParc = debt.valor / debt.parcelas;

    document.getElementById('detailTipo').textContent = (debt.tipo || 'devedor').toUpperCase();
    document.getElementById('detailTipo').className = `status status-${debt.tipo || 'devedor'}`;
    document.getElementById('detailNome').textContent = debt.nome;
    document.getElementById('detailValor').textContent = formatMoney(debt.valor);
    document.getElementById('detailValorParcela').textContent = formatMoney(valorParc);
    document.getElementById('detailDesc').textContent = debt.desc;
    document.getElementById('detailDataCriacao').textContent = formatDateObj(debt.dataCriacao);

    renderPaymentControls();
    renderHistory();
    abrirModal('modalDetails');
}

function renderPaymentControls() {
    if (currentDebtIndex === null) return;
    const debt = debts[currentDebtIndex];
    const pagas = debt.parcelsPagas || 0;
    const total = debt.parcelas;
    const perc = Math.round((pagas / total) * 100);
    const status = calcularStatus(debt);
    let barClass = perc === 100 ? 'progress-bar-paid' : 'progress-bar-unpaid';

    const container = document.getElementById('paymentControls');
    container.innerHTML = `
        <div style="margin-bottom: 15px;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                 <div class="progress-container" style="flex: 1; height: 12px;">
                    <div class="progress-bar ${barClass}" style="width: ${perc}%"></div>
                </div>
                <span class="badge">${perc}%</span>
            </div>
            <label style="font-weight: 500;">Parcelas Pagas: <span>${pagas}</span> de <span>${total}</span></label>
        </div>
        <div id="parcelasContainer"></div>
        <div style="margin-top: 15px; display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="btn btn-success btn-sm btn-action" id="btnAddParc">+ 1 Parcela</button>
            <button class="btn btn-info btn-sm btn-action" id="btnFinish">✓ Quitar Tudo</button>
            <button class="btn btn-danger btn-sm btn-action" id="btnUndo">⚠ Desfazer (-1)</button>
        </div>
        <div style="margin-top: 15px; padding: 10px; background: rgba(15, 23, 42, 0.9); border-radius: 8px; border: 1px solid var(--border-subtle);">
            <strong>Status:</strong> <span class="status status-${status}">${status.toUpperCase()}</span>
        </div>
    `;

    // Bind item actions
    document.getElementById('btnAddParc').addEventListener('click', () => adicionarParcela(currentDebtIndex, 1));
    document.getElementById('btnFinish').addEventListener('click', finalizarDívida);
    document.getElementById('btnUndo').addEventListener('click', () => adicionarParcela(currentDebtIndex, -1));

    if (pagas >= total) {
        document.getElementById('btnAddParc').disabled = true;
        document.getElementById('btnFinish').disabled = true;
        document.getElementById('btnAddParc').style.opacity = 0.5;
        document.getElementById('btnFinish').style.opacity = 0.5;
    }
    if (pagas <= 0) {
        document.getElementById('btnUndo').disabled = true;
        document.getElementById('btnUndo').style.opacity = 0.5;
    }

    renderParcelasGrid(pagas, total);
}

function renderParcelasGrid(pagas, total) {
    const container = document.getElementById('parcelasContainer');
    container.innerHTML = Array.from({ length: total }).map((_, i) => {
        const isPaga = (i + 1) <= pagas;
        return `<div style="display: inline-block; margin: 4px; padding: 6px 10px; border-radius: 6px; background: ${isPaga ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.05)'}; border: 1px solid ${isPaga ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.2)'}; font-size:12px;">
            ${isPaga ? '✓' : '⏳'} #${i + 1}
        </div>`;
    }).join('');
}

function renderHistory() {
    const container = document.getElementById('historyList');
    const hist = debts[currentDebtIndex].historico || [];
    if (hist.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:10px; color:var(--text-muted); font-size:13px;">Sem histórico</p>';
        return;
    }
    container.innerHTML = hist.slice(0, 10).map(h => `
        <div class="history-item">
            <span class="history-action">${h.acao}</span>
            <span class="history-date">${formatDateObj(h.data)}</span>
        </div>
    `).join('');
}

function adicionarParcela(index, count) {
    const debt = debts[index];
    const oldPagas = debt.parcelsPagas || 0;
    const newPagas = Math.max(0, Math.min(oldPagas + count, debt.parcelas));
    if (oldPagas === newPagas) return;

    debts[index].parcelsPagas = newPagas;
    addHistoryLog(index, count > 0 ? `Pagamento (+${count})` : `Desfeito (-${Math.abs(count)})`);

    saveAndRefresh();

    // Atualiza o modal se ele estiver aberto para esta mesma dívida
    if (currentDebtIndex === index) {
        renderPaymentControls();
        renderHistory();
    }

    showToast(count > 0 ? 'Pagamento registrado!' : 'Pagamento desfeito.', count > 0 ? 'success' : 'info');
}

function finalizarDívida() {
    confirmAction('Quitar Dívida', 'Deseja marcar todas as parcelas como pagas?', () => {
        const debt = debts[currentDebtIndex];
        const rest = debt.parcelas - (debt.parcelsPagas || 0);
        debts[currentDebtIndex].parcelsPagas = debt.parcelas;
        addHistoryLog(currentDebtIndex, `Dívida Quitada (+${rest})`);
        saveAndRefresh();
        renderPaymentControls();
        renderHistory();
        showToast('Dívida quitada!', 'success');
    });
}

function requestDelete() {
    confirmAction('Deletar Dívida', 'Tem certeza que deseja apagar permanentemente?', () => {
        debts.splice(currentDebtIndex, 1);
        currentDebtIndex = null;
        saveAndRefresh();
        fecharModal('modalDetails');
        showToast('Dívida deletada!', 'success');
    });
}

function requestResetData() {
    confirmAction('Zerar Sistema', 'Isso apagará TUDO. Continuar?', () => {
        debts = [];
        saveAndRefresh();
        showToast('Sistema zerado.', 'error');
    });
}

function saveAndRefresh() {
    saveDebts();
    renderDebts();
    updateStats();
    updateCharts();
}

function saveDebts() {
    localStorage.setItem('debtManagerDebts', JSON.stringify(debts));
}

function updateCharts() {
    const container = document.getElementById('chartContainer');
    if (debts.length === 0) {
        container.style.display = 'none';
        return;
    }
    container.style.display = 'block';

    // Status Chart
    const statusCounts = { aberto: 0, pagando: 0, pago: 0 };
    debts.forEach(d => statusCounts[calcularStatus(d)]++);

    const ctxStatus = document.getElementById('chartStatus').getContext('2d');
    if (charts.status) charts.status.destroy();
    charts.status = new Chart(ctxStatus, {
        type: 'doughnut',
        data: {
            labels: ['Aberto', 'Pagando', 'Pago'],
            datasets: [{
                data: [statusCounts.aberto, statusCounts.pagando, statusCounts.pago],
                backgroundColor: ['#4b5563', '#3b82f6', '#22c55e'],
                borderColor: '#0f172a',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#9ca3af' } },
                title: { display: true, text: 'Status dos Registros', color: '#e5e7eb' }
            }
        }
    });

    // Values Chart (Top 5) — Cores por tipo (#11)
    const sorted = [...debts].sort((a, b) => b.valor - a.valor).slice(0, 5);
    const barColors = sorted.map(d => (d.tipo || 'devedor') === 'devedor' ? '#06b6d4' : '#f43f5e');
    const ctxValues = document.getElementById('chartValues').getContext('2d');
    if (charts.values) charts.values.destroy();
    charts.values = new Chart(ctxValues, {
        type: 'bar',
        data: {
            labels: sorted.map(d => d.nome.split(' ')[0]),
            datasets: [{
                label: 'Valor Total',
                data: sorted.map(d => d.valor),
                backgroundColor: barColors
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                x: { ticks: { color: '#9ca3af' }, grid: { display: false } }
            },
            plugins: {
                legend: { display: false },
                title: { display: true, text: 'Maiores Valores (Top 5) — 🟦 Devedor | 🟥 Dívida', color: '#e5e7eb' }
            }
        }
    });
}

const getExportDate = () => {
    const d = new Date();
    return `${d.getFullYear()}${(d.getMonth() + 1).toString().padStart(2, '0')}${d.getDate().toString().padStart(2, '0')}`;
};

function exportData(type) {
    if (debts.length === 0) return showToast('Nada para exportar.', 'error');
    const dateStr = getExportDate();

    if (type === 'json') {
        const blob = new Blob([JSON.stringify(debts, null, 2)], { type: 'application/json' });
        triggerDownload(blob, `backup_devedores_${dateStr}.json`);
        showToast('Exportação JSON concluída!', 'success');
    } else {
        // 1. Exportar Dívidas (Geral)
        let csvDebts = '\uFEFFId;Tipo;Nome;Valor Total;Parcelas Totais;Parcelas Pagas;Status;Descrição;Data Cadastro\n';
        debts.forEach(d => {
            csvDebts += `"${d.id}";"${d.tipo || 'devedor'}";"${d.nome}";"${d.valor}";"${d.parcelas}";"${d.parcelsPagas}";"${calcularStatus(d)}";"${(d.desc || '').replace(/"/g, '""')}";"${formatDateObj(d.dataCriacao)}"\n`;
        });
        triggerDownload(new Blob([csvDebts], { type: 'text/csv;charset=utf-8' }), `lista_devedores_${dateStr}.csv`);

        // 2. Exportar Histórico de Pagamentos (Referenciado)
        setTimeout(() => {
            let csvHistory = '\uFEFFID Registro;Nome Devedor/Credor;Ação;Data;ID Registro Hist\n';
            debts.forEach(d => {
                if (d.historico && d.historico.length > 0) {
                    d.historico.forEach(h => {
                        csvHistory += `"${d.id}";"${d.nome}";"${h.acao}";"${formatDateObj(h.data)}";"${h.id_registro}"\n`;
                    });
                }
            });
            triggerDownload(new Blob([csvHistory], { type: 'text/csv;charset=utf-8' }), `historico_pagamentos_${dateStr}.csv`);
            showToast('CSVs (Lista e Histórico) exportados!', 'success');
        }, 500);
    }
}

function triggerDownload(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!Array.isArray(data)) throw new Error('Dados não são um array.');

            // Validação de campos obrigatórios (#1)
            const camposObrigatorios = ['nome', 'valor', 'parcelas'];
            for (let i = 0; i < data.length; i++) {
                for (const campo of camposObrigatorios) {
                    if (data[i][campo] === undefined || data[i][campo] === null || data[i][campo] === '') {
                        throw new Error(`Item ${i + 1} está com o campo "${campo}" ausente ou vazio.`);
                    }
                }
                // Garantir campos padrão
                if (!data[i].id) data[i].id = Date.now() + i + Math.floor(Math.random() * 1000);
                if (!data[i].historico) data[i].historico = [];
                if (!data[i].parcelsPagas && data[i].parcelsPagas !== 0) data[i].parcelsPagas = 0;
                if (!data[i].tipo) data[i].tipo = 'devedor';
                if (!data[i].desc) data[i].desc = '';
                if (!data[i].dataCriacao) data[i].dataCriacao = new Date().toISOString();
            }

            confirmAction('Importar', 'Isso substituirá seus dados atuais. Continuar?', () => {
                debts = data;
                saveAndRefresh();
                showToast('Dados restaurados!', 'success');
            });
        } catch (err) {
            showToast(`Arquivo inválido: ${err.message}`, 'error');
        }
    };
    reader.readAsText(file);
    // Reset do input de arquivo (#4)
    event.target.value = '';
}

// UI Helpers
function abrirModal(id) { document.getElementById(id).classList.add('active'); }
function fecharModal(id) { document.getElementById(id).classList.remove('active'); }

function confirmAction(title, message, onOk) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    abrirModal('modalConfirm');
    const btnOk = document.getElementById('confirmBtnOk');
    const newBtnOk = btnOk.cloneNode(true);
    btnOk.replaceWith(newBtnOk);
    newBtnOk.addEventListener('click', () => { fecharModal('modalConfirm'); onOk(); });
    document.getElementById('confirmBtnCancel').onclick = () => fecharModal('modalConfirm');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
