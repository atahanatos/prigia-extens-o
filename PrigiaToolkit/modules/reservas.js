// 1. Prepara o painel da lista para ficar escondidinho aguardando
const painel = document.createElement('div');
painel.style.cssText = `
    position: fixed;
    width: 350px;
    max-height: 450px;
    background: #ffffff;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    z-index: 999999;
    display: none;
    flex-direction: column;
    box-shadow: 0 8px 24px rgba(0,0,0,0.08);
    font-family: 'Inter', -apple-system, sans-serif;
`;
document.body.appendChild(painel);

// Cabeçalho do painel
const cabecalho = document.createElement('div');
cabecalho.style.cssText = `
    background-color: #ffffff;
    padding: 12px 16px;
    border-bottom: 1px solid #eaeaea;
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
`;
cabecalho.innerHTML = `<span style="font-weight: 600; font-size: 14px; color: #303f9f;">Reservas Salvas</span>`;

const iconesCabecalho = document.createElement('div');
iconesCabecalho.style.cssText = 'display: flex; gap: 8px; align-items: center;';

const svgColar = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
const svgShare = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>`;

const btnColar = document.createElement('button');
btnColar.innerHTML = svgColar;
btnColar.title = 'Colar reservas (Ctrl+V)';
btnColar.style.cssText = 'background: #f5f5f5; border: 1px solid #eaeaea; cursor: pointer; padding: 6px; border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: all 0.2s;';
btnColar.onmouseover = () => { btnColar.style.background = '#ebebeb'; btnColar.querySelector('svg').setAttribute('stroke', '#111'); };
btnColar.onmouseout = () => { btnColar.style.background = '#f5f5f5'; btnColar.querySelector('svg').setAttribute('stroke', '#666'); };

const btnCompartilhar = document.createElement('button');
btnCompartilhar.innerHTML = svgShare;
btnCompartilhar.title = 'Compartilhar lista';
btnCompartilhar.style.cssText = 'background: #f5f5f5; border: 1px solid #eaeaea; cursor: pointer; padding: 6px; border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: all 0.2s;';
btnCompartilhar.onmouseover = () => { btnCompartilhar.style.background = '#ebebeb'; btnCompartilhar.querySelector('svg').setAttribute('stroke', '#111'); };
btnCompartilhar.onmouseout = () => { btnCompartilhar.style.background = '#f5f5f5'; btnCompartilhar.querySelector('svg').setAttribute('stroke', '#666'); };

iconesCabecalho.appendChild(btnColar);
iconesCabecalho.appendChild(btnCompartilhar);
cabecalho.appendChild(iconesCabecalho);

painel.appendChild(cabecalho);

function gerarTextoCompartilhamento(reservasSelecionadas) {
    const reservas = reservasSelecionadas || JSON.parse(localStorage.getItem('prigia_reservas') || '[]');
    if (reservas.length === 0) return null;
    const dadosParaCompartilhar = reservas.map(r => ({...r, isShared: true}));
    const jsonStr = JSON.stringify(dadosParaCompartilhar);
    const base64Str = btoa(unescape(encodeURIComponent(jsonStr)));
    return `PRIGIA_SHARE_V1:${base64Str}`;
}

// ===== LOGO DA PRIGIA PARA O QR CODE =====
function _desenharLogoPrigia(ctx, centerX, centerY, radius) {
    // Círculo branco de fundo com sombra
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();

    // Borda fina azul
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#303f9f';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Letra "P" estilizada
    ctx.fillStyle = '#1d2660';
    ctx.font = `bold ${radius * 1.3}px 'Segoe UI', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('P', centerX, centerY + 1);
}

// ===== GERAR QR CODE COM LOGO =====
async function _gerarQrComLogo(texto, tamanho) {
    return new Promise((resolve, reject) => {
        // Container temporário invisível
        const tempDiv = document.createElement('div');
        tempDiv.style.cssText = 'position:fixed; left:-9999px; top:-9999px;';
        document.body.appendChild(tempDiv);

        try {
            // Gera QR Code usando QRCode.js
            const qr = new QRCode(tempDiv, {
                text: texto,
                width: tamanho,
                height: tamanho,
                colorDark: '#1a1f3d',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.H  // Alta correção para suportar o logo
            });

            // Espera o canvas ser renderizado
            setTimeout(() => {
                const qrCanvas = tempDiv.querySelector('canvas');
                if (!qrCanvas) {
                    tempDiv.remove();
                    reject(new Error('QR Canvas não encontrado'));
                    return;
                }

                // Cria canvas final com padding e logo
                const padding = 28;
                const finalSize = tamanho + padding * 2;
                const finalCanvas = document.createElement('canvas');
                finalCanvas.width = finalSize;
                finalCanvas.height = finalSize;
                const ctx = finalCanvas.getContext('2d');

                // Fundo branco com bordas arredondadas
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                const r = 16;
                ctx.moveTo(r, 0);
                ctx.lineTo(finalSize - r, 0);
                ctx.quadraticCurveTo(finalSize, 0, finalSize, r);
                ctx.lineTo(finalSize, finalSize - r);
                ctx.quadraticCurveTo(finalSize, finalSize, finalSize - r, finalSize);
                ctx.lineTo(r, finalSize);
                ctx.quadraticCurveTo(0, finalSize, 0, finalSize - r);
                ctx.lineTo(0, r);
                ctx.quadraticCurveTo(0, 0, r, 0);
                ctx.closePath();
                ctx.fill();

                // Desenha o QR code
                ctx.drawImage(qrCanvas, padding, padding);

                // Logo da Prigia no centro
                const logoRadius = tamanho * 0.12;
                _desenharLogoPrigia(ctx, finalSize / 2, finalSize / 2, logoRadius);

                tempDiv.remove();
                resolve(finalCanvas);
            }, 150);
        } catch (err) {
            tempDiv.remove();
            reject(err);
        }
    });
}

