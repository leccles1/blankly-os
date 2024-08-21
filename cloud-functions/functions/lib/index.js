"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOpengraphData = exports.addToSubstack = void 0;
const functions = require("firebase-functions");
const axios_1 = require("axios");
const opengraph_1 = require("./opengraph");
exports.addToSubstack = functions.firestore.document('waitlist/{email}').onCreate(async (change, context) => {
    const newSubscriber = change.data();
    const email = newSubscriber.email;
    functions.logger.info(`Adding ${email} to Substack List`);
    const body = {
        first_url: 'https://blankly.substack.com/embed',
        first_referrer: 'https://blankly.finance',
        current_url: 'https://blankly.substack.com/embed',
        current_referrer: 'https://blankly.finance',
        referral_code: '',
        source: 'embed',
        email,
    };
    const response = await axios_1.default.post('https://blankly.substack.com/api/v1/free', body, {
        headers: {
            "Content-Type": "application/json",
        }
    });
    functions.logger.info(`Response from Substack: ${response.status}, ${response.statusText}`);
    return;
});
const DEFAULT_OPENGRAPH = {
    title: 'Blankly Finance',
    description: 'Build in minutes. Deploy in seconds. Quant workflow reimagined. Algotrading without the headache 🚀',
    image: 'https://storage.googleapis.com/blankly-6ada5.appspot.com/default-preview.png'
};
exports.getOpengraphData = functions.https.onRequest((req, res) => {
    const html = req.query.html === '1';
    return (0, opengraph_1.generateOpengraphData)(req, html).then((data) => {
        if (html) {
            res.status(200).send(data);
        }
        else {
            res.json(data).end();
        }
    }).catch((err) => {
        console.log(err);
        if (html) {
            res.status(200).send('<h1>404</h1>');
        }
        else {
            res.json(DEFAULT_OPENGRAPH).end();
        }
    });
});
__exportStar(require("./activity"), exports);
__exportStar(require("./usage"), exports);
__exportStar(require("./email"), exports);
__exportStar(require("./crud"), exports);
__exportStar(require("./pnl"), exports);
__exportStar(require("./team"), exports);
__exportStar(require("./starter-models"), exports);
__exportStar(require("./trade"), exports);
//# sourceMappingURL=index.js.map