/**
 * app.js — Dashboard Devedores v2.0
 * IndexedDB · Tema · Paginação · Parcelas clicáveis · Vencimento · Categorias
 */

// ===================== INDEXEDDB =====================
const DB_NAME    = 'DebtManagerDB';
const DB_VERSION = 1;
const STORE_NAME = 'debtsStore';

let dbInstance = null;
let debts      = [];

let currentDebtIndex = null;
let charts = { status: null, values: null, progress: null };
let currentSort = { campo: null, direcao: 'asc' };
let currentPage = 1;

// ===================== DB =====================
const openDB = () => new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id_db' });
        }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror  = () => reject(request.error);
});

const loadDataFromDB = async () => {
    try {
        dbInstance = await openDB();
        return new Promise((resolve) => {
            const tx      = dbInstance.transaction(STORE_NAME, 'readonly');
            const store   = tx.objectStore(STORE_NAME);
            const request = store.get('main_records');

            request.onsuccess = () => {
                let data = request.result ? request.result.data : null;

                // Migração automática do LocalStorage
                if (!data) {
                    const legacy = localStorage.getItem('debtManagerDebts');
                    if (legacy) {
                        data = JSON.parse(legacy);
                        localStorage.removeItem('debtManagerDebts');
                        console.log('[Migração] LocalStorage → IndexedDB OK');
                    }
                }

                debts = data || [];

                // Garantir integridade dos campos
                debts = debts.map(d => {
                    if (!d.id)          d.id          = Date.now() + Math.floor(Math.random() * 1000);
                    if (!d.historico)   d.historico   = [];
                    if (!d.dataCriacao) d.dataCriacao = new Date().toISOString();
                    if (!d.categoria)   d.categoria   = 'outros';
                    if (!d.tipo)        d.tipo        = 'devedor';
                    if (!d.desc)        d.desc        = '';
                    return d;
                });

                resolve();
            };
        });
    } catch (err) {
        console.error('[IndexedDB] Falha ao abrir:', err);
        // Fallback: tenta localStorage
        try {
            const ls = localStorage.getItem('debtManagerDebts_fallback');
            debts = ls ? JSON.parse(ls) : [];
        } catch { debts = []; }
    }
};

const saveDebts = () => {
    if (!dbInstance) {
        // Fallback localStorage se IndexedDB indisponível
        try { localStorage.setItem('debtManagerDebts_fallback', JSON.stringify(debts)); } catch {}
        return;
    }
    try {
        const tx    = dbInstance.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put({ id_db: 'main_records', data: debts });
    } catch (e) {
        console.error('[IndexedDB] Falha ao salvar:', e);
        try { localStorage.setItem('debtManagerDebts_fallback', JSON.stringify(debts)); } catch {}
    }
};

// ===================== TEMA =====================
const applyTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('devedores_theme', theme);

    const isLight = theme === 'light';
    const iconName = isLight ? 'sun' : 'moon';
    const label    = isLight ? 'Escuro' : 'Claro';

    // Desktop
    const iconEl  = document.getElementById('themeIcon');
    const labelEl = document.getElementById('themeLabel');
    if (iconEl) { iconEl.setAttribute('data-lucide', iconName); }
    if (labelEl) labelEl.textContent = label;

    // Mobile
    const iconMob  = document.getElementById('themeIconMobile');
    const labelMob = document.getElementById('themeLabelMobile');
    if (iconMob) { iconMob.setAttribute('data-lucide', iconName); }
    if (labelMob) labelMob.textContent = `Modo ${isLight ? 'Escuro' : 'Claro'}`;

    if (window.lucide) lucide.createIcons();
    updateCharts();
};

const toggleTheme = () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
};

// ===================== FORMATAÇÃO =====================
const formatMoney = (v) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const formatDateObj   = (s) => s ? new Date(s).toLocaleString('pt-BR') : '--/--/----';
const formatDateShort = (s) => s ? new Date(s).toLocaleDateString('pt-BR') : '--/--/--';

