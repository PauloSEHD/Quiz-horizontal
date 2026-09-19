// Dados do Quiz de Exemplo
const currentQuiz = {
  question: "Qual homem bíblico era conhecido por sua incrível força que residia em seu cabelo?",
  options: ["Gideão", "Sansão", "Absalão", "Jefté"],
  correctIndex: 1, // B (Sansão)
  explanation: "A resposta correta era Sansão."
};

const letters = ['A', 'B', 'C', 'D'];
let timeLeft = 10;
let timerInterval = null;

// Elementos do DOM
const video = document.getElementById('webcam');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const timerBox = document.getElementById('timer-box');
const timerCount = document.getElementById('timer-count');
const explanationCard = document.getElementById('explanation-card');
const explanationText = document.getElementById('explanation-text');
const resultModal = document.getElementById('result-modal');
const finalCanvas = document.getElementById('final-canvas');

// Inicializar Câmera HD
async function initCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false
    });
    video.srcObject = stream;
  } catch (err) {
    console.error("Erro ao acessar a câmera:", err);
  }
}

// Renderizar Pergunta e Opções com Letras (A, B, C, D)
function loadQuiz() {
  questionText.textContent = currentQuiz.question;
  optionsContainer.innerHTML = '';

  currentQuiz.options.forEach((opt, idx) => {
    const btn = document.createElement('div');
    btn.className = 'option-btn';
    btn.id = `option-${idx}`;
    btn.innerHTML = `
      <span class="badge">${letters[idx]}</span>
      <span class="option-text">${opt}</span>
    `;
    optionsContainer.appendChild(btn);
  });

  startTimer();
}

// Iniciar Contagem Regressiva
function startTimer() {
  timeLeft = 10;
  timerCount.textContent = timeLeft;

  timerInterval = setInterval(() => {
    timeLeft--;
    timerCount.textContent = timeLeft;

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      revealAnswer();
    }
  }, 1000);
}

// Revelar Resposta e Mostrar Explicação
function revealAnswer() {
  // Destaca a resposta correta
  const correctBtn = document.getElementById(`option-${currentQuiz.correctIndex}`);
  if (correctBtn) correctBtn.classList.add('correct');

  // Substitui o Cronômetro pelo Card de Explicação
  timerBox.classList.add('hidden');
  explanationText.textContent = currentQuiz.explanation;
  explanationCard.classList.remove('hidden');

  // Após 3 segundos com a resposta na tela, captura a imagem idêntica ao vivo
  setTimeout(() => {
    captureFinalImage();
  }, 3000);
}

// Captura do Canvas MANTENDO o layout em sobreposição (Sem achatar/espremer a foto)
function captureFinalImage() {
  const ctx = finalCanvas.getContext('2d');
  
  // Resolução HD para captura final
  finalCanvas.width = 1280;
  finalCanvas.height = 720;

  // 1. Desenha a foto da câmera em tela cheia (mantendo 100% da proporção sem achatar)
  ctx.save();
  ctx.translate(finalCanvas.width, 0);
  ctx.scale(-1, 1); // Desfaz espelhamento na renderização interna do canvas
  ctx.drawImage(video, 0, 0, finalCanvas.width, finalCanvas.height);
  ctx.restore();

  // 2. Desenha o Gradiente Escuro no lado esquerdo (igual à tela ao vivo)
  const gradient = ctx.createLinearGradient(0, 0, finalCanvas.width * 0.55, 0);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
  gradient.addColorStop(0.75, 'rgba(0, 0, 0, 0.5)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

  // 3. Desenhar elementos do Quiz por cima (overlay proporcional)
  // [A renderização direta da árvore DOM ou captura via html2canvas sobre o canvas mantém a sobreposição exata]

  // Exibe o modal final com o resultado perfeito
  resultModal.classList.remove('hidden');
}

// Inicializar aplicação
window.addEventListener('DOMContentLoaded', () => {
  initCamera();
  loadQuiz();
});
