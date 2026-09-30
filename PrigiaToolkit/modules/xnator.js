(function() {
// Substitui fisicamente o número da poltrona pela letra "X" no HTML
function trocarNumerosPorX() {
    const poltronasVendidas = document.querySelectorAll(
        '.default-seat.item-confirmed .seat-number, ' +
        '.default-seat.item-sold .seat-number, ' +
        '.default-seat.item-reserved .seat-number, ' +
        '.default-seat.item-unavailable .seat-number, ' +
        '.default-seat.item-occupied .seat-number, ' +
        '.default-seat.item-locked .seat-number'
    );
    poltronasVendidas.forEach(p => {
        if (p.innerText !== "X") {
            p.innerText = "X";
        }
    });
}

// Função principal que adiciona os horários e o botão de Print
function adicionarHorariosNoMapa() {
    try { 
        const cardsAbertos = document.querySelectorAll('.sales-service-card.opened');

        cardsAbertos.forEach(card => {
            if (card.querySelector('.barra-horarios-customizada')) return;

            // --- EXTRAÇÃO SEGURA DE HORÁRIOS ---
            // Mesmo que seja uma viagem de conexão e os dados venham diferentes, ele não quebra
            const tagHorarios = Array.from(card.querySelectorAll('.service-col-3 b'))
                                     .map(b => b.innerText.trim())
                                     .filter(texto => texto.length > 0);
            
            let horarioSaida = tagHorarios.length > 0 ? tagHorarios[0] : "--:--";
            let horarioChegada = tagHorarios.length > 1 ? tagHorarios[tagHorarios.length - 1] : "--:--";

            const areaRotas = card.querySelector('.seat-map-route');
            if (!areaRotas) return;

            const barraHorarios = document.createElement('div');
            barraHorarios.className = 'barra-horarios-customizada';
            
            // Layout com "white-space: nowrap" para o texto nunca quebrar pra linha de baixo
            barraHorarios.innerHTML = `
                <div style="position: relative; text-align: center; padding: 12px; margin-top: 20px; margin-bottom: 10px; background: #ffffff; border: 1px solid #eaeaea; border-radius: 8px; width: 100%; box-sizing: border-box; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                    
                    <div style="display: flex; justify-content: center; align-items: center; gap: 15px; font-size: 14px; color: #666; font-weight: 500; width: 100%; white-space: nowrap; font-family: 'Inter', -apple-system, sans-serif;">
                        <span>SAÍDA: <span style="color: #111; font-weight: 600;">${horarioSaida}</span></span>
                        <span style="color: #ddd; font-size: 15px;">|</span>
                        <span>CHEGADA: <span style="color: #111; font-weight: 600;">${horarioChegada}</span></span>
                    </div>

                    <button class="btn-copiar-print" style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background-color: #303f9f; color: #ffffff; border: 1px solid #303f9f; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 12px; font-family: 'Inter', -apple-system, sans-serif; transition: all 0.2s ease;">
                        Copiar Print
                    </button>
                </div>
            `;

            const legenda = areaRotas.querySelector('.seat-map-toggle-legend');
            if (legenda) {
                areaRotas.insertBefore(barraHorarios, legenda);
            } else {
                areaRotas.appendChild(barraHorarios);
            }

            const btnPrint = barraHorarios.querySelector('.btn-copiar-print');
            
            btnPrint.addEventListener('click', function(e) {
                e.preventDefault();
                
                const textoOriginal = btnPrint.innerHTML;
                btnPrint.innerHTML = "Copiando...";
                btnPrint.style.backgroundColor = "#1d2660";
                btnPrint.style.borderColor = "#1d2660";

                const elementoParaFoto = card.querySelector('.service-seat-map');
                if (!elementoParaFoto) return;

                // --- EXTRAI ORIGEM E DESTINO DO CARD ---
                let origemPrint = '';
                let destinoPrint = '';
                try {
                    // Tenta extrair da coluna de rota do card
                    const routeColEl = card.querySelector('.service-col-2 b');
                    if (routeColEl) {
                        const parts = routeColEl.innerHTML.split(/<br\s*\/?>/i);
                        if (parts.length >= 2) {
                            origemPrint = parts[0].replace(/<[^>]*>/g, '').trim();
                            destinoPrint = parts[1].replace(/<[^>]*>/g, '').trim();
                        } else {
                            origemPrint = routeColEl.textContent.trim();
                        }
                    }
                    // Fallback: header global de pesquisa
                    if (!origemPrint) {
                        const headerInfoEl = document.querySelector('.div-search-local-date');
                        if (headerInfoEl) {
                            const bTags = headerInfoEl.querySelectorAll('b');
                            if (bTags.length >= 2) {
                                origemPrint = bTags[0].textContent.replace(/^[A-Z]{3}\s*-\s*/, '').trim();
                                destinoPrint = bTags[1].textContent.replace(/^[A-Z]{3}\s*-\s*/, '').trim();
                            }
                        }
                    }
                    // Fallback 2: campos de pesquisa do SmartBus
                    if (!origemPrint) {
                        const spnItems = document.querySelectorAll('.spn-item');
                        if (spnItems.length >= 2) {
                            origemPrint = spnItems[0].textContent.trim();
                            destinoPrint = spnItems[1].textContent.trim();
                        }
                    }
                } catch(e) { /* ignora erros de extracção */ }

                const geradorDeImagem = new Promise(async (resolve, reject) => {
                    try {
                        btnPrint.style.visibility = "hidden";

                        // --- 1. PREPARAÇÃO DOS ÍCONES ---
                        const icones = elementoParaFoto.querySelectorAll('i');
                        icones.forEach(i => {
                            i.setAttribute('data-print-display', i.style.display || '');
                            i.style.display = 'none'; 
                            
                            if (i.classList.contains('fa-arrow-right')) {
                                const span = document.createElement('span');
                                span.className = 'temp-print-icon';
                                span.innerHTML = ' ➔ ';
                                i.parentNode.insertBefore(span, i);
                            } else if (i.classList.contains('fa-plus')) {
                                const span = document.createElement('span');
                                span.className = 'temp-print-icon';
                                span.innerHTML = ' +';
                                i.parentNode.insertBefore(span, i);
                            }
                        });

                        // --- 2. MÁGICA: ESCONDER ELEMENTOS QUE BUGAM A FOTO ---
                        
                        // A) Esconder "Exibir legenda"
                        const linkLegenda = elementoParaFoto.querySelector('.seat-map-toggle-legend');
                        let legendaDisplayOriginal = '';
                        if (linkLegenda) {
                            legendaDisplayOriginal = linkLegenda.style.display || '';
                            linkLegenda.style.display = 'none';
                        }

                        // B) Esconder as abas de conexão (BBA -> THE) lá embaixo para não bagunçar
                        const routeList = elementoParaFoto.querySelector('.seat-map-route-list');
                        let routeListDisplayOriginal = '';
                        if (routeList) {
                            routeListDisplayOriginal = routeList.style.display || '';
                            routeList.style.display = 'none';
                        }

                        // C) Esconder o alerta laranja flutuante ("Somente X poltronas")
                        const allTextNodes = Array.from(elementoParaFoto.querySelectorAll('*')).filter(el => el.children.length === 0 && el.textContent.trim().length > 0);
                        let warningElementToHide = null;

                        for (let el of allTextNodes) {
                            const txt = el.textContent.toLowerCase();
                            if (txt.includes('poltrona dispon') || txt.includes('somente mais') || txt.includes('restam')) {
                                let p = el;
                                while(p && p !== elementoParaFoto) {
                                    const pos = window.getComputedStyle(p).position;
                                    if (pos === 'absolute' || pos === 'fixed') {
                                        warningElementToHide = p;
                                        break;
                                    }
                                    p = p.parentElement;
                                }
                                if (!warningElementToHide) warningElementToHide = el; 
                                break;
                            }
                        }

                        if (warningElementToHide) {
                            warningElementToHide.setAttribute('data-print-display', warningElementToHide.style.display || '');
                            warningElementToHide.style.display = 'none';
                        }

                        // D) Esconder a barra de horários customizada (evita aparecer torta na foto)
                        const barraHorariosEl = elementoParaFoto.querySelector('.barra-horarios-customizada');
                        let barraDisplayOriginal = '';
                        if (barraHorariosEl) {
                            barraDisplayOriginal = barraHorariosEl.style.display || '';
                            barraHorariosEl.style.display = 'none';
                        }

                        // E) Injeta cabeçalho de rota + horário simples e centrado (para aparecer na foto)
                        const printHeader = document.createElement('div');
                        printHeader.className = 'temp-print-route-header';
                        const routeText = (origemPrint && destinoPrint)
                            ? `${origemPrint} → ${destinoPrint}`
                            : '';
                        const timeText = `${horarioSaida} → ${horarioChegada}`;
                        printHeader.style.cssText = `
                            text-align: center;
                            padding: 10px 16px 8px;
                            font-family: Arial, Helvetica, sans-serif;
                            color: #111;
                            border-bottom: 2px solid #eee;
                            margin-bottom: 6px;
                        `;
                        printHeader.innerHTML = [
                            routeText ? `<div style="font-size:15px;font-weight:bold;margin-bottom:4px;">${routeText}</div>` : '',
                            `<div style="font-size:13px;color:#555;">⏰ ${timeText}</div>`
                        ].join('');
                        elementoParaFoto.insertBefore(printHeader, elementoParaFoto.firstChild);

                        // --- 3. PREPARAÇÃO DO ENQUADRAMENTO ---
                        const wrapper = elementoParaFoto.querySelector('.vehicle-wrapper');
                        const originalWidth = elementoParaFoto.style.width;
                        const originalOverflow = wrapper ? wrapper.style.overflow : '';

                        elementoParaFoto.style.width = elementoParaFoto.scrollWidth + 'px';
                        if (wrapper) wrapper.style.overflow = 'hidden';

                        // --- 4. TIRA A FOTO ---
                        const blob = await htmlToImage.toBlob(elementoParaFoto, {
                            backgroundColor: '#ffffff',
                            pixelRatio: 2,
                            skipFonts: true,
                            width: elementoParaFoto.scrollWidth,
                            height: elementoParaFoto.scrollHeight
                        });

                        // --- 5. DEVOLVE TUDO AO NORMAL NA TELA ---
                        elementoParaFoto.style.width = originalWidth;
                        if (wrapper) wrapper.style.overflow = originalOverflow;
                        
                        // Remove cabeçalho temporário
                        const tempHeader = elementoParaFoto.querySelector('.temp-print-route-header');
                        if (tempHeader) tempHeader.remove();

                        // Restaura barra de horários
                        if (barraHorariosEl) {
                            barraHorariosEl.style.display = barraDisplayOriginal;
                        }

                        if (warningElementToHide) {
                            warningElementToHide.style.display = warningElementToHide.getAttribute('data-print-display');
                            warningElementToHide.removeAttribute('data-print-display');
                        }
                        if (linkLegenda) {
                            linkLegenda.style.display = legendaDisplayOriginal;
                        }
                        if (routeList) {
                            routeList.style.display = routeListDisplayOriginal;
                        }

                        btnPrint.style.visibility = "visible";
                        elementoParaFoto.querySelectorAll('.temp-print-icon').forEach(el => el.remove());
                        icones.forEach(i => {
                            i.style.display = i.getAttribute('data-print-display');
                            i.removeAttribute('data-print-display');
                        });

                        resolve(blob);

                    } catch (err) {
                        // Restaura em caso de erro
                        const tempHeaderErr = elementoParaFoto ? elementoParaFoto.querySelector('.temp-print-route-header') : null;
                        if (tempHeaderErr) tempHeaderErr.remove();
                        reject(err);
                    }
                });

                // ABRE A ÁREA DE TRANSFERÊNCIA IMEDIATAMENTE 
                try {
                    const item = new ClipboardItem({ "image/png": geradorDeImagem });
                    navigator.clipboard.write([item]).then(() => {
                        btnPrint.innerHTML = "Copiado!";
                        btnPrint.style.backgroundColor = "#111111"; 
                        btnPrint.style.borderColor = "#111111"; 
                        setTimeout(() => {
                            btnPrint.innerHTML = textoOriginal;
                            btnPrint.style.backgroundColor = "#111111";
                            btnPrint.style.borderColor = "#111111";
                        }, 2000);
                    }).catch(async (err) => {
                        const blobFinal = await geradorDeImagem;
                        baixarComoPlanoB(blobFinal);
                    });
                } catch (err) {
                    geradorDeImagem.then(blobFinal => baixarComoPlanoB(blobFinal));
                }

                // Função de segurança caso a cópia falhe
                function baixarComoPlanoB(blob) {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Mapa_Poltronas_${horarioSaida.replace(':', '')}.png`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    
                    btnPrint.innerHTML = "Baixado!";
                    btnPrint.style.backgroundColor = "#111111";
                    btnPrint.style.borderColor = "#111111";
                    setTimeout(() => {
                        btnPrint.innerHTML = textoOriginal;
                        btnPrint.style.backgroundColor = "#111111";
                        btnPrint.style.borderColor = "#111111";
                    }, 3000);
                }
            });
        });
    } catch (erroGeral) {
        console.error("Erro:", erroGeral);
    }
}

const observer = new MutationObserver(() => {
    trocarNumerosPorX();
    adicionarHorariosNoMapa();
});
observer.observe(document.body, { childList: true, subtree: true });
})();