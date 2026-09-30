// =================================================================
// SMARTBUS v17.0 - DOWNLOAD COM RENOMEAÇÃO INTELIGENTE
// Lógica de extração baseada no PRIGIA V2
// =================================================================

let processando = false;
let processandoTimestamp = 0;
const indicesSelecionados = new Set();
let cancelarProcesso = false;

// Estados salvos no localStorage
let extensaoAtiva = localStorage.getItem('sb_extensao_ativa') !== 'false';
let usarPastaPersonalizada = localStorage.getItem('sb_usar_pasta') !== 'false';
let autoDownloadAtivo = localStorage.getItem('sb_auto_download') === 'true';
let mostrarInfoAtivo = localStorage.getItem('sb_mostrar_info') === 'true';
let carregandoInfo = false;

// Cache de nomes de passageiros (chave = texto do item, valor = nome)
function carregarCacheNomes() {
    try {
        const cached = localStorage.getItem('sb_cache_nomes');
        return cached ? JSON.parse(cached) : {};
    } catch (e) { return {}; }
}
function salvarCacheNomes(cache) {
    localStorage.setItem('sb_cache_nomes', JSON.stringify(cache));
}
let cacheNomes = carregarCacheNomes();

// Configura o PDF.js Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.min.js');

// Monitora a tela a cada 200ms
setInterval(() => {
    const menu = document.querySelector('.master-print-detail');

    // Safety: se processando ficou travado por mais de 2 minutos, resetar
    if (processando && processandoTimestamp > 0 && (Date.now() - processandoTimestamp > 120000)) {
        console.warn('⚠️ Prigia Download: Reset processando (timeout 2min)');
        processando = false;
        processandoTimestamp = 0;
        const btn = document.getElementById('sb-btn-download');
        if (btn) {
            btn.innerText = 'BAIXAR SELECIONADOS 📥';
            btn.disabled = false;
        }
        const statusDiv = document.getElementById('sb-status');
        if (statusDiv) statusDiv.style.display = 'none';
    }

    if (!extensaoAtiva) {
        const painelExistente = document.getElementById('smartbus-controls');
        if (painelExistente) {
            const conteudoPrincipal = painelExistente.querySelector('#sb-main-content');
            if (conteudoPrincipal) conteudoPrincipal.style.display = 'none';
        }
        // Limpar seção de horários se extensão desativada
        const secaoHorariosOff = document.getElementById('sb-horarios-section');
        if (secaoHorariosOff) secaoHorariosOff.remove();
        return;
    }

    if (menu && menu.style.display !== 'none' && !processando && !carregandoInfo) {
        if (!document.getElementById('smartbus-controls')) {
            criarPainelTopo(menu);
        }
        injetarCaixinhas(menu);

        const conteudoPrincipal = document.querySelector('#sb-main-content');
        if (conteudoPrincipal) conteudoPrincipal.style.display = 'flex';

        if (autoDownloadAtivo && verificarSeTemNovosParaBaixar(menu)) {
            executarAutoDownloadGeral(menu);
        } else if (mostrarInfoAtivo && !carregandoInfo && !processando) {
            // Auto-carregar info SOMENTE se auto-download não está rodando
            atualizarLabelsNomes(menu);
            carregarInfoPassageiros(menu);
        }
    }

    // ---- TELA DE RESERVA: detectar e gerenciar botão de horários ----
    const telaReserva = detectarTelaReserva();
    if (telaReserva) {
        if (!document.getElementById('sb-horarios-section')) {
            injetarBotaoHorarios();
        }
    } else {
        const secaoHorariosExistente = document.getElementById('sb-horarios-section');
        if (secaoHorariosExistente) secaoHorariosExistente.remove();
    }
}, 200);

// Verifica se existem PDFs novos na tela que ainda não foram baixados
function verificarSeTemNovosParaBaixar(menuContainer) {
    if (!extensaoAtiva) return false;

    const itensAtuais = Array.from(menuContainer.querySelectorAll('.spn-item'));
    const historicoStr = localStorage.getItem('sb_historico_downloads') || "[]";
    let historico = [];
    try { historico = JSON.parse(historicoStr); } catch (e) { }

    for (let i = 0; i < itensAtuais.length; i++) {
        const item = itensAtuais[i];
        const texto = obterTextoOriginalItem(item);
        if (texto.includes('DABPe')) {
            const nomeLimpoParaHistorico = gerarChaveHistorico(item);
            if (!historico.includes(nomeLimpoParaHistorico)) {
                return true; // Encontrou pelo menos um novo
            }
        }
    }
    return false;
}

// =================================================================
// PAINEL DE DOWNLOAD (tela de bilhetes)
// =================================================================

function criarPainelTopo(menuContainer) {
    const div = document.createElement('div');
    div.id = 'smartbus-controls';
    div.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';

    const ultimaPasta = localStorage.getItem('sb_last_folder');
    const sugestao = new Date().toLocaleDateString('pt-BR').split('/').reverse().join('-');
    const valorInicial = ultimaPasta !== null ? ultimaPasta : sugestao;

    div.innerHTML = `
        <!-- HEADER COM TOGGLES -->
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom: 4px;">
            <div style="font-weight:600; font-size:15px; color:#111; display:flex; align-items:center; gap:6px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                Prigia Download
            </div>

            <div style="display:flex; align-items:center; gap:8px;">
                <!-- Botão Caixa Final -->
                <button class="sb-caixa-btn" id="sb-btn-caixa" title="Caixa Final">
                    🖨️
                    <span class="sb-caixa-badge" id="sb-caixa-badge">0</span>
                </button>

                <!-- Toggle Extensão ON/OFF -->
                <label class="sb-toggle-container" style="display:flex; align-items:center; gap:8px; cursor:pointer; user-select:none;">
                    <span style="font-size:12px; font-weight:500; color:${extensaoAtiva ? '#111' : '#888'};" id="sb-ext-status">
                        ${extensaoAtiva ? 'Ativada' : 'Desativada'}
                    </span>
                    <div class="sb-toggle-switch ${extensaoAtiva ? 'active' : ''}" id="sb-toggle-ext">
                        <div class="sb-toggle-slider"></div>
                    </div>
                </label>
            </div>
        </div>

        <!-- CONTEÚDO PRINCIPAL -->
        <div id="sb-main-content" style="display:${extensaoAtiva ? 'flex' : 'none'}; flex-direction:column; gap:8px;">

            <!-- Toggle Auto Download -->
            <div style="display:flex; align-items:center; justify-content:space-between; background:#f8f8fc; padding:14px; border-radius:10px; border:1px solid #ebebf0; transition:all 0.2s ease;">
                <div style="display:flex; flex-direction:column; gap:2px;">
                    <span style="font-size:13px; font-weight:500; color:#111;">Auto Download</span>
                    <span style="font-size:11px; color:#666;" id="sb-auto-desc">
                        ${autoDownloadAtivo ? 'Baixando novos automaticamente' : 'Download automático desativado'}
                    </span>
                </div>
                <div class="sb-toggle-switch ${autoDownloadAtivo ? 'active' : ''}" id="sb-toggle-auto">
                    <div class="sb-toggle-slider"></div>
                </div>
            </div>

            <!-- Toggle Pasta Personalizada -->
            <div style="display:flex; align-items:center; justify-content:space-between; background:#f8f8fc; padding:14px; border-radius:10px; border:1px solid #ebebf0; transition:all 0.2s ease;">
                <div style="display:flex; flex-direction:column; gap:2px;">
                    <span style="font-size:13px; font-weight:500; color:#111;">Pasta Personalizada</span>
                    <span style="font-size:11px; color:#666;" id="sb-pasta-desc">
                        ${usarPastaPersonalizada ? 'Salvando em pasta escolhida' : 'Salvando direto em Downloads'}
                    </span>
                </div>
                <div class="sb-toggle-switch ${usarPastaPersonalizada ? 'active' : ''}" id="sb-toggle-pasta">
                    <div class="sb-toggle-slider"></div>
                </div>
            </div>

            <!-- Campo de Pasta -->
            <div id="sb-pasta-container" style="display:${usarPastaPersonalizada ? 'flex' : 'none'}; flex-direction:column; gap:6px; padding: 0 4px;">
                <input type="text" id="sb-folder-name" value="${valorInicial}"
                       placeholder="Ex: 2026/Janeiro/Dia19"
                       style="width:100%; padding:10px 12px; border:1.5px solid #e0e0e5; border-radius:8px; font-size:13px; font-weight:400; color:#1a1a2e; outline:none; transition:all 0.2s ease; box-sizing:border-box;">
                <div style="display:flex; justify-content: space-between; align-items: center; width: 100%;">
                    <span style="font-size:11px; color:#888;">
                        Use <b>/</b> para criar subpastas.
                    </span>
                    <span id="sb-limpar-historico" style="font-size:11px; color:#111; cursor:pointer; font-weight:500; text-decoration:underline;">
                        Resetar histórico
                    </span>
                </div>
            </div>

            <div style="height:1px; background-color:#ebebf0; width:100%; margin: 6px 0;"></div>

            <!-- Mostrar Informações -->
            <div style="display:flex; align-items:center; justify-content:space-between; background:#f8f8fc; padding:14px; border-radius:10px; border:1px solid #ebebf0; transition:all 0.2s ease;">
                <div style="display:flex; flex-direction:column; gap:2px;">
                    <span style="font-size:13px; font-weight:500; color:#111;">Nomes dos Passageiros</span>
                    <span style="font-size:11px; color:#666;" id="sb-info-desc">
                        ${mostrarInfoAtivo ? 'Sendo exibidos na lista' : 'Ocultos para focar no bilhete'}
                    </span>
                </div>
                <div class="sb-toggle-switch ${mostrarInfoAtivo ? 'active' : ''}" id="sb-toggle-info">
                    <div class="sb-toggle-slider"></div>
                </div>
            </div>

            <!-- Selecionar Todos -->
            <div style="margin-top: 4px;">
                <label style="display:flex; align-items:center; cursor:pointer; width:fit-content; padding: 4px;">
                    <input type="checkbox" id="sb-master-chk" style="width:16px; height:16px; margin-right:8px; cursor:pointer; accent-color:#303f9f; border: 1px solid #ddd; border-radius: 4px;">
                    <span style="font-weight:500; font-size:12px; color:#333;">Selecionar todos</span>
                </label>
            </div>

            <!-- Botão Download -->
            <button id="sb-btn-download" class="smartbus-btn-action">
                Baixar Selecionados
            </button>

            <!-- Botão Parar -->
            <button id="sb-btn-parar" style="display:none; width:100%; padding:11px; background:transparent; color:#d93025; border:1.5px solid #f0f0f5; border-radius:10px; font-weight:600; font-size:13px; cursor:pointer; margin-top:4px; transition:all 0.2s ease;">
                Parar processo
            </button>

            <!-- Status -->
            <div id="sb-status" style="font-size: 11px; color: #666; text-align: center; display: none; margin-top: 4px;">
                Processando...
            </div>
        </div>
    `;

    const titulo = menuContainer.querySelector('.spn-options-title');
    if (titulo) {
        titulo.insertAdjacentElement('afterend', div);
    }

    injetarEstilosToggle();

    // --- EVENTOS ---

    div.querySelector('#sb-toggle-auto').addEventListener('click', () => {
        autoDownloadAtivo = !autoDownloadAtivo;
        localStorage.setItem('sb_auto_download', autoDownloadAtivo);

        const toggle = div.querySelector('#sb-toggle-auto');
        const autoDesc = div.querySelector('#sb-auto-desc');

        toggle.classList.toggle('active', autoDownloadAtivo);
        autoDesc.textContent = autoDownloadAtivo ? 'Baixando novos automaticamente' : 'Download automático desativado';

        if (autoDownloadAtivo && !processando) {
            const menu = document.querySelector('.master-print-detail');
            if (menu && menu.style.display !== 'none' && verificarSeTemNovosParaBaixar(menu)) {
                executarAutoDownloadGeral(menu);
            }
        }
    });

    div.querySelector('#sb-toggle-ext').addEventListener('click', () => {
        extensaoAtiva = !extensaoAtiva;
        localStorage.setItem('sb_extensao_ativa', extensaoAtiva);

        const toggle = div.querySelector('#sb-toggle-ext');
        const status = div.querySelector('#sb-ext-status');
        const mainContent = div.querySelector('#sb-main-content');

        toggle.classList.toggle('active', extensaoAtiva);
        status.textContent = extensaoAtiva ? 'Ativada' : 'Desativada';
        status.style.color = extensaoAtiva ? '#111' : '#888';
        mainContent.style.display = extensaoAtiva ? 'flex' : 'none';
    });

    div.querySelector('#sb-toggle-pasta').addEventListener('click', () => {
        usarPastaPersonalizada = !usarPastaPersonalizada;
        localStorage.setItem('sb_usar_pasta', usarPastaPersonalizada);

        const toggle = div.querySelector('#sb-toggle-pasta');
        const pastaContainer = div.querySelector('#sb-pasta-container');
        const pastaDesc = div.querySelector('#sb-pasta-desc');

        toggle.classList.toggle('active', usarPastaPersonalizada);
        pastaContainer.style.display = usarPastaPersonalizada ? 'flex' : 'none';
        pastaDesc.textContent = usarPastaPersonalizada ? 'Salvando em pasta escolhida' : 'Salvando direto em Downloads';
    });

    const inputPasta = div.querySelector('#sb-folder-name');
    if (inputPasta) {
        inputPasta.addEventListener('input', (e) => {
            localStorage.setItem('sb_last_folder', e.target.value);
        });
    }

    div.querySelector('#sb-master-chk').addEventListener('change', (e) => {
        const estado = e.target.checked;
        const checks = menuContainer.querySelectorAll('.smartbus-chk-big');
        checks.forEach(chk => {
            chk.checked = estado;
            const idx = parseInt(chk.getAttribute('data-index'));
            if (estado) indicesSelecionados.add(idx);
            else indicesSelecionados.delete(idx);
        });
    });

    div.querySelector('#sb-btn-download').addEventListener('click', iniciarDownloadEmMassa);

    div.querySelector('#sb-btn-parar').addEventListener('click', () => {
        cancelarProcesso = true;
        const btnParar = document.getElementById('sb-btn-parar');
        if (btnParar) {
            btnParar.innerText = 'Parando...';
            btnParar.disabled = true;
            btnParar.style.opacity = '0.7';
        }
    });

    div.querySelector('#sb-toggle-info').addEventListener('click', () => {
        mostrarInfoAtivo = !mostrarInfoAtivo;
        localStorage.setItem('sb_mostrar_info', mostrarInfoAtivo);

        const toggle = div.querySelector('#sb-toggle-info');
        const infoDesc = div.querySelector('#sb-info-desc');

        toggle.classList.toggle('active', mostrarInfoAtivo);
        infoDesc.textContent = mostrarInfoAtivo ? 'Exibindo nomes dos passageiros' : 'Nomes dos passageiros ocultos';

        if (mostrarInfoAtivo) {
            const menu = document.querySelector('.master-print-detail');
            if (menu && menu.style.display !== 'none') {
                atualizarLabelsNomes(menu);
                carregarInfoPassageiros(menu);
            }
        } else {
            // Esconde todos os labels de nome
            document.querySelectorAll('.sb-passenger-name').forEach(el => {
                el.style.display = 'none';
            });
        }
    });

    const btnLimparHistorico = div.querySelector('#sb-limpar-historico');
    if (btnLimparHistorico) {
        btnLimparHistorico.addEventListener('click', () => {
            if (confirm('Isso vai fazer com que os PDFs já baixados anteriormente voltem a ser pesquisados de forma automática na próxima vez. Deseja continuar?')) {
                localStorage.removeItem('sb_historico_downloads');
                alert('Histórico de downloads apagado! Os PDFs voltarão a baixar automaticamente.');
            }
        });
    }

    // Botão Caixa Final
    const btnCaixa = div.querySelector('#sb-btn-caixa');
    if (btnCaixa) {
        btnCaixa.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof window._prigiaCaixaAbrirModal === 'function') {
                window._prigiaCaixaAbrirModal();
            }
        });
    }

    // Atualiza badge do caixa na inicialização do painel
    if (typeof window._prigiaCaixaAtualizarBadge === 'function') {
        window._prigiaCaixaAtualizarBadge();
    }
}

