export default {
    name: 'ping',
    description: 'Balas dengan Pong!',
    execute: async (conn, jid, message) => { // Ganti sock dengan conn
        await conn.sendMessage(jid, { text: 'Pong!' })
    }
}
