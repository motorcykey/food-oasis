/*
This is a work in progress to understand the capabilities and needs of a decentralized system to handle food waste and distribution autonomously
*/

const steem = require('dsteem');
const steemjs = require('steem');
const steemState = require('./processor');
const mat = require('mathjs')
const stringify = require('json-stringify-deterministic');
const IPFS = require('ipfs-api'); //consensus and auto restarts
const ipfs = new IPFS({ //public gateway for uploads and downloads
    host: 'ipfs.infura.io',
    port: 5001,
    protocol: 'https'
});
var fetch = require('node-fetch');
const express = require('express');
const cors = require('cors')
const config = require('./config');
const VERSION = 'v0.0.1wip'
const api = express()
var http = require('http').Server(api);
const prefix = 'FOOD_'; //custom json prefix
const multiname = 'food.escrow'; //claimed multisig account
const streamMode = 'irreversible';
console.log("Streaming using mode", streamMode);
var client = new steem.Client(config.clientURL);
const wif = steemjs.auth.toWif(config.username, config.activeKey, 'active')
var processor;

//force https for heroku
var https_redirect = function(req, res, next) {
    if (process.env.NODE_ENV === 'production') {
        if (req.headers['x-forwarded-proto'] != 'https') {
            return res.redirect('https://' + req.headers.host + req.url);
        } else {
            return next();
        }
    } else {
        return next();
    }
};

class helper { //hours [m,t,w,th,f,s,su,{holidays: all, named_days:}] "0 midnight, 24 midnight, .5 30 minutes, 9:17 = 9am-5pm"
    constructor(arr) { //[account, org, lat, long, ein, st1, st2, city, state, zip, legal_name, hours, website, phone_number]
        this.a = arr[0]; //account name (local)
        this.orga = arr[1] //account name of parent organization
        this.orgv = "no" //org authed this account to sign for deliveries for tax reasons
        this.loc = { la: arr[2], lo: arr[3] }; //lat and long of pick up or drop off point if stationary
        this.ein = arr[4]; //for charitable donations write offs
        this.fiv = {
            pub78: "no",
            type: "none"
        }; //populated by IRS Pub 78 search and EIN
        this.add = {
            st1: arr[5],
            st2: arr[6],
            city: arr[7],
            st: arr[8],
            zip: arr[9]
        };
        this.name = arr[10];
        this.h = {
            su: arr[11][0],
            m: arr[11][1] || arr[11][0],
            t: arr[11][2] || arr[11][1] || arr[11][0],
            w: arr[11][3] || arr[11][1] || arr[11][0],
            th: arr[11][4] || arr[11][1] || arr[11][0],
            f: arr[11][5] || arr[11][1] || arr[11][0],
            s: arr[11][6] || arr[11][0],
            h: arr[11][7],
        };
        this.rep = 1;
        this.ws = arr[11];
        this.pn = arr[12];
    }
}

api.use(https_redirect);
api.use(cors())

//state dump while building...
api.get('/', (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(stringify({ state, plasma }, null, 3))
});
//api.listen(port, () => console.log(`DLUX token API listening on port ${port}!\nAvailible commands:\n/@username =>Balance\n/stats\n/markets`))
http.listen(config.port, function() {
    console.log(`ACT API listening on port ${config.port}`);
});

//node actions out of consensus
var plasma = {
    stats: {
        bu: 0,
        bi: 0,
        bl: []
    },
    run: false
}

const deg_long_length = parseFloat(mat.cos(config.lat) * 111) //km per deg lat, 111km per deg
const lat_radius_increments = parseInt(config.radius * 200 / 111) // granularity of distribution map... roughtly 500m at 200, 50m at 2000 (2 from radius to diameter)
const long_radius_increments = parseInt(config.radius * 200 / parseFloat(deg_long_length))

function build_data_array(inc) {
    var arr = []
    for (i = 0; i < inc; i++) {
        arr.push(0)
    }
    return arr
}

var geo = {
    lat: config.lat.toFixed(2),
    long: config.long.toFixed(2),
    radius: config.radius,
    date: "init",
    iLat: build_data_array(lat_radius_increments),
    iLong: build_data_array(long_radius_increments),
    latu: (config.lat + parseFloat(lat_radius_increments / 50)).toFixed(2),
    latl: (config.lat - parseFloat(lat_radius_increments / 50)).toFixed(2),
    longu: (config.long + parseFloat(long_radius_increments / 50)).toFixed(2),
    longl: (config.long - parseFloat(long_radius_increments / 50)).toFixed(2)
}

