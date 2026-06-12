/**
 * Cubot Embeddable Widget Script
 * Usage: <script src="https://your-domain.com/embed.js" data-cubot-url="https://your-domain.com" async></script>
 *
 * Optional attributes:
 *   data-cubot-url   — base URL of your Cubot deployment (default: auto-detected)
 *   data-position    — "bottom-right" | "bottom-left"  (default: "bottom-right")
 *   data-theme       — "dark" | "light"  (default: "dark")
 */
;(function () {
  if (typeof window === 'undefined') return
  if (document.getElementById('cubot-widget-iframe')) return // prevent double init

  const script = document.currentScript || document.querySelector('script[data-cubot-url]')
  const BASE_URL = (script && script.getAttribute('data-cubot-url')) || window.location.origin
  const POSITION = (script && script.getAttribute('data-position')) || 'bottom-right'

  // ── FAB button ──────────────────────────────────────────────────
  const fab = document.createElement('button')
  fab.id = 'cubot-fab'
  fab.setAttribute('aria-label', 'Open Cubot AI Chat')
  fab.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  `
  Object.assign(fab.style, {
    position: 'fixed',
    bottom: '24px',
    [POSITION === 'bottom-left' ? 'left' : 'right']: '24px',
    zIndex: '999998',
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #c9a227, #e8bc3a)',
    color: '#080d1a',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 24px rgba(201,162,39,0.5)',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  })
  fab.addEventListener('mouseover', () => { fab.style.transform = 'scale(1.1)' })
  fab.addEventListener('mouseout', () => { fab.style.transform = 'scale(1)' })

  // ── Iframe container ─────────────────────────────────────────────
  const container = document.createElement('div')
  container.id = 'cubot-widget-container'
  Object.assign(container.style, {
    position: 'fixed',
    bottom: '96px',
    [POSITION === 'bottom-left' ? 'left' : 'right']: '24px',
    zIndex: '999999',
    width: '380px',
    height: '580px',
    borderRadius: '20px',
    overflow: 'hidden',
    boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(201,162,39,0.2)',
    display: 'none',
    opacity: '0',
    transform: 'translateY(16px) scale(0.97)',
    transition: 'opacity 0.25s ease, transform 0.25s ease',
  })

  const iframe = document.createElement('iframe')
  iframe.id = 'cubot-widget-iframe'
  iframe.src = BASE_URL + '/widget'
  iframe.title = 'Cubot AI Chat'
  iframe.setAttribute('allow', 'microphone')
  Object.assign(iframe.style, {
    width: '100%',
    height: '100%',
    border: 'none',
    borderRadius: '20px',
  })

  container.appendChild(iframe)

  // ── Toggle logic ─────────────────────────────────────────────────
  let isOpen = false
  fab.addEventListener('click', () => {
    isOpen = !isOpen
    if (isOpen) {
      container.style.display = 'block'
      requestAnimationFrame(() => {
        container.style.opacity = '1'
        container.style.transform = 'translateY(0) scale(1)'
      })
      fab.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      `
    } else {
      container.style.opacity = '0'
      container.style.transform = 'translateY(16px) scale(0.97)'
      setTimeout(() => { container.style.display = 'none' }, 250)
      fab.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      `
    }
  })

  document.body.appendChild(container)
  document.body.appendChild(fab)
})()
