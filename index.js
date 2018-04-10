const Handlebars = require('handlebars')
const moment = require('moment')
const util = require('util');
const fs = require('fs');
const writeFile = util.promisify(fs.writeFile)
const readFile = util.promisify(fs.readFile)
const _ = require('underscore')

class BggApi {
    constructor() {
        this.client = require('bgg')({
            timeout: 10000,
            retry: {
                initial: 100,
                multiplier: 2,
                max: 15e3
            }
        })
    }

    async user(username) {
        return await this.client('user', { name: username })
            .then(user => user.user.id !== "" ? user.user : null)
    }

    async plays(username) {
        const pageSize = 100
        const playsPage1 = await this.client('plays', { username, page: 1, pageSize: 100 })
        const total = playsPage1.plays.total
        const pages = Math.ceil(total/pageSize)
        var plays = playsPage1.plays.play

        for(var page = 2; page <= pages; page++) {
            var pageOfPlays = await this.client('plays', { username, page: page, pageSize: 100 })
            plays = plays.concat(pageOfPlays.plays.play)
        }

        return plays
    }
}

const page = Handlebars.compile(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>The HTML5 Herald</title>
</head>
<body>
  <ul>
    {{#plays}}
      <li>{{id}}</li>
    {{/plays}}
  </ul>
</body>
</html>`)


async function main() {
//  const api = new BggApi()
//  const username = process.env.BGG_USERNAME
//  const user = await api.user(username)


    //if(!user) {
    //  console.log("no bgg user found, exiting")
    //  process.exit(1)
    // }


//  const plays = await api.plays(username)
    //

    const currentUser = 'James'

    const user = JSON.parse(await readFile('user.json'))
    const plays = JSON.parse(await readFile('plays.json'))
    const playsThatUserPlayed = _.filter(plays, play => _.any(play.players.player, player => player.name === currentUser))


//  const mapped = _.chain(plays)
//    .map(play => Object.assign(play, { dateInMillis: Date.parse(play.date) }))
//    .value()
//
//  console.log({
//    oldest: _.min(mapped, play => play.dateInMillis),
//    newest: _.max(mapped, play => play.dateInMillis)
//  })




    // STATS
    // Total Plays
    function totalPlays(plays) {
        return plays
    }
    // Unique Games Played
    function uniqueGamesPlayed(plays) {
        return _.uniq(plays, false, play => play.item.name)
    }
    // New Games Played
    function newGamesPlayed(plays) {
        return _.map(_.filter(plays, play =>  !_.isEmpty(_.filter(play.players.player, player => player.name === currentUser && player.new === 1))), p => p.item.name)
    }
    // Unique Players
    function uniquePlayers(plays) {
        return _.chain(plays)
            .map(play => play.players.player)
            .flatten(true)
            .groupBy(p => p.name === currentUser ? p.name + " (You)" : p.name)
            .mapObject(p => p.length)
            .pairs()
            .sortBy(b => -b[1])
            .value()
    }
    function uniquePlayerCount(plays) {
        return _.chain(plays)
            .map(p => p.players.player.length)
            .groupBy(p => "" + p + " Players")
            .mapObject(p => p.length)
            .pairs()
            .sortBy(b => -b[1])
            .value()
    }
    // Unique Locations
    // H Indexo
    function hIndex(plays) {
        return _.chain(plays)
            .groupBy(p => p.item.name)
            .mapObject(v => v.length)
            .values()
            .groupBy(p => p)
            .values()
            .max(a => (a.length >= a[0]) ? a[0] : -1)
            .flatten()
            .value()[0]
    }
    //

    function gamesByPlay(plays) {
        return _.chain(plays)
            .groupBy(p => p.item.name)
            .mapObject(p => p.length)
            .pairs()
            .sortBy(b => -b[1])
            .value()
    }

    // you vs x
    function winRatio(plays) {

        const scoreboard = _.chain(plays)
            .map(p => p.players.player)
            .flatten()
            .groupBy(p => p.name)
            .mapObject(_.constant(0))
            .value()

        delete(scoreboard[currentUser])
        delete(scoreboard["Anonymous player"])

        return _.chain(plays)
            .map(p => p.players.player)
            .reduce((memo, players) => {
                const everyoneWon = _.every(players, player => player.win === 1)
                const everyoneLost = _.every(players, player => player.win === 0)
                if(everyoneLost || everyoneWon){
                    return memo
                } else {
                    return _.mapObject(memo, (score, playerName) => {
                        const playerPlayed = _.find(players, player => player.name === playerName)
                        const iWon = _.any(players, player => player.name === currentUser && player.win === 1)
                        if(playerPlayed) {
                            const playerWon = playerPlayed.win === 1
                            if(playerWon && !iWon) {
                                return score - 1
                            } else if(iWon && !playerWon) {
                                return score + 1
                            } else {
                                return score
                            }
                        } else {
                            return score
                        }
                    })
                }
            }, scoreboard)
            .pairs()
            .sortBy(b => -b[1])
            .value()
    }

    function playsForGrouping(plays, grouping) {
        return _.chain(plays)
            .groupBy(grouping)
            .value()
    }

    const daysOfWeekName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    const monthsName = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

    function playsPerDayOfWeek(plays) {
        const results = _.mapObject(playsForGrouping(plays, play => moment(play.date).format('dddd')), (v,k) => v.length)
        return _.map(daysOfWeekName, day => [day, results[day] || 0])
    }

    function playsPerMonth(plays) {
        const results = _.mapObject(playsForGrouping(plays, play => moment(play.date).format('MMMM')), (v,k) => v.length)
        return _.map(monthsName, day => [day, results[day] || 0])
    }

    const weeklyStats = ((plays) => {
        const now = moment()
        const nowLastWeek = now.subtract(1, 'weeks').startOf('week')
        const thisWeek = _.filter(plays, play => now.isSame(play.date, 'week'))
        const lastWeek = _.filter(plays, play => nowLastWeek.isSame(play.date, 'week'))
        return {
            listOfGames: gamesByPlay(thisWeek),
            uniquePlayers: uniquePlayers(thisWeek),
            uniquePlayerCount: uniquePlayerCount(thisWeek),
            totalPlays: {
                current: totalPlays(thisWeek).length,
                previous: totalPlays(lastWeek).length
            },
            uniqueGamesPlayed: {
                current: uniqueGamesPlayed(thisWeek).length,
                previous: uniqueGamesPlayed(lastWeek).length
            },
            newGamesPlayedCount: {
                current: newGamesPlayed(thisWeek).length,
                previous: newGamesPlayed(lastWeek).length
            },
            winRatio: winRatio(thisWeek),
            hIndex: {
                current: hIndex(thisWeek),
                previous: hIndex(lastWeek)
            },
            playsPerDayOfWeek: {
                current: playsPerDayOfWeek(thisWeek),
                previous: playsPerDayOfWeek(lastWeek)
            }
        }
    })(playsThatUserPlayed)


    function dump(stuff) {
        console.log(util.inspect(stuff, false, null))
    }

    dump(weeklyStats)


//  await writeFile('user.json', JSON.stringify(user), 'utf8')
//  await writeFile('plays.json', JSON.stringify(plays), 'utf8')

    //console.log(page({ plays }))
}

main()

//bgg('user', {name: 'monteslu', guilds: 1})
//  .then(function(results){
//    console.log(results);
//  });
