import fs from 'fs'
import question from './utils/question.js'
import { connectToWhatsApp } from './connection.js'
import { messageHandler } from './handlers/messageHandler.js'

// Fungsi untuk memuat atau membuat file konfigurasi
async function loadOrCreateConfig(filePath, defaultData = { password: ""} ) {
    const cekFile = JSON.parse(fs.readFileSync(filePath)).password;
   
    
    if (!fs.existsSync(filePath) || cekFile == "") {
        console.log(`File ${filePath} tidak ditemukan. Mari buat baru...`)
        fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2))
        console.log(`File ${filePath} berhasil dibuat!`)
    }
    return JSON.parse(fs.readFileSync(filePath))
}

// Fungsi untuk memuat atau membuat password.json
async function loadOrCreatePassword() {
   const  currentPassword = await loadOrCreateConfig('./config/password.json');
   
   const defaultPassword = { password: currentPassword["password"] == "" ?  await question('Masukkan password baru: ') : currentPassword["password"] }

    return await loadOrCreateConfig('./config/password.json', defaultPassword)
}

// Fungsi untuk memuat atau membuat users.json
async function loadOrCreateUsers() {
    const filePath = fs.existsSync('./config/users.json');
    // !! Untuk menjadikan Boolean
    const isFoundOwner = !!JSON.parse(fs.readFileSync('./config/users.json'))["owner"]
 
    const defaultUsers = filePath && !isFoundOwner ? {
        owner: {
            name: await question('Masukkan nama owner: '),
            number: await question('Masukkan nomor WhatsApp owner (contoh: 6281234567890): ')
        },
        bot: {
            phoneNumber: await question('Masukkan nomor WhatsApp bot (contoh: 6281234567890): ')
        },
        settings: {
            anticall: false
        }
    } : false
   
    const data =  await loadOrCreateConfig('./config/users.json', defaultUsers) ;
    return data;
}

async function init() {
    // Muat atau buat password.json
    const passwordConfig = await loadOrCreatePassword()
 
    // Authentication logic
    if (!fs.existsSync("./auth") && passwordConfig.password !== "") {
        let retries = 3
        while (retries > 0) {
            const password = await question("Masukan Password: ")
            if (password !== passwordConfig.password) {
                console.log(`Password salah! Sisa percobaan: ${--retries}`)
                if (retries === 0) process.exit()
            } else break
        }
    }

    // Muat atau buat users.json
    global.setting = await loadOrCreateUsers()

    // Connect to WhatsApp
    const sock = await connectToWhatsApp()
    
    // Setup message handler
    sock.ev.on('messages.upsert', messageHandler(sock))
}

init().catch(err => {
    console.error('Error starting bot:', err)
    process.exit(1)
})