const formatVencimento = (dateStr) => {
    if (!dateStr) return null;
    const date  = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((date - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0)  return { label: `Venceu há ${Math.abs(diffDays)}d`, cls: 'urgente' };
    if (diffDays === 0) return { label: 'Vence hoje!', cls: 'urgente' };
    if (diffDays <= 7) return { label: `Vence em ${diffDays}d`, cls: 'atencao' };
    return { label: formatDateShort(dateStr), cls: 'ok' };
};

const CATEGORIA_LABELS = {
    pessoal: 'Pessoal', banco: 'Banco', cartao: 'Cartão',
    consorcio: 'Consórcio', outros: 'Outros'
};

// ===================== STATUS =====================
const calcularStatus = (debt) => {
    const total = parseInt(debt.parcelas) || 0;
    const pagas = parseInt(debt.parcelsPagas) || 0;
    if (total === 0 || pagas === 0) return 'aberto';
    return pagas < total ? 'pagando' : 'pago';
};

// ===================== HISTÓRICO =====================
const addHistoryLog = (index, msg) => {
    if (!debts[index].historico) debts[index].historico = [];
    debts[index].historico.unshift({
        id_registro: crypto.randomUUID(),
        acao: msg,
        data: new Date().toISOString()
    });
};

// ===================== INIT =====================
document.addEventListener('DOMContentLoaded', async () => {
    await loadDataFromDB();

    // Tema salvo
    const savedTheme = localStorage.getItem('devedores_theme') || 'dark';
    applyTheme(savedTheme);

    initEventListeners();
    renderDebts();
    updateStats();
    updateCharts();

    if (window.lucide) setTimeout(() => lucide.createIcons(), 50);
});

// ===================== EVENTOS =====================
function initEventListeners() {

    // Tema
    document.getElementById('themeToggleBtn')?.addEventListener('click', toggleTheme);
    document.getElementById('themeToggleMobile')?.addEventListener('click', () => { toggleTheme(); closeMobileMenu(); });

    // Mobile dropdown
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileDropdown = document.getElementById('mobileDropdown');
    mobileMenuBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = mobileDropdown.classList.contains('open');
        mobileDropdown.classList.toggle('open', !isOpen);
        mobileMenuBtn.setAttribute('aria-expanded', String(!isOpen));
    });
    document.addEventListener('click', (e) => {
        if (!mobileDropdown?.contains(e.target) && e.target !== mobileMenuBtn) {
            closeMobileMenu();
        }
    });

    const closeMobileMenu = () => {
        mobileDropdown?.classList.remove('open');
        mobileMenuBtn?.setAttribute('aria-expanded', 'false');
    };

    // Ações principais — desktop e mobile compartilham mesma lógica
    const bindAction = (ids, fn) => ids.forEach(id => document.getElementById(id)?.addEventListener('click', fn));

    bindAction(['btnReset', 'btnResetMobile'], requestResetData);
    bindAction(['btnExportCsv', 'btnExportCsvMobile'], () => exportData('csv'));
    bindAction(['btnExportJson', 'btnExportJsonMobile'], () => exportData('json'));
    bindAction(['btnImport', 'btnImportMobile'], () => document.getElementById('fileInput').click());

    document.getElementById('fileInput')?.addEventListener('change', importData);

    // Novo registro
    const openNew = () => {
        document.getElementById('debtForm').reset();
        document.getElementById('editId').value = '';
        document.getElementById('newDebtTitle').textContent = 'Novo Registro';
        document.getElementById('btnSubmitForm').innerHTML = '<i data-lucide="save" class="btn-icon"></i> Cadastrar';
        document.getElementById('btnCancelEdit').style.display = 'none';
        if (window.lucide) setTimeout(() => lucide.createIcons(), 10);
        abrirModal('modalNewDebt');
    };

    bindAction(['btnOpenNewDebt', 'btnOpenNewDebtMobile', 'btnEmptyNewDebt'], () => {
        openNew();
        closeMobileMenu();
    });

    document.getElementById('btnCloseNewDebt')?.addEventListener('click', () => fecharModal('modalNewDebt'));
    document.getElementById('debtForm')?.addEventListener('submit', handleDebtSubmit);
    document.getElementById('btnCancelEdit')?.addEventListener('click', cancelEdit);

    // Detalhes
    document.getElementById('btnCloseDetails')?.addEventListener('click', () => fecharModal('modalDetails'));
    document.getElementById('btnEditDebt')?.addEventListener('click', prepararEdicao);
    document.getElementById('btnDeleteDebt')?.addEventListener('click', requestDelete);

    // Fechar modal ao clicar fora
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) fecharModal(overlay.id);
        });
    });

    // ESC fecha modais
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.active').forEach(m => fecharModal(m.id));
            closeMobileMenu();
        }
    });

    // Filtros e paginação
    const resetPageAndRender = () => { currentPage = 1; renderDebts(); };
    document.getElementById('searchName')?.addEventListener('keyup', resetPageAndRender);
    document.getElementById('filterStatus')?.addEventListener('change', resetPageAndRender);
    document.getElementById('filterTipo')?.addEventListener('change', resetPageAndRender);
    document.getElementById('filterCategoria')?.addEventListener('change', resetPageAndRender);
    document.getElementById('filterLimit')?.addEventListener('change', resetPageAndRender);

    // Ordenação
    document.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const campo = th.dataset.sort;
            if (currentSort.campo === campo) {
                currentSort.direcao = currentSort.direcao === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.campo   = campo;
                currentSort.direcao = 'asc';
            }
            document.querySelectorAll('th.sortable').forEach(h => h.classList.remove('sort-active'));
            th.classList.add('sort-active');
            th.querySelector('.sort-icon').textContent = currentSort.direcao === 'asc' ? '↑' : '↓';
            currentPage = 1;
            renderDebts();
        });
    });
}

