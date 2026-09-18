// ======================================================
// CONFIGURAÇÕES E ESTADO DO QUIZ (VERSÃO LEVE PARA TABLET)
// ======================================================
let perguntas = [];
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
    vincularEventos();
    iniciarCameraBackground();
});

// Inicializa o Canvas Compositor Otimizado (HD Leve)
function inicializarCompositor() {
    renderCanvas = document.createElement('canvas');
    renderCanvas.width = 1280;
    renderCanvas.height = 720;
    renderCtx = renderCanvas.getContext('2d', { alpha: false }); // Desativa alpha para maior desempenho de GPU
}

// Carrega as perguntas do perguntas.json
async function carregarPerguntas() {
    try {
        const response = await fetch('perguntas.json');
        perguntas = await response.json();
    } catch (error) {
        console.error('Erro ao carregar o arquivo perguntas.json:', error);
    }
}

// Inicia a câmera com resolução ideal para o tablet
async function iniciarCameraBackground() {
    try {
        if (!cameraStream) {
            cameraStream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
                audio: true
            });
            const videoEl = document.getElementById('webcam');
            if (videoEl) {
                videoEl.srcObject = cameraStream;
                videoEl.play();
            }
        }
    } catch (err) {
        console.warn("Aviso: Câmera não detectada ou permissão negada.", err);
    }
}

function vincularEventos() {
    const btnStart = document.getElementById('btn-start');
    if (btnStart) {
        btnStart.addEventListener('click', iniciarFluxoJogo);
    }

    for (let i = 0; i < 4; i++) {
        const btnOpt = document.getElementById(`btn-${i}`);
        if (btnOpt) {
            btnOpt.addEventListener('click', () => responder(i));
        }
    }
}

function mostrarTela(idTela) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const telaDestino = document.getElementById(idTela);
    if (telaDestino) {
        telaDestino.classList.add('active');
    }
}

// ======================================================
// FLUXO DE JOGO & CONTAGEM REGRESSIVA (3s)
// ======================================================
async function iniciarFluxoJogo() {
    if (!perguntas.length) {
        alert("Carregando perguntas... Tente novamente em instantes.");
        return;
    }

    await iniciarCameraBackground();
    const webcamEl = document.getElementById('webcam');
    if (webcamEl) webcamEl.classList.add('active');

    mostrarTela('screen-countdown');
    let contador = 3;
    const countEl = document.getElementById('countdown-number');
    if (countEl) countEl.innerText = contador;

    const countInterval = setInterval(() => {
        contador--;
        if (countEl) countEl.innerText = contador;
        
        if (contador <= 0) {
            clearInterval(countInterval);
            iniciarPartidaEGravação();
        }
    }, 1000);
}

function iniciarPartidaEGravação() {
    const sorteadas = [...perguntas].sort(() => Math.random() - 0.5);
    perguntaAtual = sorteadas[0];
    respostaSelecionada = null;
    jogoAtivo = true;
    tempoRestante = 20;

    atualizarHTMLJogo();
    mostrarTela('screen-game');

    iniciarGravaçãoCanvas();

    const timerEl = document.getElementById('timer');
    if (timerEl) {
        timerEl.innerText = tempoRestante;
        timerEl.className = 'timer-verde';
    }

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (tempoRestante > 0 && jogoAtivo) {
            tempoRestante--;
            if (timerEl) {
                timerEl.innerText = tempoRestante;
                if (tempoRestante <= 5) timerEl.className = 'timer-vermelho';
                else if (tempoRestante <= 10) timerEl.className = 'timer-laranja';
                else if (tempoRestante <= 15) timerEl.className = 'timer-amarelo';
            }
        } else if (tempoRestante === 0 && jogoAtivo) {
            processarResposta(-1);
        }
    }, 1000);
}

function atualizarHTMLJogo() {
    const qText = document.getElementById('question-text');
    if (qText) qText.innerText = perguntaAtual.pergunta;

    for (let i = 0; i < 4; i++) {
        const btn = document.getElementById(`btn-${i}`);
        if (btn) {
            btn.className = 'btn-option';
            const textSpan = btn.querySelector('.opt-text');
            if (textSpan && perguntaAtual.opcoes[i]) {
                textSpan.innerText = perguntaAtual.opcoes[i];
            }
        }
    }

    const fbBanner = document.getElementById('feedback-banner');
    if (fbBanner) fbBanner.classList.add('hidden');
}

