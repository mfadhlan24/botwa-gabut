import { exec } from "child_process";
import util from "node:util";

export default async function events(m,text,isAdmin) {
    if (isAdmin) {
            executeEval(text, m);
            console.log(text);
            
    } else {
        m.reply(`Lu Siapa Anjeng!`)
    }
}

function executeEval(code, m) {
    try {
        const result = /await/i.test(code)
            ? (async () => eval(code))()
            : eval(code);
        
        Promise.resolve(result)
            .then(res => m.reply(util.format(res)))
            .catch(err => m.reply(util.format(err)));
    } catch (e) {
        m.reply(util.format(e));
    }
}

function executeShell(command, m) {
    exec(command, (err, stdout) => {
        if (err) return m.reply(util.format(err));
        if (stdout) return m.reply(util.format(stdout));
    });
}