// ===== DECODIFICAR QR DE UMA IMAGEM (BLOB/FILE) =====
async function _decodificarQrDeImagem(imageBlob) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            const code = jsQR(imageData.data, imageData.width, imageData.height);
            if (code && code.data) {
                resolve(code.data);
            } else {
                reject(new Error('Nenhum QR Code encontrado na imagem.'));
            }
        };
        img.onerror = () => reject(new Error('Erro ao carregar imagem.'));
        img.src = URL.createObjectURL(imageBlob);
    });
}

// ===== MODAL PREMIUM DE COMPARTILHAMENTO VIA QR CODE =====
function abrirModalCompartilhar() {
    const todasReservas = JSON.parse(localStorage.getItem('prigia_reservas') || '[]');
    if (todasReservas.length === 0) {
        alert('Nenhuma reserva para compartilhar!');
        return;
    }

    const existente = document.getElementById('prigia-modal-share-overlay');
    if (existente) existente.remove();

    // === OVERLAY ===
    const overlay = document.createElement('div');
    overlay.id = 'prigia-modal-share-overlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(5, 5, 20, 0.75); backdrop-filter: blur(8px);
        z-index: 9999999;
        display: flex; justify-content: center; align-items: center;
        font-family: 'Segoe UI', -apple-system, sans-serif;
        opacity: 0; transition: opacity 0.4s cubic-bezier(0.32, 0.72, 0, 1);
    `;

    // === MODAL (Double-Bezel) ===
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 24px;
        padding: 3px;
        max-width: 440px; width: 92%;
        max-height: 88vh;
        transform: translateY(20px) scale(0.97);
        opacity: 0;
        transition: all 0.5s cubic-bezier(0.32, 0.72, 0, 1);
    `;

    // Inner core
    const innerCore = document.createElement('div');
    innerCore.style.cssText = `
        background: linear-gradient(165deg, #0d1033 0%, #0a0a1a 40%, #0f0826 100%);
        border-radius: 21px;
        display: flex; flex-direction: column;
        overflow: hidden;
        box-shadow: inset 0 1px 1px rgba(255,255,255,0.06), 0 20px 60px rgba(0,0,0,0.5);
        max-height: 85vh;
    `;

    // --- Header ---
    const header = document.createElement('div');
    header.style.cssText = `
        padding: 20px 24px 16px;
        display: flex; justify-content: space-between; align-items: center;
        flex-shrink: 0;
        border-bottom: 1px solid rgba(255,255,255,0.06);
    `;
    header.innerHTML = `
        <div>
            <div style="font-size:9px; text-transform:uppercase; letter-spacing:2.5px; color:rgba(255,255,255,0.35); font-weight:500; margin-bottom:6px;">Compartilhar</div>
            <div style="font-weight:700; font-size:17px; color:#fff; letter-spacing:-0.3px;">Reservas via QR Code</div>
        </div>
        <div id="prigia-share-close" style="
            width:32px; height:32px; border-radius:50%;
            background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.08);
            display:flex; align-items:center; justify-content:center;
            cursor:pointer; transition: all 0.3s cubic-bezier(0.32,0.72,0,1);
            color:rgba(255,255,255,0.5); font-size:14px; font-weight:bold;
        ">✕</div>
    `;

    // --- Seleção de reservas ---
    const selectSection = document.createElement('div');
    selectSection.style.cssText = `
        padding: 12px 20px;
        border-bottom: 1px solid rgba(255,255,255,0.04);
        flex-shrink: 0;
    `;

    const selectAllLabel = document.createElement('label');
    selectAllLabel.style.cssText = `
        display:flex; align-items:center; gap:10px; cursor:pointer;
        font-weight:600; font-size:12px; color:rgba(255,255,255,0.7);
    `;
    selectAllLabel.innerHTML = `
        <input type="checkbox" id="prigia-share-select-all" checked
               style="width:15px;height:15px;cursor:pointer;accent-color:#6c7bff;border-radius:4px;">
        <span>Selecionar todas</span>
        <span style="background:rgba(108,123,255,0.15); color:#8b9aff; font-size:10px; padding:2px 8px; border-radius:99px; font-weight:700;">${todasReservas.length}</span>
    `;
    selectSection.appendChild(selectAllLabel);

    // --- Lista de reservas ---
    const lista = document.createElement('div');
    lista.style.cssText = `
        flex: 1; overflow-y: auto; padding: 8px 16px;
        display: flex; flex-direction: column; gap: 4px;
        max-height: 180px;
        scrollbar-width: thin;
        scrollbar-color: rgba(255,255,255,0.1) transparent;
    `;

    todasReservas.forEach((res, idx) => {
        const item = document.createElement('label');
        item.style.cssText = `
            display: flex; align-items: center; gap: 10px;
            padding: 10px 12px;
            border: 1px solid rgba(255,255,255,0.04);
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.25s cubic-bezier(0.32, 0.72, 0, 1);
            background: rgba(255,255,255,0.02);
        `;
        item.addEventListener('mouseenter', () => {
            item.style.background = 'rgba(108,123,255,0.06)';
            item.style.borderColor = 'rgba(108,123,255,0.15)';
        });
        item.addEventListener('mouseleave', () => {
            item.style.background = 'rgba(255,255,255,0.02)';
            item.style.borderColor = 'rgba(255,255,255,0.04)';
        });

        const tag = res.isShared
            ? '<span style="font-size:9px;color:rgba(255,255,255,0.3);border:1px solid rgba(255,255,255,0.08);border-radius:4px;padding:1px 6px;margin-left:6px;letter-spacing:0.5px;">RECEBIDA</span>'
            : '';

        item.innerHTML = `
            <input type="checkbox" class="prigia-share-chk" data-idx="${idx}" checked
                   style="width:14px;height:14px;flex-shrink:0;cursor:pointer;accent-color:#6c7bff;border-radius:3px;">
            <div style="flex:1;min-width:0;">
                <div style="font-weight:700;color:rgba(255,255,255,0.9);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${res.localizador}${tag}</div>
                <div style="color:rgba(255,255,255,0.45);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${res.passageiro}</div>
            </div>
            <div style="color:rgba(255,255,255,0.25);font-size:10px;flex-shrink:0;white-space:nowrap;">${res.origem || ''} → ${res.destino || ''}</div>
        `;
        lista.appendChild(item);
    });

    // --- Área do QR Code ---
    const qrArea = document.createElement('div');
    qrArea.id = 'prigia-qr-area';
    qrArea.style.cssText = `
        padding: 24px 20px;
        display: flex; flex-direction: column; align-items: center;
        gap: 16px;
        border-top: 1px solid rgba(255,255,255,0.04);
        flex-shrink: 0;
    `;
    qrArea.innerHTML = `
        <div id="prigia-qr-container" style="
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 20px;
            padding: 16px;
            display: none;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            transition: all 0.5s cubic-bezier(0.32,0.72,0,1);
        ">
            <div id="prigia-qr-canvas-wrapper" style="
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 8px 32px rgba(0,0,0,0.4);
            "></div>
            <div id="prigia-qr-info" style="
                font-size:11px; color:rgba(255,255,255,0.35);
                text-align:center; letter-spacing:0.3px;
            "></div>
        </div>
    `;

    // --- Footer com botões ---
    const footer = document.createElement('div');
    footer.style.cssText = `
        padding: 16px 20px 20px;
        display: flex; flex-direction: column; gap: 8px;
        flex-shrink: 0;
    `;

    // Contador
    const contador = document.createElement('div');
    contador.id = 'prigia-share-contador';
    contador.style.cssText = 'font-size:10px; color:rgba(255,255,255,0.25); text-align:center; letter-spacing:0.5px;';
    contador.textContent = `${todasReservas.length} de ${todasReservas.length} selecionadas`;

    // Botão Gerar QR
    const btnGerar = document.createElement('button');
    btnGerar.id = 'prigia-share-btn-gerar';
    btnGerar.innerHTML = `
        <span style="display:flex;align-items:center;justify-content:center;gap:8px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
                <rect x="14" y="14" width="3" height="3"></rect>
                <line x1="21" y1="14" x2="21" y2="14.01"></line>
                <line x1="21" y1="21" x2="21" y2="21.01"></line>
            </svg>
            Gerar QR Code
        </span>
    `;
    btnGerar.style.cssText = `
        width:100%; padding:13px 20px;
        background: linear-gradient(135deg, #4a5acf 0%, #303f9f 100%);
        color:#fff; border:none; border-radius:14px;
        font-weight:700; font-size:13px; cursor:pointer;
        transition: all 0.3s cubic-bezier(0.32,0.72,0,1);
        font-family: 'Segoe UI', -apple-system, sans-serif;
        letter-spacing: -0.2px;
        box-shadow: 0 4px 20px rgba(74,90,207,0.3);
    `;

    // Botão Copiar QR (aparece depois)
    const btnCopiar = document.createElement('button');
    btnCopiar.id = 'prigia-share-btn-copiar';
    btnCopiar.innerHTML = `
        <span style="display:flex;align-items:center;justify-content:center;gap:8px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            Copiar QR Code
        </span>
    `;
    btnCopiar.style.cssText = `
        width:100%; padding:13px 20px;
        background: rgba(255,255,255,0.06);
        color:rgba(255,255,255,0.8); border:1px solid rgba(255,255,255,0.08);
        border-radius:14px;
        font-weight:600; font-size:13px; cursor:pointer;
        transition: all 0.3s cubic-bezier(0.32,0.72,0,1);
        font-family: 'Segoe UI', -apple-system, sans-serif;
        display: none;
    `;

    footer.appendChild(contador);
    footer.appendChild(btnGerar);
    footer.appendChild(btnCopiar);

    // === Monta modal ===
    innerCore.appendChild(header);
    innerCore.appendChild(selectSection);
    innerCore.appendChild(lista);
    innerCore.appendChild(qrArea);
    innerCore.appendChild(footer);
    modal.appendChild(innerCore);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // === Animação de entrada ===
    requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        setTimeout(() => {
            modal.style.transform = 'translateY(0) scale(1)';
            modal.style.opacity = '1';
        }, 50);
    });

    // === EVENTOS ===

    const fecharModal = () => {
        modal.style.transform = 'translateY(10px) scale(0.97)';
        modal.style.opacity = '0';
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 350);
    };

    overlay.querySelector('#prigia-share-close').addEventListener('click', fecharModal);
    overlay.querySelector('#prigia-share-close').addEventListener('mouseenter', function() {
        this.style.background = 'rgba(255,255,255,0.12)';
        this.style.color = '#fff';
    });
    overlay.querySelector('#prigia-share-close').addEventListener('mouseleave', function() {
        this.style.background = 'rgba(255,255,255,0.06)';
        this.style.color = 'rgba(255,255,255,0.5)';
    });
    overlay.addEventListener('click', e => { if (e.target === overlay) fecharModal(); });
    document.addEventListener('keydown', function _esc(e) {
        if (e.key === 'Escape') { fecharModal(); document.removeEventListener('keydown', _esc); }
    });

    // Contador
    const atualizarContador = () => {
        const n = overlay.querySelectorAll('.prigia-share-chk:checked').length;
        contador.textContent = `${n} de ${todasReservas.length} selecionadas`;
    };

    overlay.querySelector('#prigia-share-select-all').addEventListener('change', e => {
        overlay.querySelectorAll('.prigia-share-chk').forEach(chk => chk.checked = e.target.checked);
        atualizarContador();
    });

    overlay.querySelectorAll('.prigia-share-chk').forEach(chk => {
        chk.addEventListener('change', atualizarContador);
    });

    // Hover no botão Gerar
    btnGerar.addEventListener('mouseenter', () => {
        btnGerar.style.transform = 'translateY(-1px)';
        btnGerar.style.boxShadow = '0 6px 28px rgba(74,90,207,0.45)';
    });
    btnGerar.addEventListener('mouseleave', () => {
        btnGerar.style.transform = 'translateY(0)';
        btnGerar.style.boxShadow = '0 4px 20px rgba(74,90,207,0.3)';
    });
    btnGerar.addEventListener('mousedown', () => { btnGerar.style.transform = 'scale(0.98)'; });
    btnGerar.addEventListener('mouseup', () => { btnGerar.style.transform = 'translateY(-1px)'; });

    // Hover no botão Copiar
    btnCopiar.addEventListener('mouseenter', () => {
        btnCopiar.style.background = 'rgba(255,255,255,0.1)';
        btnCopiar.style.borderColor = 'rgba(255,255,255,0.15)';
    });
    btnCopiar.addEventListener('mouseleave', () => {
        btnCopiar.style.background = 'rgba(255,255,255,0.06)';
        btnCopiar.style.borderColor = 'rgba(255,255,255,0.08)';
    });

    // Referência ao canvas gerado para copiar
    let _canvasGerado = null;

    // Botão Gerar QR
    btnGerar.addEventListener('click', async () => {
        const indices = [];
        overlay.querySelectorAll('.prigia-share-chk:checked').forEach(chk => {
            indices.push(parseInt(chk.getAttribute('data-idx')));
        });

        if (indices.length === 0) {
            alert('Selecione pelo menos uma reserva!');
            return;
        }

        // Feedback de loading
        btnGerar.innerHTML = '<span style="display:flex;align-items:center;justify-content:center;gap:8px;"><span class="prigia-qr-spinner"></span>Gerando...</span>';
        btnGerar.style.pointerEvents = 'none';
        btnGerar.style.opacity = '0.7';

        const selecionadas = indices.map(i => todasReservas[i]).filter(Boolean);
        const texto = gerarTextoCompartilhamento(selecionadas);
        if (!texto) return;

        try {
            const canvas = await _gerarQrComLogo(texto, 256);
            _canvasGerado = canvas;

            // Mostra o QR
            const container = overlay.querySelector('#prigia-qr-container');
            const wrapper = overlay.querySelector('#prigia-qr-canvas-wrapper');
            wrapper.innerHTML = '';
            canvas.style.cssText = 'display:block; border-radius:8px;';
            wrapper.appendChild(canvas);

            const info = overlay.querySelector('#prigia-qr-info');
            info.textContent = `${selecionadas.length} reserva${selecionadas.length > 1 ? 's' : ''} codificada${selecionadas.length > 1 ? 's' : ''}`;

            container.style.display = 'flex';
            container.style.opacity = '0';
            container.style.transform = 'translateY(10px)';
            requestAnimationFrame(() => {
                container.style.opacity = '1';
                container.style.transform = 'translateY(0)';
            });

            // Mostra botão copiar, esconde gerar
            btnGerar.style.display = 'none';
            btnCopiar.style.display = 'block';
            btnCopiar.style.opacity = '0';
            requestAnimationFrame(() => { btnCopiar.style.opacity = '1'; });

        } catch (err) {
            console.error('Prigia QR: Erro ao gerar QR Code', err);
            alert('Erro ao gerar QR Code. Tente com menos reservas.');
            btnGerar.innerHTML = '<span style="display:flex;align-items:center;justify-content:center;gap:8px;">Gerar QR Code</span>';
            btnGerar.style.pointerEvents = '';
            btnGerar.style.opacity = '1';
        }
    });

    // Botão Copiar QR como Imagem
    btnCopiar.addEventListener('click', async () => {
        if (!_canvasGerado) return;

        try {
            const blob = await new Promise(resolve => _canvasGerado.toBlob(resolve, 'image/png'));
            const item = new ClipboardItem({ 'image/png': blob });
            await navigator.clipboard.write([item]);

            // Feedback de sucesso
            btnCopiar.innerHTML = `
                <span style="display:flex;align-items:center;justify-content:center;gap:8px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <span style="color:#4ade80;">QR Code copiado!</span>
                </span>
            `;
            btnCopiar.style.background = 'rgba(74,222,128,0.1)';
            btnCopiar.style.borderColor = 'rgba(74,222,128,0.2)';

            setTimeout(() => fecharModal(), 1500);

        } catch (err) {
            console.error('Prigia QR: Erro ao copiar', err);
            // Fallback: baixar como arquivo
            try {
                const blob = await new Promise(resolve => _canvasGerado.toBlob(resolve, 'image/png'));
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Prigia_Reservas_QR.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                btnCopiar.innerHTML = '<span style="display:flex;align-items:center;justify-content:center;gap:8px;color:#4ade80;">📥 QR baixado como imagem!</span>';
                setTimeout(() => fecharModal(), 2000);
            } catch (err2) {
                alert('Não foi possível copiar ou baixar o QR Code.');
            }
        }
    });

    // Injeta spinner CSS se não existir
    if (!document.getElementById('prigia-qr-spinner-style')) {
        const style = document.createElement('style');
        style.id = 'prigia-qr-spinner-style';
        style.textContent = `
            .prigia-qr-spinner {
                width: 14px; height: 14px;
                border: 2px solid rgba(255,255,255,0.2);
                border-top-color: #fff;
                border-radius: 50%;
                animation: prigia-spin 0.6s linear infinite;
            }
            @keyframes prigia-spin { to { transform: rotate(360deg); } }
        `;
        document.head.appendChild(style);
    }
}

