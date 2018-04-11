const _ = require('underscore')
const moment = require('moment')

function boardgameName(play) {
    return play.game.name
}

const refdata = {
    daysOfWeekName: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    monthsName: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
}

function playsForGrouping(plays, grouping) {
    return _.chain(plays)
        .groupBy(grouping)
        .value()
}

class Statistician {


    static hIndex(plays) {
        return _.chain(plays)
            .groupBy(boardgameName)
            .mapObject(_.size)
            .values()
            .reduce((memo, count) => {
                for(let i = 0; i < count; i++) {
                    memo[i] = memo[i] || []
                    memo[i].push(i + 1)
                }

                return memo
            }, [])
            .reverse()
            .find(p => p.length >= p[0])
            .value()[0]
    }

    static playCountPerDayOfWeek(plays) {
        const results = _.mapObject(playsForGrouping(plays, play => moment(play.date).format('dddd')), _.size)
        return _.map(refdata.daysOfWeekName, day => [day, results[day] || 0])
    }

    static playCountPerMonth(plays) {
        const results = _.mapObject(playsForGrouping(plays, play => moment(play.date).format('MMMM')), _.size)
        return _.map(refdata.monthsName, day => [day, results[day] || 0])
    }

    static playCountPerDay(plays) {
        return _.chain(playsForGrouping(plays, play => play.date))
            .mapObject(_.size)
            .sort()
            .reverse()
            .value()
    }

    static longestPlayerWinStreak(plays, player) {
        return this.longestPlayerStreak(plays, player, play => {
            return _.any(play.players, p => p.name === player && p.win)
        })
    }

    static longestPlayerLossStreak(plays, player) {
        return this.longestPlayerStreak(plays, player, play => {
            return _.any(play.players, p => p.name === player && !p.win)
        })
    }

    static rivalries(plays, currentUser) {

        const scoreboard = _.chain(plays)
            .filter(play => _.any(play.players, player => player.name === currentUser))
            .map(p => p.players)
            .flatten()
            .groupBy(p => p.name)
            .mapObject(_.constant(0))
            .value()

        delete(scoreboard[currentUser])
        delete(scoreboard["Anonymous player"])

        return _.chain(plays)
            .map(p => p.players)
            .reduce((memo, players) => {
                const everyoneWon = _.every(players, player => player.win)
                const everyoneLost = _.every(players, player => !player.win)
                const playerPlayed = _.find(players, player => player.name === currentUser)

                if(everyoneLost || everyoneWon || !playerPlayed){
                    return memo
                } else {
                    return _.mapObject(memo, (score, playerName) => {
                        const playerPlayed = _.find(players, player => player.name === playerName)
                        const iWon = _.any(players, player => player.name === currentUser && player.win)
                        if(playerPlayed) {
                            const playerWon = playerPlayed.win
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

    static newGameCount(plays, currentUser) {
        function isNewToCurrentUser(player) {
            return player.name === currentUser && player.firstTimePlaying
        }

        return _.chain(plays)
            .filter(play => _.any(play.players, isNewToCurrentUser))
            .map(boardgameName)
            .size()
            .value()
    }

    static playerCount(plays) {
        return _.chain(plays)
            .map(p => p.players.length)
            .groupBy(p => "" + p + " Players")
            .mapObject(p => p.length)
            .pairs()
            .sortBy(b => -b[1])
            .value()
    }

    static playCountByPlayer(plays, currentUser) {
        return _.chain(plays)
            .map(play => play.players)
            .flatten(true)
            .groupBy(p => p.name === currentUser ? p.name + " (You)" : p.name)
            .mapObject(p => p.length)
            .pairs()
            .sortBy(b => -b[1])
            .value()
    }

    static gameCount(plays) {
        return _.uniq(plays, false, play => play.game.name).length
    }

    static playCount(plays) {
        return plays.length
    }

    static playCountByGame(plays) {
        return _.chain(plays)
            .groupBy(boardgameName)
            .mapObject(_.size)
            .pairs()
            .sortBy(b => -b[1])
            .value()
    }

    // --- util --------------------------------------------------------------------------------------------------------
    static played(plays, playerName) {
        return _.chain(plays)
            .filter(play => _.any(play.players, player => player.name === playerName))
            .value()
    }

    static years(plays) {
        return _.chain(plays)
            .map(play => play.date.split("-")[0])
            .uniq()
            .value()
    }


    static boardgame(plays, boardgameName) {
        return _.chain(plays)
            .filter(play => play.game.name === boardgameName)
            .value()
    }

    static players(plays) {
        return _.chain(plays)
            .map(play => _.pluck(play.players, 'name'))
            .flatten()
            .uniq()
            .value()
    }

    static boardgames(plays) {
        return _.chain(plays)
            .map(play => play.game.name)
            .flatten()
            .uniq()
            .value()
    }

    static longestPlayerStreak(plays, player, streakPredicate) {
        return _.chain(this.played(plays, player))
            .sortBy(play => play.date)
            .reduce((memo, play) => {
                const success = streakPredicate(play)
                if(success) {
                    memo.current = memo.current + 1
                    if(memo.current >= memo.max) {
                        memo.max = memo.current
                    }
                } else {
                    memo.current = 0
                }

                return memo
            }, { max: 0, current: 0 })
            .value()
            .max
    }
    // --- util --------------------------------------------------------------------------------------------------------


    static period(plays) {
        const dates = _.chain(plays).pluck('date').sort().value()
        return {
            from: _.first(dates),
            to: _.last(dates)
        }
    }

    static report(atrributes, plays, playerName) {
        return _.chain(atrributes)
            .map(attribute => [attribute, this[attribute](plays, playerName)])
            .object()
            .value()
    }
}


module.exports = Statistician