// ======================================================
// CONFIGURAÇÕES E ESTADO DO QUIZ (MODO CARD + RAJADA)
// ======================================================
let perguntas = [];
let perguntaAtual = null;
let jogoAtivo = false;
let respostaSelecionada = null;

let cameraStream = null;
let fotosBrutas = []; // Guarda a rajada de fotos em memória

let tempoRestante = 20;
let timerInterval = null;

// Canvas invisível em memória para criar a moldura da foto final
let cardCanvas = null;
let cardCtx = null;

// ======================================================
// INICIALIZAÇÃO
// ======================================================
document.addEventListener('DOMContentLoaded', () => {
    inicializarCardCanvas();
    carregarPerguntas();
    vincularEventos();
    iniciarCameraBackground();
});

function inicializarCardCanvas() {
    cardCanvas = document.createElement('canvas');
    cardCanvas.width = 1280;
    cardCanvas.height = 720;
    cardCtx = cardCanvas.getContext('2d');
}

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

    fotosBrutas = [];
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

    // FOTO 1: Início da pergunta
    capturarFrameRajada('inicio_1');

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
// PROCESSAMENTO DE RESPOSTA E RAJADA DE FOTOS
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

    // RAJADA NO MOMENTO DO CLIQUE (2 Fotos com intervalo de 0.5s)
    capturarFrameRajada('clique_1');
    setTimeout(() => capturarFrameRajada('clique_2'), 500);

    // Destaca as opções no HTML
    for (let i = 0; i < 4; i++) {
        const btn = document.getElementById(`btn-${i}`);
        if (btn) {
            if (i === perguntaAtual.correta) btn.classList.add('correta');
            else if (i === index) btn.classList.add('incorreta');
        }
    }

    // RAJADA DA REAÇÃO DO RESULTADO (2 Fotos no resultado)
    setTimeout(() => {
        exibirFeedback(acertou);
        capturarFrameRajada('reacao_1');
        setTimeout(() => capturarFrameRajada('reacao_2'), 600);
    }, 1500);

    // Conclui e gera os Cards após 6 segundos
    setTimeout(() => {
        finalizarEGerarCards();
    }, 6000);
}

function exibirFeedback(acertou) {
    const fbBanner = document.getElementById('feedback-banner');
    const fbEmoji = document.getElementById('feedback-emoji');
    const fbText = document.getElementById('feedback-text');

    if (fbBanner) {
        fbBanner.className = `feedback-banner ${acertou ? 'sucesso' : 'erro'}`;
        if (fbEmoji) fbEmoji.innerText = acertou ? '🎉' : '🙈';
        if (fbText) fbText.innerText = acertou ? 'RESPOSTA CORRETA!' : 'RESPOSTA INCORRETA!';
        fbBanner.classList.remove('hidden');
    }
}

// Guarda o elemento Canvas estático em memória (ultra leve)
function capturarFrameRajada(tagMomento) {
    const videoEl = document.getElementById('webcam');
    if (videoEl && videoEl.readyState >= 2) {
        const memCanvas = document.createElement('canvas');
        memCanvas.width = 640;
        memCanvas.height = 720;
        const ctx = memCanvas.getContext('2d');

        // Desenha espelhado
        ctx.save();
        ctx.translate(640, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoEl, 0, 0, 640, 720);
        ctx.restore();

        fotosBrutas.push({ tag: tagMomento, canvasFrame: memCanvas });
    }
}

// ======================================================
// GERAÇÃO DOS CARDS DE FOTO COM MOLDURA DO QUIZ
// ======================================================
function finalizarEGerarCards() {
    mostrarTela('screen-thanks');

    if (!fotosBrutas.length) return;

    // Pega a última foto (Reação) para exibir na tela de agradecimento
    const ultimaFoto = fotosBrutas[fotosBrutas.length - 1];
    gerarCardComMoldura(ultimaFoto.canvasFrame, (dataUrl) => {
        const imgDestino = document.getElementById('captured-photo');
        if (imgDestino) imgDestino.src = dataUrl;
    });

    // Baixa a sequência inteira de cards
    salvarTodosOsCards();
}

