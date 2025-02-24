import axios from 'axios';
import * as cheerio from 'cheerio';


function extractUrl(url) {
  let match = url.match(/\/(hd|dl|mp3)\/([A-Za-z0-9+/=]+)/);
  return match && match[2] ? Buffer.from(match[2], 'base64').toString('utf-8') : url;
}

async function musicaldown(url) {
  try {
    const cfg = {
      headers: {
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36'
      }
    };

    let res = await axios.get('https://musicaldown.com/id/download', cfg);
    let $ = cheerio.load(res.data); // Pakai satu variabel $

    const url_name = $('#link_url').attr('name');
    const token = $('input[name="token"]').attr('value');
    const verify = $('input[name="verify"]').attr('value');

    let data = new URLSearchParams({
      [url_name]: url,
      token,
      verify
    });

    let pageDl = await axios.post('https://musicaldown.com/id/download', data, {
      headers: {
        ...cfg.headers,
        cookie: res.headers['set-cookie'].join('; ')
      }
    });

    let $$ = cheerio.load(pageDl.data); // Gunakan $$ untuk menghindari konflik $
    let isSlide = $$('div.card-image');

    if (isSlide.length === 0) {
      let getPageMusic = await axios.post('https://musicaldown.com/id/mp3', '', {
        headers: {
          ...cfg.headers,
          cookie: res.headers['set-cookie'].join('; ')
        }
      });

      let exMs = cheerio.load(getPageMusic.data);
      const audio = exMs('a[data-event="mp3_download_dclick"]').attr('href');

      return {
        status: true,
        type: 'video',
        video: extractUrl($$('a[data-event="mp4_download_click"]').attr('href')),
        video_hd: extractUrl($$('a[data-event="hd_download_click"]').attr('href')),
        video_wm: extractUrl($$('a[data-event="watermark_download_click"]').attr('href')),
        audio
      };
    } else {
      let images = [];
      isSlide.each((_, e) => {
        images.push($$(e).find("img").attr("src"));
      });

      let audio = extractUrl($$('a[data-event="mp3_download_click"]').attr('href'));
      let getTokenMatch = pageDl.data.match(/ data: '(.*?)'\n/);
      
      if (!getTokenMatch) {
        return { status: false, mess: "Token tidak ditemukan" };
      }

      let getToken = getTokenMatch[1];
      let vidSlide = await axios.post('https://mddown.xyz/slider', new URLSearchParams({ data: getToken }), cfg);

      return {
        status: true,
        type: 'slide',
        images,
        video: vidSlide.data.url,
        audio
      };
    }
  } catch (e) {
    return {
      status: false,
      mess: `Gagal download: ${e.message}`
    };
  }
}

export default {
  name: "tiktok2",
  description: "Download video TikTok tanpa watermark",
  categories: `Downloader`,
  execute: async (conn, jid, message, text) => {
    if (!text) {
      return conn.sendMessage(jid, { text: "Mana link TikTok-nya?" });
    }

    await conn.sendMessage(jid, { text: "Tunggu sebentar ya..." });

    try {
      const result = await musicaldown(text);

      if (!result.status) {
        return conn.sendMessage(jid, { text: result.mess });
      }

      if (result.type === "video") {
        await conn.sendMessage(jid, { video: { url: result.video_hd || result.video } });

        if (result.audio) {
          await conn.sendMessage(jid, { audio: { url: result.audio }, mimetype: "audio/mp4" });
        }
      } else if (result.type === "slide") {
        for (let img of result.images) {
          await conn.sendMessage(jid, { image: { url: img } });
        }

        if (result.audio) {
          await conn.sendMessage(jid, { audio: { url: result.audio }, mimetype: "audio/mp4" });
        }
      }
    } catch (e) {
      await conn.sendMessage(jid, { text: `Waduh error nih: ${e.message}` });
    }
  }
};
