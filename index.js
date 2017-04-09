const request = require('request');
const api = require('./method');

const group = {};
const action = {};

action.commands = {};
action.hears = {};

let execute = [];

setInterval(() => {
  if (execute.length) {
    const method = [];

    execute.forEach(msg => {
      method.push(`API.messages.send(${JSON.stringify(msg)})`);
    });

    api('execute', {
      code: `return [ ${method.join(',')} ];`,
      access_token: group.token
    }).then(console.log).catch(console.log);

    execute = [];
  }
}, 350);

module.exports = {
  auth: function(token) {
    group.token = token;
  },
  command: function(command, callback) {
    action.commands[command.toLowerCase()] = callback;
  },
  hears: function(command, callback) {
    action.hears[command.toLowerCase()] = callback;
  },
  reserve: function(callback) {
    action.reserve = callback;
  },
  sendMessage: function(uid, msg, attach) {
    const options = (typeof uid == 'object') ? uid : { user_id: uid, message: msg, attachment: attach };

    execute.push(options);
  },
  getLastMessage: function(update) {
    if (update.fwd_messages && update.fwd_messages.length) {
      return this.getLastMessage(update.fwd_messages[0]);
    }

    return update;
  },
  getForwardMessage: function(update) {
    return new Promise(resolve => {
      if (update[7].fwd) {
        api('messages.getById', {
          message_ids: update[1],
          access_token: group.token
        }).then(body => {
          resolve(this.getLastMessage(body.response.items[0]));
        });
      } else {
        resolve(update);
      }
    });
  },
  startLongPoll: function() {
    return new Promise((resolve, reject) => {
      api('messages.getLongPollServer', {
        need_pts: 1,
        access_token: group.token,
        v: 5.62
      }).then(body => {
        // if (body.failed) {
        //   this.startLongPoll();
        // } else {
          this.getLongPoll(body.response);
        // }
      });
    });
  },
  getLongPoll: function(longPollParams) {
    request({
      url: `https://${longPollParams.server}`,
      method: 'POST',
      form: {
        act: 'a_check',
        key: longPollParams.key,
        ts: longPollParams.ts,
        wait: 25,
        mode: 2,
        version: 1
      },
      json: true
    }, (err, res, body) => {
      if (!err && res.statusCode == 200) {
        if (body.ts) {
          longPollParams.ts = body.ts;
        } else {
          this.startLongPoll();
          return;
        }

        const updates = body.updates;

        if (!updates || updates.length == 0) {
          this.getLongPoll(longPollParams);
          return;
        }

        for (let i = 0, l = updates.length - 1; i <= l; i++) {
          const update = updates[i];

          if (update[0] != 4) {
            continue;
          }

          const flags = update[2];

          if ((flags & 2) != 0) {
            continue;
          }

          const uid = update[3];

          this.getForwardMessage(update).then(data => {
            const update = (Object.keys(data).length == 3)
              ? { user_id: uid, date: data.date, msg: data.body }
              : { user_id: uid, date: data[4], msg: data[6] };

            if (action.commands[update.msg.toLowerCase()]) {
              action.commands[update.msg.toLowerCase()](update);
            } else {
              if (Object.keys(action.hears).length) {
                Object.keys(action.hears).forEach((cmd, i) => {
                  if (new RegExp(cmd, 'i').test(update.msg.toLowerCase())) {
                    action.hears[cmd](update);
                  } else if (i == Object.keys(action.hears).length - 1) {
                    action.reserve(update);
                  }
                });
              } else {
                action.reserve(update);
              }
            }
          });
        }

        this.getLongPoll(longPollParams);
      }
    });
  }
};
