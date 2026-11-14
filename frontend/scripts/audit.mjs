import puppeteer from 'puppeteer-core'

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5173'
const paths = (process.env.PATHS ?? '/dashboard').split(',')
const widths = (process.env.WIDTHS ?? '1440,1024,768,390').split(',').map(Number)
const theme = process.env.THEME ?? 'dark'

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
const page = await browser.newPage()
const errors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text().slice(0, 300))
})
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))

await page.setViewport({ width: 1440, height: 1000 })
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' })
await page.evaluate((t) => {
  localStorage.setItem(
    'coolsense:v1:session',
    JSON.stringify({
      accessToken: 'preview-token',
      user: {
        id: 'usr-preview',
        name: 'Ada Lovelace',
        email: 'ada@coolsense.io',
        role: 'owner',
        createdAt: new Date().toISOString(),
      },
      expiresAt: Date.now() + 12 * 3600 * 1000,
    }),
  )
  localStorage.setItem('coolsense:v1:settings', JSON.stringify({ theme: t }))
}, theme)

for (const path of paths) {
  for (const width of widths) {
    await page.setViewport({ width, height: 1000 })
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle2' })
    await new Promise((r) => setTimeout(r, 1500))

    const report = await page.evaluate(() => {
      const doc = document.documentElement
      const wide = [...document.querySelectorAll('body *')]
        .filter((el) => {
          const rect = el.getBoundingClientRect()
          return rect.width > 0 && rect.right > window.innerWidth + 2
        })
        .slice(0, 5)
        .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 3).join('.')}`)
      return {
        overflowX: doc.scrollWidth - window.innerWidth,
        hasH1: Boolean(document.querySelector('h1')),
        wide,
        text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 180),
      }
    })

    const flag = report.overflowX > 2 || report.wide.length > 0 ? 'WARN' : 'ok'
    console.log(`${path} @${width}: ${flag} overflowX=${report.overflowX} h1=${report.hasH1} ${report.wide.join(' | ')}`)
  }
}

console.log(errors.length ? `CONSOLE ERRORS:\n${errors.join('\n')}` : 'no console errors')
await browser.close()
