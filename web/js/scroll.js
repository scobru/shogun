window.onscroll = () => onScrollFn();

let debounced = false;

function onScrollFn() {
  window.addHeader();
  window.parallax();
  if ((window.innerHeight + window.scrollY) >= document.body.scrollHeight) {
    if (!debounced || (window.screen.width > 600)) {
      debounced = true;
      window.fireConfetti();
      setTimeout(() => { debounced = false }, 1000);
    }
  }
}