function injetarEstilosToggle() {
    if (document.getElementById('sb-toggle-styles')) return;

    const style = document.createElement('style');
    style.id = 'sb-toggle-styles';
    style.textContent = `
        .sb-toggle-switch {
            width: 42px;
            height: 24px;
            background-color: #e0e0e5;
            border-radius: 999px;
            position: relative;
            cursor: pointer;
            transition: background 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .sb-toggle-switch.active {
            background: linear-gradient(135deg, #303f9f, #5c6bc0);
        }
        .sb-toggle-slider {
            width: 18px;
            height: 18px;
            background-color: white;
            border-radius: 50%;
            position: absolute;
            top: 3px;
            left: 3px;
            transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 1px 3px rgba(0,0,0,0.18);
        }
        .sb-toggle-switch.active .sb-toggle-slider {
            transform: translateX(18px);
        }
        .smartbus-btn-action {
            width: 100%;
            padding: 11px;
            background: linear-gradient(135deg, #303f9f, #283593);
            color: #fff;
            border: none;
            border-radius: 10px;
            font-weight: 600;
            font-size: 13px;
            letter-spacing: 0.02em;
            cursor: pointer;
            transition: all 0.2s ease;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            box-shadow: 0 2px 8px rgba(48, 63, 159, 0.25);
        }
        .smartbus-btn-action:hover {
            background: linear-gradient(135deg, #283593, #1d2660);
            box-shadow: 0 4px 16px rgba(48, 63, 159, 0.35);
            transform: translateY(-1px);
        }
        .smartbus-btn-action:active {
            transform: translateY(0);
            box-shadow: 0 1px 4px rgba(48, 63, 159, 0.2);
        }
        .smartbus-btn-action:disabled {
            background: #f0f0f5;
            color: #9e9eb0;
            box-shadow: none;
            transform: none;
            cursor: not-allowed;
        }
        .sb-passenger-name {
            font-size: 11px;
            font-weight: 500;
            color: #333345;
            background: #f8f8fc;
            padding: 3px 10px;
            border-radius: 6px;
            margin-bottom: 4px;
            display: block;
            width: 100%;
            order: -1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            box-sizing: border-box;
            border: 1px solid #ebebf0;
        }
        #sb-folder-name:focus {
            border-color: #303f9f;
            box-shadow: 0 0 0 3px rgba(48, 63, 159, 0.12);
        }
        @keyframes sb-modal-in {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
        }
    `;
    document.head.appendChild(style);
}

function injetarCaixinhas(menuContainer) {
    if (!extensaoAtiva) return;

    const items = Array.from(menuContainer.querySelectorAll('.spn-item'));

    items.forEach((item, indexReal) => {
        const texto = item.innerText.trim();

        if (texto.includes('DABPe')) {
            const caixaExistente = item.querySelector('.smartbus-chk-big');

            if (!caixaExistente) {
                const chk = document.createElement('input');
                chk.type = 'checkbox';
                chk.className = 'smartbus-chk-big';
                chk.setAttribute('data-index', indexReal);

                if (indicesSelecionados.has(indexReal)) {
                    chk.checked = true;
                }

                chk.addEventListener('change', (e) => {
                    const idx = parseInt(e.target.getAttribute('data-index'));
                    if (e.target.checked) indicesSelecionados.add(idx);
                    else indicesSelecionados.delete(idx);
                });

                chk.onclick = (e) => e.stopPropagation();
                chk.onmousedown = (e) => e.stopPropagation();

                item.prepend(chk);
            } else {
                caixaExistente.setAttribute('data-index', indexReal);
            }

            // Gerenciar label do nome do passageiro
            gerenciarLabelNome(item, indexReal);
        }
    });
}

function obterChaveCache(item) {
    // Usa o texto original do item (sem o nome injetado) como chave
    const textoOriginal = item.getAttribute('data-sb-texto-original') || item.innerText.trim();
    if (!item.getAttribute('data-sb-texto-original')) {
        item.setAttribute('data-sb-texto-original', textoOriginal);
    }
    return textoOriginal.replace(/[^a-zA-Z0-9\- :]/g, '').trim().replace(/:/g, '-');
}

function gerenciarLabelNome(item, indexReal) {
    let labelExistente = item.querySelector('.sb-passenger-name');
    const chave = obterChaveCache(item);
    const nomeCacheado = cacheNomes[chave];

    if (mostrarInfoAtivo && nomeCacheado) {
        if (!labelExistente) {
            labelExistente = document.createElement('div');
            labelExistente.className = 'sb-passenger-name';
            labelExistente.onclick = (e) => e.stopPropagation();
            labelExistente.onmousedown = (e) => e.stopPropagation();
            item.insertBefore(labelExistente, item.firstChild);
        }
        labelExistente.textContent = `👤 ${nomeCacheado}`;
        labelExistente.style.display = 'block';
    } else if (labelExistente) {
        labelExistente.style.display = mostrarInfoAtivo ? 'block' : 'none';
        if (mostrarInfoAtivo && !nomeCacheado) {
            labelExistente.textContent = '⏳ Carregando...';
        }
    } else if (mostrarInfoAtivo && !nomeCacheado) {
        // Criar label placeholder
        labelExistente = document.createElement('div');
        labelExistente.className = 'sb-passenger-name';
        labelExistente.textContent = '⏳ Carregando...';
        labelExistente.onclick = (e) => e.stopPropagation();
        labelExistente.onmousedown = (e) => e.stopPropagation();
        item.insertBefore(labelExistente, item.firstChild);
    }
}