function pop_data(meals, lat, long, data) { //supply meals (-) , demand meals (+)
    const latDif = parseInt((parseFloat(lat.toFixed(2)) - parseFloat(data.lat)) * 100)
    const longDif = parseInt((parseFloat(long.toFixed(2)) - parseFloat(data.long)) * 100)
    data.ilat[parseInt(data.ilat.length / 2) - latDif] = data.ilat[parseInt(data.ilat.length / 2) - latDif] + parseInt(meals)
    data.ilong[parseInt(data.ilong.length / 2) - longDif] = data.ilong[parseInt(data.ilong.length / 2) - longDif] + parseInt(meals)
    return data
}

function search_vector(lat, long, data) {
    const latDif = parseInt((parseFloat(lat.toFixed(2)) - parseFloat(data.lat)) * 100)
    const longDif = parseInt((parseFloat(long.toFixed(2)) - parseFloat(data.long)) * 100)
    var weighted_lat = []
    var weighted_long = []
    for (i = 0; i < data.ilat.length; i++) {
        weighted_lat.push(parseInt((i + 1) * data.ilat[i]))
    }
    for (i = 0; i < data.ilong.length; i++) {
        weighted_long.push(parseInt((i + 1) * data.ilong[i]))
    }
    const mean_lat = parseInt((mat.mean(weighted_lat) / data.ilat.length) - (data.ilat.length / 2)) //relative coordinates of largest demand
    const mean_long = parseInt((mat.mean(weighted_long) / data.ilong.length) - (data.ilong.length / 2))
    const std_lat = parseInt(mat.std(weighted_lat) / data.ilat.length) //std of demand change
    const std_long = parseInt(mat.std(weighted_long) / data.ilong.length)
    const search_lat = parseInt((mean_lat - latDif) / std_lat) //hopefully a place between the place of highest demand and where the food is 
    const search_long = parseInt((mean_long - longDif) / std_long)
    return [parseFloat((data.lat + search_lat) / 100), parseFloat((data.long + search_long) / 100)] //normallized to absolute lat/long
}

//auto starts ... polls recent ipfs posted from node account
steemjs.api.getAccountHistory(config.username, -1, 100, function(err, result) {
    var recents = []
    if (err) {
        console.log(err)
        startWith(sh)
    } else {
        let ebus = result.filter(tx => tx[1].op[1].id === `${prefix}_report`)
        for (i = ebus.length - 1; i >= 0; i--) {
            if (JSON.parse(ebus[i][1].op[1].json).stateHash !== null) {
                recents.push(JSON.parse(ebus[i][1].op[1].json).stateHash)
            }
        }
        if (recents.length) { //build a list to pull from IPFS starting with most recent
            const mostRecent = recents.shift()
            console.log('Most recent backup: ' + mostRecent)
            startWith(mostRecent, recents)
        } else {
            startWith(config.ec)
        }
    }
});

function startWith(hash, recents) {
    var arr = recents || []
    updateBlacklist() //out of consensus
    if (hash) {
        console.log(`Attempting to start from IPFS save state ${hash}`);
        ipfs.cat(hash, (err, file) => {
            if (!err) {
                var data = JSON.parse(file.toString()) //build some intial condistions for blockstreaming
                plasma.stats.bi = data[0]
                plasma.stats.bu = hash
                state = data[1]
                startApp();
            } else { //fall through
                if (arr.length) { const notRecent = arr.shift() }
                console.log('Retrival failed, trying: ' + notRecent)
                if (notRecent && arr.length) {
                    startWith(notRecent, arr)
                } else if (notRecent) {
                    startWith(notRecent)
                } else {
                    startWith()
                }
            }
        });
    } else { //initial conditions
        state = {
            accounts: {}, //created accounts still recieving delegation
            agents: {}, //agents
            bot: [], //list of ops to include this block
            contracts: {}, //scheduled delegation payouts
            feed: {},
            keyPairs: {}, //key:account
            qa: [], //account queue
            qd: [], //delegation queue
            stats: {
                bu: 0, //consensus backup
                bi: 36010000, //starting block with backup
                auths: 1, // number of owners
                thresh: 1, // threshhold parseInt(2/3)*auths + 1
                intadj: 3600, //block per period
                inv: 0, //total inventory
                invp: 0, //inventory period
                so: 0, //sold out
                pri: 1305, //price of accounts
                di: 0, //delegation inventory
                prd: 295, //price for 30 days of 15_SP delegation 0.295 steem
                auth: {}, //accounts holding authority
                msi: {}, //multisig info
                msp: {}, //multisig poll
                sigs: [] //sigs for current block
            },
            tx: {}, // op waiting for signatures
        }
        plasma.stats.bi = 36010000
        startApp()
    }
}