function processarColagem(texto) {
    if (texto && texto.startsWith('PRIGIA_SHARE_V1:')) {
        try {
            const base64Str = texto.replace('PRIGIA_SHARE_V1:', '');
            const jsonStr = decodeURIComponent(escape(atob(base64Str)));
            const reservasCompartilhadas = JSON.parse(jsonStr);
            
            let reservas = JSON.parse(localStorage.getItem('prigia_reservas') || '[]');
            let teveAtualizacao = false;
            let qtdNovas = 0;
            
            reservasCompartilhadas.forEach(dado => {
                const jaExiste = reservas.some(r => 
                    r.localizador === dado.localizador && 
                    r.origem === dado.origem && 
                    r.destino === dado.destino &&
                    r.passageiro === dado.passageiro
                );
                
                if (!jaExiste) {
                    reservas.push({...dado, isShared: true});
                    teveAtualizacao = true;
                    qtdNovas++;
                }
            });

            if (teveAtualizacao) {
                localStorage.setItem('prigia_reservas', JSON.stringify(reservas));
                atualizarLista();
                alert(`✅ ${qtdNovas} reserva(s) compartilhada(s) adicionada(s) com sucesso!`);
            } else {
                alert('Todas as reservas desse QR Code já estavam na sua lista.');
            }
        } catch (e) {
            alert('Formato de reservas inválido ou corrompido.');
        }
    } else {
        alert('O conteúdo colado não contém um QR Code ou texto de reservas do Prigia válido.');
    }
}