function obterTextoOriginalItem(item) {
    // Retorna o texto original do item, sem nomes de passageiro injetados
    return item.getAttribute('data-sb-texto-original') || item.innerText.trim();
}

function gerarChaveHistorico(item) {
    return obterTextoOriginalItem(item).replace(/[^a-zA-Z0-9\- :]/g, '').trim().replace(/:/g, '-');
}

function atualizarLabelsNomes(menuContainer) {
    const items = Array.from(menuContainer.querySelectorAll('.spn-item'));
    items.forEach((item, indexReal) => {
        if (item.innerText.includes('DABPe') || item.getAttribute('data-sb-texto-original')?.includes('DABPe')) {
            gerenciarLabelNome(item, indexReal);
        }
    });
}

async function carregarInfoPassageiros(menuContainer) {
    if (carregandoInfo || !mostrarInfoAtivo || processando) return;
    carregandoInfo = true;

    const items = Array.from(menuContainer.querySelectorAll('.spn-item'));
    const itensParaCarregar = [];

    items.forEach((item, indexReal) => {
        const textoOriginal = item.getAttribute('data-sb-texto-original') || item.innerText.trim();
        if (textoOriginal.includes('DABPe')) {
            const chave = obterChaveCache(item);
            if (!cacheNomes[chave]) {
                itensParaCarregar.push({ item, indexReal, chave });
            }
        }
    });

    if (itensParaCarregar.length === 0) {
        carregandoInfo = false;
        return;
    }

    const statusDiv = document.getElementById('sb-status');
    if (statusDiv) {
        statusDiv.style.display = 'block';
        statusDiv.textContent = `Carregando informações dos passageiros...`;
    }

    try {
        mostrarBotaoParar(true);
        for (let i = 0; i < itensParaCarregar.length; i++) {
            if (!mostrarInfoAtivo || cancelarProcesso) break; // Parar se desativou ou cancelou

            const { item, indexReal, chave } = itensParaCarregar[i];

            if (statusDiv) statusDiv.textContent = `Carregando info ${i + 1}/${itensParaCarregar.length}...`;

            // Re-buscar o elemento vivo no DOM
            const elementosVivos = document.querySelectorAll('.spn-item');
            const elementoVivo = elementosVivos[indexReal];

            if (elementoVivo) {
                const urlAnterior = obterUrlPdfAtual();
                elementoVivo.click(); // Abre o PDF

                const urlPdf = await esperarPDFCarregar(urlAnterior);

                if (urlPdf) {
                    if (statusDiv) statusDiv.textContent = `Aguardando 1.5s para ler conteúdo...`;
                    await new Promise(r => setTimeout(r, 1500));

                    try {
                        const dadosPdf = await extrairDadosDoPDF(urlPdf);
                        const nome = dadosPdf.name || 'PASSAGEIRO';

                        // Salvar no cache
                        cacheNomes[chave] = nome;
                        salvarCacheNomes(cacheNomes);

                        // Atualizar label
                        const labelEl = elementoVivo.querySelector('.sb-passenger-name');
                        if (labelEl) {
                            labelEl.textContent = `👤 ${nome}`;
                            labelEl.style.display = 'block';
                        }
                    } catch (err) {
                        console.error('Erro ao extrair info do passageiro:', err);
                        const labelEl = elementoVivo.querySelector('.sb-passenger-name');
                        if (labelEl) labelEl.textContent = '❌ Erro ao carregar';
                    }
                } else {
                    const labelEl = elementoVivo.querySelector('.sb-passenger-name');
                    if (labelEl) labelEl.textContent = '❌ PDF não carregou';
                }

                // Fechar o lightbox
                const btnFechar = document.querySelector('.span-close-lightbox');
                if (btnFechar) btnFechar.click();

                await new Promise(r => setTimeout(r, 1500));
            }
        }

        if (cancelarProcesso) {
            if (statusDiv) {
                statusDiv.textContent = `⛔ Carregamento cancelado.`;
                setTimeout(() => { statusDiv.style.display = 'none'; }, 2000);
            }
        } else if (statusDiv) {
            statusDiv.textContent = `✅ Informações carregadas!`;
            setTimeout(() => { statusDiv.style.display = 'none'; }, 2000);
        }
    } catch (erro) {
        console.error('❌ Erro ao carregar informações:', erro);
        if (statusDiv) {
            statusDiv.textContent = `Erro: ${erro.message}`;
            setTimeout(() => { statusDiv.style.display = 'none'; }, 3000);
        }
    } finally {
        carregandoInfo = false;
        cancelarProcesso = false;
        mostrarBotaoParar(false);
    }
}

async function executarAutoDownloadGeral(menuContainer) {
    if (!extensaoAtiva) return;

    const itensAtuais = Array.from(menuContainer.querySelectorAll('.spn-item'));
    const historicoStr = localStorage.getItem('sb_historico_downloads') || "[]";
    let historico = [];
    try { historico = JSON.parse(historicoStr); } catch (e) { }

    const indicesParaBaixar = [];

    // Identifica quais faltam baixar usando o índice
    itensAtuais.forEach((item, indexReal) => {
        const texto = obterTextoOriginalItem(item);
        if (texto.includes('DABPe')) {
            const nomeLimpoParaHistorico = gerarChaveHistorico(item);
            if (!historico.includes(nomeLimpoParaHistorico)) {
                indicesParaBaixar.push(indexReal);
            }
        }
    });

    if (indicesParaBaixar.length === 0) {
        console.log('✅ Prigia Download: Todos os PDFs já foram baixados anteriormente.');
        return;
    }

    processando = true;
    cancelarProcesso = false;
    processandoTimestamp = Date.now();
    const btn = document.getElementById('sb-btn-download');
    const txtOriginal = btn ? btn.innerText : 'BAIXAR SELECIONADOS 📥';
    const statusDiv = document.getElementById('sb-status');

    if (btn) {
        btn.disabled = true;
        btn.innerText = 'AUTO-BAIXANDO NOVOS...';
    }
    if (statusDiv) {
        statusDiv.style.display = 'block';
    }
    mostrarBotaoParar(true);

    let nomePasta = '';
    if (usarPastaPersonalizada) {
        const inputPasta = document.getElementById('sb-folder-name');
        nomePasta = inputPasta ? inputPasta.value.trim() : '';
    }

    try {
        for (let i = 0; i < indicesParaBaixar.length; i++) {
            if (cancelarProcesso) break;
            const indexAlvo = indicesParaBaixar[i];
            if (btn) btn.innerText = `BAIXANDO NOVO ${i + 1}/${indicesParaBaixar.length}...`;
            if (statusDiv) statusDiv.textContent = `Abrindo PDF automático ${i + 1}...`;

            const elementosVivos = document.querySelectorAll('.spn-item');
            const elementoVivo = elementosVivos[indexAlvo];

            if (elementoVivo) {
                const nomeLimpoParaHistorico = gerarChaveHistorico(elementoVivo);

                const urlAnterior = obterUrlPdfAtual();
                elementoVivo.click(); // Abre

                const urlPdf = await esperarPDFCarregar(urlAnterior);

                if (urlPdf) {
                    if (statusDiv) statusDiv.textContent = `Aguardando 1.5s para ler PDF novo...`;
                    await new Promise(r => setTimeout(r, 1500));

                    if (statusDiv) statusDiv.textContent = `Extraindo dados do PDF...`;
                    let nomeArquivo;
                    try {
                        const dadosPdf = await extrairDadosDoPDF(urlPdf);
                        nomeArquivo = gerarNomeArquivo(dadosPdf);
                        if (statusDiv) statusDiv.textContent = `Baixando: ${nomeArquivo}`;

                        // Atualiza a tela com o nome extraído sem precisar abrir dnv
                        const nome = dadosPdf.name || 'PASSAGEIRO';
                        const chave = obterChaveCache(elementoVivo);
                        cacheNomes[chave] = nome;
                        salvarCacheNomes(cacheNomes);
                        const labelEl = elementoVivo.querySelector('.sb-passenger-name');
                        if (labelEl) {
                            labelEl.textContent = `👤 ${nome}`;
                            if (mostrarInfoAtivo) labelEl.style.display = 'block';
                        }

                        // Acumula no Caixa Final
                        if (typeof window._prigiaCaixaAddTicket === 'function') {
                            window._prigiaCaixaAddTicket(dadosPdf, dadosPdf._fullText || '');
                        }
                    } catch (err) {
                        console.error('Erro ao extrair dados do PDF:', err);
                        nomeArquivo = `${nomeLimpoParaHistorico}.pdf`;
                        if (statusDiv) statusDiv.textContent = `Usando nome padrão: ${nomeArquivo}`;
                    }

                    await baixarArquivo(urlPdf, nomeArquivo, nomePasta);

                    // Salva no histórico
                    historico.push(nomeLimpoParaHistorico);
                    localStorage.setItem('sb_historico_downloads', JSON.stringify(historico));
                } else {
                    console.warn(`⚠️ Prigia Download: PDF ${i + 1} não carregou, pulando...`);
                    if (statusDiv) statusDiv.textContent = `PDF ${i + 1} não carregou, pulando...`;
                }

                const btnFechar = document.querySelector('.span-close-lightbox');
                if (btnFechar) btnFechar.click();

                await new Promise(r => setTimeout(r, 1500));
            }
        }

        if (cancelarProcesso) {
            if (btn) {
                btn.innerText = '⛔ AUTO-DOWNLOAD CANCELADO';
                if (statusDiv) statusDiv.textContent = `Processo parado pelo usuário.`;
                setTimeout(() => {
                    btn.innerText = txtOriginal;
                    btn.disabled = false;
                    if (statusDiv) statusDiv.style.display = 'none';
                }, 3000);
            }
        } else if (btn) {
            btn.innerText = 'AUTO-DOWNLOAD CONCLUÍDO! ✅';
            if (statusDiv) statusDiv.textContent = `${indicesParaBaixar.length} novos arquivos baixados!`;
            setTimeout(() => {
                btn.innerText = txtOriginal;
                btn.disabled = false;
                if (statusDiv) statusDiv.style.display = 'none';
            }, 3000);
        }
    } catch (erro) {
        console.error('❌ Prigia Download: Erro no auto-download:', erro);
        if (btn) {
            btn.innerText = '❌ ERRO NO AUTO-DOWNLOAD';
            setTimeout(() => {
                btn.innerText = txtOriginal;
                btn.disabled = false;
            }, 3000);
        }
        if (statusDiv) {
            statusDiv.textContent = `Erro: ${erro.message}`;
            setTimeout(() => { statusDiv.style.display = 'none'; }, 3000);
        }
    } finally {
        processando = false;
        processandoTimestamp = 0;
        cancelarProcesso = false;
        mostrarBotaoParar(false);
    }
}