function gerarCardComMoldura(frameCanvas, callback) {
    // 1. Fundo do Card
    cardCtx.fillStyle = '#0f172a';
    cardCtx.fillRect(0, 0, cardCanvas.width, cardCanvas.height);

    // 2. Foto do Participante (Lado Direito)
    cardCtx.drawImage(frameCanvas, 640, 0, 640, 720);

    // 3. Painel da Pergunta (Lado Esquerdo)
    cardCtx.fillStyle = '#1e293b';
    if (cardCtx.roundRect) {
        cardCtx.beginPath();
        cardCtx.roundRect(40, 30, 560, 130, 12);
        cardCtx.fill();
    } else {
        cardCtx.fillRect(40, 30, 560, 130);
    }

    cardCtx.fillStyle = '#ffffff';
    cardCtx.font = 'bold 18px sans-serif';
    quebrarTexto(cardCtx, perguntaAtual.pergunta, 55, 60, 530, 24);

    // 4. Alternativas (A, B, C, D)
    const startY = 175;
    const btnHeight = 70;
    const gap = 10;

    perguntaAtual.opcoes.forEach((opcao, index) => {
        const y = startY + index * (btnHeight + gap);

        let btnColor = '#1e293b';
        if (respostaSelecionada !== null) {
            if (index === perguntaAtual.correta) {
                btnColor = '#2ecc71'; // Verde
            } else if (index === respostaSelecionada) {
                btnColor = '#e74c3c'; // Vermelho
            }
        }

        cardCtx.fillStyle = btnColor;
        if (cardCtx.roundRect) {
            cardCtx.beginPath();
            cardCtx.roundRect(40, y, 560, btnHeight, 8);
            cardCtx.fill();
        } else {
            cardCtx.fillRect(40, y, 560, btnHeight);
        }

        cardCtx.fillStyle = '#ffffff';
        cardCtx.font = 'bold 16px sans-serif';
        cardCtx.fillText(`${index + 1}. ${opcao}`, 55, y + 40);
    });

    // 5. Caixa de Explicação Personalizada (Rodapé Esquerdo)
    const explicacaoY = 500;
    const acertou = (respostaSelecionada === perguntaAtual.correta);
    const emoji = acertou ? '🎉' : '🙈';
    
    // Texto de explicação do JSON ou Padrão
    let textoExplicacao = perguntaAtual.explicacao;
    if (!textoExplicacao) {
        textoExplicacao = acertou ? 
            'Parabéns! Você demonstrou ter um ótimo conhecimento!' : 
            `A resposta correta era: ${perguntaAtual.opcoes[perguntaAtual.correta]}.`;
    }

    cardCtx.fillStyle = acertou ? 'rgba(46, 204, 113, 0.2)' : 'rgba(231, 76, 60, 0.2)';
    cardCtx.strokeStyle = acertou ? '#2ecc71' : '#e74c3c';
    cardCtx.lineWidth = 2;

    if (cardCtx.roundRect) {
        cardCtx.beginPath();
        cardCtx.roundRect(40, explicacaoY, 560, 180, 12);
        cardCtx.fill();
        cardCtx.stroke();
    } else {
        cardCtx.fillRect(40, explicacaoY, 560, 180);
    }

    // Título e texto da explicação
    cardCtx.fillStyle = '#ffffff';
    cardCtx.font = 'bold 16px sans-serif';
    cardCtx.fillText(`${emoji} ${acertou ? 'ACERTOU!' : 'EXPLICAÇÃO:'}`, 55, explicacaoY + 30);

    cardCtx.font = '15px sans-serif';
    cardCtx.fillStyle = '#cbd5e1';
    quebrarTexto(cardCtx, textoExplicacao, 55, explicacaoY + 60, 530, 22);

    // Exporta imagem final em Blob leve
    cardCanvas.toBlob((blob) => {
        if (blob) {
            const url = URL.createObjectURL(blob);
            callback(url);
        }
    }, 'image/jpeg', 0.9);
}

function salvarTodosOsCards() {
    const timestamp = Date.now();

    fotosBrutas.forEach((item, idx) => {
        setTimeout(() => {
            gerarCardComMoldura(item.canvasFrame, (url) => {
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `quiz_noivos_card_${idx + 1}_${item.tag}_${timestamp}.jpg`;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => document.body.removeChild(a), 200);
            });
        }, idx * 500);
    });

    // Retorna à tela inicial
    setTimeout(() => {
        mostrarTela('screen-intro');
    }, 7000);
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
