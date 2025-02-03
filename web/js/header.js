const header = document.getElementById('header')
const stickyHeader = document.getElementById('stickyHeader')
const sticky = Math.max(document.documentElement.clientHeight, window.innerHeight || 0) * 0.70

window.addHeader = () => {
  if (window.pageYOffset > sticky) {
    stickyHeader.classList.add('show')
  } else {
    stickyHeader.classList.remove('show')
  }
}
