const moment = require('moment');
const tz = require('moment-timezone');
const { JsonDB, Config } = require('node-json-db');
const { token, clientID, clockChannelID, meet_day, meet_hour, meet_minute } = require('./token.json');
const { time, REST, Routes, Client, GatewayIntentBits, ActionRowBuilder, SelectMenuBuilder } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
var db = new JsonDB(new Config("data", true, false, '/'));

// Bot actions
client.on('ready', async () => {
	console.log(`Logged in as ${client.user.tag}!`);
	await client.guilds.fetch();
	console.log("Activate in guilds:", client.guilds.cache.map(x=>x.id));
	
	//meetingStart();
	
	// Clock Channel
	const timeNow = moment().tz("Asia/Taipei").format("HH:mm (z)");
	console.log(`Current time check: ${moment().tz("Asia/Taipei")}`)
	const clockChannel = client.channels.cache.get(clockChannelID);
	clockChannel.edit({ name: `🕒 ${timeNow}` }, 'Clock update').catch(console.error);
	setTimeout(()=>{
		const timeNowUpdate = moment().tz("Asia/Taipei").format("HH:mm (z)");
		clockChannel.edit({ name: `🕒 ${timeNowUpdate}` }, 'Clock update')
		.catch(console.error);
		setInterval(() => {
			const timeNowUpdate = moment().tz("Asia/Taipei").format("HH:mm (z)");
			clockChannel.edit({ name: `🕒 ${timeNowUpdate}` }, 'Clock update')
			.catch(console.error);
		}, 15*60*1000);
	}, 15 - new Date().getMinutes() % 15 * 1000)
	
	let delta = new Date();
	if (new Date().getDay() != meet_day){
		delta.setDate(delta.getDate()+1)
		while (delta.getDay() != meet_day) {
			delta.setDate(delta.getDate()+1)
		}
	}
	delta.setHours(meet_hour)
	delta.setMinutes(meet_minute)
	delta.setSeconds(0)
	let wait = delta - new Date();
	if (wait > 0){
		setTimeout(() => {
			meetingStart()
			setInterval(() => {
				meetingStart()
			}, 7*24*58*1000);
		}, wait );
	}else{
		delta.setDate(delta.getDate()+7)
		wait = delta -= new Date();
		setTimeout(() => {
			meetingStart()
			setInterval(() => {
				meetingStart()
			}, 7*24*58*1000);
		}, wait );
	}
});

meetingStart = async () => {
	let host = "測試"
	let record = "測試2"
	const thread = await client.channels.cache.get("1027226828651368549").threads.create({
		name: moment().tz("Asia/Taipei").format("YYYY-MM-DD"),
		autoArchiveDuration: 60
	});
	await thread.send(`- 每周會議 - \n\n主持人：${host}\n紀錄人：${record}`)
	let ids = await db.getData(`/1027225130839060510/members`).catch(()=>{});
	if (ids != undefined){ //Only start discuss when there're members
		await ids.forEach(x => thread.members.add(x));
		console.log(`Created thread: ${thread.name}`);
		let tags = ids.map(x=>`<@${x}>`).join("\n")
		await thread.send(`各位起床開會囉！！！！！\n${tags}`)
	}
}

client.on('interactionCreate', async interaction => {
	if (!interaction.isSelectMenu()) return;

	if (interaction.customId === 'config_members') {
		//console.log(interaction.values);
		db.push(`/${interaction.guild.id}/members`, interaction.values);
		await interaction.update({ content: 'Configure successful!', components: [] });
	}
});

client.on('interactionCreate', async interaction => {
	if (!interaction.isChatInputCommand()) return;

	if (interaction.commandName === 'members') {
		await interaction.guild.members.fetch()
		let options = [];
		interaction.guild.members.cache.filter(x => x.id != client.user.id).each(x => options.push({
							label: x.nickname != null ? x.nickname : x.user.username,
							description: 'test',
							value: x.id,
						}))
		//console.log(options)
		const row = new ActionRowBuilder()
			.addComponents(
				new SelectMenuBuilder()
					.setCustomId('config_members')
					.setPlaceholder('No members!')
					.addOptions(options)
					.setMinValues(1)
					.setMaxValues(interaction.guild.members.cache.size -1)
			);

		await interaction.reply({ content: 'Please select your team members:', components: [row] });
	}else if (interaction.commandName === 'show'){
		let ids = await db.getData(`/${interaction.guild.id}/members`).catch(()=>{})
		if (ids != undefined){
			await interaction.guild.members.fetch()
			let names = interaction.guild.members.cache.filter(x => ids.includes(x.id)).map(x=>x.nickname != null ? x.nickname : x.user.username)
			await interaction.reply(`Team members in config:\n${names.join("\n")}`)
		}else{
			await interaction.reply(`No members yet!\nHave you configured with /members?`)
		}
	}
});

// Commands
const commands = [
	{
		name: 'members',
		description: 'Configure members',
	},{
		name: 'show',
		description: 'Show current infos',
	},
];

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
	try {
		console.log('Started refreshing application (/) commands.');

		await rest.put(Routes.applicationCommands(clientID), { body: commands });

		console.log('Successfully reloaded application (/) commands.');
	} catch (error) {
		console.error(error);
	}
})();

// Main
client.login(token);