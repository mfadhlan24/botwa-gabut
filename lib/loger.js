
import chalk from 'chalk';
const chatLogs = [];

export default function logMessage(fromMe, sender, text,pushname) {
  if(!(!!text)) return
  chatLogs.push({
      Pengirim: fromMe ? "BOT" : `${sender.split("@")[0]} | ${pushname}`, // Tanpa warna untuk tabel
      "Dari Bot?": fromMe ? "✔" : "✖", 
      "Isi Pesan": text
  });

  console.clear(); // Bersihkan terminal
  console.table(chatLogs); // Tampilkan tabel tanpa warna

  // Tambahkan log berwarna untuk tampilan biasa
  console.log(
      `${chalk.green("[LOG]")} Pengirim: ${fromMe ? chalk.green("BOT") : chalk.blue(sender.split("@")[0])}, ` +
      `Dari Bot? ${fromMe ? chalk.green("✔") : chalk.red("✖")}, ` +
      `Pesan: ${chalk.yellow(text)}`
  );
}