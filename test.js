Cryptopia = require('./index.js')
let logResponse = {}

// Either pass your API key and secret as the first and second parameters to examples.js. eg
// node examples.js your-api-key your-api-secret
//
// Or enter them below.
// WARNING never commit your API keys into a public repository.
var key = process.argv[2] || 'your-api-key';
var secret = process.argv[3] || 'your-api-secret';

// Test public data APIs
var publicClient = new Cryptopia()
var privateClient = new Cryptopia(key, secret)

// get BTCUSD ticker
publicClient.getTicker(function(err,data){
    console.log(data)
    return true}, 'BTC_USDT')

// get BTCUSD Order Book
publicClient.getOrderBook(function(err,data){
    console.log(data)
    console.log(JSON.stringify(data))
    return true}, 'BTC_USDT')


// get BTCUSD trades
publicClient.getTrades(function(err,data){
    console.log(data)
    return true}, 'BTC_USDT')

// get Account Balance
privateClient.getBalance(function(err,data){
    console.log(data)
    return true}, {})

