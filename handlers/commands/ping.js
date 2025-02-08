export default {
    name: 'ping', // Nama command
    description: 'Balas dengan Pong!', // Deskripsi command
    execute: async (sock, jid, message) => {
        await sock.sendMessage(jid, { text: 'Pong!' })
    }
}