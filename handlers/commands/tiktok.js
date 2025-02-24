import axios from "axios";

export default {
    name: "tiktok",
    description: "Download video TikTok tanpa watermark",
    categories: `Downloader`,
    execute: async (conn, jid, m, text) => {
      if (!text) {
        return conn.sendMessage(jid, { text: "Mana link TikTok-nya?" });
      }
  
      await conn.sendMessage(jid, { text: "Tunggu sebentar ya..." });
  
      try {
        let { data: result } = await axios.post('http://kinchan.sytes.net/tiktok/downloader', { url: text });
        if (!result.status) return m.reply(`Gagal mendapatkan hasil: ${result.mess}`);
        
        if (result.type === 'video') {
            let videoUrl = result.video_hd || result.video;
            await conn.sendMessage(m.chat, { video: { url: videoUrl }, caption: '✨ Tiktok - Video Downloader' }, { quoted: m });
            if (result.audio) {
                await conn.sendMessage(m.chat, { audio: { url: result.audio }, mimetype: 'audio/mpeg' }, { quoted: m });
            }
        } else if (result.type === 'slide') {
            let kin = true;
            for (let img of result.image) {
                await conn.sendMessage(m.chat, { image: { url: img }, caption: kin ? '✨ Tiktok - Image Downloader' : undefined }, { quoted: m });
                kin = false;
            }
            if (result.audio) {
                await conn.sendMessage(m.chat, { audio: { url: result.audio }, mimetype: 'audio/mpeg' }, { quoted: m });
            }
        }

      } catch (e) {
        await conn.sendMessage(jid, { text: `Waduh error nih: ${e.message}` });
      }
    }
  };
  