async function iniciarDownloadEmMassa() {
    if (!extensaoAtiva) return;

    const listaIndices = Array.from(indicesSelecionados).sort((a, b) => a - b);

    if (listaIndices.length === 0) {
        alert('Selecione pelo menos um bilhete.');
        return;
    }

    let nomePasta = '';
    if (usarPastaPersonalizada) {
        const inputPasta = document.getElementById('sb-folder-name');
        nomePasta = inputPasta ? inputPasta.value.trim() : '';
    }

    const statusDiv = document.getElementById('sb-status');

    processando = true;
    cancelarProcesso = false;
    processandoTimestamp = Date.now();
    const btn = document.getElementById('sb-btn-download');
    const txtOriginal = btn.innerText;
    btn.disabled = true;
    mostrarBotaoParar(true);
    statusDiv.style.display = 'block';

    try {
        for (let i = 0; i < listaIndices.length; i++) {
            if (cancelarProcesso) break;
            const indexAlvo = listaIndices[i];
            btn.innerText = `PROCESSANDO ${i + 1}/${listaIndices.length}...`;
            statusDiv.textContent = `Abrindo PDF ${i + 1} de ${listaIndices.length}...`;

            const itensAtuais = document.querySelectorAll('.spn-item');
            const elementoVivo = itensAtuais[indexAlvo];

            if (elementoVivo) {
                const urlAnterior = obterUrlPdfAtual();
                elementoVivo.click();

                const urlPdf = await esperarPDFCarregar(urlAnterior);

                if (urlPdf) {
                    statusDiv.textContent = `Aguardando 1.5s para leitura correta do PDF ${i + 1}...`;
                    await new Promise(r => setTimeout(r, 1500));
                    statusDiv.textContent = `Extraindo dados do PDF ${i + 1}...`;

                    let nomeArquivo;
                    try {
                        const dadosPdf = await extrairDadosDoPDF(urlPdf);
                        nomeArquivo = gerarNomeArquivo(dadosPdf);
                        statusDiv.textContent = `Baixando: ${nomeArquivo}`;
                        console.log('📄 Dados extraídos:', dadosPdf);
                        console.log('📝 Nome gerado:', nomeArquivo);

                        // Atualiza a tela com o nome extraído sem precisar abrir dnv
                        const nome = dadosPdf.name || 'PASSAGEIRO';
                        const chave = obterChaveCache(elementoVivo);
                        cacheNomes[chave] = nome;
                        salvarCacheNomes(cacheNomes);
                        const labelEl = elementoVivo.querySelector('.sb-passenger-name');
                        if (labelEl) {
                            labelEl.textContent = `👤 ${nome}`;
                            if (mostrarInfoAtivo) labelEl.style.display = 'block';
                        }

                        // Acumula no Caixa Final
                        if (typeof window._prigiaCaixaAddTicket === 'function') {
                            window._prigiaCaixaAddTicket(dadosPdf, dadosPdf._fullText || '');
                        }
                    } catch (err) {
                        console.error('Erro ao extrair dados do PDF:', err);
                        const nomeLimpo = gerarChaveHistorico(elementoVivo);
                        nomeArquivo = `${nomeLimpo}.pdf`;
                        statusDiv.textContent = `Usando nome padrão: ${nomeArquivo}`;
                    }

                    await baixarArquivo(urlPdf, nomeArquivo, nomePasta);

                    // Add to history so it won't be auto-downloaded next time
                    const nomeLimpoParaHistorico = gerarChaveHistorico(elementoVivo);
                    const historicoStr = localStorage.getItem('sb_historico_downloads') || "[]";
                    let historico = [];
                    try { historico = JSON.parse(historicoStr); } catch (e) { }
                    if (!historico.includes(nomeLimpoParaHistorico)) {
                        historico.push(nomeLimpoParaHistorico);
                        localStorage.setItem('sb_historico_downloads', JSON.stringify(historico));
                    }
                }

                const btnFechar = document.querySelector('.span-close-lightbox');
                if (btnFechar) btnFechar.click();

                await new Promise(r => setTimeout(r, 1500));
            }
        }

        if (cancelarProcesso) {
            btn.innerText = '⛔ DOWNLOAD CANCELADO';
            statusDiv.textContent = `Processo parado pelo usuário.`;
        } else {
            btn.innerText = 'CONCLUÍDO! ✅';
            statusDiv.textContent = `${listaIndices.length} arquivos baixados e renomeados!`;
        }

        setTimeout(() => {
            btn.innerText = txtOriginal;
            btn.disabled = false;
            statusDiv.style.display = 'none';
        }, 3000);
    } catch (erro) {
        console.error('❌ Prigia Download: Erro no download manual:', erro);
        btn.innerText = '❌ ERRO NO DOWNLOAD';
        statusDiv.textContent = `Erro: ${erro.message}`;
        setTimeout(() => {
            btn.innerText = txtOriginal;
            btn.disabled = false;
            statusDiv.style.display = 'none';
        }, 3000);
    } finally {
        processando = false;
        processandoTimestamp = 0;
        cancelarProcesso = false;
        mostrarBotaoParar(false);
    }
}

// Mostra ou esconde o botão de parar processo
function mostrarBotaoParar(mostrar) {
    const btnParar = document.getElementById('sb-btn-parar');
    if (btnParar) {
        btnParar.style.display = mostrar ? 'block' : 'none';
        btnParar.innerText = '⛔ PARAR PROCESSO';
        btnParar.disabled = false;
    }
}

// Retorna a URL do PDF atualmente visível no DOM (se houver)
function obterUrlPdfAtual() {
    const iframe = document.querySelector('iframe[type="application/pdf"]');
    const iframeSrc = document.querySelector('iframe[src*=".pdf"]');
    const embed = document.querySelector('embed[type="application/pdf"]');
    const embedSrc = document.querySelector('embed[src*=".pdf"]');
    const objectEl = document.querySelector('object[type="application/pdf"]');
    const iframeBlob = document.querySelector('iframe[src^="blob:"]');
    const el = iframe || iframeSrc || embed || embedSrc || objectEl || iframeBlob;
    return el ? (el.src || el.data || null) : null;
}

// Espera um PDF NOVO carregar (com URL diferente da anterior)
function esperarPDFCarregar(urlAnterior) {
    return new Promise(resolve => {
        let tentativas = 0;
        const check = setInterval(() => {
            tentativas++;

            // Busca PDF em iframe, embed ou object
            const iframe = document.querySelector('iframe[type="application/pdf"]');
            const iframeSrc = document.querySelector('iframe[src*=".pdf"]');
            const embed = document.querySelector('embed[type="application/pdf"]');
            const embedSrc = document.querySelector('embed[src*=".pdf"]');
            const objectEl = document.querySelector('object[type="application/pdf"]');
            const iframeBlob = document.querySelector('iframe[src^="blob:"]');

            const elemento = iframe || iframeSrc || embed || embedSrc || objectEl || iframeBlob;

            if (elemento) {
                const url = elemento.src || elemento.data;
                // Só aceita se a URL é válida E diferente da URL anterior
                if (url && url !== urlAnterior) {
                    clearInterval(check);
                    console.log('📄 Prigia Download: PDF NOVO encontrado via', elemento.tagName, url.substring(0, 80));
                    resolve(url);
                    return;
                }
            }

            if (tentativas > 100) { // 10 segundos
                clearInterval(check);
                console.warn('⚠️ Prigia Download: PDF novo não encontrado após 10s');
                resolve(null);
            }
        }, 100);
    });
}

// =================================================================
// LÓGICA DE EXTRAÇÃO DE PDF (baseada no PRIGIA V2)
// =================================================================

async function extrairDadosDoPDF(url) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map(item => item.str).join(' ') + '\n';
    }

    console.log('🔍 Texto do PDF:', fullText.substring(0, 500));

    const result = parseTicketData(fullText);
    // Anexa o texto completo para extração de pagamento pelo módulo caixa
    result._fullText = fullText;
    return result;
}

function parseTicketData(text) {
    const data = { name: '', origin: '', destination: '', date: '', time: '' };

    // ===== NOME DO PASSAGEIRO =====
    // Estratégia 1: Após "Tipo de desconto"
    const afterDesconto = text.match(/Tipo\s+de\s+desconto[:\s]+(.+?)(?=\s+[A-Z]{2,3}\d{3,}|\s+Tarifa|\s+\d{3,}[.,])/is);

    if (afterDesconto && afterDesconto[1]) {
        let rawName = afterDesconto[1].trim();
        const badWords = ['PASSAPORTE', 'RG', 'CPF', 'CNH', 'IDENTIDADE', 'PROMOCIONAL', 'NORMAL',
            'TARIFA', 'VALOR', 'VIACAO', 'EXPRESSO', 'GUANABARA', 'LTDA', 'BACABAL',
            'ANANINDEUA', 'BELEM', 'SAO LUIS', 'ORDINARIO', 'HORARIO'];

        let words = rawName.split(/\s+/);
        let nameWords = [];

        for (const word of words) {
            const upperWord = word.toUpperCase();
            if (/^[A-Z]{2,3}\d{3,}/.test(upperWord)) break;
            if (/^\d{5,}/.test(word)) break;
            if (badWords.includes(upperWord)) continue;
            if (word.length > 1) {
                nameWords.push(word);
            }
        }

        if (nameWords.length >= 2) {
            data.name = nameWords.slice(0, 6).join(' ');
        }
    }

    // Estratégia 2: Padrão de nome completo
    if (!data.name || data.name.length < 5) {
        const namePattern = text.match(/\b([A-ZÀ-Ú]{2,}\s+[A-ZÀ-Ú]{2,}(?:\s+(?:DE|DA|DO|DOS|DAS)?\s*[A-ZÀ-Ú]{2,}){1,4})\b/);
        if (namePattern) {
            const candidate = namePattern[1];
            const badWords = ['EXPRESSO GUANABARA', 'BACABAL MA', 'ANANINDEUA PA', 'SAO LUIS',
                'TARIFA PROMOCIONAL', 'VALOR PAGO', 'TIPO DE'];
            const isBad = badWords.some(bw => candidate.toUpperCase().includes(bw));
            if (!isBad && candidate.length > 10) {
                data.name = candidate;
            }
        }
    }

    if (!data.name) {
        data.name = 'PASSAGEIRO';
    }

    // ===== ORIGEM E DESTINO =====
    // Estratégia robusta: Encontrar cidades após o label "Origem"
    const textoUpper = text.toUpperCase();
    const posLabelOrigem = textoUpper.indexOf('ORIGEM');

    // Regex para "CIDADE - UF"
    const cidadeUfRegex = /([A-ZÀ-Ú][A-ZÀ-Úa-zà-ú\s()]{2,40}?)\s+-\s+([A-Z]{2})\b/g;

    const cidadesCandidatas = [];
    let match;

    while ((match = cidadeUfRegex.exec(text)) !== null) {
        // Se a cidade está antes do label "Origem", provavelmente é endereço da empresa
        if (posLabelOrigem !== -1 && match.index < posLabelOrigem) {
            continue;
        }

        let cidade = match[1].trim();
        const uf = match[2];

        // Limpeza inteligente do nome da cidade
        let palavras = cidade.split(/\s+/);

        // Palavras que indicam lixo/endereço/empresa
        const garbageWords = ['LTDA', 'EXPRESSO', 'GUANABARA', 'VIACAO', 'EMPRESA', 'BOX',
            'TERMINAL', 'RODOVIARIO', 'CENTRO', 'AVENIDA', 'RUA', 'AV',
            'TRAVESSA', 'CRUZEIRO', 'ANIL', 'SEBASTIAO', 'BAIRRO', 'SN', 'S/N',
            'MANGUEIRA', 'IE', 'CNPJ', 'TELEFONE', 'SAC', 'AGENCIA', 'GUICHE'];

        let lastGarbageIndex = -1;
        palavras.forEach((p, index) => {
            const cleanP = p.replace(/[.,-]/g, '');
            if (garbageWords.some(gw => cleanP.toUpperCase() === gw)) {
                lastGarbageIndex = index;
            }
        });

        // Pega tudo depois da última palavra de lixo
        if (lastGarbageIndex !== -1) {
            palavras = palavras.slice(lastGarbageIndex + 1);
        }

        // Remove preposições soltas no início
        if (palavras.length > 0 && ['DE', 'DA', 'DO', 'EM', 'NO', 'NA'].includes(palavras[0].toUpperCase())) {
            palavras.shift();
        }

        cidade = palavras.join(' ');

        // Filtra se o resultado ficou vazio ou muito curto
        if (cidade.length < 3) continue;

        cidadesCandidatas.push({ cidade: cidade.toUpperCase(), uf, index: match.index });
    }

    console.log('📍 Cidades candidatas (pós-label):', cidadesCandidatas);

    if (cidadesCandidatas.length >= 1) {
        data.origin = cidadesCandidatas[0].cidade;
    }
    if (cidadesCandidatas.length >= 2) {
        data.destination = cidadesCandidatas[1].cidade;
    }

    // Fallback se não encontrou
    if (!data.origin) data.origin = 'ORIGEM';
    if (!data.destination) data.destination = 'DESTINO';

    // ===== DATA =====
    const dateMatch = text.match(/Partida[:\s]+(\d{2}\/\d{2}\/\d{4})/i) ||
        text.match(/Embarque[:\s]+(\d{2}\/\d{2}\/\d{4})/i) ||
        text.match(/(\d{2}\/\d{2}\/\d{4})/);
    if (dateMatch) data.date = dateMatch[1];

    // ===== HORA =====
    const timeMatch = text.match(/Horário[:\s]+(\d{2}:\d{2})/i);
    if (timeMatch) data.time = timeMatch[1];

    console.log('📄 Dados extraídos:', { nome: data.name, origem: data.origin, destino: data.destination, data: data.date });

    return data;
}

