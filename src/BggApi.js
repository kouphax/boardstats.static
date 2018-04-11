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

        // convert some stuff to arrays the should be arrays
        plays = _.chain(plays)
            .map(play => {
                if(!_.isArray(play.players.player)) {
                    play.players.player = [play.players.player]
                }
                return play
            })
            .value()

        return plays
    }
}

module.exports = BggApi
