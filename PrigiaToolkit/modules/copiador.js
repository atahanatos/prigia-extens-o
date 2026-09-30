(function() {
const observer = new MutationObserver(() => {
    const rows = document.querySelectorAll('app-passengerrow');
    
    // Função maravilhosa para buscar quem já está preenchido e contar tudo!
    const getPassageirosPreenchidos = () => {
        const contagem = {};
        const dados = {};
        
        rows.forEach(row => {
            const nomeInput = row.querySelector('oreonstextbox[oreonspropertyname="Name"] input');
            if (nomeInput && nomeInput.value.trim() !== '') {
                const nome = nomeInput.value.trim();
                contagem[nome] = (contagem[nome] || 0) + 1;
                
                // Salva os dados desse passageiro para podermos colar depois
                if (!dados[nome]) {
                    dados[nome] = {
                        name: nome,
                        phone: row.querySelector('oreonstextbox[oreonspropertyname="PhoneNumber"] input')?.value || '',
                        email: row.querySelector('oreonstextbox[oreonspropertyname="Email"] input')?.value || '',
                        birth: row.querySelector('oreonsdatepicker[oreonspropertyname="BirthDate"] input')?.value || '',
                        rg: row.querySelector('app-singledocumentbyinformationmetadatagroup:nth-of-type(1) oreonstextbox input')?.value || '',
                        cpf: row.querySelector('app-singledocumentbyinformationmetadatagroup:nth-of-type(2) oreonstextbox input')?.value || ''
                    };
                }
            }
        });
        return { contagem, dados };
    };

    rows.forEach((row, index) => {
        const routeHeader = row.querySelector('.service-route');
        
        // Verifica se achou o cabeçalho e se a nossa caixinha já não está lá
        if (routeHeader && !row.querySelector('.container-botoes-alice')) {
            const containerDiv = document.createElement('div');
            containerDiv.className = 'container-botoes-alice';
            containerDiv.style.cssText = 'display: flex; gap: 10px; margin-bottom: 10px; align-items: center;';

            // A nossa nova caixinha de seleção espetacular!
            const selectCopiar = document.createElement('select');
            selectCopiar.style.cssText = 'flex: 2; padding: 6px 8px; border-radius: 6px; border: 1px solid #e5e5e5; font-size: 12px; font-weight: 500; color: #111; outline: none; cursor: pointer; max-width: 200px; font-family: "Inter", -apple-system, sans-serif; background: #fff; transition: border-color 0.2s;';
            selectCopiar.innerHTML = '<option value="">Escolha quem copiar...</option>';

            // Essa função atualiza a listinha toda vez que o mouse passar por cima!
            const atualizarLista = () => {
                const valorAtual = selectCopiar.value;
                const { contagem, dados } = getPassageirosPreenchidos();
                
                selectCopiar.innerHTML = '<option value="">Escolha quem copiar...</option>';
                selectCopiar.dadosArmazenados = dados;
                
                Object.keys(dados).forEach(nome => {
                    const option = document.createElement('option');
                    option.value = nome;
                    // Mostra o nome e quantas vezes ele já aparece nas passagens!
                    option.textContent = `${nome} (${contagem[nome]} passagem/ns com este dado)`;
                    selectCopiar.appendChild(option);
                });
                
                if (dados[valorAtual]) {
                    selectCopiar.value = valorAtual;
                }
            };

            // Adiciona os eventos para a lista estar sempre fresquinha e atualizada!
            selectCopiar.addEventListener('mouseenter', atualizarLista);
            selectCopiar.addEventListener('focus', atualizarLista);

            // O botão de preencher super vigoroso!
            const btnColar = document.createElement('button');
            btnColar.innerHTML = 'Preencher';
            btnColar.style.cssText = 'flex: 1; background-color: #111111; color: #ffffff; border: 1px solid #111111; padding: 6px 12px; border-radius: 6px; font-weight: 500; font-size: 12px; cursor: pointer; transition: all 0.2s ease; font-family: "Inter", -apple-system, sans-serif;';
            
            btnColar.onmouseover = () => { if(btnColar.innerText !== 'PREENCHIDO!') btnColar.style.backgroundColor = '#2b2b2b'; };
            btnColar.onmouseout = () => { if(btnColar.innerText !== 'PREENCHIDO!') btnColar.style.backgroundColor = '#111111'; };
            
            btnColar.onclick = (e) => {
                e.preventDefault();
                
                const nomeEscolhido = selectCopiar.value;
                const dadosParaColar = selectCopiar.dadosArmazenados ? selectCopiar.dadosArmazenados[nomeEscolhido] : null;

                if (!nomeEscolhido || !dadosParaColar) {
                    alert('Ei! Você precisa escolher um passageiro na listinha primeiro!');
                    return;
                }

                const selectors = {
                    name: 'oreonstextbox[oreonspropertyname="Name"] input',
                    phone: 'oreonstextbox[oreonspropertyname="PhoneNumber"] input',
                    email: 'oreonstextbox[oreonspropertyname="Email"] input',
                    birth: 'oreonsdatepicker[oreonspropertyname="BirthDate"] input',
                    rg: 'app-singledocumentbyinformationmetadatagroup:nth-of-type(1) oreonstextbox input',
                    cpf: 'app-singledocumentbyinformationmetadatagroup:nth-of-type(2) oreonstextbox input'
                };

                for (const key in selectors) {
                    const input = row.querySelector(selectors[key]);
                    if (input && dadosParaColar[key] !== undefined) {
                        input.value = dadosParaColar[key];
                        // Os avisos essenciais para o sistema Angular!
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                        input.dispatchEvent(new Event('blur', { bubbles: true }));
                    }
                }
                
                const textoOriginal = btnColar.innerHTML;
                btnColar.innerHTML = 'PREENCHIDO!';
                btnColar.style.backgroundColor = '#2b2b2b';
                btnColar.style.borderColor = '#2b2b2b';
                setTimeout(() => {
                    btnColar.innerHTML = textoOriginal;
                    btnColar.style.backgroundColor = '#111111';
                    btnColar.style.borderColor = '#111111';
                }, 1500);
            };

            containerDiv.appendChild(selectCopiar);
            containerDiv.appendChild(btnColar);

            routeHeader.parentNode.insertBefore(containerDiv, routeHeader);
        }
    });
});

observer.observe(document.body, { childList: true, subtree: true });
})();