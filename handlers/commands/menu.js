import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import konfigurasi from "../../config/settings.js"

// Fungsi untuk mendapatkan waktu saat ini
function getTimeGreeting() {
    const hour = new Date().getHours()
    if (hour < 12) return "🌅 Selamat pagi!"
    if (hour < 18) return "🌤️ Selamat siang!"
    return "🌙 Selamat malam!"
}

// Fungsi untuk mendapatkan tanggal hari ini dalam format rapi
function getCurrentDate() {
    const date = new Date()
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
    return date.toLocaleDateString('id-ID', options)
}

// Fungsi untuk menghitung countdown ke Ramadhan 2025
function getRamadhanCountdown() {
    const targetDate = new Date("2025-03-01") // Ganti dengan tanggal awal Ramadhan 2025
    const today = new Date()
    const diffTime = targetDate - today
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (daysLeft > 0) {
        return `🕌 *Ramadhan 2025* akan tiba dalam *${daysLeft} hari*! 🌙`
    } else {
        return "🌙 *Selamat menjalankan ibadah Ramadhan!* 🕌"
    }
}

// Fungsi untuk membaca semua command dari folder `commands`
async function getCommands() {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)

    const commandsDir = path.join(__dirname)
    const files = fs.readdirSync(commandsDir).filter(file => file.endsWith('.js'))

    const commands = []
    
    for (const file of files) {
        const { default: command } = await import(`file://${path.join(commandsDir, file)}`)
        if (command.name) {
            commands.push({
                name: command.name,
                description: command.description || '🔹 Tidak ada deskripsi',
                categories: command.categories || '❓ Lainnya'
            })
        }
    }

    return commands
}

// Handler Menu
export default {
    name: 'menu',
    description: 'Menampilkan semua fitur bot',
    categories: 'ℹ️ Informasi',
    execute: async (conn, jid, message) => {
        const commands = await getCommands()
        const greeting = getTimeGreeting()
        const todayDate = getCurrentDate()
        const ramadhanCountdown = getRamadhanCountdown()

        // Mengelompokkan per kategori
        const categories = {}
        commands.forEach(cmd => {
            if (!categories[cmd.categories]) {
                categories[cmd.categories] = []
            }
            categories[cmd.categories].push(`• *${cmd.name}* - ${cmd.description}`)
        })

        // Membuat pesan menu
        let menuText = `${greeting}\n`
        menuText += `📅 *Hari ini:* ${todayDate}\n`
        menuText += `${ramadhanCountdown}\n\n`
        menuText += `✨ *${global.botName || 'Bot WhatsApp'}* ✨\n`
        menuText += `🤖 *Total Fitur:* ${commands.length}\n`
        menuText += `👤 *Owner:* ${global.adminName  || 'Tidak diketahui'}\n`
        menuText += `\n📜 *Daftar Fitur:*\n\n`
        
        for (const [category, cmds] of Object.entries(categories)) {
            menuText += `📌 *${category}*\n` + cmds.join("\n") + "\n\n"
        }
        
        menuText += "⚡ *Gunakan perintah dengan prefix yang sesuai!* ⚡\n"

        await conn.sendMessage(jid, { text: menuText })
    }
}
