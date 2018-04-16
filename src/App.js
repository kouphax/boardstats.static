const Statistician = require("./Statistician")
const BggApi = require("./BggApi")
const moment = require('moment')
const fs = require('fs');
const util = require('util');
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
            "playCountPerDay",
            "weightedWinCount"
        ], plays),
        players: _.chain(Statistician.players(plays))
            .map(player => {
                const playerName = player.name
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
                    "playCountPerDay",
                    "winsVsLoses"
                ], played, playerName)
                // this is stuff that needs the ENTIRE data set relevant to the user
                const annex = Statistician.report(["champion"], plays, playerName)
                return [ playerName, Object.assign({}, report, annex) ]
            })
            .object()
            .value(),
        boardgames: _.chain(Statistician.boardgames(plays))
            .map(boardgame => {
                const gameplays = Statistician.boardgame(plays, boardgame)
                const report = Statistician.report([
                    "playerCount",
                    "playCount",
                    "playCountByPlayer",
                    "playCountPerDayOfWeek",
                    "playCountPerMonth",
                    "playCountPerDay",
                    "winCountByPlayer",
                    "period",
                    "weightedWinCount"
                ], gameplays)
                return [ boardgame.id, report ]
            })
            .object()
            .value()
    }
}

function render(template, data) {
    const cache = {}
    render = function(template, data) {
        cache[template] = cache[template] || Handlebars.compile(fs.readFileSync(`./resources/${template}.mustache`, { encoding: "utf8"}))
        return cache[template](data)
    }
    return render(template, data)
}

function byPeriod(plays, periodFormat) {
    return _.groupBy(plays, play => moment(play.date).format(periodFormat))
}

function dump(stuff) {
    console.log(util.inspect(stuff, false, null))
    //fs.writeFileSync('dump.json', JSON.stringify(stuff))
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

//        dump(stats)

        const boardgames = Statistician.boardgames(plays)
        const players = Statistician.players(plays)

        Handlebars.registerHelper('boardgameName', function(id) {
            return _.find(boardgames, game => ("" + game.id) === id).name
        });

        Handlebars.registerHelper('playerId', function(name) {
            return name.toLowerCase()
        });

        rm.rmdirRecursiveSync('./build')

        fs.mkdirSync('./build')


        // _.each(["daily", "weekly", "monthly", "yearly"], i => {
        //     fs.mkdirSync(`./build/${username}/${i}`)
        //     for(let entry in stats.periods[i]) if(stats.periods[i].hasOwnProperty(entry)) {
        //         fs.writeFileSync(`./build/${username}/${i}/${entry}.json`, JSON.stringify(stats.periods[i][entry]))
        //         fs.writeFileSync(`./build/${username}/${i}/${entry}.html`, reportTemplate(stats.periods[i][entry]))
        //     }
        // })

        // fs.writeFileSync(`./build/index.json`, JSON.stringify(stats))
        // fs.writeFileSync(`./build/overall.json`, JSON.stringify(stats.overall))


        function write(root, report) {
            try { fs.mkdirSync(`./build${root}`) } catch(e) {}
            try { fs.mkdirSync(`./build${root}game`) } catch(e) {}
            try { fs.mkdirSync(`./build${root}player`) } catch(e) {}

            fs.writeFileSync(`./build${root}index.html`, render("report", report))
            fs.writeFileSync(`./build${root}plays.html`, render("plays",  report))
            fs.writeFileSync(`./build${root}games.html`, render("games",  report))

            _.mapObject(report.boardgames, (report, id) => {
                const boardgame = _.find(boardgames, game => ("" + game.id) === id)
                fs.writeFileSync(`./build${root}game/${id}.html`, render("game", { id, report, boardgame }))
            })

            _.mapObject(report.players, (report, name) => {
                const player = _.find(players, player => player.name === name)
                fs.writeFileSync(`./build${root}player/${player.id}.html`, render("player", { id: player.id, report, player }))
            })
        }

        write("/", stats.overall)
        write("/monthly/", stats.periods.monthly[moment().format(moment.HTML5_FMT.MONTH)])
        write("/weekly/", stats.periods.weekly[moment().format(moment.HTML5_FMT.WEEK)] || report([],moment().format(moment.HTML5_FMT.WEEK)))
        write("/yearly/", stats.periods.yearly[moment().format("YYYY")])
    }
}

module.exports = App