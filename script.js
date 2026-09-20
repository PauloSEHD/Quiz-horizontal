// ======================================================
// CONFIGURAÇÕES E ESTADO DO QUIZ
// ======================================================
const listaFotosCasal = [
    'fotos/foto1.jpg',
    'fotos/foto2.jpg',
    'fotos/foto3.jpg'
];

const letrasOpcoes = ['A', 'B', 'C', 'D'];

let perguntas = [];
let perguntaAtual = null;
let jogoAtivo = false;
let respostaSelecionada = null;

let cameraStream = null;

let tempoRestante = 20;
let timerInterval = null;

let slideIndex = 0;
let slideInterval = null;

let inactivityTimer = null;
const TEMPO_INATIVIDADE_MS = 2 * 60 * 1000; // 2 minutos

// Imagem do Logo para o Canvas (Caminho e nome corrigidos)
let logoImg = new Image();
logoImg.src = 'imagens/logo.jpg';

// ======================================================
// INICIALIZAÇÃO
// ======================================================
document.addEventListener('DOMContentLoaded', () => {
    carregarPerguntas();
    iniciarSlideShow();
    vincularEventos();
    iniciarCameraBackground();
    registrarMonitorDeInatividade();
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

// ======================================================
// SLIDE SHOW & MODO INATIVIDADE
// ======================================================
function iniciarSlideShow() {
    const container = document.getElementById('slideshow-container');
    if (!container) return;
    container.innerHTML = '';

    if (listaFotosCasal.length === 0) return;

    listaFotosCasal.forEach((src, idx) => {
        const img = document.createElement('img');
        img.src = src;
        img.classList.add('slide-img');
        if (idx === 0) img.classList.add('active');
        container.appendChild(img);
    });

    slideIndex = 0;
    clearInterval(slideInterval);
    slideInterval = setInterval(proximoSlide, 4000);
}

function proximoSlide() {
    const slides = document.querySelectorAll('.slide-img');
    if (!slides.length) return;

    slides[slideIndex].classList.remove('active');
    slideIndex = (slideIndex + 1) % slides.length;
    slides[slideIndex].classList.add('active');
}

function registrarMonitorDeInatividade() {
    const resetarTimer = () => {
        clearTimeout(inactivityTimer);
        const telaSlideshow = document.getElementById('screen-slideshow');
        if (telaSlideshow && !telaSlideshow.classList.contains('active')) {
            inactivityTimer = setTimeout(() => {
                voltarParaSlideShow();
            }, TEMPO_INATIVIDADE_MS);
        }
    };

    window.addEventListener('click', resetarTimer);
    window.addEventListener('touchstart', resetarTimer);
}

function voltarParaSlideShow() {
    jogoAtivo = false;
    clearInterval(timerInterval);
    iniciarSlideShow();
    mostrarTela('screen-slideshow');
}

// ======================================================
// EVENTOS E TELA CHEIA
// ======================================================
function vincularEventos() {
    const screenSlideshow = document.getElementById('screen-slideshow');
    if (screenSlideshow) {
        screenSlideshow.addEventListener('click', () => {
            ativarTelaCheia();
            mostrarTela('screen-intro');
        });
    }

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

function ativarTelaCheia() {
    const doc = document.documentElement;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (doc.requestFullscreen) {
            doc.requestFullscreen().catch(() => {});
        } else if (doc.webkitRequestFullscreen) {
            doc.webkitRequestFullscreen().catch(() => {});
        }
    }
}

function mostrarTela(idTela) {
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none';
    });

    const telaDestino = document.getElementById(idTela);
    if (telaDestino) {
        telaDestino.classList.add('active');
        telaDestino.style.display = 'flex';
    }
}

// ======================================================
// FLUXO DO JOGO
// ======================================================
async function iniciarFluxoJogo() {
    if (!perguntas.length) {
        alert("Carregando perguntas... Tente novamente em instantes.");
        return;
    }

    ativarTelaCheia();

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

    const timerEl = document.getElementById('timer');
    const timerBox = document.getElementById('timer-badge');
    if (timerBox) timerBox.style.display = 'flex';

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
            const badgeSpan = btn.querySelector('.opt-badge');
            const textSpan = btn.querySelector('.opt-text');
            if (badgeSpan) badgeSpan.innerText = letrasOpcoes[i];
            if (textSpan && perguntaAtual.opcoes[i]) {
                textSpan.innerText = perguntaAtual.opcoes[i];
            }
        }
    }

    const fbBanner = document.getElementById('feedback-banner');
    if (fbBanner) fbBanner.classList.add('hidden');
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

    for (let i = 0; i < 4; i++) {
        const btn = document.getElementById(`btn-${i}`);
        if (btn) {
            if (i === perguntaAtual.correta) btn.classList.add('correta');
            else if (i === index) btn.classList.add('incorreta');
        }
    }

    setTimeout(() => {
        exibirFeedback(acertou);
    }, 1000);

    setTimeout(() => {
        capturarEGerarCardComSobreposicao();
    }, 3500);
}

