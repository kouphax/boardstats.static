const _ = require('underscore')
const moment = require('moment')

function boardgameName(play) {
    return play.item.name
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
            .groupBy(_.identity)
            .values()
            .max(a => _.size(a) >= a[0] ? a[0] : -1)
            .flatten()
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

    static winRatio(plays, currentUser) {

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

    static newGameCount(plays, currentUser) {
        function isNewToCurrentUser(player) {
            return player.name === currentUser && player.new === 1
        }

        return _.chain(plays)
            .filter(play => _.any(play.players.player, isNewToCurrentUser))
            .map(boardgameName)
            .value()
            .length
    }

    static playerCount(plays) {
        return _.chain(plays)
            .map(p => p.players.player.length)
            .groupBy(p => "" + p + " Players")
            .mapObject(p => p.length)
            .pairs()
            .sortBy(b => -b[1])
            .value()
    }

    static playCountByPlayer(plays, currentUser) {
        return _.chain(plays)
            .map(play => play.players.player)
            .flatten(true)
            .groupBy(p => p.name === currentUser ? p.name + " (You)" : p.name)
            .mapObject(p => p.length)
            .pairs()
            .sortBy(b => -b[1])
            .value()
    }

    static gameCount(plays) {
        return _.uniq(plays, false, play => play.item.name).length
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

    static report(atrributes, plays, playerName) {
        return _.chain(atrributes)
            .map(attribute => [attribute, this[attribute](plays, playerName)])
            .object()
            .value()
    }

}


module.exports = Statistician