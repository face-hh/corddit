# Corddit
Emulate Reddit forums in Discord!

<img src='dump/example.png'>

As seen on [YouTube](https://youtu.be/GRvfPlunigw)

## How to

### Installation

1. `npm i`
2. Rename `example.env` to `.env`
3. Modify `.env` with your config. Everything with `REPLACE_ME` must be replaced. SCROLL DOWN FOR INSTRUCTIONS.
4. `node .`, and that's it!

### Configuration
- Create a Reddit account
  - Change `"reddit_username"` to the account's username.
  - Change `"reddit_password"` to the account's password.
- Create a Reddit app [here](https://reddit.com/prefs/apps)
  - Select the 3rd option: "script".
  - ![Example](https://cdn.discordapp.com/attachments/1064101836832919614/1139117548709875763/image.png)
  - Set `"name"` and `"redirect_uri"` to whatever you wish.
  - Click create.
  - Change `"reddit_client_id"` and `"reddit_client_secret"` according to the picture.
  - ![Example](https://cdn.discordapp.com/attachments/1064101836832919614/1139118078643408917/image.png)

- Create a Discord bot, tutorial [here](https://discordpy.readthedocs.io/en/stable/discord.html)
  - Change `"discord_token"` to `Bot <your_token>`, example: `Bot O89gea98hgn`
  - Change `"custom_guild_id"` to the ID of the server you want to use the bot in.

Done!

### Usage

1. `corddit setup` to get started.
2. `corddit forcefetch` to quickly check if it works.
3. The bot will now post each week. (modify the duration inside the code in the "ready" event)

## Bugs
Because the library used for Reddit is quite old ("snoowrap", 2 years), ratelimits are not handled at all. You might experience the process crashing with 429 errors. To prevent this, lower the amount of posts fetched. The max should be 1000-900 posts in 10 minutes, if we are to trust the X-ratelimit headers.

The code is using `puppeteer`, meaning you might have trouble running the bot on a lower-end machine.