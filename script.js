let perguntas = [];
let perguntasSorteadas = [];
let perguntaAtualIndex = 0;
let tempoRestante = 20;
let timerInterval = null;
let photoInterval = null;
let jogoAtivo = false;

// Variáveis de Gravação de Vídeo
let mediaRecorder = null;
let recordedChunks = [];

const galeriaFotos = [
  'assets/img/foto1.jpg',
  'assets/img/foto2.jpg'
];

// Seleção DOM
const screenIntro = document.getElementById('screen-intro');
const screenGame = document.getElementById('screen-game');

const btnStart = document.getElementById('btn-start');
const imgTop = document.getElementById('img-top');
const imgBottom = document.getElementById('img-bottom');

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
const webcamElement = document.getElementById('webcam');

// Iniciar Câmera (Preview Continuo)
async function iniciarCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    webcamElement.srcObject = stream;
  } catch (erro) {
    console.error("Erro na câmera:", erro);
  }
}

// Controle de Gravação
function iniciarGravacao() {
  const stream = webcamElement.srcObject;
  if (!stream) return;

  recordedChunks = [];
  mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) recordedChunks.push(event.data);
  };

  mediaRecorder.onstop = salvarVideoLocal;
  mediaRecorder.start();
}

function pararGravacao() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
}

function salvarVideoLocal() {
  const blob = new Blob(recordedChunks, { type: 'video/webm' });
  const url = URL.createObjectURL(blob);
  
  // Download automático do vídeo gravado do convidado
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = `quiz_convidado_${Date.now()}.webm`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

// Carregar Perguntas
async function carregarPerguntas() {
  try {
    let resposta = await fetch('perguntas.json');
    if (!resposta.ok) resposta = await fetch('Perguntas.json');
    perguntas = await resposta.json();
  } catch (erro) {
    console.error(erro);
  }
}

function iniciarJogo() {
  if (perguntas.length === 0) return;

  clearInterval(photoInterval);
  perguntasSorteadas = [...perguntas].sort(() => Math.random() - 0.5);
  perguntaAtualIndex = 0;
  jogoAtivo = true;

  screenIntro.classList.remove('active');
  screenGame.classList.add('active');

  iniciarGravacao();
  exibirPergunta();
}

function exibirPergunta() {
  ocultarFeedback();
  optionButtons.forEach(btn => btn.classList.remove('correta', 'incorreta'));

  const q = perguntasSorteadas[perguntaAtualIndex];
  questionText.innerText = q.pergunta;

  q.opcoes.forEach((opcao, i) => {
    optionButtons[i].querySelector('.opt-text').innerText = opcao;
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
      exibirFeedback(false, "TEMPO ESGOTADO! ⏱️");
      agendarProximaPergunta();
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
    exibirFeedback(true, "RESPOSTA CORRETA!");
  } else {
    optionButtons[indice].classList.add('incorreta');
    optionButtons[q.correta].classList.add('correta');
    exibirFeedback(false, "RESPOSTA INCORRETA!");
  }

  agendarProximaPergunta();
}

function exibirFeedback(sucesso, mensagem) {
  feedbackBanner.className = `feedback-banner ${sucesso ? 'sucesso' : 'erro'}`;
  feedbackEmoji.innerText = sucesso ? '🎉' : '❌';
  feedbackText.innerText = mensagem;
}

function ocultarFeedback() {
  feedbackBanner.classList.add('hidden');
}

function agendarProximaPergunta() {
  setTimeout(() => {
    perguntaAtualIndex++;

    if (perguntaAtualIndex < perguntasSorteadas.length) {
      exibirPergunta();
    } else {
      finalizarJogo();
    }
  }, 2500);
}

function finalizarJogo() {
  jogoAtivo = false;
  pararGravacao();

  screenGame.classList.remove('active');
  screenIntro.classList.add('active');
}

// Eventos
btnStart.addEventListener('click', iniciarJogo);
optionButtons.forEach((btn, index) => {
  btn.addEventListener('click', () => verificarResposta(index));
});

document.addEventListener('DOMContentLoaded', () => {
  iniciarCamera();
  carregarPerguntas();
});
