var verbose = false

var util = require("util"),
    _ = require("underscore"),
    request    = require("request"),
    crypto = require("crypto"),
    VError = require("verror")
//    md5 = require("MD5")

var Cryptopia = function Cryptopia(api_key, secret, hostname, timeout)
{
    this.api_key = api_key
    this.secret = secret

    this.hostname = hostname || "www.cryptopia.co.nz"
    this.server = "https://" + this.hostname
    this.publicApiPath = "api"
    this.privateApiPath = "api"

    this.timeout = timeout || 20000
}

var headers = {"User-Agent": "nodejs-7.5-api-client"}

Cryptopia.prototype.privateRequest = function(method, params, callback)
{
    var functionName = "Cryptopia.privateRequest()",
        self = this

    var error

    if(!this.api_key || !this.secret)
    {
        error = new VError("%s must provide api_key and secret to make this API request.", functionName)
        return callback(error)
    }

    if(!_.isObject(params))
    {
        error = new VError("%s second parameter %s must be an object. If no params then pass an empty object {}", functionName, params)
        return callback(error)
    }

    if (!callback || typeof(callback) != "function")
    {
        error = new VError("%s third parameter needs to be a callback function", functionName)
        return callback(error)
    }

    var uri = this.privateApiPath + "/" + method
    var url = this.server + "/" + uri

    var nonce = Math.floor(new Date().getTime() / 1000)
    var md5 = crypto.createHash("md5").update( JSON.stringify( params ) ).digest()
    var requestContentBase64String = md5.toString("base64")
    var signature = this.api_key + "POST" + encodeURIComponent( url ).toLowerCase() + nonce + requestContentBase64String
    var hmacsignature = crypto.createHmac("sha256", new Buffer( this.secret, "base64" ) ).update( signature ).digest().toString("base64")
    var header_value = "amx " + this.api_key + ":" + hmacsignature + ":" + nonce

    var headers = {
        "Authorization": header_value,
        "Content-Type":"application/json; charset=utf-8",
        "Content-Length" : Buffer.byteLength(JSON.stringify(params)),
        "User-Agent": "nodejs-7.5-api-client"
    }
    var options = {
        //host: this.hostname,
        //path: uri,
        url: url,
        method: "POST",
        headers: headers,
        form: JSON.stringify( params )
    }

    var requestDesc = util.format("%s request to url %s with method %s and params %s",
        options.method, url, method, JSON.stringify(params))

    executeRequest(options, requestDesc, callback)
}

Cryptopia.prototype.publicRequest = function(method, params, callback)
{
    var functionName = "Cryptopia.publicRequest()"
    var error

    if(!_.isObject(params))
    {
        error = new VError("%s second parameter %s must be an object. If no params then pass an empty object {}", functionName, params)
        return callback(error)
    }

    if (!callback || typeof(callback) != "function")
    {
        error = new VError("%s third parameter needs to be a callback function with err and data parameters", functionName)
        return callback(error)
    }

    var url = this.server + "/" + this.publicApiPath + "/" + method + ""
    if (verbose) console.log("Request URL is: " + url)

    var options = {
        url: url,
        method: "GET",
        headers: headers,
        timeout: this.timeout,
        qs: params,
        json: {}        // request will parse the json response into an object
    }

    var requestDesc = util.format("%s request to url %s with parameters %s",
        options.method, options.url, JSON.stringify(params))

    executeRequest(options, requestDesc, callback)
}

function executeRequest(options, requestDesc, callback)
{
    var functionName = "Cryptopia.executeRequest()"

    request(options, function(err, response, data)
    {
        var error = null,   // default to no errors
            returnObject = data

        if(err)
        {
            error = new VError(err, "%s failed %s", functionName, requestDesc)
            error.name = err.code
        }
        else if (response.statusCode < 200 || response.statusCode >= 300)
        {
            error = new VError("%s HTTP status code %s returned from %s", functionName,
                response.statusCode, requestDesc)
            error.name = response.statusCode
        }
        else if (options.form)
        {
            try {
                returnObject = JSON.parse(data)
            }
            catch(e) {
                error = new VError(e, "Could not parse response from server: " + data)
            }
        }
        // if json request was not able to parse json response into an object
        else if (options.json && !_.isObject(data) )
        {
            error = new VError("%s could not parse response from %s\nResponse: %s", functionName, requestDesc, data)
        }

        if (_.has(returnObject, "error_code"))
        {
            var errorMessage = mapErrorMessage(returnObject.error_code)

            error = new VError("%s %s returned error code %s, message: '%s'", functionName,
                requestDesc, returnObject.error_code, errorMessage)

            error.name = returnObject.error_code
        }

        callback(error, returnObject)
    })
}

//
// Public Functions
//


Cryptopia.prototype.getCurrencies = function getCurrencies(callback)
{
    this.publicRequest("GetCurrencies/", {}, callback)
}

Cryptopia.prototype.getTicker = function getTicker(callback, pair)
{
    this.publicRequest("GetMarket/" + pair, {currencyPair: pair}, callback)
}

Cryptopia.prototype.getOrderBook = function getOrderBook(callback, pair, limit)
{
    var params = {
        currencyPair: pair,
        limit: 1000,
    }

    if (!_.isUndefined(limit) ) params.limit = limit

    this.publicRequest("GetMarketOrders/" + pair + "/" + params.limit, params, callback)
}