function exibirFeedback(acertou) {
    const timerBox = document.getElementById('timer-badge');
    if (timerBox) timerBox.style.display = 'none';

    const fbBanner = document.getElementById('feedback-banner');
    const fbEmoji = document.getElementById('feedback-emoji');
    const fbTitle = document.getElementById('feedback-title');
    const fbText = document.getElementById('feedback-text');

    let explicacao = perguntaAtual.explicacao;
    if (!explicacao) {
        explicacao = acertou ? 
            'Parabéns! Você mandou super bem!' : 
            `A resposta correta era a alternativa ${letrasOpcoes[perguntaAtual.correta]}.`;
    }

    if (fbBanner) {
        fbBanner.className = `feedback-banner ${acertou ? 'sucesso' : 'erro'}`;
        if (fbEmoji) fbEmoji.innerText = acertou ? '🎉' : '🙈';
        if (fbTitle) fbTitle.innerText = acertou ? 'RESPOSTA CORRETA!' : 'RESPOSTA INCORRETA!';
        if (fbText) fbText.innerText = explicacao;
        fbBanner.classList.remove('hidden');
    }
}

// ======================================================
// CAPTURA DO CANVAS IDÊNTICO À TELA AO VIVO
// ======================================================
function capturarEGerarCardComSobreposicao() {
    const videoEl = document.getElementById('webcam');
    
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');

    // 1. Desenha a Câmera ocupando 100% da imagem ao fundo
    if (videoEl && videoEl.readyState >= 2) {
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        ctx.restore();
    } else {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 2. Desenha o Gradiente Escuro na Lateral Esquerda
    const grad = ctx.createLinearGradient(0, 0, canvas.width * 0.55, 0);
    grad.addColorStop(0, 'rgba(15, 23, 42, 0.92)');
    grad.addColorStop(0.75, 'rgba(15, 23, 42, 0.65)');
    grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 3. Desenha a Logo "Baú da Fé" no topo esquerdo com proporção correta
    if (logoImg.complete && logoImg.naturalWidth !== 0) {
        const logoWidth = 200;
        const logoHeight = (logoImg.naturalHeight / logoImg.naturalWidth) * logoWidth;
        ctx.drawImage(logoImg, 40, 20, logoWidth, logoHeight);
    }

    // 4. Desenha a Pergunta
    const boxX = 40;
    const boxY = 90;
    const boxWidth = 560;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.6)';
    ctx.lineWidth = 2;
    
    if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxWidth, 110, 14);
        ctx.fill();
        ctx.stroke();
    } else {
        ctx.fillRect(boxX, boxY, boxWidth, 110);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    quebrarTexto(ctx, perguntaAtual.pergunta, boxX + 20, boxY + 38, boxWidth - 40, 26);

    // 5. Desenha as Opções (A, B, C, D)
    const optStartY = 215;
    const optHeight = 65;
    const gap = 12;

    perguntaAtual.opcoes.forEach((opcao, i) => {
        const y = optStartY + i * (optHeight + gap);

        let bgColor = 'rgba(30, 41, 59, 0.9)';
        let borderColor = 'rgba(255, 255, 255, 0.2)';
        let badgeBg = '#d4af37';
        let badgeTextColor = '#0f172a';

        if (respostaSelecionada !== null) {
            if (i === perguntaAtual.correta) {
                bgColor = '#2ecc71';
                borderColor = '#27ae60';
                badgeBg = '#ffffff';
                badgeTextColor = '#2ecc71';
            } else if (i === respostaSelecionada) {
                bgColor = '#e74c3c';
                borderColor = '#c0392b';
            }
        }

        ctx.fillStyle = bgColor;
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1.5;

        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(boxX, y, boxWidth, optHeight, 12);
            ctx.fill();
            ctx.stroke();
        } else {
            ctx.fillRect(boxX, y, boxWidth, optHeight);
        }

        // Círculo da Letra
        ctx.fillStyle = badgeBg;
        ctx.beginPath();
        ctx.arc(boxX + 32, y + 32, 18, 0, Math.PI * 2);
        ctx.fill();

        // Letra A, B, C, D
        ctx.fillStyle = badgeTextColor;
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText(letrasOpcoes[i], boxX + 26, y + 38);

        // Texto da Opção
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText(opcao, boxX + 65, y + 38);
    });

    // 6. Desenha o Card da Explicação no Rodapé
    const expY = 530;
    const acertou = (respostaSelecionada === perguntaAtual.correta);
    let textoExplicacao = perguntaAtual.explicacao;
    if (!textoExplicacao) {
        textoExplicacao = acertou ? 
            'Parabéns! Você mandou super bem!' : 
            `A resposta correta era a alternativa ${letrasOpcoes[perguntaAtual.correta]}.`;
    }

    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.strokeStyle = acertou ? '#2ecc71' : '#e74c3c';
    ctx.lineWidth = 2;

    if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(boxX, expY, boxWidth, 140, 14);
        ctx.fill();
        ctx.stroke();
    } else {
        ctx.fillRect(boxX, expY, boxWidth, 140);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`${acertou ? '🎉 RESPOSTA CORRETA!' : '🙈 RESPOSTA INCORRETA!'}`, boxX + 20, expY + 35);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '16px sans-serif';
    quebrarTexto(ctx, textoExplicacao, boxX + 20, expY + 70, boxWidth - 40, 22);

    // Exporta imagem final
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    
    // Atualiza imagem na tela de agradecimento
    const imgDestino = document.getElementById('captured-photo');
    if (imgDestino) imgDestino.src = dataUrl;

    mostrarTela('screen-thanks');

    // Download automático do card em segundo plano
    const timestamp = Date.now();
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `quiz_noivos_${timestamp}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Retorna ao descanso após 8 segundos
    setTimeout(() => {
        voltarParaSlideShow();
    }, 8000);
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