// ======================================================
// RENDERIZAÇÃO EM TEMPO REAL NO CANVAS (SEM LAG)
// ======================================================
function desenharTelaJogo() {
    if (!renderCtx) return;

    // 1. Fundo do Game Show
    renderCtx.fillStyle = '#0f172a';
    renderCtx.fillRect(0, 0, renderCanvas.width, renderCanvas.height);

    // 2. Feed da Câmera (Metade Direita)
    const videoElement = document.getElementById('webcam');
    if (videoElement && videoElement.readyState >= 2) {
        renderCtx.save();
        renderCtx.translate(1280, 0);
        renderCtx.scale(-1, 1);
        renderCtx.drawImage(videoElement, 0, 0, 640, 720);
        renderCtx.restore();
    }

    // 3. Painel da Pergunta
    renderCtx.fillStyle = '#1e293b';
    if (renderCtx.roundRect) {
        renderCtx.beginPath();
        renderCtx.roundRect(40, 40, 560, 150, 15);
        renderCtx.fill();
    } else {
        renderCtx.fillRect(40, 40, 560, 150);
    }

    if (perguntaAtual) {
        renderCtx.fillStyle = '#ffffff';
        renderCtx.font = 'bold 20px sans-serif';
        quebrarTexto(renderCtx, perguntaAtual.pergunta, 60, 75, 520, 26);
    }

    // 4. Botões de Alternativas
    if (perguntaAtual && perguntaAtual.opcoes) {
        const startY = 210;
        const btnHeight = 85;
        const gap = 15;

        perguntaAtual.opcoes.forEach((opcao, index) => {
            const y = startY + index * (btnHeight + gap);

            let btnColor = '#1e293b';
            if (respostaSelecionada !== null) {
                if (index === perguntaAtual.correta) {
                    btnColor = '#2ecc71';
                } else if (index === respostaSelecionada) {
                    btnColor = '#e74c3c';
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
            renderCtx.fillText(`${index + 1}. ${opcao}`, 60, y + 48);
        });
    }

    // 5. Rodapé
    renderCtx.fillStyle = '#ff4757';
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
// RESPOSTAS E FEEDBACK LEVES
// ======================================================
function responder(index) {
    if (!jogoAtivo) return;
    processarResposta(index);
}

function processarResposta(index) {
    jogoAtivo = false;
    clearInterval(timerInterval);
    respostaSelecionada = index;

    const acertou = (index === perguntaAtual.correta);

    for (let i = 0; i < 4; i++) {
        const btn = document.getElementById(`btn-${i}`);
        if (btn) {
            if (i === perguntaAtual.correta) btn.classList.add('correta');
            else if (i === index) btn.classList.add('incorreta');
        }
    }

    // 2s de pausa para registrar a reação no vídeo antes do banner
    setTimeout(() => {
        exibirFeedback(acertou);
        capturarFotoLeve(); // Foto capturada somente aqui para aliviar processamento no clique
    }, 2000);

    // 10s depois finaliza a rodada e salva o vídeo
    setTimeout(() => {
        finalizarEIrParaObrigado();
    }, 10000);
}

function exibirFeedback(acertou) {
    const fbBanner = document.getElementById('feedback-banner');
    const fbEmoji = document.getElementById('feedback-emoji');
    const fbText = document.getElementById('feedback-text');

    if (fbBanner) {
        fbBanner.className = `feedback-banner ${acertou ? 'sucesso' : 'erro'}`;
        if (fbEmoji) fbEmoji.innerText = acertou ? '🎉' : '❌';
        if (fbText) fbText.innerText = acertou ? 'RESPOSTA CORRETA!' : 'RESPOSTA INCORRETA!';
        fbBanner.classList.remove('hidden');
    }
}

// Captura de foto assíncrona ultra leve (via Blob direto)
function capturarFotoLeve() {
    const videoEl = document.getElementById('webcam');
    const canvasFoto = document.getElementById('photo-canvas');
    const imgDestino = document.getElementById('captured-photo');

    if (videoEl && canvasFoto && imgDestino) {
        canvasFoto.width = 640;
        canvasFoto.height = 480;
        const ctx = canvasFoto.getContext('2d');
        ctx.drawImage(videoEl, 0, 0, 640, 480);
        
        canvasFoto.toBlob((blob) => {
            if (blob) {
                const url = URL.createObjectURL(blob);
                imgDestino.src = url;
            }
        }, 'image/jpeg', 0.8);
    }
}

// ======================================================
// ENCERRAMENTO E SALVAMENTO AUTOMÁTICO
// ======================================================
function obterMimeTypeSuportado() {
    const tipos = [
        'video/webm;codecs=vp8',
        'video/webm',
        'video/mp4'
    ];
    for (let tipo of tipos) {
        if (window.MediaRecorder && MediaRecorder.isTypeSupported(tipo)) {
            return tipo;
        }
    }
    return '';
}

function iniciarGravaçãoCanvas() {
    desenharTelaJogo();

    const canvasStream = renderCanvas.captureStream(25); // 25 FPS para aliviar a GPU do tablet
    if (cameraStream && cameraStream.getAudioTracks().length > 0) {
        canvasStream.addTrack(cameraStream.getAudioTracks()[0]);
    }

    recordedChunks = [];
    const mimeTypeSuportado = obterMimeTypeSuportado();

    try {
        if (mimeTypeSuportado) {
            mediaRecorder = new MediaRecorder(canvasStream, { mimeType: mimeTypeSuportado, videoBitsPerSecond: 2500000 });
        } else {
            mediaRecorder = new MediaRecorder(canvasStream);
        }
    } catch (e) {
        mediaRecorder = new MediaRecorder(canvasStream);
    }

    mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = salvarVideoFinal;
    mediaRecorder.start(1000);
}

function finalizarEIrParaObrigado() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    if (animFrameId) {
        cancelAnimationFrame(animFrameId);
    }
    mostrarTela('screen-thanks');
}

function salvarVideoFinal() {
    if (!recordedChunks.length) {
        mostrarTela('screen-intro');
        return;
    }

    const mimeTypeUsado = (mediaRecorder && mediaRecorder.mimeType) ? mediaRecorder.mimeType : 'video/webm';
    const extensao = mimeTypeUsado.includes('mp4') ? 'mp4' : 'webm';

    const blob = new Blob(recordedChunks, { type: mimeTypeUsado });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `quiz_noivos_${Date.now()}.${extensao}`;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        setTimeout(() => {
            mostrarTela('screen-intro');
        }, 4000);
    }, 500);
}
