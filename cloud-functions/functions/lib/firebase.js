"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteField = exports.Timestamp = void 0;
exports.updateCollectionCounter = updateCollectionCounter;
exports.getDoc = getDoc;
exports.deleteDoc = deleteDoc;
exports.getDocOrError = getDocOrError;
exports.setDoc = setDoc;
exports.addDoc = addDoc;
exports.getCollection = getCollection;
const admin = require("firebase-admin");
const firebase_admin_1 = require("firebase-admin");
var FieldValue = firebase_admin_1.firestore.FieldValue;
admin.initializeApp();
async function getDoc(path) {
    const doc = await admin.firestore().doc(path).get();
    return { id: doc.id, ...doc.data(), exists: doc.exists };
}
async function deleteDoc(path) {
    return admin.firestore().doc(path).delete();
}
async function getDocOrError(path) {
    const doc = await getDoc(path);
    if (!doc || !doc.exists)
        throw Error(`the document at ${path} does not exist or is empty`);
    return doc;
}
function setDoc(path, data) {
    return admin.firestore().doc(path).set(data, { merge: true });
}
async function addDoc(collectionPath, data, name = '') {
    return await admin.firestore().collection(collectionPath).add(data);
}
async function getCollection(path, orderBy) {
    let collection = await admin.firestore().collection(path).get();
    return collection.docs.map((item) => {
        return { id: item.id, ...item.data() };
    });
}
async function recountCollection(docSnap, key, collectionPath) {
    // this does a read for each doc in collection
    // avoid!
    const collectionRef = admin.firestore().collection(collectionPath);
    const collection = await collectionRef.get();
    const size = collection.size;
    let params = {};
    params[key] = size;
    await docSnap.ref.update(params);
    return size;
}
async function updateCollectionCounter(documentPath, key, collectionPath, increment) {
    const docSnap = await admin.firestore().doc(documentPath).get();
    const data = docSnap.data();
    if (data && data.trades) {
        await docSnap.ref.update({ trades: FieldValue.increment(increment) });
        return;
    }
    await recountCollection(docSnap, key, collectionPath);
}
const Timestamp = admin.firestore.FieldValue.serverTimestamp;
exports.Timestamp = Timestamp;
const deleteField = admin.firestore.FieldValue.delete();
exports.deleteField = deleteField;
//# sourceMappingURL=firebase.js.map