// ===================== RENDER DEBTS =====================
function renderDebts() {
    const tbody           = document.getElementById('debtTableBody');
    const emptyState      = document.getElementById('emptyState');
    const searchName      = document.getElementById('searchName')?.value.toLowerCase() || '';
    const filterStatus    = document.getElementById('filterStatus')?.value || 'todos';
    const filterTipo      = document.getElementById('filterTipo')?.value || 'todos';
    const filterCategoria = document.getElementById('filterCategoria')?.value || 'todas';
    const itemsPerPage    = parseInt(document.getElementById('filterLimit')?.value) || 10;

    let filtered = debts.filter(debt => {
        const status     = calcularStatus(debt);
        const matchName  = debt.nome.toLowerCase().includes(searchName);
        const matchStatus = filterStatus === 'todos' ||
            (filterStatus === 'aberto' && (status === 'aberto' || status === 'pagando')) ||
            (filterStatus === 'pago' && status === 'pago');
        const matchTipo  = filterTipo === 'todos' || (debt.tipo || 'devedor') === filterTipo;
        const matchCat   = filterCategoria === 'todas' || (debt.categoria || 'outros') === filterCategoria;
        return matchName && matchStatus && matchTipo && matchCat;
    });

    // Ordenação
    if (currentSort.campo) {
        filtered.sort((a, b) => {
            let valA, valB;
            if (currentSort.campo === 'nome') {
                valA = a.nome.toLowerCase();
                valB = b.nome.toLowerCase();
            } else if (currentSort.campo === 'valor') {
                valA = parseFloat(a.valor) || 0;
                valB = parseFloat(b.valor) || 0;
            } else if (currentSort.campo === 'progresso') {
                valA = (a.parcelsPagas || 0) / (parseInt(a.parcelas) || 1);
                valB = (b.parcelsPagas || 0) / (parseInt(b.parcelas) || 1);
            } else return 0;

            if (valA < valB) return currentSort.direcao === 'asc' ? -1 : 1;
            if (valA > valB) return currentSort.direcao === 'asc' ? 1 : -1;
            return 0;
        });
    }

    // Paginação
    const total      = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Contador
    const countEl = document.getElementById('recordCount');
    if (countEl) countEl.textContent = `${total} registro${total !== 1 ? 's' : ''}`;

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        document.getElementById('paginationControls').innerHTML = '';
        if (window.lucide) setTimeout(() => lucide.createIcons(), 10);
        return;
    }

    emptyState.style.display = 'none';

    tbody.innerHTML = paginated.map(debt => {
        const realIndex = debts.indexOf(debt);
        const total_p   = parseInt(debt.parcelas);
        const pagas     = debt.parcelsPagas || 0;
        const perc      = total_p > 0 ? Math.round((pagas / total_p) * 100) : 0;
        const status    = calcularStatus(debt);
        const barClass  = perc === 100 ? 'progress-bar-paid' : 'progress-bar-unpaid';
        const isPago    = pagas >= total_p;
        const catLabel  = CATEGORIA_LABELS[debt.categoria || 'outros'] || 'Outros';
        const venc      = formatVencimento(debt.vencimento);
        const vencBadge = !isPago && venc
            ? `<span class="vencimento-badge ${venc.cls}">${venc.label}</span>`
            : '<span style="color:var(--text-faint);font-size:12px;">—</span>';

        return `<tr>
            <td><strong>${debt.nome}</strong></td>
            <td><span class="status status-${debt.tipo || 'devedor'}">${(debt.tipo || 'devedor').toUpperCase()}</span></td>
            <td><span class="cat-tag">${catLabel}</span></td>
            <td style="font-weight:600;">${formatMoney(debt.valor)}</td>
            <td>
                <div class="progress-row">
                    <div class="progress-container" style="width:80px;">
                        <div class="progress-bar ${barClass}" style="width:${perc}%"></div>
                    </div>
                    <span style="font-size:12px;color:var(--text-muted);white-space:nowrap;">${pagas}/${total_p} (${perc}%)</span>
                </div>
            </td>
            <td><span class="status status-${status}">${status.toUpperCase()}</span></td>
            <td>${vencBadge}</td>
            <td>
                <div style="display:flex;gap:6px;">
                    <button class="btn btn-success btn-sm btn-quick-add"
                        data-index="${realIndex}"
                        aria-label="Adicionar 1 parcela"
                        ${isPago ? 'disabled' : ''}>
                        <i data-lucide="plus" class="btn-icon" aria-hidden="true"></i> 1 Parc.
                    </button>
                    <button class="btn btn-info btn-sm btn-details"
                        data-index="${realIndex}"
                        aria-label="Ver detalhes">
                        <i data-lucide="eye" class="btn-icon" aria-hidden="true"></i> Ver
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');

    // ⚠️ CORREÇÃO DO BUG: usar currentTarget em vez de target (ícone SVG filho não tem dataset)
    document.querySelectorAll('.btn-details').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.currentTarget.dataset.index);
            verDetalhes(index);
        });
    });

    document.querySelectorAll('.btn-quick-add').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.currentTarget.dataset.index);
            e.currentTarget.classList.remove('btn-quick-flash');
            void e.currentTarget.offsetWidth; // force reflow
            e.currentTarget.classList.add('btn-quick-flash');
            adicionarParcela(index, 1);
        });
    });

    if (window.lucide) setTimeout(() => lucide.createIcons(), 10);

    renderPagination(totalPages, total, itemsPerPage);
}

// ===================== PAGINAÇÃO =====================
function renderPagination(totalPages, total, itemsPerPage) {
    const container = document.getElementById('paginationControls');
    if (!container) return;
    container.innerHTML = '';
    if (totalPages <= 1) return;

    const start = (currentPage - 1) * itemsPerPage + 1;
    const end   = Math.min(currentPage * itemsPerPage, total);

    const info = document.createElement('span');
    info.className = 'pagination-info';
    info.textContent = `${start}–${end} de ${total}`;

    const createBtn = (html, page, disabled = false, active = false) => {
        const btn = document.createElement('button');
        btn.innerHTML = html;
        btn.className = `btn${active ? ' active' : ''}`;
        btn.disabled  = disabled;
        if (!disabled) btn.addEventListener('click', () => { currentPage = page; renderDebts(); });
        return btn;
    };

    container.appendChild(createBtn('←', currentPage - 1, currentPage === 1));
    container.appendChild(info);

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            container.appendChild(createBtn(String(i), i, false, i === currentPage));
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            const dots = document.createElement('span');
            dots.textContent = '…';
            dots.style.cssText = 'align-self:center;color:var(--text-muted);padding:0 2px;font-size:13px;';
            container.appendChild(dots);
        }
    }

    container.appendChild(createBtn('→', currentPage + 1, currentPage === totalPages));
}

// ===================== STATS =====================
function updateStats() {
    const qtdDevedores  = debts.filter(d => (d.tipo || 'devedor') === 'devedor').length;
    const qtdDividas    = debts.filter(d => d.tipo === 'divida').length;
    let totalReceber = 0, totalPagar = 0, totalParcelas = 0, totalPagas = 0;

    debts.forEach(d => {
        const val = parseFloat(d.valor) || 0;
        if (d.tipo === 'divida') totalPagar   += val;
        else                     totalReceber += val;
        totalParcelas += parseInt(d.parcelas)    || 0;
        totalPagas    += parseInt(d.parcelsPagas) || 0;
    });

    document.getElementById('totalDevedores').textContent      = qtdDevedores;
    document.getElementById('totalDividas').textContent        = qtdDividas;
    document.getElementById('totalValor').textContent          = formatMoney(totalReceber);
    document.getElementById('totalPagar').textContent          = formatMoney(totalPagar);
    document.getElementById('parcelasProgresso').textContent   = `${totalPagas}/${totalParcelas}`;

    const pgGlobal = totalParcelas > 0 ? (totalPagas / totalParcelas) * 100 : 0;
    document.getElementById('progressGeral').style.width = `${pgGlobal}%`;

    if (window.lucide) setTimeout(() => lucide.createIcons(), 10);
}

// ===================== HANDLESUBMIT =====================
function handleDebtSubmit(e) {
    e.preventDefault();
    const editId = document.getElementById('editId').value;
    const divida = {
        tipo:      document.getElementById('tipo').value,
        categoria: document.getElementById('categoria').value,
        nome:      document.getElementById('nome').value.trim(),
        valor:     parseFloat(document.getElementById('valor').value),
        parcelas:  parseInt(document.getElementById('parcelas').value),
        desc:      document.getElementById('desc').value.trim(),
        vencimento: document.getElementById('vencimento').value || null,
    };

    if (!divida.nome || !divida.valor || divida.valor <= 0 || !divida.parcelas || divida.parcelas < 1) {
        showToast('Preencha todos os campos obrigatórios corretamente.', 'error');
        return;
    }

    if (editId !== '') {
        const idToEdit = parseInt(editId);
        const index    = debts.findIndex(d => d.id === idToEdit);
        if (index !== -1) {
            divida.id          = idToEdit;
            divida.parcelsPagas = Math.min(debts[index].parcelsPagas || 0, divida.parcelas);
            divida.historico   = debts[index].historico || [];
            divida.dataCriacao = debts[index].dataCriacao || new Date().toISOString();
            debts[index] = divida;
            addHistoryLog(index, 'Registro Atualizado (Edição)');
            showToast('Registro atualizado!', 'success');
        }
        cancelEdit();
    } else {
        divida.id          = Date.now() + Math.floor(Math.random() * 1000);
        divida.parcelsPagas = 0;
        divida.historico   = [];
        divida.dataCriacao = new Date().toISOString();
        debts.push(divida);
        addHistoryLog(debts.length - 1, 'Registro Criado');
        showToast('Novo registro adicionado!', 'success');
        e.target.reset();
    }

    saveAndRefresh();
    fecharModal('modalNewDebt');
}

// ===================== EDIÇÃO =====================
function prepararEdicao() {
    if (currentDebtIndex === null) return;
    const debt = debts[currentDebtIndex];
    document.getElementById('editId').value       = debt.id;
    document.getElementById('tipo').value         = debt.tipo || 'devedor';
    document.getElementById('categoria').value    = debt.categoria || 'outros';
    document.getElementById('nome').value         = debt.nome;
    document.getElementById('valor').value        = debt.valor;
    document.getElementById('parcelas').value     = debt.parcelas;
    document.getElementById('desc').value         = debt.desc;
    document.getElementById('vencimento').value   = debt.vencimento || '';
    document.getElementById('btnSubmitForm').innerHTML = '<i data-lucide="save" class="btn-icon"></i> Salvar Alterações';
    document.getElementById('newDebtTitle').textContent  = 'Editar Registro';
    document.getElementById('btnCancelEdit').style.display = 'inline-flex';
    if (window.lucide) setTimeout(() => lucide.createIcons(), 10);
    fecharModal('modalDetails');
    abrirModal('modalNewDebt');
}

function cancelEdit() {
    document.getElementById('editId').value = '';
    document.getElementById('debtForm').reset();
    document.getElementById('btnSubmitForm').innerHTML = '<i data-lucide="save" class="btn-icon"></i> Cadastrar';
    document.getElementById('newDebtTitle').textContent  = 'Novo Registro';
    document.getElementById('btnCancelEdit').style.display = 'none';
    fecharModal('modalNewDebt');
}

// ===================== DETALHES =====================
function verDetalhes(index) {
    currentDebtIndex = index;
    const debt = debts[index];
    if (!debt) return;

    const valorParc = debt.valor / debt.parcelas;
    const catLabel  = CATEGORIA_LABELS[debt.categoria || 'outros'] || 'Outros';
    const venc      = formatVencimento(debt.vencimento);

    document.getElementById('detailTipo').textContent  = (debt.tipo || 'devedor').toUpperCase();
    document.getElementById('detailTipo').className    = `status status-${debt.tipo || 'devedor'}`;
    document.getElementById('detailCategoria').textContent = catLabel;
    document.getElementById('detailNome').textContent      = debt.nome;
    document.getElementById('detailValor').textContent     = formatMoney(debt.valor);
    document.getElementById('detailValorParcela').textContent = formatMoney(valorParc);
    document.getElementById('detailDesc').textContent      = debt.desc || '—';
    document.getElementById('detailDataCriacao').textContent = formatDateObj(debt.dataCriacao);

    const vencRow = document.getElementById('detailVencimentoRow');
    const vencEl  = document.getElementById('detailVencimento');
    if (debt.vencimento && venc) {
        vencEl.innerHTML = `<span class="vencimento-badge ${venc.cls}">${venc.label}</span>`;
        vencRow.style.display = '';
    } else {
        vencRow.style.display = 'none';
    }

    renderPaymentControls();
    renderHistory();
    abrirModal('modalDetails');
    if (window.lucide) setTimeout(() => lucide.createIcons(), 10);
}

// ===================== PAYMENT CONTROLS =====================
function renderPaymentControls() {
    if (currentDebtIndex === null) return;
    const debt  = debts[currentDebtIndex];
    const pagas = debt.parcelsPagas || 0;
    const total = debt.parcelas;
    const perc  = Math.round((pagas / total) * 100);
    const status = calcularStatus(debt);
    const barClass = perc === 100 ? 'progress-bar-paid' : 'progress-bar-unpaid';

    const container = document.getElementById('paymentControls');
    container.innerHTML = `
        <div style="margin-bottom:16px;">
            <div class="progress-row" style="margin-bottom:6px;">
                <div class="progress-container"><div class="progress-bar ${barClass}" style="width:${perc}%"></div></div>
                <span class="badge">${perc}%</span>
            </div>
            <p style="font-size:13px;color:var(--text-muted);">
                <strong style="color:var(--text-primary);">${pagas}</strong> de <strong style="color:var(--text-primary);">${total}</strong> parcelas pagas
            </p>
        </div>
        <div id="parcelasContainer"></div>
        <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-success btn-sm" id="btnAddParc" ${pagas >= total ? 'disabled' : ''}>+ 1 Parcela</button>
            <button class="btn btn-info btn-sm" id="btnFinish" ${pagas >= total ? 'disabled' : ''}>
                <i data-lucide="check-circle" class="btn-icon" aria-hidden="true"></i> Quitar Tudo
            </button>
            <button class="btn btn-danger btn-sm" id="btnUndo" ${pagas <= 0 ? 'disabled' : ''}>
                <i data-lucide="rotate-ccw" class="btn-icon" aria-hidden="true"></i> Desfazer (-1)
            </button>
        </div>
        <div style="margin-top:14px;padding:10px 14px;background:var(--bg-elevated);border-radius:10px;border:1px solid var(--border-subtle);font-size:13px;">
            <strong>Status atual:</strong> <span class="status status-${status}">${status.toUpperCase()}</span>
        </div>
    `;

    document.getElementById('btnAddParc')?.addEventListener('click', () => adicionarParcela(currentDebtIndex, 1));
    document.getElementById('btnFinish')?.addEventListener('click', finalizarDivida);
    document.getElementById('btnUndo')?.addEventListener('click', () => adicionarParcela(currentDebtIndex, -1));

    renderParcelasGrid(pagas, total);
    if (window.lucide) setTimeout(() => lucide.createIcons(), 10);
}

// ===================== PARCELAS CLICÁVEIS =====================
function renderParcelasGrid(pagas, total) {
    const container = document.getElementById('parcelasContainer');
    if (!container) return;

    container.innerHTML = Array.from({ length: total }, (_, i) => {
        const isPaga = (i + 1) <= pagas;
        return `<div class="parcela-item ${isPaga ? 'paga' : 'nao-paga'}"
            data-parcela="${i + 1}"
            title="${isPaga ? 'Clique para desmarcar' : 'Clique para marcar como paga'}"
            role="checkbox"
            aria-checked="${isPaga}"
            tabindex="0">
            ${isPaga ? '✓' : '○'} #${i + 1}
        </div>`;
    }).join('');

    container.querySelectorAll('.parcela-item').forEach(el => {
        const clickHandler = () => {
            const num   = parseInt(el.dataset.parcela);
            const debt  = debts[currentDebtIndex];
            const atual = debt.parcelsPagas || 0;

            if (num <= atual) {
                // Desmarcar — regressão até (num - 1)
                const diff = atual - (num - 1);
                debts[currentDebtIndex].parcelsPagas = num - 1;
                addHistoryLog(currentDebtIndex, `Parcela #${num} desmarcada (Desfeito -${diff})`);
            } else {
                // Marcar — avança até num
                debts[currentDebtIndex].parcelsPagas = num;
                addHistoryLog(currentDebtIndex, `Parcelas até #${num} marcadas (+${num - atual})`);
            }

            saveAndRefresh();
            renderPaymentControls();
            renderHistory();
            showToast('Parcelas atualizadas!', 'success');
        };

        el.addEventListener('click', clickHandler);
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clickHandler(); }
        });
    });
}