function gerarNomeArquivo(ticketData) {
    // Formato: DD.MM NOME ORIGEM X DESTINO.pdf
    let dataFormatada = '';
    if (ticketData.date) {
        const partes = ticketData.date.split('/');
        if (partes.length >= 2) dataFormatada = `${partes[0]}.${partes[1]}`;
    } else {
        const hoje = new Date();
        dataFormatada = `${String(hoje.getDate()).padStart(2, '0')}.${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    }

    const nome = (ticketData.name || 'PASSAGEIRO').toUpperCase().replace(/[^A-ZÀ-Ú\s]/g, '').trim().substring(0, 30);
    const origem = (ticketData.origin || 'ORIGEM').toUpperCase().substring(0, 20);
    const destino = (ticketData.destination || 'DESTINO').toUpperCase().substring(0, 20);

    const sanitize = (str) => str.replace(/[<>:"/\\|?*]/g, '').trim();
    const novoNome = sanitize(`${dataFormatada} ${nome} ${origem} X ${destino}.pdf`);

    return novoNome;
}

function baixarArquivo(url, nomeArquivo, nomePasta) {
    return new Promise(resolve => {
        chrome.runtime.sendMessage({
            action: "download_pdf",
            url: url,
            filename: nomeArquivo,
            folder: nomePasta
        }, () => setTimeout(resolve, 500));
    });
}

// =================================================================
// TELA DE RESERVA — EXTRAÇÃO DE HORÁRIOS PARA WHATSAPP
// =================================================================

/**
 * Retorna true se há linhas de horário (app-servicerow) visíveis no DOM.
 * Esse é o sinal de que estamos na tela de pesquisa/reserva.
 */
function detectarTelaReserva() {
    return document.querySelectorAll('app-servicerow').length > 0;
}

/**
 * Injeta o botão de horários dentro do painel principal da extensão
 * (smartbus-controls), junto dos outros botões.
 * Se o painel principal não existir, cria um mini-painel inline.
 */
function injetarBotaoHorarios() {
    // Cria a seção do botão de horários
    const section = document.createElement('div');
    section.id = 'sb-horarios-section';
    section.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 6px;
        width: 100%;
    `;

    section.innerHTML = `
        <div style="height:1px; background-color:#ccc; width:100%;"></div>
        <button id="sb-btn-copiar-horarios" class="smartbus-btn-action" style="background-color:#26d768;">
            📋 Copiar Horários para WhatsApp
        </button>
        <div id="sb-horarios-status" style="
            font-size: 11px;
            color: #555;
            text-align: center;
            min-height: 14px;
        "></div>
    `;

    // Tenta inserir dentro do painel principal da extensão
    const painelPrincipal = document.getElementById('smartbus-controls');
    const mainContent = painelPrincipal ? painelPrincipal.querySelector('#sb-main-content') : null;

    if (mainContent) {
        // Insere dentro do conteúdo principal, após o último elemento
        mainContent.appendChild(section);
    } else if (painelPrincipal) {
        // Se o main-content não existe mas o painel sim, insere no final do painel
        painelPrincipal.appendChild(section);
    } else {
        // Painel principal não existe (tela de reserva sem tela de bilhetes)
        // Cria um mini-painel inline
        const miniPanel = document.createElement('div');
        miniPanel.id = 'sb-horarios-section';
        miniPanel.style.cssText = `
            background: #f0fff4;
            padding: 12px 15px;
            border-bottom: 3px solid #26d768;
            margin-bottom: 10px;
            font-family: Arial, sans-serif;
            font-size: 13px;
            color: #2c3e50;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;

        miniPanel.innerHTML = `
            <div style="font-weight:bold; font-size:16px; color:#2c3e50;">
                🚌 Prigia Download
            </div>
            <button id="sb-btn-copiar-horarios" class="smartbus-btn-action" style="background-color:#26d768;">
                📋 Copiar Horários para WhatsApp
            </button>
            <div id="sb-horarios-status" style="
                font-size: 11px;
                color: #555;
                text-align: center;
                min-height: 14px;
            "></div>
        `;

        // Tenta inserir após o cabeçalho da pesquisa
        const ancoraPrincipal = document.querySelector('.div-search-local-date');
        if (ancoraPrincipal && ancoraPrincipal.parentElement) {
            ancoraPrincipal.insertAdjacentElement('afterend', miniPanel);
        } else {
            const primeiraLinha = document.querySelector('app-servicerow');
            if (primeiraLinha && primeiraLinha.parentElement) {
                primeiraLinha.parentElement.insertBefore(miniPanel, primeiraLinha);
            } else {
                document.body.insertBefore(miniPanel, document.body.firstChild);
            }
        }

        // Remove o id da section interna pois o miniPanel já tem o id
        section.removeAttribute('id');
    }

    injetarEstilosToggle(); // garante que .smartbus-btn-action está definida

    const btn = document.getElementById('sb-btn-copiar-horarios');
    if (btn) btn.addEventListener('click', copiarHorariosParaWhatsapp);
}

/**
 * Lê os app-servicerow do DOM ao vivo, formata para WhatsApp e copia.
 * Usa setTimeout(0) para ceder controle ao browser antes de processar,
 * evitando travar a aba. Usa clipboard API assíncrona para a cópia.
 */
async function copiarHorariosParaWhatsapp() {
    const btn = document.getElementById('sb-btn-copiar-horarios');
    const statusEl = document.getElementById('sb-horarios-status');
    if (!btn) return;

    // Extrai horários do DOM
    const trips = extrairHorariosDoDOM();
    if (!trips || trips.length === 0) {
        if (statusEl) statusEl.textContent = '❌ Nenhum horário encontrado.';
        btn.textContent = '❌ Vazio';
        btn.style.background = '#e74c3c';
        setTimeout(() => _resetBtnHorarios(btn, statusEl), 3000);
        return;
    }

    // Abre o modal de seleção ao invés de copiar direto
    abrirModalHorarios(trips);
}

function _resetBtnHorarios(btn, statusEl) {
    if (!btn) return;
    btn.disabled = false;
    btn.style.background = '';
    btn.style.backgroundColor = '#26d768';
    btn.style.cursor = 'pointer';
    btn.textContent = '📋 Copiar Horários para WhatsApp';
    if (statusEl) statusEl.textContent = '';
}

/**
 * Lê todos os app-servicerow do DOM e retorna texto formatado para WhatsApp.
 * Nenhuma operação de rede ou PDF — apenas leitura de DOM (não bloqueia).
 */
function extrairHorariosDoDOM() {
    const rows = document.querySelectorAll('app-servicerow');
    if (rows.length === 0) return null;

    // Tenta capturar origem/destino global do cabeçalho da pesquisa
    let globalOrigin = '';
    let globalDestination = '';
    const headerInfo = document.querySelector('.div-search-local-date');
    if (headerInfo) {
        const bTags = headerInfo.querySelectorAll('b');
        if (bTags.length >= 2) {
            globalOrigin = bTags[0].textContent.replace(/^[A-Z]{3}\s*-\s*/, '').trim();
            globalDestination = bTags[1].textContent.replace(/^[A-Z]{3}\s*-\s*/, '').trim();
        }
    }

    const trips = [];

    rows.forEach((row, index) => {
        try {
            // --- Empresa ---
            const companyImg = row.querySelector('companylogo img');
            const company = companyImg?.getAttribute('title') || companyImg?.getAttribute('alt') || '';

            // --- Rota ---
            let origin = globalOrigin;
            let destination = globalDestination;

            if (!origin || !destination) {
                const routeCol = row.querySelector('.service-col-2');
                if (routeCol) {
                    const bTag = routeCol.querySelector('b');
                    if (bTag) {
                        const parts = bTag.innerHTML.split(/<br\s*\/?>/i);
                        if (parts.length >= 2) {
                            origin = parts[0].replace(/<[^>]*>/g, '').trim();
                            destination = parts[1].replace(/<[^>]*>/g, '').trim();
                        }
                    }
                }
            }

            // --- Horários de partida / chegada ---
            const timeCol = row.querySelector('.service-col-3');
            let departureTime = '';
            let arrivalTime = '';
            let nextDay = false;

            if (timeCol) {
                const bTags = timeCol.querySelectorAll('b');
                if (bTags.length >= 2) {
                    departureTime = bTags[0].textContent?.trim() || '';
                    arrivalTime   = bTags[1].textContent?.trim() || '';
                } else {
                    const times = (timeCol.textContent || '').match(/\d{2}:\d{2}/g);
                    if (times && times.length >= 2) {
                        departureTime = times[0];
                        arrivalTime   = times[1];
                    } else if (times && times.length === 1) {
                        departureTime = times[0];
                    }
                }
                // Detecta indicador "+1" (chega no dia seguinte)
                if (/\+\s*1/.test(timeCol.textContent || '')) nextDay = true;
            }

            // Linha sem horário de partida não tem utilidade
            if (!departureTime) return;

            // Fallback: se chegada < partida, provavelmente é próximo dia
            if (!nextDay && arrivalTime && departureTime
                    && arrivalTime < departureTime) {
                nextDay = true;
            }

            // --- Vagas disponíveis ---
            const seatsBadge = row.querySelector('.service-availability');
            const seatsAvailable = seatsBadge
                ? parseInt(seatsBadge.textContent?.replace(/\D/g, '') || '0', 10)
                : 0;

            // --- Classe de serviço ---
            const classEl = row.querySelector('.service-class .spn-class');
            let serviceClass = classEl ? (classEl.textContent?.trim() || '') : '';
            serviceClass = serviceClass.replace(/[^a-zA-ZÀ-ÿ\s]/g, '').trim() || 'Convencional';

            // --- Preço ---
            const priceCol = row.querySelector('.service-col-8');
            let priceRaw = '';
            let priceValue = 0;

            if (priceCol) {
                const promoSpan  = priceCol.querySelector('.family-promo span:last-child');
                const normalSpan = priceCol.querySelector('.family-normal span:last-child');
                let candidateText = '';

                if (promoSpan && /\d/.test(promoSpan.textContent || '')) {
                    candidateText = promoSpan.textContent || '';
                } else if (normalSpan && /\d/.test(normalSpan.textContent || '')) {
                    candidateText = normalSpan.textContent || '';
                }

                if (!candidateText) {
                    const matches = (priceCol.textContent || '').match(/(\d{1,3}(?:\.\d{3})*,\d{2})/g);
                    if (matches && matches.length > 0) candidateText = matches[0];
                }

                if (candidateText) {
                    const numStr = candidateText.trim()
                        .replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
                    priceValue = parseFloat(numStr) || 0;

                    // Taxa de embarque Bacabal (06h–24h)
                    if (priceValue > 0) {
                        const originLower = origin.toLowerCase();
                        if ((originLower.includes('bacabal') || originLower.includes('bba'))
                                && departureTime >= '06:00') {
                            priceValue += 3.90;
                        }
                        priceRaw = priceValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    }
                }
            }

            // --- Tipo de conexão ---
            let connectionType = 'direto';
            const rowTextLower = (row.textContent || '').toLowerCase();
            if (rowTextLower.includes('cruzamento')) {
                connectionType = 'cruzamento';
            } else if (rowTextLower.includes('mesma linha')) {
                connectionType = 'mesma_linha';
            } else if (rowTextLower.includes('vira bandeira')) {
                connectionType = 'vira_bandeira';
            }

            trips.push({
                company, origin, destination,
                departureTime, arrivalTime, nextDay,
                serviceClass, seatsAvailable,
                priceRaw, priceValue,
                connectionType,
                rowIndex: index
            });

        } catch (e) {
            console.warn('Prigia: Erro ao parsear linha de horário', index, e);
        }
    });

    return trips;
}

/**
 * Formata uma lista de viagens para texto WhatsApp.
 * Separado de extrairHorariosDoDOM para permitir formatação de subconjuntos.
 */
function formatarHorariosParaWhatsapp(trips) {
    if (!trips || trips.length === 0) return null;

    const labelTipoConexao = {
        'cruzamento': '🔄 Cruzamento',
        'mesma_linha': '🔗 Mesma Linha',
        'vira_bandeira': '🏴 Vira Bandeira'
    };

    // Agrupa por horário + empresa + rota (igual ao Prigia desktop)
    const groups = {};
    trips.forEach(t => {
        const key = `${t.departureTime}|${t.company}|${t.origin}|${t.destination}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(t);
    });

    // Ordena grupos por horário de partida
    const sortedKeys = Object.keys(groups).sort((a, b) =>
        (groups[a][0].departureTime || '').localeCompare(groups[b][0].departureTime || '')
    );

    // Detecta se empresa e rota são comuns a todas as viagens
    const companiesUnicas = new Set(trips.map(t => t.company).filter(Boolean));
    const rotasUnicas     = new Set(trips.map(t => `${t.origin}|${t.destination}`));
    const mesmaEmpresa    = companiesUnicas.size === 1;
    const mesmaRota       = rotasUnicas.size === 1;

    const linhas = sortedKeys.map(key => {
        const group = groups[key];
        group.sort((a, b) => a.priceValue - b.priceValue);

        const porClasse = new Map();
        group.forEach(t => {
            const classeKey = (t.serviceClass || 'Convencional').toUpperCase().trim();
            const existente = porClasse.get(classeKey);

            if (!existente) {
                porClasse.set(classeKey, t);
                return;
            }

            const atualTemPreco = t.priceValue > 0;
            const antigoTemPreco = existente.priceValue > 0;

            if (atualTemPreco && !antigoTemPreco) {
                porClasse.set(classeKey, t);
            } else if (atualTemPreco && antigoTemPreco && t.priceValue < existente.priceValue) {
                porClasse.set(classeKey, t);
            }
        });

        const unicos = Array.from(porClasse.values()).sort((a, b) => {
            if (a.priceValue === 0 && b.priceValue > 0) return 1;
            if (b.priceValue === 0 && a.priceValue > 0) return -1;
            return a.priceValue - b.priceValue;
        });

        const rep = unicos[0];

        const options = unicos.map(t => {
            const classeFormatada = formatarNomeClasse(t.serviceClass);

            if (t.priceValue === 0) {
                return `  🔹 ~${classeFormatada}~ *Lotado* 🔴`;
            }

            const warn = (t.seatsAvailable > 0 && t.seatsAvailable < 5) ? ' ⚠️' : '';
            const lug  = t.seatsAvailable > 0 ? ` (${t.seatsAvailable} lug.)` : '';
            return `  🔹 ${classeFormatada}: *${t.priceRaw}*${lug}${warn}`;
        }).join('\n');

        const chegaParts = [];
        if (rep.arrivalTime) chegaParts.push(`chega _${rep.arrivalTime}_`);
        if (rep.nextDay)     chegaParts.push('_(+1d)_');
        const chegaStr = chegaParts.length ? ` — ${chegaParts.join(' ')}` : '';

        const bloco = [`⏰ *${rep.departureTime}*${chegaStr}`];

        // Tipo de conexão (se não for direto)
        if (rep.connectionType && rep.connectionType !== 'direto') {
            bloco.push(`  ${labelTipoConexao[rep.connectionType] || rep.connectionType}`);
        }

        if (!mesmaRota) {
            const o = limparNomeCidade(rep.origin).toUpperCase();
            const d = limparNomeCidade(rep.destination).toUpperCase();
            bloco.push(`  📍 ${o} → ${d}`);
        }
        if (!mesmaEmpresa && rep.company) {
            bloco.push(`  🚍 ${rep.company}`);
        }

        bloco.push(options);
        return bloco.join('\n');
    });

    // === Cabeçalho ===
    const cabecalho = ['🚌 *OPÇÕES DE VIAGEM*', ''];

    if (mesmaRota) {
        const o = limparNomeCidade(trips[0].origin).toUpperCase();
        const d = limparNomeCidade(trips[0].destination).toUpperCase();
        cabecalho.push(`📍 *${o} → ${d}*`);
    }
    if (mesmaEmpresa) {
        const empresa = Array.from(companiesUnicas)[0];
        if (empresa) cabecalho.push(`🚍 ${empresa}`);
    }
    const dataViagem = extrairDataViagem();
    if (dataViagem) {
        cabecalho.push(`🗓 *${dataViagem}*`);
    }
    cabecalho.push('━━━━━━━━━━━━━━━');

    return cabecalho.join('\n') + '\n\n' + linhas.join('\n\n');
}

