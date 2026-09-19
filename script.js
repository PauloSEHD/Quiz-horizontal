// ======================================================
// CONFIGURAÇÕES E ESTADO DO QUIZ (MODO FOTOS SEQUENCIAIS)
// ======================================================
let perguntas = [];
let perguntaAtual = null;
let jogoAtivo = false;
let respostaSelecionada = null;

let cameraStream = null;
let fotosCapturadas = []; // Guarda as fotos da rodada

let tempoRestante = 20;
let timerInterval = null;

// ======================================================
// INICIALIZAÇÃO
// ======================================================
document.addEventListener('DOMContentLoaded', () => {
    carregarPerguntas();
    vincularEventos();
    iniciarCameraBackground();
});

async function carregarPerguntas() {
    try {
        const response = await fetch('perguntas.json');
        perguntas = await response.json();
    } catch (error) {
        console.error('Erro ao carregar perguntas.json:', error);
    }
}

async function iniciarCameraBackground() {
    try {
        if (!cameraStream) {
            cameraStream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
                audio: false
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
// FLUXO DE JOGO E FOTOS
// ======================================================
async function iniciarFluxoJogo() {
    if (!perguntas.length) {
        alert("Carregando perguntas... Tente novamente em instantes.");
        return;
    }

    fotosCapturadas = []; // Limpa fotos da rodada anterior
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
            iniciarPartida();
        }
    }, 1000);
}

function iniciarPartida() {
    const sorteadas = [...perguntas].sort(() => Math.random() - 0.5);
    perguntaAtual = sorteadas[0];
    respostaSelecionada = null;
    jogoAtivo = true;
    tempoRestante = 20;

    atualizarHTMLJogo();
    mostrarTela('screen-game');

    // FOTO 1: Início da pergunta (Pega a concentração)
    setTimeout(() => {
        capturarFotoMomento('inicio');
    }, 500);

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
// RESPOSTAS E SEQUÊNCIA DE FOTOS
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

    // FOTO 2: Instantânea no momento exato do clique
    capturarFotoMomento('clique');

    // Destaca no HTML
    for (let i = 0; i < 4; i++) {
        const btn = document.getElementById(`btn-${i}`);
        if (btn) {
            if (i === perguntaAtual.correta) btn.classList.add('correta');
            else if (i === index) btn.classList.add('incorreta');
        }
    }

    // 1.5s depois exibe o banner e tira a FOTO 3 (Pega a reação do resultado)
    setTimeout(() => {
        exibirFeedback(acertou);
        capturarFotoMomento('reacao_final');
    }, 1500);

    // 6s depois avança para a tela final de agradecimento e faz o download das fotos
    setTimeout(() => {
        finalizarERecomendar();
    }, 6000);
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

// Captura ultrarrápida usando canvas em memória
function capturarFotoMomento(tagMomento) {
    const videoEl = document.getElementById('webcam');
    const canvasFoto = document.getElementById('photo-canvas');

    if (videoEl && canvasFoto) {
        canvasFoto.width = 800;
        canvasFoto.height = 600;
        const ctx = canvasFoto.getContext('2d');

        // Espelha para salvar igual ao visual da tela
        ctx.save();
        ctx.translate(800, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoEl, 0, 0, 800, 600);
        ctx.restore();

        canvasFoto.toBlob((blob) => {
            if (blob) {
                const dataUrl = URL.createObjectURL(blob);
                fotosCapturadas.push({ tag: tagMomento, blob: blob, url: dataUrl });

                // Se for a foto da reação final, atualiza a imagem da tela de agradecimento
                if (tagMomento === 'reacao_final') {
                    const imgDestino = document.getElementById('captured-photo');
                    if (imgDestino) imgDestino.src = dataUrl;
                }
            }
        }, 'image/jpeg', 0.85);
    }
}

// ======================================================
// ENCERRAMENTO E SALVAMENTO DAS FOTOS
// ======================================================
function finalizarERecomendar() {
    mostrarTela('screen-thanks');
    salvarTodasAsFotos();
}

// Baixa automaticamente a sequência de fotos salvas
function salvarTodasAsFotos() {
    const timestamp = Date.now();

    fotosCapturadas.forEach((fotoObj, idx) => {
        setTimeout(() => {
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = fotoObj.url;
            a.download = `quiz_noivos_foto_${idx + 1}_${fotoObj.tag}_${timestamp}.jpg`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => document.body.removeChild(a), 200);
        }, idx * 400); // Espaça o download em 400ms entre uma foto e outra
    });

    // Retorna para a tela de descanso após 6 segundos
    setTimeout(() => {
        mostrarTela('screen-intro');
    }, 6000);
}
