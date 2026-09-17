let perguntas = [];
let perguntasSorteadas = [];
let perguntaAtualIndex = 0;
let tempoRestante = 20;
let timerInterval = null;
let photoInterval = null;
let jogoAtivo = false;

// Gravação & Foto
let mediaRecorder = null;
let recordedChunks = [];
let fotoCapturadaDataUrl = '';

const galeriaFotos = ['assets/img/foto1.jpg', 'assets/img/foto2.jpg'];

// Seletores DOM
const screenIntro = document.getElementById('screen-intro');
const screenCountdown = document.getElementById('screen-countdown');
const screenGame = document.getElementById('screen-game');
const screenThanks = document.getElementById('screen-thanks');

const btnStart = document.getElementById('btn-start');
const countdownNumber = document.getElementById('countdown-number');
const webcamElement = document.getElementById('webcam');
const cameraOverlay = document.getElementById('camera-overlay');
const photoCanvas = document.getElementById('photo-canvas');
const capturedPhotoImg = document.getElementById('captured-photo');

const timerBadge = document.getElementById('timer-badge');
const timerElement = document.getElementById('timer');
const questionText = document.getElementById('question-text');
const optionButtons = [
  document.getElementById('btn-0'),
  document.getElementById('btn-1'),
  document.getElementById('btn-2'),
  document.getElementById('btn-3')
];

const feedbackBanner = document.getElementById('feedback-banner');
const feedbackEmoji = document.getElementById('feedback-emoji');
const feedbackText = document.getElementById('feedback-text');

// Inicializar Câmera no Fundo
async function inicializarCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    webcamElement.srcObject = stream;
  } catch (erro) {
    console.error("Erro de acesso à câmera/microfone:", erro);
  }
}

// Controle da Gravação
function iniciarGravacao() {
  const stream = webcamElement.srcObject;
  if (!stream) return;

  recordedChunks = [];
  mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };

  mediaRecorder.onstop = salvarMidiaLocal;
  mediaRecorder.start();
}

function pararGravacao() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
}

// Tirar Snapshot da Foto (1s após o resultado)
function tirarFotoReacao() {
  const context = photoCanvas.getContext('2d');
  photoCanvas.width = webcamElement.videoWidth || 640;
  photoCanvas.height = webcamElement.videoHeight || 480;

  context.drawImage(webcamElement, 0, 0, photoCanvas.width, photoCanvas.height);
  fotoCapturadaDataUrl = photoCanvas.toDataURL('image/jpeg', 0.85);
  capturedPhotoImg.src = fotoCapturadaDataUrl;
}

// Download Automático do Vídeo e da Foto
function salvarMidiaLocal() {
  const timestamp = Date.now();

  // 1. Download do Vídeo
  const blobVideo = new Blob(recordedChunks, { type: 'video/webm' });
  const urlVideo = URL.createObjectURL(blobVideo);
  const aVideo = document.createElement('a');
  aVideo.href = urlVideo;
  aVideo.download = `quiz_video_${timestamp}.webm`;
  aVideo.click();

  // 2. Download da Foto
  if (fotoCapturadaDataUrl) {
    const aFoto = document.createElement('a');
    aFoto.href = fotoCapturadaDataUrl;
    aFoto.download = `quiz_foto_${timestamp}.jpg`;
    aFoto.click();
  }
}

// Carregar JSON
async function carregarPerguntas() {
  try {
    let resp = await fetch('perguntas.json');
    if (!resp.ok) resp = await fetch('Perguntas.json');
    perguntas = await resp.json();
  } catch (err) {
    console.error(err);
  }
}

// Início do Fluxo
function iniciarFluxoJogo() {
  if (perguntas.length === 0) return;

  screenIntro.classList.remove('active');
  screenCountdown.classList.add('active');

  // Exibir câmera e overlay
  webcamElement.classList.add('active');
  cameraOverlay.classList.remove('hidden');

  iniciarGravacao();
  executarContagemRegressiva();
}

function executarContagemRegressiva() {
  let contador = 3;
  countdownNumber.innerText = contador;

  const interval = setInterval(() => {
    contador--;
    if (contador > 0) {
      countdownNumber.innerText = contador;
    } else {
      clearInterval(interval);
      screenCountdown.classList.remove('active');
      screenGame.classList.add('active');
      
      perguntasSorteadas = [...perguntas].sort(() => Math.random() - 0.5);
      perguntaAtualIndex = 0;
      jogoAtivo = true;
      exibirPergunta();
    }
  }, 1000);
}

function exibirPergunta() {
  // Reset do rodapé (Mostra Timer, Oculta Feedback)
  feedbackBanner.classList.add('hidden');
  timerBadge.style.display = 'flex';

  optionButtons.forEach(btn => btn.classList.remove('correta', 'incorreta'));

  const q = perguntasSorteadas[perguntaAtualIndex];
  questionText.innerText = q.pergunta;

  q.opcoes.forEach((op, idx) => {
    optionButtons[idx].querySelector('.opt-text').innerText = op;
  });

  iniciarTimer();
}

function iniciarTimer() {
  clearInterval(timerInterval);
  tempoRestante = 20;
  timerElement.innerText = tempoRestante;

  timerInterval = setInterval(() => {
    tempoRestante--;
    timerElement.innerText = tempoRestante;

    if (tempoRestante <= 0) {
      clearInterval(timerInterval);
      processarResultado(false, "TEMPO ESGOTADO! ⏱️");
    }
  }, 1000);
}

function verificarResposta(indice) {
  if (!jogoAtivo) return;
  clearInterval(timerInterval);

  const q = perguntasSorteadas[perguntaAtualIndex];
  const acertou = indice === q.correta;

  if (acertou) {
    optionButtons[indice].classList.add('correta');
  } else {
    optionButtons[indice].classList.add('incorreta');
    optionButtons[q.correta].classList.add('correta');
  }

  processarResultado(acertou, acertou ? "RESPOSTA CORRETA!" : "RESPOSTA INCORRETA!");
}

function processarResultado(sucesso, mensagem) {
  jogoAtivo = false;

  // Substitui Timer por Feedback no Rodapé
  timerBadge.style.display = 'none';
  feedbackBanner.className = `feedback-banner ${sucesso ? 'sucesso' : 'erro'}`;
  feedbackEmoji.innerText = sucesso ? '🎉' : '❌';
  feedbackText.innerText = mensagem;
  feedbackBanner.classList.remove('hidden');

  // Tirar foto do convidado exatamente 1 segundo após o resultado
  setTimeout(() => {
    tirarFotoReacao();
  }, 2000);

  // Aguarda 3.5 segundos e encerra a rodada
  setTimeout(() => {
    finalizarRodada();
  }, 3500);
}

function finalizarRodada() {
  pararGravacao();

  screenGame.classList.remove('active');
  screenThanks.classList.add('active');

  // Exibe foto e mensagem por 4 segundos antes de voltar ao descanso
  setTimeout(() => {
    screenThanks.classList.remove('active');
    webcamElement.classList.remove('active');
    cameraOverlay.classList.add('hidden');
    screenIntro.classList.add('active');
  }, 7000);
}

// Eventos
btnStart.addEventListener('click', iniciarFluxoJogo);
optionButtons.forEach((btn, idx) => {
  btn.addEventListener('click', () => verificarResposta(idx));
});

document.addEventListener('DOMContentLoaded', () => {
  inicializarCamera();
  carregarPerguntas();
});
