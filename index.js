const Statistician = require("./src/Statistician")
const BggApi = require("./src/BggApi")
const moment = require('moment')
const util = require('util');
const _ = require('underscore')


function statsForCurrentAndPreviousPeriod(plays, currentUser, period) {
    const currentPeriod = moment()
    const previousPeriod = moment().subtract(1, period).startOf(period)
    const playsForCurrentPeriod = _.filter(plays, play => currentPeriod.isSame(play.date, period))
    const playsForPreviousPeriod = _.filter(plays, play => previousPeriod.isSame(play.date, period))

    // todo should be just one period and bring them together here
    // todo be able to specify the metrics we want as well so we can do days heat map
    return Statistician.report(playsForCurrentPeriod, playsForPreviousPeriod, currentUser)
}

async function main() {

    const currentUser = 'James'
    const api = new BggApi()
    const user = await api.user('kouphax')
    const plays = await api.plays('kouphax')
    const participated = _.filter(plays, play => _.any(play.players.player, player => player.name === currentUser))
    const weeklyStats = statsForCurrentAndPreviousPeriod(participated, currentUser, 'year')

    function dump(stuff) {
        console.log(util.inspect(stuff, false, null))
    }

    dump(weeklyStats)
}

main()