btnCompartilhar.onclick = () => abrirModalCompartilhar();

btnColar.onclick = async () => {
    try {
        const clipboardItems = await navigator.clipboard.read();
        for (const item of clipboardItems) {
            const imageType = item.types.find(type => type.startsWith('image/'));
            if (imageType) {
                const blob = await item.getType(imageType);
                try {
                    const qrText = await _decodificarQrDeImagem(blob);
                    if (qrText) {
                        processarColagem(qrText);
                        return;
                    }
                } catch (err) {
                    console.log('Não foi possível ler QR Code da imagem do clipboard:', err);
                }
            }
        }
    } catch (e) {
        console.log('Acesso ao clipboard de imagem via API direta não disponível ou permissão negada, tentando texto...', e);
    }

    try {
        const texto = await navigator.clipboard.readText();
        if (texto) {
            processarColagem(texto);
            return;
        }
    } catch (e) {
        const texto = prompt('Cole aqui o código de compartilhamento (PRIGIA_SHARE_V1:...):');
        if (texto) {
            processarColagem(texto);
        }
    }
};

document.addEventListener('paste', async (e) => {
    if (painel.style.display !== 'none') {
        const items = e.clipboardData ? e.clipboardData.items : null;
        if (items) {
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const blob = items[i].getAsFile();
                    if (blob) {
                        e.preventDefault();
                        try {
                            const qrText = await _decodificarQrDeImagem(blob);
                            processarColagem(qrText);
                            return;
                        } catch (err) {
                            alert('Imagem colada, mas nenhum QR Code válido de reservas do Prigia foi encontrado.');
                            return;
                        }
                    }
                }
            }
        }
        
        const texto = (e.clipboardData || window.clipboardData).getData('text');
        if (texto && texto.startsWith('PRIGIA_SHARE_V1:')) {
            processarColagem(texto);
            e.preventDefault(); 
        }
    }
});

