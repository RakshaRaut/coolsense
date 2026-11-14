import puppeteer from 'puppeteer-core'
import fs from 'node:fs/promises'

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5173'
const OUT = process.env.OUT_DIR ?? '/tmp/coolshots'
const paths = (process.env.PATHS ?? '/dashboard').split(',')
const width = Number(process.env.WIDTH ?? 1440)
const height = Number(process.env.HEIGHT ?? 1000)
const dark = (process.env.THEME ?? 'dark') === 'dark'

await fs.mkdir(OUT, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-device-scale-factor=1'],
})

const page = await browser.newPage()
const errors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text())
})
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
await page.setViewport({ width, height, deviceScaleFactor: 1 })

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' })
await page.evaluate((theme) => {
  const user = {
    id: 'usr-preview',
    name: 'Ada Lovelace',
    email: 'ada@coolsense.io',
    role: 'owner',
    createdAt: new Date().toISOString(),
  }
  localStorage.setItem(
    'coolsense:v1:session',
    JSON.stringify({
      accessToken: 'preview-token',
      user,
      expiresAt: Date.now() + 12 * 3600 * 1000,
    }),
  )
  localStorage.setItem('coolsense:v1:settings', JSON.stringify({ theme }))
}, dark ? 'dark' : 'light')

for (const path of paths) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 2200))
  const name = path.replace(/\//g, '_') || '_root'
  await page.screenshot({ path: `${OUT}/${name || 'root'}.png`, fullPage: true })
  console.log('captured', path)
}

console.log(errors.length ? `CONSOLE ERRORS:\n${errors.join('\n')}` : 'no console errors')
await browser.close()