// --- Helpers ---

/** Capitaliza classe: "SEMI LEITO" -> "Semi Leito" */
function formatarNomeClasse(classe) {
    if (!classe) return 'Convencional';
    return classe.toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

/** Remove sufixo "- UF" da cidade. "BACABAL - MA" -> "BACABAL" */
function limparNomeCidade(cidade) {
    if (!cidade) return '';
    return cidade.replace(/\s*-\s*[A-Z]{2}\s*$/i, '').trim();
}

/**
 * Tenta extrair a data da viagem do DOM da tela de reserva.
 * Prioridade:
 *   1. b.b-search-date — contém a data exata selecionada (ex: "quarta-feira, 08/07/26")
 *   2. .sales-day.today .sales-day-date — dia ativo no calendário (ex: "quarta, 08 de julho")
 *   3. .service-date-title — cabeçalho da listagem (ex: "quarta-feira, 08 de julho")
 *   4. Fallback: regex genérica nos candidatos antigos
 */
function extrairDataViagem() {
    const dias = {
        'SEG': 'Segunda', 'TER': 'Terça', 'QUA': 'Quarta', 'QUI': 'Quinta', 'SEX': 'Sexta',
        'SÁB': 'Sábado', 'SAB': 'Sábado', 'DOM': 'Domingo'
    };
    const meses = {
        'JAN': 1, 'FEV': 2, 'MAR': 3, 'ABR': 4, 'MAI': 5, 'JUN': 6,
        'JUL': 7, 'AGO': 8, 'SET': 9, 'OUT': 10, 'NOV': 11, 'DEZ': 12
    };

    // --- Estratégia 1: b.b-search-date (mais confiável) ---
    // Formato esperado: "quarta-feira, 08/07/26" ou "quarta-feira, 08/07/2026"
    const bSearchDate = document.querySelector('b.b-search-date');
    if (bSearchDate) {
        const txt = (bSearchDate.textContent || '').trim();
        // Tenta extrair "dia-da-semana, DD/MM/AA" ou "dia-da-semana, DD/MM/AAAA"
        const m = txt.match(/([\wÀ-ÿ-]+),?\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/i);
        if (m) {
            const diaSemanaRaw = m[1].replace(/-feira/i, '').trim().toUpperCase().substring(0, 3);
            const dia = dias[diaSemanaRaw] || m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase().replace(/-feira/i, '');
            const num = String(m[2]).padStart(2, '0');
            const mes = String(m[3]).padStart(2, '0');
            return `${dia}, ${num}/${mes}`;
        }
    }

    // --- Estratégia 2: .sales-day.today (dia selecionado no calendário) ---
    const diaHoje = document.querySelector('.sales-day.today .sales-day-date');
    if (diaHoje) {
        const txt = (diaHoje.textContent || '').toUpperCase();
        const m = txt.match(/(SEG|TER|QUA|QUI|SEX|S[AÁ]B|DOM)[A-ZÇÃÁÉÍÓÚ]*,?\s+(\d{1,2})\s*(?:DE)?\s*([A-ZÇÃÁÉÍÓÚ]+)/i);
        if (m) {
            const prefixoDia = m[1].substring(0, 3);
            const dia = dias[prefixoDia] || m[1];
            const num = String(m[2]).padStart(2, '0');
            const prefixoMes = m[3].substring(0, 3);
            const mesN = meses[prefixoMes] || 0;
            if (mesN > 0) {
                return `${dia}, ${num}/${String(mesN).padStart(2, '0')}`;
            }
        }
    }

    // --- Estratégia 3: .service-date-title (cabeçalho da lista de serviços) ---
    const dateTitleEl = document.querySelector('.service-date-title');
    if (dateTitleEl) {
        const txt = (dateTitleEl.textContent || '').toUpperCase();
        const m = txt.match(/(SEG|TER|QUA|QUI|SEX|S[AÁ]B|DOM)[A-ZÇÃÁÉÍÓÚ]*(?:[-\s]*FEIRA)?,?\s+(\d{1,2})\s*(?:DE)?\s*([A-ZÇÃÁÉÍÓÚ]+)/i);
        if (m) {
            const prefixoDia = m[1].substring(0, 3);
            const dia = dias[prefixoDia] || m[1];
            const num = String(m[2]).padStart(2, '0');
            const prefixoMes = m[3].substring(0, 3);
            const mesN = meses[prefixoMes] || 0;
            if (mesN > 0) {
                return `${dia}, ${num}/${String(mesN).padStart(2, '0')}`;
            }
        }
    }

    // --- Estratégia 4: Fallback — busca genérica (exclui calendário lateral) ---
    const candidatos = document.querySelectorAll(
        '.div-search-local-date, app-list-services, .header-search'
    );

    for (const el of candidatos) {
        const txt = (el.textContent || '').toUpperCase();
        const m = txt.match(
            /(SEG|TER|QUA|QUI|SEX|S[AÁ]B|DOM)[A-ZÇÃÁÉÍÓÚ]*[A-Z]*(?:[-\s]*FEIRA)?,?\s+(\d{1,2})\s*(?:DE)?\s*([A-ZÇÃÁÉÍÓÚ]+)/i
        );
        if (m) {
            const prefixoDia = m[1].toUpperCase().substring(0, 3);
            const dia = dias[prefixoDia] || m[1];
            const num = String(m[2]).padStart(2, '0');
            const prefixoMes = m[3].toUpperCase().substring(0, 3);
            const mesN = meses[prefixoMes] || 0;
            if (mesN > 0) {
                return `${dia}, ${num}/${String(mesN).padStart(2, '0')}`;
            }
        }
    }
    return null;
}

// =================================================================
// MODAL DE SELEÇÃO DE HORÁRIOS + IMPRESSÃO TÉRMICA
// =================================================================

const LABEL_TIPO_CONEXAO = {
    'direto': 'Direto',
    'cruzamento': 'Cruzamento',
    'mesma_linha': 'Mesma Linha',
    'vira_bandeira': 'Vira Bandeira'
};

const COR_TIPO_CONEXAO = {
    'direto': '#3498db',
    'cruzamento': '#e67e22',
    'mesma_linha': '#9b59b6',
    'vira_bandeira': '#1abc9c'
};

function abrirModalHorarios(trips) {
    // Remove modal anterior se existir
    const existente = document.getElementById('sb-modal-horarios-overlay');
    if (existente) existente.remove();

    // Identifica classes únicas e tipos de conexão únicos
    const classesUnicas = [...new Set(trips.map(t => (t.serviceClass || 'Convencional')))];
    const tiposConexao = [...new Set(trips.map(t => (t.connectionType || 'direto')))];

    // === OVERLAY ===
    const overlay = document.createElement('div');
    overlay.id = 'sb-modal-horarios-overlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5); z-index: 999999;
        display: flex; justify-content: center; align-items: center;
        font-family: Arial, sans-serif;
    `;

    // === MODAL ===
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: white; border-radius: 12px; max-width: 540px; width: 95%;
        max-height: 85vh; display: flex; flex-direction: column;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3); overflow: hidden;
    `;

    // --- Header ---
    const header = document.createElement('div');
    header.style.cssText = `
        padding: 14px 18px; background: linear-gradient(135deg, #303f9f, #1d2660);
        color: white; display: flex; justify-content: space-between; align-items: center;
        flex-shrink: 0;
    `;
    header.innerHTML = `
        <span style="font-weight:bold; font-size:16px;">🚌 Horários Disponíveis (${trips.length})</span>
        <span id="sb-modal-fechar" style="cursor:pointer; font-size:22px; font-weight:bold; padding:0 6px; line-height:1;">✕</span>
    `;

    // --- Filtros ---
    const filtros = document.createElement('div');
    filtros.style.cssText = `
        padding: 12px 18px; border-bottom: 1px solid #eee; background: #f8f9fa; flex-shrink: 0;
    `;

    let classesHTML = '<div style="margin-bottom:10px;"><span style="font-size:11px; font-weight:bold; color:#555; text-transform:uppercase; letter-spacing:0.5px;">Classes:</span><div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:5px;">';
    classesUnicas.forEach(c => {
        const classeFormatada = formatarNomeClasse(c);
        classesHTML += `
            <label style="display:flex; align-items:center; gap:4px; font-size:12px; cursor:pointer; background:white; padding:4px 10px; border-radius:20px; border:1px solid #ddd; transition:all 0.15s;">
                <input type="checkbox" class="sb-filtro-classe" value="${c}" checked style="cursor:pointer; accent-color:#303f9f;">
                ${classeFormatada}
            </label>
        `;
    });
    classesHTML += '</div></div>';

    let tiposHTML = '<div><span style="font-size:11px; font-weight:bold; color:#555; text-transform:uppercase; letter-spacing:0.5px;">Tipo de Conexão:</span><div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:5px;">';
    tiposConexao.forEach(t => {
        const cor = COR_TIPO_CONEXAO[t] || '#666';
        tiposHTML += `
            <label style="display:flex; align-items:center; gap:4px; font-size:12px; cursor:pointer; background:${cor}11; padding:4px 10px; border-radius:20px; border:1px solid ${cor}44; transition:all 0.15s;">
                <input type="checkbox" class="sb-filtro-tipo" value="${t}" checked style="cursor:pointer; accent-color:${cor};">
                ${LABEL_TIPO_CONEXAO[t] || t}
            </label>
        `;
    });
    tiposHTML += '</div></div>';

    filtros.innerHTML = classesHTML + tiposHTML;

    // --- Selecionar Todos ---
    const selecionarTodos = document.createElement('div');
    selecionarTodos.style.cssText = `
        padding: 8px 18px; border-bottom: 1px solid #eee; background: #fff; flex-shrink: 0;
    `;
    selecionarTodos.innerHTML = `
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-weight:bold; font-size:13px; color:#2c3e50;">
            <input type="checkbox" id="sb-modal-select-all" checked style="width:18px; height:18px; cursor:pointer; accent-color:#303f9f;">
            Selecionar Todos
        </label>
    `;

    // --- Lista de horários ---
    const lista = document.createElement('div');
    lista.id = 'sb-modal-lista-horarios';
    lista.style.cssText = `
        flex: 1; overflow-y: auto; padding: 8px 14px; min-height: 120px;
    `;

    trips.forEach((trip, i) => {
        const item = document.createElement('label');
        item.className = 'sb-horario-item';
        item.setAttribute('data-classe', trip.serviceClass || 'Convencional');
        item.setAttribute('data-tipo', trip.connectionType || 'direto');
        item.setAttribute('data-index', i);

        const classeFormatada = formatarNomeClasse(trip.serviceClass);
        const tipoLabel = LABEL_TIPO_CONEXAO[trip.connectionType] || 'Direto';
        const tipoCor = COR_TIPO_CONEXAO[trip.connectionType] || '#3498db';
        const lotado = trip.priceValue === 0;
        const precoTexto = lotado
            ? '<span style="color:#e74c3c; font-weight:bold; font-size:11px;">Lotado 🔴</span>'
            : `<span style="color:#27ae60; font-weight:bold;">${trip.priceRaw}</span>`;
        const chegada = trip.arrivalTime ? ` → ${trip.arrivalTime}` : '';
        const diaSegStr = trip.nextDay ? ' (+1d)' : '';
        const vagas = (trip.seatsAvailable > 0 && trip.seatsAvailable < 5) ? ` <span style="color:#e67e22;">⚠️${trip.seatsAvailable} vagas</span>` : '';

        item.style.cssText = `
            display: flex; align-items: center; gap: 8px; padding: 9px 10px;
            border: 1px solid #eee; border-radius: 8px; margin-bottom: 5px;
            cursor: pointer; transition: background 0.15s; font-size: 12px;
            background: white;
        `;

        item.addEventListener('mouseenter', () => item.style.background = '#f0f4ff');
        item.addEventListener('mouseleave', () => item.style.background = 'white');

        item.innerHTML = `
            <input type="checkbox" class="sb-chk-horario" data-trip-index="${i}" checked
                   style="width:18px; height:18px; cursor:pointer; flex-shrink:0; accent-color:#303f9f;">
            <div style="flex:1; display:flex; flex-wrap:wrap; gap:4px; align-items:center;">
                <span style="font-weight:bold; font-size:14px; color:#2c3e50;">⏰ ${trip.departureTime}${chegada}${diaSegStr}</span>
                <span style="background:#f0f0f0; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:600;">${classeFormatada}</span>
                <span style="background:${tipoCor}18; color:${tipoCor}; padding:2px 8px; border-radius:12px; font-size:10px; font-weight:bold;">${tipoLabel}</span>
                ${precoTexto}${vagas}
            </div>
        `;

        lista.appendChild(item);
    });

    // --- Contador de selecionados ---
    const contador = document.createElement('div');
    contador.id = 'sb-modal-contador';
    contador.style.cssText = `
        padding: 6px 18px; background: #f8f9fa; border-top: 1px solid #eee;
        font-size: 12px; color: #666; text-align: center; flex-shrink: 0;
    `;
    contador.textContent = `${trips.length} de ${trips.length} selecionados`;

    // --- Botões de ação ---
    const acoes = document.createElement('div');
    acoes.style.cssText = `
        padding: 12px 18px; border-top: 1px solid #eee; background: white;
        display: flex; gap: 8px; flex-shrink: 0;
    `;
    acoes.innerHTML = `
        <button id="sb-modal-btn-copiar" style="flex:1; padding:12px; background:#26d768; color:white; border:none; border-radius:8px; font-weight:bold; font-size:14px; cursor:pointer; transition:background 0.2s; display:flex; align-items:center; justify-content:center; gap:6px;">
            📋 Copiar WhatsApp
        </button>
        <button id="sb-modal-btn-imprimir" style="flex:1; padding:12px; background:#303f9f; color:white; border:none; border-radius:8px; font-weight:bold; font-size:14px; cursor:pointer; transition:background 0.2s; display:flex; align-items:center; justify-content:center; gap:6px;">
            🖨️ Imprimir
        </button>
    `;

    // === Monta o modal ===
    modal.appendChild(header);
    modal.appendChild(filtros);
    modal.appendChild(selecionarTodos);
    modal.appendChild(lista);
    modal.appendChild(contador);
    modal.appendChild(acoes);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // === EVENTOS ===

    // Fechar modal
    overlay.querySelector('#sb-modal-fechar').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.addEventListener('keydown', function _escHandler(e) {
        if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', _escHandler); }
    });

    // Atualizar contador
    const atualizarContador = () => {
        const total = overlay.querySelectorAll('.sb-horario-item:not([style*="display: none"])').length;
        const selecionados = overlay.querySelectorAll('.sb-horario-item:not([style*="display: none"]) .sb-chk-horario:checked').length;
        const contadorEl = overlay.querySelector('#sb-modal-contador');
        if (contadorEl) contadorEl.textContent = `${selecionados} de ${total} selecionados`;
    };

    // Selecionar todos
    overlay.querySelector('#sb-modal-select-all').addEventListener('change', (e) => {
        const checked = e.target.checked;
        overlay.querySelectorAll('.sb-horario-item').forEach(item => {
            if (item.style.display !== 'none') {
                const chk = item.querySelector('.sb-chk-horario');
                if (chk) chk.checked = checked;
            }
        });
        atualizarContador();
    });

    // Filtros de classe e tipo
    const aplicarFiltros = () => {
        const classesSelecionadas = new Set(
            Array.from(overlay.querySelectorAll('.sb-filtro-classe:checked')).map(c => c.value)
        );
        const tiposSelecionados = new Set(
            Array.from(overlay.querySelectorAll('.sb-filtro-tipo:checked')).map(c => c.value)
        );

        overlay.querySelectorAll('.sb-horario-item').forEach(item => {
            const classe = item.getAttribute('data-classe');
            const tipo = item.getAttribute('data-tipo');
            const visivel = classesSelecionadas.has(classe) && tiposSelecionados.has(tipo);
            item.style.display = visivel ? 'flex' : 'none';
        });
        atualizarContador();
    };

    overlay.querySelectorAll('.sb-filtro-classe, .sb-filtro-tipo').forEach(chk => {
        chk.addEventListener('change', aplicarFiltros);
    });

    // Clique em checkboxes individuais atualiza contador
    overlay.querySelectorAll('.sb-chk-horario').forEach(chk => {
        chk.addEventListener('change', atualizarContador);
    });

    // Botão Copiar WhatsApp
    overlay.querySelector('#sb-modal-btn-copiar').addEventListener('click', async () => {
        const btn = overlay.querySelector('#sb-modal-btn-copiar');
        const selecionados = _obterTripsSelecionados(overlay, trips);

        if (selecionados.length === 0) {
            btn.innerHTML = '❌ Nenhum selecionado!';
            btn.style.background = '#e74c3c';
            setTimeout(() => { btn.innerHTML = '📋 Copiar WhatsApp'; btn.style.background = '#26d768'; }, 2000);
            return;
        }

        const texto = formatarHorariosParaWhatsapp(selecionados);
        if (texto) {
            try {
                await navigator.clipboard.writeText(texto);
                const contagem = selecionados.length;
                // Fecha o modal imediatamente
                overlay.remove();
                // Mostra feedback no botão principal da tela
                const btnPrincipal = document.getElementById('sb-btn-copiar-horarios');
                const statusEl = document.getElementById('sb-horarios-status');
                if (btnPrincipal) {
                    btnPrincipal.textContent = `✅ ${contagem} horário(s) copiado(s)!`;
                    btnPrincipal.style.backgroundColor = '#27ae60';
                    setTimeout(() => _resetBtnHorarios(btnPrincipal, statusEl), 2500);
                }
            } catch (err) {
                console.error('❌ Prigia: Erro ao copiar:', err);
                btn.innerHTML = '❌ Erro ao copiar';
                btn.style.background = '#e74c3c';
                setTimeout(() => { btn.innerHTML = '📋 Copiar WhatsApp'; btn.style.background = '#26d768'; }, 2500);
            }
        }
    });

    // Botão Imprimir
    overlay.querySelector('#sb-modal-btn-imprimir').addEventListener('click', () => {
        const selecionados = _obterTripsSelecionados(overlay, trips);
        const btn = overlay.querySelector('#sb-modal-btn-imprimir');

        if (selecionados.length === 0) {
            btn.innerHTML = '❌ Nenhum selecionado!';
            btn.style.background = '#e74c3c';
            setTimeout(() => { btn.innerHTML = '🖨️ Imprimir'; btn.style.background = '#3498db'; }, 2000);
            return;
        }

        imprimirHorariosSelecionados(selecionados);
        overlay.remove();
    });
}

/**
 * Retorna os trips cujos checkboxes estão marcados E visíveis (não filtrados).
 */
function _obterTripsSelecionados(overlay, trips) {
    const indices = [];
    overlay.querySelectorAll('.sb-chk-horario:checked').forEach(chk => {
        const item = chk.closest('.sb-horario-item');
        if (item && item.style.display !== 'none') {
            indices.push(parseInt(chk.getAttribute('data-trip-index')));
        }
    });
    return indices.map(i => trips[i]).filter(Boolean);
}

/**
 * Abre uma janela formatada para impressão em papel térmico e chama window.print().
 */
function imprimirHorariosSelecionados(trips) {
    if (!trips || trips.length === 0) return;

    // Captura informações do cabeçalho
    let globalOrigin = '';
    let globalDestination = '';
    const headerInfo = document.querySelector('.div-search-local-date');
    if (headerInfo) {
        const bTags = headerInfo.querySelectorAll('b');
        if (bTags.length >= 2) {
            globalOrigin = bTags[0].textContent.replace(/^[A-Z]{3}\s*-\s*/, '').trim();
            globalDestination = bTags[1].textContent.replace(/^[A-Z]{3}\s*-\s*/, '').trim();
        }
    }

    const origin = limparNomeCidade(globalOrigin || trips[0].origin || 'ORIGEM').toUpperCase();
    const destination = limparNomeCidade(globalDestination || trips[0].destination || 'DESTINO').toUpperCase();
    const dataViagem = extrairDataViagem() || new Date().toLocaleDateString('pt-BR');

    // Ordena por horário
    const sorted = [...trips].sort((a, b) =>
        (a.departureTime || '').localeCompare(b.departureTime || '')
    );

    // Monta as linhas da tabela
    let linhasHTML = '';
    sorted.forEach((t, idx) => {
        const classeFormatada = formatarNomeClasse(t.serviceClass);
        const tipo = LABEL_TIPO_CONEXAO[t.connectionType] || '';
        const tipoStr = (t.connectionType && t.connectionType !== 'direto') ? `<br><small>${tipo}</small>` : '';
        const chegada = t.arrivalTime || '';
        const diasSeg = t.nextDay ? ' +1d' : '';
        const preco = t.priceValue > 0 ? t.priceRaw : '<b style="color:#c0392b;">LOTADO</b>';
        const vagas = (t.seatsAvailable > 0 && t.seatsAvailable < 5) ? ` <small>(${t.seatsAvailable}v)</small>` : '';
        const horarioDisplay = chegada
            ? `${t.departureTime} → ${chegada}${diasSeg}`
            : t.departureTime;
        const bgRow = idx % 2 === 1 ? 'background:#f9f9f9;' : '';

        linhasHTML += `
            <tr style="${bgRow}">
                <td style="text-align:center; font-weight:bold; font-size:14px; padding:6px 2px; white-space:nowrap;">
                    ${horarioDisplay}
                </td>
                <td style="padding:6px 4px; font-size:12px;">
                    ${classeFormatada}${tipoStr}
                </td>
                <td style="text-align:right; padding:6px 2px; font-size:13px; font-weight:bold;">
                    ${preco}${vagas}
                </td>
            </tr>
        `;
    });

    // HTML completo para impressão térmica
    const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Horários - ${origin} → ${destination}</title>
    <style>
        @page {
            size: 80mm auto;
            margin: 2mm;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Courier New', monospace;
            font-size: 14px;
            font-weight: bold;
            width: 76mm;
            color: #000;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .header {
            text-align: center;
            padding: 4px 0 6px;
            border-bottom: 2px dashed #000;
            margin-bottom: 6px;
        }
        .header h1 {
            font-size: 20px;
            margin: 0 0 2px;
            font-weight: bold;
        }
        .header .rota {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 2px;
        }
        .header .data {
            font-size: 15px;
            font-weight: bold;
            margin-top: 2px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        thead th {
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
            border-bottom: 2px solid #000;
            padding: 4px 2px;
            text-align: left;
        }
        thead th:first-child { text-align: center; }
        thead th:last-child { text-align: right; }
        tbody td {
            font-size: 14px;
            font-weight: bold;
        }
        tbody tr {
            border-bottom: 1px dotted #aaa;
        }
        tbody tr:nth-child(even) {
            background: #f5f5f5;
        }
        tbody tr:last-child {
            border-bottom: 2px dashed #000;
        }
        .footer {
            text-align: center;
            padding: 8px 0 4px;
            font-size: 12px;
            font-weight: bold;
            color: #333;
            line-height: 1.6;
        }
        .footer .telefone {
            font-size: 13px;
            font-weight: bold;
            color: #000;
        }
        @media screen {
            body {
                max-width: 300px;
                margin: 20px auto;
                padding: 10px;
                border: 1px solid #ccc;
                background: #fff;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚌 HORÁRIOS</h1>
        <div class="rota">${origin} → ${destination}</div>
        <div class="data">📅 ${dataViagem}</div>
    </div>

    <table>
        <thead>
            <tr>
                <th>Horário</th>
                <th>Classe</th>
                <th>Valor</th>
            </tr>
        </thead>
        <tbody>
            ${linhasHTML}
        </tbody>
    </table>

    <div class="footer">
        ${sorted.length} horário(s) &middot; Prigia Caixa de Ferramentas<br>
        <span class="telefone">📞 (99) 9 8106-7497</span>
    </div>

    <script>
        window.onload = function() { window.print(); };
    <\/script>
</body>
</html>`;

    // Abre janela de impressão
    const printWin = window.open('', '_blank', 'width=350,height=600');
    if (printWin) {
        printWin.document.write(html);
        printWin.document.close();
    } else {
        alert('Não foi possível abrir a janela de impressão. Verifique se popups estão permitidos.');
    }
}