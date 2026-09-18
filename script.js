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
// INICIALIZAÇÃO
// ======================================================
document.addEventListener('DOMContentLoaded', () => {
    inicializarCompositor();
    carregarPerguntas();
    vincularBotaoInicial();
});

// Inicializa o Canvas Compositor (Full HD 16:9 para gravação)
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
    } catch (error) {
        console.error('Erro ao carregar o arquivo perguntas.json:', error);
    }
}

// Procura o botão inicial no seu HTML e adiciona o evento de clique
function vincularBotaoInicial() {
    const btnInicial = document.getElementById('btnInicio') || 
                       document.getElementById('iniciarBtn') || 
                       document.getElementById('startBtn') ||
                       document.querySelector('.btn-iniciar') ||
                       document.querySelector('button');

    if (btnInicial) {
        btnInicial.addEventListener('click', iniciarRodadaQuiz);
    }
}

// ======================================================
// INÍCIO DA RODADA (DISPARADO PELO BOTÃO INICIAL)
// ======================================================
async function iniciarRodadaQuiz() {
    // Esconde a tela inicial/landing se ela existir
    const telaLanding = document.getElementById('landingScreen') || 
                        document.getElementById('telaInicial') ||
                        document.getElementById('descanso');
    if (telaLanding) {
        telaLanding.style.display = 'none';
    }

    // Exibe o contêiner do jogo
    const telaJogo = document.getElementById('quizScreen') || 
                     document.getElementById('telaJogo') || 
                     document.getElementById('gameContainer');
    if (telaJogo) {
        telaJogo.style.display = 'block';
    }

    // Solcita acesso à câmera no momento do clique
    try {
        if (!cameraStream) {
            cameraStream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
                audio: true
            });
            const videoElement = document.getElementById('cameraFeed') || document.querySelector('video');
            if (videoElement) {
                videoElement.srcObject = cameraStream;
                videoElement.play();
            }
        }
    } catch (err) {
        console.warn("Aviso: Câmera não detectada ou permissão negada.", err);
    }

    embaralharEIniciarJogo();
}

function embaralharEIniciarJogo() {
    if (!perguntas.length) {
        alert("Carregando perguntas... Tente novamente em alguns segundos.");
        return;
    }
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
    const videoElement = document.getElementById('cameraFeed') || document.querySelector('video');
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

            let btnColor = '#16213e';
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
    if (!text) return;
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

    // Captura o Canvas a 30 FPS + Áudio da Câmera se disponível
    const canvasStream = renderCanvas.captureStream(30);
    if (cameraStream && cameraStream.getAudioTracks().length > 0) {
        canvasStream.addTrack(cameraStream.getAudioTracks()[0]);
    }

    recordedChunks = [];
    try {
        mediaRecorder = new MediaRecorder(canvasStream, { mimeType: 'video/webm;codecs=vp9' });
    } catch (e) {
        mediaRecorder = new MediaRecorder(canvasStream);
    }

    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };

    mediaRecorder.onstop = salvarVideoAutomatico;
    mediaRecorder.start();

    // Cronômetro de 20s
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (tempoRestante > 0 && jogoAtivo) {
            tempoRestante--;
            const timerBadge = document.getElementById('timerBadge') || document.getElementById('timer');
            if (timerBadge) timerBadge.innerText = `${tempoRestante}s`;
        } else if (tempoRestante === 0 && jogoAtivo) {
            processarResposta(-1);
        }
    }, 1000);
}

// Atualiza a tela HTML no tablet
function atualizarInterfaceHTML() {
    const perguntaEl = document.getElementById('perguntaText') || document.getElementById('pergunta');
    if (perguntaEl) perguntaEl.innerText = perguntaAtual.pergunta;

    const containerOpcoes = document.getElementById('opcoesContainer') || document.getElementById('opcoes');
    if (containerOpcoes) {
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

    // 2s de pausa para pegar a reação da pessoa antes de exibir o feedback
    setTimeout(() => {
        exibirFeedback(acertou);
    }, 2000);

    // Finaliza e baixa o vídeo após 10s
    setTimeout(() => {
        finalizarRodada();
    }, 10000);
}

function exibirFeedback(acertou) {
    const feedbackBanner = document.getElementById('feedbackBanner') || document.getElementById('feedback');
    if (feedbackBanner) {
        feedbackBanner.className = `feedback-banner ${acertou ? 'sucesso' : 'erro'}`;
        feedbackBanner.innerText = acertou ? '🎉 VOCÊ ACERTOU!' : '❌ RESPOSTA INCORRETA!';
        feedbackBanner.classList.remove('hidden');
        feedbackBanner.style.display = 'block';
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

// Salva o vídeo completo gravado no tablet
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
        window.location.reload();
    }, 2000);
}
