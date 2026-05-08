const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const sizes = [72, 96, 128, 144, 152, 192, 384, 512]
const inputIcon = path.join(__dirname, '../public/dtb-logo.png')
const outputDir = path.join(__dirname, '../public/icons')

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

async function generateIcons() {
  for (const size of sizes) {
    await sharp(inputIcon)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 26, g: 26, b: 26, alpha: 1 },
      })
      .png()
      .toFile(path.join(outputDir, `icon-${size}x${size}.png`))
    console.log(`Generated ${size}x${size}`)
  }

  await sharp(inputIcon)
    .resize(180, 180, {
      fit: 'contain',
      background: { r: 26, g: 26, b: 26, alpha: 1 },
    })
    .png()
    .toFile(path.join(__dirname, '../public/apple-touch-icon.png'))
  console.log('Generated apple-touch-icon 180x180')

  await sharp(inputIcon).resize(32, 32).png().toFile(path.join(__dirname, '../public/favicon-32x32.png'))
  await sharp(inputIcon).resize(16, 16).png().toFile(path.join(__dirname, '../public/favicon-16x16.png'))
  console.log('Generated favicons')

  console.log('All icons generated!')
}

generateIcons().catch(console.error)