function startApp() {
    console.log(plasma.stats.bi)
    processor = steemState(client, steem, plasma.stats.bi, 10, prefix, streamMode);
    /*
        processor.onOperation('delegate_vesting_shares', function(json) {
            // maybe something for donations of SP
        });
        - location
        - food quantity
        - food expiration, in hours... = nonperishable
        - food category (perishable, non-perishable)
        - transportation mode
        - operating hours
    */
    processor.on('donate', function(json, from, active) {
        local = false
        if (json.lat > geo.latl && json.lat < geo.latu && json.long > geo.longl && json.long < geo.longu) {
            local = true
        } //does this node care?
        var meals, exp, cat = parseInt(json.cat),
            req = parseInt(json.req),
            avail = parseInt(json.availible),
            asset
        if (!json.meals && json.weight) {
            meals = parseInt(json.weight / config.meal_weight)
        } else {
            meals = parseInt(json.meals)
        }
        if (parseInt(json.exp) > 720) {
            exp = 720
        } else {
            exp = parseInt(json.exp)
        }
        if (avail && req && cat) {
            asset = {
                a = json.lat, //lAtitude
                o = json.long, //lOngtitude
                m = meals, //normalized meals, set in config
                e = exp, //food expires in hours
                v = avail, //minutes left to pickup
                c = cat, //food category
                r = req, //minutes left to pick up
                b = json.block_num, //self ref & timestamp
                d = 0.0, //distance
                s = '' //store
            }
        }
        if (asset) {
            if (local) { //
                geo = pop_data(meals, json.lat, json.long, geo)
                if (lstate.task[from[0]] === null) {
                    lstate.task[from[0]] = {}
                }
                lstate.task[from[0]][json.block_num] = asset
                if (lstate.chron[parseInt(json.block_num + (avail * 20))] == null) {
                    lstate.chron[parseInt(json.block_num + (avail * 20))] = {}
                }
                lstate.chron[parseInt(json.block_num + (avail * 20))][from[0]] = json.block_num; //chron delete after close
                // matching algo goes here

            }
            if (state.profile[from[0]] === null) {
                state.profile[from[0]] = {
                    a: '', //anchor account
                    m: 0, //meals
                    x: 0, //actions
                    d: 0.0, //distance
                    t: 0, //trust
                    e: {}, //edges
                    f: {}, //faults
                    r: {}, //reciepts
                }
            }
            state.profile[from[0]].x++;
            state.profile[from[0]].r[json.block_num] = 0

        }
    });
    processor.on('transport_start', function(json, from, active) { //json{id(blocknum of donor request), must be signed by donor}
        let d, t
        if (from.length == 2) { //two party sig
            if (state.profile[from[0]].r[json.id] != null) {
                d = from[0]
                t = from[1]
            } else if (state.profile[from[1]].r[json.id] != null) {
                d = from[1]
                t = from[0]
            }
            if (d && t) {
                if (state.profile[d].e[t] == null) {
                    state.profile[d].e[t] = 0
                }
                state.profile[d].e[t]++; //count interactions with transporter
                state.profile[d].r[json.id] = `${t}:${json.block_num}` //transfered to on
                if (state.profile[t] === null) {
                    state.profile[t] = {
                        a: '', //anchor account
                        m: 0, //meals
                        x: 0, //actions
                        d: 0.0, //distance
                        t: 0, //trust
                        e: {}, //edges
                        f: {}, //faults
                        r: {}, //reciepts
                    }
                }
                state.profile[t].x++;
                state.profile[t].r[json.id] = d //reference to initial asset
                if (state.profile[t].e[d] == null) {
                    state.profile[t].e[d] = 0
                }
                state.profile[t].e[d]++; //count edge here too
            }
        }
    });
    processor.on('transport_end', function(json, from, active) {
        let t, r
        if (from.length == 2) { //two party sig
            if (state.profile[from[0]].r[json.id] != null) {
                t = from[0]
                r = from[1]
            } else if (state.profile[from[1]].r[json.id] != null) {
                t = from[1]
                r = from[0]
            }

            //more reciept magic
        }
    });
    processor.on('mealspd', function(json, from, active) { //meals per day --- effectively a request for meals from the system
        let a = '',
            meals = parseInt(json.meals)
        if (meals > 0) {
            meals = meals * -1
        }
        if (state.profile[from[0]] != null) {
            a = state.profile[from[0]].a
        }

        if (state.anchor[a] != null) { //registered charities only
            if (state.anchor[a][json.loc] != null) {
                local = false
                if (state.anchor[a][json.loc].lat > geo.latl && state.anchor[a][json.loc].lat < geo.latu && state.anchor[a][json.loc].long > geo.longl && state.anchor[a][json.loc].long < geo.longu) {
                    local = true
                }
                if (local) {
                    geo = pop_data(meals, state.anchor[a][json.loc].lat, state.anchor[a][json.loc].long, geo)

                }
            }
        }
    });

    processor.onBlock(function(num, block) {
        console.log(block)
        if (block.timestamp.split('T')[1].split(':')[1] === '00' && block.timestamp.split('T')[1].split(':')[2] === '00') {

        }
        var ops = []
            /*
            if (state.agents[config.username].bot[num] != null) { //state ops
                for (var op in state.agents[config.username].bot[num]) {
                    ops.push(state.agents[config.username].bot[num][op])
                }
            }
            */
        if (plasma.bot[num] != null) { //personal ops
            var customJsonNum = 0
            var ops = []
            for (var i = 0; i < plasma.bot[num].length; i++) {
                var op
                if (plasma.bot[num][i][0] == 'customJson') {
                    if (!customJsonNum) {
                        op = {
                            required_auths: [config.username],
                            required_posting_auths: [],
                            id: prefix + plasma.bot[num][i][1],
                            json: stringify(plasma.bot[num][i][2]),
                        }
                        ops.push(["custom_json", op])
                    } else { //push customJson since only one is allowed per block
                        if (Object.keys(plasma.bot).indexOf(`${parseInt(num + 2)}`) >= 0) {
                            plasma.bot[parseInt(num + 2)].push(plasma.bot[num][i])
                        } else {
                            plasma.bot[parseInt(num + 2)] = [plasma.bot[num][i]]
                        }
                    }
                    customJsonNum++
                } else {
                    ops.push(plasma.bot[num][i])
                }
            }
            delete plasma.bot[num]
        }
        if (ops.length) {
            bot.sign.call(this, ops)
        }
        if (num % 100 === 1 && processor.isStreaming()) {
            const blockState = Buffer.from(stringify([num, state]))
            ipfsSaveState(num, blockState)
        }
    })


    processor.onStreamingStart(function() {});

    processor.start();
}

