import readline from "readline";

export default function question (text){
    return new Promise((resolve) => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question(`?\x20${text}`, (answer) => {
        rl.close();
        resolve(answer)
    });
}) }

