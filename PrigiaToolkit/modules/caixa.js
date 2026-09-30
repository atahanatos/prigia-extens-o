// =================================================================
// PRIGIA CAIXA FINAL — Fechamento de Caixa na Extensão
// Baseado no CashApp do Prigia Premium v2
// =================================================================

(function() {
    'use strict';

    const CAIXA_STORAGE_KEY = 'prigia_caixa_tickets';
    const CAIXA_CONFIG_KEY  = 'prigia_caixa_config';

    // Configuração padrão (mesma do app desktop)
    const CONFIG = {
        taxaEmbarque: 3.90,
        origemTaxa: 'BACABAL',
        taxaHoraInicio: 6,
        taxaHoraFim: 24
    };

    // ===== STORAGE =====

    function carregarTickets() {
        try {
            const raw = localStorage.getItem(CAIXA_STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.error('Prigia Caixa: erro ao carregar tickets', e);
            return [];
        }
    }

    function salvarTickets(tickets) {
        localStorage.setItem(CAIXA_STORAGE_KEY, JSON.stringify(tickets));
    }

    // ===== LÓGICA DE TAXA =====

    function deveAplicarTaxa(origin, time, discountType) {
        if (discountType) return false;
        if (origin && origin.toUpperCase().includes(CONFIG.origemTaxa)) {
            if (!time) return true;
            const hour = parseInt(time.split(':')[0], 10);
            return hour >= CONFIG.taxaHoraInicio && hour < CONFIG.taxaHoraFim;
        }
        return false;
    }

    // ===== PARSE DE PAGAMENTO (simplificado do app desktop) =====

    function extrairPagamento(fullText) {
        const payments = [];

        // Limita ao texto antes de "VIA DO PASSAGEIRO" para evitar duplicatas
        let processText = fullText;
        const marcadores = ['VIA DO PASSAGEIRO', 'VIA DO CLIENTE', 'VIA DO USUARIO', '---------------'];
        let indiceCorte = -1;
        for (const m of marcadores) {
            const idx = fullText.toUpperCase().indexOf(m);
            if (idx > 500) { indiceCorte = idx; break; }
        }
        if (indiceCorte > 0) processText = fullText.substring(0, indiceCorte);

        const regexPagamento = /Forma\s+de\s+pagamento\s+([\s\S]+?)\s+Valor\s+pago\s+R\$\s*([\d.,]+)/gi;
        let match;

        while ((match = regexPagamento.exec(processText)) !== null) {
            let tipoBruto = match[1].trim().toUpperCase();
            const valorStr = match[2];
            const valor = parseCurrency(valorStr);
            let tipo = 'pix';

            if      (tipoBruto.includes('CREDITO') && !tipoBruto.includes('UTILIZACAO')) tipo = 'cartao_credito';
            else if (tipoBruto.includes('DEBITO'))                                        tipo = 'cartao_debito';
            else if (tipoBruto.includes('MERCADO') || tipoBruto.includes('PAGO'))         tipo = 'mercado_pago';
            else if (tipoBruto.includes('PIX') || tipoBruto.includes('DINHEIRO'))         tipo = 'pix';
            else if (tipoBruto.includes('TROCA') || tipoBruto.includes('UTILIZACAO'))     tipo = 'troca';

            if (tipo !== 'troca') {
                payments.push({ type: tipo, value: valor });
            }
        }

        // Dedupe
        const vistos = new Set();
        return payments.filter(p => {
            const chave = `${p.type}-${p.value.toFixed(2)}`;
            if (vistos.has(chave)) return false;
            vistos.add(chave);
            return true;
        });
    }

    function parseCurrency(str) {
        if (!str) return 0;
        if (typeof str === 'number') return str;
        const cleaned = str.toString().replace(/[R$\s]/g, '').replace('.', '').replace(',', '.');
        const value = parseFloat(cleaned);
        return isNaN(value) ? 0 : value;
    }

    // ===== ADICIONAR TICKET AO CAIXA =====

    function caixaAddTicket(dadosPdf, fullText) {
        const tickets = carregarTickets();

        // Extrai pagamentos do texto completo do PDF
        let payments = [];
        if (fullText) {
            payments = extrairPagamento(fullText);
        }

        // Fallback: usa o valor extraído do parseTicketData
        if (payments.length === 0 && dadosPdf.value) {
            payments = [{ type: 'pix', value: typeof dadosPdf.value === 'number' ? dadosPdf.value : parseCurrency(dadosPdf.value) }];
        }

        // Calcula valor total dos pagamentos
        const valorTotal = payments.reduce((sum, p) => sum + p.value, 0);

        // Se valor é zero, provavelmente é isenção — não acumula no caixa
        if (valorTotal <= 0 && payments.length === 0) return;

        const taxaEmbarque = deveAplicarTaxa(dadosPdf.origin, dadosPdf.time, dadosPdf.discountType);

        const ticket = {
            id: Date.now() + Math.random(),
            name: dadosPdf.name || 'Passageiro',
            payments: payments,
            origin: dadosPdf.origin || '',
            destination: dadosPdf.destination || '',
            date: dadosPdf.date || new Date().toLocaleDateString('pt-BR'),
            time: dadosPdf.time || '',
            taxaEmbarque: taxaEmbarque,
            timestamp: Date.now()
        };

        // Evita duplicata (mesmo nome + mesma data + mesmo valor em janela de 5s)
        const agora = Date.now();
        const duplicata = tickets.some(t =>
            t.name === ticket.name &&
            t.date === ticket.date &&
            Math.abs(t.timestamp - agora) < 5000 &&
            Math.abs(t.payments.reduce((s, p) => s + p.value, 0) - valorTotal) < 0.01
        );

        if (duplicata) {
            console.log('Prigia Caixa: ticket duplicado ignorado');
            return;
        }

        tickets.push(ticket);
        salvarTickets(tickets);
        atualizarBadge();
        console.log(`Prigia Caixa: ticket adicionado — ${ticket.name} R$ ${valorTotal.toFixed(2)}`);
    }

    // ===== CÁLCULO DE RESUMO =====

    function calcularResumo() {
        const tickets = carregarTickets();
        let totalPix = 0, totalDinheiro = 0, totalCartoes = 0, totalMercadoPago = 0, totalTaxas = 0;

        tickets.forEach(t => {
            (t.payments || []).forEach(p => {
                if      (p.type === 'pix')            totalPix      += p.value;
                else if (p.type === 'dinheiro')       totalDinheiro += p.value;
                else if (p.type === 'mercado_pago')   totalMercadoPago += p.value;
                else if (p.type === 'cartao_debito')  totalCartoes  += p.value;
                else if (p.type === 'cartao_credito') totalCartoes  += p.value;
            });
            if (t.taxaEmbarque) totalTaxas += CONFIG.taxaEmbarque;
        });

        const totalGeral = totalPix + totalDinheiro + totalCartoes + totalMercadoPago + totalTaxas;

        return {
            tickets: tickets.length,
            totalPix,
            totalDinheiro,
            totalCartoes,
            totalMercadoPago,
            totalTaxas,
            totalGeral
        };
    }

    // ===== FORMATAÇÃO =====

    function fmt(val) {
        return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    // ===== GERAÇÃO DE RELATÓRIO =====

    function gerarRelatorio() {
        const tickets = carregarTickets();
        const resumo  = calcularResumo();

        const date = new Date().toLocaleString('pt-BR', {
            weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });

        let report = `╔════════════════════════════════════╗\n`;
        report    += `║     FECHAMENTO DE CAIXA            ║\n`;
        report    += `╠════════════════════════════════════╣\n`;
        report    += `║ DATA: ${date.padEnd(29)}║\n`;
        report    += `╚════════════════════════════════════╝\n\n`;

        report += `📋 PASSAGENS (${tickets.length})\n────────────────────────────────────────\n`;

        tickets.forEach((ticket, index) => {
            let ticketTotal = (ticket.payments || []).reduce((sum, p) => sum + p.value, 0);
            if (ticket.taxaEmbarque) ticketTotal += CONFIG.taxaEmbarque;

            const pgtoStr = (ticket.payments || []).map(p => {
                const icon = { pix: '📱', dinheiro: '💵', mercado_pago: '💰', cartao_debito: '💳D', cartao_credito: '💳C' }[p.type] || '';
                return `${icon}${fmt(p.value)}`;
            }).join(' + ');

            const idxStr  = (index + 1).toString().padStart(2, '0');
            const nameStr = (ticket.name || 'Passageiro').substring(0, 20).padEnd(20);
            const valStr  = fmt(ticketTotal).padStart(10);

            report += `${idxStr}. ${nameStr}   ${valStr}\n    Pgto: ${pgtoStr}\n`;
            if (ticket.origin && ticket.destination) report += `    🚌 ${ticket.origin} → ${ticket.destination}\n`;
            report += '\n';
        });

        report += `────────────────────────────────────────\n\n💰 RESUMO OPERACIONAL\n────────────────────────────────────────\n`;
        report += `📱 PIX:                ${fmt(resumo.totalPix).padStart(15)}\n`;
        if (resumo.totalMercadoPago > 0) report += `💰 Mercado Pago:       ${fmt(resumo.totalMercadoPago).padStart(15)}\n`;
        if (resumo.totalCartoes > 0) report += `💳 Cartões:            ${fmt(resumo.totalCartoes).padStart(15)}\n`;
        if (resumo.totalTaxas > 0) report += `🎫 Taxas:              ${fmt(resumo.totalTaxas).padStart(15)}\n`;

        report += `\n════════════════════════════════════════\n`;
        report += `   TOTAL FINAL:        ${fmt(resumo.totalPix).padStart(15)}\n`;
        report += `════════════════════════════════════════\n`;

        return report;
    }

    // ===== IMPRESSÃO TÉRMICA =====

    function imprimirCaixa() {
        const tickets = carregarTickets();
        const resumo  = calcularResumo();

        if (tickets.length === 0) {
            alert('Nenhuma passagem no caixa para imprimir.');
            return;
        }

        const dataHora = new Date().toLocaleString('pt-BR', {
            weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });

        // Nome do operador (pega do campo de pasta de download)
        const inputPastaEl = document.getElementById('sb-folder-name');
        const nomeOperador = inputPastaEl ? inputPastaEl.value.trim() : '';

        // Linhas de passagens
        let linhasHTML = '';
        tickets.forEach((t, idx) => {
            let ticketTotal = (t.payments || []).reduce((sum, p) => sum + p.value, 0);
            if (t.taxaEmbarque) ticketTotal += CONFIG.taxaEmbarque;

            const pgtoIcons = (t.payments || []).map(p => {
                const labels = { pix: 'PIX', dinheiro: 'DIN', mercado_pago: 'MP', cartao_debito: 'DEB', cartao_credito: 'CRD' };
                return labels[p.type] || p.type;
            }).join('+');

            const rota = (t.origin && t.destination) ? `${t.origin} → ${t.destination}` : '';
            const bgRow = idx % 2 === 1 ? 'background:#f9f9f9;' : '';

            linhasHTML += `
                <tr style="${bgRow}">
                    <td style="padding:4px 2px; font-size:12px; font-weight:bold;">
                        ${(idx + 1).toString().padStart(2, '0')}
                    </td>
                    <td style="padding:4px 2px; font-size:11px;">
                        ${(t.name || 'Passageiro').substring(0, 18)}
                        ${rota ? `<br><small style="color:#666;">${rota}</small>` : ''}
                    </td>
                    <td style="padding:4px 2px; font-size:11px; text-align:center; color:#888;">
                        ${pgtoIcons}
                    </td>
                    <td style="padding:4px 2px; font-size:12px; text-align:right; font-weight:bold;">
                        ${fmt(ticketTotal)}
                    </td>
                </tr>
            `;
        });

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Fechamento de Caixa</title>
    <style>
        @page {
            size: 80mm auto;
            margin: 2mm;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Courier New', monospace;
            font-size: 13px;
            font-weight: bold;
            width: 76mm;
            color: #000;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .header {
            text-align: center;
            padding: 6px 0 8px;
            border-bottom: 2px dashed #000;
            margin-bottom: 6px;
        }
        .header h1 {
            font-size: 18px;
            margin: 0 0 4px;
            font-weight: bold;
        }
        .header .data {
            font-size: 11px;
            font-weight: bold;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        thead th {
            font-size: 10px;
            font-weight: bold;
            text-transform: uppercase;
            border-bottom: 2px solid #000;
            padding: 3px 2px;
            text-align: left;
        }
        thead th:last-child { text-align: right; }
        thead th:nth-child(3) { text-align: center; }
        tbody tr {
            border-bottom: 1px dotted #aaa;
        }
        tbody tr:last-child {
            border-bottom: 2px dashed #000;
        }
        .resumo {
            padding: 8px 0;
            font-size: 12px;
            font-weight: bold;
        }
        .resumo-item {
            display: flex;
            justify-content: space-between;
            padding: 2px 0;
        }
        .total-final {
            border-top: 2px solid #000;
            border-bottom: 2px solid #000;
            padding: 6px 0;
            margin-top: 4px;
            font-size: 16px;
            font-weight: bold;
            text-align: center;
        }
        .footer {
            text-align: center;
            padding: 8px 0 4px;
            font-size: 10px;
            font-weight: bold;
            color: #555;
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
        <h1>🧾 FECHAMENTO DE CAIXA</h1>
        ${nomeOperador ? `<div style="font-size:14px; font-weight:bold; margin:4px 0;">${nomeOperador}</div>` : ''}
        <div class="data">${dataHora}</div>
    </div>

    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>Passageiro</th>
                <th>Pgto</th>
                <th>Valor</th>
            </tr>
        </thead>
        <tbody>
            ${linhasHTML}
        </tbody>
    </table>

    <div class="resumo">
        <div style="text-align:center; margin-bottom:4px; font-size:13px;">💰 RESUMO</div>
        ${resumo.totalPix > 0 ? `<div class="resumo-item"><span>📱 PIX</span><span>${fmt(resumo.totalPix)}</span></div>` : ''}
        ${resumo.totalMercadoPago > 0 ? `<div class="resumo-item"><span>💰 Mercado Pago</span><span>${fmt(resumo.totalMercadoPago)}</span></div>` : ''}
        ${resumo.totalCartoes > 0 ? `<div class="resumo-item"><span>💳 Cartões</span><span>${fmt(resumo.totalCartoes)}</span></div>` : ''}
        ${resumo.totalTaxas > 0 ? `<div class="resumo-item"><span>🎫 Taxas Embarque</span><span>${fmt(resumo.totalTaxas)}</span></div>` : ''}
    </div>

    <div class="total-final">
        TOTAL: ${fmt(resumo.totalPix)}
    </div>

    <div class="footer">
        ${tickets.length} passagem(ns) &middot; Prigia Caixa de Ferramentas
    </div>

    <script>
        window.onload = function() { window.print(); };
    <\/script>
</body>
</html>`;

        const printWin = window.open('', '_blank', 'width=350,height=700');
        if (printWin) {
            printWin.document.write(html);
            printWin.document.close();
        } else {
            alert('Não foi possível abrir a janela de impressão. Verifique se popups estão permitidos.');
        }
    }

    // ===== BADGE =====

    function atualizarBadge() {
        const badge = document.getElementById('sb-caixa-badge');
        if (!badge) return;
        const tickets = carregarTickets();
        const count = tickets.length;
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    }

    // ===== MODAL DE CAIXA =====

    function abrirModalCaixa() {
        // Remove modal anterior se existir
        const existente = document.getElementById('sb-caixa-overlay');
        if (existente) existente.remove();

        const tickets = carregarTickets();
        const resumo  = calcularResumo();

        const overlay = document.createElement('div');
        overlay.id = 'sb-caixa-overlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(10, 10, 30, 0.55); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
            z-index: 999999; display: flex; justify-content: center; align-items: center;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        `;

        const modal = document.createElement('div');
        modal.className = 'sb-caixa-modal';
        modal.style.cssText = `
            background: white; border-radius: 16px; max-width: 400px; width: 92%;
            max-height: 80vh; display: flex; flex-direction: column;
            box-shadow: 0 12px 48px rgba(10, 10, 30, 0.18); overflow: hidden;
            animation: sb-modal-in 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        `;

        // Header
        const header = document.createElement('div');
        header.style.cssText = `
            padding: 14px 18px; background: linear-gradient(135deg, #303f9f, #1d2660);
            color: white; display: flex; justify-content: space-between; align-items: center;
            flex-shrink: 0;
        `;
        header.innerHTML = `
            <span style="font-weight:bold; font-size:15px;">🧾 Caixa Final</span>
            <span id="sb-caixa-fechar" style="cursor:pointer; font-size:20px; font-weight:bold; padding:0 6px; line-height:1;">✕</span>
        `;

        // Conteúdo
        const conteudo = document.createElement('div');
        conteudo.style.cssText = 'padding: 16px 18px; flex: 1; overflow-y: auto;';

        if (tickets.length === 0) {
            conteudo.innerHTML = `
                <div style="text-align:center; padding:30px 0; color:#888;">
                    <div style="font-size:32px; margin-bottom:8px;">📭</div>
                    <div style="font-size:13px;">Nenhuma passagem no caixa ainda.</div>
                    <div style="font-size:11px; color:#aaa; margin-top:4px;">As passagens são adicionadas automaticamente ao baixar PDFs.</div>
                </div>
            `;
        } else {
            let resumoHTML = `
                <div style="background:#f8f8fc; border-radius:10px; padding:16px; margin-bottom:14px; border:1px solid #ebebf0;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <span style="font-size:13px; font-weight:600; color:#333;">📋 ${resumo.tickets} passagem(ns)</span>
                    </div>
            `;

            if (resumo.totalPix > 0)         resumoHTML += `<div style="display:flex; justify-content:space-between; font-size:12px; padding:3px 0; color:#555;"><span>📱 PIX</span><span style="font-weight:600; color:#111;">${fmt(resumo.totalPix)}</span></div>`;
            if (resumo.totalMercadoPago > 0)  resumoHTML += `<div style="display:flex; justify-content:space-between; font-size:12px; padding:3px 0; color:#555;"><span>💰 Mercado Pago</span><span style="font-weight:600; color:#111;">${fmt(resumo.totalMercadoPago)}</span></div>`;
            if (resumo.totalCartoes > 0)      resumoHTML += `<div style="display:flex; justify-content:space-between; font-size:12px; padding:3px 0; color:#555;"><span>💳 Cartões</span><span style="font-weight:600; color:#111;">${fmt(resumo.totalCartoes)}</span></div>`;
            if (resumo.totalTaxas > 0)        resumoHTML += `<div style="display:flex; justify-content:space-between; font-size:12px; padding:3px 0; color:#555;"><span>🎫 Taxas</span><span style="font-weight:600; color:#111;">${fmt(resumo.totalTaxas)}</span></div>`;

            resumoHTML += `
                    <div style="border-top:1px solid #e0e0e0; margin-top:8px; padding-top:8px; display:flex; justify-content:space-between; font-size:14px; font-weight:700; color:#303f9f;">
                        <span>TOTAL</span>
                        <span>${fmt(resumo.totalPix)}</span>
                    </div>
                </div>
            `;

            // Lista de tickets (compacta)
            resumoHTML += `<div style="max-height:200px; overflow-y:auto; border:1px solid #ebebf0; border-radius:10px;">`;
            tickets.forEach((t, i) => {
                let ticketTotal = (t.payments || []).reduce((sum, p) => sum + p.value, 0);
                if (t.taxaEmbarque) ticketTotal += CONFIG.taxaEmbarque;
                const bgColor = i % 2 === 0 ? '#fff' : '#f8f8fc';
                resumoHTML += `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:${bgColor}; font-size:12px; border-bottom:1px solid #f0f0f5;">
                        <div style="flex:1;">
                            <div style="font-weight:600; color:#111;">${(t.name || 'Passageiro').substring(0, 22)}</div>
                            ${t.origin && t.destination ? `<div style="font-size:10px; color:#888;">${t.origin} → ${t.destination}</div>` : ''}
                        </div>
                        <div style="font-weight:600; color:#303f9f; font-size:12px; white-space:nowrap;">${fmt(ticketTotal)}</div>
                    </div>
                `;
            });
            resumoHTML += '</div>';

            conteudo.innerHTML = resumoHTML;
        }

        // Botões de ação
        const acoes = document.createElement('div');
        acoes.style.cssText = 'padding: 14px 18px; border-top: 1px solid #ebebf0; display: flex; gap: 10px; flex-shrink: 0;';

        if (tickets.length > 0) {
            acoes.innerHTML = `
                <button id="sb-caixa-btn-imprimir" style="flex:2; padding:12px; background:linear-gradient(135deg, #303f9f, #283593); color:white; border:none; border-radius:10px; font-weight:700; font-size:13px; letter-spacing:0.02em; cursor:pointer; transition:all 0.2s ease; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; box-shadow:0 2px 8px rgba(48,63,159,0.25);">
                    🖨️ Imprimir Caixa
                </button>
                <button id="sb-caixa-btn-limpar" style="flex:1; padding:12px; background:transparent; color:#d93025; border:1.5px solid #f0f0f5; border-radius:10px; font-weight:600; font-size:12px; cursor:pointer; transition:all 0.2s ease; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                    🗑️ Limpar
                </button>
            `;
        }

        // Monta modal
        modal.appendChild(header);
        modal.appendChild(conteudo);
        modal.appendChild(acoes);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Eventos
        overlay.querySelector('#sb-caixa-fechar').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
        document.addEventListener('keydown', function _escHandler(e) {
            if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', _escHandler); }
        });

        const btnImprimir = overlay.querySelector('#sb-caixa-btn-imprimir');
        if (btnImprimir) {
            btnImprimir.addEventListener('click', () => {
                imprimirCaixa();
                overlay.remove();
            });
            btnImprimir.addEventListener('mouseenter', () => { btnImprimir.style.background = 'linear-gradient(135deg, #283593, #1d2660)'; btnImprimir.style.transform = 'translateY(-1px)'; btnImprimir.style.boxShadow = '0 4px 16px rgba(48,63,159,0.35)'; });
            btnImprimir.addEventListener('mouseleave', () => { btnImprimir.style.background = 'linear-gradient(135deg, #303f9f, #283593)'; btnImprimir.style.transform = ''; btnImprimir.style.boxShadow = '0 2px 8px rgba(48,63,159,0.25)'; });
        }

        const btnLimpar = overlay.querySelector('#sb-caixa-btn-limpar');
        if (btnLimpar) {
            btnLimpar.addEventListener('click', () => {
                if (confirm(`Tem certeza que deseja limpar o caixa? (${tickets.length} passagem(ns) serão removidas)`)) {
                    salvarTickets([]);
                    atualizarBadge();
                    overlay.remove();
                }
            });
        }
    }

    // ===== EXPOR PARA O download.js =====

    // O download.js chama essa função global ao processar cada PDF
    window._prigiaCaixaAddTicket = caixaAddTicket;
    window._prigiaCaixaAbrirModal = abrirModalCaixa;
    window._prigiaCaixaAtualizarBadge = atualizarBadge;

    // Atualiza badge na inicialização (caso haja tickets da sessão anterior)
    // Roda com delay para esperar o painel do download.js ser criado
    const _badgeInterval = setInterval(() => {
        const badge = document.getElementById('sb-caixa-badge');
        if (badge) {
            atualizarBadge();
            clearInterval(_badgeInterval);
        }
    }, 500);

    // Limpa o interval depois de 30s como segurança
    setTimeout(() => clearInterval(_badgeInterval), 30000);

})();
