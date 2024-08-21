"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateOpengraphData = void 0;
const fs_1 = require("fs");
const fs = require("fs");
const admin = require("firebase-admin");
const firebase_1 = require("./firebase");
const mime_types_1 = require("mime-types");
const nodeHtmlToImage = require('node-html-to-image');
const Handlebars = require('handlebars');
const generateOpengraphData = async (req, html) => {
    const projectId = req.query.projectId;
    const modelId = req.query.modelId;
    const backtestId = req.query.backtestId;
    if (!projectId || !modelId)
        throw Error('either projectId or modelId was not specified');
    const model = await (0, firebase_1.getDocOrError)(`/projects/${projectId}/models/${modelId}`);
    if (!model.share) {
        throw Error(`not generating opengraph data for private model ${modelId}`);
    } // don't do opengraph for private models
    const project = await (0, firebase_1.getDocOrError)(`/projects/${projectId}`);
    if (backtestId) {
        return await generateBacktestOpengraph(project, model, backtestId, html);
    }
    else {
        return await generateModelOpengraph(project, model, html);
    }
};
exports.generateOpengraphData = generateOpengraphData;
async function generateModelOpengraph(project, model, html) {
    const description = model.description;
    const title = model.name;
    const imageUrl = await generateImage(model.id, 'opengraph-static/templates/model.hbs', false, async () => {
        const profile = await getUserProfile(project);
        const pnl = model.PNL?.reverse()?.find((o) => !isNaN(o.value))?.value || 0;
        return {
            title: title,
            description: description,
            tickers: Object.values(model.tickers || {}).join(', '),
            exchange: Object.values(model?.exchanges || {})?.[0],
            trades: trimNumber(model.trades || 0),
            backtests: trimNumber(model.backtests || 0),
            pnl: formatMoney(pnl),
            pnlNegative: pnl < 0,
            deployed: model.lifecycleStatus?.running,
            profile: profile,
        };
    }, html);
    if (html)
        return imageUrl;
    return {
        title: title,
        description: description,
        image: imageUrl,
    };
}
async function generateBacktestOpengraph(project, model, backtestId, html) {
    const path = `/projects/${project.id}/models/${model.id}/backtests/${backtestId}`;
    const backtest = await (0, firebase_1.getDocOrError)(path);
    const title = `${model.name} Backtest`;
    const symbols = backtest?.result?.symbols?.join(', ') || '';
    const start = formatDate(backtest?.result?.startTime);
    const end = formatDate(backtest?.result?.stopTime);
    const blanklyMetrics = await (0, firebase_1.getDocOrError)(`${path}/metrics/blankly`);
    const customMetrics = await (0, firebase_1.getDocOrError)(`${path}/metrics/custom`);
    const metrics = {
        ...blanklyMetrics.metrics,
        ...customMetrics.metrics
    };
    for (const [key, metric] of Object.entries(metrics)) {
        // @ts-ignore
        metrics[key] = metric.value; // remap to values
    }
    const imageUrl = await generateImage(backtest.id, 'opengraph-static/templates/backtest.hbs', true, async () => {
        const period = start && end ? `${start} - ${end}` : '-';
        const rawAccountValues = (await (0, firebase_1.getDocOrError)(`${path}/accountValues/accountValues`)).accountValues;
        const MAX_ACCOUNT_VALUES = 800;
        let accountValues = rawAccountValues;
        if (rawAccountValues.length > MAX_ACCOUNT_VALUES) {
            const rawRatio = rawAccountValues.length / MAX_ACCOUNT_VALUES;
            accountValues = Array.from({ length: MAX_ACCOUNT_VALUES }, (_x, i) => rawAccountValues[Math.floor(i * rawRatio)]);
        }
        return {
            title: title,
            model: model.name,
            backtestId: backtest.id,
            period: period,
            exchange: Object.values(backtest?.result?.exchanges || model?.exchanges || {})?.[0],
            tickers: Object.values(backtest?.result?.symbols || {}).join(', '),
            metrics: metrics,
            accountValues: accountValues,
            borderColor: metrics.cum_returns < 0 ? 'red' : 'green'
        };
    }, html);
    if (html)
        return imageUrl;
    return {
        title: title,
        description: `Backtest ran from ${start} to ${end} on ${symbols}
Metrics: ${metrics.sharpe} Sharpe, ${metrics.cagr}% CAGR, ${metrics.volatility} Volatility, ${metrics.cum_returns}% Cum Returns`,
        image: imageUrl,
    };
}
async function generateImage(id, templatePath, stale, data, html) {
    if (html)
        return Handlebars.render(templatePath, await data());
    const filePath = `media-previews/${id}.png`;
    const storage = admin.storage().bucket();
    const uploadedFile = storage.file(filePath);
    const fileExists = await uploadedFile.exists().then(d => d[0]);
    // TODO hardest problem in computer science
    const devMode = process.env.NODE_ENV !== 'production';
    if (stale || devMode || !fileExists) {
        const templateString = await fs_1.promises.readFile(templatePath);
        const image = await nodeHtmlToImage({
            html: templateString.toString(),
            content: await data(),
            beforeScreenshot: (page) => {
                if (!devMode)
                    return;
                page.content()
                    .then((content) => fs_1.promises.writeFile(`out/${id}.html`, content))
                    .catch((err) => console.error(`failed to write output file: ${err}`));
            }
        });
        await uploadedFile.save(image);
        await uploadedFile.makePublic();
    }
    // evil hack to stop platforms from caching stale images
    return uploadedFile.publicUrl() + `?cache=${Math.floor(Math.random() * 10000)}`;
}
Handlebars.render = Handlebars.render || function (tpl, data) {
    data = data || {};
    let compiled = Handlebars.render.cache[tpl];
    if (!compiled) {
        // Uncached template
        compiled = Handlebars.compile(tpl);
        Handlebars.render.cache[tpl] = compiled;
    }
    return compiled(data);
};
Handlebars.render.cache = {};
async function getUserProfile(project) {
    try {
        const user = await (0, firebase_1.getDocOrError)(`/users/${project.creator}`);
        let profileUrl = user.profileUrl;
        // profile urls end with =s96-c, this makes them smol
        // we remove this to make them big
        const index = profileUrl.lastIndexOf('=');
        if (index > 0 && profileUrl.length - index <= 6) {
            profileUrl = profileUrl.slice(0, index);
        }
        return profileUrl || '';
    }
    catch (err) {
        console.error(`could not get user profile for project ${project.id}`);
        return '';
    }
}
const formatMoney = (num) => {
    if (!num)
        return '$0';
    // format number to 4 digits max
    // 25.334533 -> $25.33
    // 250.34544 -> $250
    // 0.2523644 -> $.2523
    // 29384.324 -> $29.3K
    // 2938432 -> $2.93M
    let v = trimNumber(num); // convert
    if (v.startsWith('-'))
        v = v.slice(1); // remove negative
    while (v.startsWith('0'))
        v = v.slice(1); // remove leading zeros
    v = v.slice(0, 4); // truncate 4 chars
    if (v.endsWith('.'))
        v = v.slice(0, -1); // remove trailing period
    while (v.endsWith('0'))
        v = v.slice(0, -1); // remove trailing zeroes
    v = '$' + v;
    if (num < 0)
        v = '-' + v; // add negative back
    return v;
};
const trimNumber = (num) => {
    if (num < 1000)
        return String(num);
    // calculate suffix
    const SUFFIX = ['', 'K', 'M', 'B', 'T'];
    let i, n;
    for (i = 0, n = num; n > 1000; n /= 1000, i++)
        ;
    return String(Math.trunc(n)) + SUFFIX[i];
};
const formatDate = (epoch) => {
    const date = epoch ? new Date(epoch * 1000) : new Date();
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}/${day}/${year}`;
};
Handlebars.registerHelper('metric-class', (metric, negative, positive) => {
    if (positive < negative) {
        positive = -positive;
        negative = -negative;
        metric = -metric;
    }
    if (negative <= metric && metric <= positive)
        return '';
    return metric < negative ? 'negative' : 'positive';
});
Handlebars.registerHelper('css', (path) => {
    const styles = fs.readFileSync(path);
    return `<style>${styles}</style>`;
});
Handlebars.registerHelper('round', (num, places = 2) => {
    if (!num)
        return '0';
    return parseInt(String(num)).toFixed(places);
});
Handlebars.registerHelper('encode-url', (...args) => {
    // last element is some handlebars garbage
    const path = args.slice(0, -1).join('');
    const type = (0, mime_types_1.lookup)(path);
    const encoded = fs.readFileSync(path, 'base64');
    return `data:${type};base64,${encoded}`;
});
Handlebars.registerHelper('json', (obj) => {
    return JSON.stringify(obj);
});
//# sourceMappingURL=opengraph.js.map