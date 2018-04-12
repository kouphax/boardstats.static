const Statistician = require("./Statistician")
const BggApi = require("./BggApi")
const moment = require('moment')
const fs = require('fs');
const _ = require('underscore')
const rm = require('rmdir-recursive')
const Handlebars = require('handlebars')

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

function template(data) {
    const source = fs.readFileSync('./resources/report.mustache', { encoding: "utf8"})
    const tpl = Handlebars.compile(source)
    return tpl(data)
}

function byPeriod(plays, periodFormat) {
    return _.groupBy(plays, play => moment(play.date).format(periodFormat))
}

function dump(stuff) {
    //console.log(util.inspect(stuff, false, null))
    fs.writeFileSync('dump.json', JSON.stringify(stuff))
}

class App {
    static async main(username) {

        const api = new BggApi()
        const user = await api.user(username)
        //const plays = await api.plays(username)

        //fs.writeFileSync('plays.json', JSON.stringify(plays))

        const plays = JSON.parse(fs.readFileSync('plays.json')) // IF WE WANNA READ FROM THE FILE

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

        rm.rmdirRecursiveSync('./build')

        fs.mkdirSync('./build')
        fs.mkdirSync(`./build/${username}`)

        // _.each(["daily", "weekly", "monthly", "yearly"], i => {
        //     fs.mkdirSync(`./build/${username}/${i}`)
        //     for(let entry in stats.periods[i]) if(stats.periods[i].hasOwnProperty(entry)) {
        //         fs.writeFileSync(`./build/${username}/${i}/${entry}.json`, JSON.stringify(stats.periods[i][entry]))
        //         fs.writeFileSync(`./build/${username}/${i}/${entry}.html`, template(stats.periods[i][entry]))
        //     }
        // })

        fs.writeFileSync(`./build/${username}/index.json`, JSON.stringify(stats))
        fs.writeFileSync(`./build/${username}/overall.json`, JSON.stringify(stats.overall))
        fs.writeFileSync(`./build/${username}/index.html`, template(stats.overall))

        const currentYearlyPeriod = moment().format("YYYY")
        const lastYearlyPeriod = moment().subtract(1, "year").format("YYYY")
        const currentMonthlyPeriod = moment().format(moment.HTML5_FMT.DATE)
        const currentWeeklyPeriod = moment().format(moment.HTML5_FMT.WEEK)
        const currentDailyPeriod = moment().format(moment.HTML5_FMT.MONTH)

        /*
        /index.html (user focused - James)
            - High Level View
                Total Plays
                Total Games Played
                H-Index
            - Last Game Played
            -
        /play/index.html (all time)
        /play
        /player
        /game
        */
    }
}

module.exports = App