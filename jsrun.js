import { exec } from "child_process"
const GBK = new TextDecoder("GBK")
//下面是运行js代码时可用的库，想使用更多库请在下面导入
import fs from "fs"
import { segment } from "oicq"
import axios from "axios"

//默认配置项，可用#js设置临时更改
let return_guest_code = true//是否允许非主人运行cmd程序，不建议更改
let change_to_utf8 = false//是否将cmd程序的运行输出转为utf8
let outforward = false//是否以合并转发形式回复，可避免刷屏
let timeout = 60//cmd指令的超时时间，单位为秒

let settingsreg = new RegExp('^#js设置(权限|编码|合并转发|超时)*(.*)*')

export class jsrun extends plugin {
	constructor() {
		super({
			name: '指令运行工具',
			event: 'message',
			priority: 500,
			rule: [
				{
					reg: "^/(.*)",
					fnc: 'jsrun'
				},
				{
					reg: "^#cmd(.*)",
					fnc: 'cmd'
				},
				{
					reg: settingsreg,
					fnc: 'settings',
					permission: 'master'
				}]
		})
	}

	async jsrun(e) {
		if (return_guest_code) {
			if (!e.isMaster) return e.reply("未开放访客权限")
		}
		try {
			const content = e.message[0].text.split("/")[1]
			if (content === undefined) return

			let res = await eval(content);
			let output = (res && res.data) || res;
			if (typeof output !== 'string') output = JSON.stringify(output, null, 4);
			if (output === undefined) return e.reply("程序无返回值");

			if (outforward) {
				await sendForwardMsg(e, output)
			} else {
				await e.reply(output)
			}
		} catch (error) {
			await e.reply('错误：\n' + error.message)
			console.log(error)
		}
	}

	async cmd(e) {
		if (return_guest_code) {
			if (!e.isMaster) return e.reply("未开放访客权限")
		}
		const content = e.message[0].text.split("#cmd")[1]
		if (content == "") return
		await runcmd(e, content)
	}

	async settings(e) {
		let regRet = settingsreg.exec(e.msg)
		let name = regRet[1]
		let value = regRet[2]
		switch (name) {
			case "权限":
				return_guest_code = eval(value)
				break;
			case "编码":
				change_to_utf8 = eval(value)
				break;
			case "合并转发":
				outforward = eval(value)
				break;
			case "超时":
				timeout = Number(value)
				break;
		}
		let settingsmsg = [
			"权限：仅主人可使用插件："+return_guest_code,
			"\n编码：cmd输出转utf-8："+change_to_utf8,
			"\n合并转发：使用合并转发回复："+outforward,
			"\n超时：cmd超时时间："+timeout, " 秒"
		]
		e.reply(settingsmsg)
	}
}

async function runcmd(e, data) {
	exec(data, { encoding: '', timeout: timeout * 1000 }, (err, stdout, stderr) => {
		if (err) {
			if (err.killed) return e.reply("执行时间过长，该命令已被终止", { at: true })
			e.reply(String('错误：\n' + GBK.decode(stderr)))
		} else {
			if (change_to_utf8) { stdout = String(stdout) } else { stdout = String(GBK.decode(stdout)) }
			if (outforward) { sendForwardMsg(e, stdout) } else { e.reply(stdout) }
		}
	})
}

async function sendForwardMsg(e, data) {
	let forwardMsg = [{ message: e.msg, nickname: e.sender.card || e.sender.nickname, user_id: e.sender.user_id }]
	if (data.length > 10000) {
		forwardMsg.push({
			message: `结果过长，将只显示10000字 (${((10000 / data.length) * 100).toFixed(2)}%)`,
			nickname: Bot.nickname, user_id: Bot.uin
		})
		data = data.substring(0, 10000)
	}
	forwardMsg.push({ message: data, nickname: Bot.nickname, user_id: Bot.uin })
	if (e.isGroup) {
		forwardMsg = await e.group.makeForwardMsg(forwardMsg)
	} else {
		forwardMsg = await e.friend.makeForwardMsg(forwardMsg)
	}
	e.reply(forwardMsg)
}
