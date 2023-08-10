require('dotenv').config();

const snoowrap = require('snoowrap');
const puppeteer = require('puppeteer');
const cron = require('node-cron');
const oceanic = require("oceanic.js");
const { QuickDB } = require("quick.db");

const pluginInit = require('./utils/plugin');

const r = new snoowrap({
    userAgent: 'Mozilla/5.0 (Windows NT 10.4; WOW64) AppleWebKit/602.11 (KHTML, like Gecko) Chrome/51.0.1206.147 Safari/537.4 Edge/16.65574',
    clientId: process.env.reddit_client_id,
    clientSecret: process.env.reddit_client_secret,
    username: process.env.reddit_username,
    password: process.env.reddit_password
});

const client = new oceanic.Client({ auth: process.env.discord_token, gateway: { intents: ["GUILDS", "GUILD_MESSAGES", "MESSAGE_CONTENT"] } });
const db = new QuickDB();

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
let browser;
let alreadyWorking = false;

client.on("ready", async () => {
    console.log("Ready as", client.user.tag);

    console.log('DB connected.');

    await initBrowser();
    console.log('Browser for loading comments is ready.');

    createPosts();

    // run every week https://www.npmjs.com/package/node-cron
    cron.schedule('0 12 * * 0', createPosts)
});

client.on('messageCreate', async (message) => {
    if (message.guildID !== process.env.custom_guild_id) return;

    // make this secure
    const command = message.content.toLowerCase();
    const commands = ['corddit setup', 'corddit forcefetch'];

    if (commands.includes(command)) {
        if (!message.member.permissions.has('ADMINISTRATOR')) {
            return message.channel.createMessage({ content: 'You require the `ADMINISTRATOR` permission to create a setup config.' })
        }
    }

    if (commands[0] === command) {
        const query = `${message.guildID}-settings`;
        const dbData = await db.get(query);

        if (dbData && !command.includes('--force')) {
            return message.channel.createMessage({ content: 'A setup in this server has been detected, please mention `--force` next to your command if you wish to override it.' });
        }

        if (dbData) {
            await db.delete(query);
        }
        const channel = await message.guild.createChannel(oceanic.ChannelTypes.GUILD_FORUM, {
            'name': process.env.custom_subreddit,
        })

        await db.set(query + '.posts', [])
        await db.set(query + '.channel', channel.id)

        return message.channel.createMessage({ content: `Successfuly created forum at <#${channel.id}>.` })
    }
    if (commands[1] === command) {
        if (alreadyWorking === true) return message.channel.createMessage({ content: '"alreadyWorking" was set to "true", igoring task.' });

        message.channel.createMessage({ content: 'Starting task...' });
        return createPosts();
    }
})
client.on("error", (err) => console.error('Something went wrong:', err));

client.connect();

function formatNum(number) {
    const suffixes = ['', 'k', 'm', 'b', 't'];
    const suffixStep = 3; // Group numbers by 3 digits (thousands)

    if (isNaN(number) || number === 0) {
        return '0';
    }
    if (number < 1000) return number;

    const absoluteNumber = Math.abs(number);
    const logValue = Math.floor(Math.log10(absoluteNumber) / suffixStep);
    const suffixIndex = Math.min(logValue, suffixes.length - 1);
    const formattedNumber = (number / Math.pow(10, logValue * suffixStep)).toFixed(1);

    return formattedNumber + suffixes[suffixIndex];
}

async function fetchImageBuffer(imageUrl) {
    try {
        const response = await fetch(imageUrl);

        if (!response.ok) throw new Error(`Failed to fetch the image: ${response.status} ${response.statusText}`);

        const buffer = await response.arrayBuffer();

        return Buffer.from(buffer);
    } catch (error) {
        console.error(error);
        return null;
    }
}

async function initBrowser() {
    browser = await puppeteer.launch({
        headless: 'new', defaultViewport: null, args: [
            '--window-size=1920,1080',
        ],
    })
}

async function fetchComments(postURL) {
    const page = await browser.newPage();
    await pluginInit(page);

    await page.goto(postURL);

    const element = await page.waitForSelector('#comment-tree');

    await delay(2500);

    const buffer = await element.screenshot();

    return buffer;
}

async function createPosts() {
    if (alreadyWorking === true) return console.log('"alreadyWorking" was set to "true", igoring task.');

    const query = `${process.env.custom_guild_id}-settings`;
    const dbData = await db.get(query);

    if (!dbData) return console.log('WARNING: Ignored createPosts() call due to lack of setup data.')

    alreadyWorking = true;

    const data = await r.getSubreddit(process.env.custom_subreddit).getTop({ time: "week", limit: Number(process.env.custom_post_max) });

    for (let i = 0; i < data.length; i++) {
        if (i === (data.length - 1)) {
            alreadyWorking = false;
        }

        if (dbData.posts.includes(data[i].id)) continue;

        if (process.env.custom_allow_nsfw == false && data[i].over_18) continue;

        const OP = data[i].name;

        const threadPayload = {
            name: data[i].title,
            reason: process.env.custom_thread_creation_reason,
            message: { content: '' }
        }
        const raw_desc = data[i].selftext;
        const postDescription = raw_desc.length >= 1700 ? raw_desc.slice(0, 1700) + '...' : raw_desc;

        let mappedFiles = [];

        const images = data[i].preview?.images

        if (images) {
            for (let J = 0; J < images.length; J++) {
                const res = await fetchImageBuffer(images[J].source.url);

                mappedFiles.push({ name: 'image.png', contents: res })
            }
        } else if (data[i].media_metadata) {
            const media = data[i].media_metadata;

            const promises = Object.entries(media).map(async ([_id, imageData]) => {
                // s = highest quality
                // screw you reddit for calling everything so short

                const res = await fetchImageBuffer(imageData.s.u);

                return { name: 'image.png', contents: res };
            });

            mappedFiles = await Promise.all(promises);
        }

        const permPostLink = `https://reddit.com${data[i].permalink}`;
        const permOP = `https://reddit.com/u/${OP}`;

        threadPayload.message.content += process.env.custom_message
            .replace(/{{postDescription}}/g, postDescription === '' ? process.env.custom_default_no_description : postDescription)
            .replace(/{{upvotes}}/g, formatNum(data[i].ups))
            .replace(/{{OP}}/g, OP)
            .replace(/{{linkToOP}}/g, permOP)
            .replace(/{{permPostLink}}/g, permPostLink);

        threadPayload.message.files = mappedFiles.slice(0, 10) // limit first 10 elements, otherwise discord body invalid

        const fetchedComments = await fetchComments(permPostLink);

        const forumChannel = client.getChannel(dbData.channel);
        const thread = await forumChannel.startThread(threadPayload);

        client.getChannel(thread.id).createMessage({
            content: 'Comments:',
            files: [
                {
                    name: 'comments.png',
                    contents: fetchedComments
                }
            ]
        })

        await db.push(query + '.posts', data[i].id);
    }
}