"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTickers = void 0;
const firebase_1 = require("./firebase");
const functions = require("firebase-functions");
exports.updateTickers = functions.firestore.document('/projects/{projectId}/models/{modelId}/trades/{tradeId}').onCreate(async (change, context) => {
    const projectId = context.params.projectId;
    const modelId = context.params.modelId;
    const trade = change.data();
    // get current tickers object
    const doc = await (0, firebase_1.getDoc)(`/projects/${projectId}/models/${modelId}`);
    const tickers = doc.tickers;
    const newTicker = trade.symbol;
    if (!(newTicker in tickers)) {
        // add ticker to tickers array
        tickers[newTicker] = newTicker;
    }
    (0, firebase_1.setDoc)(`/projects/${projectId}/models/${modelId}`, {
        tickers: tickers
    });
});
//# sourceMappingURL=trade.js.map