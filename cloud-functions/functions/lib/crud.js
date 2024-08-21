"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onDeleteBacktest = exports.onCreateBacktest = exports.onDeleteTrade = exports.onCreateTrade = void 0;
const functions = require("firebase-functions");
const firebase_1 = require("./firebase");
exports.onCreateTrade = functions.firestore
    .document('projects/{projectId}/models/{modelId}/trades/{tradeId}')
    .onCreate(async (_, context) => {
    const path = `projects/${context.params.projectId}/models/${context.params.modelId}`;
    await (0, firebase_1.updateCollectionCounter)(path, 'trades', `${path}/trades`, 1);
});
exports.onDeleteTrade = functions.firestore
    .document('projects/{projectId}/models/{modelId}/trades/{tradeId}')
    .onDelete(async (_, context) => {
    const path = `projects/${context.params.projectId}/models/${context.params.modelId}`;
    await (0, firebase_1.updateCollectionCounter)(path, 'trades', `${path}/trades`, -1);
});
exports.onCreateBacktest = functions.firestore
    .document('projects/{projectId}/models/{modelId}/backtests/{backtestId}')
    .onCreate(async (_, context) => {
    const path = `projects/${context.params.projectId}/models/${context.params.modelId}`;
    await (0, firebase_1.updateCollectionCounter)(path, 'backtests', `${path}/backtests`, 1);
});
exports.onDeleteBacktest = functions.firestore
    .document('projects/{projectId}/models/{modelId}/backtests/{backtestId}')
    .onDelete(async (_, context) => {
    const path = `projects/${context.params.projectId}/models/${context.params.modelId}`;
    await (0, firebase_1.updateCollectionCounter)(path, 'backtests', `${path}/backtests`, -1);
});
//# sourceMappingURL=crud.js.map