import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Dapatkan __dirname di ES Modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load semua command dari folder commands
const commands = {}
const commandsPath = path.join(__dirname, 'commands') // Path relatif
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'))

for (const file of commandFiles) {
    const command = await import(`./commands/${file}`) // Path relatif
    commands[command.default.name] = command.default
}

// messageHandler.js
import { smsg } from '../lib/func.js';
import { jidDecode } from '@whiskeysockets/baileys';

export function messageHandler(conn) {
  return async (m) => {
    try {
      // Proses pesan menggunakan smsg dengan conn yang sudah memiliki decodeJid
      const message = smsg(conn, m.messages[0], conn.store);

      if (!message.message) return;
        console.log(message)
      

        const text = message.body || ''
        const jid = message.key.remoteJid
        console.log(text)
        // Cek apakah pesan adalah command
        if (text.startsWith('!')) {
            const commandName = text.split(' ')[0].slice(1) // Hilangkan tanda '!'
            const command = commands[commandName]

            if (command) {
                await command.execute(sock, jid, message)
            } else {
                await sock.sendMessage(jid, { text: 'Command tidak ditemukan!' })
            }
        }

      // ... (logika handling pesan tetap sama)
    } catch (error) {
      console.error("Error handling message:", error);
    }
  };
}