const moment = require('moment');
const tz = require('moment-timezone');
const { JsonDB, Config } = require('node-json-db');
const { token, clientID} = require('./token.json');
const { commands } = require('./commands.json');
const { ButtonBuilder, ButtonStyle, SlashCommandBuilder, time, REST, Routes, Client, GatewayIntentBits, ActionRowBuilder, SelectMenuBuilder } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
var db = new JsonDB(new Config("data", true, false, '/'));

var running = [[], []] 

reschedule = async()=>{
	//Remove all running schedule
	running[0].forEach(x=>clearInterval(x))
	running[1].forEach(x=>clearTimeout(x))
	
	//Schedule
	var meetings = (await Promise.all(client.guilds.cache.map(x=>x.id).map(x=> db.getData(`/${x}/when`).catch(()=>{})))).filter(x=>x != undefined)
	for (i = 0; i < meetings.length; i++){
		if (await db.getData(`/${meetings[i][3]}/meet`).catch(()=>{}) != undefined){
			if (await db.getData(`/${meetings[i][3]}/members`).catch(()=>{}) != undefined){
				let delta = new Date();
				if (new Date().getDay() != meetings[i][0]){
					delta.setDate(delta.getDate()+1)
					while (delta.getDay() != meetings[i][0]) {
						delta.setDate(delta.getDate()+1)
					}
				}
				delta.setHours(meetings[i][1])
				delta.setMinutes(meetings[i][2])
				delta.setSeconds(0)
				let wait = delta - new Date();
				if (wait <= 0){
					delta.setDate(delta.getDate()+7)
					wait = delta -= new Date();
				}
				meetschedule(meetings[i][3], wait)
			}
		}
	}
}

meetschedule = async(guildID, wait) => {
	running[0].push(setTimeout(() => {
		meetingStart(guildID)
		running[1].push(setInterval(() => {
			meetingStart(guildID)
		}, 7*24*60*1000));
	}, wait ));
}


meetingStart = async (guildID) => {
	await client.guilds.fetch();
	await client.guilds.cache.get(guildID).members.fetch();
	let host = await db.getData(`/${guildID}/host`).catch(()=>{});
	if (host == undefined) host = 0
	let record = await db.getData(`/${guildID}/record`).catch(()=>{});
	if (record == undefined) record = 1
	let ids = await db.getData(`/${guildID}/members`).catch(()=>{});
	let names = client.guilds.cache.get(guildID).members.cache.filter(x => ids.includes(x.id)).sort((a,b) => (a.nickname != null ? a.nickname : a.user.username).localeCompare(b.nickname != null ? b.nickname : b.user.username)).map(x=>x.nickname != null ? x.nickname : x.user.username)
	let channel = await db.getData(`/${guildID}/meet`).catch(()=>{});
	const thread = await client.channels.cache.get(channel).threads.create({
		name: moment().tz("Asia/Taipei").format("YYYY-MM-DD"),
		autoArchiveDuration: 60
	});
	await thread.send(`- 每周會議 - \n\n主持人：<@${ids[host]}>\n紀錄人：<@${ids[record]}>`)
	if (ids != undefined){ //Only start discuss when there're members
		await ids.forEach(x => thread.members.add(x));
		console.log(`Created thread: ${thread.name}`);
		let tags = ids.map(x=>`<@${x}>`).join("\n")
		await thread.send(`各位起床開會囉！！！！！\n${tags}`)
	}
	db.push(`/${guildID}/host`, (host+1) % ids.length);
	db.push(`/${guildID}/record`, (record+1) % ids.length);
}

// Bot actions
client.on('ready', async () => {
	console.log(`Logged in as ${client.user.tag}!`);
	await client.guilds.fetch();
	let activateGuilds = client.guilds.cache.map(x=>x.id);
	console.log("Activate in guilds:", activateGuilds);
	// Clock Channel
	const timeNow = moment().tz("Asia/Taipei").format("HH:mm (z)");
	console.log(`Current time check: ${moment().tz("Asia/Taipei")}`)
	let clockIDs = (await Promise.all(activateGuilds.map(x=> db.getData(`/${x}/clock`).catch(()=>{})))).filter(x=>x != undefined)

	if (clockIDs.length > 0){
		let clockChannels = client.channels.cache.filter(x => clockIDs.includes(x.id))
		clockChannels.forEach(x => x.edit({ name: `🕒 ${timeNow}` }, 'Clock update').catch(console.error))

		setTimeout(()=>{
			const timeNowUpdate = moment().tz("Asia/Taipei").format("HH:mm (z)");
			clockChannels.forEach(x => x.edit({ name: `🕒 ${timeNow}` }, 'Clock update').catch(console.error))
			setInterval(() => {
				const timeNowUpdate = moment().tz("Asia/Taipei").format("HH:mm (z)");
				clockChannels.forEach(x => x.edit({ name: `🕒 ${timeNow}` }, 'Clock update').catch(console.error))
			}, 15*60*1000);
		}, (15 - (new Date().getMinutes() % 15)) * 60 * 1000)
	}
	
	// Meeting notify
	reschedule();
	
});