function restart(consensus) { //restart after failing consensus
    console.log(`Restarting with ${consensus}...`);
    processor.stop(function() {
        plasma = {
            stats: {
                bu: 0,
                bi: 0,
                bl: []
            },
            run: false
        }
        if (consensus) {
            startWith(consensus)
        }
    });
}

/* //for testing
checkEIN(812925780)
    .then(function(r, e) {})
    .catch(function(e) {})
*/

function checkEIN(ein) { //needs work... getting blank second page .. use a better scaper... session aware
    return new Promise(function(resolve, reject) {
        fetch(`https://apps.irs.gov/app/eos/allSearch.do?ein1=${ein}&names=&resultsPerPage=25&indexOfFirstRow=0&dispatchMethod=searchAll&city=&state=All+States&country=US&postDateFrom=&postDateTo=&exemptTypeCode=al&deductibility=all&sortColumn=orgName&isDescending=false&submitName
`)
            .then(function(response) {
                return response.text();
            })
            .then(function(text) {
                const rez = text
                if (rez.split('"result-orgname"')[1]) {
                    var link = text.split('"result-orgname"')[1].split('"')[1]
                    console.log(link)
                    let cos = link.indexOf(';') //remove session info //this didn't work
                    let coe = link.indexOf('?')
                    link = link.slice(0, cos) + link.slice(coe, -1)
                    console.log(link)
                    fetch(`https://apps.irs.gov${link}`)
                        .then(function(resp) {
                            return resp.text();
                        })
                        .then(function(data78) {
                            if (data78.indexOf('Publication 78') >= 0) {
                                let ret = data78.split('#deductibilityModal')[1]
                                    //console.log(ret)
                                    //console.log(data78)
                                    //console.log(mret)
                                resolve(['yes', ret]) //find organization type
                            } else {
                                resolve(['no', ])
                            }
                        })
                        .catch(function(e) {
                            console.log(e)
                            reject(e)
                        })
                }
            })
            .catch(function(e) {
                console.log(e)
                reject(e)
            })
    })
}

