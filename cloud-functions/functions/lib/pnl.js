"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTradeMap = exports.updateTrade = exports.updatePNL = void 0;
const axios_1 = require("axios");
const firebase_1 = require("./firebase");
const functions = require("firebase-functions");
// import * as admin from "firebase-admin";
async function getPrice(symbol, exchange) {
    const data = {
        "exchange": exchange,
        "command": "get_price",
        "args": {
            "symbol": symbol
        }
    };
    const priceData = await axios_1.default.post('https://connect.blankly.finance', data).catch((e) => { console.log("PRICE"); });
    return Number(priceData.data.result);
}
async function generateMetrics(id, modelId, PNLValue) {
    // generate live metrics
    const response = await axios_1.default.post('https://metrics-service-api-67jfnx2vvq-uc.a.run.app/get-metrics', {
        accountValues: PNLValue,
    }).catch((e) => { console.log("METRICS BROKE"); });
    if (!response) {
        return;
    }
    const quantstats = response.data;
    (0, firebase_1.setDoc)(`/projects/${id}/models/${modelId}/metrics/blankly`, {
        metrics: quantstats.metrics
    });
    (0, firebase_1.setDoc)(`/projects/${id}/models/${modelId}/timeseriesMetrics/blankly`, {
        timeseriesMetrics: quantstats.timeseriesMetrics
    });
}
async function updateState(PNLState, trade) {
    // catch faulty trades
    if (trade.price == undefined || trade.exchange == undefined || trade.side == undefined || isNaN(trade.size) || isNaN(trade.price)) {
        return;
    }
    if (!PNLState[trade.symbol]) {
        PNLState[trade.symbol] = { size: 0, principal: 0, exchange: trade.exchange };
    }
    if (trade.side == 'buy') {
        PNLState[trade.symbol].size += Number(trade.size);
        PNLState[trade.symbol].principal += Number(trade.size) * Number(trade.price);
    }
    else if (trade.side == 'sell') {
        PNLState[trade.symbol].size -= Number(trade.size);
        PNLState[trade.symbol].principal -= Number(trade.size) * (trade.price);
    }
    return;
}
async function rerunGetPNL(id, modelId, PNLState) {
    await (0, firebase_1.deleteDoc)(`/projects/${id}/models/${modelId}/PNL/PNLState`);
    await (0, firebase_1.deleteDoc)(`/projects/${id}/models/${modelId}/PNL/PNLValue`);
    if (Object.keys(PNLState.state).length > 0) {
        return await getPNL(id, modelId, PNLState);
    }
}
async function getPNL(id, modelId, PNLState) {
    let broken = false;
    let PNL = 0;
    if (PNLState.state) {
        for (const object of Object.entries(PNLState.state)) {
            const key = object[0];
            const value = object[1];
            if (!value.exchange || value.principal == undefined || isNaN(value.principal) || value.size == undefined || isNaN(value.size)) {
                broken = true;
                break;
            }
            const price = await getPrice(key, value.exchange);
            PNL += (price * value.size) - value.principal;
        }
    }
    if (broken) {
        const newState = await calculatePNL(id, modelId);
        return await rerunGetPNL(id, modelId, newState);
    }
    return PNL;
}
async function calculatePNL(id, modelId) {
    const trades = await (0, firebase_1.getCollection)(`/projects/${id}/models/${modelId}/trades`);
    const PNLState = {};
    trades.forEach((trade) => {
        updateState(PNLState, trade);
    });
    await (0, firebase_1.setDoc)(`/projects/${id}/models/${modelId}/PNL/PNLState`, { state: PNLState });
    return { state: PNLState };
}
const updatePNLLocal = async function () {
    const modelPNL = async function (modelId, id) {
        const modelSettings = await (0, firebase_1.getDoc)(`/projects/${id}/models/${modelId}`);
        if (modelSettings.enablePNL === undefined || modelSettings.enablePNL === true) {
            // This is the true case
        }
        else {
            // Don't do anything if the case above isn't met
            // Await this coward
            return undefined;
        }
        const PNLState = await (0, firebase_1.getDoc)(`/projects/${id}/models/${modelId}/PNL/PNLState`);
        if (!PNLState.exists) {
            // handle backgenerate PNLState and account value
            (0, firebase_1.setDoc)(`/projects/${id}/models/${modelId}/PNL/PNLValue`, { PNLValue: [{ time: Date.now() / 1000, value: 0 }] });
            return await calculatePNL(id, modelId);
        }
        else {
            // calculate pnl point
            const PNL = await getPNL(id, modelId, PNLState);
            // update pnl timeseries
            const doc = await (0, firebase_1.getDoc)(`/projects/${id}/models/${modelId}/PNL/PNLValue`);
            let PNLValue = doc.PNLValue;
            if (PNLValue == undefined) {
                PNLValue = [{ time: Date.now() / 1000, value: PNL }];
                return await (0, firebase_1.setDoc)(`/projects/${id}/models/${modelId}/PNL/PNLValue`, { PNLValue: PNLValue });
            }
            else {
                PNLValue.push({ time: Date.now() / 1000, value: PNL });
                (0, firebase_1.setDoc)(`/projects/${id}/models/${modelId}/PNL/PNLValue`, { PNLValue: PNLValue });
                return await generateMetrics(id, modelId, PNLValue);
            }
        }
    };
    const projects = await (0, firebase_1.getCollection)('/projects');
    const ids = projects.map(project => project.id);
    // const ids = ['sogE54jRuvf0X7ZHx3yrbTFav9O2']
    for (const id of ids) {
        const models = await (0, firebase_1.getCollection)(`/projects/${id}/models`);
        const modelIds = models.map(model => model.id);
        const promises = modelIds.map(modelId => modelPNL(modelId, id));
        await Promise.all(promises);
    }
    return;
};
exports.updatePNL = functions.pubsub
    .schedule('0 */6 * * *')
    .onRun(updatePNLLocal);
