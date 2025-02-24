import { 
    makeWASocket, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason,
    makeInMemoryStore,
    Browsers
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import question from './utils/question.js'
import NodeCache from "node-cache"
import fs from "fs"
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import _ from 'lodash';
import { jidDecode } from '@whiskeysockets/baileys';
const dbFile = 'src/database.json';

// **Buat defaultData sebelum inisialisasi LowDB**
const defaultData = {
    users: {},
    database: {},
    chats: {},
    game: {},
    settings: {},
    message: {}
};

// **Cek apakah file database sudah ada, jika tidak buat baru**
if (!fs.existsSync(dbFile)) {
    console.log('[Database] File database.json tidak ditemukan, membuat baru...');
    fs.writeFileSync(dbFile, JSON.stringify(defaultData, null, 2));
}

// **Inisialisasi LowDB setelah defaultData didefinisikan**
const adapter = new JSONFile(dbFile);
const db = new Low(adapter, defaultData); // Tambahkan defaultData di constructor

export async function loadDatabase() {
    await db.read();

    // **Cek apakah data kosong, jika iya isi dengan defaultData**
    if (!db.data || Object.keys(db.data).length === 0) {
        console.log('[Database] Database kosong, mengisi dengan data default...');
        db.data = defaultData;
        await db.write();
    }

    global.db = db;
    global.DATABASE = db;
    global.db.chain = _.chain(global.db.data);

    console.log('[Database] Database berhasil dimuat!');
}

// **Pastikan database dimuat sebelum digunakan**
await loadDatabase();
const store = makeInMemoryStore({ 
    logger: pino().child({ level: 'silent', stream: 'store' }) 
})

export async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth')
    const { version , isLatest } = await fetchLatestBaileysVersion()

    // Tanya apakah ingin menggunakan Pairing Code
    const usePairingCode =  fs.existsSync(".auth") ? await question('Ingin menggunakan Pairing Code? (Y/n): ') : "n"
    const usePairing = usePairingCode.toLowerCase() === 'y'
    const msgRetryCounterCache = new NodeCache(); 

    const sock = makeWASocket({
        version: isLatest ? version : [2, 2413, 1],
        logger: pino({ level: 'silent' }),
        printQRInTerminal: !usePairing, 
        syncFullHistory: true,
        msgRetryCounterCache,
        browser: Browsers.macOS('Chrome'),
        patchMessageBeforeSending: (message) => {
            const requiresPatch = !!(
              message.buttonsMessage ||
              message.templateMessage ||
              message.listMessage
            );
            if (requiresPatch) {
              message = {
                viewOnceMessage: {
                  message: {
                    messageContextInfo: {
                      deviceListMetadataVersion: 2,
                      deviceListMetadata: {},
                    },
                    ...message,
                  },
                },
              };
            }
            return message;
          },
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' })),
        },
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true,
        defaultQueryTimeoutMs: undefined, // for this issues https://github.com/WhiskeySockets/Baileys/issues/276
        getMessage: async (key) => {
            if (store) {
                const msg = await store.loadMessage(key.remoteJid, key.id)
                return msg?.message
            }
            return { conversation: 'Hello' }
        }
    })
    // Tambahkan method decodeJid ke objek conn
sock.decodeJid = (jid) => {
  if (!jid) return jid;
  if (/:\d+@/gi.test(jid)) {
    const decoded = jidDecode(jid) || {};
    return decoded.user && decoded.server 
      ? `${decoded.user}@${decoded.server}` 
      : jid;
  } else {
    return jid;
  }
};
    // Jika menggunakan Pairing Code
    if (usePairing && !sock.authState.creds.registered) {
        const phoneNumber = await question('Masukkan nomor WhatsApp Anda (contoh: 6281234567890): ')
        const formattedNumber = phoneNumber.replace(/[^0-9]/g, '')

        setTimeout(async () => {
            const pairingCode = await sock.requestPairingCode(formattedNumber)
            console.log(`Pairing Code Anda: ${pairingCode}`)
        }, 3000)
    }

    // Penanganan koneksi
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update

        if (connection === 'close') {
            const isBoomError = lastDisconnect?.error instanceof Boom
            const statusCode = isBoomError ? lastDisconnect.error.output.statusCode : null

            const shouldReconnect = statusCode !== DisconnectReason.loggedOut

            if (shouldReconnect) {
                console.log('Koneksi terputus, mencoba menghubungkan kembali...')
                connectToWhatsApp()
            } else {
                console.log('Koneksi terputus karena logout. Silakan scan ulang QR Code.')
                process.exit(1)
            }
        } else if (connection === 'open') {
            console.log('Bot berhasil terhubung!')
        }
    })
    // Penanganan Pesan
    
    store.bind(sock.ev)
    sock.ev.on('creds.update', saveCreds);

    // FUNC OWN
      //autostatus view
  sock.ev.on("messages.upsert", async (chatUpdate) => {
    if (true) {
     let mek = chatUpdate.messages[0];
      if (mek.key && mek.key.remoteJid === "status@broadcast") {
        await sock.readMessages([mek.key]);
      }
    }
  });
  // reply
  sock.sendText = (jid, text, quoted = "", options) =>
    sock.sendMessage(jid, { text: text, ...options }, { quoted });
    return sock
}