function updateBlacklist() { //steem accounts that are known not to play well
    fetch(`${config.bl}`)
        .then(function(response) {
            return response.text();
        })
        .then(function(text) {
            var arr = text.split('\n')
            plasma.blacklist = arr
            ipfs.add(Buffer.from(text, 'ascii'), (err, IpFsHash) => {
                if (!err) {
                    plasma.stats.bl = IpFsHash[0].hash
                } else {
                    console.log('IPFS Error', err)
                }
            })
        })
        .catch(function(e) {
            console.log(e)
        })
}

//poll for time and blockheader and prefix to build deterministic txs for multisig
function ipfsSaveState(blocknum, hashable) {
    ipfs.add(Buffer.from(stringify([blocknum, hashable]), 'ascii'), (err, IpFsHash) => {
        if (!err) {
            plasma.stats.bu = IpFsHash[0].hash
            plasma.stats.bi = blocknum
            var poll = [],
                dsp = []
            var pollKeys = Object.keys(plasma.agents)
            if (pollKeys.length) {
                for (i = 0; i < pollKeys.length; i++) {
                    poll.push(`${pollKeys[i]}:${plasma.agents[pollKeys[i]].i}:${plasma.agents[pollKeys[i]].p}`)
                }
            }
            var dspKeys = Object.keys(plasma.dsp)
            if (dspKeys.length) {
                for (i = 0; i < dspKeys.length; i++) {
                    dsp.push(`${dspKeys[i]}:${plasma.dsp[dspKeys[i]].v}:${plasma.dsp[dspKeys[i]].vout}}`)
                }
            }
            plasma.agents = {}
            plasma.dsp = {}
            var msi = {}
            console.log(blocknum + `:Saved:  ${IpFsHash[0].hash}`)
            client.database.getDynamicGlobalProperties()
                .then(function(result) {
                    msi.rbn = result.head_block_number & 0xFFFF;
                    msi.rbp = Buffer.from(result.head_block_id, 'hex').readUInt32LE(4);
                    msi.exp = new Date(Date.now() + 540000).toISOString().slice(0, -7); //9 minutes
                    msi.exp = msi.exp + '00'
                    if (Object.keys(plasma.bot).indexOf(`${parseInt(blocknum + 2)}`) >= 0) {
                        plasma.bot[parseInt(blocknum + 2)].push(['customJson', 'con_bu', {
                            stateHash: plasma.stats.bu,
                            block: blocknum,
                            blackHash: plasma.stats.bl,
                            polls: poll,
                            dsp: dsp,
                            msi: msi,
                            sig: plasma.sig
                        }])
                    } else {
                        plasma.bot[parseInt(blocknum + 2)] = [
                            ['customJson', 'con_bu', {
                                stateHash: plasma.stats.bu,
                                block: blocknum,
                                blackHash: plasma.stats.bl,
                                polls: poll,
                                dsp: dsp,
                                msi: msi,
                                sig: plasma.sig
                            }]
                        ]
                    }
                    delete plasma.sig
                });
        } else {
            console.log('IPFS Error', err)
        }
    })
};


var bot = {
    customJson: function(id, json, callback) { // only one allowed per block
        if (json.block > processor.getCurrentBlockNumber() - 100) {
            steemjs.broadcast.json({
                required_auths: [config.username],
                required_posting_auths: [],
                id: prefix + id,
                json: stringify(json),
            }, wif).then(
                result => {
                    console.log('Signed ${json}')
                    delete plasma.bot[parseInt(json.block + 2)]
                },
                error => {
                    console.log('Error sending customJson')
                }
            )
        }
    },
    sign: function(ops, callback) { //sign & send
        client.broadcast.sendOperations(ops, wif).then(
            function(result) {
                console.log('signed sign')
                callback()
            },
            function(error) {
                console.log(error)
            }
        );
    },
    send: function(ops, callback) { //multis
        client.broadcast.send(ops).then(
            function(result) {
                console.log('signed send')
                callback()
            },
            function(error) {
                console.log(error)
            }
        );
    }
}
