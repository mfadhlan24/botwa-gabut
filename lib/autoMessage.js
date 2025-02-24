import fs from 'fs'
import path from 'path'

const DATA_FILE = path.join(process.cwd(), 'data', '../session/users_mess.json')

// Pastikan folder & file data ada
if (!fs.existsSync('data')) fs.mkdirSync('data')
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({}), 'utf-8')

// Fungsi untuk membaca data pengguna dari file
function readUserData() {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
}

// Fungsi untuk menyimpan data pengguna ke file
function writeUserData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

// Fungsi untuk mengecek apakah pengguna sudah menerima pesan dalam periode tertentu
function shouldSendMessage(userId, intervalHours) {
    let users = readUserData()
    let now = Date.now()

    if (!users[userId] || (now - users[userId]) > intervalHours * 60 * 60 * 1000) {
        users[userId] = now
        writeUserData(users)
        return true
    }
    return false
}

// Fungsi untuk mengirim pesan otomatis
export async function autoMessage(conn, jid,m) {
    if (shouldSendMessage(jid, 6)) {  // Kirim pesan otomatis setiap 6 jam
        await conn.sendMessage(jid, { text: "📢 Jangan lupa cek menu terbaru! Ketik *#menu* untuk melihat fitur-fitur bot." })
    }
}

// Fungsi untuk mengirim pesan pertama kali user chat bot
export async function firstTimeMessage(conn, jid,m) {
    let users = readUserData()
    
    if (!users[jid]) {
        users[jid] = Date.now()  // Tandai user sudah menerima pesan pertama
        writeUserData(users)
        await conn.sendMessage(jid, { text: `👋 Halo! @${m.sender.split("@")[0]} Selamat datang di *Bot WhatsApp*.\nKetik *#menu* untuk melihat daftar fitur.` , mentions: [m.sender]})
    }
}
