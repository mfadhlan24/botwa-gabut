
import  events from '../../lib/eval.js' 
export default {
    name: '>',
    description: 'Menjalankan PErintah',
    categories: `Utilitys`,
    execute: async (conn, jid, message, text, { isAdmin }) => { // Ganti sock dengan conn
  
      events(message,text,isAdmin)

    }
}
