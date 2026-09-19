// ======================================================
// CONFIGURAÇÕES E ESTADO DO QUIZ (MODO 480P ULTRA LEVE)
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

// Resolução 480p Leve (854x480) para garantir estabilidade no tablet
function inicializarCompositor() {
    renderCanvas = document.createElement('canvas');
    renderCanvas.width = 854;
    renderCanvas.height = 480;
    renderCtx = renderCanvas.getContext('2d', { alpha: false });
}

async function carregarPerguntas() {
    try {
        const response = await fetch('perguntas.json');
        perguntas = await response.json();
    } catch (error) {
        console.error('Erro ao carregar o arquivo perguntas.json:', error);
    }
}

async function iniciarCameraBackground() {
    try {
        if (!cameraStream) {
            cameraStream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 854 }, height: { ideal: 480 }, facingMode: "user" },
                audio: true
            });
            const videoEl = document.getElementById('webcam');
            if (videoEl) {
                videoEl.srcObject = cameraStream;
                videoEl.play();
            }
        }
    } catch (err) {
        console.warn("Aviso na Câmera:", err);
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
// FLUXO DE JOGO
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
// RENDERIZAÇÃO NO CANVAS (854x480 A 20 FPS)
// ======================================================
function desenharTelaJogo() {
    if (!renderCtx) return;

    // Fundo
    renderCtx.fillStyle = '#0f172a';
    renderCtx.fillRect(0, 0, renderCanvas.width, renderCanvas.height);

    // Câmera (Lado Direito)
    const videoElement = document.getElementById('webcam');
    if (videoElement && videoElement.readyState >= 2) {
        renderCtx.save();
        renderCtx.translate(854, 0);
        renderCtx.scale(-1, 1);
        renderCtx.drawImage(videoElement, 0, 0, 427, 480);
        renderCtx.restore();
    }

    // Painel da Pergunta
    renderCtx.fillStyle = '#1e293b';
    renderCtx.fillRect(20, 20, 380, 100);

    if (perguntaAtual) {
        renderCtx.fillStyle = '#ffffff';
        renderCtx.font = 'bold 14px sans-serif';
        quebrarTexto(renderCtx, perguntaAtual.pergunta, 30, 45, 360, 18);
    }

    // Opções
    if (perguntaAtual && perguntaAtual.opcoes) {
        const startY = 135;
        const btnHeight = 55;
        const gap = 10;

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
            renderCtx.fillRect(20, y, 380, btnHeight);

            renderCtx.fillStyle = '#ffffff';
            renderCtx.font = 'bold 13px sans-serif';
            renderCtx.fillText(`${index + 1}. ${opcao}`, 30, y + 32);
        });
    }

    // Rodapé
    renderCtx.fillStyle = '#ff4757';
    renderCtx.font = 'bold 12px sans-serif';
    renderCtx.fillText(`TEMPO: ${tempoRestante}s`, 20, 455);

    renderCtx.fillStyle = '#ffffff';
    renderCtx.font = 'bold 13px sans-serif';
    renderCtx.fillText('QUIZ DOS NOIVOS', 280, 455);

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
// PROCESSAMENTO
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

    // 2s de pausa para gravar reação antes do feedback
    setTimeout(() => {
        exibirFeedback(acertou);
        capturarFotoLeve();
    }, 2000);

    // Finaliza e salva o vídeo após 8s
    setTimeout(() => {
        finalizarEIrParaObrigado();
    }, 8000);
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

function capturarFotoLeve() {
    const videoEl = document.getElementById('webcam');
    const canvasFoto = document.getElementById('photo-canvas');
    const imgDestino = document.getElementById('captured-photo');

    if (videoEl && canvasFoto && imgDestino) {
        canvasFoto.width = 480;
        canvasFoto.height = 360;
        const ctx = canvasFoto.getContext('2d');
        ctx.drawImage(videoEl, 0, 0, 480, 360);
        
        canvasFoto.toBlob((blob) => {
            if (blob) {
                const url = URL.createObjectURL(blob);
                imgDestino.src = url;
            }
        }, 'image/jpeg', 0.7);
    }
}

// ======================================================
// ENCERRAMENTO E SALVAMENTO AUTOMÁTICO
// ======================================================
function obterMimeTypeSuportado() {
    const tipos = ['video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
    for (let tipo of tipos) {
        if (window.MediaRecorder && MediaRecorder.isTypeSupported(tipo)) {
            return tipo;
        }
    }
    return '';
}

function iniciarGravaçãoCanvas() {
    desenharTelaJogo();

    // Limitado a 20 FPS para não travar o processador do tablet
    const canvasStream = renderCanvas.captureStream(20);
    if (cameraStream && cameraStream.getAudioTracks().length > 0) {
        canvasStream.addTrack(cameraStream.getAudioTracks()[0]);
    }

    recordedChunks = [];
    const mimeTypeSuportado = obterMimeTypeSuportado();

    try {
        if (mimeTypeSuportado) {
            mediaRecorder = new MediaRecorder(canvasStream, { 
                mimeType: mimeTypeSuportado, 
                videoBitsPerSecond: 1200000 // Bitrate leve (1.2 Mbps)
            });
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
        recordedChunks = []; // Limpa array da memória
        setTimeout(() => {
            mostrarTela('screen-intro');
        }, 3000);
    }, 500);
}
