// background.js - Versão com Pasta Opcional
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "download_pdf") {

    let caminhoFinal;

    // Se a pasta estiver vazia ou não definida, baixa direto na raiz de Downloads
    if (request.folder && request.folder.trim() !== '') {
      // Com pasta personalizada: Pasta/NomeDoArquivo.pdf
      caminhoFinal = `${request.folder}/${request.filename}`;
    } else {
      // Sem pasta: direto na raiz de Downloads
      caminhoFinal = request.filename;
    }

    chrome.downloads.download({
      url: request.url,
      filename: caminhoFinal,
      conflictAction: 'uniquify',
      saveAs: false // Salva direto, sem perguntar
    }, (downloadId) => {
      sendResponse({ status: "ok" });
    });

    return true;
  }
});