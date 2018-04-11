const Statistician = require("./Statistician")
const BggApi = require("./BggApi")
const moment = require('moment')
const fs = require('fs');
const _ = require('underscore')
const rm = require('rmdir-recursive')

function report(plays, period) {
    return {
        period: period,
        raw: plays,
        plays: Statistician.report([
            "playCountByGame",
            "playCountByPlayer",
            "playerCount",
            "playCount",
            "gameCount",
            "hIndex",
            "playCountPerDayOfWeek",
            "playCountPerMonth",
            "playCountPerDay"
        ], plays),
        players: _.chain(Statistician.players(plays))
            .map(playerName => {
                const played = Statistician.played(plays, playerName)
                const report = Statistician.report([
                    "playCountByGame",
                    "playerCount",
                    "playCount",
                    "newGameCount",
                    "gameCount",
                    "rivalries",
                    "longestPlayerWinStreak",
                    "longestPlayerLossStreak",
                    "hIndex",
                    "playCountPerDayOfWeek",
                    "playCountPerMonth",
                    "playCountPerDay"
                ], played, playerName)
                return [ playerName, report ]
            })
            .object()
            .value(),
        boardgames: _.chain(Statistician.boardgames(plays))
            .map(boardgame => {
                const gameplays = Statistician.boardgame(plays, boardgame)
                const report = Statistician.report([
                    "playerCount",
                    "playCount",
                    "playCountPerDayOfWeek",
                    "playCountPerMonth",
                    "playCountPerDay"
                ], gameplays)
                return [ boardgame, report ]
            })
            .object()
            .value()
    }
}

function byPeriod(plays, periodFormat) {
    return _.groupBy(plays, play => moment(play.date).format(periodFormat))
}

function dump(stuff) {
    //console.log(util.inspect(stuff, false, null))
    fs.writeFileSync('dump.json', JSON.stringify(stuff))
}

class App {
    static async main(username, playerName) {

        const api = new BggApi()
        const user = await api.user(username)
        const plays = await api.plays(username)
        //const plays = JSON.parse(fs.readFileSync('plays.json')) IF WE WANNA READ FROM THE FILE

        const stats = {
            overall: report(plays, "*"),
            periods: _.mapObject({
                "daily": byPeriod(plays, moment.HTML5_FMT.DATE),
                "weekly": byPeriod(plays, moment.HTML5_FMT.WEEK),
                "monthly": byPeriod(plays, moment.HTML5_FMT.MONTH),
                "yearly": byPeriod(plays, "YYYY"),
            }, groups => {
                return _.mapObject(groups, report)
            })
        }

        dump(stats)

        rm.rmdirRecursiveSync('./build')
        fs.mkdirSync('./build')

        _.each(["daily", "weekly", "monthly", "yearly"], i => {
            fs.mkdirSync(`./build/${i}`)
            for(let entry in stats.periods[i]) if(stats.periods[i].hasOwnProperty(entry)) {
                console.log(entry)
                fs.writeFileSync(`./build/${i}/${entry}.json`, JSON.stringify(stats.periods[i][entry]))
            }
        })

        fs.writeFileSync(`./build/index.json`, JSON.stringify(stats))
        fs.writeFileSync(`./build/overall.json`, JSON.stringify(stats.overall))
    }
}

module.exports = App