// Container onde a lista vai aparecer
const listaContainer = document.createElement('div');
listaContainer.style.cssText = `
    padding: 12px;
    overflow-y: auto;
    flex-grow: 1;
    background: #fafafa;
    display: flex;
    flex-direction: column;
    gap: 8px;
`;
painel.appendChild(listaContainer);

// Rodapé com o botão de limpar
const rodape = document.createElement('div');
rodape.style.cssText = `
    padding: 12px;
    border-top: 1px solid #eaeaea;
    display: flex;
    flex-direction: column;
    background: white;
    border-bottom-left-radius: 8px;
    border-bottom-right-radius: 8px;
`;

const btnLimpar = document.createElement('button');
btnLimpar.innerText = 'Limpar Lista';
btnLimpar.style.cssText = `
    background-color: #ffffff;
    color: #d93025;
    border: 1px solid #f0f0f0;
    padding: 8px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    font-size: 13px;
    width: 100%;
    transition: all 0.2s ease;
`;
btnLimpar.onmouseover = () => { btnLimpar.style.backgroundColor = '#fafafa'; };
btnLimpar.onmouseout = () => { btnLimpar.style.backgroundColor = '#ffffff'; };
rodape.appendChild(btnLimpar);
painel.appendChild(rodape);

// 2. O Vigia: Fica olhando a página para colocar o botão no lugar certo
setInterval(() => {
    const menuAreas = document.querySelector('.header-menu-areas');
    const botaoJaExiste = document.getElementById('btn-lista-reservas-prigia');
    
    if (menuAreas && !botaoJaExiste) {
        const btnFlutuante = document.createElement('button');
        btnFlutuante.id = 'btn-lista-reservas-prigia';
        btnFlutuante.innerText = 'Lista de Reservas';
        btnFlutuante.style.cssText = `
            background-color: #303f9f;
            color: #ffffff;
            border: 1px solid #303f9f;
            padding: 6px 14px;
            border-radius: 6px;
            font-weight: 500;
            font-size: 13px;
            cursor: pointer;
            box-shadow: 0 2px 6px rgba(48,63,159,0.25);
            font-family: 'Inter', -apple-system, sans-serif;
            transition: all 0.2s ease;
            margin-left: 15px;
            height: fit-content;
            align-self: center;
        `;

        btnFlutuante.onmouseover = () => btnFlutuante.style.backgroundColor = '#1d2660';
        btnFlutuante.onmouseout = () => btnFlutuante.style.backgroundColor = '#303f9f';

        menuAreas.appendChild(btnFlutuante);

        btnFlutuante.addEventListener('click', () => {
            if (painel.style.display === 'none') {
                const rect = btnFlutuante.getBoundingClientRect();
                painel.style.top = (rect.bottom + 10) + 'px';
                painel.style.left = 'auto';
                painel.style.right = (window.innerWidth - rect.right) + 'px';
                painel.style.display = 'flex';
                atualizarLista();
            } else {
                painel.style.display = 'none';
            }
        });
    }
}, 1000);

