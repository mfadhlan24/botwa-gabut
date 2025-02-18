//require("http").createServer((_, res) => res.end("Uptime!")).listen(8080)
require("./setting");
require("./database/isi_group");
require("dotenv").config();
// haha // for fixing merge error https://stackoverflow.com/a/66527784
const makeWASocket = require("@whiskeysockets/baileys").default;
const {
  default: getAggregateVotesInPollMessage,
  delay,
  PHONENUMBER_MCC,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  generateForwardMessageContent,
  prepareWAMessageMedia,
  generateWAMessageFromContent,
  generateMessageID,
  downloadContentFromMessage,
  makeInMemoryStore,
  jidDecode,
  proto,
  Browsers,
} = require("@whiskeysockets/baileys");
const fs = require("fs");
const NotifyError = require("./utils/handlingErrror.js");
const pino = require("pino");
const chalk = require("chalk");
const path = require("path");
const fse = require("fs-extra");
const FileType = require("file-type");
const yargs = require("yargs/yargs");
const _ = require("lodash");
const { Boom, paymentRequired } = require("@hapi/boom");
const axios = require("axios");
const PhoneNumber = require("awesome-phonenumber");
const namaStore = process.env.NAMA_STORE;
const {
  stokAll,
  qrisDir,
  bannedDb,
  antiLink,
  role,
  userDb,
  antiDel,
} = require("./paths.js");
const {
  imageToWebp,
  videoToWebp,
  writeExifImg,
  writeExifVid,
} = require("./lib/exif");
const {
  smsg,
  isUrl,
  generateMessageTag,
  getBuffer,
  getSizeMedia,
  fetchJson,
  await,
  sleep,
} = require("./lib/myfunc");
// Membersihkan cache modul
Object.keys(require.cache).forEach(function (key) {
  delete require.cache[key];
});
const NodeCache = require("node-cache");
const readline = require("readline");
//================================================//
var low;
try {
  low = require("lowdb");
} catch (e) {
  low = require("./lib/lowdb");
}
//=================================================//
const { Low, JSONFile } = low;
const { session } = require("./paths.js");
const { parseAsync } = require("yargs");
const sessionManagerDigis = require("./lib/manageSesi-Digi.js");
const sessionManagerDigi = new sessionManagerDigis(
  process.env.MONGODB_URI,
  "lanzzstore",
  "session-digiflazz"
);
const MemberManager = require("./lib/manageMembers.js");
const memberManager = new MemberManager(
  process.env.MONGODB_URI,
  "lanzzstore",
  "member"
);
const createUtils = require("./utils/funcHandling.js");

//=================================================//
global.api = (name, path = "/", query = {}, apikeyqueryname) =>
  (name in global.APIs ? global.APIs[name] : name) +
  path +
  (query || apikeyqueryname
    ? "?" +
      new URLSearchParams(
        Object.entries({
          ...query,
          ...(apikeyqueryname
            ? {
                [apikeyqueryname]:
                  global.APIKeys[
                    name in global.APIs ? global.APIs[name] : name
                  ],
              }
            : {}),
        })
      )
    : "");

//=================================================//
const store = makeInMemoryStore({
  logger: pino().child({ level: "silent", stream: "store" }),
});
//=================================================//
global.opts = new Object(
  yargs(process.argv.slice(2)).exitProcess(false).parse()
);
global.db = new Low(new JSONFile(`src/database.json`));

global.DATABASE = global.db;
global.loadDatabase = async function loadDatabase() {
  if (global.db.READ)
    return new Promise((resolve) =>
      setInterval(function () {
        !global.db.READ
          ? (clearInterval(this),
            resolve(
              global.db.data == null ? global.loadDatabase() : global.db.data
            ))
          : null;
      }, 1 * 1000)
    );
  if (global.db.data !== null) return;
  global.db.READ = true;
  await global.db.read();
  global.db.READ = false;
  global.db.data = {
    users: {},
    database: {},
    chats: {},
    game: {},
    settings: {},
    message: {},
    ...(global.db.data || {}),
  };
  global.db.chain = _.chain(global.db.data);
};
loadDatabase();
//=================================================//
//=================================================//

function checkAndReplaceCreds() {
  const sessionCredsPath = path.join(__dirname, "auth", "creds.json");
  const backupCredsPath = path.join(__dirname, "auth_creds", "creds.json");
  const backupSessPath = path.join(__dirname, "auth_creds");

  if (fs.existsSync(sessionCredsPath)) {
    const sessionCreds = fs.readFileSync(sessionCredsPath, "utf8").trim();

    if (sessionCreds) {
      console.log(chalk.bgGreenBright("creds.json has contents."));
    } else {
      console.log(
        chalk.bgYellowBright(
          "creds.json is empty, replacing with backup_creds.json if available."
        )
      );
      if (fs.existsSync(backupCredsPath)) {
        const backupCreds = fs.readFileSync(backupCredsPath, "utf8");
        fs.writeFileSync(sessionCredsPath, backupCreds, "utf8");
        console.log(
          chalk.bgCyanBright(
            "creds.json has been replaced with backup_creds.json"
          )
        );
      } else {
        if (!fs.existsSync(backupSessPath)) {
          fse.copySync(path.join(__dirname, "auth"), backupSessPath);
          console.log(
            chalk.bgGreenBright(
              "Folder session has been duplicated to auth_creds"
            )
          );
        } else {
          console.log(chalk.bgGreenBright("Folder auth_creds already exists"));
        }
      }
    }
  } else {
    console.error(chalk.redBright("creds.json not found"));
  }
}

