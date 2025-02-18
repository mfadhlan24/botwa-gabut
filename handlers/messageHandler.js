// handlers/messageHandler.js
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import chalk from 'chalk';


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


const chatLogs = [];

function logMessage(fromMe, sender, text,pushname) {
  if(!(!!text)) return
  chatLogs.push({
      Pengirim: fromMe ? "BOT" : `${sender.split("@")[0]} | ${pushname}`, // Tanpa warna untuk tabel
      "Dari Bot?": fromMe ? "✔" : "✖", 
      "Isi Pesan": text
  });

  console.clear(); // Bersihkan terminal
  console.table(chatLogs); // Tampilkan tabel tanpa warna

  // Tambahkan log berwarna untuk tampilan biasa
  console.log(
      `${chalk.green("[LOG]")} Pengirim: ${fromMe ? chalk.green("BOT") : chalk.blue(sender.split("@")[0])}, ` +
      `Dari Bot? ${fromMe ? chalk.green("✔") : chalk.red("✖")}, ` +
      `Pesan: ${chalk.yellow(text)}`
  );
}

export function messageHandler(conn) {
  return async (msg) => {
    try {
      // Proses pesan menggunakan smsg dengan conn yang sudah memiliki decodeJid
     if(msg.messages[0].broadcast) return;// mencegah bot membaca sw
      const message = smsg(conn, msg.messages[0], conn.store);
      const m = message
      if (!message.message) return;
      // const m = message
    
      var body = 
      m.mtype === "conversation" ? m.message.conversation :
      m.mtype === "imageMessage" ? m.message.imageMessage.caption :
      m.mtype === "videoMessage" ? m.message.videoMessage.caption :
      m.mtype === "extendedTextMessage" ? m.message.extendedTextMessage.text :
      m.mtype === "buttonsResponseMessage" ? m.message.buttonsResponseMessage.selectedButtonId :
      m.mtype === "listResponseMessage" ? m.message.listResponseMessage.singleSelectReply.selectedRowId :
      m.mtype === "InteractiveResponseMessage" ? JSON.parse(m.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson)?.id :
      m.mtype === "templateButtonReplyMessage" ? m.message.templateButtonReplyMessage.selectedId :
      m.mtype === "messageContextInfo" ? 
          m.message.buttonsResponseMessage?.selectedButtonId ||
          m.message.listResponseMessage?.singleSelectReply.selectedRowId ||
          m.message.InteractiveResponseMessage?.NativeFlowResponseMessage ||
          m.text :
      m.mtype === "ephemeralMessage" ? m.message?.ephemeralMessage?.message?.extendedTextMessage?.text :
      "";
  
  var text = typeof body === "string" ? body : "";

  
  logMessage(m.key.fromMe, m.key.remoteJid,text,m.pushName);
 

        const jid = message.key.remoteJid
      
        // Cek apakah pesan adalah command
        if(text.includes("@6287834761210") && !m.fromMe) {
          await conn.sendMessage(m.chat, { text: 'Haloo kak Ada Apa Tag Aku!' }, { quoted: m})
        }
        if (text.startsWith('!')) {
            const commandName = text.split(' ')[0].slice(1) // Hilangkan tanda '!'
            const command = commands[commandName]

            if (command) {
              await command.execute(conn, jid, message) // Ganti sock dengan conn
          } else {
              await conn.sendMessage(jid, { text: 'Command tidak ditemukan!' }) // Ganti sock dengan conn
          }
          
        }

     
    } catch (error) {
      console.error("Error handling message:", error);
    }
  };
}