Cryptopia.prototype.getTrades = function getTrades(callback, pair, hours)
{
    var params = {
        currencyPair: pair,
        hours: 24,
    }

    if (hours) params.hours = hours

    this.publicRequest("GetMarketHistory/" + pair + "/" + params.hours, params, callback)
}

Cryptopia.prototype.getKline = function getKline(callback, symbol, type, size, since)
{
    var params = {symbol: symbol}
    if (type) params.type = type
    if (size) params.size = size
    if (since) params.since = since

    this.publicRequest("kline", params, callback)
}

Cryptopia.prototype.getLendDepth = function getLendDepth(callback, symbol)
{
    this.publicRequest("kline", {symbol: symbol}, callback)
}

//
// Private Functions
//

Cryptopia.prototype.getBalance = function getBalance(callback)
{
    this.privateRequest("GetBalance", {}, callback)
}

Cryptopia.prototype.addTrade = function addTrade(callback, symbol, type, amount, price)
{
    var params = {
        symbol: symbol,
        type: type
    }

    if (amount) params.amount = amount
    if (price) params.price = price

    this.privateRequest("trade", params, callback)
}

Cryptopia.prototype.addBatchTrades = function addBatchTrades(callback, symbol, type, orders)
{
    this.privateRequest("batch_trade", {
        symbol: symbol,
        type: type,
        orders_data: orders
    }, callback)
}

Cryptopia.prototype.cancelOrder = function cancelOrder(callback, symbol, order_id)
{
    this.privateRequest("cancel_order", {
        symbol: symbol,
        order_id: order_id
    }, callback)
}

Cryptopia.prototype.getOrderInfo = function getOrderInfo(callback, symbol, order_id)
{
    this.privateRequest("order_info", {
        symbol: symbol,
        order_id: order_id
    }, callback)
}

Cryptopia.prototype.getOrdersInfo = function getOrdersInfo(callback, symbol, type, order_id)
{
    this.privateRequest("orders_info", {
        symbol: symbol,
        type: type,
        order_id: order_id
    }, callback)
}

Cryptopia.prototype.getAccountRecords = function getAccountRecords(callback, symbol, type, current_page, page_length)
{
    this.privateRequest("account_records", {
        symbol: symbol,
        type: type,
        current_page: current_page,
        page_length: page_length
    }, callback)
}

Cryptopia.prototype.getTradeHistory = function getTradeHistory(callback, symbol, since)
{
    this.privateRequest("trade_history", {
        symbol: symbol,
        since: since
    }, callback)
}

Cryptopia.prototype.getOrderHistory = function getOrderHistory(callback, symbol, status, current_page, page_length)
{
    this.privateRequest("order_history", {
        symbol: symbol,
        status: status,
        current_page: current_page,
        page_length: page_length
    }, callback)
}

Cryptopia.prototype.addWithdraw = function addWithdraw(callback, symbol, chargefee, trade_pwd, withdraw_address, withdraw_amount)
{
    this.privateRequest("withdraw", {
        symbol: symbol,
        chargefee: chargefee,
        trade_pwd: trade_pwd,
        withdraw_address: withdraw_address,
        withdraw_amount: withdraw_amount
    }, callback)
}

Cryptopia.prototype.cancelWithdraw = function cancelWithdraw(callback, symbol, withdraw_id)
{
    this.privateRequest("cancel_withdraw", {
        symbol: symbol,
        withdraw_id: withdraw_id
    }, callback)
}

/**
 * Maps the Cryptopia error codes to error message
 * @param  {Integer}  error_code   Cryptopia error code
 * @return {String}                error message
 */
function mapErrorMessage(error_code)
{
    var errorCodes = {
        10000: "Required parameter can not be null",
        10001: "Requests are too frequent",
        10002: "System Error",
        10003: "Restricted list request, please try again later",
        10004: "IP restriction",
        10005: "Key does not exist",
        10006: "User does not exist",
        10007: "Signatures do not match",
        10008: "Illegal parameter",
        10009: "Order does not exist",
        10010: "Insufficient balance",
        10011: "Order is less than minimum trade amount",
        10012: "Unsupported symbol (not btc_usd or ltc_usd)",
        10013: "This interface only accepts https requests",
        10014: "Order price must be between 0 and 1,000,000",
        10015: "Order price differs from current market price too much",
        10016: "Insufficient coins balance",
        10017: "API authorization error",
        10026: "Loan (including reserved loan) and margin cannot be withdrawn",
        10027: "Cannot withdraw within 24 hrs of authentication information modification",
        10028: "Withdrawal amount exceeds daily limit",
        10029: "Account has unpaid loan, please cancel/pay off the loan before withdraw",
        10031: "Deposits can only be withdrawn after 6 confirmations",
        10032: "Please enabled phone/google authenticator",
        10033: "Fee higher than maximum network transaction fee",
        10034: "Fee lower than minimum network transaction fee",
        10035: "Insufficient BTC/LTC",
        10036: "Withdrawal amount too low",
        10037: "Trade password not set",
        10040: "Withdrawal cancellation fails",
        10041: "Withdrawal address not approved",
        10042: "Admin password error",
        10100: "User account frozen",
        10216: "Non-available API",
        503: "Too many requests (Http)"}

    if (!errorCodes[error_code])
    {
        return "Unknown Cryptopia error code: " + error_code
    }

    return( errorCodes[error_code] )
}

module.exports = Cryptopia