// ===================== HISTÓRICO =====================
function renderHistory() {
    const container = document.getElementById('historyList');
    if (!container || currentDebtIndex === null) return;
    const hist = debts[currentDebtIndex].historico || [];

    if (hist.length === 0) {
        container.innerHTML = '<p style="text-align:center;padding:14px;color:var(--text-muted);font-size:13px;">Sem histórico</p>';
        return;
    }

    container.innerHTML = hist.slice(0, 15).map(h => `
        <div class="history-item">
            <span class="history-action">${h.acao}</span>
            <span class="history-date">${formatDateObj(h.data)}</span>
        </div>
    `).join('');
}

// ===================== PARCELAS =====================
function adicionarParcela(index, count) {
    const debt    = debts[index];
    const oldPagas = debt.parcelsPagas || 0;
    const newPagas = Math.max(0, Math.min(oldPagas + count, debt.parcelas));
    if (oldPagas === newPagas) return;

    debts[index].parcelsPagas = newPagas;
    addHistoryLog(index, count > 0 ? `Pagamento (+${count})` : `Desfeito (-${Math.abs(count)})`);
    saveAndRefresh();

    if (currentDebtIndex === index) {
        renderPaymentControls();
        renderHistory();
    }

    showToast(count > 0 ? 'Pagamento registrado!' : 'Pagamento desfeito.', count > 0 ? 'success' : 'info');
}

