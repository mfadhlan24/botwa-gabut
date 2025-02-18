export default {
    name: '@6287834761210',
    description: 'Muhamad Fadhlan',
    execute: async (conn, jid, message) => { // Ganti sock dengan conn
        await conn.sendMessage(jid, { text: 'Haloo Kak!' })
    }
}
