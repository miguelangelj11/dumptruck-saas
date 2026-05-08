const sharp = require('sharp')
const path = require('path')
const fs = require('fs')

const splashSizes = [
  { width: 640,  height: 1136, name: 'splash-640x1136'   },
  { width: 750,  height: 1334, name: 'splash-750x1334'   },
  { width: 1170, height: 2532, name: 'splash-1170x2532'  },
  { width: 1284, height: 2778, name: 'splash-1284x2778'  },
  { width: 1536, height: 2048, name: 'splash-1536x2048'  },
  { width: 2048, height: 2732, name: 'splash-2048x2732'  },
]

const logoPath = path.join(__dirname, '../public/dtb-logo.png')
const outputDir = path.join(__dirname, '../public/splash')

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

async function generateSplash() {
  for (const size of splashSizes) {
    const logoSize = Math.floor(Math.min(size.width, size.height) * 0.3)

    const logoBuffer = await sharp(logoPath)
      .resize(logoSize, logoSize, {
        fit: 'contain',
        background: { r: 26, g: 26, b: 26, alpha: 1 },
      })
      .toBuffer()

    await sharp({
      create: {
        width: size.width,
        height: size.height,
        channels: 4,
        background: { r: 26, g: 26, b: 26, alpha: 1 },
      },
    })
      .composite([{ input: logoBuffer, gravity: 'center' }])
      .png()
      .toFile(path.join(outputDir, `${size.name}.png`))

    console.log(`Generated ${size.name}`)
  }
  console.log('All splash screens generated!')
}

generateSplash().catch(console.error)
