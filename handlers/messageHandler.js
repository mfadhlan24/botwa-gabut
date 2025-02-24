// handlers/messageHandler.js
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { smsg } from '../lib/func.js';
import logMessage from "../lib/loger.js";
import konfigurasi from "../config/settings.js"
import { firstTimeMessage, autoMessage} from "../lib/autoMessage.js"

Object.assign(global, konfigurasi);

// Dapatkan __dirname di ES Modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const commands = {}
const commandsPath = path.join(__dirname, 'commands') 
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'))

for (const file of commandFiles) {
    const command = await import(`./commands/${file}`)
    commands[command.default.name] = command.default
}

export function messageHandler(conn) {
  return async (msg) => {
    try {
      if (msg.messages[0].broadcast) return;
     
      const message = smsg(conn, msg.messages[0], conn.store);
      const m = message;
      if (!message.message) return;

      const userInfo = {
        isAdmin: [...global.admin]
          .map(v => v.replace(/[^0-9]/g, "") + "@s.whatsapp.net")
          .includes(m.sender),
          siUser: m.pushName,

      };

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

      var prefa = true;
      var prefix = prefa
        ? body.match(/^[°•π÷×¶∆£¢€¥®™+✓_|~!=?@#$%^&.©^]/)?.[0] || ""
        : "";

   

      const args = body.slice(prefix.length).trim().split(/ +/); // Ambil semua kata setelah prefix
      const perintah = args.shift()?.toLowerCase() || ""; // Ambil command pertama
      const teks = args.join('');
      message.command = perintah;

     

      const jid = message.key.remoteJid;
      await firstTimeMessage(conn, jid,m)  // Kirim pesan pertama kali user chat bot
      await autoMessage(conn, jid,m)  
      logMessage(m.key.fromMe, m.key.remoteJid, teks);
      // Cek apakah pesan adalah mention ke bot
      if (body.includes("@6287834761210") && !m.fromMe) {
        await conn.sendMessage(m.chat, { text: 'Haloo kak Ada Apa Tag Aku!' }, { quoted: m });
      }
      
      if (!prefix) return; // Jika tidak ada prefix, langsung return
      // Eksekusi command jika ditemukan
      if (commands[perintah]) {
        await commands[perintah].execute(conn, jid, message, teks, { ...userInfo });
      } else {
        await conn.sendMessage(jid, { text: 'Command tidak ditemukan!' });
      }
      
    } catch (error) {
      console.error("Error handling message:", error);
    }
  };
}