// 3. A Função de Extrair: Varre a tela inteirinha
function extrairDados() {
    try {
        const localizador = document.querySelector('.lbl-completed-sale-value')?.innerText.trim();
        if (!localizador) return []; 

        const valorTotal = document.querySelector('.lbl-payment-details-value.orange b')?.innerText.trim() || 'N/A';
        const segmentos = document.querySelectorAll('.coupon-service');
        const reservasEncontradas = [];

        segmentos.forEach(segmento => {
            const locais = segmento.querySelectorAll('.col-coupon-service-title b');
            const origem = locais[0] ? locais[0].innerText.trim() : 'N/A';
            const destino = locais[1] ? locais[1].innerText.trim() : 'N/A';
            
            const linhasPassageiros = segmento.querySelectorAll('.tbl-coupon-passengers tbody tr.tr-coupon-passenger-info');
            
            linhasPassageiros.forEach(linha => {
                const tdNome = linha.querySelector('.td-passenger-name') || linha.querySelectorAll('td')[1];
                let passageiro = 'N/A';
                
                if (tdNome) {
                    const spanPoltrona = tdNome.querySelector('.badge');
                    if (spanPoltrona) {
                        passageiro = tdNome.innerText.replace(spanPoltrona.innerText, '').trim();
                    } else {
                        passageiro = tdNome.innerText.trim();
                    }
                }

                reservasEncontradas.push({
                    localizador: localizador,
                    passageiro: passageiro,
                    origem: origem,
                    destino: destino,
                    valor: valorTotal
                });
            });
        });

        return reservasEncontradas;
    } catch (erro) {
        return [];
    }
}

