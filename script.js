// ======================================================
// CONFIGURAÇÕES E ESTADO DO QUIZ
// ======================================================
let perguntas = [];
let perguntasSorteadas = [];
let perguntaAtual = null;
let jogoAtivo = false;
let respostaSelecionada = null;

let cameraStream = null;
let mediaRecorder = null;
let recordedChunks = [];

let renderCanvas = null;
let renderCtx = null;
let animFrameId = null;

let tempoRestante = 20;
let timerInterval = null;

// ======================================================
// INICIALIZAÇÃO E CARREGAMENTO
// ======================================================
document.addEventListener('DOMContentLoaded', () => {
    inicializarCompositor();
    carregarPerguntas();
    iniciarCamera();
});

// Inicializa o Canvas Compositor (Full HD 16:9)
function inicializarCompositor() {
    renderCanvas = document.createElement('canvas');
    renderCanvas.width = 1280;
    renderCanvas.height = 720;
    renderCtx = renderCanvas.getContext('2d');
}

// Carrega o banco de dados do JSON
async function carregarPerguntas() {
    try {
        const response = await fetch('perguntas.json');
        perguntas = await response.json();
        embaralharEIniciarJogo();
    } catch (error) {
        console.error('Erro ao carregar o arquivo perguntas.json:', error);
    }
}

// Inicia o feed da câmera frontal/webcam do tablet
async function iniciarCamera() {
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
            audio: true
        });
        const videoElement = document.getElementById('cameraFeed');
        if (videoElement) {
            videoElement.srcObject = cameraStream;
            videoElement.play();
        }
    } catch (err) {
        console.error("Erro ao acessar a câmera/microfone:", err);
    }
}

// Embaralha as perguntas e pega 1 para a rodada
function embaralharEIniciarJogo() {
    if (!perguntas.length) return;
    perguntasSorteadas = [...perguntas].sort(() => Math.random() - 0.5);
    perguntaAtual = perguntasSorteadas[0];
    respostaSelecionada = null;
    jogoAtivo = true;
    tempoRestante = 20;

    atualizarInterfaceHTML();
    iniciarContagemEGravação();
}

// ======================================================
// RENDERIZAÇÃO EM TEMPO REAL NO CANVAS (GRAVAÇÃO COMPLETA)
// ======================================================
function desenharTelaJogo() {
    if (!renderCtx) return;

    // 1. Fundo Principal
    renderCtx.fillStyle = '#1a1a2e';
    renderCtx.fillRect(0, 0, renderCanvas.width, renderCanvas.height);

    // 2. Feed da Câmera no Lado Direito
    const videoElement = document.getElementById('cameraFeed');
    if (videoElement && videoElement.readyState >= 2) {
        renderCtx.drawImage(videoElement, 640, 0, 640, 720);
    }

    // 3. Painel da Pergunta (Esquerda)
    renderCtx.fillStyle = '#0f3460';
    if (renderCtx.roundRect) {
        renderCtx.beginPath();
        renderCtx.roundRect(40, 40, 560, 160, 15);
        renderCtx.fill();
    } else {
        renderCtx.fillRect(40, 40, 560, 160);
    }

    if (perguntaAtual) {
        renderCtx.fillStyle = '#ffffff';
        renderCtx.font = 'bold 20px sans-serif';
        quebrarTexto(renderCtx, perguntaAtual.pergunta, 60, 75, 520, 26);
    }

    // 4. Botões de Alternativas (A, B, C, D)
    if (perguntaAtual && perguntaAtual.opcoes) {
        const letras = ['A', 'B', 'C', 'D'];
        const startY = 220;
        const btnHeight = 85;
        const gap = 15;

        perguntaAtual.opcoes.forEach((opcao, index) => {
            const y = startY + index * (btnHeight + gap);

            let btnColor = '#16213e'; // Padrão
            if (respostaSelecionada !== null) {
                if (index === perguntaAtual.correta) {
                    btnColor = '#27ae60'; // Verde se for a certa
                } else if (index === respostaSelecionada) {
                    btnColor = '#c0392b'; // Vermelho se clicou errado
                }
            }

            renderCtx.fillStyle = btnColor;
            if (renderCtx.roundRect) {
                renderCtx.beginPath();
                renderCtx.roundRect(40, y, 560, btnHeight, 10);
                renderCtx.fill();
            } else {
                renderCtx.fillRect(40, y, 560, btnHeight);
            }

            renderCtx.fillStyle = '#ffffff';
            renderCtx.font = 'bold 18px sans-serif';
            renderCtx.fillText(`${letras[index]}) ${opcao}`, 60, y + 48);
        });
    }

    // 5. Cabeçalho e Rodapé
    renderCtx.fillStyle = '#e94560';
    renderCtx.font = 'bold 16px sans-serif';
    renderCtx.fillText(`TEMPO: ${tempoRestante}s`, 40, 680);

    renderCtx.fillStyle = '#ffffff';
    renderCtx.font = 'bold 18px sans-serif';
    renderCtx.fillText('QUIZ DOS NOIVOS', 440, 680);

    animFrameId = requestAnimationFrame(desenharTelaJogo);
}