function finalizarDivida() {
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
    const name = debts[currentDebtIndex]?.nome || 'este registro';
    confirmAction('Excluir Registro', `Deseja apagar permanentemente "${name}"? Esta ação não pode ser desfeita.`, () => {
        debts.splice(currentDebtIndex, 1);
        currentDebtIndex = null;
        saveAndRefresh();
        fecharModal('modalDetails');
        showToast('Registro excluído!', 'success');
    });
}

function requestResetData() {
    confirmAction('Zerar Sistema', 'Isso apagará TODOS os registros permanentemente. Certifique-se de ter feito um backup antes.', () => {
        debts = [];
        saveAndRefresh();
        showToast('Sistema zerado.', 'info');
    });
}

function saveAndRefresh() {
    saveDebts();
    renderDebts();
    updateStats();
    updateCharts();
}

// ===================== GRÁFICOS =====================
function getChartColors() {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    return {
        text:    isLight ? '#475569' : '#94a3b8',
        grid:    isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)',
        tooltipBg:   isLight ? '#ffffff' : '#0f172a',
        tooltipText: isLight ? '#0f172a' : '#f8fafc',
    };
}

function updateCharts() {
    const section = document.getElementById('chartSection');
    if (debts.length === 0) {
        section.style.display = 'none';
        return;
    }
    section.style.display = 'block';

    const c = getChartColors();

    // Gráfico 1: Balanço (Doughnut)
    let totalDevedores = 0, totalDividas = 0;
    debts.forEach(d => {
        if ((d.tipo || 'devedor') === 'devedor') totalDevedores += parseFloat(d.valor) || 0;
        else totalDividas += parseFloat(d.valor) || 0;
    });

    const ctxStatus = document.getElementById('chartStatus')?.getContext('2d');
    if (ctxStatus) {
        if (charts.status) charts.status.destroy();
        charts.status = new Chart(ctxStatus, {
            type: 'doughnut',
            data: {
                labels: ['A Receber', 'A Pagar'],
                datasets: [{
                    data: [totalDevedores, totalDividas],
                    backgroundColor: ['rgba(6,182,212,0.8)', 'rgba(244,63,94,0.8)'],
                    borderColor: ['#06b6d4', '#f43f5e'],
                    borderWidth: 2, hoverOffset: 6
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '65%',
                plugins: {
                    legend: { position: 'bottom', labels: { color: c.text, font: { family: 'Plus Jakarta Sans', size: 12 }, padding: 12, boxWidth: 12 } },
                    tooltip: {
                        backgroundColor: c.tooltipBg, titleColor: c.tooltipText, bodyColor: c.tooltipText,
                        callbacks: { label: ctx => ` ${formatMoney(ctx.raw)}` }
                    }
                }
            }
        });
    }

    // Gráfico 2: Top 5 (Barra horizontal)
    const sorted   = [...debts].sort((a, b) => b.valor - a.valor).slice(0, 5);
    const ctxValues = document.getElementById('chartValues')?.getContext('2d');
    if (ctxValues) {
        if (charts.values) charts.values.destroy();
        charts.values = new Chart(ctxValues, {
            type: 'bar',
            data: {
                labels: sorted.map(d => d.nome.length > 16 ? d.nome.slice(0, 16) + '…' : d.nome),
                datasets: [{
                    label: 'Valor',
                    data: sorted.map(d => d.valor),
                    backgroundColor: sorted.map(d => (d.tipo || 'devedor') === 'devedor' ? 'rgba(6,182,212,0.75)' : 'rgba(244,63,94,0.75)'),
                    borderColor:     sorted.map(d => (d.tipo || 'devedor') === 'devedor' ? '#06b6d4' : '#f43f5e'),
                    borderWidth: 1.5, borderRadius: 6
                }]
            },
            options: {
                indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: c.tooltipBg, titleColor: c.tooltipText, bodyColor: c.tooltipText,
                        callbacks: { label: ctx => ` ${formatMoney(ctx.raw)}` }
                    }
                },
                scales: {
                    y: { ticks: { color: c.text, font: { size: 12 } }, grid: { display: false } },
                    x: { ticks: { color: c.text, font: { size: 11 }, callback: v => `R$${v}` }, grid: { color: c.grid } }
                }
            }
        });
    }

    // Gráfico 3: Progresso (barra por devedor)
    const ctxProg = document.getElementById('chartProgress')?.getContext('2d');
    if (ctxProg) {
        if (charts.progress) charts.progress.destroy();
        const top8 = [...debts].sort((a, b) => (b.parcelsPagas || 0) / (b.parcelas || 1) - (a.parcelsPagas || 0) / (a.parcelas || 1)).slice(0, 8);
        const percData = top8.map(d => {
            const t = parseInt(d.parcelas) || 1;
            const p = parseInt(d.parcelsPagas) || 0;
            return Math.round((p / t) * 100);
        });

        charts.progress = new Chart(ctxProg, {
            type: 'bar',
            data: {
                labels: top8.map(d => d.nome.length > 14 ? d.nome.slice(0, 14) + '…' : d.nome),
                datasets: [{
                    label: '% Pago',
                    data: percData,
                    backgroundColor: percData.map(p => p >= 100 ? 'rgba(34,197,94,0.8)' : p >= 50 ? 'rgba(59,130,246,0.8)' : 'rgba(245,158,11,0.8)'),
                    borderColor:     percData.map(p => p >= 100 ? '#22c55e' : p >= 50 ? '#3b82f6' : '#f59e0b'),
                    borderWidth: 1.5, borderRadius: 6, borderSkipped: false
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: c.tooltipBg, titleColor: c.tooltipText, bodyColor: c.tooltipText,
                        callbacks: { label: ctx => ` ${ctx.raw}% pago` }
                    }
                },
                scales: {
                    x: { ticks: { color: c.text, font: { size: 11 } }, grid: { display: false } },
                    y: { min: 0, max: 100, ticks: { color: c.text, font: { size: 10 }, callback: v => `${v}%` }, grid: { color: c.grid } }
                }
            }
        });
    }
}

