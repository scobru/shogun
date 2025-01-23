const INC = 0.15;

const parallaxElement = document.getElementById('parallax');

let lastScroll = 0;
let translate = 0;

window.parallax = () => {
  let s = window.pageYOffset || document.documentElement.scrollTop
  const delta = s - lastScroll
  translate -= (INC * delta)
  parallaxElement.style.transform = `translateY(${translate}px)`
  lastScroll = Math.max(0, s);
}