// 4. Desenha a listinha e adiciona os cliques automáticos
function atualizarLista() {
    listaContainer.innerHTML = '';
    const reservas = JSON.parse(localStorage.getItem('prigia_reservas') || '[]');
    
    if(reservas.length === 0) {
        listaContainer.innerHTML = '<span style="color:#707070; font-size: 12px; text-align: center;">Nenhuma reserva guardada ainda.</span>';
        return;
    }

    const originais = reservas.filter(r => !r.isShared).reverse();
    const compartilhadas = reservas.filter(r => r.isShared).reverse();

    const renderizarReserva = (res, isShared) => {
        const item = document.createElement('div');
        item.style.cssText = `
            background: #ffffff;
            border: 1px solid #eaeaea;
            padding: 10px 12px;
            border-radius: 6px;
            font-size: 12px;
            color: #111;
            box-shadow: 0 2px 4px rgba(0,0,0,0.02);
            position: relative;
            cursor: pointer;
            transition: all 0.2s ease;
        `;
        const tagHtml = isShared ? `<span style="background: #f5f5f5; color: #666; border: 1px solid #eaeaea; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 500; position: absolute; top: 10px; right: 10px;">Compartilhada</span>` : '';
        item.innerHTML = `
            ${tagHtml}
            <div style="font-weight: 600; color: #111; margin-bottom: 2px;">${res.localizador}</div>
            <div style="color: #666; margin-bottom: 6px; font-size: 11px;">${res.passageiro}</div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #888; font-size: 11px;">${res.origem} <span style="margin: 0 2px;">→</span> ${res.destino}</span>
                <span style="color: #111; font-weight: 500; font-size: 12px;">${res.valor}</span>
            </div>
        `;
        
        item.onmouseover = () => { item.style.backgroundColor = '#fafafa'; item.style.borderColor = '#ddd'; };
        item.onmouseout = () => { item.style.backgroundColor = '#ffffff'; item.style.borderColor = '#eaeaea'; };

        item.onclick = () => {
            painel.style.display = 'none'; // Esconde a lista

            const linksMenu = Array.from(document.querySelectorAll('.header-menu-sub-menu a'));
            const linkPesquisa = linksMenu.find(a => a.innerText.trim() === 'Pesquisa de reservas');
            
            if (linkPesquisa) {
                linkPesquisa.click(); 
                
                // PASSO 1: Esperar a tela carregar, preencher e clicar no botão PESQUISAR
                let tentativasBusca = 0;
                const intervaloBusca = setInterval(() => {
                    tentativasBusca++;
                    
                    const labels = Array.from(document.querySelectorAll('label'));
                    const labelLocalizador = labels.find(l => l.innerText.trim() === 'Localizador' || l.innerText.includes('Localizador'));
                    
                    if (labelLocalizador) {
                        const inputLocalizador = labelLocalizador.parentElement.querySelector('input');
                        
                        if (inputLocalizador) {
                            inputLocalizador.focus();
                            inputLocalizador.value = res.localizador;
                            inputLocalizador.dispatchEvent(new Event('input', { bubbles: true }));
                            inputLocalizador.dispatchEvent(new Event('change', { bubbles: true }));
                            inputLocalizador.blur();
                            
                            clearInterval(intervaloBusca); 

                            // Clica no botão de pesquisar depois de meio segundo
                            setTimeout(() => {
                                const botoes = Array.from(document.querySelectorAll('button'));
                                const btnPesquisar = botoes.find(b => b.innerText.trim().toUpperCase() === 'PESQUISAR');
                                
                                if (btnPesquisar) {
                                    btnPesquisar.click();

                                    // PASSO 2: A MÁGICA NOVA! 
                                    // Espera o resultado aparecer na tabela lá embaixo e clica nele
                                    let tentativasResultado = 0;
                                    const intervaloResultado = setInterval(() => {
                                        tentativasResultado++;
                                        
                                        // Busca todas as células (td) da tela
                                        const celulasTabela = Array.from(document.querySelectorAll('td'));
                                        
                                        // Encontra a célula que tem o texto do nosso localizador
                                        const celulaAlvo = celulasTabela.find(td => td.innerText.trim() === res.localizador);
                                        
                                        if (celulaAlvo) {
                                            // Pega a linha inteira (tr) onde esse localizador tá e clica nela!
                                            const linhaTabela = celulaAlvo.closest('tr');
                                            if (linhaTabela) {
                                                linhaTabela.click();
                                            } else {
                                                celulaAlvo.click(); // Segurança caso não ache o 'tr'
                                            }
                                            
                                            // Encontrou e clicou, pode parar de procurar!
                                            clearInterval(intervaloResultado);
                                        }

                                        // Desiste depois de uns 10 segundos pra não travar tudo
                                        if (tentativasResultado > 20) {
                                            clearInterval(intervaloResultado);
                                        }

                                    }, 500); // Checa a tabela a cada meio segundo
                                }
                            }, 500);
                        }
                    }
                    
                    if (tentativasBusca > 10) {
                        clearInterval(intervaloBusca);
                    }
                }, 500); 
            } else {
                alert("Opa! Não consegui encontrar a opção 'Pesquisa de reservas' no menu.");
            }
        };

        listaContainer.appendChild(item);
    };

    if (originais.length > 0) {
        const tituloOriginais = document.createElement('div');
        tituloOriginais.style.cssText = 'font-size: 11px; font-weight: 600; color: #888; margin-top: 4px; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.5px;';
        tituloOriginais.innerText = 'Suas Reservas';
        listaContainer.appendChild(tituloOriginais);
        originais.forEach(res => renderizarReserva(res, false));
    }

    if (compartilhadas.length > 0) {
        const tituloComp = document.createElement('div');
        tituloComp.style.cssText = 'font-size: 11px; font-weight: 600; color: #888; margin-top: 12px; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.5px; border-top: 1px solid #eaeaea; padding-top: 12px;';
        tituloComp.innerText = 'Reservas Compartilhadas';
        listaContainer.appendChild(tituloComp);
        compartilhadas.forEach(res => renderizarReserva(res, true));
    }
}

