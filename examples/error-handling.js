const VkBot = require('../lib');

const bot = new VkBot(process.env.TOKEN);

bot.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    console.error(err);
  }
});

bot.on( (ctx) => {
  actx.reply('Hello, world!');
});

bot.startPolling((err) => {
  if (err) {
    console.error(err);
  }
});