// checkAndReplaceCreds();

let phoneNumber = "";
//let owner = JSON.parse(fs.readFileSync('./src/data/role/owner.json'))
const testModeSession = process.argv.includes('--test') ? './testing_session' : './auth';
const pairingCode = !!phoneNumber || process.argv.includes("--code");
const useMobile = process.argv.includes("--mobile");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function connectToWhatsApp() {
  let { version, isLatest } = await fetchLatestBaileysVersion();
  const { state, saveCreds } = await useMultiFileAuthState(testModeSession);
  const msgRetryCounterCache = new NodeCache(); // for retry message, "waiting message"
  const lanzzjed = makeWASocket({
    logger: pino({ level: "silent" }),
    printQRInTerminal: !pairingCode,
    browser: Browsers.windows("Firefox"),
    // browser: ["Mac OS", "Chrome", "121.0.6167.159"],
    //browser: Browsers.macOS('Lanzz Store'),n
    syncFullHistory: true,
    version: isLatest ? version : [2, 2413, 1],
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
      keys: makeCacheableSignalKeyStore(
        state.keys,
        pino({ level: "fatal" }).child({ level: "fatal" })
      ),
    },
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true,
    getMessage: async (key) => {
      if (store) {
        const msg = await store.loadMessage(key.remoteJid, key.id);
        return msg.message || undefined;
      }
      return {
        conversation: "Hai Im Lanzz Bot",
      };
    },
    msgRetryCounterCache, // Resolve waiting messages
    defaultQueryTimeoutMs: undefined, // for this issues https://github.com/WhiskeySockets/Baileys/issues/276
  });
  store.bind(lanzzjed.ev);
 
  //======================================
  // login use pairing code
  // source code https://github.com/WhiskeySockets/Baileys/blob/master/Example/example.ts#L61

  if (pairingCode && !lanzzjed.authState.creds.registered) {
    if (useMobile) throw new Error("Cannot use pairing code with mobile api");

    let phoneNumber;
    if (!!phoneNumber) {
      phoneNumber = phoneNumber.replace(/[^0-9]/g, "");

      if (
        !Object.keys(PHONENUMBER_MCC).some((v) => phoneNumber.startsWith(v))
      ) {
        console.log(
          chalk.bgBlack(
            chalk.redBright(
              "Start with country code of your WhatsApp Number, Example : +6281311268263"
            )
          )
        );
        process.exit(0);
      }
    } else {
      phoneNumber = await question(
        chalk.bgBlack(
          chalk.greenBright(
            `Tolong INPUTKAN Nomor WhatsApp Anda 😍\nFor example: +6281311268263 : `
          )
        )
      );
      phoneNumber = phoneNumber.replace(/[^0-9]/g, "");

      // Ask again when entering the wrong number
      if (
        !Object.keys(PHONENUMBER_MCC).some((v) => phoneNumber.startsWith(v))
      ) {
        console.log(
          chalk.bgBlack(
            chalk.redBright(
              "Start with country code of your WhatsApp Number, Example : +916909137213"
            )
          )
        );

        phoneNumber = await question(
          chalk.bgBlack(
            chalk.greenBright(
              `Please type your WhatsApp number 😍\nFor example: +916909137213 : `
            )
          )
        );
        phoneNumber = phoneNumber.replace(/[^0-9]/g, "");
        rl.close();
      }
    }

    setTimeout(async () => {
      let code = await lanzzjed.requestPairingCode(phoneNumber);
      code = code?.match(/.{1,4}/g)?.join("-") || code;
      console.log(
        chalk.black(chalk.bgGreen(`Your Pairing Code : `)),
        chalk.black(chalk.white(code))
      );
    }, 3000);
  }
  //========================= con
  lanzzjed.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;
    try {
      if (connection === "close") {
        let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
        if (reason === DisconnectReason.badSession) {
          console.log(`Bad Session File, Please Delete Session and Scan Again`);
          process.exit();
        } else if (reason === DisconnectReason.connectionClosed) {
          console.log("Connection closed, reconnecting....");
          checkAndReplaceCreds();
          connectToWhatsApp();
        } else if (reason === DisconnectReason.connectionLost) {
          console.log("Connection Lost from Server, reconnecting...");
          connectToWhatsApp();
        } else if (reason === DisconnectReason.connectionReplaced) {
          console.log(
            "Connection Replaced, Another New Session Opened, Please Restart Bot"
          );
          process.exit();
        } else if (reason === DisconnectReason.loggedOut) {
          console.log(
            `Device Logged Out, Please Delete Folder Session lanzz and Scan Again.`
          );
          process.exit();
        } else if (reason === DisconnectReason.restartRequired) {
          console.log("Restart Required, Restarting...");
          connectToWhatsApp();
        } else if (reason === DisconnectReason.timedOut) {
          console.log("Connection TimedOut, Reconnecting...");
          connectToWhatsApp();
        } else {
          console.log(`Unknown DisconnectReason: ${reason}|${connection}`);
          connectToWhatsApp();
        }
      } else if (connection === "open") {
        console.log(chalk.greenBright(`Bot Is Online`));

        //==============================================//
        const WebSocket = require("ws");
        const ws = new WebSocket(`ws://localhost:${process.env.PORT}`);
        const kirim = (id, text) =>
          lanzzjed.sendMessage(id ? id : m.chat, { text: text });
        const log = console.log;
        const color = require("chalk");

        ws.on("open", () =>
          log(color.greenBright(`SUCCESS CONNECTED TO WEBSOCKET SERVER!`))
        );
        //===================================================================================//
        const m = smsg(lanzzjed, mekseg, store);

        async function sendMessageWithEdit(nomor, message, key) {
          return new Promise((resolve) => {
            setTimeout(async () => {
              await lanzzjed.sendMessage(nomor + "@s.whatsapp.net", {
                text: message,
                edit: key,
                mentions: m.isGroup
                  ? (
                      await (
                        await lanzzjed.groupMetadata(m.chat)
                      ).participants
                    ).map((a) => a.id)
                  : [m.sender],
              });
              resolve(); // Resolve promise setelah pesan terkirim
            }, 4000); // Jeda 4 detik
          });
        }
        const handleDigiFlazz = async (webhookInfo) => {
          const icons = {
            ref_id: "🆔",
            customer_no: "🛃",
            buyer_sku_code: "📦",
            message: "💬",
            status: "📊",
            rc: "ℹ️",
            sn: "📌",
            price: "💸",
          };

          const keyMap = {
            ref_id: "REF ID",
            customer_no: "NOMOR CUSTOMER",
            buyer_sku_code: "KODE",
            message: "PESAN",
            status: "STATUS",
            rc: "KODE_STATUS",
            sn: "KODE SN",
            price: "HARGA",
          };
          if (isObject(webhookInfo)) {
            const template = formatWebhookInfo(webhookInfo);
            kirim(global.logsBot[0], template);
            (async () => {
              const botNumber = await lanzzjed.decodeJid(lanzzjed.user.id);
              const { rpFormatter } = createUtils(lanzzjed, m, botNumber);
              if (
                Object.keys(webhookInfo).length !== 0 &&
                !webhookInfo.hasOwnProperty("ref_id")
              )
                return;
              let pesan = Object.entries(webhookInfo)
                .map(([key, value]) => {
                  const keyRejected = [
                    "buyer_last_saldo",
                    "tele",
                    "wa",
                    "trx_id",
                  ];
                  if (!keyRejected.includes(key)) {
                    const icon = icons[key] || "";
                    return `${icon} ${keyMap[key]}: ${
                      keyMap[key] === "HARGA"
                        ? rpFormatter(value + global.addPrice)
                        : value
                    }`;
                  }
                  return null;
                })
                .filter((item) => item !== null)
                .join("\n");

              const ref_id = webhookInfo.ref_id;
              const isSession = await sessionManagerDigi.getSessionById(ref_id);
              if (!isSession) return;
              const wa =
                isSession.session?.wa === undefined
                  ? isSession.session?.wa
                  : "6281311268263";
              const saldoUser =
                webhookInfo.rc === "00"
                  ? true
                  : await memberManager.updateMemberBalance(
                      `LANZZ${wa}`,
                      webhookInfo.price + global.addPrice
                    );
              const infoUser = await memberManager.getMemberById(`LANZZ${wa}`);
              const finalPesan = `Halo kak @${
                (await infoUser).member.no
              }\nSaldo Mu : ${rpFormatter(
                infoUser.member.balance
              )}\nBerikut Detail Pesananmu:\n\n${pesan}`;
              await sendMessageWithEdit(wa, finalPesan, isSession.session?.key);
            })();
          }
        };

        ws.onmessage = async (event) => {
          const logMessage = JSON.parse(event.data);
        
          switch (logMessage.type) {
            case "otp" : {
              const data = logMessage.data;
              const pesan = { text: `🔐 *[ OTP VERIFICATION ]*\n\nYour OTP for Verification https://home.tokofadhlan.my.id is \`${data.otp}\``}
              await lanzzjed.sendMessage(data.no, pesan);
              break
            }
            case "webhook":
              handleDigiFlazz(logMessage.data.data);
              break;
            case "paydisini":
             
              const res = {
                status: logMessage.data.status === "Success" ? true : false,
                pay_id: logMessage.data.pay_id,
                unique_code: logMessage.data.unique_code,
              };
        
              if (res.status) {
                (async () => {
                  const userData = JSON.parse(fs.readFileSync(session.userAct, "utf8"));
                  const user = userData.find((aydi) => aydi.unique_code === res.unique_code);
                  const cekData = await checkApi(user.id);
        
                  if (cekData) {
                    console.log(`CekData : ${!!cekData}`);
                    let pesan = ` Selamat! Kak *${user.nama}* Transaksi Anda berhasil! \n
        Produk:  ${user.namaItem}
        Jumlah:  ${user.jumlah}
        Total:  ${user.totalHarga}\n\n`;
                    await ambilDanHapusAkun(
                      user.no,
                      user.jumlah,
                      user.realProduk,
                      user.id,
                      user.username,
                      user.totalHarga,
                      pesan
                    );
                    setTimeout(async () => {
                      await deleteTheArr(user.id);
                    }, 3000);
                  }
                })();
              }
              break;
            default:
              // Handle unexpected message types here (optional)
          }
        };
        

        const isObject = (value) =>
          value && typeof value === "object" && !Array.isArray(value);

        const formatWebhookInfo = (info) =>
          `🔔 *INFORMASI WEBHOOK* 🔔\n\n` +
          Object.entries(info)
            .map(([key, value]) => `${key.toUpperCase()}: ${value}\n`)
            .join("\n");

        //================================//
        async function checkApi(id) {
          const FormData = require("form-data");
          const userData = JSON.parse(fs.readFileSync(session.userAct, "utf8"));
          const user = await userData.find((aydi) => aydi.id === id);
          if (!user) return false;
          try {
            const cek = new FormData();
            cek.append("key", process.env.PAYDISINI_API_KEY);
            cek.append("request", "status");
            cek.append("unique_code", user.unique_code);
            cek.append("signature", user.checkSignature);
            const response = await axios.post(
              "https://paydisini.co.id/api/",
              cek,
              {
                headers: {
                  ...cek.getHeaders(),
                },
              }
            );
            const status = response.data.data;
            console.log(status.pay_id);
            return true;
          } catch (e) {
            return false;
          }
        }
        async function deleteTheArr(id) {
          const userData = JSON.parse(fs.readFileSync(session.userAct, "utf8"));
          const user = userData.find((aydi) => aydi.id === id);
          if (user) {
            try {
              const data = await fs.promises.readFile(session.userAct, "utf8");
              let users = JSON.parse(data);
              const newData = users.filter((item) => item.id !== user.id);
              await fs.promises.writeFile(
                session.userAct,
                JSON.stringify(newData, null, 2)
              );
              console.log("Data berhasil dihapus di users.json");
              return { status: true, msg: `Data berhasil dihapus di Database` };
            } catch (error) {
              console.error("Terjadi kesalahan:", error);
              return { status: false, msg: error };
            }
          } else {
            return { status: false, msg: `User  tidak di temukan` };
          }
        }
        async function ambilDanHapusAkun(
          no,
          jumlah,
          jenisAkun,
          id,
          username,
          totalHarga,
          pesan
        ) {
          // userData === stokAll
          // member === dataMember
          const dataAkunPrem = JSON.parse(fs.readFileSync(stokAll));
          let akunData = dataAkunPrem.find(
            (item) => item.jenisAkun === jenisAkun
          );
          console.log(akunData);
          if (akunData.akun.length === 0) {
            m.reply(
              "Akun belum di-restok. Silakan hubungi admin untuk informasi lebih lanjut. Saldo anda Di Tambahkan Ke Dalam Database!.\nKetik info untuk mengetahui saldo kamu"
            );
            tambahSaldo(id, username, totalHarga);
            return;
          }
          const akunYangDiambil = akunData.akun.splice(0, jumlah);
          const pesanOrderan = akunYangDiambil
            .map(
              (akun) => `Email : ${akun.email} | Password : ${akun.password}`
            )
            .join("\n");

          setTimeout(() => {
            kirim(
              no + "@s.whatsapp.net",
              `${
                pesan + pesanOrderan
              }\n\n Terima kasih telah berbelanja di ${namaStore}! 🙏`
            );
          }, 1000);
          akunData.stokTerjual += jumlah;
          if (!jenisAkun.includes("canva")) {
            writeJson(stokAll, dataAkunPrem);
          }
        }
        function tambahSaldo(id, email, jumlah) {
          try {
            const dataMember = JSON.parse(fs.readFileSync(role.member));
            const member = dataMember.find(
              (member) => member.username === email && member.id === id
            );

            if (member) {
              member.balance = parseInt(member.balance) + parseInt(jumlah);
              writeJson(role.member, dataMember);
              return true;
            } else {
              return false;
            }
          } catch (err) {
            console.error(err);
            return false; // Gagal menambah saldo karena terjadi kesalahan
          }
        }
        function writeJson(pathnye, datanye) {
          try {
            fs.writeFileSync(
              pathnye,
              JSON.stringify(datanye, null, 2),
              "utf-8"
            );
          } catch (e) {
            debug(new Error(e));
            return false;
          }
        }

        //=================================================//
      } // end connection open
      //=================================================//
    
      lanzzjed.ev.on("creds.update", saveCreds);
      lanzzjed.ev.on("messages.upsert", () => {});
     
      // Handling Error

      if (!connection)
        throw new NotifyError("Kesalahan Pada Koneksi!", {
          file: __filename,
          line: __line,
          function: "lanzzjed.ev.on",
        });
    } catch (e) {
      if (e instanceof NotifyError) {
        e.sendBot();
      }
    }
  });
  //======================================
  // respon cmd pollMessage
  async function getMessage(key) {
    if (store) {
      const msg = await store.loadMessage(key.remoteJid, key.id);
      return msg?.message;
    }
    return {
      conversation: "Hai Im lanzz Bot",
    };
  }
  // lanzzjed.ev.on('presence.update', json => console.log(json.id))
  lanzzjed.ev.on("messages.update", async (chatUpdate) => {
    for (const { key, update } of chatUpdate) {
      if (update.pollUpdates && key.fromMe) {
        const pollCreation = await getMessage(key);
        if (pollCreation) {
          const pollUpdate = await getAggregateVotesInPollMessage({
            message: pollCreation,
            pollUpdates: update.pollUpdates,
          });
          var toCmd = pollUpdate.filter((v) => v.voters.length !== 0)[0]?.name;
          if (toCmd == undefined) return;
          var prefCmd = "!" + toCmd;
          lanzzjed.appenTextMessage(prefCmd, chatUpdate);
        }
      }
    }
  });
  //autostatus view
  lanzzjed.ev.on("messages.upsert", async (chatUpdate) => {
    if (global.autoswview) {
      mek = chatUpdate.messages[0];
      if (mek.key && mek.key.remoteJid === "status@broadcast") {
        await lanzzjed.readMessages([mek.key]);
      }
    }
  });
  //=================================================//
  lanzzjed.decodeJid = (jid) => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
      let decode = jidDecode(jid) || {};
      return (
        (decode.user && decode.server && decode.user + "@" + decode.server) ||
        jid
      );
    } else return jid;
  };
  //=================================================//
  let mekseg = "";
  lanzzjed.ev.on("messages.upsert", async (chatUpdate) => {
    try {
      mekseg = chatUpdate.messages[0];
      mek = chatUpdate.messages[0];
      if (!mek.message) return;
      mek.message =
        Object.keys(mek.message)[0] === "ephemeralMessage"
          ? mek.message.ephemeralMessage.message
          : mek.message;
      if (mek.key && mek.key.remoteJid === "status@broadcast") return;
      if (!lanzzjed.public && !mek.key.fromMe && chatUpdate.type === "notify")
        return;

      if (mek.key.id.startsWith("BAE5") && mek.key.id.length === 16) return;
      if (mek.key.remoteJid.endsWith("@newsletter")) {
        console.log(`Newsletter JID: ${mek.key.remoteJid}`);
        return;
      }
      m = smsg(lanzzjed, mek, store);
      require("./handler")(lanzzjed, m, chatUpdate, store);
      // Load all plugins dynamically
      const pluginDir = path.join(__dirname, "plugins");
      fs.readdirSync(pluginDir).forEach((file) => {
        const pluginPath = path.join(pluginDir, file);
        require(pluginPath)(lanzzjed, m, chatUpdate, store);
      });
      // require("./plugins/webinfo")(lanzzjed, m, chatUpdate);
    } catch (err) {
      console.log(err);
    }
  });

  lanzzjed.ev.on("call", async (celled) => {
    let botNumber = await lanzzjed.decodeJid(lanzzjed.user.id);
    let koloi = global.anticall;
    if (!koloi) return;
    console.log(celled);
    for (let kopel of celled) {
      if (kopel.isGroup == false) {
        if (kopel.status == "offer") {
          let nomer = await lanzzjed.sendTextWithMentions(
            kopel.from,
            `*${lanzzjed.user.name}* tidak bisa menerima panggilan ${
              kopel.isVideo ? `video` : `suara`
            }. Maaf @${
              kopel.from.split("@")[0]
            } kamu akan diblokir. Silahkan hubungi Owner membuka blok !`
          );
          lanzzjed.sendContact(
            kopel.from,
            owner.map((i) => i.split("@")[0]),
            nomer
          );
          await sleep(8000);
          await lanzzjed.updateBlockStatus(kopel.from, "block");
        }
      }
    }
  });
  //=================================================//

  //=================================================//
  lanzzjed.ev.on("group-participants.update", async (anu) => {
    if (!wlcm.includes(anu.id)) return;
    console.log(anu);
    try {
      let metadata = await lanzzjed.groupMetadata(anu.id);
      let participants = anu.participants;
      for (let num of participants) {
        // Get Profile Picture User
        try {
          ppuser = await lanzzjed.profilePictureUrl(num, "image");
        } catch {
          ppuser =
            "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png?q=60";
        }

        // Get Profile Picture Group
        try {
          ppgroup = await lanzzjed.profilePictureUrl(anu.id, "image");
        } catch {
          ppgroup =
            "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png?q=60";
        }

        if (anu.action == "add") {
          lanzzjed.sendMessage(anu.id, {
            image: { url: ppuser },
            mentions: [num],
            caption: `Haii Kak *@${
              num.split("@")[0]
            }* Selamat Datang Di Group *${metadata.subject}* 👋

LIST HARGA KETIK : #list

❗ Sebelum order wajib baca S&k di grup, order = setuju dengan S&k
❗ Komplain hanya via private chat, komplain di grup = no respon
❗ Bukti Transfer Kirim ke GRUP & ADMIN 

⚠ KIRIM BUKTI TRANSFER KE GRUP & ADMIN ⚠

ADMIN ONLY
wa.me/6281311268263


⛔ DILARANG PROMOSI / WTS / WTB / SPAM BOT / SEBAR LINK / SPAM / RASIS & SARA / MALING MEMBER ⛔
`,
          });
        } else if (anu.action == "remove") {
          lanzzjed.sendMessage(anu.id, {
            image: { url: ppuser },
            mentions: [num],
            caption: `Karena Untuk Setiap Ucapan Selamat Datang Akan Selalu Diakhiri Dengan Ucapan Selamat Tinggal 👋
▬▭▬▭▬▭▬▭▬▬▭▬▭▬
Selamat Tinggal *@${num.split("@")[0]}* Di Group *${metadata.subject}*
▬▭▬▭▬▭▬▭▬▬▭▬▭▬
Creator : https://wa.me/6281311268263`,
          });
        } else if (anu.action == "promote") {
          lanzzjed.sendMessage(anu.id, {
            image: { url: ppuser },
            mentions: [num],
            caption: `@${num.split("@")[0]} Ciee Jadi Admin Di Group ${
              metadata.subject
            }`,
          });
        } else if (anu.action == "demote") {
          lanzzjed.sendMessage(anu.id, {
            image: { url: ppuser },
            mentions: [num],
            caption: `@${num.split("@")[0]} Ciee Di Hapus Jadi Admin Di Group ${
              metadata.subject
            }`,
          });
        }
      }
    } catch (err) {
      console.log(err);
    }
  });
  //=================================================//
  lanzzjed.ev.on("contacts.update", (update) => {
    for (let contact of update) {
      let id = lanzzjed.decodeJid(contact.id);
      if (store && store.contacts)
        store.contacts[id] = { id, name: contact.notify };
    }
  });
  //=================================================//
  lanzzjed.getName = (jid, withoutContact = false) => {
    id = lanzzjed.decodeJid(jid);
    withoutContact = lanzzjed.withoutContact || withoutContact;
    let v;
    if (id.endsWith("@g.us"))
      return new Promise(async (resolve) => {
        v = store.contacts[id] || {};
        if (!(v.name || v.subject)) v = lanzzjed.groupMetadata(id) || {};
        resolve(
          v.name ||
            v.subject ||
            PhoneNumber("+" + id.replace("@s.whatsapp.net", "")).getNumber(
              "international"
            )
        );
      });
    else
      v =
        id === "0@s.whatsapp.net"
          ? {
              id,
              name: "WhatsApp",
            }
          : id === lanzzjed.decodeJid(lanzzjed.user.id)
          ? lanzzjed.user
          : store.contacts[id] || {};
    return (
      (withoutContact ? "" : v.name) ||
      v.subject ||
      v.verifiedName ||
      PhoneNumber("+" + jid.replace("@s.whatsapp.net", "")).getNumber(
        "international"
      )
    );
  };
  //=================================================//
  lanzzjed.sendContact = async (jid, kon, quoted = "", opts = {}) => {
    let list = [];
    for (let i of kon) {
      list.push({
        displayName: await lanzzjed.getName(i + "@s.whatsapp.net"),
        vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${await lanzzjed.getName(
          i + "@s.whatsapp.net"
        )}\nFN:${await lanzzjed.getName(
          i + "@s.whatsapp.net"
        )}\nitem1.TEL;waid=${i}:${i}\nitem1.X-ABLabel:Ponsel\nitem2.EMAIL;type=INTERNET:off.lanzzstore@gmail.com\nitem2.X-ABLabel:Email\nitem3.URL:https://chat.whatsapp.com/HH13cdUeLRx1VqGVkO1Qy7\nitem3.X-ABLabel:Instagram\nitem4.ADR:;;Indonesia;;;;\nitem4.X-ABLabel:Region\nEND:VCARD`,
      });
    }
    //=================================================//
    lanzzjed.sendMessage(
      jid,
      {
        contacts: { displayName: `${list.length} Kontak`, contacts: list },
        ...opts,
      },
      { quoted }
    );
  };
  //=================================================//
  //Kalau Mau Self Lu Buat Jadi false
  lanzzjed.public = true;

  //=================================================//
  //=================================================//

  //=================================================//

  // Add Other

  /**
   *
   * @param {*} jid
   * @param {*} name
   * @param [*] values
   * @returns
   */
  lanzzjed.sendPoll = (jid, name = "", values = [], selectableCount = 1) => {
    return lanzzjed.sendMessage(jid, {
      poll: { name, values, selectableCount },
    });
  };

  //============= SEND POLL =======================//
  lanzzjed.downloadMediaMessage = async (message) => {
    let mime = (message.msg || message).mimetype || "";
    let messageType = message.mtype
      ? message.mtype.replace(/Message/gi, "")
      : mime.split("/")[0];
    const stream = await downloadContentFromMessage(message, messageType);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
  };
  //==================================================//
  lanzzjed.sendImage = async (
    jid,
    path,
    caption = "",
    quoted = "",
    options
  ) => {
    let buffer = Buffer.isBuffer(path)
      ? path
      : /^data:.*?\/.*?;base64,/i.test(path)
      ? Buffer.from(path.split`,`[1], "base64")
      : /^https?:\/\//.test(path)
      ? await await getBuffer(path)
      : fs.existsSync(path)
      ? fs.readFileSync(path)
      : Buffer.alloc(0);
    return await lanzzjed.sendMessage(
      jid,
      { image: buffer, caption: caption, ...options },
      { quoted }
    );
  };
  //=================================================//
  lanzzjed.sendText = (jid, text, quoted = "", options) =>
    lanzzjed.sendMessage(jid, { text: text, ...options }, { quoted });
  //=================================================//
  lanzzjed.sendTextWithMentions = async (jid, text, quoted, options = {}) =>
    lanzzjed.sendMessage(
      jid,
      {
        text: text,
        contextInfo: {
          mentionedJid: [...text.matchAll(/@(\d{0,16})/g)].map(
            (v) => v[1] + "@s.whatsapp.net"
          ),
        },
        ...options,
      },
      { quoted }
    );
  //=================================================//
  lanzzjed.sendImageAsSticker = async (jid, path, quoted, options = {}) => {
    let buff = Buffer.isBuffer(path)
      ? path
      : /^data:.*?\/.*?;base64,/i.test(path)
      ? Buffer.from(path.split`,`[1], "base64")
      : /^https?:\/\//.test(path)
      ? await await getBuffer(path)
      : fs.existsSync(path)
      ? fs.readFileSync(path)
      : Buffer.alloc(0);
    let buffer;
    if (options && (options.packname || options.author)) {
      buffer = await writeExifImg(buff, options);
    } else {
      buffer = await imageToWebp(buff);
    }
    await lanzzjed.sendMessage(
      jid,
      { sticker: { url: buffer }, ...options },
      { quoted }
    );
    return buffer;
  };
  //=================================================//
  lanzzjed.sendVideoAsSticker = async (jid, path, quoted, options = {}) => {
    let buff = Buffer.isBuffer(path)
      ? path
      : /^data:.*?\/.*?;base64,/i.test(path)
      ? Buffer.from(path.split`,`[1], "base64")
      : /^https?:\/\//.test(path)
      ? await await getBuffer(path)
      : fs.existsSync(path)
      ? fs.readFileSync(path)
      : Buffer.alloc(0);
    let buffer;
    if (options && (options.packname || options.author)) {
      buffer = await writeExifVid(buff, options);
    } else {
      buffer = await videoToWebp(buff);
    }
    await lanzzjed.sendMessage(
      jid,
      { sticker: { url: buffer }, ...options },
      { quoted }
    );
    return buffer;
  };
  //=================================================//
  lanzzjed.downloadAndSaveMediaMessage = async (
    message,
    filename,
    attachExtension = true
  ) => {
    let quoted = message.msg ? message.msg : message;
    let mime = (message.msg || message).mimetype || "";
    let messageType = message.mtype
      ? message.mtype.replace(/Message/gi, "")
      : mime.split("/")[0];
    const stream = await downloadContentFromMessage(quoted, messageType);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }
    let type = await FileType.fromBuffer(buffer);
    trueFileName = attachExtension ? filename + "." + type.ext : filename;
    // save to file
    await fs.writeFileSync(trueFileName, buffer);
    return trueFileName;
  };
  //=================================================
  lanzzjed.cMod = (
    jid,
    copy,
    text = "",
    sender = lanzzjed.user.id,
    options = {}
  ) => {
    //let copy = message.toJSON()
    let mtype = Object.keys(copy.message)[0];
    let isEphemeral = mtype === "ephemeralMessage";
    if (isEphemeral) {
      mtype = Object.keys(copy.message.ephemeralMessage.message)[0];
    }
    let msg = isEphemeral
      ? copy.message.ephemeralMessage.message
      : copy.message;
    let content = msg[mtype];
    if (typeof content === "string") msg[mtype] = text || content;
    else if (content.caption) content.caption = text || content.caption;
    else if (content.text) content.text = text || content.text;
    if (typeof content !== "string")
      msg[mtype] = {
        ...content,
        ...options,
      };
    if (copy.key.participant)
      sender = copy.key.participant = sender || copy.key.participant;
    else if (copy.key.participant)
      sender = copy.key.participant = sender || copy.key.participant;
    if (copy.key.remoteJid.includes("@s.whatsapp.net"))
      sender = sender || copy.key.remoteJid;
    else if (copy.key.remoteJid.includes("@broadcast"))
      sender = sender || copy.key.remoteJid;
    copy.key.remoteJid = jid;
    copy.key.fromMe = sender === lanzzjed.user.id;
    return proto.WebMessageInfo.fromObject(copy);
  };
  lanzzjed.sendFile = async (
    jid,
    PATH,
    fileName,
    quoted = {},
    options = {}
  ) => {
    let types = await lanzzjed.getFile(PATH, true);
    let { filename, size, ext, mime, data } = types;
    let type = "",
      mimetype = mime,
      pathFile = filename;
    if (options.asDocument) type = "document";
    if (options.asSticker || /webp/.test(mime)) {
      let { writeExif } = require("./lib/sticker.js");
      let media = { mimetype: mime, data };
      pathFile = await writeExif(media, {
        packname: global.packname,
        author: global.packname2,
        categories: options.categories ? options.categories : [],
      });
      await fs.promises.unlink(filename);
      type = "sticker";
      mimetype = "image/webp";
    } else if (/image/.test(mime)) type = "image";
    else if (/video/.test(mime)) type = "video";
    else if (/audio/.test(mime)) type = "audio";
    else type = "document";
    await lanzzjed.sendMessage(
      jid,
      { [type]: { url: pathFile }, mimetype, fileName, ...options },
      { quoted, ...options }
    );
    return fs.promises.unlink(pathFile);
  };
  lanzzjed.parseMention = async (text) => {
    return [...text.matchAll(/@([0-9]{5,16}|0)/g)].map(
      (v) => v[1] + "@s.whatsapp.net"
    );
  };
  //=================================================//
  lanzzjed.copyNForward = async (
    jid,
    message,
    forceForward = false,
    options = {}
  ) => {
    let vtype;
    if (options.readViewOnce) {
      message.message =
        message.message &&
        message.message.ephemeralMessage &&
        message.message.ephemeralMessage.message
          ? message.message.ephemeralMessage.message
          : message.message || undefined;
      vtype = Object.keys(message.message.viewOnceMessage.message)[0];
      delete (message.message && message.message.ignore
        ? message.message.ignore
        : message.message || undefined);
      delete message.message.viewOnceMessage.message[vtype].viewOnce;
      message.message = {
        ...message.message.viewOnceMessage.message,
      };
    }
    let mtype = Object.keys(message.message)[0];
    let content = await generateForwardMessageContent(message, forceForward);
    let ctype = Object.keys(content)[0];
    let context = {};
    if (mtype != "conversation") context = message.message[mtype].contextInfo;
    content[ctype].contextInfo = {
      ...context,
      ...content[ctype].contextInfo,
    };
    const waMessage = await generateWAMessageFromContent(
      jid,
      content,
      options
        ? {
            ...content[ctype],
            ...options,
            ...(options.contextInfo
              ? {
                  contextInfo: {
                    ...content[ctype].contextInfo,
                    ...options.contextInfo,
                  },
                }
              : {}),
          }
        : {}
    );
    await lanzzjed.relayMessage(jid, waMessage.message, {
      messageId: waMessage.key.id,
    });
    return waMessage;
  };
  //=================================================//
  lanzzjed.getFile = async (PATH, save) => {
    let res;
    let data = Buffer.isBuffer(PATH)
      ? PATH
      : /^data:.*?\/.*?;base64,/i.test(PATH)
      ? Buffer.from(PATH.split`,`[1], "base64")
      : /^https?:\/\//.test(PATH)
      ? await (res = await getBuffer(PATH))
      : fs.existsSync(PATH)
      ? ((filename = PATH), fs.readFileSync(PATH))
      : typeof PATH === "string"
      ? PATH
      : Buffer.alloc(0);
    //if (!Buffer.isBuffer(data)) throw new TypeError('Result is not a buffer')
    let type = (await FileType.fromBuffer(data)) || {
      mime: "application/octet-stream",
      ext: ".bin",
    };
    filename = path.join(
      __filename,
      "../src/" + new Date() * 1 + "." + type.ext
    );
    if (data && save) fs.promises.writeFile(filename, data);
    return {
      res,
      filename,
      size: await getSizeMedia(data),
      ...type,
      data,
    };
  };
  lanzzjed.serializeM = (m) => smsg(lanzzjed, m, store);

  return lanzzjed;
}

//=================== END FITUR ====================//

connectToWhatsApp();
let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(chalk.redBright(`Update ${__filename}`));
  delete require.cache[file];
  require(file);
});
