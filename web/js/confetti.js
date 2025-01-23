let canvas
if (window.screen.width <= 600) {
  canvas = document.getElementsByClassName('confetti')[1];
} else {
  canvas = document.getElementsByClassName('confetti')[0];  
}
canvas.confetti = canvas.confetti || confetti.create(canvas, {
  resize: true
});
 
window.fireConfetti = () => {
  canvas.confetti({
    angle: 60,
    spread: 70, //getSpread(),
    particleCount: 40, //getParticleCount(),
    startVelocity: 20,
    colors: [
      '#FFFFFF',
      '#903FE1',
      '#6736DB',
      '#DD65E7',
      '#E386EA',
      '#241682',
      '#DC56E2',
      '#EFC0F3',
    ],
    origin: {
      x: 0.11,
      y: 0.45,
    }
  })
}