client.on('interactionCreate', async interaction => {
	if (!interaction.isSelectMenu()) return;

	if (interaction.customId === 'config_members') {
		await interaction.guild.members.fetch()
		let datas = interaction.values.map(x=> [x.substring(0, 18), x.substring(18)])
		datas.sort((a,b) => a[1].localeCompare(b[1]))
		let ids = datas.map(x=>x[0])
		db.push(`/${interaction.guild.id}/members`, ids);
		let names = datas.map(x=>x[1])
		await interaction.update({ content: `Configure successful!\n\nMembers:\n${names.join("\n")}`, components: [] });
	}
});

client.on('interactionCreate', async interaction => {
	if (!interaction.isButton()) return;
	
	if (interaction.customId === 'deleteMembers'){
		await db.delete(`/${interaction.guild.id}/members`);
		await interaction.update({ content: `Member config removed!`, components: [] });
	}
});

client.on('interactionCreate', async interaction => {
	if (!interaction.isChatInputCommand()) return;

	if (interaction.commandName === 'meeting') {
		if (interaction.options.getSubcommand() === 'members') {
			await interaction.guild.members.fetch()
			let options = [];
			interaction.guild.members.cache.filter(x => x.id != client.user.id).each(x => options.push({
				label: x.nickname != null ? x.nickname : x.user.username,
				description: '伺服器成員',
				value: x.id + (x.nickname != null ? x.nickname : x.user.username),
			}))
			const row = new ActionRowBuilder().addComponents(
				new SelectMenuBuilder()
					.setCustomId('config_members')
					.setPlaceholder('No members!')
					.addOptions(options)
					.setMinValues(1)
					.setMaxValues(interaction.guild.members.cache.size -1)
			);
			
			const row2 = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setCustomId('deleteMembers')
					.setLabel('Remove configured members')
					.setStyle(ButtonStyle.Danger),
			);
			await interaction.reply({ content: 'Please select your team members:', components: [row, row2] });
		}else if (interaction.options.getSubcommand() === 'clock'){
			let channel = interaction.options.getChannel("channel");
			if (channel != null){
				db.push(`/${interaction.guild.id}/clock`, channel.id)
				const timeNow = moment().tz("Asia/Taipei").format("HH:mm (z)");
				interaction.options.getChannel("channel").edit({ name: `🕒 ${timeNow}` }, 'Clock update').catch(console.error)
				await interaction.reply(`Will use <#${channel.id}> Channel as clock channel from now on!`);
			}else{
				await db.delete(`/${interaction.guild.id}/clock`);
				await interaction.reply(`Clock channel config removed!`);
			}
		}else if (interaction.options.getSubcommand() === 'review'){
			let ids = await db.getData(`/${interaction.guild.id}/members`).catch(()=>{})
			let when = await db.getData(`/${interaction.guild.id}/when`).catch(()=>{})
			let clock = await db.getData(`/${interaction.guild.id}/clock`).catch(()=>{})
			let meet = await db.getData(`/${interaction.guild.id}/meet`).catch(()=>{})
			let host = await db.getData(`/${interaction.guild.id}/host`).catch(()=>{})
			let record = await db.getData(`/${interaction.guild.id}/record`).catch(()=>{})
			let message = "Status:\n";
			let meetingFunction = 0;
			
			message += `/meeting config members: **${ids != undefined ? "configured" : "Not yet configured"}**\n`
			message += `/meeting config when: **${when != undefined ? "configured" : "Not yet configured"}**\n`
			message += `/meeting config meet: **${meet != undefined ? "configured" : "Not yet configured"}**\n`
			message += `/meeting config clock: **${clock != undefined ? "configured" : "Not yet configured"}**\n\n`
			
			if (ids != undefined)meetingFunction++;
			if (when != undefined)meetingFunction++;
			if (meet != undefined)meetingFunction++;
			
			message += `Meeting notify function: **${meetingFunction == 3 ? "Activated" : "Deactivated"}**!\n`
			message += `Clock channel function: **${clock != undefined ? "Activated" : "Deactivated"}**!\n\n`

			if (when != undefined){
				let convert = "日一二三四五六".split('')
				message += `Meeting will start every **星期${convert[when[0]]}, ${String(when[1]).padStart(2,0)}:${String(when[2]).padStart(2,0)}**\n`
			}else message += `Meeting not scheduled yet.\n`
			if (meet != undefined){
				message += `Meeting chnanel: <#${meet}>\n`
			}else message += `Meeting channel not set.\n`
			if (ids != undefined){
				await interaction.guild.members.fetch()
				var names = interaction.guild.members.cache.filter(x => ids.includes(x.id)).sort((a,b) => (a.nickname != null ? a.nickname : a.user.username).localeCompare(b.nickname != null ? b.nickname : b.user.username)).map(x=>x.nickname != null ? x.nickname : x.user.username)
				message += `Team members in config:\n**${names.join("\n")}**\n\n`
			}else message += `No meeting members.\n\n`
			if(clock != undefined) message+=`Clock channel: <#${clock}>\n`
			if (ids != undefined && names.length > 1){
				if (host == undefined || host < 0 || host > names.length) {
					host = 0
					db.push(`/${interaction.guild.id}/host`, host)
				}
				if (record == undefined || record < 0 || record > names.length) {
					record = 1
					db.push(`/${interaction.guild.id}/record`, record)
				}
				message += `Host in next meeting: **${names[host]}**\n`
				message += `Record in next meeting: **${names[record]}**`
			}
			await interaction.reply(message)
		}else if (interaction.options.getSubcommand() === 'when'){
			let datas = ["day", "hour", "minute"].map(x => interaction.options.getInteger(x))
			
			if (datas[0] == null && datas[1] == null && datas[2] == null){
				await db.delete(`/${interaction.guild.id}/when`);
				await interaction.reply(`Meeting schedules deleted!`);
			}else{
				if (datas[0] != null && datas[0] >= 0 && datas[0] < 7){
					if (datas[1] != null && datas[1] >= 0 && datas[1] < 24){
						if (datas[2] != null && datas[2] >= 0 && datas[2] < 59 ){
							datas.push(interaction.guild.id)
							db.push(`/${interaction.guild.id}/when`, datas)
							reschedule()
							let convert = "日一二三四五六".split('')
							await interaction.reply(`Meeting scheduled!\nWill start every **星期${convert[datas[0]]}, ${String(datas[1]).padStart(2,0)}:${String(datas[2]).padStart(2,0)}**`)
						}else await interaction.reply(`Minute option required between 0~59`)
					}else await interaction.reply(`Hour option required between 0~23`)
				}else await interaction.reply(`Day option required between 0~6`)
			}
		}else if (interaction.options.getSubcommand() === 'meet'){
			let channel = interaction.options.getChannel("channel")
			if (channel != null){
				db.push(`/${interaction.guild.id}/meet`, channel.id)
				await interaction.reply(`Will use <#${channel.id}> Channel as meet channel from now on!`);
			}else{
				await db.delete(`/${interaction.guild.id}/meet`);
				await interaction.reply(`Clock channel config removed!`);
			}
		}else if (interaction.options.getSubcommand() === 'host'){
			let index = interaction.options.getInteger("order")
			db.push(`/${interaction.guild.id}/host`, index)
			await interaction.reply(`Configured next meeting host.`);
		}else if (interaction.options.getSubcommand() === 'record'){
			let index = interaction.options.getInteger("order")
			db.push(`/${interaction.guild.id}/record`, index)
			await interaction.reply(`Configured next meeting record.`);
		}
	}
});

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
	try {
		console.log(`Started refreshing application (/) commands.`);

		const data = await rest.put(
			Routes.applicationCommands(clientID),
			{ body: commands },
		);

		console.log(`Successfully reloaded application (/) commands.`);
	} catch (error) {
		console.error(error);
	}
})();

// Main
client.login(token);