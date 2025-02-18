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
// Di file utama atau handler
import { jidDecode } from '@whiskeysockets/baileys';
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

    store.bind(sock.ev)
    sock.ev.on('creds.update', saveCreds)
    return sock
}