// 5. O guardião que salva os dados automaticamente
function salvarAutomaticamente() {
    const dadosNovos = extrairDados();
    
    if (dadosNovos.length > 0) {
        let reservas = JSON.parse(localStorage.getItem('prigia_reservas') || '[]');
        let teveAtualizacao = false;
        
        dadosNovos.forEach(dado => {
            const jaExiste = reservas.some(r => 
                r.localizador === dado.localizador && 
                r.origem === dado.origem && 
                r.destino === dado.destino &&
                r.passageiro === dado.passageiro
            );
            
            if (!jaExiste) {
                reservas.push(dado);
                teveAtualizacao = true;
            }
        });

        if (teveAtualizacao) {
            localStorage.setItem('prigia_reservas', JSON.stringify(reservas));
            atualizarLista();
        }
    }
}

setInterval(salvarAutomaticamente, 2000);

btnLimpar.onclick = () => {
    if(confirm("Tem certeza que deseja limpar todinha a sua lista de reservas?")) {
        localStorage.removeItem('prigia_reservas');
        atualizarLista();
    }
};

painel.style.display = 'none';

// === CORREÇÃO DE SCROLL: reposiciona o painel quando a página rola ===
function reposicionarPainel() {
    if (painel.style.display === 'none') return;
    const btnRef = document.getElementById('btn-lista-reservas-prigia');
    if (!btnRef) return;
    const rect = btnRef.getBoundingClientRect();
    painel.style.top = (rect.bottom + 10) + 'px';
    painel.style.right = (window.innerWidth - rect.right) + 'px';
}
window.addEventListener('scroll', reposicionarPainel, { passive: true });
window.addEventListener('resize', reposicionarPainel, { passive: true });