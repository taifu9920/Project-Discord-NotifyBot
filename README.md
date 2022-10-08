# Project-Discord-NotifyBot
The bot to alert meeting.
## Commands
| Commands | Options | Description |
| --------------- | --------------- | --------------- |
| /meeting config members  | None | Modify meeting members |
| /meeting config clock | [channel] | Set clock channel |
| /meeting config when | [day:integer] [hour:integer] [minute:integer] | Schedule the weekly meeting, no options to clear config |
| /meeting config meet | [channel] | Set meeting channel, no options to clear config |
| /meeting review  | None | Display current configs |
## How to run
1. Clone this repo by `git clone git@github.com:taifu9920/Project-Discord-NotifyBot.git`.
2. run `npm install`.
3. Rename `token-example.json` to `token.json`.
4. Modify the file `token.json` and put Client ID, Token inside.
5. Use `node run main` to start the bot
