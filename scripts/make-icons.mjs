// Génère les icônes PNG de l'app (anneau de budget sur fond noir) sans dépendance.
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const c = Buffer.alloc(4)
  c.writeUInt32BE(crc(td))
  return Buffer.concat([len, td, c])
}

function png(size) {
  const SS = 4 // suréchantillonnage pour l'anticrénelage
  const cx = size / 2
  const rOuter = size * 0.3
  const rInner = size * 0.22
  const rows = []
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3)
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS - cx
          const py = y + (sy + 0.5) / SS - cx
          const d = Math.hypot(px, py)
          let col = [0, 0, 0]
          if (d >= rInner && d <= rOuter) {
            // angle depuis midi, sens horaire
            const a = (Math.atan2(px, -py) + 2 * Math.PI) % (2 * Math.PI)
            col = a <= Math.PI * 1.45 ? [255, 255, 255] : [58, 58, 60]
          }
          r += col[0]; g += col[1]; b += col[2]
        }
      const n = SS * SS
      row[1 + x * 3] = r / n
      row[2 + x * 3] = g / n
      row[3 + x * 3] = b / n
    }
    rows.push(row)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // profondeur
  ihdr[9] = 2 // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const [name, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  writeFileSync(new URL(`../public/${name}`, import.meta.url), png(size))
}
console.log('icônes générées dans public/')