function quebrarTexto(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
            ctx.fillText(line, x, y);
            line = words[n] + ' ';
            y += lineHeight;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, x, y);
}

// ======================================================
// CONTROLE DE GRAVAÇÃO E JOGO
// ======================================================
function iniciarContagemEGravação() {
    desenharTelaJogo();

    // Captura o Canvas em tempo real a 30 FPS + Áudio da Câmera
    const canvasStream = renderCanvas.captureStream(30);
    if (cameraStream && cameraStream.getAudioTracks().length > 0) {
        canvasStream.addTrack(cameraStream.getAudioTracks()[0]);
    }

    recordedChunks = [];
    mediaRecorder = new MediaRecorder(canvasStream, { mimeType: 'video/webm;codecs=vp9' });

    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };

    mediaRecorder.onstop = salvarVideoAutomatico;
    mediaRecorder.start();

    // Inicia o Cronômetro de 20s
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (tempoRestante > 0 && jogoAtivo) {
            tempoRestante--;
            document.getElementById('timerBadge').innerText = `${tempoRestante}s`;
        } else if (tempoRestante === 0 && jogoAtivo) {
            processarResposta(-1); // Tempo esgotado
        }
    }, 1000);
}

// Atualiza a tela HTML normal do tablet
function atualizarInterfaceHTML() {
    document.getElementById('perguntaText').innerText = perguntaAtual.pergunta;
    const containerOpcoes = document.getElementById('opcoesContainer');
    containerOpcoes.innerHTML = '';

    const letras = ['A', 'B', 'C', 'D'];
    perguntaAtual.opcoes.forEach((opcao, index) => {
        const btn = document.createElement('button');
        btn.className = 'opcao-btn';
        btn.innerText = `${letras[index]}) ${opcao}`;
        btn.onclick = () => responder(index);
        containerOpcoes.appendChild(btn);
    });
}

function responder(index) {
    if (!jogoAtivo) return;
    processarResposta(index);
}

function processarResposta(index) {
    jogoAtivo = false;
    clearInterval(timerInterval);
    respostaSelecionada = index;

    const acertou = (index === perguntaAtual.correta);

    // Reação e resultado na tela
    setTimeout(() => {
        exibirFeedback(acertou);
    }, 2000); // 2s de atraso para pegar a reação espontânea do participante

    // Encerra a rodada após 10s na tela de agradecimento
    setTimeout(() => {
        finalizarRodada();
    }, 10000);
}

function exibirFeedback(acertou) {
    const feedbackBanner = document.getElementById('feedbackBanner');
    if (feedbackBanner) {
        feedbackBanner.className = `feedback-banner ${acertou ? 'sucesso' : 'erro'}`;
        feedbackBanner.innerText = acertou ? '🎉 VOCÊ ACERTOU!' : '❌ RESPOSTA INCORRETA!';
        feedbackBanner.classList.remove('hidden');
    }
}

function finalizarRodada() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    if (animFrameId) {
        cancelAnimationFrame(animFrameId);
    }
}

// Salva o arquivo de vídeo final automaticamente no tablet
function salvarVideoAutomatico() {
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `quiz_noivos_${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        // Reinicia a tela de descanso para o próximo convidado
        window.location.reload();
    }, 2000);
}