exports.updateTrade = functions.firestore.document('/projects/{projectId}/models/{modelId}/trades/{tradeId}').onCreate(async (change, context) => {
    const id = context.params.projectId;
    const modelId = context.params.modelId;
    const tradeId = context.params.tradeId;
    const trade = change.data();
    // update trade with buy price
    const price = await getPrice(change.data().symbol, change.data().exchange);
    // catch bad trades
    if (isNaN(Number(trade.size)) || isNaN(Number(trade.time))) {
        (0, firebase_1.deleteDoc)(`/projects/${id}/models/${modelId}/trades/${tradeId}`);
        return;
    }
    trade["price"] = price;
    trade["size"] = Number(trade.size);
    trade["time"] = Number(trade.time);
    (0, firebase_1.setDoc)(`/projects/${id}/models/${modelId}/trades/${tradeId}`, trade);
    // update master trades list and PNL state
    const doc = await (0, firebase_1.getDoc)(`/projects/${id}/models/${modelId}/PNL/PNLState`);
    let PNLState = doc.state;
    if (!PNLState) {
        await calculatePNL(id, modelId);
        return;
    }
    else {
        await updateState(PNLState, trade);
        (0, firebase_1.setDoc)(`/projects/${id}/models/${modelId}/PNL/PNLState`, { state: PNLState });
        return;
    }
});
exports.updateTradeMap = functions.firestore.document('/projects/{projectId}/models/{modelId}/trades/{tradeId}').onWrite(async (change, context) => {
    const MAX_TRADE_MAP_SIZE = 1000;
    const projectId = context.params.projectId;
    const modelId = context.params.modelId;
    const tradeId = context.params.tradeId;
    const newTrade = change.after.data();
    if (!newTrade || newTrade?.price) {
        const tradeMapsCollection = await (0, firebase_1.getCollection)(`/projects/${projectId}/models/${modelId}/PNL/trades/trades`);
        // trade maps collection doesn't exist
        if (tradeMapsCollection.length === 0) {
            console.log('TRADE MAPS COLLECTION DOESNT EXIST');
            const trades = await (0, firebase_1.getCollection)(`/projects/${projectId}/models/${modelId}/trades`);
            let tradeChunks = [];
            if (trades.length > MAX_TRADE_MAP_SIZE) {
                // split trades array into MAX_TRADE_MAP_SIZE chunks
                while (trades.length > 0) {
                    const chunk = trades.splice(0, MAX_TRADE_MAP_SIZE);
                    tradeChunks.push(chunk);
                }
            }
            else {
                tradeChunks = [trades];
            }
            // set documents 0 -> num chunks
            for (const [i, tradeChunk] of tradeChunks.entries()) {
                const tradeMap = {};
                tradeChunk.forEach((trade) => {
                    tradeMap[trade.id] = { ...trade };
                });
                (0, firebase_1.setDoc)(`/projects/${projectId}/models/${modelId}/PNL/trades/trades/${i}`, {
                    trades: tradeMap
                });
            }
            // set placeholder in PNL/trades document so document 'exists' to firebase
            (0, firebase_1.setDoc)(`/projects/${projectId}/models/${modelId}/PNL/trades`, {
                placeholder: 'placeholder'
            });
            return;
        }
        // trade maps collection exists
        // find index in trade map for modified or deleted trade
        let tradeMapIndex = tradeMapsCollection.findIndex((tradeMap) => {
            return tradeId in tradeMap.trades;
        });
        // find index in trade map for new trade
        if (tradeMapIndex === -1) {
            tradeMapIndex = tradeMapsCollection.findIndex((tradeMap) => {
                return Object.keys(tradeMap.trades).length < MAX_TRADE_MAP_SIZE;
            });
            if (tradeMapIndex === -1) {
                tradeMapIndex = tradeMapsCollection.length;
            }
        }
        (0, firebase_1.setDoc)(`/projects/${projectId}/models/${modelId}/PNL/trades/trades/${tradeMapIndex}`, {
            trades: {
                [tradeId]: newTrade ? { id: tradeId, ...newTrade } : firebase_1.deleteField
            }
        });
    }
});
// if (process.env.LOCAL == '1') {
//     const serviceAccount = require("../key.json");
//     admin.initializeApp({
//         credential: admin.credential.cert(serviceAccount),
//         databaseURL: 'https://blankly-6ada5.firebaseio.com/'
//     });
//     updatePNLLocal().then(r => console.log("finished"))
// }
//# sourceMappingURL=pnl.js.map