// ===================== EXPORT / IMPORT =====================
const getExportDate = () => {
    const d = new Date();
    return `${d.getFullYear()}${(d.getMonth()+1).toString().padStart(2,'0')}${d.getDate().toString().padStart(2,'0')}`;
};

// ⚠️ CORREÇÃO: revokeObjectURL após download
function triggerDownload(blob, name) {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function exportData(type) {
    if (debts.length === 0) { showToast('Nada para exportar.', 'error'); return; }
    const dateStr = getExportDate();

    if (type === 'json') {
        const blob = new Blob([JSON.stringify(debts, null, 2)], { type: 'application/json' });
        triggerDownload(blob, `backup_devedores_${dateStr}.json`);
        showToast('Backup JSON exportado!', 'success');
    } else {
        let csv = '\uFEFFId;Tipo;Categoria;Nome;Valor Total;Parcelas Totais;Parcelas Pagas;Status;Vencimento;Descrição;Data Cadastro\n';
        debts.forEach(d => {
            csv += `"${d.id}";"${d.tipo || 'devedor'}";"${CATEGORIA_LABELS[d.categoria] || 'Outros'}";"${d.nome}";"${d.valor}";"${d.parcelas}";"${d.parcelsPagas || 0}";"${calcularStatus(d)}";"${d.vencimento || ''}";"${(d.desc || '').replace(/"/g, '""')}";"${formatDateObj(d.dataCriacao)}"\n`;
        });
        triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `lista_devedores_${dateStr}.csv`);

        setTimeout(() => {
            let csvHist = '\uFEFFID Registro;Nome;Ação;Data;ID Histórico\n';
            debts.forEach(d => {
                (d.historico || []).forEach(h => {
                    csvHist += `"${d.id}";"${d.nome}";"${h.acao}";"${formatDateObj(h.data)}";"${h.id_registro}"\n`;
                });
            });
            triggerDownload(new Blob([csvHist], { type: 'text/csv;charset=utf-8' }), `historico_pagamentos_${dateStr}.csv`);
            showToast('CSVs exportados!', 'success');
        }, 500);
    }
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!Array.isArray(data)) throw new Error('Dados não são um array válido.');

            const campos = ['nome', 'valor', 'parcelas'];
            for (let i = 0; i < data.length; i++) {
                for (const campo of campos) {
                    if (data[i][campo] === undefined || data[i][campo] === null || data[i][campo] === '') {
                        throw new Error(`Item ${i + 1}: campo "${campo}" ausente.`);
                    }
                }
                if (!data[i].id)          data[i].id          = Date.now() + i + Math.floor(Math.random() * 1000);
                if (!data[i].historico)   data[i].historico   = [];
                if (data[i].parcelsPagas === undefined) data[i].parcelsPagas = 0;
                if (!data[i].tipo)        data[i].tipo        = 'devedor';
                if (!data[i].desc)        data[i].desc        = '';
                if (!data[i].dataCriacao) data[i].dataCriacao = new Date().toISOString();
                if (!data[i].categoria)   data[i].categoria   = 'outros';
            }

            confirmAction('Importar Backup', `Importar ${data.length} registro(s)? Os dados atuais serão substituídos.`, () => {
                debts = data;
                saveAndRefresh();
                showToast(`${data.length} registro(s) importado(s)!`, 'success');
            }, 'info');
        } catch (err) {
            showToast(`Arquivo inválido: ${err.message}`, 'error');
        }
        event.target.value = '';
    };
    reader.readAsText(file);
}

// ===================== UI HELPERS =====================
function abrirModal(id) { document.getElementById(id)?.classList.add('active'); }
function fecharModal(id) { document.getElementById(id)?.classList.remove('active'); }

function confirmAction(title, message, onOk) {
    document.getElementById('confirmTitle').textContent   = title;
    document.getElementById('confirmMessage').textContent = message;
    abrirModal('modalConfirm');

    const btnOk    = document.getElementById('confirmBtnOk');
    const newBtnOk = btnOk.cloneNode(true);
    btnOk.replaceWith(newBtnOk);
    newBtnOk.addEventListener('click', () => { fecharModal('modalConfirm'); onOk(); }, { once: true });
    document.getElementById('confirmBtnCancel').onclick = () => fecharModal('modalConfirm');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast     = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = { success: 'check-circle', error: 'alert-circle', info: 'info' };
    toast.innerHTML = `<i data-lucide="${icons[type] || 'info'}"></i><span>${message}</span>`;
    container.appendChild(toast);

    if (window.lucide) setTimeout(() => lucide.createIcons(), 10);

    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 350);
    }, 3200);
}
